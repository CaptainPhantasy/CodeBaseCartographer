/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly API_KEY?: string; // Legacy support
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Window augmentation for AI Studio integration
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export {};
