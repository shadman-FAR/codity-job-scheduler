import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route — proves the server is alive and responding
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Codity Job Scheduler API is running',
    timestamp: new Date().toISOString(),
  });
});

export default app;