import { invoke } from "@tauri-apps/api/core";
import { ToolMetadata } from "../types/tool";

export const toolsService = {
  /** All registered tools — called once at app startup. */
  list: (): Promise<ToolMetadata[]> =>
    invoke<ToolMetadata[]>("list_tools"),

  /** Tools that accept a given file extension (e.g. "jpg"). */
  forExtension: (extension: string): Promise<ToolMetadata[]> =>
    invoke<ToolMetadata[]>("tools_for_extension", { extension }),
};
