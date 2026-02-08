/**
 * Enhanced FlowMap - Integrates Focus Mode and Search
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { GraphData, Node, Link } from '../types';
import FocusMode from './FocusMode';
import { getSearchIndexer, SearchResultItem } from '../utils/searchIndexer';

interface FlowMapEnhancedProps {
  data: GraphData;
  onNodeSelect?: (nodeId: string | null) => void;
}

const FlowMapEnhanced: React.FC<FlowMapEnhancedProps> = ({ data, onNodeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Update search index when data changes
  useEffect(() => {
    const indexer = getSearchIndexer();
    indexer.buildIndex(data);
  }, [data]);

  // Handle focus clear
  const handleClearFocus = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  // Handle node click (for focus selection)
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setFocusedNodeId(nodeId);
    onNodeSelect?.(nodeId);
  }, [onNodeSelect]);

  // Render the D3 graph
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Force Simulation
    const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Links
    const link = svg.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", (d: any) => Math.sqrt(d.value || 1) * 2);

    // Nodes
    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", 10)
      .attr("fill", (d: Node) => {
        switch(d.type) {
          case 'entry': return "#22d3ee";
          case 'logic': return "#a78bfa";
          case 'storage': return "#fbbf24";
          case 'exit': return "#f87171";
          default: return "#94a3b8";
        }
      })
      .attr("cursor", "pointer")
      .style("opacity", (d: Node) => {
        // Dim non-focused nodes when in focus mode
        if (focusedNodeId && d.id !== focusedNodeId) {
          return 0.3;
        }
        return 1;
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        handleNodeClick(d.id);
      })
      .call(drag(simulation) as any);

    // Highlight focused node
    if (focusedNodeId) {
      node.filter((d: Node) => d.id === focusedNodeId)
        .attr("stroke", "#22d3ee")
        .attr("stroke-width", 3);
    }

    // Labels
    const label = svg.append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .attr("dx", 15)
      .attr("dy", 4)
      .text((d: any) => d.label)
      .attr("fill", "#e2e8f0")
      .style("font-size", "12px")
      .style("font-weight", (d: Node) => d.id === focusedNodeId ? "bold" : "normal")
      .style("pointer-events", "none")
      .style("opacity", (d: Node) => {
        if (focusedNodeId && d.id !== focusedNodeId) {
          return 0.3;
        }
        return 1;
      });

    // Simulation Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    // Click on background to clear focus
    svg.on("click", () => {
      setFocusedNodeId(null);
      setSelectedNodeId(null);
      onNodeSelect?.(null);
    });

    function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  }, [data, focusedNodeId, handleNodeClick, onNodeSelect]);

  const renderGraph = (filteredData: GraphData) => (
    <svg
      ref={svgRef}
      className="w-full h-full bg-slate-900 rounded-lg shadow-inner border border-slate-700"
    />
  );

  return (
    <FocusMode
      data={data}
      selectedNodeId={focusedNodeId}
      onClearFocus={handleClearFocus}
    >
      {renderGraph}
    </FocusMode>
  );
};

export default FlowMapEnhanced;
