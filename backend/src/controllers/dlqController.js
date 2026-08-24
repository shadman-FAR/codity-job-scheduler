import { listDlqEntries, retryDlqEntry } from '../services/dlqService.js';

export async function list(req, res, next) {
  try {
    const entries = await listDlqEntries(req.userId);
    res.status(200).json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
}

export async function retry(req, res, next) {
  try {
    const job = await retryDlqEntry(req.userId, req.params.id);
    res.status(200).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}