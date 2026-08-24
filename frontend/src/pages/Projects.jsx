import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');

  async function load() {
    const res = await api.get('/projects');
    setProjects(res.data.data);
  }

  useEffect(() => { load(); }, []);

  async function createProject(e) {
    e.preventDefault();
    await api.post('/projects', { name });
    setName('');
    load();
  }

  async function deleteProject(id) {
    if (!confirm('Delete this project?')) return;
    await api.delete(`/projects/${id}`);
    load();
  }

  return (
    <div>
      <h2>Projects</h2>
      <form onSubmit={createProject} className="inline-form">
        <input placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit">Create</button>
      </form>
      <ul className="list">
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>{p.name}</Link>
            <span>{p._count?.queues ?? 0} queues</span>
            <button onClick={() => deleteProject(p.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}