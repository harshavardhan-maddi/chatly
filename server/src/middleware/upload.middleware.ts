import multer from "multer";

// Files land in memory as a Buffer (not disk) since we stream straight to
// object storage. The 200MB ceiling matches the largest category (VIDEO)
// in fileValidation.ts — per-category limits are enforced after this.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});
