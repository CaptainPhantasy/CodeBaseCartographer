import React, { useState, useRef } from 'react';
import { fetchGithubTree, processFileSelect, IngestOptions } from '../services/ingestService';
import { FILE_CATEGORIES, FileCategory, DEFAULT_FILTER_OPTIONS } from '../types/fileTypes';

interface RepoIngestProps {
    isOpen: boolean;
    onClose: () => void;
    onIngest: (filePaths: string[], source: string, options?: IngestOptions) => void;
}

const RepoIngest: React.FC<RepoIngestProps> = ({ isOpen, onClose, onIngest }) => {
    const [activeTab, setActiveTab] = useState<'local' | 'github'>('local');
    const [githubUrl, setGithubUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Advanced options state
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [includeHidden, setIncludeHidden] = useState(DEFAULT_FILTER_OPTIONS.includeHidden);
    const [enabledCategories, setEnabledCategories] = useState<FileCategory[]>(
        DEFAULT_FILTER_OPTIONS.enabledCategories
    );

    if (!isOpen) return null;

    const handleLocalSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsLoading(true);
            setError(null);
            try {
                const options: IngestOptions = {
                    includeHidden,
                    fileCategories: enabledCategories
                };
                const paths = processFileSelect(e.target.files, options);
                // Artificial delay for "processing" feel
                setTimeout(() => {
                    onIngest(paths, "Local Directory", options);
                    setIsLoading(false);
                }, 800);
            } catch (err) {
                setError("Failed to process local files.");
                setIsLoading(false);
            }
        }
    };

    const handleGithubFetch = async () => {
        if (!githubUrl) return;
        setIsLoading(true);
        setError(null);
        try {
            const options: IngestOptions = {
                includeHidden,
                fileCategories: enabledCategories
            };
            const paths = await fetchGithubTree(githubUrl, options);
            onIngest(paths, githubUrl, options);
        } catch (err: any) {
            setError(err.message || "Failed to fetch GitHub repo");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCategory = (category: FileCategory) => {
        setEnabledCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                        <span>Introduce Codebase</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">✕</button>
                </div>

                <div className="p-0">
                    <div className="flex border-b border-slate-800">
                        <button 
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'local' ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('local')}
                        >
                            Local File System
                        </button>
                        <button 
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'github' ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('github')}
                        >
                            GitHub Repository
                        </button>
                    </div>

                    <div className="p-6">
                        {activeTab === 'local' ? (
                            <div className="space-y-4 text-center">
                                <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 hover:border-cyan-500/50 transition-colors bg-slate-800/30">
                                    <div className="text-4xl mb-3">📂</div>
                                    <p className="text-slate-300 mb-2">Select your project root folder</p>
                                    <p className="text-xs text-slate-500 mb-4">We'll scan the structure to map architecture. No code leaves your device.</p>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleLocalSelect}
                                        className="hidden"
                                        // @ts-ignore - directory attributes are non-standard but supported
                                        webkitdirectory=""
                                        directory=""
                                        multiple
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isLoading}
                                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
                                    >
                                        {isLoading ? 'Scanning...' : 'Browse Folder'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Repository URL</label>
                                    <input
                                        type="text"
                                        value={githubUrl}
                                        onChange={(e) => setGithubUrl(e.target.value)}
                                        placeholder="https://github.com/google/genai-js"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                    />
                                </div>
                                <div className="text-xs text-slate-500">
                                    Note: Public repositories only for this demo. Rate limits may apply.
                                </div>
                                <button
                                    onClick={handleGithubFetch}
                                    disabled={isLoading || !githubUrl}
                                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? 'Fetching Tree...' : 'Scan Repository'}
                                </button>
                            </div>
                        )}

                        {/* Advanced Options Section */}
                        <div className="mt-6 border-t border-slate-800 pt-4">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors w-full"
                            >
                                <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                                <span>Advanced Options</span>
                            </button>

                            {showAdvanced && (
                                <div className="mt-4 space-y-4 pl-6">
                                    {/* Hidden files toggle */}
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="includeHidden"
                                            checked={includeHidden}
                                            onChange={(e) => setIncludeHidden(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                                        />
                                        <label htmlFor="includeHidden" className="text-sm text-slate-300 cursor-pointer">
                                            Include hidden files (.env, .gitignore, etc.)
                                        </label>
                                    </div>

                                    {/* File type categories */}
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">File Type Categories</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.values(FILE_CATEGORIES).map(category => (
                                                <div key={category.id} className="flex items-start gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`cat-${category.id}`}
                                                        checked={enabledCategories.includes(category.id)}
                                                        onChange={() => toggleCategory(category.id)}
                                                        className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                                                    />
                                                    <label htmlFor={`cat-${category.id}`} className="text-sm text-slate-300 cursor-pointer flex-1">
                                                        <span className="block font-medium">{category.label}</span>
                                                        <span className="block text-xs text-slate-500">{category.description}</span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
                                        <span className="font-medium">Filtering:</span> {enabledCategories.length > 0
                                            ? `${enabledCategories.length} categor${enabledCategories.length === 1 ? 'y' : 'ies'} enabled`
                                            : 'No categories selected'}
                                        {includeHidden ? ' • Including hidden files' : ' • Excluding hidden files'}
                                    </div>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RepoIngest;
