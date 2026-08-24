import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);

  async function load() {
    const res = await api.get('/metrics');
    setMetrics(res.data.data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // polling, per Rule #24
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return <p>Loading...</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="stat-grid">
        <div className="stat-card"><h3>{metrics.totalJobs}</h3><p>Total Jobs</p></div>
        <div className="stat-card"><h3>{metrics.jobs.QUEUED}</h3><p>Queued</p></div>
        <div className="stat-card"><h3>{metrics.jobs.RUNNING}</h3><p>Running</p></div>
        <div className="stat-card"><h3>{metrics.jobs.COMPLETED}</h3><p>Completed</p></div>
        <div className="stat-card"><h3>{metrics.jobs.FAILED + metrics.jobs.DEAD}</h3><p>Failed</p></div>
        <div className="stat-card"><h3>{metrics.workers.online}/{metrics.workers.total}</h3><p>Workers Online</p></div>
        <div className="stat-card"><h3>{metrics.queues}</h3><p>Queues</p></div>
        <div className="stat-card"><h3>{metrics.projects}</h3><p>Projects</p></div>
      </div>
    </div>
  );
}