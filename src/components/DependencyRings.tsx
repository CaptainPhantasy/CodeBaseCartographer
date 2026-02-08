/**
 * Dependency Rings Component
 * Visualizes dependency depth as concentric rings
 */

import React, { useMemo } from 'react';
import { useDiagramStore } from '../stores/useDiagramStore';
import {
  analyzeDependencies,
  getDepthColor,
  calculateRingPositions,
  type DependencyAnalysis
} from '../services/dependencyService';

interface DependencyRingsProps {
  enabled?: boolean;
  showLabels?: boolean;
  animated?: boolean;
  center?: { x: number; y: number };
}

export default function DependencyRings({
  enabled = true,
  showLabels = true,
  animated = true,
  center = { x: 400, y: 300 }
}: DependencyRingsProps) {
  const { nodes, edges } = useDiagramStore();

  // Analyze dependencies
  const analysis = useMemo(() => {
    return analyzeDependencies(nodes, edges);
  }, [nodes, edges]);

  // Calculate ring positions
  const ringPositions = useMemo(() => {
    return calculateRingPositions(nodes, edges, center);
  }, [nodes, edges, center]);

  // Calculate ring geometry
  const rings = useMemo(() => {
    const maxDepth = analysis.maxDepth;
    const rings = [];

    for (let depth = 0; depth <= maxDepth; depth++) {
      const radius = (depth / maxDepth) * 250 + 50;
      const nodeCount = analysis.depthDistribution[depth] || 0;

      rings.push({
        depth,
        radius,
        nodeCount,
        color: getDepthColor(depth, maxDepth)
      });
    }

    return rings;
  }, [analysis]);

  if (!enabled) return null;

  return (
    <>
      {/* SVG overlay for rings */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {/* Draw concentric rings */}
        {rings.map((ring) => (
          <g key={ring.depth}>
            <circle
              cx={center.x}
              cy={center.y}
              r={ring.radius}
              fill="none"
              stroke={ring.color}
              strokeWidth="1"
              strokeOpacity="0.3"
              strokeDasharray={ring.depth === 0 ? '' : '5,5'}
            />

            {showLabels && ring.nodeCount > 0 && (
              <text
                x={center.x + ring.radius + 5}
                y={center.y}
                fill={ring.color}
                fontSize="10"
                opacity="0.7"
                textAnchor="start"
                dominantBaseline="middle"
              >
                Depth {ring.depth} ({ring.nodeCount})
              </text>
            )}
          </g>
        ))}

        {/* Draw connections between rings */}
        {edges.map((edge) => {
          const sourcePos = ringPositions.get(edge.source);
          const targetPos = ringPositions.get(edge.target);

          if (!sourcePos || !targetPos) return null;

          return (
            <line
              key={edge.id}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke="#64748b"
              strokeWidth="1"
              opacity="0.3"
              strokeDasharray={animated ? '5,5' : undefined}
            >
              {animated && (
                <animate
                  attributeName="stroke-opacity"
                  values="0.1;0.5;0.1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              )}
            </line>
          );
        })}

        {/* Draw nodes on rings */}
        {nodes.map((node) => {
          const pos = ringPositions.get(node.id);
          if (!pos) return null;

          // Find the depth for this node
          let depth = '0';
          for (const [depthKey, ids] of Object.entries(analysis.nodesByDepth)) {
            if (ids.includes(node.id)) {
              depth = depthKey;
              break;
            }
          }
          const depthNum = parseInt(depth);

          return (
            <g key={node.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r="6"
                fill={node.data.color || '#3b82f6'}
                stroke={getDepthColor(depthNum, analysis.maxDepth)}
                strokeWidth="2"
                opacity="0.9"
              >
                {animated && (
                  <animate
                    attributeName="r"
                    values="6;8;6"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>

              {showLabels && (
                <text
                  x={pos.x}
                  y={pos.y - 10}
                  fill="#e2e8f0"
                  fontSize="9"
                  textAnchor="middle"
                  opacity="0.8"
                >
                  {node.data.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Statistics panel */}
      <DependencyStatsPanel analysis={analysis} />
    </>
  );
}

/**
 * Statistics panel for dependency analysis
 */
interface DependencyStatsPanelProps {
  analysis: DependencyAnalysis;
}

function DependencyStatsPanel({ analysis }: DependencyStatsPanelProps) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-4 shadow-lg max-w-xs">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Dependency Analysis</h3>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Max Depth:</span>
          <span className="text-slate-200">{analysis.maxDepth}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Average Depth:</span>
          <span className="text-slate-200">{analysis.averageDepth.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Total Nodes:</span>
          <span className="text-slate-200">
            {Object.values(analysis.depthDistribution).reduce((a, b) => a + b, 0)}
          </span>
        </div>

        {analysis.circularDependencies.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <div className="text-amber-400 font-medium mb-1">
              Circular Dependencies: {analysis.circularDependencies.length}
            </div>
            <div className="text-slate-400">
              Consider refactoring to remove cycles
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to access dependency analysis
 */
export function useDependencyAnalysis() {
  const { nodes, edges } = useDiagramStore();

  const analysis = useMemo(() => {
    return analyzeDependencies(nodes, edges);
  }, [nodes, edges]);

  return analysis;
}

/**
 * Component to show depth legend
 */
export function DepthLegend({ maxDepth }: { maxDepth: number }) {
  const depths = Array.from({ length: maxDepth + 1 }, (_, i) => i);

  return (
    <div className="flex flex-col gap-1">
      {depths.map((depth) => (
        <div key={depth} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getDepthColor(depth, maxDepth) }}
          />
          <span className="text-xs text-slate-300">Depth {depth}</span>
        </div>
      ))}
    </div>
  );
}
