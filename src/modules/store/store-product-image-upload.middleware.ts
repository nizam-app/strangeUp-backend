import multer from "multer";
import type { RequestHandler } from "express";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

export const storeProductImageUploadMiddleware: RequestHandler = upload.single("image");
