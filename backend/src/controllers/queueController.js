import {
  createQueue,
  listQueues,
  getQueueById,
  updateQueue,
  pauseQueue,
  resumeQueue,
  deleteQueue,
  getQueueStats,
} from '../services/queueService.js';

export async function create(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name is required' },
      });
    }
    const queue = await createQueue(req.userId, req.params.projectId, req.body);
    res.status(201).json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const queues = await listQueues(req.userId, req.params.projectId);
    res.status(200).json({ success: true, data: queues });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const queue = await getQueueById(req.userId, req.params.id);
    res.status(200).json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const queue = await updateQueue(req.userId, req.params.id, req.body);
    res.status(200).json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
}

export async function pause(req, res, next) {
  try {
    const queue = await pauseQueue(req.userId, req.params.id);
    res.status(200).json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
}

export async function resume(req, res, next) {
  try {
    const queue = await resumeQueue(req.userId, req.params.id);
    res.status(200).json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteQueue(req.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function stats(req, res, next) {
  try {
    const data = await getQueueStats(req.userId, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}