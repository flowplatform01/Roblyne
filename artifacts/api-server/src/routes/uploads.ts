import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  createImageUploadUrl,
  isS3ImageStorageConfigured,
  MAX_IMAGE_BYTES,
} from "../lib/s3-image-storage";

const router: IRouter = Router();

router.post("/uploads/presign", requireAuth, async (req, res): Promise<void> => {
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
  const size = typeof req.body?.size === "number" ? req.body.size : Number(req.body?.size);

  if (!isS3ImageStorageConfigured()) {
    res.status(503).json({
      error: "Image storage is not configured. Set the S3-compatible storage environment variables before uploading images.",
    });
    return;
  }

  if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    res.status(400).json({ error: "Image size must be between 1 byte and 2MB" });
    return;
  }

  try {
    const upload = await createImageUploadUrl(contentType, size);
    res.json(upload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare image upload";
    if (message === "Unsupported image type") {
      res.status(400).json({ error: message });
      return;
    }
    req.log.error({ err: error }, "Unable to create S3 image upload URL");
    res.status(503).json({ error: "Unable to prepare image upload" });
  }
});

export default router;