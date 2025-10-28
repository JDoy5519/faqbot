import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
    // When undefined locally, we'll just not call it until Day 2.
});

export async function pingAI() {
  return "ai-ok-stub";
}
