# NotebookLM Clone (Free Tier Architecture)

A Retrieval-Augmented Generation (RAG) powered web application that allows users to upload documents (PDF/TXT) and chat with them. 
This project uses a 100% free-tier architecture to accomplish what NotebookLM does.

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **UI:** shadcn/ui, Tailwind CSS v4, Framer Motion
- **Language:** TypeScript
- **Design:** Dark glassmorphism premium UI

### Backend
- **Framework:** Python FastAPI
- **RAG Orchestration:** LangChain
- **Embeddings:** Google Gemini (`gemini-embedding-2`) - **FREE**
- **LLM:** Groq (`qwen/qwen3-32b`) - **FREE**
- **Vector Database:** Qdrant Cloud - **FREE**

## Architecture & Chunking Strategy

When a user uploads a document:
1. **Extraction:** PyPDF reads text from the document.
2. **Chunking:** `RecursiveCharacterTextSplitter` splits text.
   - `chunk_size=1000`: Optimal size for semantic completeness.
   - `chunk_overlap=200`: Ensures no context is lost at boundaries.
3. **Embedding:** Chunks are sent to Google Gemini for vectorization.
4. **Storage:** Vectors are stored in Qdrant Cloud under a unique collection ID.
5. **Retrieval:** User queries are embedded, matched against Qdrant, and the top 5 chunks are sent to Groq Llama 3.3 for grounded generation.

## Setup Instructions

### 1. Backend Setup
1. Get a [Groq API Key](https://console.groq.com/keys)
2. Get a [Google Gemini API Key](https://aistudio.google.com/app/apikey)
3. Get a [Qdrant Cloud URL and API Key](https://cloud.qdrant.io/)
4. Navigate to `backend/`
5. Create `.env` file from `.env.example` and add your keys
6. `python -m venv venv`
7. `venv\Scripts\pip install -r requirements.txt`
8. `venv\Scripts\uvicorn main:app --reload` (Runs on port 8000)

### 2. Frontend Setup
1. Navigate to `frontend/`
2. `npm install`
3. `npm run dev` (Runs on port 3000)

## Deployment
- **Frontend:** Ready to deploy on Vercel. Connect your GitHub repo.
- **Backend:** Ready to deploy on Render via Docker or Native Python Environment.
