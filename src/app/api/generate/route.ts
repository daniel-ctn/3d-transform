import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { getDb } from "@/db";
import { generatedModels } from "@/db/schema";
import { hashImage } from "@/lib/hash";

const MESHY_API_KEY = () => process.env.MESHY_API_KEY!;
const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v1";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes max

// ─── Meshy helpers ───────────────────────────────────────────────────────────

async function createMeshyTask(imageUrl: string): Promise<string> {
  const res = await fetch(`${MESHY_BASE_URL}/image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MESHY_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      enable_pbr: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meshy task creation failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.result as string; // task ID
}

interface MeshyResult {
  status: string;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

async function pollMeshyTask(taskId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(`${MESHY_BASE_URL}/image-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${MESHY_API_KEY}` },
    });

    if (!res.ok) {
      throw new Error(`Meshy poll failed (${res.status}): ${await res.text()}`);
    }

    const data: MeshyResult = await res.json();

    if (data.status === "SUCCEEDED") {
      const glbUrl = data.model_urls?.glb;
      if (!glbUrl) throw new Error("Meshy succeeded but no GLB URL returned");
      return glbUrl;
    }

    if (data.status === "FAILED" || data.status === "EXPIRED") {
      throw new Error(
        `Meshy task ${data.status}: ${data.task_error?.message ?? "unknown error"}`
      );
    }

    // Still processing — wait before next poll
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("Meshy task timed out after maximum poll attempts");
}

// ─── Vercel Blob helper ──────────────────────────────────────────────────────

async function downloadAndStoreGlb(
  meshyGlbUrl: string,
  hash: string
): Promise<string> {
  const glbRes = await fetch(meshyGlbUrl);
  if (!glbRes.ok) {
    throw new Error(`Failed to download GLB from Meshy: ${glbRes.statusText}`);
  }

  const glbBuffer = await glbRes.arrayBuffer();

  const blob = await put(`models/${hash}.glb`, Buffer.from(glbBuffer), {
    access: "public",
    contentType: "model/gltf-binary",
  });

  return blob.url;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const imageInput: string | undefined = body.image;

    if (!imageInput) {
      return NextResponse.json(
        { error: "Missing `image` field (URL or Base64 data URI)" },
        { status: 400 }
      );
    }

    // 1. Hash the image content
    const imageHash = await hashImage(imageInput);

    // 2. Check cache
    const db = getDb();

    const [cached] = await db
      .select()
      .from(generatedModels)
      .where(eq(generatedModels.imageHash, imageHash))
      .limit(1);

    if (cached) {
      return NextResponse.json({
        modelUrl: cached.modelUrl,
        cached: true,
      });
    }

    // 3. Create Meshy task
    // For URL inputs, pass directly. For Base64, Meshy accepts data URIs.
    const meshyTaskId = await createMeshyTask(imageInput);

    // 4. Poll until complete
    const temporaryGlbUrl = await pollMeshyTask(meshyTaskId);

    // 5. Download GLB and upload to Vercel Blob
    const permanentUrl = await downloadAndStoreGlb(temporaryGlbUrl, imageHash);

    // 6. Save to database
    await db.insert(generatedModels).values({
      imageHash,
      meshyTaskId,
      modelUrl: permanentUrl,
    });

    return NextResponse.json({
      modelUrl: permanentUrl,
      cached: false,
    });
  } catch (err) {
    console.error("[/api/generate] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
