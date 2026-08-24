import prisma from '../utils/prismaClient.js';
import { CronExpressionParser } from 'cron-parser';
import crypto from 'crypto';

async function getUserOrganizationId(userId) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  if (!membership) {
    const error = new Error('User does not belong to any organization');
    error.statusCode = 403;
    error.code = 'NO_ORGANIZATION';
    throw error;
  }
  return membership.organizationId;
}

/**
 * Verifies the queue exists and belongs to the user's organization.
 * Returns the queue (with its default retry policy) for use during job creation.
 */
async function assertQueueOwnership(userId, queueId) {
  const organizationId = await getUserOrganizationId(userId);

  const queue = await prisma.queue.findFirst({
    where: { id: queueId, project: { organizationId } },
  });

  if (!queue) {
    const error = new Error('Queue not found');
    error.statusCode = 404;
    error.code = 'QUEUE_NOT_FOUND';
    throw error;
  }

  return queue;
}

/**
 * Builds the initial status + scheduledFor fields based on job type.
 * This is the core "job type" logic described in the assignment.
 */
function computeSchedulingFields(type, options) {
  const now = new Date();

  switch (type) {
    case 'IMMEDIATE':
      return { status: 'QUEUED', scheduledFor: null };

    case 'DELAYED': {
      const delaySeconds = options.delaySeconds;
      if (!delaySeconds || delaySeconds <= 0) {
        const error = new Error('DELAYED jobs require a positive delaySeconds value');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      const scheduledFor = new Date(now.getTime() + delaySeconds * 1000);
      return { status: 'SCHEDULED', scheduledFor };
    }

    case 'SCHEDULED': {
      if (!options.scheduledFor) {
        const error = new Error('SCHEDULED jobs require a scheduledFor timestamp');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      const scheduledFor = new Date(options.scheduledFor);
      if (isNaN(scheduledFor.getTime()) || scheduledFor <= now) {
        const error = new Error('scheduledFor must be a valid future date');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      return { status: 'SCHEDULED', scheduledFor };
    }

    case 'RECURRING': {
      if (!options.cronExpression) {
        const error = new Error('RECURRING jobs require a cronExpression');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      let nextRun;
      try {
        const interval = CronExpressionParser.parse(options.cronExpression);
        nextRun = interval.next().toDate();
      } catch {
        const error = new Error('Invalid cron expression');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
      return { status: 'SCHEDULED', scheduledFor: nextRun };
    }

    default: {
      const error = new Error(`Unsupported job type: ${type}`);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }
}

export async function createJob(userId, queueId, input) {
  await assertQueueOwnership(userId, queueId);

  const { type = 'IMMEDIATE', payload, priority, delaySeconds, scheduledFor, cronExpression } = input;

  if (payload === undefined) {
    const error = new Error('payload is required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const scheduling = computeSchedulingFields(type, { delaySeconds, scheduledFor, cronExpression });

  const job = await prisma.job.create({
    data: {
      queueId,
      type,
      payload,
      priority: priority ?? 0,
      status: scheduling.status,
      scheduledFor: scheduling.scheduledFor,
      cronExpression: type === 'RECURRING' ? cronExpression : null,
    },
  });

  await prisma.jobLog.create({
    data: { jobId: job.id, event: 'JOB_CREATED', message: `Job created with type ${type}` },
  });

  return job;
}

/**
 * Creates multiple jobs at once, all sharing a generated batchId.
 * Each item in `jobs` can have its own payload/priority, but they all
 * share the same type/queue for simplicity (a reasonable BATCH definition).
 */
export async function createBatchJobs(userId, queueId, input) {
  await assertQueueOwnership(userId, queueId);

  const { jobs } = input;
  if (!Array.isArray(jobs) || jobs.length === 0) {
    const error = new Error('jobs must be a non-empty array');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const batchId = crypto.randomUUID();

  const createdJobs = await prisma.$transaction(
    jobs.map((jobInput) =>
      prisma.job.create({
        data: {
          queueId,
          type: 'BATCH',
          payload: jobInput.payload,
          priority: jobInput.priority ?? 0,
          status: 'QUEUED',
          batchId,
        },
      })
    )
  );

  return { batchId, count: createdJobs.length, jobs: createdJobs };
}

export async function listJobs(userId, queueId, filters) {
  await assertQueueOwnership(userId, queueId);

  const { status, type, page = 1, limit = 20 } = filters;

  const where = { queueId };
  if (status) where.status = status;
  if (type) where.type = type;

  const skip = (Number(page) - 1) * Number(limit);

  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: Number(limit),
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}

export async function getJobById(userId, jobId) {
  const organizationId = await getUserOrganizationId(userId);

  const job = await prisma.job.findFirst({
    where: { id: jobId, queue: { project: { organizationId } } }, // three-level ownership check
    include: {
      queue: { select: { id: true, name: true } },
      executions: { orderBy: { startedAt: 'desc' } },
      logs: { orderBy: { createdAt: 'desc' } },
      deadLetter: true,
    },
  });

  if (!job) {
    const error = new Error('Job not found');
    error.statusCode = 404;
    error.code = 'JOB_NOT_FOUND';
    throw error;
  }

  return job;
}