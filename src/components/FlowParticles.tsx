/**
 * FlowParticles - Animated particle system for pneumatic tube visualization
 * Shows request (blue sphere) flowing downstream and response (green cube) flowing upstream
 */

import React, { useEffect, useRef, useState } from 'react';
import { Edge } from '@xyflow/react';

interface Particle {
  id: string;
  type: 'request' | 'response';
  edgeId: string;
  progress: number;       // 0.0 to 1.0 along the path
  speed: number;          // Movement speed
  element?: HTMLElement;   // DOM element for rendering
  trail: Array<{x: number; y: number; alpha: number}>;  // Trail positions
}

interface FlowParticlesProps {
  edges: Edge[];
  isActive?: boolean;     // Whether animation should run
  onRequestStart?: () => void;
  onProcessing?: () => void;
  onResponse?: () => void;
  onIdle?: () => void;
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
  isActive = true,
  onRequestStart,
  onProcessing,
  onResponse,
  onIdle
}: FlowParticlesProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [particles, setParticles] = useState<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const stateTimeoutRef = useRef<number | undefined>(undefined);

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

  // Animation loop
  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = (timestamp: number) => {
      setParticles(prevParticles => {
        // Update existing particles
        const updatedParticles = prevParticles.map(particle => {
          const path = pathRefs.current.get(particle.edgeId);

          if (!path) {
            return particle; // Path not found, keep particle as-is
          }

          // Calculate new progress
          let newProgress = particle.progress + particle.speed;

          // Get current position on path
          const pathLength = path.getTotalLength();
          const point = path.getPointAtLength(newProgress * pathLength);

          // Update trail
          const newTrail = [
            { x: point.x, y: point.y, alpha: 1.0 },
            ...particle.trail.slice(0, CONFIG.trail.length - 1).map(t => ({
              ...t,
              alpha: Math.max(0, t.alpha - CONFIG.trail.fadeSpeed)
            }))
          ];

          const updatedParticle = {
            ...particle,
            progress: newProgress,
            trail: newTrail
          };

          // Check if particle reached end
          if (newProgress >= 1.0) {
            // Handle state transitions
            if (particle.type === 'request') {
              // Request finished - switch to processing state
              stateTimeoutRef.current = window.setTimeout(() => {
                setAnimationState('processing');
                if (onProcessing) onProcessing();
              }, 500); // 0.5s pause at endpoint
            } else {
              // Response finished - back to idle
              stateTimeoutRef.current = window.setTimeout(() => {
                setAnimationState('idle');
                if (onIdle) onIdle();
              }, 100);
            }

            return { ...updatedParticle, progress: 1.0 };
          }

          return updatedParticle;
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
  }, [isActive, onRequestStart, onProcessing, onResponse, onIdle]);

  // Clean up completed particles - separate from state machine to avoid infinite loop
  useEffect(() => {
    setParticles(prev => prev.filter(p => p.progress < 1.0));
  }, []);  // Run once on mount

  // State machine for particle lifecycle
  useEffect(() => {
    if (!isActive) return;

    // Prevent multiple particle creations for the same state transition
    if (particles.some(p => p.progress < 1.0)) {
      return;  // Don't create new particles while particles are still moving
    }

    // Idle -> Requesting: Create a request particle
    if (animationState === 'idle') {
      // Find first edge
      const targetEdge = edges[0];

      if (targetEdge) {
        const newParticle: Particle = {
          id: `request-${Date.now()}`,
          type: 'request',
          edgeId: targetEdge.id,
          progress: 0.0,
          speed: CONFIG.request.speed,
          trail: []
        };
        setParticles([newParticle]);
        setAnimationState('requesting');
        if (onRequestStart) onRequestStart();
      }
    }

    // Processing -> Responding: Create a response particle
    if (animationState === 'processing') {
      // Use first edge for response (reverse flow simulation)
      const targetEdge = edges[0];

      if (targetEdge) {
        const newParticle: Particle = {
          id: `response-${Date.now()}`,
          type: 'response',
          edgeId: targetEdge.id,
          progress: 0.0,
          speed: CONFIG.response.speed,
          trail: []
        };
        setParticles([newParticle]);
        setAnimationState('responding');
        if (onResponse) onResponse();
      }
    }
  }, [animationState, isActive, edges, onRequestStart, onProcessing, onResponse]);  // Removed particles dependency

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
        const path = pathRefs.current.get(particle.edgeId);
        if (!path || particle.progress >= 1.0) return null;

        const pathLength = path.getTotalLength();
        const point = path.getPointAtLength(particle.progress * pathLength);
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
