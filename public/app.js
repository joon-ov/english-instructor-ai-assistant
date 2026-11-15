const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const conversation = document.querySelector("#conversation");
const messagesElement = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const connection = document.querySelector("#connection");
const connectionText = document.querySelector("#connection-text");

const messages = [];
let waiting = false;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch((error) => {
    console.error("Could not register the app's offline shell:", error);
  });
}

function addMessage(role, content, isError = false) {
  const message = document.createElement("article");
  message.className = `message ${role}${isError ? " error" : ""}`;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "e";
    message.append(avatar);
  }

  const text = document.createElement("div");
  text.className = "message-content";
  text.textContent = content;
  message.append(text);
  messagesElement.append(message);
  welcome.hidden = true;
  conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  return message;
}

function showTyping() {
  const message = document.createElement("article");
  message.className = "message assistant";
  message.setAttribute("aria-label", "Instructor is responding");

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "e";

  const dots = document.createElement("div");
  dots.className = "typing";
  dots.innerHTML = "<span></span><span></span><span></span>";
  message.append(avatar, dots);
  messagesElement.append(message);
  conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  return message;
}

async function checkStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    connection.classList.toggle("ready", status.ready);
    connection.classList.toggle("error", !status.ready);
    connectionText.textContent = status.message;
  } catch {
    connection.classList.add("error");
    connectionText.textContent = "Can't reach the local app server.";
  }
}

async function sendMessage(content) {
  waiting = true;
  sendButton.disabled = true;
  input.disabled = true;
  addMessage("user", content);
  if (messages.length >= 40) messages.splice(0, 2);
  messages.push({ role: "user", content });
  const typing = showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const result = await response.json();
    typing.remove();

    if (!response.ok) {
      messages.pop();
      addMessage("assistant", result.error ?? "The instructor could not reply. Please try again.", true);
      return;
    }

    messages.push({ role: "assistant", content: result.reply });
    addMessage("assistant", result.reply);
    connection.classList.add("ready");
    connection.classList.remove("error");
  } catch {
    typing.remove();
    messages.pop();
    addMessage("assistant", "I couldn't reach the local instructor. Check that the app and Ollama are running, then try again.", true);
  } finally {
    waiting = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || waiting) return;
  input.value = "";
  input.style.height = "auto";
  void sendMessage(content);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

void checkStatus();
