import React, { useState, useEffect, useRef } from 'react';
import { Message, AppMode, GraphData } from './types';
import { getLLMService, TaskType } from './services/llmService';
import { useFeatureAvailability } from './hooks/useFeatureAvailability';
import FlowMap from './components/FlowMap';
import AssetGenerator from './components/AssetGenerator';
import LiveSession from './components/LiveSession';
import RepoIngest from './components/RepoIngest';
import { INITIAL_GRAPH_DATA, CARTOGRAPHER_SYSTEM_INSTRUCTION } from './constants';
import { SetupWizard } from './components/SetupWizard';
import { SettingsPage } from './components/SettingsPage';
import { useConfig } from './hooks/useConfig';

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

const App: React.FC = () => {
  const { isFirstRun, config } = useConfig();
  const { 
    isTextAvailable, 
    isTTSAvailable, 
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
            console.warn("Graph generation failed (non-critical):", graphErr);
          }
        }
      }

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: "Error: " + errorMessage + "\n\nPlease check your API key configuration in Settings.", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngest = (filePaths: string[], source: string) => {
    setIsIngestOpen(false);
    const truncatedPaths = filePaths.length > 2000 ? filePaths.slice(0, 2000) : filePaths;
    const count = filePaths.length;
    
    const prompt = `I have loaded the file structure for the project "${source}" (${count} files). 
Here is the file list:
${truncatedPaths.join('\n')}

Please perform Phase 1: Initial Repo Reconnaissance. 
1. Identify likely entry points (CLI, API, UI).
2. Map the probable architecture skeleton.
3. Identify where LLM/AI integration might live based on file names (e.g., 'ai', 'prompts', 'services').
`;
    handleSendMessage(prompt);
  };

  const handleSpeak = async (text: string) => {
    if (!isTTSAvailable) {
      console.warn("TTS not available - configure a TTS provider");
      return;
    }
    
    try {
      const llmService = getLLMService();
      const result = await llmService.generateSpeech(text);
      if (result.audioData) {
        const audio = new Audio("data:audio/mp3;base64," + result.audioData);
        audio.play();
      }
    } catch (e) {
      console.error("TTS Failed", e);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
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
        
        {/* Header */}
        <header className="h-16 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-6 backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-100">
            {mode === AppMode.CHAT && "System Cartography Interface"}
            {mode === AppMode.MAP && "Data Flow Visualization"}
            {mode === AppMode.ASSETS && "Generative Assets"}
          </h2>
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
                    <div className="prose prose-invert prose-sm whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </div>
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
                  className="w-full bg-slate-800 text-slate-200 rounded-xl pl-6 pr-14 py-4 focus:ring-2 focus:ring-cyan-500 focus:outline-none border border-slate-700 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !isTextAvailable}
                  className="absolute right-2 top-2 bottom-2 aspect-square bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ➤
                </button>
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
    </div>
  );
};

export default App;
