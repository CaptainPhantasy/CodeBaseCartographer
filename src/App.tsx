import React, { useState, useEffect, useRef } from 'react';
import { Message, AppMode, GraphData } from './types';
import { getLLMService, TaskType } from './services/llmService';
import { useFeatureAvailability } from './hooks/useFeatureAvailability';
import { useFileChanges } from './hooks/useFileChanges';
import { useGraphUpdates } from './hooks/useGraphUpdates';
import { useTTSQueue } from './services/ttsQueueService';
import FlowMap from './components/FlowMap';
import AssetGenerator from './components/AssetGenerator';
import LiveSession from './components/LiveSession';
import RepoIngest from './components/RepoIngest';
import DiagramView from './components/DiagramView';
import ViewToggle from './components/ViewToggle';
import TasksView from './components/TasksView';
import { INITIAL_GRAPH_DATA, CARTOGRAPHER_SYSTEM_INSTRUCTION } from './constants';
import { SetupWizard } from './components/SetupWizard';
import { SettingsPage } from './components/SettingsPage';
import { NoApiKeyWarning } from './components/NoApiKeyWarning';
import WatchModeToggle from './components/WatchModeToggle';
import FileChangeNotification from './components/FileChangeNotification';
import DiffModal from './components/DiffModal';
import { useConfig } from './hooks/useConfig';
import { getConfigManager } from './config/configManager';
import DOMPurify from 'dompurify';
import { sanitizeError } from './utils/errorSanitizer';
import { apiFetch } from './services/apiClient';

// Tooltip component for unavailable features
const FeatureTooltip: React.FC<{ message: string; children: React.ReactNode }> = ({ message, children }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-600">
      {message}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
    </div>
  </div>
);

// Loaded file with content for context-aware graph generation
interface LoadedFile {
  path: string;
  content: string;
}

const App: React.FC = () => {
  const { isFirstRun, config } = useConfig();
  const {
    isTextAvailable,
    isTTSAvailable,
    isSTTAvailable,
    isVideoAvailable,
    isRealtimeAvailable,
    isThinkingAvailable,
    isSearchGroundingAvailable,
    getConfigureMessage,
    loading: featuresLoading
  } = useFeatureAvailability();

  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  
  // Store loaded files with contents for context-aware generation
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [loadedFilesSource, setLoadedFilesSource] = useState<string>('');
  
  // Show setup wizard on first run
  useEffect(() => {
    if (isFirstRun) {
      setShowSetupWizard(true);
    }
  }, [isFirstRun]);
  
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'I am the Codebase Cartographer. I can map your system, trace data flows, and identify optimization opportunities. Connect a codebase or describe a system to begin.', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [graphData, setGraphData] = useState<GraphData>(INITIAL_GRAPH_DATA);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Toggles
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [autoMap, setAutoMap] = useState(true);
  const [autoTTS, setAutoTTS] = useState(false);

  // TTS Queue for playback controls
  const ttsQueue = useTTSQueue();

  // Microphone recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Watch Mode hooks
  const {
    changes,
    selectedFilePath,
    isWatching,
    isConnected,
    startWatching,
    stopWatching,
    viewDiff,
    closeDiff,
    clearChanges
  } = useFileChanges({
    autoDismiss: true,
    dismissDelay: 8000
  });

  // Graph updates on architecture file changes
  useGraphUpdates(setGraphData, {
    enabled: isWatching,
    debounceMs: 3000,
    onUpdate: async (fileChangeEvent) => {
      // Trigger a graph update when architecture files change
      if (autoMap) {
        try {
          const llmService = getLLMService();
          if (llmService.isTaskAvailable(TaskType.GRAPH_GENERATION)) {
            const newData = await llmService.generateGraphData(
              `Architecture file changed: ${fileChangeEvent.path}. Update the visualization.`
            );
            if (newData.nodes && newData.links) {
              setGraphData(newData);
            }
          }
        } catch (err) {
          // Non-critical error - auto graph update is optional
          const sanitizedError = err instanceof Error ? err.message : String(err);
          setMessages(prev => [...prev.slice(-9), {
            id: Date.now().toString(),
            role: 'model',
            text: `⚠️ Auto graph update failed (non-critical): ${sanitizedError}`,
            timestamp: new Date()
          }]);
        }
      }
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim()) return;
    
    if (!isTextAvailable) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: '⚠️ No LLM provider configured. Please go to Settings and add an API key to enable chat functionality.', 
        timestamp: new Date() 
      }]);
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInputText('');
    setIsLoading(true);

    try {
      const llmService = getLLMService();
      
      // Build conversation history
      const history = [...messages.map(m => ({ role: m.role, text: m.text })), { role: 'user', text: userMsg.text }];
      
      // Generate response using the unified service
      const response = await llmService.chat(history, {
        systemPrompt: CARTOGRAPHER_SYSTEM_INSTRUCTION,
        useThinking: useThinking && isThinkingAvailable,
        useSearchGrounding: useSearch && isSearchGroundingAvailable
      });

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I couldn't generate a response.",
        timestamp: new Date(),
        isThinking: useThinking
      };
      
      // Add grounding sources if available
      if (response.metadata?.groundingUrls && response.metadata.groundingUrls.length > 0) {
        botMsg.text += "\n\n**Sources:**\n" + response.metadata.groundingUrls.map((u: string) => `- ${u}`).join('\n');
      }

      setMessages(prev => [...prev, botMsg]);

      // Auto-TTS: Speak responses automatically if enabled
      if (autoTTS && isTTSAvailable) {
        // Speak without blocking - fail silently
        handleSpeak(botMsg.text).catch(err => {
          // Non-critical: TTS failure shouldn't interrupt chat
          const sanitizedError = err instanceof Error ? err.message : String(err);
          // Only log to console for debugging, don't spam user
          console.debug(`Auto-TTS skipped: ${sanitizedError}`);
        });
      }

      // Auto-Update Map if context implies architecture change
      if (autoMap && llmService.isTaskAvailable(TaskType.GRAPH_GENERATION)) {
        if (botMsg.text.toLowerCase().includes('entry point') ||
            botMsg.text.toLowerCase().includes('flow') ||
            botMsg.text.toLowerCase().includes('architecture')) {
          try {
            const newData = await llmService.generateGraphData(botMsg.text);
            if (newData.nodes && newData.links) {
              setGraphData(newData);
              if (textOverride?.includes("codebase structure")) {
                setMode(AppMode.MAP);
              }
            }
          } catch (graphErr) {
            // Non-critical: auto graph generation is optional
            const sanitizedError = graphErr instanceof Error ? graphErr.message : String(graphErr);
            console.debug(`Auto graph generation skipped: ${sanitizedError}`);
          }
        }
      }

    } catch (err) {
      const sanitizedError = sanitizeError(err);
      console.error(sanitizedError);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Error: " + sanitizedError + "\n\nPlease check your API key configuration in Settings.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngest = async (filePaths: string[], source: string, options?: any) => {
    setIsIngestOpen(false);
    const truncatedPaths = filePaths.length > 2000 ? filePaths.slice(0, 2000) : filePaths;
    const count = filePaths.length;

    // Store source for context
    setLoadedFilesSource(source);

    // Try to fetch file contents for context-aware graph generation
    // This works when using local files with the backend server running
    const filesWithContents: LoadedFile[] = [];
    const MAX_FILES = 50; // Limit to avoid overwhelming the LLM
    const MAX_CONTENT_SIZE = 10000; // Characters per file

    // Only fetch code files (skip large files, binaries, etc.)
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.java', '.rs', '.rb', '.php', '.cs'];
    const codeFiles = filePaths.filter(p => 
      codeExtensions.some(ext => p.endsWith(ext)) && 
      !p.includes('node_modules') && 
      !p.includes('.test.') &&
      !p.includes('.spec.')
    ).slice(0, MAX_FILES);

    // Try to fetch contents from backend
    try {
      const fetchPromises = codeFiles.map(async (path) => {
        try {
          const response = await apiFetch(`/api/files/${encodeURIComponent(path)}`);
          if (response.ok) {
            const data = await response.json();
            const content = data.content?.slice(0, MAX_CONTENT_SIZE) || '';
            if (content) {
              return { path, content };
            }
          }
        } catch {
          // Ignore fetch errors - file might not exist or other issues
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      const validFiles = results.filter((f): f is LoadedFile => f !== null);
      filesWithContents.push(...validFiles);

      if (filesWithContents.length > 0) {
        setLoadedFiles(filesWithContents);
        console.log(`Loaded ${filesWithContents.length} files with content for context-aware generation`);
      }
    } catch (err) {
      console.warn('Failed to fetch file contents:', err);
    }

    let filterInfo = '';
    if (options) {
      const filters = [];
      if (options.includeHidden) filters.push('including hidden files');
      if (options.fileCategories && options.fileCategories.length > 0) {
        filters.push(`${options.fileCategories.length} file categories`);
      }
      if (filters.length > 0) {
        filterInfo = ` Filters applied: ${filters.join(', ')}.`;
      }
    }

    const contextInfo = filesWithContents.length > 0 
      ? `\n\n**Context Available:** ${filesWithContents.length} files loaded with full content for accurate flow chart generation. Use "Generate Flow Chart" in the Flow Chart view to visualize with real file paths and transformations.`
      : '';

    const prompt = `I have loaded the file structure for the project "${source}" (${count} files).${filterInfo}
Here is the file list:
${truncatedPaths.join('\n')}${contextInfo}

Please perform Phase 1: Initial Repo Reconnaissance.
1. Identify likely entry points (CLI, API, UI).
2. Map the probable architecture skeleton with DATA FLOWS between components.
3. Identify where LLM/AI integration might live based on file names (e.g., 'ai', 'prompts', 'services').

IMPORTANT: Help me understand:
- What are the main components and how do they CONNECT?
- What data flows from entry points THROUGH the system?
- Where are the key integration points?

After your analysis, suggest I ask you to "generate a flow chart" to visualize the architecture.
`;
    handleSendMessage(prompt);
  };

  const handleSpeak = async (text: string) => {
    if (!isTTSAvailable) {
      console.warn("TTS not available - configure a TTS provider");
      return;
    }

    // Get user's selected voice for ElevenLabs
    let voiceOption: string | undefined;
    const configManager = getConfigManager();
    const elevenlabsConfig = configManager.getEnabledProviders().find(p => p.providerId === 'elevenlabs');
    if (elevenlabsConfig?.selectedVoiceId) {
      voiceOption = elevenlabsConfig.selectedVoiceId;
    }

    // Add to queue - will play sequentially
    ttsQueue.enqueue(text, voiceOption);
  };

  const handleToggleRecording = async () => {
    if (!isSTTAvailable) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: '⚠️ Speech-to-Text not available. Please configure OpenAI (Whisper), Google, or ElevenLabs in Settings.',
        timestamp: new Date()
      }]);
      return;
    }

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();

          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());

          try {
            const llmService = getLLMService();
            const result = await llmService.transcribeAudio(arrayBuffer);

            if (result.text) {
              setInputText(prev => prev + (prev ? ' ' : '') + result.text);
            }
          } catch (e) {
            console.error('STT Failed:', e);
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'model',
              text: `⚠️ Transcription failed: ${e instanceof Error ? e.message : String(e)}`,
              timestamp: new Date()
            }]);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Microphone access failed:', e);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          text: '⚠️ Microphone access denied. Please allow microphone access in your browser settings.',
          timestamp: new Date()
        }]);
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden" data-app-ready="true">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center font-bold text-slate-900">CC</div>
          <h1 className="font-bold text-lg tracking-tight">Cartographer</h1>
        </div>
        
        <div className="mb-6">
          <button 
            onClick={() => setIsIngestOpen(true)}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-2 transition-colors border border-indigo-500/50 shadow-lg shadow-indigo-900/20"
          >
            <span>🚀</span> Connect Codebase
          </button>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setMode(AppMode.CHAT)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${mode === AppMode.CHAT ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-slate-800'}`}
          >
            <span>💬</span> Trace & Chat
          </button>
          <button
            onClick={() => setMode(AppMode.MAP)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${mode === AppMode.MAP ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-slate-800'}`}
          >
            <span>🗺️</span> Visual Map
          </button>
          <button
            onClick={() => setMode(AppMode.FLOW_CHART)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${mode === AppMode.FLOW_CHART ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-slate-800'}`}
          >
            <span>📊</span> Flow Chart
          </button>
          <button
            onClick={() => setMode(AppMode.TASKS)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${mode === AppMode.TASKS ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-slate-800'}`}
          >
            <span>✅</span> Tasks
          </button>

          {/* Video/Asset Studio - conditionally show based on availability */}
          {isVideoAvailable ? (
            <button
              onClick={() => setMode(AppMode.ASSETS)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${mode === AppMode.ASSETS ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-slate-800'}`}
            >
              <span>🎬</span> Asset Studio
            </button>
          ) : (
            <FeatureTooltip message={getConfigureMessage('isVideoAvailable') || 'Video generation unavailable'}>
              <button
                disabled
                className="w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 opacity-50 cursor-not-allowed bg-slate-800/50"
              >
                <span>🎬</span> Asset Studio
              </button>
            </FeatureTooltip>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          {/* Watch Mode Toggle */}
          <WatchModeToggle
            onEnabledChange={(enabled) => {
              if (enabled) {
                startWatching();
              } else {
                stopWatching();
              }
            }}
            className="px-1"
          />

          {/* Thinking Mode Toggle - with availability check */}
          {isThinkingAvailable ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Thinking Mode</span>
              <button 
                onClick={() => setUseThinking(!useThinking)}
                className={`w-10 h-6 rounded-full p-1 transition-colors ${useThinking ? 'bg-cyan-600' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${useThinking ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          ) : (
            <FeatureTooltip message={getConfigureMessage('isThinkingAvailable') || 'Extended thinking unavailable'}>
              <div className="flex items-center justify-between text-sm opacity-50">
                <span className="text-slate-400">Thinking Mode</span>
                <div className="w-10 h-6 rounded-full p-1 bg-slate-700 cursor-not-allowed">
                  <div className="w-4 h-4 bg-slate-500 rounded-full" />
                </div>
              </div>
            </FeatureTooltip>
          )}
          
          {/* Search Grounding Toggle - with availability check */}
          {isSearchGroundingAvailable ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Live Grounding</span>
              <button 
                onClick={() => setUseSearch(!useSearch)}
                className={`w-10 h-6 rounded-full p-1 transition-colors ${useSearch ? 'bg-cyan-600' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${useSearch ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          ) : (
            <FeatureTooltip message={getConfigureMessage('isSearchGroundingAvailable') || 'Search grounding unavailable'}>
              <div className="flex items-center justify-between text-sm opacity-50">
                <span className="text-slate-400">Live Grounding</span>
                <div className="w-10 h-6 rounded-full p-1 bg-slate-700 cursor-not-allowed">
                  <div className="w-4 h-4 bg-slate-500 rounded-full" />
                </div>
              </div>
            </FeatureTooltip>
          )}

          {/* Auto-TTS Toggle - with availability check */}
          {isTTSAvailable ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Auto-Speak</span>
              <button
                onClick={() => setAutoTTS(!autoTTS)}
                className={`w-10 h-6 rounded-full p-1 transition-colors ${autoTTS ? 'bg-cyan-600' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoTTS ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          ) : (
            <FeatureTooltip message={getConfigureMessage('isTTSAvailable') || 'TTS unavailable'}>
              <div className="flex items-center justify-between text-sm opacity-50">
                <span className="text-slate-400">Auto-Speak</span>
                <div className="w-10 h-6 rounded-full p-1 bg-slate-700 cursor-not-allowed">
                  <div className="w-4 h-4 bg-slate-500 rounded-full" />
                </div>
              </div>
            </FeatureTooltip>
          )}

          {/* TTS Playback Controls - show when TTS is available and queue is active */}
          {isTTSAvailable && (ttsQueue.isPlaying || ttsQueue.isPaused || ttsQueue.queueLength > 0) && (
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
              <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
                <span>
                  {ttsQueue.isLoading && 'Loading...'}
                  {ttsQueue.isPlaying && '🔊 Speaking...'}
                  {ttsQueue.isPaused && '⏸️ Paused'}
                  {!ttsQueue.isPlaying && !ttsQueue.isPaused && !ttsQueue.isLoading && ttsQueue.queueLength > 0 && `Queued: ${ttsQueue.queueLength}`}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={ttsQueue.togglePause}
                  disabled={!ttsQueue.isPlaying && !ttsQueue.isPaused}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                    ttsQueue.isPlaying || ttsQueue.isPaused
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                  title={ttsQueue.isPlaying ? 'Pause' : 'Resume'}
                >
                  {ttsQueue.isPlaying ? '⏸' : '▶️'}
                </button>
                <button
                  onClick={ttsQueue.skip}
                  disabled={!ttsQueue.isPlaying && !ttsQueue.isPaused && ttsQueue.queueLength === 0}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                    ttsQueue.isPlaying || ttsQueue.isPaused || ttsQueue.queueLength > 0
                      ? 'bg-slate-600 hover:bg-slate-500 text-white'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Skip to next"
                >
                  ⏭
                </button>
                <button
                  onClick={ttsQueue.stop}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors bg-red-600/50 hover:bg-red-600/70 text-white`}
                  title="Stop all"
                >
                  ⏹
                </button>
              </div>
            </div>
          )}

          {/* Real-time Voice Button - with availability check */}
          {isRealtimeAvailable ? (
            <button 
              onClick={() => setIsLiveOpen(true)}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>🎙️</span> Architect Live
            </button>
          ) : (
            <FeatureTooltip message={getConfigureMessage('isRealtimeAvailable') || 'Real-time voice unavailable'}>
              <button 
                disabled
                className="w-full py-3 bg-gradient-to-r from-slate-600 to-slate-500 text-slate-300 font-bold rounded-lg opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>🎙️</span> Architect Live
              </button>
            </FeatureTooltip>
          )}
          
          <button 
            onClick={() => setShowSettings(true)}
            className="w-full py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
          >
            <span>⚙️</span> Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">

        {/* No API Key Warning Banner */}
        <NoApiKeyWarning
          onOpenSetup={() => setShowSetupWizard(true)}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Header */}
        <header className="h-16 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-slate-100">
              {mode === AppMode.CHAT && "System Cartography Interface"}
              {mode === AppMode.MAP && "Data Flow Visualization"}
              {mode === AppMode.ASSETS && "Generative Assets"}
              {mode === AppMode.FLOW_CHART && "Flow Chart Editor"}
              {mode === AppMode.TASKS && "Task Management"}
            </h2>
            {/* View Toggle for Flow Chart */}
            {(mode === AppMode.CHAT || mode === AppMode.FLOW_CHART) && (
              <ViewToggle currentMode={mode} onModeChange={setMode} />
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500 font-mono">
              {config.providers.filter(p => p.isEnabled).length > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {config.providers.filter(p => p.isEnabled).length} Provider{config.providers.filter(p => p.isEnabled).length !== 1 ? 's' : ''} Active
                </span>
              ) : (
                <span className="text-amber-400">No providers configured</span>
              )}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-hidden relative">
          
          {/* Chat View */}
          <div className={`absolute inset-0 flex flex-col ${mode === AppMode.CHAT ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl rounded-2xl p-5 ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 border border-slate-700'}`}>
                    {msg.role === 'model' && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/50">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Cartographer AI</span>
                        {msg.isThinking && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Thinking Mode</span>}
                        {isTTSAvailable ? (
                          <button onClick={() => handleSpeak(msg.text)} className="ml-auto text-slate-400 hover:text-white" title="Read Aloud">🔊</button>
                        ) : (
                          <FeatureTooltip message={getConfigureMessage('isTTSAvailable') || 'TTS unavailable'}>
                            <button disabled className="ml-auto text-slate-600 cursor-not-allowed" title="TTS unavailable">🔊</button>
                          </FeatureTooltip>
                        )}
                      </div>
                    )}
                    {msg.role === 'model' ? (
                      <div
                        className="prose prose-invert prose-sm whitespace-pre-wrap leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(msg.text, {
                            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'a', 'p', 'br'],
                            ALLOWED_ATTR: ['href']
                          })
                        }}
                      />
                    ) : (
                      <div className="prose prose-invert prose-sm whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-75" />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-6 bg-slate-900 border-t border-slate-800">
              <div className="relative max-w-4xl mx-auto">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isTextAvailable ? "Describe a flow to map, or ask for optimization..." : "Configure an LLM provider in Settings to enable chat"}
                  disabled={!isTextAvailable}
                  className="w-full bg-slate-800 text-slate-200 rounded-xl pl-6 pr-28 py-4 focus:ring-2 focus:ring-cyan-500 focus:outline-none border border-slate-700 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="absolute right-2 top-2 bottom-2 flex items-center gap-1">
                  {/* Microphone button */}
                  {isSTTAvailable ? (
                    <button
                      onClick={handleToggleRecording}
                      disabled={isLoading}
                      className={`aspect-square w-10 rounded-lg flex items-center justify-center transition-colors ${
                        isRecording
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                          : 'bg-slate-700 hover:bg-slate-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={isRecording ? 'Stop recording' : 'Record voice'}
                    >
                      {isRecording ? '⏹️' : '🎤'}
                    </button>
                  ) : (
                    <FeatureTooltip message={getConfigureMessage('isSTTAvailable') || 'Speech-to-Text unavailable'}>
                      <button
                        disabled
                        className="aspect-square w-10 rounded-lg flex items-center justify-center bg-slate-700 opacity-50 cursor-not-allowed"
                        title="Speech-to-Text unavailable"
                      >
                        🎤
                      </button>
                    </FeatureTooltip>
                  )}
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !isTextAvailable}
                    className="aspect-square w-10 bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send"
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Map View */}
          <div className={`absolute inset-0 p-6 ${mode === AppMode.MAP ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}>
            <FlowMap data={graphData} />
          </div>

          {/* Assets View */}
          <div className={`absolute inset-0 p-6 ${mode === AppMode.ASSETS ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}>
            <AssetGenerator />
          </div>

          {/* Flow Chart View */}
          <div className={`absolute inset-0 ${mode === AppMode.FLOW_CHART ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}>
            <DiagramView 
              graphData={graphData} 
              onGraphDataChange={setGraphData} 
              loadedFiles={loadedFiles}
              loadedFilesSource={loadedFilesSource}
            />
          </div>

          {/* Tasks View */}
          <div className={`absolute inset-0 ${mode === AppMode.TASKS ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}>
            <TasksView />
          </div>

        </main>

        {/* Live Session Overlay */}
        {isLiveOpen && isRealtimeAvailable && <LiveSession onClose={() => setIsLiveOpen(false)} />}
        
        {/* Repo Ingest Modal */}
        <RepoIngest 
          isOpen={isIngestOpen} 
          onClose={() => setIsIngestOpen(false)} 
          onIngest={handleIngest}
        />
      </div>

      {/* Setup Wizard - shown on first run */}
      {showSetupWizard && (
        <SetupWizard onComplete={() => setShowSetupWizard(false)} />
      )}

      {/* Settings Page */}
      <SettingsPage
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* File Change Notifications */}
      <FileChangeNotification
        changes={changes}
        onViewDiff={viewDiff}
        autoDismiss={true}
        dismissDelay={8000}
      />

      {/* Diff Modal */}
      <DiffModal
        filePath={selectedFilePath}
        onClose={closeDiff}
      />
    </div>
  );
};

export default App;
