export type PromptType =
  | 'summary'
  | 'chunk_summary'
  | 'merge_summary'
  | 'video_insights'
  | 'one_page_json'
  | 'image_prompt'
  | 'comment_summary';

export interface PromptPreset {
  id: string;
  name: string;
  type: PromptType;
  description?: string;
  icon?: string;
  template: string;
  enTemplate?: string;
  builtIn: boolean;
}

export interface PromptVariables {
  title?: string;
  creatorName?: string;
  upName?: string;
  platform?: string;
  description?: string;
  url?: string;
  transcript?: string;
  chunkText?: string;
  chunkIndex?: number;
  totalChunks?: number;
  chunkSummaries?: string;
  summary?: string;
  question?: string;
  comments?: string;
  [key: string]: string | number | undefined;
}
