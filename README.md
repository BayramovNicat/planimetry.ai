# Planimetry

AI-powered floor plan analyzer. Upload or paste a floor plan image and get room dimensions, areas, and an interactive layout visualization.

## Features

- Drag & drop, click, or paste (Ctrl+V) image upload
- AI extraction of rooms, dimensions, and areas via Gemini
- Interactive canvas with hover-highlighting across rooms and cards
- **Manual remeasure** — click a room (card or canvas) to select it, then draw a rectangle on the uploaded image to correct its proportions. The aspect ratio of your drawn rectangle recalculates width/height while keeping the area unchanged.
- **Draggable rooms** — drag rooms on the canvas to rearrange the layout. Rooms snap to each other's edges with visual snap guides.
- **Inline editing** — double-click a room's name or area on the card to edit it. Changing the area automatically recalculates width/height while keeping the aspect ratio.
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
