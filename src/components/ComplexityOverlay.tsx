/**
 * Complexity Overlay Component
 * Visualizes code complexity by coloring nodes
 */

import React, { useMemo } from 'react';
import { useDiagramStore } from '../stores/useDiagramStore';
import { DiagramNode } from '../types/diagram';
import {
  getComplexityColor,
  type ComplexityMetrics
} from '../services/complexityService';

interface ComplexityOverlayProps {
  enabled?: boolean;
  showMetrics?: boolean;
  onNodeClick?: (node: DiagramNode, metrics: ComplexityMetrics | null) => void;
}

export default function ComplexityOverlay({
  enabled = true,
  showMetrics = true,
  onNodeClick
}: ComplexityOverlayProps) {
  const { nodes } = useDiagramStore();

  // Calculate complexity for each node
  const nodeComplexities = useMemo(() => {
    const complexities = new Map<string, ComplexityMetrics>();

    for (const node of nodes) {
      const metrics = node.data.complexity as ComplexityMetrics | undefined;

      if (metrics) {
        complexities.set(node.id, metrics);
      } else {
        // Generate default metrics if not present
        complexities.set(node.id, {
          cyclomatic: 1,
          linesOfCode: 0,
          maintainabilityIndex: 100,
          complexity: 'low'
        });
      }
    }

    return complexities;
  }, [nodes]);

  // Calculate project statistics
  const stats = useMemo(() => {
    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0
    };

    let totalCyclomatic = 0;
    let totalLOC = 0;

    for (const metrics of nodeComplexities.values()) {
      distribution[metrics.complexity]++;
      totalCyclomatic += metrics.cyclomatic;
      totalLOC += metrics.linesOfCode;
    }

    return {
      distribution,
      averageCyclomatic: nodeComplexities.size > 0
        ? totalCyclomatic / nodeComplexities.size
        : 0,
      totalLOC
    };
  }, [nodeComplexities]);

  if (!enabled) return null;

  return (
    <>
      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Complexity Legend</h3>

        <div className="space-y-2">
          <ComplexityLegendItem
            complexity="low"
            label="Low"
            color={getComplexityColor('low')}
            count={stats.distribution.low}
          />
          <ComplexityLegendItem
            complexity="medium"
            label="Medium"
            color={getComplexityColor('medium')}
            count={stats.distribution.medium}
          />
          <ComplexityLegendItem
            complexity="high"
            label="High"
            color={getComplexityColor('high')}
            count={stats.distribution.high}
          />
          <ComplexityLegendItem
            complexity="very-high"
            label="Very High"
            color={getComplexityColor('very-high')}
            count={stats.distribution.veryHigh}
          />
        </div>

        {showMetrics && (
          <div className="mt-4 pt-3 border-t border-slate-700">
            <div className="text-xs text-slate-400 space-y-1">
              <div>Avg Cyclomatic: {stats.averageCyclomatic.toFixed(1)}</div>
              <div>Total LOC: {stats.totalLOC.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Apply overlay colors to nodes via CSS injection */}
      <style>{`
        .react-flow__node {
          transition: border-color 0.2s ease;
        }
      `}</style>
    </>
  );
}

interface ComplexityLegendItemProps {
  complexity: string;
  label: string;
  color: string;
  count: number;
}

function ComplexityLegendItem({
  label,
  color,
  count
}: ComplexityLegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-slate-300 flex-1">{label}</span>
      <span className="text-xs text-slate-500">{count}</span>
    </div>
  );
}

/**
 * Hook to apply complexity colors to nodes
 */
export function useComplexityOverlay() {
  const { nodes } = useDiagramStore();

  const coloredNodes = useMemo(() => {
    return nodes.map(node => {
      const metrics = node.data.complexity as ComplexityMetrics | undefined;

      if (!metrics) {
        return node;
      }

      const color = getComplexityColor(metrics.complexity);

      return {
        ...node,
        data: {
          ...node.data,
          color
        }
      };
    });
  }, [nodes]);

  return { coloredNodes };
}

/**
 * Component to display node complexity on hover
 */
export function NodeComplexityTooltip({ node }: { node: DiagramNode }) {
  const metrics = node.data.complexity as ComplexityMetrics | undefined;

  if (!metrics) {
    return null;
  }

  return (
    <div className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-xl">
      <div className="text-sm font-semibold text-slate-200 mb-2">
        {node.data.label}
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Cyclomatic:</span>
          <span className="text-slate-200">{metrics.cyclomatic}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Lines of Code:</span>
          <span className="text-slate-200">{metrics.linesOfCode}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Maintainability:</span>
          <span
            className="text-slate-200"
            style={{
              color: getComplexityColor(metrics.complexity)
            }}
          >
            {metrics.maintainabilityIndex}/100
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-700">
          <span className="text-slate-400">Level:</span>
          <span
            className="capitalize font-medium"
            style={{
              color: getComplexityColor(metrics.complexity)
            }}
          >
            {metrics.complexity.replace('-', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
}
