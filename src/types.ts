export enum AppMode {
  CHAT = 'CHAT',
  MAP = 'MAP',
  ASSETS = 'ASSETS',
  TASKS = 'TASKS',
  FLOW_CHART = 'FLOW_CHART'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export interface Node {
  id: string;
  group: number;
  label: string;
  type: 'entry' | 'logic' | 'storage' | 'exit' | 'external' | 'decision' | 'process';
}

export interface Link {
  source: string;
  target: string;
  value: number;
  label?: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export enum ModelType {
  SMART_THINKING = 'gemini-3-pro-preview',
  FAST_CHAT = 'gemini-3-flash-preview', // Used for search grounding
  LIVE_AUDIO = 'gemini-2.5-flash-native-audio-preview-12-2025',
  TTS = 'gemini-2.5-flash-preview-tts',
  IMAGE_GEN = 'gemini-3-pro-image-preview',
  VIDEO_GEN = 'veo-3.1-fast-generate-preview'
}

export interface VeoConfig {
    aspectRatio: '16:9' | '9:16';
    resolution: '720p' | '1080p';
}

export type FileTypeCategory = 'code' | 'config' | 'documentation' | 'image' | 'binary' | 'infrastructure' | 'style' | 'web';

export interface ProcessedFile {
  path: string;
  content: string;
  category: FileTypeCategory;
  metadata?: Record<string, any>;
  binary?: boolean;
}

export interface ProcessedContent {
  summary: string;
  extracts: Array<{
    path: string;
    content: string;
    startLine?: number;
    endLine?: number;
  }>;
  symbols?: Array<{
    name: string;
    type: string;
    path: string;
    line?: number;
  }>;
}

export interface FileTypeHandler {
  extensions: string[];
  category: FileTypeCategory;
  binary: boolean;
  processContent?: (content: Buffer | string, filePath: string) => Promise<ProcessedContent>;
  maxSize?: number;
}
