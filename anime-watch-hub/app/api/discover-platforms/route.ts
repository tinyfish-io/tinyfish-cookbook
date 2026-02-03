import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

async function callGeminiWithRetry(
  prompt: string,
  apiKey: string,
  maxRetries: number = 3
) {
  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          return await response.json();
        }

        const errorBody = await response.text();

        // If rate limited, check if we should retry or try next model
        if (response.status === 429) {
          const retryMatch = errorBody.match(/retry in (\d+)/i);
          const retryDelay = retryMatch ? parseInt(retryMatch[1]) * 1000 : 5000;

          // If retry delay is short, wait and retry same model
          if (retryDelay <= 15000 && attempt < maxRetries - 1) {
            console.log(
              `Rate limited on ${model}, waiting ${retryDelay}ms before retry ${attempt + 1}`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
          // Otherwise try next model
          console.log(`Rate limited on ${model}, trying next model...`);
          break;
        }

        lastError = new Error(`API error ${response.status}: ${errorBody}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Network error, wait and retry
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1))
        );
      }
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

export async function POST(request: NextRequest) {
  try {
    const { animeTitle } = await request.json();

    if (!animeTitle) {
      return NextResponse.json(
        { error: "Anime title is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const prompt = `You are an expert at finding where anime is legally available to stream.

For the anime titled "${animeTitle}", provide a JSON array of streaming platform URLs where this specific anime might be available.

Focus on these major platforms:
- Crunchyroll (crunchyroll.com)
- Netflix (netflix.com)
- Amazon Prime Video (amazon.com/Prime-Video)
- Hulu (hulu.com)
- Funimation (funimation.com)
- HIDIVE (hidive.com)
- Disney+ (disneyplus.com)
- Max/HBO Max (max.com)

For each platform, construct the SEARCH URL where someone would search for this anime. Use the platform's search functionality.

Return ONLY a valid JSON array with this exact structure, no markdown or explanation:
[
  {
    "id": "platform-id",
    "name": "Platform Name",
    "searchUrl": "https://platform.com/search?q=anime+title"
  }
]

Examples of search URLs:
- Crunchyroll: https://www.crunchyroll.com/search?q=attack+on+titan
- Netflix: https://www.netflix.com/search?q=attack%20on%20titan
- Prime Video: https://www.amazon.com/s?k=attack+on+titan&i=instant-video
- Hulu: https://www.hulu.com/search?q=attack+on+titan

Generate search URLs for "${animeTitle}" on at least 6 platforms.`;

    const geminiData = await callGeminiWithRetry(prompt, apiKey);
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json(
        { error: "No response from Gemini" },
        { status: 500 }
      );
    }

    // Parse JSON from response (handle potential markdown code blocks or truncation)
    let platforms;
    try {
      // First try direct parse since we requested JSON mime type
      try {
        platforms = JSON.parse(text);
      } catch {
        // Try to extract JSON array from text
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          let jsonStr = jsonMatch[0];
          // Try to fix truncated JSON by closing incomplete objects/array
          if (!jsonStr.endsWith("]")) {
            // Find last complete object
            const lastCompleteIndex = jsonStr.lastIndexOf("},");
            if (lastCompleteIndex > 0) {
              jsonStr = jsonStr.substring(0, lastCompleteIndex + 1) + "]";
            }
          }
          platforms = JSON.parse(jsonStr);
        } else {
          throw new Error("No JSON array found in response");
        }
      }
      
      // Validate platforms array
      if (!Array.isArray(platforms) || platforms.length === 0) {
        throw new Error("Invalid platforms data");
      }
      
      // Filter out any incomplete platform entries
      platforms = platforms.filter(
        (p: { id?: string; name?: string; searchUrl?: string }) =>
          p && p.id && p.name && p.searchUrl && p.searchUrl.startsWith("http")
      );
      
      if (platforms.length === 0) {
        throw new Error("No valid platforms found");
      }
    } catch (parseError) {
      console.error("[v0] Failed to parse Gemini response:", text);
      console.error("[v0] Parse error:", parseError);
      return NextResponse.json(
        { error: "Failed to parse platform data" },
        { status: 500 }
      );
    }

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error("Error in discover-platforms:", error);

    // Check if it's a rate limit error
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      return NextResponse.json(
        {
          error:
            "Gemini API rate limit exceeded. Please wait a minute and try again, or upgrade your API key to a paid plan.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
