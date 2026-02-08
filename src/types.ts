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
  type: 'entry' | 'logic' | 'storage' | 'exit' | 'external';
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
