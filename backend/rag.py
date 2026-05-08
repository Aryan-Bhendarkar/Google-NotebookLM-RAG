import os
import uuid
import asyncio
import tempfile
import logging

from dotenv import load_dotenv
from pydantic import SecretStr
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import ChatOpenAI
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

load_dotenv()
logger = logging.getLogger(__name__)

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_MODEL = "models/gemini-embedding-2"
EMBEDDING_DIMENSIONS = 3072
LLM_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
TOP_K = 5

def get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))

def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    return GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)

def get_llm(stream: bool = False) -> ChatOpenAI:
    return ChatOpenAI(
        model=LLM_MODEL,
        api_key=SecretStr(os.getenv("OPENROUTER_API_KEY") or ""),
        base_url=OPENROUTER_BASE_URL,
        temperature=0.3,
        max_completion_tokens=2048,
        streaming=stream,
    )

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len,
)

def extract_text_from_pdf(file_bytes: bytes) -> list[dict]:
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
    return [{"text": file_bytes.decode("utf-8", errors="replace"), "page_number": 1}]

def chunk_document(pages: list[dict]) -> list[dict]:
    chunks = []
    chunk_index = 0
    for page in pages:
        for chunk_text in text_splitter.split_text(page["text"]):
            chunks.append({
                "text": chunk_text,
                "metadata": {"page_number": page["page_number"], "chunk_index": chunk_index}
            })
            chunk_index += 1
    return chunks

async def ingest_document(file_bytes: bytes, filename: str, file_type: str) -> dict:
    loop = asyncio.get_event_loop()

    extract_fn = extract_text_from_pdf if file_type == "pdf" else extract_text_from_txt
    pages = await loop.run_in_executor(None, extract_fn, file_bytes)
    if not pages:
        raise ValueError("No text could be extracted from the document.")

    chunks = await loop.run_in_executor(None, chunk_document, pages)
    if not chunks:
        raise ValueError("Document produced no chunks after splitting.")

    document_id = str(uuid.uuid4())[:8]
    collection_name = f"doc_{document_id}"

    qdrant = get_qdrant_client()
    try:
        qdrant.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=EMBEDDING_DIMENSIONS, distance=Distance.COSINE),
        )
    except Exception as e:
        if "already exists" not in str(e).lower():
            raise

    texts = [c["text"] for c in chunks]
    metadatas = [{**c["metadata"], "filename": filename, "document_id": document_id} for c in chunks]

    qdrant_url = os.getenv("QDRANT_URL")
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    embeddings = get_embeddings()

    def _store_vectors():
        QdrantVectorStore.from_texts(
            texts=texts,
            embedding=embeddings,
            collection_name=collection_name,
            url=qdrant_url,
            api_key=qdrant_api_key,
            metadatas=metadatas,
        )

    await loop.run_in_executor(None, _store_vectors)

    logger.info(f"Ingestion complete: {document_id}, {len(chunks)} chunks, {len(pages)} pages")
    return {
        "document_id": document_id,
        "collection_name": collection_name,
        "filename": filename,
        "chunk_count": len(chunks),
        "page_count": len(pages),
    }

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

async def retrieve_and_generate(query: str, collection_name: str, stream: bool = True):
    vector_store = QdrantVectorStore.from_existing_collection(
        embedding=get_embeddings(),
        collection_name=collection_name,
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )

    results = vector_store.similarity_search_with_score(query, k=TOP_K)
    
    context_parts = []
    sources = []
    for doc, score in results:
        page_num = doc.metadata.get("page_number", "?")
        context_parts.append(f"[Page {page_num}] {doc.page_content}")
        sources.append({
            "page_number": page_num,
            "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
            "relevance_score": round(float(score), 4),
        })

    messages = [
        ("system", SYSTEM_PROMPT_TEMPLATE.format(context="\n\n---\n\n".join(context_parts))),
        ("human", query),
    ]

    if stream:
        async def generate():
            try:
                async for chunk in get_llm(stream=True).astream(messages):
                    if chunk.content:
                        yield chunk.content
            except Exception as e:
                logger.error(f"LLM streaming error: {e}", exc_info=True)
                yield f"\n\n[Error generating response: {str(e)}]"
        return generate, sources

    try:
        response = await get_llm(stream=False).ainvoke(messages)
        return response.content, sources
    except Exception as e:
        logger.error(f"LLM invocation error: {e}", exc_info=True)
        raise e
