import prisma from '../utils/prismaClient.js';

const ONLINE_THRESHOLD_MS = 10_000;
const STALE_THRESHOLD_MS = 30_000;

function computeLiveStatus(worker) {
  if (!worker.lastHeartbeatAt) return 'OFFLINE';
  const msSinceHeartbeat = Date.now() - new Date(worker.lastHeartbeatAt).getTime();
  if (worker.status === 'OFFLINE') return 'OFFLINE';
  if (msSinceHeartbeat < ONLINE_THRESHOLD_MS) return 'ONLINE';
  if (msSinceHeartbeat < STALE_THRESHOLD_MS) return 'STALE';
  return 'OFFLINE';
}

export async function listWorkers() {
  const workers = await prisma.worker.findMany({
    orderBy: { startedAt: 'desc' },
    include: { _count: { select: { executions: true } } },
  });
  return workers.map((w) => ({ ...w, liveStatus: computeLiveStatus(w) }));
}

export async function getWorkerById(workerId) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      heartbeats: { orderBy: { createdAt: 'desc' }, take: 20 },
      executions: { orderBy: { startedAt: 'desc' }, take: 20 },
    },
  });
  if (!worker) {
    const error = new Error('Worker not found');
    error.statusCode = 404;
    error.code = 'WORKER_NOT_FOUND';
    throw error;
  }
  return { ...worker, liveStatus: computeLiveStatus(worker) };
}