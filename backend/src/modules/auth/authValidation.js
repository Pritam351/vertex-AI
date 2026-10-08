const { z } = require("zod");

const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Full name must be at least 3 characters")
    .max(100, "Full name is too long"),

  email: z
    .string()
    .trim()
    .email("Please provide a valid email address"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(
      (value) => value.trim().length > 0,
      "Password cannot contain only whitespace"
    ),
});

module.exports = {
  registerSchema,
};