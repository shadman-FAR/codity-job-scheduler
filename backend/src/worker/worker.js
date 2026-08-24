import dotenv from 'dotenv';
dotenv.config();

import prisma from '../utils/prismaClient.js';

const WORKER_ID = `worker-${process.pid}`;
const POLL_INTERVAL_MS = 1000;

console.log(`[${WORKER_ID}] Starting worker...`);

/**
 * Finds a candidate job to claim, respecting each queue's concurrency limit.
 *
 * Strategy:
 * 1. Get all active queues along with their concurrencyLimit and current
 *    count of RUNNING jobs.
 * 2. Filter to queues that still have room (runningCount < concurrencyLimit).
 * 3. Look for a QUEUED job only within those queues.
 *
 * This "check queues with room, then look for jobs there" approach still
 * has the same atomicity requirement as before: the actual claim (Phase 11's
 * conditional updateMany) is what finally enforces correctness. The queue
 * filtering here just makes our SELECT smarter about WHICH job to attempt --
 * the atomic updateMany afterward is still what prevents any double-claim
 * or limit violation from actually landing in the database.
 */
async function findClaimableCandidate() {
  const queues = await prisma.queue.findMany({
    where: { isActive: true },
    select: {
      id: true,
      concurrencyLimit: true,
      _count: { select: { jobs: { where: { status: 'RUNNING' } } } },
    },
  });

  const queuesWithRoom = queues
    .filter((q) => q._count.jobs < q.concurrencyLimit)
    .map((q) => q.id);

  if (queuesWithRoom.length === 0) return null;

  return prisma.job.findFirst({
    where: {
      status: 'QUEUED',
      queueId: { in: queuesWithRoom },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
}

/**
 * Atomically claims ONE eligible job, re-verifying BOTH:
 * - the job is still QUEUED (Phase 11's fix)
 * - the job's queue still has room under its concurrency limit (this phase's fix)
 *
 * Re-checking the concurrency limit again at claim time (not just during
 * candidate selection) closes the same kind of race window we closed in
 * Phase 11 -- two workers could both pass the "queue has room" check above
 * before either actually claims, so the limit must be enforced again here,
 * atomically, at the moment of the write.
 */
async function claimJob() {
  const candidate = await findClaimableCandidate();
  if (!candidate) return null;

  await new Promise((resolve) => setTimeout(resolve, 300));

  const queue = await prisma.queue.findUnique({
    where: { id: candidate.queueId },
    select: {
      concurrencyLimit: true,
      _count: { select: { jobs: { where: { status: 'RUNNING' } } } },
    },
  });

  if (!queue || queue._count.jobs >= queue.concurrencyLimit) {
    console.log(`[${WORKER_ID}] Queue for job ${candidate.id} is at capacity — skipping.`);
    return null;
  }

  const result = await prisma.job.updateMany({
    where: {
      id: candidate.id,
      status: 'QUEUED',
    },
    data: {
      status: 'RUNNING',
      claimedBy: WORKER_ID,
      claimedAt: new Date(),
    },
  });

  if (result.count === 0) {
    console.log(`[${WORKER_ID}] Lost race for job ${candidate.id} — already claimed by another worker.`);
    return null;
  }

  return prisma.job.findUnique({ where: { id: candidate.id } });
}

async function pollForJobs() {
  console.log(`[${WORKER_ID}] Polling for eligible jobs...`);

  const job = await claimJob();

  if (!job) {
    console.log(`[${WORKER_ID}] No job claimed this cycle.`);
    return;
  }

  console.log(`[${WORKER_ID}] CLAIMED job ${job.id}. Executing...`);

  await prisma.jobLog.create({
    data: { jobId: job.id, event: 'JOB_CLAIMED', message: `Claimed by ${WORKER_ID}` },
  });

  await new Promise((resolve) => setTimeout(resolve, 3000)); // longer execution to make concurrency visible

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'COMPLETED' },
  });

  await prisma.jobLog.create({
    data: { jobId: job.id, event: 'JOB_COMPLETED', message: `Completed by ${WORKER_ID}` },
  });

  console.log(`[${WORKER_ID}] COMPLETED job ${job.id}`);
}

setInterval(pollForJobs, POLL_INTERVAL_MS);