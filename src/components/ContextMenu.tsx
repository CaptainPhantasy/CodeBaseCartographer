/**
 * ContextMenu - Right-click context menus for common operations
 */

import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action?: () => void;
  disabled?: boolean;
  shortcut?: string;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * ContextMenu Component
 *
 * Right-click context menu for quick access to common operations
 * Auto-positions to avoid screen edges
 */
const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Adjust position to avoid screen edges
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // Check right edge
    if (x + rect.width > viewportWidth - 10) {
      adjustedX = x - rect.width;
    }

    // Check bottom edge
    if (y + rect.height > viewportHeight - 10) {
      adjustedY = y - rect.height;
    }

    // Ensure minimum margins
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    setPosition({ x: adjustedX, y: adjustedY });
  }, [x, y]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle item click
  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled && item.action) {
      item.action();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-slate-900 rounded-lg shadow-2xl border border-slate-700 py-1"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${idx}`}
              className="my-1 border-t border-slate-700"
            />
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-left transition-colors ${
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-slate-800 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {item.icon && <span className="text-sm">{item.icon}</span>}
              <span className="text-sm">{item.label}</span>
            </div>
            {item.shortcut && (
              <kbd className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {item.shortcut}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Hook to manage context menu state
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const showContextMenu = (x: number, y: number, items: ContextMenuItem[]) => {
    setContextMenu({ x, y, items });
  };

  const hideContextMenu = () => {
    setContextMenu(null);
  };

  const ContextMenuWrapper = () => {
    if (!contextMenu) return null;

    return (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.items}
        onClose={hideContextMenu}
      />
    );
  };

  return {
    showContextMenu,
    hideContextMenu,
    ContextMenu: ContextMenuWrapper
  };
}

/**
 * Default context menu items for nodes
 */
export function getNodeContextMenuItems(nodeId: string, handlers: {
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onConnect: () => void;
}): ContextMenuItem[] {
  return [
    {
      id: 'focus',
      label: 'Focus Node',
      icon: '🎯',
      action: handlers.onFocus,
      shortcut: 'Cmd+F'
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: '✏️',
      action: handlers.onEdit
    },
    {
      id: 'separator-1',
      label: '',
      separator: true
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: '📋',
      action: handlers.onDuplicate
    },
    {
      id: 'connect',
      label: 'Connect To...',
      icon: '🔗',
      action: handlers.onConnect
    },
    {
      id: 'separator-2',
      label: '',
      separator: true
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: '🗑️',
      action: handlers.onDelete,
      shortcut: 'Del'
    }
  ];
}

/**
 * Default context menu items for the canvas
 */
export function getCanvasContextMenuItems(handlers: {
  onCreateNode: () => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}): ContextMenuItem[] {
  return [
    {
      id: 'create-node',
      label: 'Create Node',
      icon: '➕',
      action: handlers.onCreateNode
    },
    {
      id: 'separator-1',
      label: '',
      separator: true
    },
    {
      id: 'auto-layout',
      label: 'Auto Layout',
      icon: '📐',
      action: handlers.onAutoLayout
    },
    {
      id: 'fit-view',
      label: 'Fit View',
      icon: '🔍',
      action: handlers.onFitView
    },
    {
      id: 'separator-2',
      label: '',
      separator: true
    },
    {
      id: 'zoom-in',
      label: 'Zoom In',
      icon: '➕',
      action: handlers.onZoomIn,
      shortcut: 'Cmd++'
    },
    {
      id: 'zoom-out',
      label: 'Zoom Out',
      icon: '➖',
      action: handlers.onZoomOut,
      shortcut: 'Cmd+-'
    },
    {
      id: 'reset-zoom',
      label: 'Reset Zoom',
      icon: '🎯',
      action: handlers.onResetZoom,
      shortcut: 'Cmd+0'
    }
  ];
}

export default ContextMenu;
