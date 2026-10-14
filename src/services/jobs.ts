import { JobId, JobRequest, Job, JobEvent } from "../types/job";
import { isTauri } from "../utils/platform";
import { compressImageClientSide, convertImageClientSide, triggerBlobDownload } from "../utils/webConverter";
import { trackAnalyticsEvent, TrackedOperation } from "./analytics";

// In-memory store for web mode execution
const webJobs: Map<JobId, Job> = new Map();
const webFiles: Map<string, File> = new Map();
const webResults: Map<string, { blob: Blob; fileName: string }> = new Map();

const IMAGE_FORMATS: Record<string, "png" | "jpg" | "webp" | "avif"> = {
  "image.jpg_to_png": "png",
  "image.png_to_jpg": "jpg",
  "image.to_webp": "webp",
  "image.to_avif": "avif",
};
const WEB_OPERATIONS: Record<string, TrackedOperation> = {
  "image.jpg_to_png": "image.jpg_to_png",
  "image.png_to_jpg": "image.png_to_jpg",
  "image.to_webp": "image.to_webp",
  "image.to_avif": "image.to_avif",
  "image.compress": "image.compress",
};

/** Register a File object for web mode conversion lookup */
export const registerWebFile = (file: File) => {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  const fileId = `web-${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  webFiles.set(fileId, file);
  return fileId;
};

export const getWebFile = (fileName: string): File | undefined => {
  return webFiles.get(fileName);
};

export const downloadWebResult = (fileName: string) => {
  const result = webResults.get(fileName);
  if (!result) throw new Error(`The browser result "${fileName}" is no longer available`);
  triggerBlobDownload(result.blob, result.fileName);
};

export const getWebResultName = (resultId: string) =>
  webResults.get(resultId)?.fileName ?? resultId;

export const emitWebJobEvent = (event: JobEvent) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("web-job-event", { detail: event }));
  }
};

const isWebJobCancelled = (job: Job) => job.state === "cancelled";

export const jobsService = {
  /** Submit a job. Returns the JobId immediately. Progress comes via events. */
  submit: async (request: JobRequest): Promise<JobId> => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<JobId>("submit_job", { request });
      } catch (err) {
        throw new Error(`Failed to submit conversion job: ${String(err)}`);
      }
    }

    // Web execution
    const id = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newJob: Job = {
      id,
      tool_id: request.tool_id,
      state: "queued",
      input_files: request.input_files,
      output_config: request.output_config,
      options: request.options,
      progress: {
        overall_percent: 0,
        current_file: request.input_files[0] || null,
        files_done: 0,
        files_total: request.input_files.length,
      },
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      result: null,
      error: null,
    };

    webJobs.set(id, newJob);
    emitWebJobEvent({ type: "job_created", id });

    void processWebImageJob(newJob);

    return id;
  },

  /** Cancel a queued or running job. */
  cancel: async (id: JobId): Promise<void> => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<void>("cancel_job", { id });
      } catch (err) {
        throw new Error(`Failed to cancel conversion job: ${String(err)}`);
      }
    }

    const job = webJobs.get(id);
    if (job) {
      job.state = "cancelled";
      job.completed_at = new Date().toISOString();
      emitWebJobEvent({ type: "job_cancelled", id });
    }
  },

  /** Get the current snapshot of a specific job. */
  get: async (id: JobId): Promise<Job | null> => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<Job | null>("get_job", { id });
      } catch (err) {
        throw new Error(`Failed to load conversion job: ${String(err)}`);
      }
    }
    return webJobs.get(id) || null;
  },

  /** List all jobs, most recent first. */
  list: async (): Promise<Job[]> => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<Job[]>("list_jobs");
      } catch (err) {
        throw new Error(`Failed to load conversion jobs: ${String(err)}`);
      }
    }
    return Array.from(webJobs.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
};

async function processWebImageJob(job: Job) {
  const startedAt = performance.now();
  const operation = WEB_OPERATIONS[job.tool_id];
  if (!operation || job.input_files.length === 0) {
    job.state = "failed";
    job.completed_at = new Date().toISOString();
    job.error = {
      message: operation
        ? "Select at least one image to convert."
        : "This operation is not available in the browser. Use the desktop app for this file type.",
      recoverable: false,
    };
    emitWebJobEvent({ type: "job_failed", id: job.id, error: job.error });
    return;
  }

  job.state = "running";
  job.started_at = new Date().toISOString();
  emitWebJobEvent({ type: "job_started", id: job.id });

  const outputFiles: string[] = [];
  const outputNames = new Set<string>();
  const perFileErrors: { input_file: string; message: string }[] = [];
  for (const [index, inputName] of job.input_files.entries()) {
    if (isWebJobCancelled(job)) return;
    const input = webFiles.get(inputName);
    if (!input) {
      perFileErrors.push({ input_file: inputName, message: "The selected file is no longer available in this browser session." });
    } else {
      try {
        const quality = typeof job.options.jpeg_quality === "number"
          ? job.options.jpeg_quality
          : 75;
        let result: Awaited<ReturnType<typeof convertImageClientSide>>;
        if (job.tool_id === "image.compress") {
          result = await compressImageClientSide(input, quality);
        } else {
          const format = IMAGE_FORMATS[job.tool_id];
          if (!format) throw new Error("No browser conversion is registered for this operation.");
          result = await convertImageClientSide(input, format, quality / 100);
        }
        if (isWebJobCancelled(job)) return;
        let outputName = result.fileName;
        if (outputNames.has(outputName)) {
          const extensionIndex = outputName.lastIndexOf(".");
          const stem = extensionIndex > 0 ? outputName.slice(0, extensionIndex) : outputName;
          const extension = extensionIndex > 0 ? outputName.slice(extensionIndex) : "";
          let suffix = 2;
          while (outputNames.has(`${stem} (${suffix})${extension}`)) suffix += 1;
          outputName = `${stem} (${suffix})${extension}`;
        }
        outputNames.add(outputName);
        const resultId = `${job.id}-${index}-${crypto.randomUUID()}`;
        webResults.set(resultId, { blob: result.blob, fileName: outputName });
        outputFiles.push(resultId);
        trackAnalyticsEvent("operation_completed", operation);
      } catch (error) {
        perFileErrors.push({
          input_file: input.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    job.progress.files_done = index + 1;
    job.progress.overall_percent = Math.round(((index + 1) / job.input_files.length) * 100);
    job.progress.current_file = input?.name ?? inputName;
    emitWebJobEvent({
      type: "progress_updated",
      id: job.id,
      progress: { ...job.progress },
    });
  }

  if (isWebJobCancelled(job)) return;
  job.completed_at = new Date().toISOString();
  if (outputFiles.length === 0) {
    const message = perFileErrors.map((error) => error.message).join("; ") || "No files were converted.";
    job.state = "failed";
    job.error = { message, recoverable: false };
    emitWebJobEvent({ type: "job_failed", id: job.id, error: job.error });
    return;
  }

  job.state = "completed";
  job.result = {
    output_files: outputFiles,
    duration_ms: Math.round(performance.now() - startedAt),
    per_file_errors: perFileErrors,
  };
  emitWebJobEvent({ type: "job_completed", id: job.id, result: job.result });
}
