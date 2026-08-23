import { create } from 'zustand';
import { AppSettings } from '../types/settings';
import { invoke } from '@tauri-apps/api/core';

interface SettingsStore {
  settings: AppSettings | null;
  isLoading: boolean;
  
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  isLoading: true,

  loadSettings: async () => {
    try {
      const settings = await invoke<AppSettings>('get_settings');
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings: AppSettings) => {
    try {
      await invoke('save_settings', { settings: newSettings });
      set({ settings: newSettings });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }
}));
