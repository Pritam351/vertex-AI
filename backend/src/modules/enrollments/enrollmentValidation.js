
const { z } = require("zod");

const progressSchema = z.object({
  watchedSeconds: z.number().int().min(0).max(86400),
  completed: z.boolean().optional(),
});

module.exports = { progressSchema };
