# NotebookLM Clone (Free Tier Architecture)

A Retrieval-Augmented Generation (RAG) powered web application that allows users to upload documents (PDF/TXT) and chat with them based strictly on their content.

This project employs a 100% free-tier architecture to replicate Google's NotebookLM functionality locally.

## Project Structure

`
├── backend/                  # Python FastAPI Server
│   ├── main.py               # REST API endpoints (Upload, Chat)
│   ├── rag.py                # Core RAG logic (LangChain, Qdrant, OpenRouter)
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Next.js 16 React Client
│   ├── app/                  # Next.js App Router (layout, frontend pages)
│   ├── components/           # Reusable UI components (shadcn/ui, Chat, FileUpload)
│   └── package.json          # Node dependencies
└── README.md                 # Project Overview
`

## Tech Stack

### Frontend
- **Framework:** Next.js 15+ (App Router)
- **Styling/UI:** Tailwind CSS v4, shadcn/ui, Framer Motion
- **Language:** TypeScript

### Backend
- **Framework:** Python FastAPI
- **RAG Orchestration:** LangChain
- **Embeddings:** Google Gemini (gemini-embedding-2) - *Free Tier*
- **LLM Provider:** OpenRouter (
vidia/nemotron-3-super-120b-a12b:free) - *Free Tier*
- **Vector Database:** Qdrant Cloud - *Free Tier*

## Setup Instructions

### 1. Backend Setup
1. Claim an [OpenRouter API Key](https://openrouter.ai/keys)
2. Claim a [Google Gemini API Key](https://aistudio.google.com/app/apikey)
3. Claim a [Qdrant Cloud URL and API Key](https://cloud.qdrant.io/)
4. Navigate to ackend/ and configure environment variables in .env:
   `nv
   GOOGLE_API_KEY="your_google_key"
   OPENROUTER_API_KEY="your_openrouter_key"
   QDRANT_URL="your_qdrant_url"
   QDRANT_API_KEY="your_qdrant_api_key"
   `
5. Install dependencies and run:
   `ash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # On Windows
   pip install -r requirements.txt
   uvicorn main:app --reload
   `

### 2. Frontend Setup
`ash
cd frontend
npm install
npm run dev
`

The application will be accessible at http://localhost:3000.
