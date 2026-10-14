/**
 * Platform detection utility.
 * Distinguishes between native Tauri desktop environment and standard web browser (e.g. Vercel).
 */

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && Boolean(
    // Tauri v2 exposes __TAURI_INTERNALS__ on window
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    (window as any).__TAURI_METADATA__
  );
};

export const isWeb = (): boolean => !isTauri();
