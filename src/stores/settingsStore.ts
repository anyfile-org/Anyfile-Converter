import { create } from 'zustand';
import { AppSettings } from '../types/settings';
import { isTauri } from '../utils/platform';

interface SettingsStore {
  settings: AppSettings | null;
  isLoading: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  default_output_dir: null,
  ffmpeg_path: null,
  analytics_enabled: false,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  isLoading: true,

  loadSettings: async () => {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const settings = await invoke<AppSettings>('get_settings');
        set({ settings, isLoading: false });
        return;
      } catch (error) {
        console.error('Failed to load desktop settings, falling back to local defaults:', error);
      }
    }

    // Web fallback
    try {
      const stored = localStorage.getItem('anyfile_settings');
      const settings: AppSettings = stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
      set({ settings, isLoading: false });
    } catch {
      set({ settings: DEFAULT_SETTINGS, isLoading: false });
    }
  },

  updateSettings: async (newSettings: AppSettings) => {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_settings', { settings: newSettings });
        set({ settings: newSettings });
        return;
      } catch (error) {
        console.error('Failed to save desktop settings:', error);
        throw error;
      }
    }

    // Web fallback
    try {
      localStorage.setItem('anyfile_settings', JSON.stringify(newSettings));
      set({ settings: newSettings });
    } catch (error) {
      console.error('Failed to save web settings:', error);
      throw error;
    }
  },
}));
