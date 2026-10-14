
const { z } = require("zod");

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");

const createQuizSchema = z.object({
  courseId: objectIdSchema,
  title: z.string().trim().min(3).max(200),
  instructions: z.string().trim().max(5000).optional(),
  questions: z.array(
    z.object({
      text: z.string().trim().min(1).max(5000),
      type: z.enum(["mcq", "multi_select", "short_answer"]),
      options: z.array(
        z.object({
          text: z.string().trim().min(1).max(1000),
          isCorrect: z.boolean().optional(),
        })
      ).optional(),
      correctAnswer: z.string().trim().max(5000).optional(),
      points: z.number().int().min(1).default(1),
      orderIndex: z.number().int().min(0).optional(),
    })
  ).min(1),
  passingScore: z.number().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).max(300).optional(),
});

const submitAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: objectIdSchema,
      selectedOptionIds: z.array(objectIdSchema).optional(),
      textAnswer: z.string().trim().max(5000).optional(),
    })
  ),
});

module.exports = { createQuizSchema, submitAttemptSchema };
