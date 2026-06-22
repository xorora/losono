# Losono

Multi-agent voice and chat platform. Build AI agents that speak and listen, ground answers in your documents, and deploy them via REST API, WebSocket voice, or a one-line embed widget.

## Features

- **Streaming chat** — AI SDK streaming with per-agent system prompts and retrieved context
- **Live voice** — Gemini Live over WebSocket for playground testing and production deployment
- **Document RAG** — PDF, DOCX, markdown, CSV, HTML, JSON, images, audio, and video chunked and indexed with pgvector on Neon
- **Multi-agent** — Separate agents for support, sales, onboarding, each with its own prompt and knowledge base
- **Developer-first deploy** — REST chat API, WebSocket voice, API keys (`losono_sk_…`), and embed widget
- **Customizable embed** — Branded widget with greeting, colors, logo, launcher position, chat-only or chat+voice modes, and allowed-origin restrictions
- **Voice settings** — Per-agent voice toggle and gender (Puck / Kore) for Gemini Live
- **Sandbox → production** — Test in the playground, then publish with conversation logs and usage tracking
- **Billing** — Free tier for chat-only agents; Pro for voice, unlimited context, and production deployment (Stripe)

## Tech stack

| Layer | Stack |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, React Compiler) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix |
| Auth | NextAuth v5 (Google OAuth) |
| Database | Neon Postgres + Drizzle ORM + pgvector |
| AI | Vercel AI SDK, Google Gemini (chat, voice, embeddings) |
| Realtime | WebSocket voice via `next-ws` + Gemini Live ephemeral tokens |
| Billing | Stripe |
| Tooling | Bun, Biome, TypeScript |

## Prerequisites

- [Bun](https://bun.sh) (package manager and runtime)
- A [Neon](https://neon.tech) Postgres database with the `pgvector` extension
- Google OAuth credentials (for sign-in)
- Google Generative AI API key (for chat, voice, and embeddings)
- Stripe account (optional, for Pro billing)

## Getting started

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd losono
   bun install
   ```

   `bun install` runs the `prepare` script, which patches Next.js for WebSocket support (`next-ws patch`).

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in the required values (see [Environment variables](#environment-variables) below). Generate an auth secret:

   ```bash
   openssl rand -base64 32
   ```

3. **Run database migrations**

   ```bash
   bun run db:migrate
   ```

4. **Start the dev server**

   ```bash
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` and set the following:

| Variable | Required | Description |
| --- | --- | --- |
| `AUTH_SECRET` | Yes | Stable secret for session cookies (`openssl rand -base64 32`) |
| `AUTH_URL` | Yes | App URL, e.g. `http://localhost:3000` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `DATABASE_URL` | Yes | Neon pooled Postgres connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini API key (server-only) |
| `GEMINI_CHAT_MODEL` | No | Default: `gemini-3.5-flash` |
| `GEMINI_VOICE_MODEL` | No | Default: `gemini-3.1-flash-live-preview` |
| `GEMINI_EMBED_MODEL` | No | Default: `gemini-embedding-2` |
| `GEMINI_EMBED_DIMENSIONS` | No | Default: `768` |
| `MASTER_SYSTEM_PROMPT` | No | Platform-wide system prompt (server-only) |
| `STRIPE_SECRET_KEY` | For billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | For billing | Stripe webhook signing secret |
| `STRIPE_PRICE_AGENT_SEAT` | For billing | Recurring monthly price ID for Pro seats |
| `MAX_CONTEXT_FILE_BYTES` | No | Per-file upload limit (default: 10 MB) |
| `FREE_CONTEXT_FILE_LIMIT` | No | Max context files on free tier (default: 3) |
| `NEXT_PUBLIC_APP_URL` | No | Public URL for embed snippets (defaults to `AUTH_URL`) |

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start dev server with Turbopack |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Lint and fix with Biome |
| `bun run format` | Format with Biome |
| `bun run typecheck` | TypeScript check |
| `bun run db:generate` | Generate Drizzle migrations from schema changes |
| `bun run db:migrate` | Apply migrations |

## Project structure

```
src/
├── app/
│   ├── (public)/              # Landing, sign-in, docs
│   ├── (dashboard)/           # Authenticated dashboard
│   │   └── agents/[id]/       # Prompt, context, playground, deploy
│   ├── api/                   # REST + WebSocket API routes
│   └── embed/[slug]/          # Public hosted embed widget
├── components/
│   ├── chat/                  # Chat UI and markdown rendering
│   ├── dashboard/             # Agent management, context, settings
│   ├── deploy/                # Publish, API keys, embed settings, logs
│   ├── embed/                 # Embed widget and loader helpers
│   ├── landing/               # Marketing site
│   └── voice/                 # Voice playground client
├── lib/
│   ├── db/                    # Drizzle schema and queries
│   ├── rag/                   # Ingestion, extraction, retrieval
│   ├── gemini/                # Chat, voice, embeddings, ephemeral tokens
│   ├── billing/               # Stripe subscriptions and limits
│   └── widget-theme.ts        # Embed appearance resolution
public/
├── embed.js                   # One-line embed loader script
└── audio-worklets/            # Voice capture and playback processors
```

## API and deployment

Published agents can be integrated three ways:

### Embed widget (recommended)

Add a floating chat launcher with one script tag. Losono hosts the UI in a secure iframe — no API key is exposed on your site.

```html
<script src="{APP_URL}/embed.js" data-agent="your-slug"></script>
```

| Attribute | Required | Description |
| --- | --- | --- |
| `data-agent` | Yes | Published agent slug (from the deploy page) |
| `data-position` | No | `bottom-right` (default) or `bottom-left` |
| `src` | Yes | Must point at `{APP_URL}/embed.js` |

Configure greeting, colors, logo, modes (chat or chat+voice), and allowed origins on the agent **Deploy** page. Voice in the embed requires Pro, voice enabled on the agent, and **Chat + voice** mode.

### REST chat API

`POST /api/agents/{agentId}/chat` with a Bearer API key; streams AI SDK UI messages.

Use the agent **UUID** from the dashboard URL — not the embed slug.

### WebSocket voice

`GET /api/agents/{agentId}/voice?mode=deploy` (Pro + voice enabled)

Production voice uses ephemeral Gemini Live tokens issued by the server. Playground mode (`mode=playground`) is available to authenticated owners in the dashboard.

### Identifiers

| Integration | Identifier |
| --- | --- |
| Embed widget | **slug** (`data-agent="my-agent"`) |
| REST / voice API | **agentId** (UUID from dashboard URL) |

See the in-app [API reference](http://localhost:3000/docs) at `/docs` for request formats, streaming protocol, and examples.

## Workflow

1. Sign in with Google and create an agent
2. Write a system prompt, upload context documents, and configure voice settings
3. Test chat and voice in the playground (sandbox mode)
4. Publish, customize embed appearance, generate API keys, and deploy on your site or integrate via REST

## License

Licensed under the [GNU General Public License v3.0](LICENSE).
