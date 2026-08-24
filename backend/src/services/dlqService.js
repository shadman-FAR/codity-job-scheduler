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
 * Lists all DLQ entries belonging to the user's organization.
 * Scoped through: DeadLetterQueue -> Job -> Queue -> Project -> Organization
 */
export async function listDlqEntries(userId) {
  const organizationId = await getUserOrganizationId(userId);

  return prisma.deadLetterQueue.findMany({
    where: {
      job: { queue: { project: { organizationId } } },
    },
    include: {
      job: { select: { id: true, type: true, payload: true, queueId: true } },
    },
    orderBy: { movedAt: 'desc' },
  });
}

/**
 * Manually retries a DLQ entry: resets the job back to QUEUED with a fresh
 * attempt count, and removes the DLQ record (since it's no longer permanently failed).
 */
export async function retryDlqEntry(userId, dlqId) {
  const organizationId = await getUserOrganizationId(userId);

  const entry = await prisma.deadLetterQueue.findFirst({
    where: { id: dlqId, job: { queue: { project: { organizationId } } } },
  });

  if (!entry) {
    const error = new Error('Dead letter queue entry not found');
    error.statusCode = 404;
    error.code = 'DLQ_ENTRY_NOT_FOUND';
    throw error;
  }

  const [job] = await prisma.$transaction([
    prisma.job.update({
      where: { id: entry.jobId },
      data: {
        status: 'QUEUED',
        attemptCount: 0,
        lastError: null,
        claimedBy: null,
        claimedAt: null,
      },
    }),
    prisma.deadLetterQueue.delete({ where: { id: dlqId } }),
  ]);

  await prisma.jobLog.create({
    data: { jobId: entry.jobId, event: 'JOB_CREATED', message: 'Manually retried from Dead Letter Queue' },
  });

  return job;
}