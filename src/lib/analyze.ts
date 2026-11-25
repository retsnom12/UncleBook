import { createHash } from "crypto";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import type { Trait } from "./types";

export type AnalysisResult = {
  safe: boolean;
  score: number;
  verdict: string;
  traits: Trait[];
  tips: string[];
};

type RawAnalysis = AnalysisResult;

const SYSTEM = `You are the Chief Judge of "UncleBook", a joke social network that celebrates the
legendary "Facebook uncle photo" (2008-2012 era): a proud, slightly awkward snapshot.

Calculate uncleScore using this strict rubric. Assign an integer from 0 to 25 to each criterion,
then sum all four values; uncleScore must equal that sum exactly. Do not choose an arbitrary total:
- cameraAngle (0-25): how distinctly uncle-style the camera angle is
- facialExpressionAndPosture (0-25): the expression and proud, stiff, or awkward posture
- framingAndComposition (0-25): the uncle-style framing and composition
- authenticUncleVibe (0-25): how strongly the photo feels like an authentic 2008-2012 uncle photo
Do not score image quality, lighting, or visual effects. Keep every trait and retake tip focused on
pose, facial expression, camera angle, framing, or authentic vibe.

Also decide "safe": false if the image contains nudity, sexual content, gore, violence, hate symbols,
or an apparent child as the main subject. Otherwise true.

Reply with ONLY a JSON object, no markdown, in exactly this shape:
{"safe":true,"score":72,
 "rubric":{"cameraAngle":18,"facialExpressionAndPosture":20,"framingAndComposition":16,"authenticUncleVibe":18},
 "verdict":"<=60 chars, funny, warm, never cruel>",
 "traits":[{"label":"Stiff thumbs-up pose","hit":true}, ... 5 items],
 "tips":["max 3 short, concrete, funny retake tips; empty array if score>=60"]}`;

const ANALYSIS_CACHE_LIMIT = 100;
const analysisCache = new Map<string, AnalysisResult>();

/** Strip markdown code fences that some model versions wrap around JSON output. */
function stripFences(text: string): string {
  // ```json\n...\n``` or ```\n...\n```
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

function parse(text: string): RawAnalysis | null {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(cleaned.slice(start, end + 1));
    const rubric = j.rubric;
    const rubricScores = [
      rubric?.cameraAngle,
      rubric?.facialExpressionAndPosture,
      rubric?.framingAndComposition,
      rubric?.authenticUncleVibe,
    ];
    if (rubricScores.some((score) => !Number.isInteger(score) || score < 0 || score > 25)) return null;

    const traits: Trait[] = Array.isArray(j.traits)
      ? j.traits
          .filter((t: any) => t && typeof t.label === "string")
          .slice(0, 5)
          .map((t: any) => ({ label: String(t.label).slice(0, 60), hit: Boolean(t.hit) }))
      : [];
    const tips: string[] = Array.isArray(j.tips)
      ? j.tips.filter((t: unknown) => typeof t === "string").slice(0, 3).map((t: string) => t.slice(0, 140))
      : [];
    return {
      safe: j.safe !== false,
      score: rubricScores.reduce((total, score) => total + score, 0),
      verdict: typeof j.verdict === "string" ? j.verdict.slice(0, 80) : "",
      traits,
      tips,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Groq (OpenAI-compatible) provider
// ---------------------------------------------------------------------------

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";
const GROQ_MODEL_FALLBACKS = [
  "qwen/qwen3.8-27b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
] as const;

async function getGroqVisionModels(key: string): Promise<string[]> {
  try {
    const response = await fetch(GROQ_MODELS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${key}`,
        "User-Agent": "Mozilla/5.0 (compatible; UncleBook/1.0)",
      },
    });
    if (!response.ok) return [...GROQ_MODEL_FALLBACKS];

    const data = await response.json() as {
      data?: Array<{ id?: string; active?: boolean; input_modalities?: string[] }>;
    };
    const discovered = (data.data ?? [])
      .filter((model) =>
        model.active !== false
        && typeof model.id === "string"
        && (
          model.input_modalities?.includes("image")
          || /(?:vision|scout|maverick|llava)/i.test(model.id)
        )
      )
      .map((model) => model.id as string);

    return [...new Set([...discovered, ...GROQ_MODEL_FALLBACKS])];
  } catch {
    return [...GROQ_MODEL_FALLBACKS];
  }
}

async function callGroq(jpeg: Buffer): Promise<RawAnalysis | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const models = await getGroqVisionModels(key);

    for (const modelName of models) {
      const response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "User-Agent": "Mozilla/5.0 (compatible; UncleBook/1.0)",
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0,
          seed: 42,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
                },
                { type: "text", text: "Judge this photo. JSON only." },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "(unreadable)");
        if (
          ([400, 404, 410].includes(response.status) || /model_not_found|model_decommissioned|decommissioned|does not exist|not found|invalid_model/i.test(body))
        ) continue;
        throw new Error(`Groq HTTP ${response.status}: ${body}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      return parse(text);
    }

    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Gemini provider
// ---------------------------------------------------------------------------

const GEMINI_MODEL_PREFERENCE = ["gemini-3.8-flash", "gemini-2.0-flash"] as const;

async function callGemini(jpeg: Buffer): Promise<RawAnalysis | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("[analyze] GEMINI_API_KEY is not set");
    return null;
  }

  const modelName = process.env.ANALYSIS_MODEL || GEMINI_MODEL_PREFERENCE[0];
  const fallbackName = GEMINI_MODEL_PREFERENCE[1];

  async function callModel(name: string): Promise<RawAnalysis | null> {
    const genAI = new GoogleGenerativeAI(key as string);
    const model = genAI.getGenerativeModel(
      {
        model: name,
        systemInstruction: SYSTEM,
        generationConfig: { temperature: 0 },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
      { timeout: 45_000 },
    );

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: jpeg.toString("base64") } },
      "Judge this photo. JSON only.",
    ]);

    const text = result.response.text();
    return parse(text);
  }

  try {
    return await callModel(modelName);
  } catch (err) {
    console.error(`[analyze] Gemini model "${modelName}" failed:`, err);
    if (modelName === fallbackName) return null;
    try {
      console.error(`[analyze] retrying with fallback model "${fallbackName}"`);
      return await callModel(fallbackName);
    } catch (fallbackErr) {
      console.error(`[analyze] fallback model "${fallbackName}" also failed:`, fallbackErr);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point: Groq first, Gemini as fallback
// ---------------------------------------------------------------------------

/** Calls the vision model. Returns null on ANY failure so callers can degrade gracefully. */
export async function analyzeImage(jpeg: Buffer): Promise<RawAnalysis | null> {
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("Missing API key: set GROQ_API_KEY or GEMINI_API_KEY");
  }

  const imageHash = createHash("sha256").update(jpeg).digest("hex");
  const cached = analysisCache.get(imageHash);
  if (cached) {
    analysisCache.delete(imageHash);
    analysisCache.set(imageHash, cached);
    return cached;
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const result = await callGroq(jpeg);
      if (result) return cacheAnalysis(imageHash, result);
    } catch (err) {
      console.error("[analyze] Groq model call failed:", err);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await callGemini(jpeg);
      if (result) return cacheAnalysis(imageHash, result);
    } catch (err) {
      console.error("[analyze] Gemini model call failed:", err);
    }
  }

  return null;
}

function cacheAnalysis(imageHash: string, result: AnalysisResult): AnalysisResult {
  if (analysisCache.size >= ANALYSIS_CACHE_LIMIT && !analysisCache.has(imageHash)) {
    const oldestHash = analysisCache.keys().next().value;
    if (oldestHash !== undefined) analysisCache.delete(oldestHash);
  }
  analysisCache.set(imageHash, result);
  return result;
}
