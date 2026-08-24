import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Workers() {
  const [workers, setWorkers] = useState([]);

  async function load() {
    const res = await api.get('/workers');
    setWorkers(res.data.data);
  }

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  return (
    <div>
      <h2>Workers</h2>
      <table className="job-table">
        <thead><tr><th>Name</th><th>Status</th><th>Last Heartbeat</th><th>Executions</th></tr></thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.id}>
              <td>{w.name}</td>
              <td><span className={`badge ${w.liveStatus.toLowerCase()}`}>{w.liveStatus}</span></td>
              <td>{w.lastHeartbeatAt ? new Date(w.lastHeartbeatAt).toLocaleTimeString() : 'Never'}</td>
              <td>{w._count.executions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}