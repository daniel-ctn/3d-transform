"use client";

import { useState, useRef, type FormEvent } from "react";
import { ModelViewer } from "@/components/model-viewer";

type Status = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePayload, setImagePayload] = useState<string>("");
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImagePayload(dataUrl);
      setModelUrl(null);
    };
    reader.readAsDataURL(file);
  }

  function handleUrlInput(url: string) {
    setImagePreview(url);
    setImagePayload(url);
    setModelUrl(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!imagePayload) return;

    setStatus("loading");
    setError("");
    setModelUrl(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imagePayload }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Generation failed");
      }

      setModelUrl(data.modelUrl);
      setCached(data.cached);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          2D to 3D Transform
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Upload an image and generate a 3D model
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* ── Left: Input panel ─────────────────────────────────── */}
        <section className="flex w-full flex-col gap-4 lg:w-96">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* File upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              className="flex h-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-full w-full rounded-lg object-contain p-2"
                />
              ) : (
                <p className="text-sm text-zinc-400">
                  Drop an image or click to upload
                </p>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {/* URL input */}
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              or paste a URL
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            </div>

            <input
              type="url"
              placeholder="https://example.com/image.png"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100"
              onChange={(e) => handleUrlInput(e.target.value)}
            />

            <button
              type="submit"
              disabled={!imagePayload || status === "loading"}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {status === "loading" ? "Generating..." : "Generate 3D Model"}
            </button>
          </form>

          {/* Status messages */}
          {status === "loading" && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
              Processing with Meshy API... This may take a few minutes.
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {status === "success" && cached && (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Loaded from cache — no API call needed!
            </div>
          )}
        </section>

        {/* ── Right: 3D viewer ──────────────────────────────────── */}
        <section className="flex flex-1 items-center justify-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {modelUrl ? (
            <ModelViewer src={modelUrl} />
          ) : (
            <p className="text-sm text-zinc-400">
              Your 3D model will appear here
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
