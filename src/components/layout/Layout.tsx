import { Outlet, NavLink } from "react-router-dom";
import { Layers, Activity, Settings, Info } from "lucide-react";

export default function Layout() {
  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <Layers size={24} />
          <span>AnyFile</span>
        </div>
        
        <div className="nav-menu">
          <NavLink 
            to="/" 
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
        </div>

        <div className="mt-auto pt-4 border-t border-light" style={{ borderTop: '1px solid var(--border-light)', marginTop: 'auto', paddingTop: '1rem' }}>
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
