import React, { useState } from 'react';
import { getLLMService } from '../services/llmService';
import { useFeatureAvailability } from '../hooks/useFeatureAvailability';
import { sanitizeError } from '../utils/errorSanitizer';

const AssetGenerator: React.FC = () => {
    const { isVideoAvailable, getConfigureMessage } = useFeatureAvailability();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleGenerate = async () => {
        if (!prompt && !file) return;
        if (!isVideoAvailable) {
            setError(getConfigureMessage('isVideoAvailable') || 'Video generation not available');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            let base64Image: string | undefined = undefined;
            let mimeType = 'image/png';
            
            if (file) {
                base64Image = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                    reader.readAsDataURL(file);
                });
                mimeType = file.type;
            }

            const llmService = getLLMService();
            const result = await llmService.generateVideo(
                prompt || "Animate this architecture diagram showing data flow.",
                {
                    imageBase64: base64Image,
                    imageMimeType: mimeType,
                    resolution: '720p',
                    aspectRatio: '16:9'
                }
            );
            
            setVideoUrl(result.videoUrl);
        } catch (err: unknown) {
            const sanitizedError = sanitizeError(err);
            console.error('Video generation failed:', sanitizedError);
            setError(sanitizedError || 'Failed to generate video');
        } finally {
            setLoading(false);
        }
    };

    // Show unavailable state
    if (!isVideoAvailable) {
        return (
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700 h-full overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4 text-cyan-400">Documentation Asset Studio</h2>
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="text-6xl mb-4 opacity-50">🎬</div>
                    <h3 className="text-xl font-semibold text-slate-300 mb-2">Video Generation Unavailable</h3>
                    <p className="text-slate-400 max-w-md mb-4">
                        {getConfigureMessage('isVideoAvailable')}
                    </p>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 max-w-md">
                        <p className="text-sm text-slate-500">
                            Video generation requires Google AI (Gemini) with Veo access. 
                            Go to Settings to add your Google AI API key.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400">Documentation Asset Studio</h2>
            <p className="text-slate-400 mb-6">Create animated walkthroughs from your architecture diagrams or prompts using Veo.</p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Source Image (Optional)</label>
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-cyan-500/10 file:text-cyan-400
                        hover:file:bg-cyan-500/20"
                    />
                    {file && (
                        <p className="mt-1 text-xs text-slate-500">Selected: {file.name}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Prompt</label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the animation... e.g., 'A neon hologram of a data flow pulsing through the nodes'"
                        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <button 
                    onClick={handleGenerate}
                    disabled={loading || (!prompt && !file)}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg font-bold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? 'Generating Video (this may take a minute)...' : 'Generate Video Asset'}
                </button>

                {videoUrl && (
                    <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-2 text-slate-200">Generated Asset</h3>
                        <video src={videoUrl} controls className="w-full rounded-lg border border-slate-700" />
                        <a 
                            href={videoUrl} 
                            download="asset.mp4" 
                            className="block text-center mt-2 text-cyan-400 hover:underline"
                        >
                            Download MP4
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetGenerator;
