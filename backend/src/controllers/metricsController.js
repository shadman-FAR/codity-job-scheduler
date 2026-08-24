import { getSystemMetrics } from '../services/metricsService.js';

export async function get(req, res, next) {
  try {
    const metrics = await getSystemMetrics(req.userId);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) { next(err); }
}