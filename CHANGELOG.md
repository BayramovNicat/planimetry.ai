# Changelog

## Unreleased

### Added

- **Room splitting** - Select a room, click the scissors toolbar button, then click to split horizontally or vertically. Preview line shows predicted dimensions for both resulting rooms. Snaps to nearby edges. Enforces 5%-95% min/max ratio.
- **Room merging** - Select a room, then Shift+click another room to merge them. Areas are summed. Individual rectangle shapes are preserved as sub-rectangles (composite rooms). Shared internal walls between sub-rects are visually removed (only the overlapping portion).
- **Split/merge toolbar** - Scissors button appears when a room is selected. Hint text shows "Click to split" or "Shift+click to merge" based on mode.
- **Composite room rendering** - Merged rooms draw each sub-rectangle individually with proper fill, borders, and labels. Shared edges between sibling sub-rects are detected and only the overlapping segment is hidden.
- **Sub-rect aware snapping** - Snap-to-edge logic uses individual sub-rect edges (not just union bbox) for accurate magnetic snapping.
- **Canvas module architecture** - Refactored monolithic canvas code into focused modules:
  - `canvasTypes.ts` - Shared type definitions
  - `normalizeRooms.ts` - Bbox normalization
  - `snapUtils.ts` - Snapping, hit-testing, edge collection
  - `drawHelpers.ts` - All drawing functions
  - `useCanvasRenderer.ts` - Layout + draw orchestration
  - `useCanvasInteraction.ts` - Event handling
  - `useCanvasDrag.ts` - Move/resize drag state
  - `useCanvasSplit.ts` - Split preview + execution

### Fixed

- Snap lines now correctly align to sub-rect edges for composite rooms
- Shared wall removal only hides the overlapping portion of edges (not entire wall)
- Composite edge drawing handles multiple overlapping siblings correctly (3+ merged rects)
- Move drag correctly translates all sub-rects together
- Split preview dimensions account for edge snapping
- Room fill colors during drag/active/highlight states now apply correctly (regex-based alpha replacement instead of broken string match)
- Composite rooms no longer show phantom resize cursor on hover (handles are disabled for merged rooms)
- `handleMouseUp` no longer computes mouse position and hit-tests redundantly (3x → 1x)
- Merge now uses normalized (display) coordinates for sub-rects instead of raw stored coordinates, fixing rooms jumping position and appearing disconnected after merge
- Composite rooms skip re-normalization since their sub-rects are already in normalized space

### Changed

- Extracted `fileToBase64` to shared `utils/fileToBase64.ts` (was duplicated in `page.tsx` and `useFloorPlanAnalyzer.ts`)
- Removed unnecessary `Room` re-export from `canvasTypes.ts`; canvas modules now import `Room` directly from `types.ts`
- Replaced `null as any` type hack for `handleImageRef` with proper nullable type

## v0.1.0

### Added

- AI-powered floor plan analysis via Google Gemini 2.5 Flash
- Interactive HTML5 Canvas with room visualization
- Room selection, hover highlighting, and color coding
- Drag-to-move rooms with magnetic edge snapping (8px threshold)
- Edge-drag room resizing with area preservation
- Room cards with inline editing (name, area)
- Image remeasure by drawing rectangle on original image
- Undo/redo history (max 50 entries, Ctrl+Z / Ctrl+Shift+Z)
- Multi-project management with localStorage persistence
- Sidebar navigation with search, rename, delete
- Image upload via drag-and-drop, file picker, clipboard paste
- Dark mode support
- Responsive layout with collapsible sidebar
- Loading skeleton with animated tips
- Keyboard shortcuts (Escape to deselect)
