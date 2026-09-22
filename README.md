# Storyworld

**A reading space that listens, explains, and stays with your book.**

Storyworld is a browser-based EPUB reader with spoken narration, passage-aware literary chat, and chapter analysis. Its language and voice models run on the reader's device. Import a book, choose a passage, listen, and explore its characters and themes without sending the book to a hosted AI service.

## What it does

- **Read your own books.** Import an EPUB, navigate chapters, change text size, and switch between scrolling and page views.
- **Listen as you read.** Use Piper voices for on-device narration. Browser speech is available as a fallback.
- **Ask about the text.** Chat with an on-device language model about the current book, chapter, or selected passage.
- **Explore a chapter.** Generate character, theme, and sentence annotations on your device. Work resumes from saved progress.
- **Keep a local library.** Reading settings and imported book data stay in browser storage. Models and analysis data are cached for later sessions.

Storyworld includes a small sample library so you can explore the interface before you import a book.

## Quick start

You need Node.js 24 or later, npm, and a current browser. A device with WebGPU can make local inference faster. Model downloads require an internet connection on first use.

```bash
git clone https://github.com/skipauthenticate/storyworld.git
cd storyworld
npm ci
npm run dev
```

Open the local address printed by Vite. Import an `.epub` file or select a sample book. Select **Enrich on import** if you want chapter analysis to start at once. The first local language model download is about 350 MB. Each Piper voice download is about 64 MB.

## How it works

| Part | Role |
| --- | --- |
| React, TypeScript, Vite | Reader interface and static build |
| epub.js | EPUB parsing |
| RunAnywhere, llama.cpp, Qwen2.5-0.5B | On-device chat and analysis |
| RunAnywhere, Sherpa ONNX, Piper | On-device speech |
| Local storage and IndexedDB | Books, settings, progress, and cached models |
| Optional Supabase Edge Function | Cross-origin proxy for model downloads |

Storyworld does not need an account or a database for normal reading. The optional proxy carries model files. It does not receive the text of an imported book.

## Build and deploy

```bash
npm ci
npm run lint
npm test
npm run build
```

Deploy the `dist/` directory to a static host. Configure the host to serve `index.html` for app routes. Preserve the copied files under `dist/assets/`; the local inference engines load WebAssembly files from that path. Use HTTPS and send these response headers on the app and its assets:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

The development server already sends these headers. Check the deployed site in a current browser before sharing it. Model download hosts must allow cross-origin requests, or you must configure a proxy.

### Optional model download proxy

Storyworld can use the included Supabase Edge Function when a model host blocks a direct browser download. Deploy `supabase/functions/cors-proxy` to your own Supabase project with JWT verification disabled, then set its project URL before the build:

```bash
cp .env.example .env.local
# Set VITE_SUPABASE_URL to your Supabase project URL.
npm run build
```

The proxy accepts only HTTPS requests to the model hosts in its allowlist. Apply rate limits at the hosting edge before you expose this endpoint to a large audience. You can leave `VITE_SUPABASE_URL` unset when direct downloads work.

## Privacy and limits

- Imported books, reading progress, generated notes, and chat run in the browser. Clearing site data removes this local data.
- First-use model and voice downloads contact their file hosts. The optional proxy handles those downloads if configured.
- Browser storage has a size limit. Large libraries may exceed it. Export a source EPUB before you clear browser data.
- Local inference speed depends on the device and browser. The small bundled model can make mistakes; check its analysis against the text.
- The sample library is a demonstration. Import your own EPUB for a complete book.

## Project layout

```text
src/components/storyworld/   Reader, library, narration, and analysis UI
src/hooks/                   Reading, narration, and enrichment state
src/lib/                     EPUB parsing, local models, and browser storage
supabase/functions/cors-proxy/ Optional model download proxy
```

## Contributing

Run `npm run lint`, `npm test`, and `npm run build` before a pull request. Open an issue with steps to reproduce a reader, import, or model problem. Do not add copyrighted books, API keys, or model binaries to the repository.
