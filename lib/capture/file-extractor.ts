"use client";

let pdfWorkerConfigured = false;

async function getPdfJs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

async function ensurePdfWorker() {
  if (pdfWorkerConfigured) return;
  const { GlobalWorkerOptions } = await getPdfJs();
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  pdfWorkerConfigured = true;
}

async function readTextFile(file: File) {
  return file.text();
}

async function extractTextFromPdf(file: File) {
  await ensurePdfWorker();
  const { getDocument } = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
}

async function extractTextFromImage(file: File) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromFile(file: File) {
  if (file.type.startsWith("text/") || file.type === "application/json") {
    return readTextFile(file);
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return extractTextFromPdf(file);
  }

  if (file.type.startsWith("image/")) {
    return extractTextFromImage(file);
  }

  throw new Error(`Unsupported file type: ${file.type || file.name}`);
}

export async function extractTextFromFiles(files: File[]) {
  const outputs: string[] = [];

  for (const file of files) {
    const text = await extractTextFromFile(file);
    if (text.trim()) {
      outputs.push(text.trim());
    }
  }

  return outputs;
}
