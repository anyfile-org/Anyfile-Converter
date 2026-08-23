import { useState, useEffect, useRef, DragEvent } from 'react';
import { UploadCloud, Plus } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: string[]) => void;
}

export default function DropZone({ onFilesSelected }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Store the callback in a ref so the effect never needs to re-run
  // when the parent re-renders with a new function reference.
  const callbackRef = useRef(onFilesSelected);
  useEffect(() => {
    callbackRef.current = onFilesSelected;
  });

  // Register Tauri native drag-drop listeners exactly once.
  useEffect(() => {
    let unlistenDrop: (() => void) | undefined;
    let unlistenHover: (() => void) | undefined;
    let unlistenCancel: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
          setIsDragging(false);
          if (event.payload.paths && event.payload.paths.length > 0) {
            callbackRef.current(event.payload.paths);
          }
        });

        unlistenHover = await listen('tauri://drag-enter', () => {
          setIsDragging(true);
        });

        unlistenCancel = await listen('tauri://drag-leave', () => {
          setIsDragging(false);
        });
      } catch (err) {
        console.error('Failed to setup drag and drop listeners:', err);
      }
    };

    setupListeners();

    // Cleanup on unmount only
    return () => {
      if (unlistenDrop) unlistenDrop();
      if (unlistenHover) unlistenHover();
      if (unlistenCancel) unlistenCancel();
    };
  }, []); // ← empty dep array: register once, use ref for fresh callback

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  const openFilePicker = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ multiple: true });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        callbackRef.current(paths);
      }
    } catch (err) {
      console.error('Failed to open file picker:', err);
    }
  };

  return (
    <div
      style={{
        minHeight: '300px',
        borderStyle: isDragging ? 'solid' : 'dashed',
        borderColor: isDragging ? 'var(--primary-accent)' : 'var(--border-light)',
        borderWidth: '2px',
        borderRadius: 'var(--radius-md)',
        background: isDragging ? 'rgba(239,68,68,0.06)' : 'var(--bg-surface)',
        backdropFilter: 'var(--glass-blur)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFilePicker}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          color: 'var(--primary-accent)',
          transition: 'background 0.2s ease',
        }}
      >
        <UploadCloud size={40} />
      </div>
      <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Drop files here
      </h3>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        or click to browse your computer
      </p>

      <button
        className="btn btn-primary"
        onClick={(e) => {
          e.stopPropagation();
          openFilePicker();
        }}
      >
        <Plus size={18} />
        Choose Files
      </button>

      <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '2rem' }}>
        Your files never leave your device. 100% private.
      </p>
    </div>
  );
}
