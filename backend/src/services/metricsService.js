import prisma from '../utils/prismaClient.js';

async function getUserOrganizationId(userId) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId }, select: { organizationId: true },
  });
  if (!membership) {
    const error = new Error('User does not belong to any organization');
    error.statusCode = 403; error.code = 'NO_ORGANIZATION';
    throw error;
  }
  return membership.organizationId;
}

export async function getSystemMetrics(userId) {
  const organizationId = await getUserOrganizationId(userId);

  const statusCounts = await prisma.job.groupBy({
    by: ['status'],
    where: { queue: { project: { organizationId } } },
    _count: { status: true },
  });

  const stats = { QUEUED: 0, SCHEDULED: 0, CLAIMED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, RETRYING: 0, DEAD: 0 };
  for (const row of statusCounts) stats[row.status] = row._count.status;

  const [workerCount, queueCount, projectCount] = await Promise.all([
    prisma.worker.count(),
    prisma.queue.count({ where: { project: { organizationId } } }),
    prisma.project.count({ where: { organizationId } }),
  ]);

  const onlineWorkers = await prisma.worker.count({
    where: { lastHeartbeatAt: { gte: new Date(Date.now() - 10_000) }, status: { not: 'OFFLINE' } },
  });

  return {
    jobs: stats,
    totalJobs: Object.values(stats).reduce((a, b) => a + b, 0),
    workers: { total: workerCount, online: onlineWorkers },
    queues: queueCount,
    projects: projectCount,
  };
}