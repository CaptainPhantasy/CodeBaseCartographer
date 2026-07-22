import React, { useEffect, useRef, useState } from 'react';
import { getLLMService } from '../services/llmService';
import { useFeatureAvailability } from '../hooks/useFeatureAvailability';
import { getConfigManager } from '../config/configManager';
import { CARTOGRAPHER_SYSTEM_INSTRUCTION } from '../constants';
import { sanitizeError } from '../utils/errorSanitizer';

// Audio utils
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

interface LiveSessionProps {
    onClose: () => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ onClose }) => {
    const { isRealtimeAvailable, getConfigureMessage } = useFeatureAvailability();
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'unavailable' | 'closed'>('connecting');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [visualizerData, setVisualizerData] = useState<number[]>([10, 20, 15, 30, 20]);
    
    // Audio Context Refs
    const inputContextRef = useRef<AudioContext | null>(null);
    const outputContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const connectionRef = useRef<{ sendAudio: (data: string) => void; send: (data: unknown) => void; close: () => void } | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        let mounted = true;
        let stream: MediaStream | null = null;

        // Check if realtime is available
        if (!isRealtimeAvailable) {
            setStatus('unavailable');
            setErrorMessage(getConfigureMessage('isRealtimeAvailable') || 'Real-time voice not configured');
            return;
        }

        const startSession = async () => {
            try {
                const llmService = getLLMService();
                const configManager = getConfigManager();

                // Get user's selected voice for ElevenLabs
                let selectedVoice: string | undefined;
                const elevenlabsConfig = configManager.getEnabledProviders().find(p => p.providerId === 'elevenlabs');
                if (elevenlabsConfig?.selectedVoiceId) {
                    selectedVoice = elevenlabsConfig.selectedVoiceId;
                }

                // Setup Audio Contexts
                inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

                stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Connect to realtime API through the service layer
                const connection = await llmService.connectRealtime({
                    systemPrompt: CARTOGRAPHER_SYSTEM_INSTRUCTION,
                    voice: selectedVoice || 'Kore', // Use user's selected voice or default
                    onOpen: () => {
                        if (!mounted) return;
                        setStatus('connected');
                        
                        // Setup Input Processing
                        if (!inputContextRef.current || !stream) return;
                        
                        sourceRef.current = inputContextRef.current.createMediaStreamSource(stream);
                        processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        processorRef.current.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            // Simple visualizer data update from input
                            const volume = inputData.reduce((a, b) => a + Math.abs(b), 0) / inputData.length;
                            setVisualizerData(prev => [...prev.slice(1), volume * 500].slice(-5));

                            // Convert to PCM 16 LE
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const base64Data = arrayBufferToBase64(int16.buffer);
                            
                            // Send audio through the connection
                            connection.sendAudio(base64Data);
                        };
                        
                        sourceRef.current.connect(processorRef.current);
                        processorRef.current.connect(inputContextRef.current.destination);
                    },
                    onAudio: (audioData: string) => {
                        if (!outputContextRef.current) return;
                        
                        const audioBytes = base64ToUint8Array(audioData);
                        
                        // Decoding
                        const dataInt16 = new Int16Array(audioBytes.buffer);
                        const numChannels = 1;
                        const sampleRate = 24000;
                        const frameCount = dataInt16.length / numChannels;
                        const buffer = outputContextRef.current.createBuffer(numChannels, frameCount, sampleRate);
                        
                        const channelData = buffer.getChannelData(0);
                        for (let i = 0; i < frameCount; i++) {
                            channelData[i] = dataInt16[i] / 32768.0;
                        }

                        // Playback
                        const source = outputContextRef.current.createBufferSource();
                        source.buffer = buffer;
                        source.connect(outputContextRef.current.destination);
                        
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputContextRef.current.currentTime);
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += buffer.duration;
                    },
                    onClose: () => {
                        if (mounted) setStatus('closed');
                    },
                    onError: (err: Error) => {
                        const sanitizedError = sanitizeError(err);
                        console.error('Realtime error:', sanitizedError);
                        if (mounted) {
                            setStatus('error');
                            setErrorMessage(sanitizedError);
                        }
                    }
                });
                
                connectionRef.current = connection;

            } catch (e: unknown) {
                const sanitizedError = sanitizeError(e);
                console.error("Live session failed", sanitizedError);
                if (mounted) {
                    setStatus('error');
                    setErrorMessage(sanitizedError || 'Failed to connect');
                }
            }
        };

        startSession();

        return () => {
            mounted = false;
            
            // Cleanup audio processing
            if (processorRef.current) {
                processorRef.current.disconnect();
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect();
            }
            
            // Close connection
            if (connectionRef.current?.close) {
                connectionRef.current.close();
            }
            
            // Close contexts
            inputContextRef.current?.close();
            outputContextRef.current?.close();
            
            // Stop media stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isRealtimeAvailable, getConfigureMessage]);

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-600 max-w-md w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-cyan-400">Architect Live Session</h2>
                
                <div className="h-32 flex items-center justify-center gap-2 mb-8">
                    {status === 'unavailable' ? (
                        <div className="text-slate-500 text-sm px-4">
                            <div className="text-4xl mb-4">🎙️</div>
                            <p>Real-time voice is not available.</p>
                            <p className="mt-2 text-amber-400">{errorMessage}</p>
                        </div>
                    ) : (
                        visualizerData.map((h, i) => (
                            <div 
                                key={i} 
                                className={`w-4 rounded-full transition-all duration-100 ease-in-out ${
                                    status === 'connected' ? 'bg-cyan-500' : 'bg-slate-600'
                                }`}
                                style={{ height: `${Math.max(10, Math.min(100, h))}px` }}
                            />
                        ))
                    )}
                </div>

                <div className="mb-6">
                    {status === 'connecting' && <span className="text-yellow-400 animate-pulse">Connecting to Neural Core...</span>}
                    {status === 'connected' && <span className="text-green-400">Online • Listening</span>}
                    {status === 'error' && (
                        <div>
                            <span className="text-red-400">Connection Error</span>
                            {errorMessage && <p className="text-xs text-slate-400 mt-1">{errorMessage}</p>}
                        </div>
                    )}
                    {status === 'unavailable' && <span className="text-amber-400">Feature Unavailable</span>}
                    {status === 'closed' && <span className="text-gray-400">Session Ended</span>}
                </div>

                <button 
                    onClick={onClose}
                    className="px-6 py-3 bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/50 rounded-lg transition-colors"
                >
                    {status === 'unavailable' ? 'Close' : 'End Session'}
                </button>
            </div>
        </div>
    );
};

export default LiveSession;
