import { runPricingAnalysis } from "../../../../lib/pricing-intelligence";

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const { urls } = await req.json();

        if (!urls || !Array.isArray(urls)) {
            return new Response(JSON.stringify({ error: "URLs must be an array" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const createSseParser = (onEvent) => {
            let buffer = "";
            return (chunk) => {
                buffer += chunk;
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";
                for (const part of parts) {
                    const lines = part.split("\n");
                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        const payload = line.slice(6).trim();
                        if (!payload) continue;
                        try {
                            const data = JSON.parse(payload);
                            onEvent(data);
                        } catch (e) {
                            // Ignore partial JSON or heartbeat lines.
                        }
                    }
                }
            };
        };

        const enrichPricingResult = (result) => {
            if (!result || typeof result !== "object") return result;
            const tiers = Array.isArray(result.tiers) ? result.tiers : [];
            const numericPrices = tiers
                .map((tier) => tier.price)
                .filter((price) => typeof price === "number");

            return {
                ...result,
                analysis_meta: {
                    tiers_count: tiers.length,
                    has_free_tier: tiers.some((tier) => tier.price === 0),
                    price_min: numericPrices.length ? Math.min(...numericPrices) : null,
                    price_max: numericPrices.length ? Math.max(...numericPrices) : null
                }
            };
        };

        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (data) => {
                    const event = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(event));
                };

                // Notify start
                sendEvent({ type: "info", message: `Initiating parallel analysis for ${urls.length} competitors...` });

                // Run all agents in parallel
                const agentPromises = urls.map(async (url) => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 35000);
                        const startedAt = Date.now();

                        const agentStream = await runPricingAnalysis(url, { signal: controller.signal });
                        const reader = agentStream.getReader();
                        const parse = createSseParser((originalData) => {
                            if (originalData.final_result) {
                                originalData.final_result = enrichPricingResult(originalData.final_result);
                            }

                            sendEvent({
                                ...originalData,
                                competitor_url: url,
                                analysis_meta: {
                                    ...originalData.analysis_meta,
                                    duration_ms: Date.now() - startedAt
                                }
                            });
                        });

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });
                            parse(chunk);
                        }
                        clearTimeout(timeoutId);
                    } catch (err) {
                        console.error(`Error processing ${url}:`, err);
                        sendEvent({
                            type: "error",
                            competitor_url: url,
                            message: `Failed to analyze ${url}: ${err.message}`
                        });
                    }
                });

                // Wait for all agents to complete
                await Promise.all(agentPromises);

                sendEvent({ type: "done", message: "All parallel tasks completed." });
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error) {
        console.error("Pricing API error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
