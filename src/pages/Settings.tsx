import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Settings2, Save, FolderOpen, Download, Check } from 'lucide-react';
import { AppSettings } from '../types/settings';
import { isTauri } from '../utils/platform';

export default function Settings() {
  const { settings, updateSettings, isLoading } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const desktopApp = isTauri();

  useEffect(() => {
    if (settings) {
      if (desktopApp) {
        setLocalSettings(settings);
      } else {
        try {
          setLocalSettings({
            ...settings,
            analytics_enabled: localStorage.getItem('anyfile_analytics_consent') === 'yes',
          });
        } catch (error) {
          console.warn('Could not load website analytics preference:', error);
          setLocalSettings(settings);
        }
      }
    }
  }, [settings, desktopApp]);

  if (isLoading || !localSettings) {
    return <div className="p-8 text-center text-muted">Loading settings...</div>;
  }

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateSettings(localSettings);
      if (!desktopApp) {
        localStorage.setItem(
          'anyfile_analytics_consent',
          localSettings.analytics_enabled ? 'yes' : 'no'
        );
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectOutput = async () => {
    setActionError(null);
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
      console.error('Failed to select directory:', err);
      setActionError(err instanceof Error ? err.message : 'Could not select the output directory.');
    }
  };

  const handleSelectFfmpeg = async () => {
    setActionError(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'Executables', extensions: ['exe'] }],
      });
      if (selected && typeof selected === 'string') {
        setLocalSettings({ ...localSettings, ffmpeg_path: selected });
      }
    } catch (err) {
      console.error('Failed to select ffmpeg:', err);
      setActionError(err instanceof Error ? err.message : 'Could not select FFmpeg.');
    }
  };

  const handleCheckUpdate = async () => {
    if (!isTauri()) {
      setUpdateStatus('You are running the web version. Check GitHub releases for desktop updates.');
      return;
    }
    setIsCheckingUpdate(true);
    setUpdateStatus('Checking for updates...');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateStatus(`Downloading version ${update.version}...`);
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              setUpdateStatus(`Downloading update (${event.data.contentLength} bytes)...`);
              break;
            case 'Progress':
              setUpdateStatus('Downloading...');
              break;
            case 'Finished':
              setUpdateStatus('Installing...');
              break;
          }
        });
        setUpdateStatus('Update installed. Restarting...');
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } else {
        setUpdateStatus('You are on the latest version.');
      }
    } catch (err: any) {
      console.error(err);
      setUpdateStatus(`Error checking for updates: ${err.message || err}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div
        className="flex items-center gap-3 mb-6"
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}
      >
        <Settings2 size={28} style={{ color: 'var(--primary-accent)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>
          Settings
        </h1>
      </div>

      <div
        className="glass-panel p-6 flex-col gap-6"
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      >
        {/* Output Directory */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
            Default Output Directory
          </label>
          <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {desktopApp
              ? 'Where should converted files be saved? Leave empty to save next to the original file.'
              : 'Browser downloads use your browser’s configured download folder. Choose a folder in the desktop app.'}
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input-field"
              disabled={!desktopApp}
              value={localSettings.default_output_dir || ''}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, default_output_dir: e.target.value || null })
              }
              placeholder="Save next to original file"
            />
            <button
              className="btn btn-secondary"
              onClick={handleSelectOutput}
              disabled={!desktopApp}
              aria-label="Choose default output directory"
              style={{ padding: '0.75rem' }}
            >
              <FolderOpen size={18} />
            </button>
          </div>
        </div>

        {/* FFmpeg Path */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
            Custom FFmpeg Path
          </label>
          <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {desktopApp
              ? 'Required for video operations. AnyFile Convert will try to find it automatically.'
              : 'Custom FFmpeg configuration is available in the desktop app.'}
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input-field"
              disabled={!desktopApp}
              value={localSettings.ffmpeg_path || ''}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, ffmpeg_path: e.target.value || null })
              }
              placeholder="Auto-detect (e.g. C:\ffmpeg\bin\ffmpeg.exe)"
            />
            <button
              className="btn btn-secondary"
              onClick={handleSelectFfmpeg}
              disabled={!desktopApp}
              aria-label="Choose FFmpeg executable"
              style={{ padding: '0.75rem' }}
            >
              <FolderOpen size={18} />
            </button>
          </div>
        </div>

        {/* Analytics */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <input
            id="analytics-enabled"
            type="checkbox"
            checked={localSettings.analytics_enabled}
            onChange={(event) =>
              setLocalSettings({ ...localSettings, analytics_enabled: event.target.checked })
            }
            style={{ width: '18px', height: '18px', marginTop: '0.25rem', flexShrink: 0 }}
          />
          <div>
            <label htmlFor="analytics-enabled" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
              Share anonymous usage analytics (optional)
            </label>
            <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {desktopApp
                ? 'If enabled, completed tool names, app version, and timestamps are sent to help prioritize improvements.'
                : 'If enabled, anonymous website button clicks and successful browser conversions are shared to help prioritize improvements.'}{' '}
              File names, paths, and contents are never included. Disabled by default.
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div
          className="mt-4 pt-4 border-t border-light flex justify-between items-center"
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {saveError ? (
            <div role="alert" style={{ color: 'var(--error)', fontSize: '0.9rem' }}>
              Could not save settings: {saveError}
            </div>
          ) : saveSuccess ? (
            <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Check size={16} /> Settings saved successfully!
            </div>
          ) : (
            <div />
          )}

          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
        {actionError && (
          <div role="alert" style={{ color: 'var(--error)', fontSize: '0.9rem' }}>
            {actionError}
          </div>
        )}

        {/* Application Updates */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
            Application Updates
          </label>
          <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Check for the latest version of AnyFile Convert.
          </div>
          <div
            className="flex gap-4 items-center"
            style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}
          >
            <button
              className="btn btn-secondary"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
            >
              <Download size={18} />
              {isCheckingUpdate ? 'Checking…' : 'Check for Updates'}
            </button>
            {updateStatus && (
              <span style={{ fontSize: '0.85rem', color: 'var(--primary-accent)' }}>
                {updateStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
