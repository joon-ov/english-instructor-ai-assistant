# AI English Instructor

A simple, local English-practice chat app. The instructor replies in English,
corrects genuine grammar or phrasing mistakes, explains corrections in simple
words, and continues the conversation.

## Run locally for free

1. Install [Ollama](https://ollama.com/download) and start it.
2. Download the default model:

   ```sh
   ollama pull qwen2.5:3b
   ```

3. In this project folder, start the app:

   ```sh
   npm start
   ```

4. Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The model runs on your computer. There is no API key or subscription. Model
downloads require an internet connection and disk space; replies use your
computer's resources.

## Deploy on Vercel

Vercel cannot connect to Ollama running on your computer. The deployed app uses
the Gemini API instead; the local app continues to use Ollama.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
   Gemini API usage may be subject to free-tier limits and availability.
2. Import this GitHub repository into Vercel.
3. Add `GEMINI_API_KEY` as an environment variable in the Vercel project settings.
   Never commit the key or put it in a `NEXT_PUBLIC_` variable.
4. Optionally set `GEMINI_MODEL` (default: `gemini-3.5-flash-lite`), then deploy.

The Vercel integration is in `api/`. Check `/api/status` on the deployed site to
confirm configuration before chatting. If chat fails, the error message
distinguishes common invalid-key, API-access, model-name, and quota issues.

## Install on your phone

The app includes an installable home-screen icon and opens without browser
controls when launched from the icon.

- **iPhone:** Open the app's HTTPS address in Safari, tap **Share**, then **Add
  to Home Screen**.
- **Android:** Open the app's HTTPS address in Chrome, tap **Install app** (or
  **Add to Home screen**) in the browser menu.

Phone installation requires an HTTPS address. Use the Vercel deployment URL for
installation; its chat uses the hosted Gemini API. The localhost setup is only
reachable on the computer running it.

## Configuration

- `OLLAMA_MODEL`: choose a model already installed in Ollama (default:
  `qwen2.5:3b`).
- `OLLAMA_HOST`: Ollama server URL (default: `http://127.0.0.1:11434`).
- `PORT`: app port (default: `3000`).

For example, after downloading another model with Ollama, set `OLLAMA_MODEL` to
that model's name before starting the app.

## Checks

```sh
npm run check
```

See [SPEC.md](./SPEC.md) for the product behavior and acceptance criteria.
