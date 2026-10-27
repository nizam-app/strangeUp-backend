import multer from "multer";
import type { RequestHandler } from "express";
import { AVATAR_MAX_BYTES } from "../profile-media/avatar.constants.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
});

export const groupContentImageUploadMiddleware: RequestHandler = upload.single("image");
