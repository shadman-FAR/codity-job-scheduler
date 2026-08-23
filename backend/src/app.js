import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Codity Job Scheduler API is running',
    timestamp: new Date().toISOString(),
  });
});

// Feature routes
app.use('/api/auth', authRoutes);

// Centralized error handler — must be last
app.use(errorHandler);

export default app;