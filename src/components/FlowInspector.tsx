/**
 * FlowInspector - Live "Data Passport" panel showing data transformation at each layer
 * Displays when particles pass through architectural layers
 */

import React, { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { DiagramNodeData } from '../types/diagram';

interface Influence {
  id: string;
  description: string;
  type: 'added' | 'modified' | 'removed';
}

interface InspectorData {
  currentLayer?: string;
  file?: string;
  functionName?: string;
  line?: number;
  payload?: Record<string, unknown>;
  influences?: Influence[];
  nextHop?: string;
  latency?: number;
  timestamp?: number;
}

interface FlowInspectorProps {
  nodes: Node[];
  activeLayerId?: string;
  particleType?: 'request' | 'response' | null;
  onClose?: () => void;
}

// Generate simulated payload based on layer type
function generateSimulatedPayload(layerId: string, particleType: 'request' | 'response'): Record<string, unknown> {
  const basePayload: Record<string, unknown> = {
    timestamp: Date.now(),
    traceId: `trace-${Math.random().toString(36).substring(7)}`,
  };

  if (particleType === 'request') {
    return {
      ...basePayload,
      type: 'REQUEST',
      query: 'Analyze codebase structure',
      context: {
        path: '/Volumes/Storage/CodeBaseCartographer',
        depth: 3,
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': Math.random().toString(36).substring(7),
      },
    };
  } else {
    return {
      ...basePayload,
      type: 'RESPONSE',
      status: 'success',
      result: {
        nodes: 42,
        edges: 87,
        layers: 4,
      },
      metadata: {
        processingTime: 245,
        model: 'gemini-3-flash-preview',
      },
    };
  }
}

// Generate influences based on layer position
function generateInfluences(layerIndex: number, particleType: 'request' | 'response'): Influence[] {
  const influences: Influence[] = [];

  if (particleType === 'request') {
    // Accumulate influences as we go down
    if (layerIndex > 0) {
      influences.push({
        id: 'ctx-merge',
        description: '+ Merged user context from session',
        type: 'added',
      });
    }
    if (layerIndex > 1) {
      influences.push({
        id: 'env-load',
        description: '+ Loaded .env configuration',
        type: 'added',
      });
    }
    if (layerIndex > 2) {
      influences.push({
        id: 'auth-add',
        description: '+ Added authentication headers',
        type: 'added',
      });
    }
  } else {
    // Different influences for response
    if (layerIndex > 0) {
      influences.push({
        id: 'result-format',
        description: '+ Formatted JSON response',
        type: 'added',
      });
    }
    if (layerIndex > 1) {
      influences.push({
        id: 'cache-check',
        description: '+ Checked response cache',
        type: 'modified',
      });
    }
  }

  return influences;
}

export default function FlowInspector({
  nodes,
  activeLayerId,
  particleType,
  onClose
}: FlowInspectorProps) {
  const [inspectorData, setInspectorData] = useState<InspectorData>({});
  const [isVisible, setIsVisible] = useState(false);

  // Update inspector data when active layer changes
  useEffect(() => {
    if (!activeLayerId || !particleType) {
      setIsVisible(false);
      return;
    }

    const activeNode = nodes.find(n => n.id === activeLayerId);
    if (!activeNode) {
      setIsVisible(false);
      return;
    }

    const data = activeNode.data as DiagramNodeData;
    const layerIndex = nodes.findIndex(n => n.id === activeLayerId);

    setInspectorData({
      currentLayer: data.label,
      file: data.filePath,
      functionName: data.functionName,
      line: data.line,
      payload: generateSimulatedPayload(activeLayerId, particleType),
      influences: generateInfluences(layerIndex, particleType),
      nextHop: getNextHop(activeLayerId, nodes, particleType),
      latency: Math.floor(Math.random() * 100) + 20, // Simulated latency 20-120ms
      timestamp: Date.now(),
    });

    setIsVisible(true);
  }, [activeLayerId, particleType, nodes]);

  // Auto-hide after 3 seconds of inactivity
  useEffect(() => {
    if (!activeLayerId) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeLayerId]);

  if (!isVisible) return null;

  const { currentLayer, file, functionName, line, payload, influences, nextHop, latency } = inspectorData;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[30%] bg-slate-900/95 backdrop-blur border-l border-slate-700 shadow-2xl z-20 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <span>🔍</span> Data Passport
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Current Layer */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Current Layer</div>
          <div className="text-lg font-semibold text-slate-200">{currentLayer || 'Unknown'}</div>
          {file && (
            <div className="mt-2 text-xs font-mono text-cyan-400 truncate" title={file}>
              {file}
              {functionName && `::${functionName}()`}
              {line && `:${line}`}
            </div>
          )}
        </div>

        {/* Request/Response Payload */}
        {payload && (
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400">📦 Payload</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                (payload.type as string) === 'REQUEST'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {(payload.type as string) || 'DATA'}
              </span>
            </div>
            <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}

        {/* Influence Accumulation */}
        {influences && influences.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">▼ Influence Accumulation</div>
            <ul className="space-y-1">
              {influences.map((influence) => (
                <li
                  key={influence.id}
                  className={`text-xs flex items-start gap-2 ${
                    influence.type === 'added' ? 'text-green-400' :
                    influence.type === 'modified' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}
                >
                  <span className="flex-shrink-0">
                    {influence.type === 'added' ? '•' :
                     influence.type === 'modified' ? '◦' :
                     '−'}
                  </span>
                  <span className="break-words">{influence.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Hop & Latency */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">➡ Next Hop</div>
              <div className="text-xs font-medium text-slate-300">{nextHop || 'End of path'}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">⏱️ Latency</div>
              <div className="text-xs font-mono text-slate-300">
                {latency ? `${latency}ms` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Particle Type Indicator */}
        <div className="flex items-center justify-center gap-4 py-3 bg-slate-800/30 rounded-lg">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            particleType === 'request' ? 'bg-cyan-500/20 text-cyan-400' :
            particleType === 'response' ? 'bg-green-500/20 text-green-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            <span className={`w-3 h-3 rounded-full ${
              particleType === 'request' ? 'bg-cyan-500' :
              particleType === 'response' ? 'bg-green-500' :
              'bg-slate-500'
            }`}></span>
            <span className="text-sm font-medium">
              {particleType === 'request' ? 'Request Flow' :
               particleType === 'response' ? 'Response Flow' :
               'Idle'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to find the next hop based on particle direction
function getNextHop(
  currentLayerId: string,
  nodes: Node[],
  particleType: 'request' | 'response'
): string | undefined {
  // Simple heuristic - find node with next higher/lower index
  const currentIndex = nodes.findIndex(n => n.id === currentLayerId);

  if (particleType === 'request') {
    // Going downstream - find next layer
    return nodes[currentIndex + 1]?.data.label as string;
  } else {
    // Going upstream - find previous layer
    return nodes[currentIndex - 1]?.data.label as string;
  }
}
