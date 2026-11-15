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

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
    console.error("Gemini API returned HTTP", upstream.status);
    const status = upstream.status === 429 ? 429 : 502;
    response.status(status).json({
      error: status === 429
        ? "The AI service is busy right now. Please wait a moment and try again."
        : "The AI service could not complete your request. Check the Gemini API key and model settings.",
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
