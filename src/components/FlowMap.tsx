import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, Node, Link } from '../types';

interface FlowMapProps {
    data: GraphData;
}

const FlowMap: React.FC<FlowMapProps> = ({ data }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data.nodes.length) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;

        // Force Simulation
        const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
            .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        // Links
        const link = svg.append("g")
            .attr("stroke", "#475569") // slate-600
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
                    case 'entry': return "#22d3ee"; // cyan-400
                    case 'logic': return "#a78bfa"; // violet-400
                    case 'storage': return "#fbbf24"; // amber-400
                    case 'exit': return "#f87171"; // red-400
                    default: return "#94a3b8"; // slate-400
                }
            })
            .call(drag(simulation) as any);

        // Labels
        const label = svg.append("g")
            .selectAll("text")
            .data(data.nodes)
            .join("text")
            .attr("dx", 15)
            .attr("dy", 4)
            .text((d: any) => d.label)
            .attr("fill", "#e2e8f0") // slate-200
            .style("font-size", "12px")
            .style("pointer-events", "none");

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

        // Helper Drag
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

    }, [data]);

    return (
        <svg 
            ref={svgRef} 
            className="w-full h-full bg-slate-900 rounded-lg shadow-inner border border-slate-700"
        />
    );
};

export default FlowMap;
