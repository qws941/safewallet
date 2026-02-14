import { Hono } from "hono";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { success, error } from "../lib/response";
import { processImageForPrivacy } from "../lib/image-privacy";
import { computeImageHash } from "../lib/phash";
import { log, startTimer } from "../lib/observability";
import { trackEvent } from "../middleware/analytics";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

/**
 * Upload image with automatic EXIF stripping for privacy
 *
 * POST /api/images/upload
 * Content-Type: multipart/form-data
 *
 * Body:
 *   - file: Image file (JPEG, PNG, WebP, GIF)
 *   - context: Optional context (post, profile, site)
 *
 * Returns:
 *   - fileUrl: R2 URL for the uploaded image
 *   - privacyProcessed: Whether EXIF was stripped
 *   - metadata: Privacy processing metadata
 */
app.post("/upload", async (c) => {
  const timer = startTimer();
  const { user } = c.get("auth");

  try {
    const formData = await c.req.formData();
    const rawFile = formData.get("file");
    const context = formData.get("context") as string | null;

    if (!rawFile || typeof rawFile === "string") {
      return error(c, "MISSING_FILE", "File is required", 400);
    }

    // CF Workers FormData returns File objects for file inputs;
    // TS narrows to never due to workers-types missing File in FormDataEntryValue union
    const file = rawFile as unknown as {
      name: string;
      size: number;
      type: string;
      arrayBuffer(): Promise<ArrayBuffer>;
    };

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return error(
        c,
        "FILE_TOO_LARGE",
        `File must be less than ${maxSize / (1024 * 1024)}MB`,
        400,
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return error(
        c,
        "INVALID_FILE_TYPE",
        `File type must be one of: ${allowedTypes.join(", ")}`,
        400,
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();

    // Process image for privacy (strip EXIF if JPEG)
    const { buffer: processedBuffer, metadata: privacyMetadata } =
      await processImageForPrivacy(arrayBuffer, file.name);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split("-")[0];
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${context || "upload"}/${timestamp}-${randomId}.${extension}`;

    // Upload to R2 with privacy metadata
    await c.env.R2.put(filename, processedBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        ...privacyMetadata,
        "uploaded-by": user.id,
        "uploaded-at": new Date().toISOString(),
        "original-size": String(file.size),
        "processed-size": String(processedBuffer.byteLength),
      },
    });

    // Compute perceptual hash for duplicate detection
    let imageHash: string | null = null;
    try {
      imageHash = await computeImageHash(processedBuffer);
    } catch (hashErr) {
      log.warn("Failed to compute image hash", {
        action: "phash_failed",
        userId: user.id,
        metadata: {
          filename,
          error: hashErr instanceof Error ? hashErr.message : "unknown",
        },
      });
    }

    const fileUrl = `/r2/${filename}`;

    // Track analytics
    trackEvent(c, "image_uploaded", {
      userId: user.id,
      category: context || "unknown",
      count: 1,
      value: processedBuffer.byteLength,
    });

    log.info("Image uploaded successfully", {
      action: "image_upload",
      userId: user.id,
      metadata: {
        filename,
        originalSize: file.size,
        processedSize: processedBuffer.byteLength,
        privacyProcessed: privacyMetadata["privacy-processed"],
        exifStripped: privacyMetadata["exif-stripped"],
      },
    });

    timer.end("image_upload", { userId: user.id });

    return success(c, {
      fileUrl,
      filename,
      imageHash,
      originalSize: file.size,
      processedSize: processedBuffer.byteLength,
      privacyProcessed: privacyMetadata["privacy-processed"] === "true",
      exifStripped: privacyMetadata["exif-stripped"] === "true",
      metadata: privacyMetadata,
    });
  } catch (err) {
    log.error("Image upload failed", err, {
      action: "image_upload_failed",
      userId: user.id,
    });

    timer.end("image_upload_failed", { userId: user.id });

    return error(
      c,
      "UPLOAD_FAILED",
      err instanceof Error ? err.message : "Failed to upload image",
      500,
    );
  }
});

/**
 * Retrieve image with privacy metadata
 *
 * GET /api/images/info/:filename
 *
 * Returns:
 *   - filename: Image filename
 *   - url: Public URL
 *   - metadata: Privacy processing metadata from R2
 */
app.get("/info/:filename{.+}", async (c) => {
  const { user } = c.get("auth");
  const filename = c.req.param("filename");

  try {
    const object = await c.env.R2.head(filename);

    if (!object) {
      return error(c, "NOT_FOUND", "Image not found", 404);
    }

    return success(c, {
      filename,
      url: `/r2/${filename}`,
      size: object.size,
      contentType: object.httpMetadata?.contentType,
      uploadedAt: object.customMetadata?.["uploaded-at"],
      uploadedBy: object.customMetadata?.["uploaded-by"],
      privacyProcessed: object.customMetadata?.["privacy-processed"] === "true",
      exifStripped: object.customMetadata?.["exif-stripped"] === "true",
      metadata: object.customMetadata,
    });
  } catch (err) {
    log.error("Failed to retrieve image info", err, {
      action: "image_info_failed",
      userId: user.id,
      metadata: { filename },
    });

    return error(
      c,
      "FETCH_FAILED",
      err instanceof Error ? err.message : "Failed to retrieve image info",
      500,
    );
  }
});

export default app;
