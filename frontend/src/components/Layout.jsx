import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app">
      <nav className="sidebar">
        <h1>Codity Scheduler</h1>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/workers">Workers</Link>
        <Link to="/dlq">Dead Letter Queue</Link>
        <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
      </nav>
      <main className="content"><Outlet /></main>
    </div>
  );
}