import "server-only";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText as extractPdfText } from "unpdf";

import { MATERIAL_UPLOAD_MAX_BYTES } from "@/shared/contracts/material-upload";
export const MAX_MATERIAL_BYTES = MATERIAL_UPLOAD_MAX_BYTES;
export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md"];

export function isSupportedMaterial(filename: string) {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function extensionOf(filename: string) {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function normalize(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function xmlText(xml: string) {
  const matches = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? [];
  return decodeXmlEntities(
    matches.map((item) => item.replace(/<[^>]+>/g, "")).join(" "),
  );
}

async function extractPptx(buffer: Uint8Array) {
  const zip = await JSZip.loadAsync(buffer);
  const number = (value: string) =>
    Number(value.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => number(a) - number(b));
  const noteNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort((a, b) => number(a) - number(b));
  const pages: string[] = [];
  for (const name of [...slideNames, ...noteNames]) {
    const file = zip.file(name);
    if (!file) continue;
    const text = normalize(xmlText(await file.async("text")));
    if (text) pages.push(text);
  }
  return pages.join("\n\n");
}

export async function extractMaterialText(
  buffer: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<string> {
  if (buffer.byteLength === 0) throw new Error("The uploaded file is empty.");
  if (buffer.byteLength > MAX_MATERIAL_BYTES)
    throw new Error("The uploaded file must be smaller than 5 MB.");

  const extension = extensionOf(filename);
  const mime = mimeType.toLowerCase();
  let text = "";

  if (extension === ".pdf" || mime === "application/pdf") {
    const result = await extractPdfText(buffer.slice(), { mergePages: true });
    text = result.text;
  } else if (
    extension === ".docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(buffer),
    });
    text = result.value;
  } else if (
    extension === ".pptx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    text = await extractPptx(buffer);
  } else if (
    extension === ".txt" ||
    extension === ".md" ||
    mime.startsWith("text/")
  ) {
    text = new TextDecoder("utf-8").decode(buffer);
  } else {
    throw new Error(
      "Unsupported file type. Upload PDF, DOCX, PPTX, TXT or Markdown.",
    );
  }

  const normalized = normalize(text);
  if (!normalized)
    throw new Error(
      "No readable text was found in this file. Scanned PDFs need OCR first.",
    );
  return normalized;
}
