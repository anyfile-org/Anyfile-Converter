import { Outlet, NavLink, Link } from "react-router-dom";
import { Layers, Activity, Settings, Info, Globe, Download } from "lucide-react";
import { isTauri } from "../../utils/platform";

export default function Layout() {
  const inTauri = isTauri();
  const toolsPath = inTauri ? "/" : "/app";

  return (
    <div className="app-container">
      <nav className="sidebar">
        <Link
          to={inTauri ? "/" : "/"}
          className="sidebar-logo"
          style={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          <Layers size={24} />
          <span>AnyFile</span>
        </Link>
        
        <div className="nav-menu">
          <NavLink 
            to={toolsPath}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end
          >
            <Layers size={20} />
            <span>Tools</span>
          </NavLink>
          
          <NavLink 
            to="/jobs" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Activity size={20} />
            <span>Active Jobs</span>
          </NavLink>
          
          <NavLink 
            to="/settings" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>

          {!inTauri && (
            <Link
              to="/"
              className="nav-link"
              style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}
            >
              <Globe size={20} />
              <span>Public Site</span>
            </Link>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-light" style={{ borderTop: '1px solid var(--border-light)', marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!inTauri && (
            <a
              href="https://github.com/anyfile-org/Anyfile-Converter/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', gap: '0.35rem' }}
            >
              <Download size={14} /> Download App
            </a>
          )}

          <NavLink 
            to="/about" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Info size={20} />
            <span>About</span>
          </NavLink>
        </div>
      </nav>
      
      <main className="main-content">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
