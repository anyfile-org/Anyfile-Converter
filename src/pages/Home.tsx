import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DropZone from '../components/dropzone/DropZone';
import { toolsService } from '../services/tools';
import { jobsService } from '../services/jobs';
import { ToolMetadata } from '../types/tool';
import { Play, Settings2, X, AlertCircle } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [applicableTools, setApplicableTools] = useState<ToolMetadata[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if app was launched via Windows Explorer Context Menu
    const checkStartupFile = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const file = await invoke<string | null>('get_startup_file');
        if (file) {
          handleFilesSelected([file]);
        }
      } catch (err) {
        console.error("Failed to check startup file:", err);
      }
    };
    checkStartupFile();
  }, []);

  // Helper to get extension from path
  const getExtension = (path: string) => {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  };

  const handleFilesSelected = async (paths: string[]) => {
    if (paths.length === 0) return;
    
    setSelectedFiles(paths);
    setError(null);
    
    // In V0.1, we assume batch files are of the same type for tool resolution
    const ext = getExtension(paths[0]);
    
    try {
      const tools = await toolsService.forExtension(ext);
      setApplicableTools(tools);
      if (tools.length > 0) {
        setSelectedToolId(tools[0].id);
      } else {
        setSelectedToolId(null);
        setError(`No tools available for .${ext} files.`);
      }
    } catch (err) {
      console.error("Failed to fetch tools for extension:", err);
      setError("Failed to query available tools.");
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setApplicableTools([]);
    setSelectedToolId(null);
    setError(null);
  };

  const handleStart = async () => {
    if (!selectedToolId || selectedFiles.length === 0) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await jobsService.submit({
        tool_id: selectedToolId,
        input_files: selectedFiles,
        output_config: {
          directory: "", // Rust handles default if empty
          overwrite: false,
          naming: "same_name_new_extension"
        },
        options: {}
      });
      
      // Navigate to jobs view
      navigate('/jobs');
    } catch (err: any) {
      console.error("Failed to submit job:", err);
      setError(typeof err === 'string' ? err : err.message || "Failed to start operation.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-col gap-4" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="page-title">AnyFile Convert</h1>
      
      {selectedFiles.length === 0 ? (
        <DropZone onFilesSelected={handleFilesSelected} />
      ) : (
        <div className="glass-panel p-6 flex-col gap-4 animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="flex justify-between items-center border-b border-light pb-4" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
            </h3>
            <button className="btn btn-secondary" onClick={clearSelection} style={{ padding: '0.4rem 0.8rem' }}>
              <X size={16} /> Clear
            </button>
          </div>
          
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded flex items-center gap-2 text-error" style={{ padding: '0.75rem', backgroundColor: 'rgba(127, 29, 29, 0.3)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          
          {!error && applicableTools.length > 0 && (
            <div className="flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Choose Operation:</label>
              <div className="tools-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {applicableTools.map(tool => (
                  <div 
                    key={tool.id}
                    className={`glass-panel p-4 cursor-pointer transition-all ${selectedToolId === tool.id ? 'border-primary' : ''}`}
                    style={{ 
                      padding: '1rem', 
                      borderColor: selectedToolId === tool.id ? 'var(--primary-accent)' : 'var(--border-light)',
                      background: selectedToolId === tool.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface)'
                    }}
                    onClick={() => setSelectedToolId(tool.id)}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{tool.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>{tool.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-light" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
              <Settings2 size={16} /> Options
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleStart} 
              disabled={!selectedToolId || isSubmitting}
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
            >
              <Play size={18} />
              {isSubmitting ? 'Starting...' : 'Start'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
