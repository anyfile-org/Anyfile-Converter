import { create } from 'zustand';
import { ToolMetadata } from '../types/tool';
import { toolsService } from '../services/tools';

interface ToolSelectionStore {
  selectedFiles: string[];
  applicableTools: ToolMetadata[];
  selectedToolId: string | null;
  compressQuality: number; // 1-100 for JPEG quality
  error: string | null;

  setSelectedFiles: (paths: string[]) => void;
  setSelectedToolId: (id: string | null) => void;
  setCompressQuality: (q: number) => void;
  clearSelection: () => void;
  loadToolsForFiles: (paths: string[]) => Promise<void>;
}

const getExtension = (path: string) => {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

export const useToolSelectionStore = create<ToolSelectionStore>((set) => ({
  selectedFiles: [],
  applicableTools: [],
  selectedToolId: null,
  compressQuality: 75,
  error: null,

  setSelectedFiles: (paths) => set({ selectedFiles: paths }),
  setSelectedToolId: (id) => set({ selectedToolId: id }),
  setCompressQuality: (q) => set({ compressQuality: q }),
  clearSelection: () =>
    set({
      selectedFiles: [],
      applicableTools: [],
      selectedToolId: null,
      error: null,
    }),

  loadToolsForFiles: async (paths) => {
    if (paths.length === 0) {
      set({ selectedFiles: [], applicableTools: [], selectedToolId: null, error: null });
      return;
    }
    set({ selectedFiles: paths, error: null });
    const ext = getExtension(paths[0]);
    try {
      const tools = await toolsService.forExtension(ext);
      set({
        applicableTools: tools,
        selectedToolId: tools.length > 0 ? tools[0].id : null,
        error: tools.length === 0 ? `No tools available for .${ext} files.` : null,
      });
    } catch {
      set({ error: 'Failed to query available tools.', applicableTools: [], selectedToolId: null });
    }
  },
}));
