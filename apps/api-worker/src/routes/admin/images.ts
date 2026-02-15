import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../../types";
import { success, error } from "../../lib/response";
import { requireAdmin } from "./helpers";
import { log } from "../../lib/observability";
import { logAuditWithContext } from "../../lib/audit";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

/**
 * GET /admin/images/download/:key
 *
 * Download an image from R2 with a watermark header.
 * The watermark embeds admin identity and timestamp into custom HTTP headers
 * and modifies the image metadata to include audit trail information.
 *
 * This prevents unauthorized redistribution by making every download traceable.
 */
app.get("/download/:key", requireAdmin, async (c) => {
  const { user } = c.get("auth");
  const key = c.req.param("key");

  if (!key) {
    return error(c, "MISSING_KEY", "Image key is required", 400);
  }

  // Fetch from R2
  const object = await c.env.R2.get(key);
  if (!object) {
    return error(c, "NOT_FOUND", "Image not found", 404);
  }

  const headers = new Headers();
  const contentType =
    object.httpMetadata?.contentType || "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set(
    "Content-Disposition",
    `attachment; filename="watermarked-${key}"`,
  );

  // Watermark metadata headers (audit trail)
  const downloadTimestamp = new Date().toISOString();
  const watermarkId = crypto.randomUUID().slice(0, 8);
  headers.set("X-Watermark-Id", watermarkId);
  headers.set("X-Downloaded-By", user.id);
  headers.set("X-Downloaded-At", downloadTimestamp);
  headers.set(
    "X-Watermark-Info",
    `SafetyWallet | ${user.name} | ${downloadTimestamp}`,
  );

  // Get image bytes
  const originalBytes = await object.arrayBuffer();

  // Embed watermark into image bytes
  // For JPEG/PNG, we append a non-visible comment/metadata section
  // containing the audit trail. This survives basic image viewers
  // but gets stripped by re-encoding.
  const watermarkText = `SafetyWallet Download | Admin: ${user.name} (${user.id}) | Time: ${downloadTimestamp} | ID: ${watermarkId}`;
  const watermarkBytes = new TextEncoder().encode(watermarkText);

  // Create watermarked image by appending audit metadata
  // For JPEG files, we inject a COM (comment) marker
  const imageBytes = new Uint8Array(originalBytes);
  let watermarkedBuffer: ArrayBuffer;

  if (isJpeg(imageBytes)) {
    watermarkedBuffer = injectJpegComment(imageBytes, watermarkBytes);
  } else {
    // For non-JPEG (PNG, etc.), append metadata as trailing bytes
    // This is a best-effort approach; proper PNG tEXt chunk injection
    // would require full PNG parsing
    const combined = new Uint8Array(
      imageBytes.length + watermarkBytes.length + 4,
    );
    combined.set(imageBytes);
    // Add a separator
    combined.set([0x00, 0x57, 0x4d, 0x3a], imageBytes.length); // NUL + "WM:"
    combined.set(watermarkBytes, imageBytes.length + 4);
    watermarkedBuffer = combined.buffer;
  }

  // Log the download for audit
  const db = drizzle(c.env.DB);
  await logAuditWithContext(c, db, "DOWNLOAD_IMAGE", user.id, "IMAGE", key, {
    watermarkId,
    downloadedAt: downloadTimestamp,
    originalSize: originalBytes.byteLength,
    watermarkedSize: watermarkedBuffer.byteLength,
  });

  log.info("Admin image download with watermark", {
    action: "image_download",
    userId: user.id,
    metadata: { key, watermarkId },
  });

  return new Response(watermarkedBuffer, { headers });
});

/**
 * GET /admin/images/list
 *
 * List recent images from R2 for admin browsing.
 */
app.get("/list", requireAdmin, async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const cursor = c.req.query("cursor") || undefined;
  const prefix = c.req.query("prefix") || undefined;

  const listed = await c.env.R2.list({
    limit,
    cursor,
    prefix,
  });

  const images = listed.objects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
    httpMetadata: obj.httpMetadata,
  }));

  return success(c, {
    images,
    truncated: listed.truncated,
    cursor: listed.truncated ? listed.cursor : undefined,
  });
});

/** Check if bytes represent a JPEG image (starts with FF D8) */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/**
 * Inject a JPEG COM (comment) marker segment containing watermark data.
 * COM marker: FF FE [length_hi] [length_lo] [data...]
 * Inserted right after the SOI marker (FF D8).
 */
function injectJpegComment(
  original: Uint8Array,
  comment: Uint8Array,
): ArrayBuffer {
  // COM marker segment: FF FE + 2-byte length (includes length bytes) + data
  const comLength = comment.length + 2;
  const comSegment = new Uint8Array(4 + comment.length);
  comSegment[0] = 0xff;
  comSegment[1] = 0xfe; // COM marker
  comSegment[2] = (comLength >> 8) & 0xff;
  comSegment[3] = comLength & 0xff;
  comSegment.set(comment, 4);

  // Insert after SOI (first 2 bytes: FF D8)
  const result = new Uint8Array(original.length + comSegment.length);
  result.set(original.slice(0, 2)); // SOI
  result.set(comSegment, 2); // COM segment
  result.set(original.slice(2), 2 + comSegment.length); // Rest of JPEG

  return result.buffer;
}

export default app;
