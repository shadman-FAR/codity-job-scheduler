import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

export default function QueueDetail() {
  const { id } = useParams();
  const [queue, setQueue] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [payload, setPayload] = useState('{"task": "example"}');
  const [filter, setFilter] = useState('');

  async function load() {
    const [q, j, s] = await Promise.all([
      api.get(`/queues/${id}`),
      api.get(`/queues/${id}/jobs${filter ? `?status=${filter}` : ''}`),
      api.get(`/queues/${id}/stats`),
    ]);
    setQueue(q.data.data);
    setJobs(j.data.data);
    setStats(s.data.data);
  }

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [id, filter]);

  async function togglePause() {
    const action = queue.isActive ? 'pause' : 'resume';
    await api.patch(`/queues/${id}/${action}`);
    load();
  }

  async function createJob(e) {
    e.preventDefault();
    try {
      const parsed = JSON.parse(payload);
      await api.post(`/queues/${id}/jobs`, { type: 'IMMEDIATE', payload: parsed });
      load();
    } catch {
      alert('Payload must be valid JSON');
    }
  }

  if (!queue) return <p>Loading...</p>;

  return (
    <div>
      <h2>{queue.name} <button onClick={togglePause}>{queue.isActive ? 'Pause' : 'Resume'}</button></h2>
      <p>Priority: {queue.priority} | Concurrency: {queue.concurrencyLimit} | Retry: {queue.retryStrategy}</p>

      {stats && (
        <div className="stat-grid">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="stat-card small"><h4>{v}</h4><p>{k}</p></div>
          ))}
        </div>
      )}

      <form onSubmit={createJob} className="inline-form">
        <input value={payload} onChange={(e) => setPayload(e.target.value)} style={{ width: '300px' }} />
        <button type="submit">Create Immediate Job</button>
      </form>

      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All statuses</option>
        {['QUEUED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD'].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <table className="job-table">
        <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.id.slice(0, 8)}</td>
              <td>{j.type}</td>
              <td>{j.status}</td>
              <td>{j.attemptCount}</td>
              <td>{new Date(j.createdAt).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}