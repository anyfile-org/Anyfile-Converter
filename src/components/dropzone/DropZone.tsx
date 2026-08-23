import { useState, useEffect, DragEvent } from 'react';
import { UploadCloud, Plus } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: string[]) => void;
}

export default function DropZone({ onFilesSelected }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  // In Tauri 2.x, native drag-and-drop of files triggers specific events.
  // We can also use an input type="file" as a fallback, but the browser
  // security model usually prevents us from getting absolute paths from 
  // standard HTML file inputs. Tauri provides a native file drop event.
  
  // Note: V0.1 we can use tauri dialog to pick files if drag and drop is complex
  // but let's implement standard HTML drag and drop UI with a click-to-pick fallback.

  useEffect(() => {
    let unlistenDrop: (() => void) | undefined;
    let unlistenHover: (() => void) | undefined;
    let unlistenCancel: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        
        // In Tauri V2, file drop events are natively emitted
        unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
          setIsDragging(false);
          if (event.payload.paths && event.payload.paths.length > 0) {
            onFilesSelected(event.payload.paths);
          }
        });

        unlistenHover = await listen('tauri://drag-enter', () => {
          setIsDragging(true);
        });

        unlistenCancel = await listen('tauri://drag-leave', () => {
          setIsDragging(false);
        });
      } catch (err) {
        console.error("Failed to setup drag and drop listeners:", err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenDrop) unlistenDrop();
      if (unlistenHover) unlistenHover();
      if (unlistenCancel) unlistenCancel();
    };
  }, [onFilesSelected]);

  // Keep HTML5 handlers to prevent default browser behavior
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const openFilePicker = async () => {
    try {
      // Use Tauri's dialog API (requires @tauri-apps/plugin-dialog)
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        // Optional: filters
      });
      
      if (selected) {
        if (Array.isArray(selected)) {
          onFilesSelected(selected);
        } else {
          onFilesSelected([selected]);
        }
      }
    } catch (err) {
      console.error("Failed to open file picker:", err);
      // Fallback or show error
    }
  };

  return (
    <div 
      className={`glass-panel p-8 text-center flex-col items-center justify-center cursor-pointer transition-all ${isDragging ? 'scale-105 border-primary' : ''}`}
      style={{
        minHeight: '300px',
        borderStyle: isDragging ? 'solid' : 'dashed',
        borderColor: isDragging ? 'var(--primary-accent)' : 'var(--border-light)',
        borderWidth: '2px',
        display: 'flex'
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
          background: 'rgba(59, 130, 246, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          color: 'var(--primary-accent)'
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
      
      <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); openFilePicker(); }}>
        <Plus size={18} />
        Choose Files
      </button>
      
      <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '2rem' }}>
        Your files never leave your device. 100% private.
      </p>
    </div>
  );
}
