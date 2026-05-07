from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging

from rag import ingest_document, retrieve_and_generate

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NotebookLM Clone API",
    description="RAG-powered backend for interacting with uploaded documents.",
    version="1.0.0",
)

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, restrict this to the frontend URL
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
    """
    Endpoint to upload a PDF or TXT file, parse it, chunk it, and index it into Qdrant.
    """
    logger.info(f"Received upload request for file: {file.filename}")
    
    # Validate file type
    if not file.filename.lower().endswith(('.pdf', '.txt')):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")
    
    file_type = "pdf" if file.filename.lower().endswith('.pdf') else "txt"
    
    try:
        # Read file content
        file_bytes = await file.read()
        
        # Process and ingest
        result = await ingest_document(
            file_bytes=file_bytes,
            filename=file.filename,
            file_type=file_type
        )
        
        logger.info(f"Successfully ingested document: {result['document_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error during ingestion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.post("/chat")
async def chat_with_document(request: ChatRequest):
    """
    Endpoint to ask a question based on a specific document collection.
    """
    logger.info(f"Received chat request for collection: {request.collection_name}")
    
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        result, sources = await retrieve_and_generate(
            query=request.query,
            collection_name=request.collection_name,
            stream=request.stream
        )
        
        if request.stream:
            async def event_generator():
                async for chunk in result():
                    yield chunk

            return StreamingResponse(event_generator(), media_type="text/plain")
        else:
            return {
                "answer": result,
                "sources": sources
            }
            
    except Exception as e:
        logger.error(f"Error during chat retrieval/generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
