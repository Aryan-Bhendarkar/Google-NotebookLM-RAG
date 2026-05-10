# NotebookLM Clone

A RAG web app — upload a PDF or TXT document and chat with it using AI. Built on free-tier services.

**Live demo:** [google-notebooklm-rag-blue.vercel.app](https://google-notebooklm-rag-blue.vercel.app)

## Tech Stack

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Frontend   | Next.js 16, React 19, Tailwind CSS v4, TypeScript    |
| Backend    | Python 3.11+, FastAPI, LangChain                     |
| Embeddings | Google Gemini `models/gemini-embedding-2` (3072-dim) |
| LLM        | OpenRouter `nvidia/nemotron-3-super-120b-a12b:free`  |
| Vector DB  | Qdrant Cloud                                         |
| PDF        | pdfplumber + Gemini Vision OCR fallback              |

## Features

- Upload PDF or TXT (up to 10 MB)
- Full document extraction with OCR fallback for scanned pages
- Inline page citations `[Page N]` in every answer
- Streaming responses with source cards in the sidebar

## Setup

### Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`, API at `http://localhost:8000`.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

- `GOOGLE_API_KEY` — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- `OPENROUTER_API_KEY` — [openrouter.ai/keys](https://openrouter.ai/keys)
- `QDRANT_URL` and `QDRANT_API_KEY` — [cloud.qdrant.io](https://cloud.qdrant.io)

## Deployment

**Backend → Render:** connect repo, Render reads `render.yaml` automatically, add the four env vars above.

**Frontend → Vercel:** set root directory to `frontend`, add env var `NEXT_PUBLIC_API_URL=<your Render URL>`.
