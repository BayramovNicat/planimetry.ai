# Planimetry

AI-powered floor plan analyzer. Upload or paste a floor plan image and get room dimensions, areas, and an interactive layout visualization.

## Features

- Drag & drop, click, or paste (Ctrl+V) image upload
- AI extraction of rooms, dimensions, and areas via Gemini
- Interactive canvas with hover-highlighting across rooms and cards

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
