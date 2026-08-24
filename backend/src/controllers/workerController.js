import { listWorkers, getWorkerById } from '../services/workerService.js';

export async function list(req, res, next) {
  try {
    const workers = await listWorkers();
    res.status(200).json({ success: true, data: workers });
  } catch (err) { next(err); }
}

export async function getOne(req, res, next) {
  try {
    const worker = await getWorkerById(req.params.id);
    res.status(200).json({ success: true, data: worker });
  } catch (err) { next(err); }
}