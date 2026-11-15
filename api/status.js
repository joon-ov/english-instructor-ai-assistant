export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ ready: false, message: "Method not allowed." });
    return;
  }

  const ready = Boolean(process.env.GEMINI_API_KEY);
  response.status(200).json({
    ready,
    message: ready
      ? `Ready · ${process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"}`
      : "Set GEMINI_API_KEY in Vercel project settings to enable chat.",
  });
}
