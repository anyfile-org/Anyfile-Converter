import { ToolMetadata } from "../types/tool";
import { isTauri } from "../utils/platform";

export const BUILTIN_TOOLS: ToolMetadata[] = [
  {
    id: "image.jpg_to_png",
    name: "JPG → PNG",
    description: "Convert JPEG image to PNG with lossless quality",
    category: "image",
    input_extensions: ["jpg", "jpeg"],
    output_extension: "png",
    requires_engine: "built_in",
  },
  {
    id: "image.png_to_jpg",
    name: "PNG → JPG",
    description: "Convert PNG image to JPEG format",
    category: "image",
    input_extensions: ["png"],
    output_extension: "jpg",
    requires_engine: "built_in",
  },
  {
    id: "image.to_webp",
    name: "Convert Image to WebP",
    description: "Convert JPG, PNG, and WebP images to compact WebP",
    category: "image",
    input_extensions: ["jpg", "jpeg", "png", "webp"],
    output_extension: "webp",
    requires_engine: "built_in",
  },
  {
    id: "image.to_avif",
    name: "Convert Image to AVIF",
    description: "Convert JPG, PNG, and WebP images to efficient AVIF",
    category: "image",
    input_extensions: ["jpg", "jpeg", "png", "webp"],
    output_extension: "avif",
    requires_engine: "built_in",
  },
  {
    id: "image.compress",
    name: "Compress Image",
    description: "Reduce image file size with adjustable quality slider",
    category: "image",
    input_extensions: ["jpg", "jpeg", "png"],
    output_extension: "jpg",
    requires_engine: "built_in",
  },
  {
    id: "pdf.merge",
    name: "Merge PDFs",
    description: "Combine multiple PDF documents into a single file",
    category: "pdf",
    input_extensions: ["pdf"],
    output_extension: "pdf",
    requires_engine: "built_in",
  },
  {
    id: "pdf.split",
    name: "Split PDF",
    description: "Extract specific page ranges from a PDF document",
    category: "pdf",
    input_extensions: ["pdf"],
    output_extension: "pdf",
    requires_engine: "built_in",
  },
  {
    id: "video.extract_audio",
    name: "Extract Audio",
    description: "Extract audio track from video files using FFmpeg",
    category: "video",
    input_extensions: ["mp4", "mkv", "avi", "mov", "webm", "flv"],
    output_extension: "mp3",
    requires_engine: "ffmpeg",
  },
  {
    id: "archive.create_zip",
    name: "Create ZIP",
    description: "Pack selected files into a compressed ZIP archive",
    category: "archive",
    input_extensions: [], // Accepts any file
    output_extension: "zip",
    requires_engine: "built_in",
  },
  {
    id: "archive.extract_zip",
    name: "Extract ZIP",
    description: "Extract all contents from a ZIP archive",
    category: "archive",
    input_extensions: ["zip"],
    output_extension: "",
    requires_engine: "built_in",
  },
];

const WEB_SUPPORTED_TOOL_IDS = new Set([
  "image.jpg_to_png",
  "image.png_to_jpg",
  "image.to_webp",
  "image.to_avif",
  "image.compress",
]);

export const toolsService = {
  /** All registered tools — called once at app startup. */
  list: async (): Promise<ToolMetadata[]> => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<ToolMetadata[]>("list_tools");
      } catch (err) {
        console.warn("Tauri invoke failed, falling back to builtin tools:", err);
      }
    }
    return isTauri()
      ? BUILTIN_TOOLS
      : BUILTIN_TOOLS.filter((tool) => WEB_SUPPORTED_TOOL_IDS.has(tool.id));
  },

  /** Tools that accept a given file extension (e.g. "jpg"). */
  forExtension: async (extension: string): Promise<ToolMetadata[]> => {
    const cleanExt = extension.toLowerCase().replace(/^\./, "");
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const tools = await invoke<ToolMetadata[]>("tools_for_extension", { extension: cleanExt });
        // Include create_zip for any non-archive files as an option if not already present
        const hasZip = tools.some((t) => t.id === "archive.create_zip");
        if (!hasZip && cleanExt !== "zip") {
          const zipTool = BUILTIN_TOOLS.find((t) => t.id === "archive.create_zip");
          if (zipTool) tools.push(zipTool);
        }
        return tools;
      } catch (err) {
        console.warn("Tauri invoke failed, falling back to client-side filtering:", err);
      }
    }

    // Web fallback filtering
    const matching = BUILTIN_TOOLS.filter((tool) => {
      if (!WEB_SUPPORTED_TOOL_IDS.has(tool.id)) return false;
      if (tool.input_extensions.length === 0) {
        return cleanExt !== "zip"; // create_zip can accept any file except existing zip
      }
      return tool.input_extensions.includes(cleanExt);
    });

    return matching;
  },
};
