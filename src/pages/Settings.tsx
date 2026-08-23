import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Settings2, Save, FolderOpen } from 'lucide-react';
import { AppSettings } from '../types/settings';

export default function Settings() {
  const { settings, updateSettings, isLoading } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  if (isLoading || !localSettings) {
    return <div className="p-8 text-center text-muted">Loading settings...</div>;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectOutput = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setLocalSettings({ ...localSettings, default_output_dir: selected });
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  };

  const handleSelectFfmpeg = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'Executables', extensions: ['exe'] }]
      });
      if (selected && typeof selected === 'string') {
        setLocalSettings({ ...localSettings, ffmpeg_path: selected });
      }
    } catch (err) {
      console.error("Failed to select ffmpeg:", err);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex items-center gap-3 mb-6" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Settings2 size={28} style={{ color: 'var(--primary-accent)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>Settings</h1>
      </div>

      <div className="glass-panel p-6 flex-col gap-6" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Output Directory */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Default Output Directory</label>
          <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Where should converted files be saved? (Leave empty to save next to the original file)
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              value={localSettings.default_output_dir || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, default_output_dir: e.target.value || null })}
              placeholder="Save next to original file"
            />
            <button className="btn btn-secondary" onClick={handleSelectOutput} style={{ padding: '0.75rem' }}>
              <FolderOpen size={18} />
            </button>
          </div>
        </div>

        {/* FFmpeg Path */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Custom FFmpeg Path</label>
          <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Required for video operations. AnyFile Convert will try to find it automatically.
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              value={localSettings.ffmpeg_path || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, ffmpeg_path: e.target.value || null })}
              placeholder="Auto-detect (e.g. C:\ffmpeg\bin\ffmpeg.exe)"
            />
            <button className="btn btn-secondary" onClick={handleSelectFfmpeg} style={{ padding: '0.75rem' }}>
              <FolderOpen size={18} />
            </button>
          </div>
        </div>

        {/* Analytics Toggle (V0.2) */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Anonymous Analytics</label>
          <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Help us improve by sending anonymous usage data. No file names or paths are ever sent.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={localSettings.analytics_enabled}
              onChange={(e) => setLocalSettings({ ...localSettings, analytics_enabled: e.target.checked })}
              style={{ width: '1.2rem', height: '1.2rem' }}
            />
            <span>Enable anonymous analytics</span>
          </label>
        </div>

        <div className="mt-4 pt-4 border-t border-light flex justify-end" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
}
