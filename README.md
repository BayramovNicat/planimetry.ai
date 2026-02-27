# Planimetry

AI-powered floor plan analyzer. Upload or paste a floor plan image and get room dimensions, areas, and an interactive layout visualization.

## Features

- **Multi-project sidebar** — manage multiple floor plan analyses from a collapsible sidebar. Each plan has its own URL (`/project/[id]`). Toggle the sidebar open/closed like Gemini.
- **New plan on upload** — click "+ New plan" or visit `/` to get a fresh drop zone. A project is created in the sidebar only when you upload an image.
- **Project management** — rename projects (double-click or 3-dot menu), delete via the context menu. Data persists across sessions in localStorage.
- Drag & drop, click, or paste (Ctrl+V) image upload
- AI extraction of rooms, dimensions, and areas via Gemini
- Interactive canvas with hover-highlighting across rooms and cards
- **Manual remeasure** — click a room (card or canvas) to select it, then draw a rectangle on the uploaded image to correct its proportions. The aspect ratio of your drawn rectangle recalculates width/height while keeping the area unchanged.
- **Draggable rooms** — drag rooms on the canvas to rearrange the layout. Rooms snap to each other's edges with visual snap guides.
- **Inline editing** — double-click a room's name or area on the card to edit it. Changing the area automatically recalculates width/height while keeping the aspect ratio.
- **Undo/redo** — Ctrl+Z to undo, Ctrl+Shift+Z to redo (up to 50 steps). Also available as buttons next to the total area. Covers all edits: drag, remeasure, name/area changes.
- **Persistent storage** — all projects, images, and room data are saved to localStorage. Refresh or come back later and pick up where you left off. Old single-session data is auto-migrated.
- Press **Escape** to deselect the active room

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
