import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DropZone from '../components/dropzone/DropZone';
import { getWebFile, jobsService } from '../services/jobs';
import { Play, X, AlertCircle, Sliders, Trash2, Download, FileText } from 'lucide-react';
import { useToolSelectionStore } from '../stores/toolSelectionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { isTauri } from '../utils/platform';

let hasProcessedStartupArgs = false;

export default function Home() {
  const navigate = useNavigate();
  const defaultOutputDir = useSettingsStore((state) => state.settings?.default_output_dir ?? '');
  const settingsLoaded = useSettingsStore((state) => state.settings !== null);
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
    setSelectedFiles,
  } = useToolSelectionStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);

  useEffect(() => {
    if (!isTauri() || !settingsLoaded) return;
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
            output_config: {
              directory: defaultOutputDir,
              overwrite: false,
              naming: 'same_name_new_extension',
            },
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
  }, [navigate, loadToolsForFiles, defaultOutputDir, settingsLoaded]);

  const handleFilesSelected = (paths: string[]) => {
    loadToolsForFiles(paths);
  };

  const handleRemoveFile = (indexToRemove: number) => {
    const updated = selectedFiles.filter((_, idx) => idx !== indexToRemove);
    if (updated.length === 0) {
      clearSelection();
    } else {
      setSelectedFiles(updated);
      loadToolsForFiles(updated);
    }
  };

  const handleStart = async () => {
    if (!selectedToolId || selectedFiles.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const options: Record<string, unknown> = {};
    if (selectedToolId === 'image.compress') {
      options.jpeg_quality = compressQuality;
    } else if (selectedToolId === 'pdf.split') {
      options.start_page = Number(startPage);
      options.end_page = Number(endPage);
    }

    try {
      await jobsService.submit({
        tool_id: selectedToolId,
        input_files: selectedFiles,
        output_config: {
          directory: defaultOutputDir,
          overwrite: false,
          naming: 'same_name_new_extension',
        },
        options,
      });
      clearSelection();
      navigate('/jobs');
    } catch (err: unknown) {
      console.error('Failed to submit job:', err);
      setSubmitError(err instanceof Error ? err.message : 'Could not start the conversion.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-col gap-4" style={{ maxWidth: '850px', margin: '0 auto' }}>
      {!isTauri() && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌐</span>
            <span>
              <strong>Web Mode:</strong> Image conversions run locally in your browser.
            </span>
          </div>
          <a
            href="https://github.com/anyfile-org/Anyfile-Converter/releases/latest"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
          >
            <Download size={14} /> Download Windows App
          </a>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>File Converter</h1>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Convert, compress, and process your files 100% locally with zero cloud uploads.
          </p>
        </div>
        {!isTauri() && (
          <Link to="/" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            ← Back to Landing Page
          </Link>
        )}
      </div>

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
              <X size={16} /> Clear All
            </button>
          </div>

          {/* File list preview with individual remove */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {selectedFiles.map((file, idx) => {
              const displayName =
                getWebFile(file)?.name ?? file.replace(/\\/g, '/').split('/').pop() ?? file;
              return (
                <div
                  key={`${file}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-light)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <FileText size={16} style={{ color: 'var(--primary-accent)', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(idx)}
                    title="Remove file"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
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
          {submitError && (
            <div
              role="alert"
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(127, 29, 29, 0.3)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '6px',
                color: 'var(--error)',
              }}
            >
              {submitError}
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
                          ? 'rgba(239, 68, 68, 0.12)'
                          : 'var(--bg-surface)',
                      boxShadow: selectedToolId === tool.id ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none',
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

          {/* PDF Split Options — page range inputs */}
          {selectedToolId === 'pdf.split' && (
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
              <label style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} style={{ color: 'var(--primary-accent)' }} />
                Page Range to Extract
              </label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Start Page
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    value={startPage}
                    onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ padding: '0.5rem 0.75rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    End Page
                  </label>
                  <input
                    type="number"
                    min={startPage}
                    className="input-field"
                    value={endPage}
                    onChange={(e) => setEndPage(Math.max(startPage, parseInt(e.target.value) || startPage))}
                    style={{ padding: '0.5rem 0.75rem' }}
                  />
                </div>
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
