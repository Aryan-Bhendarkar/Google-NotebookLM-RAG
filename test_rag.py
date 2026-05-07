import os
import requests
import json
import time

API_URL = "http://127.0.0.1:8000"

# 1. Create a dummy test file
test_filename = "test_document.txt"
with open(test_filename, "w") as f:
    f.write("NotebookLM is a fantastic tool for analyzing documents. It was created by Google. It uses Retrieval Augmented Generation.")

print("Testing /upload endpoint...")
with open(test_filename, "rb") as f:
    response = requests.post(f"{API_URL}/upload", files={"file": f})

print(f"Upload Status Code: {response.status_code}")
if response.status_code != 200:
    print("Error:", response.text)
    exit(1)

data = response.json()
print("Upload Response:", json.dumps(data, indent=2))

document_id = data["document_id"]
collection_name = data["collection_name"]

print("\nTesting /chat endpoint...")
payload = {
    "query": "Who created NotebookLM?",
    "collection_name": collection_name,
    "stream": True
}

response = requests.post(f"{API_URL}/chat", json=payload, stream=True)
print(f"Chat Status Code: {response.status_code}")

if response.status_code != 200:
    print("Error:", response.text)
    exit(1)

print("Streaming Response:")
for chunk in response.iter_content(chunk_size=1024):
    if chunk:
        print(chunk.decode("utf-8"), end="", flush=True)

print("\n\nTest completed successfully!")
