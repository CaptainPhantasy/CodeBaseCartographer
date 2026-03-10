/**
 * FlowParticles - Animated particle system for pneumatic tube visualization
 * Shows request (blue sphere) flowing downstream and response (green cube) flowing upstream
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Edge, Node } from '@xyflow/react';

interface Particle {
  id: string;
  type: 'request' | 'response';
  edgeIndex: number;       // Which edge in the flow path
  progress: number;        // 0.0 to 1.0 along the current edge
  speed: number;
  trail: Array<{x: number; y: number; alpha: number}>;
}

interface FlowPathEdge {
  edgeId: string;
  sourceId: string;
  targetId: string;
}

interface FlowParticlesProps {
  edges: Edge[];
  nodes: Node[];
  flowPathEdges?: FlowPathEdge[];  // Ordered list of edges in the main flow path
  isActive?: boolean;
  onRequestStart?: () => void;
  onProcessing?: () => void;
  onResponse?: () => void;
  onIdle?: () => void;
  onNodeEnter?: (nodeId: string, particleType: 'request' | 'response') => void;
}

// Particle configuration
const CONFIG = {
  request: {
    color: '#06b6d4',    // cyan-500
    size: 12,            // px diameter
    glowColor: 'rgba(6, 182, 212, 0.5)',
    speed: 0.003,        // Progress per frame (~3 seconds for full journey)
  },
  response: {
    color: '#22c55e',    // green-500
    size: 12,
    glowColor: 'rgba(34, 197, 94, 0.5)',
    speed: 0.003,
  },
  trail: {
    length: 8,           // Number of trail particles
    fadeSpeed: 0.05,     // How fast trail fades
  }
};

type AnimationState = 'idle' | 'requesting' | 'processing' | 'responding';

export default function FlowParticles({
  edges,
  nodes,
  flowPathEdges,
  isActive = true,
  onRequestStart,
  onProcessing,
  onResponse,
  onIdle,
  onNodeEnter
}: FlowParticlesProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [particles, setParticles] = useState<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const stateTimeoutRef = useRef<number | undefined>(undefined);
  const lastNodeRef = useRef<string | null>(null);  // Track last announced node for debouncing

  // Find all paths in ReactFlow container
  useEffect(() => {
    if (!containerRef.current) return;

    const svgContainer = containerRef.current.querySelector('.react-flow__edges');
    if (!svgContainer) return;

    // Collect all path elements by edge ID
    const pathMap = new Map<string, SVGPathElement>();
    const paths = svgContainer.querySelectorAll('path.react-flow__edge-path');

    paths.forEach((path) => {
      const edgeElement = path.closest('.react-flow__edge');
      if (edgeElement instanceof HTMLElement) {
        const edgeId = edgeElement.dataset.id;
        if (edgeId) {
          pathMap.set(edgeId, path as SVGPathElement);
        }
      }
    });

    pathRefs.current = pathMap;
  }, [edges]);

  // Animation loop - handles multi-edge traversal in both directions
  useEffect(() => {
    if (!isActive || !flowPathEdges || flowPathEdges.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      setParticles(prevParticles => {
        const updatedParticles = prevParticles.map(particle => {
          const pathEdge = flowPathEdges[particle.edgeIndex];
          if (!pathEdge) return particle;

          const path = pathRefs.current.get(pathEdge.edgeId);
          if (!path) return particle;

          // Calculate new progress
          const newProgress = particle.progress + particle.speed;

          // For response particles, we visualize progress in reverse (1-progress)
          // but track progress internally as 0→1 for simplicity
          const visualProgress = particle.type === 'response' ? (1 - newProgress) : newProgress;

          // Get current position on path
          const pathLength = path.getTotalLength();
          const point = path.getPointAtLength(visualProgress * pathLength);

          // Update trail
          const newTrail = [
            { x: point.x, y: point.y, alpha: 1.0 },
            ...particle.trail.slice(0, CONFIG.trail.length - 1).map(t => ({
              ...t,
              alpha: Math.max(0, t.alpha - CONFIG.trail.fadeSpeed)
            }))
          ];

          // Detect node entry - when crossing midpoint, notify parent
          // For request: entering target node; For response: entering source node (going backwards)
          if (newProgress >= 0.5 && particle.progress < 0.5) {
            const targetNodeId = particle.type === 'request'
              ? pathEdge.targetId
              : pathEdge.sourceId;

            // Debounce: only notify if different from last node
            if (targetNodeId !== lastNodeRef.current && onNodeEnter) {
              lastNodeRef.current = targetNodeId;
              onNodeEnter(targetNodeId, particle.type);
            }
          }

          // Check if particle reached end of current edge
          if (newProgress >= 1.0) {
            // Request goes forward (edgeIndex++), Response goes backward (edgeIndex--)
            const nextEdgeIndex = particle.type === 'request'
              ? particle.edgeIndex + 1
              : particle.edgeIndex - 1;

            // Check if there are more edges in the path
            const hasMoreEdges = particle.type === 'request'
              ? nextEdgeIndex < flowPathEdges.length
              : nextEdgeIndex >= 0;

            if (hasMoreEdges) {
              // Move to next/prev edge, reset progress
              return {
                ...particle,
                edgeIndex: nextEdgeIndex,
                progress: 0.0,
                trail: []  // Fresh trail for new edge
              };
            } else {
              // End of entire path - handle state transitions
              if (particle.type === 'request') {
                stateTimeoutRef.current = window.setTimeout(() => {
                  setAnimationState('processing');
                  if (onProcessing) onProcessing();
                }, 500);
              } else {
                stateTimeoutRef.current = window.setTimeout(() => {
                  setAnimationState('idle');
                  if (onIdle) onIdle();
                }, 100);
              }
              return { ...particle, progress: 1.0 };
            }
          }

          return {
            ...particle,
            progress: newProgress,
            trail: newTrail
          };
        });

        return updatedParticles;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (stateTimeoutRef.current) {
        clearTimeout(stateTimeoutRef.current);
      }
    };
  }, [isActive, flowPathEdges, onProcessing, onIdle, onNodeEnter]);

  // Clean up completed particles - separate from state machine to avoid infinite loop
  useEffect(() => {
    setParticles(prev => prev.filter(p => p.progress < 1.0));
  }, []);  // Run once on mount

  // State machine for particle lifecycle
  useEffect(() => {
    if (!isActive || !flowPathEdges || flowPathEdges.length === 0) return;

    // Prevent multiple particle creations for the same state transition
    if (particles.some(p => p.progress < 1.0)) {
      return;  // Don't create new particles while particles are still moving
    }

    // Idle -> Requesting: Create a request particle starting at first edge
    if (animationState === 'idle') {
      lastNodeRef.current = null;  // Reset node tracking

      const newParticle: Particle = {
        id: `request-${Date.now()}`,
        type: 'request',
        edgeIndex: 0,  // Start at first edge in path
        progress: 0.0,
        speed: CONFIG.request.speed,
        trail: []
      };
      setParticles([newParticle]);
      setAnimationState('requesting');
      if (onRequestStart) onRequestStart();
    }

    // Processing -> Responding: Create a response particle (reversed path)
    if (animationState === 'processing') {
      lastNodeRef.current = null;  // Reset node tracking

      // For response, we traverse the path in reverse
      // Start at the last edge and go backwards
      const newParticle: Particle = {
        id: `response-${Date.now()}`,
        type: 'response',
        edgeIndex: flowPathEdges.length - 1,  // Start at last edge
        progress: 0.0,
        speed: CONFIG.response.speed,
        trail: []
      };
      setParticles([newParticle]);
      setAnimationState('responding');
      if (onResponse) onResponse();
    }
  }, [animationState, isActive, flowPathEdges, onRequestStart, onResponse]);  // Removed particles dependency

  // Clean up completed particles in animation loop instead
  useEffect(() => {
    const hasCompletedParticles = particles.some(p => p.progress >= 1.0);
    if (hasCompletedParticles) {
      setParticles(prev => prev.filter(p => p.progress < 1.0));
    }
  }, [particles]);

  // Render particles
  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(particle => {
        // Get current edge from flow path
        if (!flowPathEdges || particle.edgeIndex >= flowPathEdges.length) return null;
        const pathEdge = flowPathEdges[particle.edgeIndex];
        if (!pathEdge) return null;

        const path = pathRefs.current.get(pathEdge.edgeId);
        if (!path || particle.progress >= 1.0) return null;

        // For response particles, visualize in reverse direction
        const visualProgress = particle.type === 'response'
          ? (1 - particle.progress)
          : particle.progress;

        const pathLength = path.getTotalLength();
        const point = path.getPointAtLength(visualProgress * pathLength);
        const config = particle.type === 'request' ? CONFIG.request : CONFIG.response;

        return (
          <React.Fragment key={particle.id}>
            {/* Trail particles */}
            {particle.trail.map((trailPoint, idx) => (
              <div
                key={`trail-${idx}`}
                className="absolute rounded-full"
                style={{
                  left: trailPoint.x - config.size / 2,
                  top: trailPoint.y - config.size / 2,
                  width: config.size * 0.6,
                  height: config.size * 0.6,
                  backgroundColor: config.color,
                  opacity: trailPoint.alpha * 0.5,
                  transition: 'opacity 0.1s ease-out',
                }}
              />
            ))}

            {/* Main particle */}
            <div
              className="absolute rounded-full"
              style={{
                left: point.x - config.size / 2,
                top: point.y - config.size / 2,
                width: config.size,
                height: config.size,
                backgroundColor: config.color,
                boxShadow: `0 0 12px ${config.glowColor}, 0 0 24px ${config.glowColor}`,
                animation: particle.type === 'request' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                transform: particle.type === 'response' ? 'rotate(45deg)' : 'none',
              }}
            />
          </React.Fragment>
        );
      })}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
