# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev            # Development server (next dev)
bun build          # Production build (next build)
bun start          # Start production server
bun lint           # ESLint with auto-fix
bun format         # Prettier with auto-fix
bun lint:check     # ESLint check only
bun format:check   # Prettier check only
```

**Important**: Do NOT run `bun build`, `bun lint`, `bun format`, or any lint/format/build commands automatically. Only run them when explicitly asked by the user.

Docker: `docker build -t planimetry . && docker run -p 3000:3000 -e GEMINI_API_KEY=key planimetry`

## Environment Variables

- `GEMINI_API_KEY` — required for the `/api/extract` endpoint (Google Gemini 2.5 Flash)

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind CSS v4 · Bun · HTML5 Canvas API

## Code Style

- **Formatter**: Prettier (double quotes, semicolons, 100 char width, trailing commas, `prettier-plugin-tailwindcss` for class sorting)
- **Linter**: ESLint 9 flat config with `eslint-config-next` and `eslint-plugin-simple-import-sort` (imports must be sorted alphabetically with group separation)
- **Path alias**: `@/*` maps to project root

## Architecture

**Planimetry.ai** is a floor plan analysis tool. Users upload a floor plan image, the Gemini API extracts room data, and users can interactively edit rooms on an HTML5 canvas.

### Data Flow

1. **Upload** (`app/page.tsx`): Image → `fileToBase64()` → `addProject()` → redirect to `/project/[id]`
2. **Analysis** (`app/api/extract/route.ts`): Base64 image → Gemini API → JSON room data → `normalizeRooms()`
3. **Editing** (`app/project/[id]/page.tsx`): `useFloorPlanAnalyzer` hook manages analysis state, undo/redo, and all room operations

### State Management

- **Projects**: `useSyncExternalStore` + localStorage (`"planimetry-projects"` key) provided via `ProjectsContext` in `ClientLayout.tsx`
- **Sidebar collapse**: Same pattern, separate localStorage key (`"planimetry-sidebar"`)
- **Per-project analysis state**: Local to `useFloorPlanAnalyzer` hook (not global), including undo/redo stacks (max 50)

### Canvas System (`app/components/canvas/`)

Multi-hook architecture for interactive room visualization:

- **`useCanvasRenderer`** — canvas sizing, coordinate transforms (normalized 0-1000 space → screen pixels), draw orchestration
- **`useCanvasInteraction`** — event→action mapping: delegates to `useCanvasDrag` (move/resize with snap) and `useCanvasSplit` (split preview + execution)
- **`normalizeRooms`** — scales AI bboxes (0-1000 space) to real-world dimensions using a median `pxPerM` computed from all rooms
- **`drawHelpers`** — low-level canvas drawing (fills, borders, labels, handles, snap lines)
- **`snapUtils`** — hit-testing and snap-line calculations

### Key Types (`app/types.ts`)

- `Room`: name, area (m²), width/height (meters), bbox `[ymin, xmin, ymax, xmax]` in 0-1000 normalized space, optional `subRects` for merged rooms
- `Project`: id, name, base64 image, `AnalysisResult | null`, timestamp
- `AnalysisResult`: total_area, rooms array

### Room Operations

- **Merge**: Shift+click two rooms on canvas
- **Split**: Select room → split button → click canvas for split line
- **Remeasure**: Click room → draw rectangle on image → recalculates dimensions preserving area
- **Inline edit**: Double-click room name or area on card
- **Drag/resize**: Direct canvas manipulation with snap-to-grid

### Dimension Math (`app/utils/dimensions.ts`)

`calculateDimensions(pxWidth, pxHeight, totalArea)` derives meter dimensions from pixel dimensions + known area. Used during remeasure and split to maintain area while changing proportions.
