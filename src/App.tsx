import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useJobStore } from "./stores/jobStore";
import { useSettingsStore } from "./stores/settingsStore";
import Layout from "./components/layout/Layout";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Settings from "./pages/Settings";
import About from "./pages/About";

function App() {
  const setupEventBridge = useJobStore((state) => state.setupEventBridge);
  const fetchInitialJobs = useJobStore((state) => state.fetchInitialJobs);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    // Initialize stores
    loadSettings();
    fetchInitialJobs();
    
    // Setup Tauri event listener for live progress
    setupEventBridge().then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}

export default App;
