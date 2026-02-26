"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalysisResult } from "../types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useFloorPlanAnalyzer() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImage = useCallback(async (base64: string) => {
    setImage(base64);
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "TimeoutError"
          ? "Analysis timed out — the AI took too long. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const base64 = await fileToBase64(file);
      handleImage(base64);
    },
    [handleImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  const reset = useCallback(() => {
    setImage(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setHoveredRoom(null);
  }, []);

  return {
    image,
    loading,
    result,
    error,
    hoveredRoom,
    setHoveredRoom,
    handleFile,
    handleDrop,
    reset,
    fileInputRef,
  };
}
