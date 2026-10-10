const { z } = require("zod");

const courseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(80).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  thumbnailUrl: z.string().trim().max(2048).optional(),
  price: z.number().min(0).optional(),
});

const updateCourseSchema = courseSchema.partial();

module.exports = { courseSchema, updateCourseSchema };