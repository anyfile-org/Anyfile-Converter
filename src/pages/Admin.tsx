import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Clock,
  Download,
  ExternalLink,
  LogOut,
  MousePointerClick,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

interface AnalyticsEvent {
  id: number;
  event: string;
  category: string;
  operation: string;
  platform: string;
  app_version: string;
  quantity: number;
  timestamp: number;
}

interface CountRow {
  operation: string;
  count: number;
}

interface VersionRow {
  version: string;
  clients: number;
  percentage: number;
}

interface DashboardStats {
  totals: {
    totalButtonClicks: number;
    totalActions: number;
    downloads: number;
    githubVisits: number;
  };
  buttonClicks: CountRow[];
  toolUsage: CountRow[];
  versions: VersionRow[];
  events: AnalyticsEvent[];
  eventCount: number;
  eventPage: number;
  eventPageSize: number;
  updated_at: string;
}

const OPERATION_LABELS: Record<string, string> = {
  'button.download_latest': 'Download Latest Release (.exe)',
  'button.try_demo': 'Try In-Browser Demo',
  'button.github_repo': 'Official GitHub Repository Link',
  'button.web_app_open': 'Open Web App (/app)',
  'button.view_releases': 'View All GitHub Releases',
  'image.jpg_to_png': 'JPG → PNG',
  'image.png_to_jpg': 'PNG → JPG',
  'image.compress': 'Compress Image',
  'image.to_webp': 'Convert to WebP',
  'image.to_avif': 'Convert to AVIF',
  'image.demo_convert': 'Browser Image Conversion',
  'pdf.merge': 'Merge PDFs',
  'pdf.split': 'Split PDF',
  'archive.create_zip': 'Create ZIP',
  'archive.extract_zip': 'Extract ZIP',
  'video.extract_audio': 'Extract Audio (FFmpeg)',
};

export default function Admin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async (page = eventPage) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stats?page=${page}`, { credentials: 'same-origin' });
      if (response.status === 401) {
        setIsAuthenticated(false);
        setStats(null);
        return false;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load analytics');
      setStats(result as DashboardStats);
      setEventPage(page);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStats(1);
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Login failed');
      setPassword('');
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Could not log out');
      setIsAuthenticated(false);
      setStats(null);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log out');
    }
  };

  const maxToolCount = useMemo(
    () => Math.max(1, ...(stats?.toolUsage.map((item) => item.count) ?? [])),
    [stats]
  );
  const maxButtonCount = useMemo(
    () => Math.max(1, ...(stats?.buttonClicks.map((item) => item.count) ?? [])),
    [stats]
  );

  if (!isAuthenticated) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
        <form
          className="glass-panel"
          onSubmit={handleLogin}
          style={{ width: 'min(440px, 100%)', padding: '2rem', display: 'grid', gap: '1rem' }}
        >
          <div style={{ textAlign: 'center' }}>
            <ShieldAlert size={30} style={{ color: 'var(--primary-accent)' }} />
            <h1 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>Admin Dashboard</h1>
            <p className="text-muted">Sign in to view live, anonymous usage analytics.</p>
          </div>
          <input
            className="input-field"
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            className="input-field"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <div role="alert" style={{ color: 'var(--error)' }}>{error}</div>}
          <button className="btn btn-primary" type="submit">Sign in</button>
          <Link to="/" className="text-muted" style={{ textAlign: 'center' }}>Return to website</Link>
        </form>
      </main>
    );
  }

  const totals = stats?.totals;

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', background: 'var(--bg-base)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '2rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Button & File Action Analytics</h1>
            <p className="text-muted" style={{ margin: '0.4rem 0 0' }}>
              Live aggregate metrics from the analytics database. No file names or contents are collected.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button className="btn btn-secondary" onClick={() => void loadStats()} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
            </button>
            <Link to="/" className="btn btn-secondary">Public Site</Link>
            <button className="btn btn-secondary" onClick={() => void handleLogout()}>
              <LogOut size={15} /> Logout
            </button>
          </div>
        </header>

        {error && <div role="alert" className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', color: 'var(--error)' }}>{error}</div>}
        {isLoading && !stats && <p className="text-muted">Loading analytics…</p>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Latest Release Clicks', value: totals?.downloads ?? 0, icon: Download },
            { label: 'Total Button Clicks', value: totals?.totalButtonClicks ?? 0, icon: MousePointerClick },
            { label: 'Total Actions Performed', value: totals?.totalActions ?? 0, icon: Activity },
            { label: 'GitHub Repo Visits', value: totals?.githubVisits ?? 0, icon: ExternalLink },
          ].map(({ label, value, icon: Icon }) => (
            <article className="glass-panel" key={label} style={{ padding: '1.25rem' }}>
              <div className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {label}<Icon size={18} style={{ color: 'var(--primary-accent)' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.4rem' }}>{value.toLocaleString()}</div>
            </article>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <article className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', marginTop: 0 }}>Button Clicks</h2>
            {stats?.buttonClicks.length ? stats.buttonClicks.map((item) => {
              const percent = Math.round(item.count / maxButtonCount * 100);
              return (
                <div key={item.operation} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.88rem' }}>
                    <span>{OPERATION_LABELS[item.operation] ?? item.operation}</span>
                    <strong>{item.count.toLocaleString()}</strong>
                  </div>
                  <div style={{ height: 7, marginTop: 5, background: 'rgba(255,255,255,.07)', borderRadius: 8 }}>
                    <div style={{ width: `${percent}%`, height: '100%', borderRadius: 8, background: 'var(--primary-accent)' }} />
                  </div>
                </div>
              );
            }) : <p className="text-muted">No button clicks have been recorded yet.</p>}
          </article>

          <article className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', marginTop: 0 }}>Completed Operations</h2>
            {stats?.toolUsage.length ? stats.toolUsage.map((item) => {
              const percent = Math.round(item.count / maxToolCount * 100);
              return (
                <div key={item.operation} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.88rem' }}>
                    <span>{OPERATION_LABELS[item.operation] ?? item.operation}</span>
                    <strong>{item.count.toLocaleString()}</strong>
                  </div>
                  <div style={{ height: 7, marginTop: 5, background: 'rgba(255,255,255,.07)', borderRadius: 8 }}>
                    <div style={{ width: `${percent}%`, height: '100%', borderRadius: 8, background: '#10b981' }} />
                  </div>
                </div>
              );
            }) : <p className="text-muted">No completed operations have been recorded yet.</p>}
          </article>
        </section>

        <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginTop: 0 }}>Active Windows Versions</h2>
          {stats?.versions.length ? stats.versions.map((version) => (
            <div key={version.version} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
              <span>v{version.version}</span>
              <span>{version.clients.toLocaleString()} clients ({version.percentage}%)</span>
            </div>
          )) : <p className="text-muted">No Windows clients have reported a version yet.</p>}
        </section>

        <section className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>All Analytics Events</h2>
            {stats?.updated_at && <span className="text-muted">Updated {new Date(stats.updated_at).toLocaleString()}</span>}
          </div>
          <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead><tr className="text-muted">
                <th style={{ padding: '0.65rem' }}>Event</th>
                <th style={{ padding: '0.65rem' }}>Category</th>
                <th style={{ padding: '0.65rem' }}>Operation</th>
                <th style={{ padding: '0.65rem' }}>Platform</th>
                <th style={{ padding: '0.65rem' }}>Version</th>
                <th style={{ padding: '0.65rem' }}>Quantity</th>
                <th style={{ padding: '0.65rem' }}>Time</th>
              </tr></thead>
              <tbody>
                {stats?.events.map((event) => (
                  <tr key={event.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.65rem' }}>{event.event}</td>
                    <td style={{ padding: '0.65rem' }}>{event.category}</td>
                    <td style={{ padding: '0.65rem', fontFamily: 'monospace' }}>{OPERATION_LABELS[event.operation] ?? event.operation}</td>
                    <td style={{ padding: '0.65rem' }}>{event.platform}</td>
                    <td style={{ padding: '0.65rem' }}>{event.app_version}</td>
                    <td style={{ padding: '0.65rem' }}>{event.quantity.toLocaleString()}</td>
                    <td style={{ padding: '0.65rem', whiteSpace: 'nowrap' }}>
                      <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!stats?.events.length && <p className="text-muted">No analytics events recorded yet.</p>}
          </div>
          {stats && stats.eventCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <span className="text-muted">
                Showing {(eventPage - 1) * stats.eventPageSize + 1}–
                {Math.min(eventPage * stats.eventPageSize, stats.eventCount)} of {stats.eventCount.toLocaleString()} events
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => void loadStats(eventPage - 1)}
                  disabled={isLoading || eventPage <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => void loadStats(eventPage + 1)}
                  disabled={isLoading || eventPage * stats.eventPageSize >= stats.eventCount}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
