import sys, pdfplumber, re
sys.stdout.reconfigure(encoding="utf-8")

PDF_PATH = input("Enter full path to your PDF: ").strip().strip('"')

def clean_text(text):
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()

try:
    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)
        print(f"\nTotal pages: {total}")
        empty = []
        for i, page in enumerate(pdf.pages):
            text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
            text = clean_text(text)
            if text:
                preview = text[:60].replace("\n", " ")
                print(f"  Page {i+1}: {len(text)} chars")
            else:
                empty.append(i+1)
                print(f"  Page {i+1}: EMPTY - image-only or blank")
        if empty:
            print(f"\n{len(empty)} pages are image-only (no selectable text): {empty}")
            print("These need OCR to extract. This is the root cause.")
        else:
            print(f"\nAll {total} pages extracted OK.")
except Exception as e:
    print(f"Error: {e}")
