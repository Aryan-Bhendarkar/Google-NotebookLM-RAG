from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging

from rag import ingest_document, retrieve_and_generate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NotebookLM Clone API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str
    collection_name: str
    stream: bool = True

@app.get("/")
def read_root():
    return {"status": "ok", "message": "NotebookLM Clone API is running."}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    logger.info(f"Uploading file: {file.filename}")
    
    if not file.filename.lower().endswith(('.pdf', '.txt')):
        raise HTTPException(status_code=400, detail="Only PDF and TXT supported.")
    
    file_type = "pdf" if file.filename.lower().endswith('.pdf') else "txt"
    
    try:
        file_bytes = await file.read()
        result = await ingest_document(file_bytes, file.filename, file_type)
        logger.info(f"Ingested doc: {result['document_id']}")
        return result
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_with_document(request: ChatRequest):
    logger.info(f"Chat request for: {request.collection_name}")
    
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        result, sources = await retrieve_and_generate(
            query=request.query,
            collection_name=request.collection_name,
            stream=request.stream
        )
        
        if request.stream:
            async def generate():
                async for chunk in result():
                    yield chunk
            return StreamingResponse(generate(), media_type="text/plain")
            
        return {"answer": result, "sources": sources}
            
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
