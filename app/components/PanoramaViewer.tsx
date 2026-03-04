"use client";

import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { fileToBase64 } from "../utils/fileToBase64";

interface PanoramaScene {
  id: string;
  name: string;
  dataUrl: string;
}

const VERTEX_SHADER = `
  attribute vec4 aPosition;
  attribute vec2 aTexCoord;
  varying vec2 vTexCoord;
  void main() {
    gl_Position = aPosition;
    vTexCoord = aTexCoord;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vTexCoord;
  uniform sampler2D uTexture;
  uniform float uYaw;
  uniform float uPitch;
  uniform float uFov;
  uniform float uAspect;

  #define PI 3.14159265359

  void main() {
    float fovRad = uFov * PI / 180.0;
    float halfFov = fovRad * 0.5;

    float x = (vTexCoord.x - 0.5) * 2.0 * tan(halfFov) * uAspect;
    float y = (vTexCoord.y - 0.5) * 2.0 * tan(halfFov);
    float z = -1.0;

    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float y2 = cp * y - sp * z;
    float z2 = sp * y + cp * z;

    float cy = cos(uYaw);
    float sy = sin(uYaw);
    float x3 = cy * x - sy * z2;
    float z3 = sy * x + cy * z2;

    float theta = atan(x3, z3);
    float phi = atan(y2, sqrt(x3 * x3 + z3 * z3));

    float u = 0.5 - theta / (2.0 * PI);
    float v = 0.5 - phi / PI;

    gl_FragColor = texture2D(uTexture, vec2(u, v));
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + info);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(program));
  }
  return program;
}

export interface PanoramaHotspot {
  id: number;
  name: string;
  /** Horizontal angle on sphere (radians) */
  yaw: number;
  /** Vertical angle on sphere (radians, negative = below horizon) */
  pitch: number;
}

interface PanoramaViewerProps {
  initialImage?: string;
  hotspots?: PanoramaHotspot[];
  onNavigate?: (id: number) => void;
}

let sceneCounter = 0;

export function PanoramaViewer({
  initialImage,
  hotspots,
  onNavigate,
}: PanoramaViewerProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const rafRef = useRef<number>(0);
  const hotspotElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const hotspotsDataRef = useRef<PanoramaHotspot[]>([]);

  const [scenes, setScenes] = useState<PanoramaScene[]>(() =>
    initialImage
      ? [{ id: String(++sceneCounter), name: "Panorama", dataUrl: initialImage }]
      : [],
  );
  const [activeScene, setActiveScene] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const fovRef = useRef(75);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const imageLoadedRef = useRef(false);

  const autoRotateRef = useRef(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const glInitedRef = useRef(false);

  // Sync hotspots prop to ref for use in render loop
  useEffect(() => {
    hotspotsDataRef.current = hotspots ?? [];
  }, [hotspots]);

  const initGL = useCallback(() => {
    if (glInitedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) return;

    glRef.current = gl;
    glInitedRef.current = true;

    const program = createProgram(gl);
    programRef.current = program;
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);

    const aTexCoord = gl.getAttribLocation(program, "aTexCoord");
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);

    const texture = gl.createTexture()!;
    textureRef.current = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([30, 30, 30, 255]),
    );
  }, []);

  const uploadTexture = useCallback((dataUrl: string) => {
    setLoading(true);
    imageLoadedRef.current = false;

    const img = new Image();
    img.onload = () => {
      const gl = glRef.current;
      const texture = textureRef.current;
      if (!gl || !texture) return;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      const isPow2 = (v: number) => (v & (v - 1)) === 0;
      if (isPow2(img.width) && isPow2(img.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      imageLoadedRef.current = true;
      setLoading(false);
    };
    img.onerror = () => setLoading(false);
    img.src = dataUrl;
  }, []);

  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !canvas || !imageLoadedRef.current) {
      rafRef.current = requestAnimationFrame(render);
      return;
    }

    if (autoRotateRef.current && !isDraggingRef.current) {
      yawRef.current += 0.002;
    }

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(canvas.clientWidth * dpr);
    const displayHeight = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.uniform1f(gl.getUniformLocation(program, "uYaw"), yawRef.current);
    gl.uniform1f(gl.getUniformLocation(program, "uPitch"), pitchRef.current);
    gl.uniform1f(gl.getUniformLocation(program, "uFov"), fovRef.current);
    gl.uniform1f(gl.getUniformLocation(program, "uAspect"), canvas.width / canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Project hotspots from sphere coords to screen positions
    const hsData = hotspotsDataRef.current;
    const hsEls = hotspotElsRef.current;
    if (hsData.length > 0) {
      const fovRad = (fovRef.current * Math.PI) / 180;
      const tanHalf = Math.tan(fovRad * 0.5);
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const cosY = Math.cos(yawRef.current);
      const sinY = Math.sin(yawRef.current);
      const cosP = Math.cos(pitchRef.current);
      const sinP = Math.sin(pitchRef.current);

      for (const hs of hsData) {
        const el = hsEls.get(hs.id);
        if (!el) continue;

        // Hotspot direction on unit sphere
        const cosPhi = Math.cos(hs.pitch);
        const wx = Math.sin(hs.yaw) * cosPhi;
        const wy = Math.sin(hs.pitch);
        const wz = Math.cos(hs.yaw) * cosPhi;

        // Inverse yaw rotation (undo camera yaw)
        const vx = cosY * wx + sinY * wz;
        const vz2 = -sinY * wx + cosY * wz;

        // Inverse pitch rotation (undo camera pitch)
        const vy = cosP * wy + sinP * vz2;
        const vz = -sinP * wy + cosP * vz2;

        // Behind camera — hide
        if (vz >= -0.01) {
          el.style.display = "none";
          continue;
        }

        // Perspective projection to normalized screen coords
        const sx = vx / -vz;
        const sy = vy / -vz;
        const u = sx / (2 * tanHalf * aspect) + 0.5;
        const v = 0.5 - sy / (2 * tanHalf);

        // Off-screen — hide
        if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) {
          el.style.display = "none";
          continue;
        }

        el.style.display = "";
        el.style.left = `${u * 100}%`;
        el.style.top = `${v * 100}%`;
      }
    }

    rafRef.current = requestAnimationFrame(render);
  }, []);

  // Init WebGL + render loop
  useEffect(() => {
    initGL();
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initGL, render]);

  // Load texture when active scene changes
  useEffect(() => {
    if (scenes.length > 0 && scenes[activeScene]) {
      yawRef.current = 0;
      pitchRef.current = 0;
      fovRef.current = 75;
      uploadTexture(scenes[activeScene].dataUrl);
    }
  }, [activeScene, scenes, uploadTexture]);

  // Add scene from file
  const addSceneFromFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await fileToBase64(file);
    const id = String(++sceneCounter);
    const name = file.name.replace(/\.[^.]+$/, "") || `Scene ${id}`;
    setScenes((prev) => {
      const next = [...prev, { id, name, dataUrl }];
      setActiveScene(next.length - 1);
      return next;
    });
  }, []);

  const deleteScene = useCallback(
    (index: number) => {
      setScenes((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (next.length === 0) {
          imageLoadedRef.current = false;
        }
        return next;
      });
      setActiveScene((prev) => {
        if (prev >= scenes.length - 1) return Math.max(0, scenes.length - 2);
        if (index < prev) return prev - 1;
        return prev;
      });
    },
    [scenes.length],
  );

  // Drop handler
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      for (const file of files) {
        addSceneFromFile(file);
      }
    },
    [addSceneFromFile],
  );

  // Pointer interaction (only when there are scenes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      if (scenes.length === 0) return;
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      const sensitivity = 0.003 * (fovRef.current / 75);
      yawRef.current -= dx * sensitivity;
      pitchRef.current += dy * sensitivity;

      const maxPitch = Math.PI / 2 - 0.01;
      pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
    };

    const onPointerUp = (e: PointerEvent) => {
      isDraggingRef.current = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    const onWheel = (e: WheelEvent) => {
      if (scenes.length === 0) return;
      e.preventDefault();
      fovRef.current += e.deltaY * 0.05;
      fovRef.current = Math.max(30, Math.min(120, fovRef.current));
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [scenes.length]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleAutoRotate = useCallback(() => {
    autoRotateRef.current = !autoRotateRef.current;
    setAutoRotate(autoRotateRef.current);
  }, []);

  const prevScene = useCallback(() => {
    setActiveScene((i) => (i - 1 + scenes.length) % scenes.length);
  }, [scenes.length]);

  const nextScene = useCallback(() => {
    setActiveScene((i) => (i + 1) % scenes.length);
  }, [scenes.length]);

  const hasScenes = scenes.length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Panorama</h3>
      </div>

      <div
        ref={containerRef}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 dark:border-zinc-700"
      >
        {/* Canvas — always mounted but hidden when empty */}
        <canvas
          ref={canvasRef}
          className={`aspect-video w-full ${hasScenes ? "cursor-grab active:cursor-grabbing" : ""} ${!hasScenes ? "hidden" : ""}`}
          style={{ touchAction: "none" }}
        />

        {/* Empty state drop zone */}
        {!hasScenes && (
          <div
            className={`flex aspect-video w-full flex-col items-center justify-center transition-colors ${
              dragOver ? "bg-zinc-800" : "bg-zinc-900"
            }`}
          >
            <ImageIcon size={32} className="mb-3 text-zinc-600" />
            <p className="text-sm text-zinc-500">Drop a panorama image here</p>
            <p className="mt-1 text-xs text-zinc-600">Equirectangular format recommended</p>
          </div>
        )}

        {/* Drag overlay when has scenes */}
        {hasScenes && dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/70">
            <p className="text-sm font-medium text-white">Drop to add scene</p>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
          </div>
        )}

        {/* 3D-projected hotspots for room navigation */}
        {hasScenes && hotspots && hotspots.length > 0 && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {hotspots.map((hs) => (
              <button
                key={hs.id}
                ref={(el) => {
                  if (el) hotspotElsRef.current.set(hs.id, el);
                  else hotspotElsRef.current.delete(hs.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.(hs.id);
                }}
                className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-1 transition-opacity hover:opacity-100"
                style={{ display: "none", opacity: 0.85 }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/80 bg-white/20 backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/40">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-white drop-shadow-md"
                  >
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                  </svg>
                </div>
                <span className="whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 shadow backdrop-blur-sm">
                  {hs.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Controls bar — only when scenes exist */}
        {hasScenes && (
          <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between bg-linear-to-t from-black/60 to-transparent px-3 py-2">
            {/* Scene navigation */}
            <div className="flex items-center gap-2">
              {scenes.length > 1 && (
                <>
                  <button
                    onClick={prevScene}
                    className="cursor-pointer rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="max-w-35 min-w-0 truncate text-xs text-white/90">
                    {scenes[activeScene]?.name}
                  </span>
                  <button
                    onClick={nextScene}
                    className="cursor-pointer rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
              {scenes.length === 1 && (
                <span className="text-xs text-white/90">{scenes[activeScene]?.name}</span>
              )}
            </div>

            {/* Scene dots */}
            {scenes.length > 1 && (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {scenes.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveScene(i)}
                    className={`h-1.5 w-1.5 cursor-pointer rounded-full transition-colors ${
                      i === activeScene ? "bg-white" : "bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Right controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => deleteScene(activeScene)}
                className="cursor-pointer rounded p-1 text-white/40 transition-colors hover:bg-white/20 hover:text-red-400"
                title="Remove scene"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={toggleAutoRotate}
                className={`cursor-pointer rounded p-1 transition-colors hover:bg-white/20 ${
                  autoRotate ? "text-white" : "text-white/40"
                }`}
                title={autoRotate ? "Stop auto-rotate" : "Auto-rotate"}
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={toggleFullscreen}
                className="cursor-pointer rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
