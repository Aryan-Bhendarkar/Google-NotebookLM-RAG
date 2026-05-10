import os
import io
import re
import json
import uuid
import time
import asyncio
import tempfile
import logging

import pdfplumber
import pypdfium2
from google import genai as google_genai
from google.genai import types as google_types
from dotenv import load_dotenv
from pydantic import SecretStr
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

load_dotenv()
logger = logging.getLogger(__name__)

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 400
EMBEDDING_MODEL = "models/gemini-embedding-2"
EMBEDDING_DIMENSIONS = 3072
LLM_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
TOP_K = 10
EMBED_BATCH = 5


def get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))


def embed_texts(texts: list[str], task_type: str) -> list[list[float]]:
    client = google_genai.Client(api_key=os.getenv("GOOGLE_API_KEY") or "")
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=google_types.EmbedContentConfig(task_type=task_type),
    )
    return [list(e.values) for e in response.embeddings]


def get_llm(stream: bool = False) -> ChatOpenAI:
    return ChatOpenAI(  # type: ignore[call-arg]
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


def clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _render_page_as_png(pdf_path: str, page_index: int) -> bytes:
    doc = pypdfium2.PdfDocument(pdf_path)  # type: ignore[attr-defined]
    try:
        page = doc[page_index]
        bitmap = page.render(scale=2.0)
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        return buf.getvalue()
    finally:
        doc.close()


def _ocr_page_with_gemini(image_bytes: bytes) -> str:
    client = google_genai.Client(api_key=os.getenv("GOOGLE_API_KEY") or "")
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            google_types.Content(parts=[
                google_types.Part(text=(
                    "Extract ALL text from this image exactly as it appears. "
                    "Preserve the structure: headings, bullet points, tables, numbered lists. "
                    "Return only the extracted text — no commentary."
                )),
                google_types.Part(
                    inline_data=google_types.Blob(mime_type="image/png", data=image_bytes)
                ),
            ])
        ],
    )
    return response.text or ""


def extract_text_from_pdf(file_bytes: bytes) -> list[dict]:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        pages = []
        with pdfplumber.open(tmp_path) as pdf:
            total = len(pdf.pages)
            logger.info(f"PDF has {total} pages")
            ocr_count = 0

            for i, page in enumerate(pdf.pages):
                text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""

                for table in (page.extract_tables() or []):
                    rows = [
                        " | ".join(cell or "" for cell in row)
                        for row in table if row
                    ]
                    if rows:
                        text += "\n\nTable:\n" + "\n".join(rows)

                text = clean_text(text)

                if not text:
                    try:
                        logger.info(f"Page {i + 1}/{total}: no selectable text — running Gemini OCR")
                        image_bytes_page = _render_page_as_png(tmp_path, i)
                        text = clean_text(_ocr_page_with_gemini(image_bytes_page))
                        if text:
                            ocr_count += 1
                    except Exception as e:
                        logger.warning(f"Page {i + 1}/{total}: OCR failed — {e}")

                if text:
                    pages.append({"text": text, "page_number": i + 1})
                else:
                    logger.warning(f"Page {i + 1}/{total}: blank even after OCR, skipping")

        logger.info(
            f"Extracted {len(pages)}/{total} pages "
            f"({len(pages) - ocr_count} direct + {ocr_count} via OCR)"
        )
        return pages
    finally:
        os.unlink(tmp_path)


def extract_text_from_txt(file_bytes: bytes) -> list[dict]:
    text = clean_text(file_bytes.decode("utf-8", errors="replace"))
    return [{"text": text, "page_number": 1}] if text else []


def chunk_document(pages: list[dict]) -> list[dict]:
    chunks = []
    chunk_index = 0
    for page in pages:
        for chunk_text in text_splitter.split_text(page["text"]):
            chunks.append({
                "text": chunk_text,
                "metadata": {"page_number": page["page_number"], "chunk_index": chunk_index},
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

    def _store_vectors():
        total = len(texts)
        for start in range(0, total, EMBED_BATCH):
            end = min(start + EMBED_BATCH, total)
            batch_texts = texts[start:end]
            batch_metas = metadatas[start:end]

            for attempt in range(3):
                try:
                    vectors = embed_texts(batch_texts, "RETRIEVAL_DOCUMENT")
                    points = [
                        PointStruct(
                            id=str(uuid.uuid4()),
                            vector=vector,
                            payload={"page_content": text, **meta},
                        )
                        for text, meta, vector in zip(batch_texts, batch_metas, vectors)
                    ]
                    qdrant.upsert(collection_name=collection_name, points=points)
                    logger.info(f"Embedded chunks {start + 1}–{end}/{total}")
                    break
                except Exception as e:
                    wait = 10 * (attempt + 1)
                    logger.warning(f"Batch {start}–{end} attempt {attempt + 1} failed ({e}), retrying in {wait}s")
                    if attempt < 2:
                        time.sleep(wait)
                    else:
                        raise

            if end < total:
                time.sleep(1)

        stored = qdrant.count(collection_name=collection_name).count
        logger.info(f"Verified {stored} vectors in Qdrant (expected {total})")

    await loop.run_in_executor(None, _store_vectors)

    stored_count = qdrant.count(collection_name=collection_name).count
    logger.info(f"Ingestion complete: {document_id}, {stored_count}/{len(chunks)} chunks stored, {len(pages)} pages")
    return {
        "document_id": document_id,
        "collection_name": collection_name,
        "filename": filename,
        "chunk_count": stored_count,
        "page_count": len(pages),
    }


SYSTEM_PROMPT_TEMPLATE = """You are an expert document analyst. Answer ONLY from the context provided below.

FORMATTING RULES:
- Use markdown formatting throughout: ## for headings, **bold** for key terms, bullet lists (-) for enumerations, numbered lists for steps
- Keep each paragraph to 3-4 sentences maximum
- Use code blocks (```) for any code, commands, or technical strings

CITATION RULES:
- Cite inline immediately after each fact, like this: **[Page 3]**
- If a fact spans multiple pages, cite all of them: **[Page 3]** **[Page 7]**
- At the end of your answer, add a "## Sources" section that lists every page you cited

CONTEXT FROM DOCUMENT:
{context}

If the information is not present in the context above, respond with exactly:
"I couldn't find this information in the uploaded document."
"""


async def retrieve_and_generate(query: str, collection_name: str, stream: bool = True):
    qdrant = get_qdrant_client()

    query_vector = embed_texts([query], "RETRIEVAL_QUERY")[0]

    results = qdrant.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=TOP_K,
        with_payload=True,
    )

    context_parts = []
    sources = []
    for result in results:
        page_num = result.payload.get("page_number", "?")
        content = result.payload.get("page_content", "")
        context_parts.append(f"[Page {page_num}]\n{content}")
        sources.append({
            "page_number": page_num,
            "content": content[:200] + "..." if len(content) > 200 else content,
            "relevance_score": round(float(result.score), 4),
        })

    messages = [
        ("system", SYSTEM_PROMPT_TEMPLATE.format(context="\n\n---\n\n".join(context_parts))),
        ("human", query),
    ]

    if stream:
        async def generate():
            yield json.dumps({"t": "sources", "d": sources}) + "\n"
            try:
                async for chunk in get_llm(stream=True).astream(messages):
                    if chunk.content:
                        yield json.dumps({"t": "chunk", "d": chunk.content}) + "\n"
            except Exception as e:
                logger.error(f"LLM streaming error: {e}", exc_info=True)
                yield json.dumps({"t": "error", "d": str(e)}) + "\n"
        return generate, sources

    try:
        response = await get_llm(stream=False).ainvoke(messages)
        return response.content, sources
    except Exception as e:
        logger.error(f"LLM invocation error: {e}", exc_info=True)
        raise
