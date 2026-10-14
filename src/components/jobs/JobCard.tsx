import { useState } from 'react';
import { Job } from '../../types/job';
import { useJobStore } from '../../stores/jobStore';
import { CheckCircle, XCircle, Clock, PlayCircle, X, FolderOpen, AlertTriangle, Download } from 'lucide-react';
import { isTauri } from '../../utils/platform';
import { downloadWebResult, getWebResultName } from '../../services/jobs';

const TOOL_NAMES: Record<string, string> = {
  'image.jpg_to_png': 'Convert JPG to PNG',
  'image.png_to_jpg': 'Convert PNG to JPG',
  'image.to_webp': 'Convert Image to WebP',
  'image.to_avif': 'Convert Image to AVIF',
  'image.compress': 'Compress Image',
  'pdf.merge': 'Merge PDFs',
  'pdf.split': 'Split PDF',
  'archive.create_zip': 'Create ZIP',
  'archive.extract_zip': 'Extract ZIP',
  'video.extract_audio': 'Extract Audio',
};

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job }: JobCardProps) {
  const cancelJob = useJobStore((state) => state.cancelJob);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    await cancelJob(job.id);
    setIsCancelling(false);
  };

  const handleOpenFolderOrDownload = async () => {
    if (job.result && job.result.output_files.length > 0) {
      if (isTauri()) {
        setIsOpeningFolder(true);
        try {
          const { openPath } = await import('@tauri-apps/plugin-opener');
          const filePath = job.result.output_files[0];
          const separatorIndex = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
          const parentDir = separatorIndex > 0 ? filePath.substring(0, separatorIndex) : filePath;
          await openPath(parentDir);
        } catch (err) {
          console.error('Failed to open output folder:', err);
          const message = err instanceof Error ? err.message : String(err);
          window.alert(`Could not open the output folder. ${message}`);
        } finally {
          setIsOpeningFolder(false);
        }
      }
    }
  };

  const getStatusIcon = () => {
    switch (job.state) {
      case 'completed':
        return <CheckCircle className="text-success" size={24} />;
      case 'failed':
        return <XCircle className="text-error" size={24} />;
      case 'cancelled':
        return <XCircle className="text-warning" size={24} />;
      case 'running':
        return (
          <PlayCircle
            className="text-primary animate-pulse"
            size={24}
            style={{ color: 'var(--primary-accent)' }}
          />
        );
      case 'queued':
        return <Clock className="text-muted" size={24} />;
      default:
        return null;
    }
  };

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(job.state);
  const percent = job.progress?.overall_percent ?? (job.state === 'completed' ? 100 : 0);
  const currentFile = job.progress?.current_file || 'Processing…';
  const filesDone = job.progress?.files_done ?? 0;
  const filesTotal = job.progress?.files_total ?? job.input_files.length;

  return (
    <div className="glass-panel p-5 mb-4" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <div
        className="flex justify-between items-center mb-3"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <div
          className="flex items-center gap-3"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          {getStatusIcon()}
          <div>
            <h4 style={{ fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>
              {TOOL_NAMES[job.tool_id] || job.tool_id}
            </h4>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              {job.input_files.length} file{job.input_files.length !== 1 ? 's' : ''}
              {job.started_at && ` • Started at ${new Date(job.started_at).toLocaleTimeString()}`}
            </div>
          </div>
        </div>

        <div>
          {!isTerminal && (
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={isCancelling}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              <X size={14} /> {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}

          {job.state === 'completed' && isTauri() && (
            <button
              className="btn btn-secondary"
              onClick={handleOpenFolderOrDownload}
              disabled={isOpeningFolder}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', gap: '0.4rem' }}
            >
              <FolderOpen size={14} />
              {isOpeningFolder ? 'Opening…' : 'Open Folder'}
            </button>
          )}
        </div>
      </div>

      {job.state === 'running' && (
        <div className="mt-4" style={{ marginTop: '1rem' }}>
          <div
            className="flex justify-between text-muted mb-1"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              marginBottom: '0.25rem',
            }}
          >
            <span>{currentFile}</span>
            <span>{percent}%</span>
          </div>
          <div
            style={{
              height: '6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent}%`,
                background: 'linear-gradient(90deg, var(--primary-accent), var(--secondary-accent))',
                transition: 'width 0.3s ease-in-out',
              }}
            />
          </div>
          <div
            className="text-muted mt-1 text-right"
            style={{ fontSize: '0.8rem', marginTop: '0.25rem', textAlign: 'right' }}
          >
            {filesDone} of {filesTotal} files completed
          </div>
        </div>
      )}

      {!isTauri() && job.state === 'completed' && job.result && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          {job.result.output_files.map((resultId) => (
            <button
              key={resultId}
              className="btn btn-secondary"
              onClick={() => {
                try {
                  downloadWebResult(resultId);
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  window.alert(`Could not download this result. ${message}`);
                }
              }}
              style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem' }}
            >
              <Download size={14} /> {getWebResultName(resultId)}
            </button>
          ))}
        </div>
      )}

      {job.error && (
        <div
          className="mt-3 p-3 bg-red-900/30 border border-red-500/50 rounded flex items-start gap-2 text-error"
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(127, 29, 29, 0.3)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span style={{ fontSize: '0.9rem' }}>{job.error.message}</span>
        </div>
      )}

      {job.result?.per_file_errors.length ? (
        <div
          role="alert"
          className="mt-3 p-3"
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            color: 'var(--warning)',
            backgroundColor: 'rgba(180, 83, 9, 0.12)',
            border: '1px solid rgba(180, 83, 9, 0.35)',
            borderRadius: '6px',
            fontSize: '0.88rem',
          }}
        >
          {job.result.per_file_errors.length} file
          {job.result.per_file_errors.length === 1 ? '' : 's'} could not be converted:
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {job.result.per_file_errors.map((error, index) => (
              <li key={`${error.input_file}-${index}`}>
                {error.input_file}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
