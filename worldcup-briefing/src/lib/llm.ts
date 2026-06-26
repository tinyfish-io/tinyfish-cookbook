import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { logger } from "@/lib/logger";

export function getModel() {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) throw new Error("OPEN_ROUTER_API_KEY is not configured");
  const llm = createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  return llm.chat(process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat");
}

export async function llmGenerateJson(
  prompt: string,
  opts?: { system?: string; temperature?: number; maxOutputTokens?: number },
): Promise<Record<string, unknown> | null> {
  try {
    const result = await generateText({
      model: getModel(),
      system: opts?.system,
      prompt,
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxOutputTokens ?? 800,
    });
    let raw = result.text.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(raw);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "llmGenerateJson failed");
    return null;
  }
}
