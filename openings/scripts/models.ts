// Probe which AI Gateway models this account can call (free-tier restrictions vary).
import { generateText } from "ai";
const models = process.argv.slice(2);
await Promise.all(models.map(async (model) => {
  const t0 = Date.now();
  try {
    const { text } = await generateText({ model, prompt: "Reply with just: ok", maxOutputTokens: 16 });
    console.log("OK  ", model, `${Date.now() - t0}ms`, JSON.stringify(text.slice(0, 20)));
  } catch (e) {
    console.log("FAIL", model, (e as Error).message.slice(0, 90));
  }
}));
