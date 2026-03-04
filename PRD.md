# Planimetry - Product Requirements Document

## Overview

Planimetry is an AI-powered floor plan analyzer. Users upload a floor plan image, the app extracts rooms via Google Gemini vision API, and presents an interactive canvas for viewing and editing room layouts. It also supports panoramic room photography, image galleries, room connections, and side-by-side project comparison.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React
- **AI:** Google Gemini 2.5 Flash API
- **Storage:** Browser localStorage
- **Panorama:** WebGL equirectangular renderer

## Core Features

### 1. Image Upload & AI Analysis

- Upload floor plan via drag-and-drop, file picker, or clipboard paste
- Send image to `/api/extract` which calls Gemini API
- AI returns: room names, areas (m²), bounding boxes (normalized 0-1000 coords)
- App computes real-world width/height from aspect ratio + area
- 30-second timeout with user-friendly error messages

### 2. Interactive Canvas

- HTML5 Canvas with DPI-aware rendering
- Rooms drawn as colored rectangles with labels, dimension annotations, and wall area
- States: default, hovered (highlight), selected (active with resize handles)
- Stable color indices survive reordering

#### Room Operations

| Operation    | Trigger                           | Behavior                                                                                   |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------ |
| **Select**   | Click room                        | Shows resize handles, enables toolbar actions                                              |
| **Deselect** | Click empty space or same room    | Clears selection                                                                           |
| **Move**     | Drag room                         | Translates room bbox, magnetic snap to other edges (8px threshold)                         |
| **Resize**   | Drag edge handle                  | Adjusts width/height while preserving area                                                 |
| **Split**    | Toolbar scissors button + click   | Divides room into two (H or V), areas proportional to split ratio                          |
| **Merge**    | Shift+click second room           | Combines two rooms: areas summed, shapes preserved as sub-rectangles, shared walls removed |
| **Connect**  | Connect mode + drag between rooms | Creates a connection between two rooms (rooms must have panorama images)                   |

#### Canvas Details

- Snap lines rendered during drag/resize when edges align
- Split preview shows dashed line with predicted room dimensions
- Composite (merged) rooms preserve individual sub-rect shapes
- Shared edges between sub-rects are visually removed (only overlapping portion)
- Merged rooms cannot be resized
- Panorama rooms show a circle indicator; connections drawn as curved lines between circles

### 3. Room Cards

- Grid of editable cards below canvas
- Double-click name or area to inline edit
- Shows room color, name, area, dimensions, and wall area
- Hover/select synced with canvas
- **Drag-to-reorder** cards within the grid
- **Panorama indicator** — eye icon on rooms that have a panorama image assigned
- **Gallery drag-and-drop** — drag an image from the gallery onto a room card to assign it as the room's panorama

### 4. Panorama Viewer

- **WebGL equirectangular renderer** — real-time sphere-to-screen projection via custom vertex/fragment shaders
- **Mouse/touch interaction** — drag to pan, scroll to zoom (30°–120° FOV)
- **Keyboard navigation** — arrow left/right for smooth yaw rotation, arrow up/down to navigate to connected rooms in forward/backward 90° cone
- **Hotspot navigation** — 3D-projected hotspot buttons on connected rooms, positioned using sphere-to-screen math
- **North angle calibration** — set compass north to align panorama orientation with floor plan
- **Multi-scene support** — add multiple panorama scenes via drag-and-drop, navigate with carousel dots
- **Auto-rotate** — toggleable continuous rotation
- **Fullscreen** — native fullscreen API support
- **Optimized render loop** — cached WebGL uniform locations, direct DOM yaw display (no React re-render at 60fps)

### 5. Image Gallery

- Per-project image gallery stored in localStorage
- Add images via file picker, drag-and-drop, or clipboard paste
- Thumbnail grid with delete buttons
- **Lightbox viewer** — full-screen image viewing with keyboard navigation (arrow keys, Escape)
- **Panorama assignment** — drag a gallery image onto a room card to set it as the room's panorama
- **Paste routing** — focus-based paste target selection between floor plan and gallery

### 6. Image Preview & Remeasure

- Original image displayed above canvas
- When a room is selected, draw a rectangle on the image to remeasure its aspect ratio
- Recalculates width/height from new aspect ratio while keeping area

### 7. Project Management

- Multiple projects stored in localStorage
- Sidebar with project list, search, rename (double-click or 3-dot menu), delete
- Each project stores: name, image (base64), analysis result, timestamp
- Auto-analyze on load if image exists without result
- Quick `+` button when sidebar is collapsed

### 8. Project Comparison

- Side-by-side comparison view (`/compare/[id1]/[id2]`)
- Two independent floor plan editors with synchronized undo/redo (focus-based)
- Visual focus indicator on active side
- Accessible from sidebar context menu

### 9. Room Connections

- Toggle connect mode from toolbar (link icon)
- Drag between panorama-enabled rooms on the canvas to create connections
- Connections stored as `{ from, to }` pairs in the analysis result
- Visual preview line during connection drag with snap-to-target
- Connections drive panorama hotspot navigation

### 10. Undo/Redo

- All room operations committed through history stack (max 50 entries)
- Keyboard: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- Toolbar buttons with disabled state
- Covers: drag, resize, split, merge, rename, area change, reorder, connections, panorama assignment

### 11. UI/UX

- Responsive layout with collapsible sidebar on mobile
- Full dark mode support
- Tooltips on toolbar buttons
- Loading skeleton with animated tips during AI analysis
- Escape key deselects active room
- Auto-scroll to canvas after analysis completes
- Wall area calculation per room (assumes 3m wall height)

## Architecture

```
app/
  types.ts                          # Room, AnalysisResult, GalleryImage, Project types
  constants.ts                      # Room color palette
  layout.tsx                        # Root layout with fonts
  page.tsx                          # Home page (upload + redirect)
  api/extract/route.ts              # Gemini API endpoint
  utils/
    dimensions.ts                   # calculateDimensions() + wallArea()
    fileToBase64.ts                 # File → base64 data URL helper
  hooks/
    useProjects.ts                  # Project CRUD + localStorage
    useFloorPlanAnalyzer.ts         # Central state: analysis, editing, undo/redo
    useGallery.ts                   # Per-project gallery with useSyncExternalStore
  components/
    ClientLayout.tsx                # ProjectsContext provider + Sidebar
    Sidebar.tsx                     # Project list navigation + compare
    FloorPlanEditor.tsx             # Editor orchestrator (canvas + cards + panorama)
    FloorPlanCanvas.tsx             # Canvas wrapper (renderer + interaction)
    ImageDropZone.tsx               # Upload UI
    ImagePreview.tsx                # Image viewer + remeasure drawing
    RoomCard.tsx                    # Editable room card (memo'd)
    RoomCardGrid.tsx                # Card grid with drag-reorder + panorama drop
    PanoramaViewer.tsx              # WebGL panorama with hotspot navigation
    Gallery.tsx                     # Per-project image gallery
    GalleryLightbox.tsx             # Full-screen lightbox with keyboard nav
    Tooltip.tsx                     # Hover tooltip
    LoadingSkeleton.tsx             # Loading state with tips
    canvas/
      canvasTypes.ts                # Canvas-specific types (ScreenRect, ConnectPreview, etc.)
      normalizeRooms.ts             # Bbox normalization by median pxPerM
      snapUtils.ts                  # Edge snapping, hit testing
      drawHelpers.ts                # All canvas draw functions
      useCanvasRenderer.ts          # Layout computation + draw orchestration
      useCanvasInteraction.ts       # DOM event → action mapping
      useCanvasDrag.ts              # Move/resize drag state
      useCanvasSplit.ts             # Split preview + execution
      useCanvasConnect.ts           # Connection drag between panorama rooms
```

## Data Model

```ts
interface Room {
  name: string;
  area: number; // m²
  width: number; // meters
  height: number; // meters
  bbox: [ymin, xmin, ymax, xmax]; // normalized coords (0-1000)
  subRects?: [ymin, xmin, ymax, xmax][]; // composite room shapes (merged rooms)
  colorIndex?: number; // stable color index, survives reordering
  panoramaImage?: string; // base64 panorama assigned from gallery
  panoramaNorthAngle?: number; // north offset in radians for panorama alignment
}

interface AnalysisResult {
  total_area: number | null;
  rooms: Room[];
  connections?: Array<{ from: number; to: number }>; // room connectivity graph
}

interface GalleryImage {
  id: string;
  base64: string;
  createdAt: number;
}

interface Project {
  id: string;
  name: string;
  image: string | null; // base64 data URL
  result: AnalysisResult | null;
  createdAt: number;
}
```

## API

### POST /api/extract

**Request:** `{ image: string }` (base64 data URL)

**Response:** `{ total_area: number | null, rooms: Room[] }`

- Calls Gemini 2.5 Flash with vision prompt (temperature 0, thinking disabled)
- 30-second timeout
- Returns computed dimensions via `calculateDimensions()`

## Routes

| Route                  | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `/`                    | Home page — create new project + upload              |
| `/project/[id]`        | Project editor with canvas, cards, gallery, panorama |
| `/compare/[id1]/[id2]` | Side-by-side project comparison                      |
