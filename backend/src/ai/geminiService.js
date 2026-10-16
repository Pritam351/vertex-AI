
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from the .env file");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
];

function isTemporaryError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = Number(error?.status || error?.code);

  return (
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    message.includes("high demand") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("resource_exhausted")
  );
}

async function generateResponse(prompt) {
  let lastError;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: "low",
          },
          maxOutputTokens: 300,
        },
      });

      if (!response.text) {
        throw new Error(`Gemini ${model} returned an empty response`);
      }

      console.log(`Gemini response generated using ${model}`);
      return response.text;
    } catch (error) {
      lastError = error;

      console.error(`Gemini model ${model} failed:`, error.message);

      // Don't retry authentication, permission, or invalid-request errors.
      if (!isTemporaryError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

module.exports = { generateResponse };
