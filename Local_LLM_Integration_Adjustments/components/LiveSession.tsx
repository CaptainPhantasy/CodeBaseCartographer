import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ModelType } from '../types';
import { CARTOGRAPHER_SYSTEM_INSTRUCTION } from '../constants';
import { base64ToUint8Array, arrayBufferToBase64 } from '../services/geminiService';

interface LiveSessionProps {
    onClose: () => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ onClose }) => {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
    const [visualizerData, setVisualizerData] = useState<number[]>([10, 20, 15, 30, 20]);
    
    // Audio Context Refs
    const inputContextRef = useRef<AudioContext | null>(null);
    const outputContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sessionRef = useRef<any>(null);

    // Animation Ref
    const animationFrameRef = useRef<number>();

    useEffect(() => {
        let mounted = true;

        const startSession = async () => {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                // Setup Audio Contexts
                inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                const sessionPromise = ai.live.connect({
                    model: ModelType.LIVE_AUDIO,
                    callbacks: {
                        onopen: () => {
                            if (!mounted) return;
                            setStatus('connected');
                            
                            // Setup Input Processing
                            if (!inputContextRef.current) return;
                            
                            const source = inputContextRef.current.createMediaStreamSource(stream);
                            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
                            
                            processor.onaudioprocess = (e) => {
                                const inputData = e.inputBuffer.getChannelData(0);
                                // Simple visualizer data update from input
                                const volume = inputData.reduce((a, b) => a + Math.abs(b), 0) / inputData.length;
                                setVisualizerData(prev => [...prev.slice(1), volume * 500].slice(-5));

                                // Convert to PCM 16 LE for Gemini
                                const l = inputData.length;
                                const int16 = new Int16Array(l);
                                for (let i = 0; i < l; i++) {
                                    int16[i] = inputData[i] * 32768;
                                }
                                const base64Data = arrayBufferToBase64(int16.buffer);
                                
                                sessionPromise.then(session => {
                                    session.sendRealtimeInput({
                                        media: {
                                            mimeType: 'audio/pcm;rate=16000',
                                            data: base64Data
                                        }
                                    });
                                });
                            };
                            
                            source.connect(processor);
                            processor.connect(inputContextRef.current.destination);
                        },
                        onmessage: async (msg: LiveServerMessage) => {
                             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                             if (audioData && outputContextRef.current) {
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
                             }
                        },
                        onclose: () => {
                            if (mounted) setStatus('closed');
                        },
                        onerror: (err) => {
                            console.error(err);
                            if (mounted) setStatus('error');
                        }
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        systemInstruction: CARTOGRAPHER_SYSTEM_INSTRUCTION,
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                        }
                    }
                });
                
                sessionRef.current = await sessionPromise;

            } catch (e) {
                console.error("Live session failed", e);
                setStatus('error');
            }
        };

        startSession();

        return () => {
            mounted = false;
            if (sessionRef.current) {
                // No direct close method exposed easily in type, usually just close contexts
                // sessionRef.current.close(); 
            }
            inputContextRef.current?.close();
            outputContextRef.current?.close();
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-600 max-w-md w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-cyan-400">Architect Live Session</h2>
                
                <div className="h-32 flex items-center justify-center gap-2 mb-8">
                    {visualizerData.map((h, i) => (
                        <div 
                            key={i} 
                            className="w-4 bg-cyan-500 rounded-full transition-all duration-100 ease-in-out"
                            style={{ height: `${Math.max(10, Math.min(100, h))}px` }}
                        />
                    ))}
                </div>

                <div className="mb-6">
                    {status === 'connecting' && <span className="text-yellow-400 animate-pulse">Connecting to Neural Core...</span>}
                    {status === 'connected' && <span className="text-green-400">Online • Listening</span>}
                    {status === 'error' && <span className="text-red-400">Connection Error</span>}
                    {status === 'closed' && <span className="text-gray-400">Session Ended</span>}
                </div>

                <button 
                    onClick={onClose}
                    className="px-6 py-3 bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/50 rounded-lg transition-colors"
                >
                    End Session
                </button>
            </div>
        </div>
    );
};

export default LiveSession;
