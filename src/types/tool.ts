export type ToolCategory =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "archive";

export type EngineKind = "built_in" | "ffmpeg" | "libre_office";

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  input_extensions: string[];
  output_extension: string;
  requires_engine: EngineKind;
}
