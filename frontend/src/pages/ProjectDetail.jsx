import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [queueName, setQueueName] = useState('');

  async function load() {
    const res = await api.get(`/projects/${id}`);
    setProject(res.data.data);
  }

  useEffect(() => { load(); }, [id]);

  async function createQueue(e) {
    e.preventDefault();
    await api.post(`/projects/${id}/queues`, { name: queueName });
    setQueueName('');
    load();
  }

  if (!project) return <p>Loading...</p>;

  return (
    <div>
      <h2>{project.name}</h2>
      <form onSubmit={createQueue} className="inline-form">
        <input placeholder="New queue name" value={queueName} onChange={(e) => setQueueName(e.target.value)} required />
        <button type="submit">Create Queue</button>
      </form>
      <ul className="list">
        {project.queues.map((q) => (
          <li key={q.id}>
            <Link to={`/queues/${q.id}`}>{q.name}</Link>
            <span>{q.isActive ? 'Active' : 'Paused'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}