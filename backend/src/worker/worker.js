import dotenv from 'dotenv';
dotenv.config();

import prisma from '../utils/prismaClient.js';
import { calculateRetryDelay } from '../utils/retryCalculator.js';

const WORKER_ID = `worker-${process.pid}`;
const POLL_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 5000;

let workerRowId = null;   // our Worker table row's own UUID (different from WORKER_ID string)
let isShuttingDown = false;
let isJobInFlight = false;
let pollTimer = null;
let heartbeatTimer = null;

console.log(`[${WORKER_ID}] Starting worker...`);

/**
 * Registers this process as a Worker row in the database and marks it ONLINE.
 * Called once at startup.
 */
async function registerWorker() {
  const worker = await prisma.worker.create({
    data: {
      name: WORKER_ID,
      status: 'ONLINE',
      lastHeartbeatAt: new Date(),
    },
  });
  workerRowId = worker.id;
  console.log(`[${WORKER_ID}] Registered as Worker row ${workerRowId}`);
}

/**
 * Sends a heartbeat: updates the Worker row's lastHeartbeatAt (fast lookup)
 * AND inserts a WorkerHeartbeat history row (full audit trail, per Phase 5 design).
 */
async function sendHeartbeat() {
  if (!workerRowId) return;

  const now = new Date();

  await prisma.worker.update({
    where: { id: workerRowId },
    data: { status: 'ONLINE', lastHeartbeatAt: now },
  });

  await prisma.workerHeartbeat.create({
    data: { workerId: workerRowId, status: 'ONLINE', createdAt: now },
  });

  console.log(`[${WORKER_ID}] Heartbeat sent.`);
}

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

async function executeJob(job) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (job.payload?.shouldFail) {
    return { success: false, error: 'Simulated failure (payload.shouldFail = true)' };
  }

  return { success: true };
}

async function handleFailure(job, errorMessage) {
  const maxAttempts = job.maxAttempts ?? job.queue.maxAttempts;
  const strategy = job.retryStrategy ?? job.queue.retryStrategy;
  const baseDelay = job.baseDelaySeconds ?? job.queue.baseDelaySeconds;

  const newAttemptCount = job.attemptCount + 1;

  if (newAttemptCount >= maxAttempts) {
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: { status: 'DEAD', attemptCount: newAttemptCount, lastError: errorMessage },
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
    data: { status: 'SCHEDULED', attemptCount: newAttemptCount, nextRetryAt, lastError: errorMessage },
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
  if (isShuttingDown) return; // stop accepting new jobs once shutdown begins

  console.log(`[${WORKER_ID}] Polling for eligible jobs...`);

  const job = await claimJob();

  if (!job) {
    console.log(`[${WORKER_ID}] No job claimed this cycle.`);
    return;
  }

  isJobInFlight = true;
  console.log(`[${WORKER_ID}] CLAIMED job ${job.id}. Executing...`);

  await prisma.jobLog.create({
    data: { jobId: job.id, event: 'JOB_CLAIMED', message: `Claimed by ${WORKER_ID}` },
  });

  const result = await executeJob(job);

  if (result.success) {
    await prisma.job.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
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

  isJobInFlight = false;
}

/**
 * Graceful shutdown handler.
 * 1. Stop the timers (no new polling, no new heartbeats)
 * 2. Wait for any in-flight job to finish (don't abandon it mid-execution)
 * 3. Mark this Worker row OFFLINE in the database
 * 4. Disconnect Prisma cleanly
 * 5. Exit
 */
async function shutdown(signal) {
  if (isShuttingDown) return; // avoid double-shutdown if signal fires twice
  isShuttingDown = true;

  console.log(`[${WORKER_ID}] Received ${signal}. Shutting down gracefully...`);

  clearInterval(pollTimer);
  clearInterval(heartbeatTimer);

  if (isJobInFlight) {
    console.log(`[${WORKER_ID}] Waiting for in-flight job to finish...`);
    while (isJobInFlight) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (workerRowId) {
    await prisma.worker.update({
      where: { id: workerRowId },
      data: { status: 'OFFLINE' },
    });
    console.log(`[${WORKER_ID}] Marked OFFLINE in database.`);
  }

  await prisma.$disconnect();
  console.log(`[${WORKER_ID}] Shutdown complete. Exiting.`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function start() {
  await registerWorker();
  pollTimer = setInterval(pollForJobs, POLL_INTERVAL_MS);
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

start();