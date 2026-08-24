import dotenv from 'dotenv';
dotenv.config();

import prisma from '../utils/prismaClient.js';

const WORKER_ID = `worker-${process.pid}`;
const POLL_INTERVAL_MS = 1000;

console.log(`[${WORKER_ID}] Starting worker...`);

/**
 * Atomically claims ONE eligible job.
 *
 * How it works:
 * 1. Find a candidate job (this SELECT can be "stale" — that's fine, see step 2)
 * 2. Attempt a conditional UPDATE: only succeeds if the job is STILL
 *    status='QUEUED' at the moment the UPDATE actually runs.
 * 3. Check how many rows the UPDATE affected:
 *    - 1 row  -> we won the race, we now own this job
 *    - 0 rows -> someone else claimed it first; we back off and try again
 *
 * This works because PostgreSQL guarantees that a single UPDATE statement
 * is atomic: no other transaction can modify the same row halfway through
 * our UPDATE. The WHERE clause is checked at the exact moment of the write,
 * not at some earlier SELECT time — closing the race condition window
 * completely.
 */
async function claimJob() {
  const candidate = await prisma.job.findFirst({
    where: { status: 'QUEUED' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  if (!candidate) return null;

  // Simulate the same artificial delay as before, on purpose —
  // this proves the fix works even under the exact same race conditions
  // that broke the naive version.
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const result = await prisma.job.updateMany({
    where: {
      id: candidate.id,
      status: 'QUEUED', // <-- the critical condition, re-checked atomically at write time
    },
    data: {
      status: 'RUNNING',
      claimedBy: WORKER_ID,
      claimedAt: new Date(),
    },
  });

  if (result.count === 0) {
    // Someone else claimed it between our SELECT and our UPDATE.
    // This is expected and healthy — not an error.
    console.log(`[${WORKER_ID}] Lost race for job ${candidate.id} — already claimed by another worker.`);
    return null;
  }

  // We won the race — fetch the full row now that we own it
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

  // Simulate job execution
  await new Promise((resolve) => setTimeout(resolve, 1000));

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