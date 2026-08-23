import { invoke } from "@tauri-apps/api/core";
import { JobId, JobRequest, Job } from "../types/job";

export const jobsService = {
  /** Submit a job. Returns the JobId immediately. Progress comes via events. */
  submit: (request: JobRequest): Promise<JobId> =>
    invoke<JobId>("submit_job", { request }),

  /** Cancel a queued or running job. */
  cancel: (id: JobId): Promise<void> =>
    invoke<void>("cancel_job", { id }),

  /** Get the current snapshot of a specific job. */
  get: (id: JobId): Promise<Job | null> =>
    invoke<Job | null>("get_job", { id }),

  /** List all jobs, most recent first. */
  list: (): Promise<Job[]> =>
    invoke<Job[]>("list_jobs"),
};
