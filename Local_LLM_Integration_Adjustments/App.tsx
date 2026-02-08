import React, { useState, useEffect, useRef } from 'react';
import { Message, AppMode, GraphData } from './types';
import { generateTextResponse, generateGraphData, generateSpeech } from './services/geminiService';
import FlowMap from './components/FlowMap';
import AssetGenerator from './components/AssetGenerator';
import LiveSession from './components/LiveSession';
import RepoIngest from './components/RepoIngest';
import { INITIAL_GRAPH_DATA } from './constants';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
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
      // 1. Get Text Response
      const response = await generateTextResponse(
          [...messages.map(m => ({ role: m.role, text: m.text })), { role: 'user', text: userMsg.text }],
          useThinking,
          useSearch
      );

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I couldn't generate a response.",
        timestamp: new Date(),
        isThinking: useThinking
      };
      
      if (response.groundingUrls && response.groundingUrls.length > 0) {
          botMsg.text += "\n\n**Sources:**\n" + response.groundingUrls.map(u => `- ${u}`).join('\n');
      }

      setMessages(prev => [...prev, botMsg]);

      // 2. Auto-Update Map if context implies architecture change
      if (autoMap) {
          // Heuristic: If response is long or mentions "mapped" or "nodes", try to update graph
          // For efficiency, we only do this if specifically requested or heuristically likely
          if (botMsg.text.toLowerCase().includes('entry point') || botMsg.text.toLowerCase().includes('flow') || botMsg.text.toLowerCase().includes('architecture')) {
             const newData = await generateGraphData(botMsg.text);
             if (newData.nodes && newData.links) {
                 setGraphData(newData);
                 // Switch to map view to show off the new map if it's a big update
                 if (textOverride?.includes("codebase structure")) {
                     setMode(AppMode.MAP);
                 }
             }
          }
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Error: " + String(err), timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngest = (filePaths: string[], source: string) => {
      setIsIngestOpen(false);
      // Limit file paths to avoid context overflow if too massive (naive truncation)
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
      try {
          const base64Audio = await generateSpeech(text);
          if (base64Audio) {
              const audio = new Audio("data:audio/mp3;base64," + base64Audio);
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
            <button 
                onClick={() => setMode(AppMode.ASSETS)} 
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${mode === AppMode.ASSETS ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'hover:bg-slate-800'}`}
            >
                <span>🎬</span> Asset Studio
            </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Thinking Mode</span>
                <button 
                    onClick={() => setUseThinking(!useThinking)}
                    className={`w-10 h-6 rounded-full p-1 transition-colors ${useThinking ? 'bg-cyan-600' : 'bg-slate-700'}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${useThinking ? 'translate-x-4' : ''}`} />
                </button>
            </div>
            <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Live Grounding</span>
                <button 
                    onClick={() => setUseSearch(!useSearch)}
                    className={`w-10 h-6 rounded-full p-1 transition-colors ${useSearch ? 'bg-cyan-600' : 'bg-slate-700'}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${useSearch ? 'translate-x-4' : ''}`} />
                </button>
            </div>
            
            <button 
                onClick={() => setIsLiveOpen(true)}
                className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-red-500/20 transition-all flex items-center justify-center gap-2"
            >
               <span>🎙️</span> Architect Live
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
             <div className="text-xs text-slate-500 font-mono">
                 Environment: Local • API: Active
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
                                          <button onClick={() => handleSpeak(msg.text)} className="ml-auto text-slate-400 hover:text-white" title="Read Aloud">🔊</button>
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
                            placeholder="Describe a flow to map, or ask for optimization..."
                            className="w-full bg-slate-800 text-slate-200 rounded-xl pl-6 pr-14 py-4 focus:ring-2 focus:ring-cyan-500 focus:outline-none border border-slate-700 shadow-xl"
                          />
                          <button 
                            onClick={() => handleSendMessage()}
                            disabled={isLoading}
                            className="absolute right-2 top-2 bottom-2 aspect-square bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
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
          {isLiveOpen && <LiveSession onClose={() => setIsLiveOpen(false)} />}
          
          {/* Repo Ingest Modal */}
          <RepoIngest 
            isOpen={isIngestOpen} 
            onClose={() => setIsIngestOpen(false)} 
            onIngest={handleIngest}
          />
      </div>
    </div>
  );
};

export default App;
