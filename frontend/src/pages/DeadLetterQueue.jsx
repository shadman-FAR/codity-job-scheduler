import { useEffect, useState } from 'react';
import api from '../api/client';

export default function DeadLetterQueue() {
  const [entries, setEntries] = useState([]);

  async function load() {
    const res = await api.get('/dlq');
    setEntries(res.data.data);
  }

  useEffect(() => { load(); }, []);

  async function retry(id) {
    await api.post(`/dlq/${id}/retry`);
    load();
  }

  return (
    <div>
      <h2>Dead Letter Queue</h2>
      <table className="job-table">
        <thead><tr><th>Job ID</th><th>Queue</th><th>Reason</th><th>Attempts</th><th>Action</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{e.jobId.slice(0, 8)}</td>
              <td>{e.originalQueue}</td>
              <td>{e.failureReason}</td>
              <td>{e.attemptsMade}</td>
              <td><button onClick={() => retry(e.id)}>Retry</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && <p>No dead-lettered jobs.</p>}
    </div>
  );
}