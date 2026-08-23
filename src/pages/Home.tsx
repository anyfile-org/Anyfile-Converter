import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DropZone from '../components/dropzone/DropZone';
import { jobsService } from '../services/jobs';
import { Play, X, AlertCircle, Sliders } from 'lucide-react';
import { useToolSelectionStore } from '../stores/toolSelectionStore';

let hasProcessedStartupArgs = false;

export default function Home() {
  const navigate = useNavigate();
  const {
    selectedFiles,
    applicableTools,
    selectedToolId,
    compressQuality,
    error,
    setSelectedToolId,
    setCompressQuality,
    clearSelection,
    loadToolsForFiles,
  } = useToolSelectionStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkStartupArgs = async () => {
      if (hasProcessedStartupArgs) return;
      hasProcessedStartupArgs = true;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const args = await invoke<{ file: string | null; tool: string | null }>('get_startup_args');
        if (args.file && args.tool) {
          await jobsService.submit({
            tool_id: args.tool,
            input_files: [args.file],
            output_config: { directory: '', overwrite: false, naming: 'same_name_new_extension' },
            options: {},
          });
          navigate('/jobs');
        } else if (args.file) {
          loadToolsForFiles([args.file]);
        }
      } catch (err) {
        console.error('Failed to check startup args:', err);
      }
    };
    checkStartupArgs();
  }, [navigate, loadToolsForFiles]);

  const handleFilesSelected = (paths: string[]) => {
    loadToolsForFiles(paths);
  };

  const handleStart = async () => {
    if (!selectedToolId || selectedFiles.length === 0) return;
    setIsSubmitting(true);

    const options: Record<string, unknown> = {};
    if (selectedToolId === 'image.compress') {
      options.jpeg_quality = compressQuality;
    }

    try {
      await jobsService.submit({
        tool_id: selectedToolId,
        input_files: selectedFiles,
        output_config: {
          directory: '',
          overwrite: false,
          naming: 'same_name_new_extension',
        },
        options,
      });
      clearSelection();
      navigate('/jobs');
    } catch (err: any) {
      console.error('Failed to submit job:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-col gap-4" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="page-title">AnyFile Convert</h1>

      {selectedFiles.length === 0 ? (
        <DropZone onFilesSelected={handleFilesSelected} />
      ) : (
        <div
          className="glass-panel animate-fade-in"
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border-light)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
            </h3>
            <button
              className="btn btn-secondary"
              onClick={clearSelection}
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <X size={16} /> Clear
            </button>
          </div>

          {/* File list preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {selectedFiles.slice(0, 5).map((f) => (
              <div
                key={f}
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '4px',
                }}
              >
                📄 {f.replace(/\\/g, '/').split('/').pop()}
              </div>
            ))}
            {selectedFiles.length > 5 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.25rem 0.6rem' }}>
                + {selectedFiles.length - 5} more files…
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(127, 29, 29, 0.3)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--error)',
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Tool selection */}
          {!error && applicableTools.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Choose Operation:</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                {applicableTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="glass-panel"
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      borderColor:
                        selectedToolId === tool.id
                          ? 'var(--primary-accent)'
                          : 'var(--border-light)',
                      background:
                        selectedToolId === tool.id
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'var(--bg-surface)',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setSelectedToolId(tool.id)}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{tool.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {tool.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compression quality slider — only shown for compress tool */}
          {selectedToolId === 'image.compress' && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <label style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={16} style={{ color: 'var(--primary-accent)' }} />
                  JPEG Quality
                </label>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    color: 'var(--primary-accent)',
                    minWidth: '3rem',
                    textAlign: 'right',
                  }}
                >
                  {compressQuality}%
                </span>
              </div>

              <input
                type="range"
                min={10}
                max={95}
                step={5}
                value={compressQuality}
                onChange={(e) => setCompressQuality(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--primary-accent)',
                  cursor: 'pointer',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Smallest file (10%)</span>
                <span>
                  {compressQuality < 40
                    ? '⚠️ Heavy compression'
                    : compressQuality < 70
                    ? '✅ Balanced'
                    : '📷 High quality'}
                </span>
                <span>Best quality (95%)</span>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginTop: '0.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-light)',
            }}
          >
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!selectedToolId || isSubmitting}
              style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem' }}
            >
              <Play size={18} />
              {isSubmitting ? 'Starting…' : 'Start'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
