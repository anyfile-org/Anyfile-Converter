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
          // We need to fetch the full job details when created
          // To keep it simple synchronously, we just fetch it, 
          // but we can't await in setState, so we fire and forget
          jobsService.get(event.id).then((job) => {
            if (job) {
              set((s) => ({
                jobs: { ...s.jobs, [job.id]: job },
                jobOrder: [job.id, ...s.jobOrder.filter(id => id !== job.id)]
              }));
            }
          });
          return state; // No immediate change
          
        case 'job_started':
          if (newJobs[event.id]) {
            newJobs[event.id] = { 
              ...newJobs[event.id], 
              state: 'running',
              started_at: new Date().toISOString()
            };
          }
          break;
          
        case 'progress_updated':
          if (newJobs[event.id]) {
            newJobs[event.id] = {
              ...newJobs[event.id],
              progress: event.progress
            };
          }
          break;
          
        case 'job_completed':
          if (newJobs[event.id]) {
            newJobs[event.id] = {
              ...newJobs[event.id],
              state: 'completed',
              completed_at: new Date().toISOString(),
              result: event.result
            };
          }
          break;
          
        case 'job_failed':
          if (newJobs[event.id]) {
            newJobs[event.id] = {
              ...newJobs[event.id],
              state: 'failed',
              completed_at: new Date().toISOString(),
              error: event.error
            };
          }
          break;
          
        case 'job_cancelled':
          if (newJobs[event.id]) {
            newJobs[event.id] = {
              ...newJobs[event.id],
              state: 'cancelled',
              completed_at: new Date().toISOString()
            };
          }
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
