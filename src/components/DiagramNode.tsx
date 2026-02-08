/**
 * Custom node component for React Flow with inline editing
 */

import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

interface CustomNodeData {
  label: string;
  description?: string;
  type: string;
  color?: string;
  editable?: boolean;
  onLabelChange?: (id: string, label: string) => void;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  entry: '#06b6d4', // cyan
  logic: '#8b5cf6', // purple
  storage: '#10b981', // green
  exit: '#f59e0b', // amber
  external: '#6b7280', // gray
  decision: '#ef4444', // red
  process: '#3b82f6' // blue
};

const NODE_TYPE_ICONS: Record<string, string> = {
  entry: '⚡',
  logic: '⚙️',
  storage: '💾',
  exit: '🚪',
  external: '🔌',
  decision: '🔀',
  process: '⚗️'
};

export default function DiagramNode({
  data,
  selected,
  id
}: NodeProps) {
  const nodeData = data as unknown as CustomNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(nodeData.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (nodeData.editable !== false) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== nodeData.label && editValue.trim()) {
      // Trigger update through store or callback
      nodeData.onLabelChange?.(id, editValue.trim());
    } else {
      setEditValue(nodeData.label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(nodeData.label);
      setIsEditing(false);
    }
  };

  const nodeColor = nodeData.color || NODE_TYPE_COLORS[nodeData.type] || '#6b7280';
  const nodeIcon = NODE_TYPE_ICONS[nodeData.type] || '📦';

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 bg-slate-900 shadow-xl transition-all ${
        selected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''
      }`}
      style={{
        borderColor: nodeColor,
        minWidth: '150px',
        maxWidth: '250px'
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-slate-500 !border-2 !border-slate-400"
      />

      {/* Node header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg" style={{ color: nodeColor }}>
          {nodeIcon}
        </span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-slate-800 text-white text-sm font-semibold px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-cyan-500"
          />
        ) : (
          <span className="text-sm font-semibold text-slate-100 flex-1">
            {nodeData.label}
          </span>
        )}
      </div>

      {/* Node description */}
      {nodeData.description && !isEditing && (
        <div className="text-xs text-slate-400 mt-1">
          {nodeData.description}
        </div>
      )}

      {/* Type badge */}
      <div className="mt-2">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium"
          style={{
            backgroundColor: `${nodeColor}20`,
            color: nodeColor
          }}
        >
          {nodeData.type}
        </span>
      </div>

      {/* Edit hint */}
      {nodeData.editable !== false && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity text-[10px] text-slate-500 whitespace-nowrap">
          Double-click to edit
        </div>
      )}

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-slate-500 !border-2 !border-slate-400"
      />

      {/* Left handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-slate-500 !border-2 !border-slate-400"
      />

      {/* Right handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-slate-500 !border-2 !border-slate-400"
      />
    </div>
  );
}
