
const { z } = require("zod");

const noteSchema = z.object({
  content: z.string().trim().min(1).max(10000),
});

module.exports = { noteSchema };
