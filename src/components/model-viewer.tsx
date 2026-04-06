"use client";

import { useEffect } from "react";

// Register <model-viewer> custom element on the client
function useModelViewerElement() {
  useEffect(() => {
    import("@google/model-viewer");
  }, []);
}

export function ModelViewer({ src }: { src: string }) {
  useModelViewerElement();

  return (
    // @ts-expect-error — model-viewer is a custom element not typed in JSX
    <model-viewer
      src={src}
      alt="Generated 3D model"
      auto-rotate
      camera-controls
      shadow-intensity="1"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
