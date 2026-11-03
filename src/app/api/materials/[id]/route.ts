import { NextResponse } from "next/server";
import { getMaterialForDownload, getSessionUser } from "@/modules/platform";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { id } = await params;
  try {
    const { material, content } = await getMaterialForDownload(user, id);
    const encoded = encodeURIComponent(material.filename);
    const body = new Uint8Array(content).buffer as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": material.mimeType || "application/octet-stream",
        "Content-Length": String(material.sizeBytes),
        "Content-Disposition": `attachment; filename="material"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Material not available.",
      },
      { status: 404 },
    );
  }
}
