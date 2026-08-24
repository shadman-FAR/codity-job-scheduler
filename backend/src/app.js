import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import projectQueueRoutes from './routes/projectQueueRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import queueJobRoutes from './routes/queueJobRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import dlqRoutes from './routes/dlqRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import workerRoutes from './routes/workerRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Codity Job Scheduler API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/queues', projectQueueRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/queues/:queueId/jobs', queueJobRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/dlq', dlqRoutes);
app.use('/api/workers', workerRoutes);
app.use(errorHandler);

export default app;