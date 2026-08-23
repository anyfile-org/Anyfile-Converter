import { create } from 'zustand';
import { Job, JobEvent, JobId } from '../types/job';
import { jobsService } from '../services/jobs';
import { listen } from '@tauri-apps/api/event';

interface JobStore {
  jobs: Record<JobId, Job>;
  jobOrder: JobId[]; // for maintaining display order
  isLoading: boolean;
  
  // Actions
  fetchInitialJobs: () => Promise<void>;
  setupEventBridge: () => Promise<() => void>; // Returns unlisten function
  handleEvent: (event: JobEvent) => void;
  cancelJob: (id: JobId) => Promise<void>;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: {},
  jobOrder: [],
  isLoading: true,

  fetchInitialJobs: async () => {
    try {
      const jobList = await jobsService.list();
      const jobsRecord: Record<JobId, Job> = {};
      const jobOrder = jobList.map((job) => {
        jobsRecord[job.id] = job;
        return job.id;
      });
      
      set({ jobs: jobsRecord, jobOrder, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch initial jobs:', error);
      set({ isLoading: false });
    }
  },

  setupEventBridge: async () => {
    // Listen for events from Tauri backend
    const unlisten = await listen<JobEvent>('job-event', (event) => {
      get().handleEvent(event.payload);
    });
    return unlisten;
  },

  handleEvent: (event: JobEvent) => {
    set((state) => {
      const newJobs = { ...state.jobs };
      
      switch (event.type) {
        case 'job_created':
          jobsService.get(event.id).then((fetchedJob) => {
            if (fetchedJob) {
              set((s) => {
                const existingJob = s.jobs[fetchedJob.id];
                // If events arrived before the fetch completed, merge them!
                const mergedJob = existingJob 
                  ? { ...fetchedJob, ...existingJob } 
                  : fetchedJob;
                  
                return {
                  jobs: { ...s.jobs, [fetchedJob.id]: mergedJob },
                  jobOrder: [fetchedJob.id, ...s.jobOrder.filter(id => id !== fetchedJob.id)]
                };
              });
            }
          });
          return state; // No immediate change
          
        case 'job_started':
          newJobs[event.id] = { 
            ...(newJobs[event.id] || {} as any), 
            state: 'running',
            started_at: new Date().toISOString()
          };
          break;
          
        case 'progress_updated':
          newJobs[event.id] = {
            ...(newJobs[event.id] || {} as any),
            progress: event.progress
          };
          break;
          
        case 'job_completed':
          newJobs[event.id] = {
            ...(newJobs[event.id] || {} as any),
            state: 'completed',
            completed_at: new Date().toISOString(),
            result: event.result
          };
          break;
          
        case 'job_failed':
          newJobs[event.id] = {
            ...(newJobs[event.id] || {} as any),
            state: 'failed',
            completed_at: new Date().toISOString(),
            error: event.error
          };
          break;
          
        case 'job_cancelled':
          newJobs[event.id] = {
            ...(newJobs[event.id] || {} as any),
            state: 'cancelled',
            completed_at: new Date().toISOString()
          };
          break;
      }
      
      return { jobs: newJobs };
    });
  },

  cancelJob: async (id: JobId) => {
    try {
      await jobsService.cancel(id);
    } catch (error) {
      console.error(`Failed to cancel job ${id}:`, error);
    }
  }
}));
