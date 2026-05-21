# ContentForge AI

> A MERN stack AI content-generation platform — multi-model pipeline (OpenAI + Claude + Gemini), live web research, custom humanizer, SEO scoring, and smart suggestions. Inspired by Writesonic, designed to ship.

---

## ✨ Highlights

- **Multi-model AI pipeline** — outline (GPT-4o-mini) → write (Claude Sonnet) → SEO optimize (Gemini) → humanize (custom + Claude). Falls back to mock content when no API keys are set, so you can run it end-to-end with zero credits.
- **Live competitor research** — SerpAPI + Cheerio scrape top-ranking pages and feed a research brief to the AI.
- **Custom humanizer** — deterministic local pass (sentence-length variance, AI-phrase replacement, contractions, opener injection) plus an optional LLM rewrite. Returns a before/after AI-detection score.
- **SEO scoring engine** — keyword density, Flesch-Kincaid readability, heading-structure validation, meta-tag length checks, LSI keyword extraction, actionable suggestions.
- **Smart suggestions panel** — competitor-gap subtopics, statistics to add, internal-link ideas, schema markup ideas, image suggestions.
- **Dashboard, history, tools** — analytics, searchable history, standalone humanizer/AI-detector/paraphraser/title-generator/SEO-checker.
- **React + Bootstrap 5 + SCSS** — light/dark theme via CSS custom properties, responsive sidebar, framer-motion ready, no Tailwind.
- **JWT auth + plan limits** — free / pro / enterprise word quotas enforced in the controller.

---

## 📁 Project structure

```
contentforge-ai/
├── client/                          # React + Vite + Bootstrap 5 + SCSS
│   ├── src/
│   │   ├── components/Layout/       # Sidebar, Navbar, MainLayout
│   │   ├── pages/                   # Login, Register, Dashboard, Generator,
│   │   │                            # ArticleView, History, Tools, Settings
│   │   ├── store/slices/            # auth, articles, theme (Redux Toolkit)
│   │   ├── services/api.js          # Axios instance + JWT interceptor
│   │   ├── styles/                  # SCSS partials (variables, themes, components)
│   │   ├── App.jsx, main.jsx
│   │   └── index.html
│   └── package.json
├── server/                          # Express + MongoDB + Mongoose
│   ├── controllers/                 # auth, article, tools, dashboard
│   ├── models/                      # User, Article
│   ├── routes/                      # auth, articles, tools, dashboard
│   ├── middleware/                  # auth (JWT), error handler
│   ├── services/                    # aiPipeline, webScraper, humanizer,
│   │                                # seoScorer, suggestions
│   ├── utils/, config/db.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🚀 Quick start (local)

### 1. Prerequisites
- Node.js 18+ (`node -v`)
- npm 9+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)

### 2. Backend
```bash
cd server
npm install
cp .env.example .env       # then edit .env (see below)
npm run dev                # starts on http://localhost:5000
```

### 3. Frontend (new terminal)
```bash
cd client
npm install
npm run dev                # starts on http://localhost:5173
```

Open <http://localhost:5173>, register a new account, and start generating.

> **The app works without any AI keys.** When OpenAI/Claude/Gemini keys are missing, the pipeline falls back to mock content so you can develop and demo locally. Add real keys for production-quality output.

---

## 🔑 Environment variables

Copy `server/.env.example` → `server/.env` and fill in:

| Variable | Required? | Where to get it |
|---|---|---|
| `MONGO_URI` | ✅ | <https://www.mongodb.com/atlas> (free) or `mongodb://127.0.0.1:27017/contentforge` |
| `JWT_SECRET` | ✅ | Any long random string — `openssl rand -hex 32` |
| `OPENAI_API_KEY` | optional | <https://platform.openai.com/api-keys> |
| `ANTHROPIC_API_KEY` | optional | <https://console.anthropic.com/settings/keys> |
| `GOOGLE_GEMINI_API_KEY` | optional | <https://aistudio.google.com/apikey> |
| `SERPAPI_KEY` | optional | <https://serpapi.com> (100 free searches/mo) — without it, mock research is used |
| `UNSPLASH_ACCESS_KEY` | optional | <https://unsplash.com/developers> |
| `PORT` | optional | defaults to `5000` |

---

## 🧪 Test it

After signup, try generating with these inputs:

- **Topic:** *The Beginner's Guide to Cold Brew Coffee at Home*
- **Primary keyword:** `cold brew coffee`
- **Secondary keywords:** `coffee grounds, brew time, coffee ratio`
- **Tone:** Casual
- **Word count:** 1200

You should get a finished article in 30–60 seconds with sources, SEO breakdown, suggestions, and a before/after AI score.

---

## 🗺️ What's built vs. what's stubbed

### ✅ Fully implemented
- JWT auth (register/login/me) with bcrypt + plan-based word limits
- `/api/articles/generate` end-to-end pipeline: research → outline → write → SEO → humanize → persist
- All 5 tools endpoints: humanize, ai-detect, paraphrase, title-suggestions, seo-score
- Dashboard stats aggregation
- Web scraper with SerpAPI + Cheerio (mock fallback)
- Humanizer (deterministic + optional LLM rewrite)
- SEO scorer (Flesch-Kincaid, density, headings, meta, LSI, suggestions)
- All UI pages: Login, Register, Dashboard, Generator, ArticleView, History, Tools, Settings
- Light/dark theme, responsive sidebar, search, pagination, export (MD/HTML/TXT/copy)

### ⚠️ Stubbed / not yet built (per the original 8-phase plan)
- Stripe billing integration (plan UI is wired, payment isn't)
- Google OAuth login (email/password works)
- Email verification + forgot-password flow
- WordPress / Medium publish API
- Bull + Redis background queue (generation runs synchronously — fine up to ~90s)
- Version history (drafts collection scaffolded but not surfaced in UI)
- Plagiarism check (Copyscape/Originality.ai integration)
- Bulk CSV generation (Pro tier)
- TipTap rich-text editor (current editor is a themed `<textarea>` with markdown rendering)
- Production Docker testing (docker-compose included but not load-tested)

---

## 🐳 Docker (optional)

```bash
docker compose up --build
```

Spins up MongoDB + the API. The frontend still runs via `npm run dev` (Vite hot-reload is dev-only).

---

## 📜 License

MIT. Build something cool.
