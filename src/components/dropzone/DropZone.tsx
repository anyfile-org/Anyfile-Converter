import { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, Plus } from 'lucide-react';
import { isTauri } from '../../utils/platform';
import { registerWebFile } from '../../services/jobs';

interface DropZoneProps {
  onFilesSelected: (files: string[]) => void;
}

export default function DropZone({ onFilesSelected }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const callbackRef = useRef(onFilesSelected);
  useEffect(() => {
    callbackRef.current = onFilesSelected;
  });

  // Register Tauri native drag-drop listeners if inside desktop
  useEffect(() => {
    if (!isTauri()) return;

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
        console.warn('Tauri drag and drop listener setup skipped:', err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenDrop) unlistenDrop();
      if (unlistenHover) unlistenHover();
      if (unlistenCancel) unlistenCancel();
    };
  }, []);

  // Standard HTML5 drag-and-drop handlers for web mode and browser fallback
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const names: string[] = [];
      files.forEach((file) => {
        names.push(registerWebFile(file));
      });
      callbackRef.current(names);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const names: string[] = [];
      files.forEach((file) => {
        names.push(registerWebFile(file));
      });
      callbackRef.current(names);
      // Reset input value so same files can be re-selected if desired
      e.target.value = '';
    }
  };

  const openFilePicker = async () => {
    setDialogError(null);
    if (isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({ multiple: true });
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          callbackRef.current(paths);
        }
      } catch (err) {
        console.error('Tauri open dialog failed:', err);
        setDialogError(err instanceof Error ? err.message : 'Could not open the file picker.');
      }
      return;
    }

    fileInputRef.current?.click();
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
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        style={{ display: 'none' }}
      />

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
      {dialogError && (
        <p role="alert" style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '1rem' }}>
          Could not open the file picker: {dialogError}
        </p>
      )}
    </div>
  );
}
