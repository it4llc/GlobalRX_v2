# Test Fixtures

This directory contains test files used by the end-to-end tests.

## Creating Test PDF Files

To create the test PDF files needed for the document upload tests, you can use any of these methods:

### Method 1: Using a text editor
1. Create a new document in any text editor
2. Add some sample text
3. Export/Print as PDF

### Method 2: Using command line (macOS/Linux)
```bash
echo "Test document content" | enscript -B -o - | ps2pdf - test-document.pdf
```

### Method 3: Using online tools
Visit any online "text to PDF" converter and create simple PDF files.

## Required Test Files

The following PDF files are needed for the tests to run:

- `test-document.pdf` - Generic test document
- `first-document.pdf` - For replacement test (first upload)
- `second-document.pdf` - For replacement test (second upload)
- `transcript.pdf` - Education verification test
- `diploma.pdf` - Education verification test
- `auth-form.pdf` - Authorization form test
- `authorization.pdf` - Background check test
- `test-doc.pdf` - Summary display test
- `malicious.exe` - Invalid file type test (just create empty text file with .exe extension)

## Creating the files quickly

Run this script to create all needed test files:

```bash
#!/bin/bash

# Create simple PDF files
for file in test-document first-document second-document transcript diploma auth-form authorization test-doc; do
  echo "This is a test PDF file: $file" > temp.txt
  # On macOS:
  textutil -convert pdf temp.txt -output "${file}.pdf" 2>/dev/null || \
  # On Linux with LibreOffice:
  libreoffice --headless --convert-to pdf temp.txt --outdir . && mv temp.pdf "${file}.pdf" 2>/dev/null || \
  # Fallback: just create a text file
  echo "%PDF-1.4
Test content for ${file}" > "${file}.pdf"
done

# Create fake executable
touch malicious.exe

# Clean up
rm -f temp.txt

echo "Test fixtures created successfully!"
```

Note: The actual content of the PDF files doesn't matter for the tests - they just need to be valid files with the correct extensions.