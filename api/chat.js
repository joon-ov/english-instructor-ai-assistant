import { systemPrompt } from "../instructor-prompt.js";

const maxMessages = 40;
const maxMessageLength = 4000;
const maxBodyBytes = 1_000_000;

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > maxMessages) {
    return "Send between 1 and 40 conversation messages.";
  }

  for (const message of messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0 ||
      message.content.length > maxMessageLength
    ) {
      return "Each message must have a user or assistant role and contain 1 to 4,000 characters.";
    }
  }
  return null;
}

function getUpstreamErrorMessage(status, upstreamStatus, upstreamMessage) {
  const message = typeof upstreamMessage === "string" ? upstreamMessage.toLowerCase() : "";

  if (status === 400 && /api.?key/.test(message)) {
    return "Google rejected GEMINI_API_KEY. Check that you copied the active key correctly, then redeploy.";
  }
  if (status === 400) {
    return "Google rejected the request. Check the GEMINI_MODEL setting and try again.";
  }
  if (status === 403 || upstreamStatus === "PERMISSION_DENIED") {
    return "Google denied API access. Check the key's API restrictions and make sure the Gemini API is enabled for its Google Cloud project.";
  }
  if (status === 404 || upstreamStatus === "NOT_FOUND") {
    return "Google could not find the configured Gemini model. Check GEMINI_MODEL in Vercel.";
  }
  if (status === 429 || upstreamStatus === "RESOURCE_EXHAUSTED") {
    return "The Gemini API quota or rate limit has been reached. Check the project's AI Studio usage and quota.";
  }
  return "Google's AI service returned an error. Check the Vercel function logs for the Google status code.";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    response.status(503).json({ error: "Chat is not configured. Add GEMINI_API_KEY to the Vercel project environment variables." });
    return;
  }

  let payload = request.body;
  if (typeof payload === "string") {
    if (Buffer.byteLength(payload, "utf8") > maxBodyBytes) {
      response.status(413).json({ error: "Request body is too large." });
      return;
    }
    try {
      payload = JSON.parse(payload);
    } catch {
      response.status(400).json({ error: "Request body must be valid JSON." });
      return;
    }
  }

  const validationError = validateMessages(payload?.messages);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  let upstream;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: payload.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );
  } catch (error) {
    console.error("Gemini request failed:", error.name);
    response.status(502).json({ error: "Could not reach the English instructor. Please try again." });
    return;
  }

  if (!upstream.ok) {
    let upstreamError;
    try {
      upstreamError = (await upstream.json()).error;
    } catch {
      upstreamError = null;
    }

    console.error("Gemini API returned HTTP", upstream.status, upstreamError?.status ?? "unknown error type");
    const status = upstream.status === 429 ? 429 : 502;
    response.status(status).json({
      error: getUpstreamErrorMessage(upstream.status, upstreamError?.status, upstreamError?.message),
    });
    return;
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    response.status(502).json({ error: "The AI service returned an invalid response. Please try again." });
    return;
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((text) => typeof text === "string")
    .join("")
    .trim();

  if (!reply) {
    response.status(502).json({ error: "The AI service returned an empty reply. Please try again." });
    return;
  }

  response.status(200).json({ reply });
}
