import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useJobStore } from "./stores/jobStore";
import { useSettingsStore } from "./stores/settingsStore";
import Layout from "./components/layout/Layout";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Settings from "./pages/Settings";
import About from "./pages/About";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";
import { isTauri } from "./utils/platform";

function App() {
  const setupEventBridge = useJobStore((state) => state.setupEventBridge);
  const fetchInitialJobs = useJobStore((state) => state.fetchInitialJobs);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Initialize stores
    loadSettings();
    fetchInitialJobs();

    // Setup event listener for live progress
    setupEventBridge().then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [loadSettings, fetchInitialJobs, setupEventBridge]);

  const inTauri = isTauri();

  return (
    <Routes>
      {/* If in Tauri desktop app, root goes directly to desktop converter */}
      {inTauri ? (
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="settings" element={<Settings />} />
          <Route path="about" element={<About />} />
        </Route>
      ) : (
        /* If on web (Vercel), root is the Public Landing Page */
        <>
          <Route path="/" element={<Landing />} />
          <Route path="/admin" element={<Admin />} />

          {/* Web App mode under /app */}
          <Route path="/app" element={<Layout />}>
            <Route index element={<Home />} />
          </Route>

          <Route path="/" element={<Layout />}>
            <Route path="jobs" element={<Jobs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="about" element={<About />} />
          </Route>
        </>
      )}

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
