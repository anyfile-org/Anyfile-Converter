// Types mirroring the Rust core types — kept in sync with src-tauri/src/

export type JobId = string; // UUID

export type JobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobProgress {
  overall_percent: number;
  current_file: string | null;
  files_done: number;
  files_total: number;
}

export interface PerFileError {
  input_file: string;
  message: string;
}

export interface JobResult {
  output_files: string[];
  duration_ms: number;
  per_file_errors: PerFileError[];
}

export interface JobError {
  message: string;
  recoverable: boolean;
}

export interface OutputConfig {
  directory: string;
  overwrite: boolean;
  naming:
    | "same_name_new_extension"
    | { append_suffix: string }
    | { numbered: { base: string } };
}

export interface JobRequest {
  tool_id: string;
  input_files: string[];
  output_config: OutputConfig;
  options: Record<string, unknown>;
}

export interface Job {
  id: JobId;
  tool_id: string;
  state: JobState;
  input_files: string[];
  output_config: OutputConfig;
  options: Record<string, unknown>;
  progress: JobProgress;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: JobResult | null;
  error: JobError | null;
}

// ── Job events emitted by the Rust backend ──────────────────────────────────

export type JobEvent =
  | { type: "job_created"; id: JobId }
  | { type: "job_started"; id: JobId }
  | { type: "progress_updated"; id: JobId; progress: JobProgress }
  | { type: "job_completed"; id: JobId; result: JobResult }
  | { type: "job_failed"; id: JobId; error: JobError }
  | { type: "job_cancelled"; id: JobId };
