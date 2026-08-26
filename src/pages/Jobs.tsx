import { useJobStore } from '../stores/jobStore';
import JobCard from '../components/jobs/JobCard';
import { Activity, Trash2 } from 'lucide-react';
import { JobState } from '../types/job';

const TERMINAL_STATES: ReadonlyArray<JobState> = ['completed', 'failed', 'cancelled'];

export default function Jobs() {
  const { jobs, jobOrder, isLoading, clearCompletedJobs } = useJobStore();

  const hasCompleted = jobOrder.some(
    (id) => TERMINAL_STATES.includes(jobs[id]?.state)
  );

  if (isLoading) {
    return <div className="p-8 text-center text-muted">Loading jobs...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={28} style={{ color: 'var(--primary-accent)' }} />
          <h1 className="page-title" style={{ margin: 0 }}>Active Jobs</h1>
        </div>

        {hasCompleted && (
          <button
            className="btn btn-secondary"
            onClick={clearCompletedJobs}
            title="Remove all completed, failed, and cancelled jobs"
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', gap: '0.4rem' }}
          >
            <Trash2 size={14} /> Clear completed
          </button>
        )}
      </div>

      {jobOrder.length === 0 ? (
        <div className="glass-panel p-8 text-center text-muted" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No jobs have been run yet.</p>
        </div>
      ) : (
        <div className="flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          {jobOrder.map(id => (
            <JobCard key={id} job={jobs[id]} />
          ))}
        </div>
      )}
    </div>
  );
}
