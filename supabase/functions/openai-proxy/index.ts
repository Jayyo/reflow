// Reflow - OpenAI API Proxy Edge Function
// Keeps API key server-side, adds rate limiting and CORS

import "@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const ALLOWED_ORIGINS = [
  "chrome-extension://",
  "https://chatgpt.com",
  "https://chat.openai.com",
];

// Simple in-memory rate limiter (per IP, resets on cold start)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const headers = corsHeaders(origin || "*");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers },
    );
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
      { status: 429, headers },
    );
  }

  try {
    const body = await req.json();
    const { messages, maxTokens, reasoningEffort } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: messages required" }),
        { status: 400, headers },
      );
    }

    // Forward to OpenAI
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages,
          reasoning_effort: reasoningEffort || "low",
          max_completion_tokens: maxTokens || 800,
        }),
      },
    );

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          error: err.error?.message || `OpenAI API error: ${openaiRes.status}`,
        }),
        { status: openaiRes.status, headers },
      );
    }

    const result = await openaiRes.json();
    // GPT-5 reasoning models may use output_text or choices[0].message.content
    const content = result.choices?.[0]?.message?.content
      || result.output_text
      || result.output?.[0]?.content?.[0]?.text
      || "";

    return new Response(
      JSON.stringify({ success: true, data: content }),
      { status: 200, headers },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status: 500, headers },
    );
  }
});
