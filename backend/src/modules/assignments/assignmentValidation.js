
const { z } = require("zod");

const httpUrlSchema = z.string().trim().max(2048).url().refine(
  (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  },
  "File URL must use HTTP or HTTPS"
);

const createAssignmentSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  instructions: z.string().trim().min(1).max(10000),
  rubric: z.record(z.string(), z.unknown()).optional(),
  dueDate: z.string().datetime({ offset: true }),
});

const submitAssignmentSchema = z.object({
  fileUrl: httpUrlSchema,
});

const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(100),
  feedback: z.string().trim().max(5000).optional(),
});

module.exports = {
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
};
