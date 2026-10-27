
const { z } = require("zod");

const safeUrl = z.string().trim().max(2048).refine(
  (value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  },
  "Enter a valid HTTP or HTTPS URL"
);

const moduleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  orderIndex: z.number().int().min(1).optional(),
});

const updateModuleSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  orderIndex: z.number().int().min(1).optional(),
});

const lectureSchema = z.object({
  title: z.string().trim().min(2).max(200),
  videoUrl: safeUrl.optional(),
  transcript: z.string().trim().max(100000).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  orderIndex: z.number().int().min(1).optional(),
  resourceUrls: z.array(safeUrl).max(20).optional(),
});

const updateLectureSchema = lectureSchema.partial();

module.exports = {
  moduleSchema,
  updateModuleSchema,
  lectureSchema,
  updateLectureSchema,
};
