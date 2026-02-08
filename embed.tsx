/**
 * Embed Widget - iframe-friendly component for external embedding
 *
 * Usage:
 * <iframe src="https://your-domain.com/embed?snapshot=abc123"></iframe>
 *
 * Query parameters:
 * - snapshot: ID of snapshot to load
 * - theme: light|dark (default: dark)
 * - controls: true|false (show toolbar, default: false)
 * - miniMap: true|false (show minimap, default: false)
 * - readonly: true|false (disable editing, default: true)
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from './stores/useDiagramStore';
import DiagramView from './components/DiagramView';
import { snapshotService } from './services/snapshotService';

interface EmbedConfig {
  snapshot?: string;
  theme: 'light' | 'dark';
  controls: boolean;
  miniMap: boolean;
  readonly: boolean;
  width?: string;
  height?: string;
}

function EmbedWidget() {
  const [config, setConfig] = useState<EmbedConfig>({
    theme: 'dark',
    controls: false,
    miniMap: false,
    readonly: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { loadDiagram, showMiniMap } = useDiagramStore();

  // Parse URL parameters
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const snapshotId = params.get('snapshot');
      const theme = (params.get('theme') as 'light' | 'dark') || 'dark';
      const controls = params.get('controls') === 'true';
      const miniMap = params.get('miniMap') === 'true';
      const readonly = params.get('readonly') !== 'false'; // default true
      const width = params.get('width') || undefined;
      const height = params.get('height') || undefined;

      const newConfig: EmbedConfig = {
        snapshot: snapshotId || undefined,
        theme,
        controls,
        miniMap,
        readonly,
        width,
        height
      };

      setConfig(newConfig);

      // Apply theme
      if (theme === 'light') {
        document.body.classList.add('light-theme');
      }

      // Load snapshot if specified
      if (snapshotId) {
        const data = snapshotService.loadSnapshot(snapshotId);
        if (data) {
          loadDiagram(data);
        } else {
          setError('Snapshot not found');
        }
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load embed configuration');
      setLoading(false);
    }
  }, [loadDiagram]);

  // Handle postMessage communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      const allowedOrigins = [
        window.location.origin,
        // Add your allowed domains here
      ];

      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      // Handle commands from parent window
      switch (event.data.type) {
        case 'getSnapshot':
          // Send current diagram data
          const diagramData = useDiagramStore.getState().getDiagram();
          event.source.postMessage({
            type: 'snapshotData',
            data: diagramData
          }, event.origin);
          break;

        case 'loadSnapshot':
          if (event.data.snapshotId) {
            const data = snapshotService.loadSnapshot(event.data.snapshotId);
            if (data) {
              loadDiagram(data);
              event.source.postMessage({
                type: 'snapshotLoaded',
                snapshotId: event.data.snapshotId
              }, event.origin);
            }
          }
          break;

        case 'fitView':
          // Trigger fit view
          event.source.postMessage({
            type: 'viewFitted'
          }, event.origin);
          break;

        case 'export':
          // Export to PNG/SVG
          event.source.postMessage({
            type: 'exportData',
            format: event.data.format,
            data: 'export-data-here'
          }, event.origin);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadDiagram]);

  // Apply dimensions
  useEffect(() => {
    if (config.width) {
      document.body.style.width = config.width;
    }
    if (config.height) {
      document.body.style.height = config.height;
    }
  }, [config.width, config.height]);

  // Notify parent that embed is ready
  useEffect(() => {
    if (!loading && !error) {
      window.parent.postMessage({
        type: 'embedReady',
        config
      }, '*');
    }
  }, [loading, error, config]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-950">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const themeClasses = config.theme === 'light'
    ? 'bg-white text-slate-900'
    : 'bg-slate-950 text-slate-100';

  return (
    <div className={`w-full h-full ${themeClasses}`}>
      <ReactFlowProvider>
        <DiagramView />
      </ReactFlowProvider>

      {config.controls && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => {
              window.parent.postMessage({ type: 'close' }, '*');
            }}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// Mount the embed widget
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<EmbedWidget />);
}

export default EmbedWidget;

/**
 * Helper function to generate embed code
 */
export function generateEmbedCode(snapshotId: string, options: Partial<EmbedConfig> = {}): string {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams();

  params.set('snapshot', snapshotId);

  if (options.theme) params.set('theme', options.theme);
  if (options.controls !== undefined) params.set('controls', options.controls.toString());
  if (options.miniMap !== undefined) params.set('miniMap', options.miniMap.toString());
  if (options.readonly !== undefined) params.set('readonly', options.readonly.toString());
  if (options.width) params.set('width', options.width);
  if (options.height) params.set('height', options.height);

  const src = `${baseUrl}/embed?${params.toString()}`;

  return `<iframe
  src="${src}"
  width="${options.width || '100%'}"
  height="${options.height || '600px'}"
  frameborder="0"
  allowfullscreen
></iframe>`;
}

/**
 * Embed script tag for easy integration
 */
export const embedScript = `
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = window.location.origin + '/embed?snapshot=' + encodeURIComponent('SNAPSHOT_ID');
  iframe.style.width = '100%';
  iframe.style.height = '600px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  document.currentScript.parentNode.insertBefore(iframe, document.currentScript);
})();
`;
