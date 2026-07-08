import {
  TinyFish,
  RunStatus,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  APITimeoutError,
  type AgentRunParams,
  type ProxyCountryCode,
} from "@tiny-fish/sdk";
import { parseEnvNumber } from "@/lib/env";

export type AnsweredInDocs = "true" | "false" | "partial";

export type Importance = "high" | "medium";

export type SelfGeneratedQuestion = {
  question: string;
  answeredInDocs: AnsweredInDocs;
  partialAnswer?: string | null;
  importance: Importance;
};

export type TinyFishAnalysis = {
  selfGeneratedQuestions: SelfGeneratedQuestion[];
};

export type TinyFishProxyConfig = {
  enabled: boolean;
  countryCode?: "US" | "GB" | "CA" | "DE" | "FR" | "JP" | "AU";
};

export type TinyFishOutputSchema = Record<string, unknown>;

const DEFAULT_BASE_URL = "https://agent.tinyfish.ai";
const DEFAULT_TIMEOUT_MS = parseEnvNumber("TINYFISH_TIMEOUT_MS", 180000, {
  min: 1000,
});
const DEFAULT_MAX_RETRIES = parseEnvNumber("TINYFISH_MAX_RETRIES", 0, { min: 0 });

export type RunOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  browserProfile?: "lite" | "stealth";
  proxyConfig?: TinyFishProxyConfig;
  useVault?: boolean;
  credentialItemIds?: string[];
  outputSchema?: TinyFishOutputSchema;
};

class TinyFishError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getClient(options: RunOptions = {}): TinyFish {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TINYFISH_API_KEY");
  }

  return new TinyFish({
    apiKey,
    baseURL: process.env.TINYFISH_BASE_URL || DEFAULT_BASE_URL,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
  });
}

export function buildAnalysisGoal(): string {
  return [
    "Evaluate how well an answer engine could understand and cite this page.",
    "Generate exactly 6 user questions in a stable, deterministic order.",
    "Return only JSON that matches the requested schema.",
    "For each question, use answeredInDocs exactly as true, false, or partial.",
    "Keep partialAnswer short and null when the answer is complete.",
  ].join(" ");
}

function buildAnalysisOutputSchema(): TinyFishOutputSchema {
  return {
    type: "object",
    properties: {
      selfGeneratedQuestions: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            answeredInDocs: {
              type: "string",
              enum: ["true", "false", "partial"],
            },
            partialAnswer: { type: "string", nullable: true },
            importance: {
              type: "string",
              enum: ["high", "medium"],
            },
          },
          required: [
            "question",
            "answeredInDocs",
            "partialAnswer",
            "importance",
          ],
          propertyOrdering: [
            "question",
            "answeredInDocs",
            "partialAnswer",
            "importance",
          ],
        },
      },
    },
    required: ["selfGeneratedQuestions"],
    propertyOrdering: ["selfGeneratedQuestions"],
  };
}

function buildRunParams(
  url: string,
  goal: string,
  options: RunOptions = {},
  includeOutputSchema = true
): AgentRunParams {
  const params: AgentRunParams = { url, goal };

  if (options.browserProfile) {
    params.browser_profile = options.browserProfile;
  }

  if (options.proxyConfig) {
    params.proxy_config = {
      enabled: options.proxyConfig.enabled,
      country_code: options.proxyConfig.countryCode as ProxyCountryCode | undefined,
    };
  }

  if (options.useVault) {
    params.use_vault = true;
  }

  if (options.credentialItemIds?.length) {
    params.credential_item_ids = options.credentialItemIds;
  }

  if (includeOutputSchema && options.outputSchema) {
    params.output_schema = options.outputSchema;
  }

  return params;
}

function normalizeAnswered(value: unknown): AnsweredInDocs {
  if (value === "partial") return "partial";
  if (value === true || value === "true") return "true";
  return "false";
}

function normalizeImportance(value: unknown): Importance {
  return value === "high" ? "high" : "medium";
}

export function normalizeAnalysis(payload: unknown): TinyFishAnalysis {
  const data = payload as TinyFishAnalysis | undefined;
  const rawQuestions =
    data?.selfGeneratedQuestions && Array.isArray(data.selfGeneratedQuestions)
      ? data.selfGeneratedQuestions
      : [];

  const normalized = rawQuestions.map((q) => ({
    question: String(q.question ?? "")
      .trim()
      .replace(/\s+/g, " "),
    answeredInDocs: normalizeAnswered(q.answeredInDocs),
    partialAnswer:
      q.partialAnswer === null || q.partialAnswer === undefined
        ? null
        : String(q.partialAnswer).slice(0, 140),
    importance: normalizeImportance(q.importance),
  }));

  return { selfGeneratedQuestions: normalized };
}

async function runAgent(
  params: AgentRunParams,
  options: RunOptions = {}
): Promise<unknown> {
  const client = getClient(options);

  try {
    const response = await client.agent.run(params);

    if (response.status !== RunStatus.COMPLETED) {
      const detail =
        response.error?.message ?? `TinyFish run ended with status ${response.status}`;
      throw new TinyFishError(`TinyFish request failed: ${detail}`);
    }

    return response.result;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new TinyFishError(
        `TinyFish API key is invalid or not configured. Add a valid TINYFISH_API_KEY to your .env file. (${error.message})`,
        error.statusCode
      );
    }
    if (error instanceof APITimeoutError) {
      throw new TinyFishError("TinyFish request timed out", 504);
    }
    throw error;
  }
}

async function runTinyFishRequest(
  url: string,
  goal: string,
  options: RunOptions = {}
): Promise<unknown> {
  const params = buildRunParams(url, goal, options, true);

  try {
    return await runAgent(params, options);
  } catch (error) {
    const schemaRejected =
      error instanceof BadRequestError || error instanceof PermissionDeniedError;
    if (params.output_schema && schemaRejected) {
      return runAgent(buildRunParams(url, goal, options, false), options);
    }
    throw error;
  }
}

export async function runTinyFishAnalysis(
  url: string,
  options: RunOptions = {}
): Promise<TinyFishAnalysis> {
  const payload = await runTinyFishRequest(url, buildAnalysisGoal(), {
    ...options,
    outputSchema: options.outputSchema ?? buildAnalysisOutputSchema(),
  });
  return normalizeAnalysis(payload);
}

/**
 * Run TinyFish with a custom goal and return the raw JSON payload (no normalization).
 * Use for Reddit discovery or other flows that need a custom response shape.
 */
export async function runTinyFishWithGoal(
  url: string,
  goal: string,
  options: RunOptions = {}
): Promise<unknown> {
  return runTinyFishRequest(url, goal, options);
}
