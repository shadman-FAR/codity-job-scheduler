import {
  createJob,
  createBatchJobs,
  listJobs,
  getJobById,
} from '../services/jobService.js';

export async function create(req, res, next) {
  try {
    const job = await createJob(req.userId, req.params.queueId, req.body);
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function createBatch(req, res, next) {
  try {
    const result = await createBatchJobs(req.userId, req.params.queueId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const { status, type, page, limit } = req.query;
    const result = await listJobs(req.userId, req.params.queueId, { status, type, page, limit });
    res.status(200).json({ success: true, data: result.jobs, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const job = await getJobById(req.userId, req.params.id);
    res.status(200).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}