import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { systemPrompt } from "./instructor-prompt.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = join(root, "public");
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);
const ollamaHost = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const model = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const maxBodyBytes = 1_000_000;

function sendJson(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function validateMessages(payload) {
  if (!Array.isArray(payload?.messages) || payload.messages.length === 0 || payload.messages.length > 40) {
    return "Send between 1 and 40 conversation messages.";
  }

  for (const message of payload.messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0 ||
      message.content.length > 4000
    ) {
      return "Each message must have a user or assistant role and contain 1 to 4,000 characters.";
    }
  }
  return null;
}

async function handleApiRequest(request, response) {
  if (request.method === "GET" && request.url === "/api/status") {
    try {
      const ollamaResponse = await fetch(`${ollamaHost}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!ollamaResponse.ok) {
        sendJson(response, 200, { ready: false, message: "Ollama is running but did not return its model list." });
        return;
      }

      const data = await ollamaResponse.json();
      const installedModels = Array.isArray(data.models) ? data.models : [];
      const ready = installedModels.some((item) => item.name === model);
      sendJson(response, 200, {
        ready,
        message: ready
          ? `Ready · ${model}`
          : `Model ${model} is not installed. Run: ollama pull ${model}`,
      });
    } catch {
      sendJson(response, 200, {
        ready: false,
        message: `Ollama is not available. Start Ollama, then run: ollama pull ${model}`,
      });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat") {
    const payload = await readJsonBody(request);
    const validationError = validateMessages(payload);
    if (validationError) {
      sendJson(response, 400, { error: validationError });
      return;
    }

    let ollamaResponse;
    try {
      ollamaResponse = await fetch(`${ollamaHost}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [{ role: "system", content: systemPrompt }, ...payload.messages],
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      sendJson(response, 503, {
        error: `Cannot connect to Ollama. Start Ollama and make sure ${model} is installed.`,
      });
      return;
    }

    if (!ollamaResponse.ok) {
      const detail = (await ollamaResponse.text()).slice(0, 300);
      sendJson(response, 502, {
        error: `Ollama returned an error (${ollamaResponse.status}).${detail ? ` ${detail}` : ""}`,
      });
      return;
    }

    const data = await ollamaResponse.json();
    const content = data.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      sendJson(response, 502, { error: "Ollama returned an empty reply. Please try again." });
      return;
    }
    sendJson(response, 200, { reply: content });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function handleStaticRequest(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const requestedPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = normalize(join(publicDirectory, requestedPath));
  if (!filePath.startsWith(`${publicDirectory}/`)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

const server = createServer((request, response) => {
  const handler = request.url?.startsWith("/api/")
    ? handleApiRequest(request, response)
    : handleStaticRequest(request, response);

  handler.catch((error) => {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "The server could not complete the request." });
    } else {
      response.destroy();
    }
  });
});

server.listen(port, host, () => {
  console.log(`AI English Instructor running at http://${host}:${port}`);
  console.log(`Ollama model: ${model}`);
});
