# Phase 4: Focus Mode + Search Navigation - Implementation Guide

## Overview

Phase 4 implements advanced navigation features for the CodeBase Cartographer, including focus mode, global search, keyboard shortcuts, and context menus. These features work together to provide an efficient and intuitive workflow for exploring large codebase graphs.

## Features Implemented

### 1. Focus Mode (`FocusMode.tsx`)

**Purpose:** Hides all nodes except the selected node and its direct dependencies, reducing visual clutter.

**Usage:**
```tsx
import FocusMode from './components/FocusMode';

<FocusMode
  data={graphData}
  selectedNodeId={focusedNodeId}
  onClearFocus={() => setFocusedNodeId(null)}
>
  {(filteredData) => <YourGraphComponent data={filteredData} />}
</FocusMode>
```

**Features:**
- Filters graph to show selected node + direct neighbors (incoming + outgoing connections)
- Displays focus banner with node info and clear button
- Shows count of hidden nodes
- Gracefully handles isolated nodes

**Keyboard Shortcuts:**
- `Cmd+F`: Focus on selected node
- `Cmd+Shift+F`: Clear focus

### 2. Search Indexer (`searchIndexer.ts`)

**Purpose:** Builds and maintains a searchable index over graph data for instant search results.

**Usage:**
```typescript
import { getSearchIndexer } from './utils/searchIndexer';

const indexer = getSearchIndexer();
indexer.buildIndex(graphData);

const results = indexer.search('UserAuth');
```

**Features:**
- Relevance-based scoring (exact match > prefix > contains)
- Searches node labels, types, and link labels
- Case-insensitive search
- Type-ahead autocomplete support

**Scoring:**
- Exact label match: 100 points
- Label prefix match: 50 points
- Label contains match: 25 points
- Type match bonus: +10 points
- Word boundary matches: +5 points

### 3. Search Modal (`SearchModal.tsx`)

**Purpose:** Global search interface triggered by keyboard shortcut.

**Usage:**
```tsx
import SearchModal from './components/SearchModal';

<SearchModal
  isOpen={isSearchOpen}
  onClose={() => setIsSearchOpen(false)}
  results={searchResults}
  query={searchQuery}
  onQueryChange={setSearchQuery}
  onSelectResult={handleResultSelect}
/>
```

**Features:**
- Keyboard navigation (↑↓ arrows, Enter to select, Esc to close)
- Highlighted matching text
- Result type indicators (node vs link)
- Relevance indicators (⭐ for high-scoring results)
- Auto-scroll to keep selection in view

### 4. Keyboard Shortcuts Hook (`useKeyboardShortcuts.ts`)

**Purpose:** Global keyboard shortcut management with cross-platform support.

**Usage:**
```tsx
import { useKeyboardShortcuts, getDefaultShortcuts } from './hooks/useKeyboardShortcuts';

const shortcuts = getDefaultShortcuts({
  onOpenQuickActions: () => setIsQuickActionsOpen(true),
  onFocusNode: () => setFocusedNodeId(selectedNodeId),
  onClearFocus: () => setFocusedNodeId(null),
  onCloseModals: () => closeAllModals()
});

useKeyboardShortcuts(shortcuts, true);
```

**Default Shortcuts:**
- `Cmd+K` / `Ctrl+K`: Open quick actions menu
- `Cmd+F` / `Ctrl+F`: Focus selected node
- `Cmd+Shift+F` / `Ctrl+Shift+F`: Clear focus
- `Escape`: Close all modals

**Features:**
- Cross-platform (Cmd for Mac, Ctrl for Windows/Linux)
- Ignores input in text fields (except Cmd+K)
- Prevents default browser behavior
- Easy to add custom shortcuts

### 5. Quick Actions Menu (`QuickActionsMenu.tsx`)

**Purpose:** Unified command palette for quick access to all common actions.

**Usage:**
```tsx
import QuickActionsMenu from './components/QuickActionsMenu';

<QuickActionsMenu
  isOpen={isQuickActionsOpen}
  onClose={() => setIsQuickActionsOpen(false)}
  searchResults={searchResults}
  searchQuery={searchQuery}
  onSearchQueryChange={setSearchQuery}
  onSearchResultSelect={handleResultSelect}
  onFocusNode={handleFocusNode}
  onClearFocus={handleClearFocus}
  onCreateNode={handleCreateNode}
  onAutoLayout={handleAutoLayout}
  onToggleMiniMap={handleToggleMiniMap}
  onExport={handleExport}
/>
```

**Features:**
- Dual mode: Actions list + Search
- Keyboard navigation
- Categorized actions
- Seamless search integration
- Result count display

**Default Actions:**
- Focus Selected Node
- Clear Focus
- Create New Node
- Auto Layout
- Toggle Mini Map
- Export Graph

### 6. Context Menus (`ContextMenu.tsx`)

**Purpose:** Right-click context menus for quick access to common operations.

**Usage:**
```tsx
import { useContextMenu, getNodeContextMenuItems } from './components/ContextMenu';

const { showContextMenu, ContextMenu } = useContextMenu();

// Show context menu
const handleNodeContextMenu = (event: React.MouseEvent, nodeId: string) => {
  const items = getNodeContextMenuItems(nodeId, {
    onFocus: () => setFocusedNodeId(nodeId),
    onEdit: () => editNode(nodeId),
    onDelete: () => deleteNode(nodeId),
    onDuplicate: () => duplicateNode(nodeId),
    onConnect: () => startConnection(nodeId)
  });
  showContextMenu(event.clientX, event.clientY, items);
};

// Render component
<ContextMenu />
```

**Node Context Menu Items:**
- Focus Node (Cmd+F)
- Edit
- Duplicate
- Connect To...
- Delete (Del)

**Canvas Context Menu Items:**
- Create Node
- Auto Layout
- Fit View
- Zoom In/Out
- Reset Zoom

**Features:**
- Auto-positioning to avoid screen edges
- Keyboard shortcuts display
- Separator support
- Disabled state support

## Integration Examples

### Enhanced Flow Map

```tsx
import FlowMapEnhanced from './components/FlowMapEnhanced';

<FlowMapEnhanced
  data={graphData}
  onNodeSelect={(nodeId) => setSelectedNodeId(nodeId)}
/>
```

### Enhanced Diagram View

```tsx
import DiagramViewEnhanced from './components/DiagramViewEnhanced';

<DiagramViewEnhanced />
```

### Complete Feature Wrapper

```tsx
import GraphViewWithFeatures from './components/GraphViewWithFeatures';

<GraphViewWithFeatures
  graphData={graphData}
  selectedNodeId={selectedNodeId}
  onNodeSelect={setSelectedNodeId}
  onAutoLayout={handleAutoLayout}
  onCreateNode={handleCreateNode}
>
  {({ focusedNodeId, onNodeClick, searchQuery }) => (
    <YourCustomGraphComponent
      focusedNodeId={focusedNodeId}
      onNodeClick={onNodeClick}
      searchQuery={searchQuery}
    />
  )}
</GraphViewWithFeatures>
```

## File Structure

```
src/
├── components/
│   ├── FocusMode.tsx                    # Focus mode wrapper
│   ├── SearchModal.tsx                  # Search UI modal
│   ├── QuickActionsMenu.tsx             # Command palette
│   ├── ContextMenu.tsx                  # Right-click menus
│   ├── FlowMapEnhanced.tsx              # Enhanced D3 flow map
│   ├── DiagramViewEnhanced.tsx          # Enhanced React Flow view
│   ├── GraphViewWithFeatures.tsx        # Complete integration wrapper
│   ├── FocusMode.test.tsx              # Focus mode tests
│   └── index.ts                         # Updated exports
├── hooks/
│   ├── useKeyboardShortcuts.ts          # Keyboard shortcuts hook
│   ├── useKeyboardShortcuts.test.ts    # Hook tests
│   └── index.ts                         # Updated exports
├── utils/
│   ├── searchIndexer.ts                 # Search indexing engine
│   └── searchIndexer.test.ts           # Indexer tests
```

## Testing

All components include comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test FocusMode.test.tsx

# Run with coverage
npm test -- --coverage
```

## Performance Considerations

1. **Search Indexing:** Index is rebuilt only when graph data changes, not on every search
2. **Focus Mode:** Uses `useMemo` to avoid unnecessary recalculations
3. **Keyboard Shortcuts:** Uses efficient Map-based lookup for O(1) handler resolution
4. **Context Menus:** Auto-positioning runs in `useEffect` to avoid render blocking

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES6+ support
- Keyboard shortcuts: Meta key detection for Mac vs PC

## Future Enhancements

Potential improvements for future phases:

1. **Fuzzy Search:** Implement fuzzy matching for typos
2. **Search History:** Remember recent searches
3. **Advanced Filters:** Filter by node type, date, author
4. **Saved Views:** Save and restore focus states
5. **Collaboration:** Share focus states with team members
6. **AI-Powered Search:** Semantic search using embeddings

## Troubleshooting

**Issue:** Keyboard shortcuts not working
**Solution:** Check that no input fields are focused (except Cmd+K which works everywhere)

**Issue:** Search results not appearing
**Solution:** Ensure search index is built when graph data changes

**Issue:** Context menu positioning wrong
**Solution:** Component auto-adjusts, but check for viewport transforms

**Issue:** Focus mode showing wrong nodes
**Solution:** Verify link source/target IDs match node IDs exactly

## Contributing

When adding new features:

1. Follow the existing component patterns
2. Add comprehensive tests
3. Update this documentation
4. Ensure keyboard shortcut consistency
5. Test on both Mac and Windows
