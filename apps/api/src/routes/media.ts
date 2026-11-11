import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import { one } from "../db.js";
import { requireOrganizer } from "../middleware/auth.js";
import { badRequest, handler, HttpError, notFound } from "../middleware/errors.js";
import { getImage, MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES, mediaPathPattern, putImage, storageEnabled } from "../services/imageStorage.js";

export const mediaRouter = Router();
const uploadLimit = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
  keyGenerator: req => req.user!.id,
  message: { error: { code: "upload_limit", message: "وصلت حد رفع الصور؛ جرّب بعد ساعة" } }
});
mediaRouter.get("/organizer/media/config", requireOrganizer, (_req, res) => {
  res.json({ enabled: storageEnabled(), maxBytes: MAX_UPLOAD_BYTES });
});
mediaRouter.post("/organizer/media", requireOrganizer, uploadLimit,
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_UPLOAD_BYTES }),
  handler(async (req, res) => {
    if (!storageEnabled()) throw new HttpError(503, "storage_unavailable", "رفع الصور غير متاح حاليًا؛ تقدر تستخدم رابط صورة");
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw badRequest("اختر صورة JPEG أو PNG أو WebP");
    let bytes: Buffer;
    try {
      const input = sharp(req.body, { limitInputPixels: 16_000_000, failOn: "warning" });
      const meta = await input.metadata();
      if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format) || (meta.pages ?? 1) > 1) throw new Error("unsupported image");
      // Re-encoding strips EXIF/GPS; never store the original uploaded bytes.
      bytes = await input.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw badRequest("تعذّر قراءة الصورة؛ استخدم صورة ثابتة JPEG أو PNG أو WebP حتى 16 مليون بكسل");
    }
    if (bytes.length > MAX_IMAGE_BYTES) throw badRequest("الصورة كبيرة؛ اختر صورة أصغر");
    const key = `${req.user!.id}/${randomUUID()}.webp`;
    try { await putImage(`covers/${key}`, bytes); }
    catch { throw new HttpError(503, "storage_unavailable", "تعذّر حفظ الصورة؛ حاول مرة ثانية"); }
    res.status(201).json({ imageUrl: `/api/media/${key}` });
  })
);
mediaRouter.get("/media/:owner/:file", handler(async (req, res) => {
  const imagePath = `/api/media/${req.params.owner}/${req.params.file}`;
  const match = mediaPathPattern.exec(imagePath);
  if (!match) throw notFound();
  if (req.user?.id !== match[1]) {
    const published = await one("SELECT id FROM events WHERE image_url = $1 AND publication_status = 'published' LIMIT 1", [imagePath]);
    if (!published) throw notFound();
  }
  const bytes = await getImage(`covers/${match[1]}/${match[2]}`);
  // Recheck visibility on every request, including after unpublishing.
  res.set({ "Cache-Control": "private, no-store", "Cross-Origin-Resource-Policy": "cross-origin" });
  res.vary("Authorization").vary("Cookie").type("image/webp").send(bytes);
}));
