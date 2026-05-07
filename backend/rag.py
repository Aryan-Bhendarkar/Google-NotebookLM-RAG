"""
rag.py — RAG Pipeline Utilities
================================
Handles the full RAG pipeline:
  1. Document Loading (PDF / TXT)
  2. Chunking (Recursive Character Text Splitting)
  3. Embedding (Google Gemini gemini-embedding-2)
  4. Vector Storage (Qdrant Cloud)
  5. Retrieval & Generation (OpenRouter — free Llama/Gemma models)

Chunking Strategy:
------------------
We use RecursiveCharacterTextSplitter with:
  - chunk_size=1000: Each chunk is ~1000 characters, roughly a paragraph.
    This balances having enough context per chunk while keeping embeddings focused.
  - chunk_overlap=200: 200-char overlap between adjacent chunks ensures that
    sentences split at chunk boundaries are still captured in at least one chunk,
    preventing loss of context at the edges.
  - separators=["\n\n", "\n", ". ", " ", ""]: Splits on natural boundaries first
    (paragraphs, then lines, then sentences) before falling back to character-level.
"""

import os
import uuid
import tempfile
import logging

from dotenv import load_dotenv
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import ChatOpenAI
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

load_dotenv()

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────────────────────────

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_MODEL = "models/gemini-embedding-2"
EMBEDDING_DIMENSIONS = 3072  # gemini-embedding-2 outputs 3072-dim vectors

# Free model on OpenRouter — no credits needed
LLM_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

TOP_K = 5  # Number of chunks to retrieve

# ─── Clients ─────────────────────────────────────────────────────────────────

def get_qdrant_client() -> QdrantClient:
    """Initialize Qdrant Cloud client."""
    return QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )


def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    """Initialize Google Gemini embedding model."""
    return GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )


def get_llm(stream: bool = False) -> ChatOpenAI:
    """Initialize OpenRouter LLM (free tier, OpenAI-compatible)."""
    return ChatOpenAI(
        model=LLM_MODEL,
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        openai_api_base=OPENROUTER_BASE_URL,
        temperature=0.3,
        max_tokens=2048,
        streaming=stream,
    )


# ─── Text Splitter ───────────────────────────────────────────────────────────

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len,
)


# ─── Document Processing ────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> list[dict]:
    """
    Extract text from a PDF file, returning a list of dicts with
    'text' and 'page_number' for each page.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        reader = PdfReader(tmp_path)
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"text": text, "page_number": i + 1})
        return pages
    finally:
        os.unlink(tmp_path)


def extract_text_from_txt(file_bytes: bytes) -> list[dict]:
    """Extract text from a plain text file."""
    text = file_bytes.decode("utf-8", errors="replace")
    return [{"text": text, "page_number": 1}]


def chunk_document(pages: list[dict]) -> list[dict]:
    """
    Split document pages into chunks using RecursiveCharacterTextSplitter.
    Each chunk includes metadata (page_number, chunk_index).
    """
    chunks = []
    chunk_index = 0

    for page in pages:
        page_chunks = text_splitter.split_text(page["text"])
        for chunk_text in page_chunks:
            chunks.append({
                "text": chunk_text,
                "metadata": {
                    "page_number": page["page_number"],
                    "chunk_index": chunk_index,
                },
            })
            chunk_index += 1

    return chunks


# ─── Indexing (Ingestion Pipeline) ──────────────────────────────────────────

async def ingest_document(
    file_bytes: bytes,
    filename: str,
    file_type: str,
) -> dict:
    """
    Full ingestion pipeline:
      1. Extract text from PDF/TXT
      2. Chunk the text
      3. Generate embeddings via Google Gemini
      4. Store in Qdrant Cloud

    Returns:
      dict with document_id, filename, chunk_count, page_count
    """
    # Step 1: Extract text
    if file_type == "pdf":
        pages = extract_text_from_pdf(file_bytes)
    else:
        pages = extract_text_from_txt(file_bytes)

    if not pages:
        raise ValueError("No text could be extracted from the document.")

    # Step 2: Chunk
    chunks = chunk_document(pages)
    if not chunks:
        raise ValueError("Document produced no chunks after splitting.")

    # Step 3 & 4: Embed and store in Qdrant
    document_id = str(uuid.uuid4())[:8]
    collection_name = f"doc_{document_id}"

    # Create collection in Qdrant
    qdrant = get_qdrant_client()
    qdrant.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=EMBEDDING_DIMENSIONS,
            distance=Distance.COSINE,
        ),
    )

    # Prepare texts and metadata for LangChain
    texts = [c["text"] for c in chunks]
    metadatas = [
        {
            **c["metadata"],
            "filename": filename,
            "document_id": document_id,
        }
        for c in chunks
    ]

    # Use LangChain's QdrantVectorStore to embed and store
    embeddings = get_embeddings()
    QdrantVectorStore.from_texts(
        texts=texts,
        embedding=embeddings,
        collection_name=collection_name,
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
        metadatas=metadatas,
    )

    return {
        "document_id": document_id,
        "collection_name": collection_name,
        "filename": filename,
        "chunk_count": len(chunks),
        "page_count": len(pages),
    }


# ─── Retrieval & Generation ─────────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are an intelligent AI assistant that answers questions strictly based on the provided document context.

RULES:
1. ONLY answer based on the provided context from the document.
2. If the answer is not found in the context, say: "I couldn't find this information in the uploaded document."
3. Always cite the page number(s) where you found the information.
4. Be clear, concise, and well-structured in your responses.
5. Use markdown formatting for better readability.

CONTEXT FROM DOCUMENT:
{context}
"""


async def retrieve_and_generate(
    query: str,
    collection_name: str,
    stream: bool = True,
):
    """
    Retrieval + Generation pipeline:
      1. Embed the user query via Google Gemini
      2. Search Qdrant for top-K similar chunks
      3. Build prompt with retrieved context
      4. Generate answer via OpenRouter LLM with optional streaming
    """
    # Step 1 & 2: Retrieve relevant chunks
    embeddings = get_embeddings()
    vector_store = QdrantVectorStore.from_existing_collection(
        embedding=embeddings,
        collection_name=collection_name,
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )

    results = vector_store.similarity_search_with_score(query, k=TOP_K)

    # Format context with page numbers
    context_parts = []
    sources = []
    for doc, score in results:
        page_num = doc.metadata.get("page_number", "?")
        context_parts.append(
            f"[Page {page_num}] {doc.page_content}"
        )
        sources.append({
            "page_number": page_num,
            "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
            "relevance_score": round(float(score), 4),
        })

    context = "\n\n---\n\n".join(context_parts)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context)

    messages = [
        ("system", system_prompt),
        ("human", query),
    ]

    if stream:
        async def generate():
            try:
                llm = get_llm(stream=True)
                async for chunk in llm.astream(messages):
                    if chunk.content:
                        yield chunk.content
            except Exception as e:
                logger.error(f"LLM streaming error: {e}", exc_info=True)
                yield f"\n\n[Error generating response: {str(e)}]"

        return generate, sources
    else:
        try:
            llm = get_llm(stream=False)
            response = await llm.ainvoke(messages)
            return response.content, sources
        except Exception as e:
            logger.error(f"LLM generation error: {e}", exc_info=True)
            raise
