import prisma from '../utils/prismaClient.js';

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
 * Verifies the project exists AND belongs to the user's organization.
 * Used before creating/listing queues under a project.
 */
async function assertProjectOwnership(userId, projectId) {
  const organizationId = await getUserOrganizationId(userId);

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
  });

  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }

  return project;
}

export async function createQueue(userId, projectId, data) {
  await assertProjectOwnership(userId, projectId);

  const { name, priority, concurrencyLimit, retryStrategy, maxAttempts, baseDelaySeconds } = data;

  return prisma.queue.create({
    data: {
      projectId,
      name,
      priority: priority ?? 0,
      concurrencyLimit: concurrencyLimit ?? 1,
      retryStrategy: retryStrategy ?? 'FIXED',
      maxAttempts: maxAttempts ?? 3,
      baseDelaySeconds: baseDelaySeconds ?? 5,
    },
  });
}

export async function listQueues(userId, projectId) {
  await assertProjectOwnership(userId, projectId);

  return prisma.queue.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { jobs: true } },
    },
  });
}

export async function getQueueById(userId, queueId) {
  const organizationId = await getUserOrganizationId(userId);

  const queue = await prisma.queue.findFirst({
    where: { id: queueId, project: { organizationId } }, // two-level ownership check, one query
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { jobs: true } },
    },
  });

  if (!queue) {
    const error = new Error('Queue not found');
    error.statusCode = 404;
    error.code = 'QUEUE_NOT_FOUND';
    throw error;
  }

  return queue;
}

export async function updateQueue(userId, queueId, data) {
  await getQueueById(userId, queueId); // ownership check

  const { name, priority, concurrencyLimit, retryStrategy, maxAttempts, baseDelaySeconds } = data;

  return prisma.queue.update({
    where: { id: queueId },
    data: { name, priority, concurrencyLimit, retryStrategy, maxAttempts, baseDelaySeconds },
  });
}

export async function pauseQueue(userId, queueId) {
  await getQueueById(userId, queueId);
  return prisma.queue.update({ where: { id: queueId }, data: { isActive: false } });
}

export async function resumeQueue(userId, queueId) {
  await getQueueById(userId, queueId);
  return prisma.queue.update({ where: { id: queueId }, data: { isActive: true } });
}

export async function deleteQueue(userId, queueId) {
  await getQueueById(userId, queueId);
  await prisma.queue.delete({ where: { id: queueId } });
}

/**
 * Queue statistics: counts of jobs by status.
 * Uses Prisma's groupBy for an efficient single-query aggregation
 * instead of fetching all jobs and counting them in JavaScript.
 */
export async function getQueueStats(userId, queueId) {
  await getQueueById(userId, queueId);

  const statusCounts = await prisma.job.groupBy({
    by: ['status'],
    where: { queueId },
    _count: { status: true },
  });

  const stats = {
    QUEUED: 0, SCHEDULED: 0, CLAIMED: 0, RUNNING: 0,
    COMPLETED: 0, FAILED: 0, RETRYING: 0, DEAD: 0,
  };

  for (const row of statusCounts) {
    stats[row.status] = row._count.status;
  }

  return stats;
}