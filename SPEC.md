# AI English Instructor — product spec

## Goal

Create a simple chat app for practicing English. The learner can write a phrase,
sentence, paragraph, or conversational prompt and receive a natural reply in
English.

## Learner experience

- The interface is a familiar, uncluttered conversation with a text box and a
  send action.
- The instructor replies only in English.
- For every prompt, the instructor starts with a `Correction:` section. It
  provides the corrected version and a simple explanation when there are
  mistakes, or says the English is already correct when there are none.
- Only after the correction section, the instructor writes an `Answer:` section
  that responds to the prompt's meaning.
- The instructor never invents mistakes or answers before correcting.
- The instructor uses clear, supportive, beginner-friendly language.
- The conversation stays available in the page while it is open; it does not
  require an account or persist across reloads.

## Technical decisions

- Use Ollama with a locally run model to avoid a paid API or cloud account.
- Use a small Node.js server as a same-origin proxy to Ollama.
- Keep the server bound to localhost; do not expose model configuration or
  credentials to the browser.
- Default model: `qwen2.5:3b`. It can be changed with `OLLAMA_MODEL`.
- No database, account system, streaming, or unrelated features.

## Acceptance criteria

1. A learner can submit a message using the send button or Enter; Shift+Enter
   adds a new line.
2. The app displays learner and instructor messages in conversation order.
3. Each request includes recent successful messages (up to 40) so the instructor
   can continue the conversation.
4. The model receives explicit instructions to provide a `Correction:` section
   before an `Answer:` section for every prompt, without inventing mistakes.
5. A missing Ollama service or model produces a visible, actionable error.
6. User and model text is rendered as text, not executable HTML.
7. The app can be started with the documented local setup.
