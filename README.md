# Planimetry

AI-powered floor plan analyzer. Upload a floor plan image and get room dimensions, areas, and an interactive layout visualization — plus panoramic room views, image galleries, and side-by-side project comparison.

## Features

### Floor Plan Analysis

- Drag & drop, click, or paste (Ctrl+V) image upload
- AI extraction of rooms, dimensions, and areas via Google Gemini
- Interactive canvas with hover-highlighting across rooms and cards

### Canvas Editing

- **Draggable rooms** — drag rooms on the canvas to rearrange the layout, with magnetic edge snapping
- **Resize** — drag edge handles to resize rooms while preserving area
- **Split** — divide a room horizontally or vertically with live dimension preview
- **Merge** — Shift+click two rooms to merge them into a composite room
- **Manual remeasure** — select a room, draw a rectangle on the image to correct its proportions

### Room Cards

- **Inline editing** — double-click a room's name or area to edit. Area changes recalculate dimensions
- **Drag-to-reorder** — rearrange room cards by dragging
- **Wall area** — automatically calculated per room (assuming 3m ceiling height)

### Panorama Viewer

- **WebGL equirectangular renderer** — real-time panoramic viewing with mouse/touch drag and scroll zoom
- **Room connections** — link rooms on the canvas, then navigate between them with 3D-projected hotspots
- **Arrow key navigation** — left/right to rotate, up/down to jump to connected rooms
- **North angle calibration** — align panorama orientation with the floor plan
- **Multi-scene support** — drop multiple panoramas, navigate with carousel dots
- Fullscreen and auto-rotate

### Gallery

- Per-project image gallery with drag-and-drop / paste / file picker upload
- Full-screen lightbox with keyboard navigation
- **Panorama assignment** — drag a gallery image onto a room card to set it as the room's panorama

### Project Management

- **Multi-project sidebar** — manage multiple floor plan analyses. Each plan has its own URL (`/project/[id]`)
- **Quick actions** — `+` button below the menu toggle when sidebar is collapsed
- **Search** — search projects by name from the sidebar
- **Rename & delete** — double-click or 3-dot menu to rename, delete via context menu
- **Persistent storage** — all data saved to localStorage

### Comparison

- **Side-by-side view** — compare two projects at `/compare/[id1]/[id2]`
- Independent editing with focus-based undo/redo

### Undo/Redo

- Ctrl+Z / Ctrl+Shift+Z (up to 50 steps)
- Covers all edits: drag, resize, split, merge, rename, area, reorder, connections, panorama assignment

## Setup

```bash
bun install
```

Create a `.env` file:

```
GEMINI_API_KEY=your_key_here
```

## Development

```bash
bun dev
```

## Docker

```bash
docker build -t planimetry .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key_here planimetry
```
