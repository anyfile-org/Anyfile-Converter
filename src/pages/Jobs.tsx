import { useJobStore } from '../stores/jobStore';
import JobCard from '../components/jobs/JobCard';
import { Activity } from 'lucide-react';

export default function Jobs() {
  const { jobs, jobOrder, isLoading } = useJobStore();

  if (isLoading) {
    return <div className="p-8 text-center text-muted">Loading jobs...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex items-center gap-3 mb-6" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Activity size={28} style={{ color: 'var(--primary-accent)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>Active Jobs</h1>
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
