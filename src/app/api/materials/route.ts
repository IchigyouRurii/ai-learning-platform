import { NextResponse } from "next/server";
import { createMaterial, getSessionUser } from "@/modules/platform";
import {
  MAX_MATERIAL_BYTES,
  extractMaterialText,
  isSupportedMaterial,
} from "@/modules/course-generation/server/materials";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "The upload could not be read." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Choose a file to upload." },
      { status: 400 },
    );

  const filename = (file.name.split(/[\\/]/).pop() ?? "material").slice(
    0,
    255,
  );
  if (!isSupportedMaterial(filename))
    return NextResponse.json(
      { error: "Upload a PDF, DOCX, PPTX, TXT or Markdown file." },
      { status: 400 },
    );
  if (file.size > MAX_MATERIAL_BYTES)
    return NextResponse.json(
      { error: "The file is larger than 20 MB." },
      { status: 400 },
    );

  const content = new Uint8Array(await file.arrayBuffer());
  let extractedText: string;
  try {
    extractedText = await extractMaterialText(
      content,
      filename,
      file.type || "application/octet-stream",
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The file text could not be extracted.",
      },
      { status: 400 },
    );
  }

  try {
    const material = await createMaterial(user, {
      filename,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      content,
      extractedText,
    });
    return NextResponse.json({
      id: material.id,
      filename: material.filename,
      mimeType: material.mimeType,
      sizeBytes: material.sizeBytes,
      extractedCharacters: extractedText.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The upload failed.",
      },
      { status: 500 },
    );
  }
}
