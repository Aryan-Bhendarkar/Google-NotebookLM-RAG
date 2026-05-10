import sys, pdfplumber, re, glob, os
sys.stdout.reconfigure(encoding="utf-8")

# Find the uploaded PDF
search_paths = [
    "a:\\PROJECTS\\AI Projects\\NotebookLLM Clone\\**\\*.pdf",
    "C:\\Users\\ARYAN BHENDARKAR\\Downloads\\*.pdf",
    "C:\\Users\\ARYAN BHENDARKAR\\Desktop\\*.pdf",
    "a:\\PROJECTS\\**\\*.pdf",
]

pdfs = []
for p in search_paths:
    pdfs.extend(glob.glob(p, recursive=True))

print("PDFs found:")
for p in pdfs:
    print(" ", p)
