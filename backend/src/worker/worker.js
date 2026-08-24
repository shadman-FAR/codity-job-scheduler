import dotenv from 'dotenv';
dotenv.config();

import prisma from '../utils/prismaClient.js';
import { calculateRetryDelay } from '../utils/retryCalculator.js';

const WORKER_ID = `worker-${process.pid}`;
const POLL_INTERVAL_MS = 1000;

console.log(`[${WORKER_ID}] Starting worker...`);

async function findClaimableCandidate() {
  const now = new Date();

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
      queueId: { in: queuesWithRoom },
      OR: [
        { status: 'QUEUED' },
        { status: 'SCHEDULED', scheduledFor: { lte: now } },
        { status: 'SCHEDULED', nextRetryAt: { lte: now } },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: { queue: true },
  });
}

async function claimJob() {
  const candidate = await findClaimableCandidate();
  if (!candidate) return null;

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

  // Atomic claim: must still match the SAME eligibility conditions used to find it
  const now = new Date();
  const result = await prisma.job.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: 'QUEUED' },
        { status: 'SCHEDULED', scheduledFor: { lte: now } },
        { status: 'SCHEDULED', nextRetryAt: { lte: now } },
      ],
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

  return prisma.job.findUnique({ where: { id: candidate.id }, include: { queue: true } });
}

/**
 * Simulates job execution. Returns { success: true } or { success: false, error }.
 *
 * Real job execution logic would go here (calling an external API, sending an
 * email, etc). For this assignment, we simulate failure via a special payload
 * flag so we can reliably demonstrate and test the retry system.
 */
async function executeJob(job) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (job.payload?.shouldFail) {
    return { success: false, error: 'Simulated failure (payload.shouldFail = true)' };
  }

  return { success: true };
}

/**
 * Handles a failed job: decides whether to retry (with backoff) or
 * give up and hand off to the Dead Letter Queue.
 */
async function handleFailure(job, errorMessage) {
  const maxAttempts = job.maxAttempts ?? job.queue.maxAttempts;
  const strategy = job.retryStrategy ?? job.queue.retryStrategy;
  const baseDelay = job.baseDelaySeconds ?? job.queue.baseDelaySeconds;

  const newAttemptCount = job.attemptCount + 1;

    if (newAttemptCount >= maxAttempts) {
    // Permanently failed — update job status AND create a DLQ record,
    // atomically together, so the two never get out of sync.
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'DEAD',
          attemptCount: newAttemptCount,
          lastError: errorMessage,
        },
      }),
      prisma.deadLetterQueue.create({
        data: {
          jobId: job.id,
          originalQueue: job.queue.name,
          failureReason: errorMessage,
          attemptsMade: newAttemptCount,
          lastError: errorMessage,
          workerInfo: WORKER_ID,
        },
      }),
    ]);

    await prisma.jobLog.create({
      data: { jobId: job.id, event: 'JOB_MOVED_TO_DLQ', message: `Exhausted ${newAttemptCount} attempts: ${errorMessage}` },
    });

    console.log(`[${WORKER_ID}] Job ${job.id} exhausted retries (${newAttemptCount}/${maxAttempts}) — moved to DLQ.`);
    return;
  }

  const delaySeconds = calculateRetryDelay(strategy, baseDelay, newAttemptCount);
  const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: 'SCHEDULED',
      attemptCount: newAttemptCount,
      nextRetryAt,
      lastError: errorMessage,
    },
  });

  await prisma.jobLog.create({
    data: {
      jobId: job.id,
      event: 'JOB_RETRYING',
      message: `Attempt ${newAttemptCount}/${maxAttempts} failed. Retrying in ${delaySeconds}s (${strategy}). Error: ${errorMessage}`,
    },
  });

  console.log(`[${WORKER_ID}] Job ${job.id} failed (attempt ${newAttemptCount}/${maxAttempts}). Retry in ${delaySeconds}s via ${strategy}.`);
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

  const result = await executeJob(job);

  if (result.success) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED' },
    });

    await prisma.jobLog.create({
      data: { jobId: job.id, event: 'JOB_COMPLETED', message: `Completed by ${WORKER_ID}` },
    });

    console.log(`[${WORKER_ID}] COMPLETED job ${job.id}`);
  } else {
    await prisma.jobLog.create({
      data: { jobId: job.id, event: 'JOB_FAILED', message: `Failed: ${result.error}` },
    });

    await handleFailure(job, result.error);
  }
}

setInterval(pollForJobs, POLL_INTERVAL_MS);