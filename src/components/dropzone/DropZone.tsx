import { useState, DragEvent } from 'react';
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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    // In a real Tauri app, file drop paths come via Tauri events `tauri://file-drop`
    // HTML5 drop events only give us File objects (which don't have absolute paths).
    // However, Tauri automatically maps file drops to the webview if configured,
    // or we listen to 'tauri://file-drop'. For this component, we rely on the parent
    // or a global listener to handle native drops, OR we use a file picker.
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
