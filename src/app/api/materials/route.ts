import { NextResponse } from "next/server";
import {
  createMaterial,
  getSessionUser,
  appendMaterialChunk,
  discardMaterialUpload,
} from "@/modules/platform";
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
    return NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 },
    );

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

  const filename = (file.name.split(/[\\/]/).pop() ?? "material").slice(0, 255);
  if (!isSupportedMaterial(filename))
    return NextResponse.json(
      { error: "Upload a PDF, DOCX, PPTX, TXT or Markdown file." },
      { status: 400 },
    );
  if (file.size > MAX_MATERIAL_BYTES)
    return NextResponse.json(
      { error: "The file must be smaller than 5 MB." },
      { status: 400 },
    );

  let content: Uint8Array = new Uint8Array(await file.arrayBuffer());
  const uploadId = form.get("uploadId");
  let sizeBytes = file.size;
  if (uploadId !== null) {
    try {
      sizeBytes = Number(form.get("totalBytes"));
      const complete = await appendMaterialChunk(
        user,
        {
          id: uploadId,
          filename,
          mimeType: file.type || "application/octet-stream",
          totalBytes: sizeBytes,
          offset: Number(form.get("offset")),
        },
        content,
      );
      if (!complete) return NextResponse.json({ pending: true });
      content = complete;
    } catch {
      return NextResponse.json(
        {
          error:
            "The file could not be assembled. Please retry the upload; if it persists, check that database migrations are applied.",
        },
        { status: 400 },
      );
    }
  }
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
      sizeBytes,
      content,
      extractedText,
      uploadId: typeof uploadId === "string" ? uploadId : undefined,
    });
    if (typeof uploadId === "string")
      await discardMaterialUpload(user, uploadId);
    return NextResponse.json({
      id: material.id,
      filename: material.filename,
      mimeType: material.mimeType,
      sizeBytes: material.sizeBytes,
      extractedCharacters: extractedText.length,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "The file could not be saved. Please check database connectivity and initialization.",
      },
      { status: 500 },
    );
  }
}
