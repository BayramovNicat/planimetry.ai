# Planimetry - Product Requirements Document

## Overview

Planimetry is an AI-powered floor plan analyzer. Users upload a floor plan image, the app extracts rooms via Google Gemini vision API, and presents an interactive canvas for viewing and editing room layouts.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React
- **AI:** Google Gemini 2.5 Flash API
- **Storage:** Browser localStorage

## Core Features

### 1. Image Upload & AI Analysis

- Upload floor plan via drag-and-drop, file picker, or clipboard paste
- Send image to `/api/extract` which calls Gemini API
- AI returns: room names, areas (m²), bounding boxes (normalized 0-1000 coords)
- App computes real-world width/height from aspect ratio + area

### 2. Interactive Canvas

- HTML5 Canvas with DPI-aware rendering
- Rooms drawn as colored rectangles with labels and dimension annotations
- States: default, hovered (highlight), selected (active with resize handles)

#### Room Operations

| Operation    | Trigger                         | Behavior                                                                                   |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| **Select**   | Click room                      | Shows resize handles, enables toolbar actions                                              |
| **Deselect** | Click empty space or same room  | Clears selection                                                                           |
| **Move**     | Drag room                       | Translates room bbox, magnetic snap to other edges (8px threshold)                         |
| **Resize**   | Drag edge handle                | Adjusts width/height while preserving area                                                 |
| **Split**    | Toolbar scissors button + click | Divides room into two (H or V), areas proportional to split ratio                          |
| **Merge**    | Shift+click second room         | Combines two rooms: areas summed, shapes preserved as sub-rectangles, shared walls removed |

#### Canvas Details

- Snap lines rendered during drag/resize when edges align
- Split preview shows dashed line with predicted room dimensions
- Composite (merged) rooms preserve individual sub-rect shapes
- Shared edges between sub-rects are visually removed (only overlapping portion)
- Merged rooms cannot be resized

### 3. Room Cards

- Grid of editable cards below canvas
- Double-click name or area to inline edit
- Shows room color, name, area, and dimensions
- Hover/select synced with canvas

### 4. Image Preview & Remeasure

- Original image displayed above canvas
- When a room is selected, draw a rectangle on the image to remeasure its aspect ratio
- Recalculates width/height from new aspect ratio while keeping area

### 5. Project Management

- Multiple projects stored in localStorage
- Sidebar with project list, search, rename, delete
- Each project stores: name, image (base64), analysis result, timestamp
- Auto-analyze on load if image exists without result

### 6. Undo/Redo

- All room operations committed through history stack (max 50 entries)
- Keyboard: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- Toolbar buttons with disabled state

### 7. UI/UX

- Responsive layout with collapsible sidebar on mobile
- Full dark mode support
- Tooltips on toolbar buttons
- Loading skeleton with animated tips during AI analysis
- Escape key deselects active room

## Architecture

```
app/
  types.ts                          # Room, AnalysisResult, Project types
  constants.ts                      # Room color palette
  layout.tsx                        # Root layout with fonts
  page.tsx                          # Home page (upload)
  api/extract/route.ts              # Gemini API endpoint
  utils/dimensions.ts               # calculateDimensions()
  hooks/
    useProjects.ts                  # Project CRUD + localStorage
    useFloorPlanAnalyzer.ts         # Central state: analysis, editing, undo/redo
  components/
    ClientLayout.tsx                # ProjectsContext provider + Sidebar
    Sidebar.tsx                     # Project list navigation
    FloorPlanCanvas.tsx             # Canvas wrapper (renderer + interaction)
    ImageDropZone.tsx               # Upload UI
    ImagePreview.tsx                # Image viewer + remeasure drawing
    RoomCard.tsx                    # Editable room card
    RoomCardGrid.tsx                # Card grid layout
    Tooltip.tsx                     # Hover tooltip
    LoadingSkeleton.tsx             # Loading state
    canvas/
      canvasTypes.ts                # Canvas-specific types
      normalizeRooms.ts             # Bbox normalization by median pxPerM
      snapUtils.ts                  # Edge snapping, hit testing
      drawHelpers.ts                # All canvas draw functions
      useCanvasRenderer.ts          # Layout computation + draw orchestration
      useCanvasInteraction.ts       # DOM event -> action mapping
      useCanvasDrag.ts              # Move/resize drag state
      useCanvasSplit.ts             # Split preview + execution
```

## Data Model

```ts
interface Room {
  name: string;
  area: number; // m²
  width: number; // meters
  height: number; // meters
  bbox: [ymin, xmin, ymax, xmax]; // normalized coords
  subRects?: [ymin, xmin, ymax, xmax][]; // composite room shapes
}

interface AnalysisResult {
  total_area: number;
  rooms: Room[];
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

**Response:** `{ total_area: number, rooms: Room[] }`

- Calls Gemini 2.5 Flash with vision prompt
- 30-second timeout
- Returns computed dimensions via `calculateDimensions()`
