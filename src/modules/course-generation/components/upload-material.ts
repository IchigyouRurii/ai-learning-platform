import {
  MATERIAL_UPLOAD_CHUNK_BYTES,
  MATERIAL_UPLOAD_MAX_BYTES,
} from "@/shared/contracts/material-upload";
export type UploadedMaterial = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedCharacters: number;
};

export type UploadProgress = {
  phase: "uploading" | "finishing";
  percent: number;
};
export async function uploadMaterial(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadedMaterial> {
  if (!file.size) throw new Error("The uploaded file is empty.");
  if (file.size > MATERIAL_UPLOAD_MAX_BYTES)
    throw new Error("The file must be smaller than 5 MB.");
  const uploadId = crypto.randomUUID();
  for (
    let offset = 0;
    offset < file.size;
    offset += MATERIAL_UPLOAD_CHUNK_BYTES
  ) {
    const finalChunk = offset + MATERIAL_UPLOAD_CHUNK_BYTES >= file.size;
    onProgress?.({
      phase: finalChunk ? "finishing" : "uploading",
      percent: Math.round((offset / file.size) * 100),
    });
    const body = new FormData();
    body.append(
      "file",
      file.slice(offset, offset + MATERIAL_UPLOAD_CHUNK_BYTES, file.type),
      file.name,
    );
    body.append("uploadId", uploadId);
    body.append("offset", String(offset));
    body.append("totalBytes", String(file.size));
    const response = await fetch("/api/materials", { method: "POST", body });
    let data: Partial<UploadedMaterial> & { error?: string; pending?: boolean };
    try {
      data = await response.json();
    } catch {
      if (response.status === 413)
        throw new Error(
          "The server rejected the upload size. Please reload and retry.",
        );
      throw new Error(
        "The upload service returned an unexpected response. Please try again.",
      );
    }
    if (!response.ok)
      throw new Error(data.error ?? "The upload failed. Please try again.");
    if (finalChunk) {
      if (!data.id || !data.filename || typeof data.sizeBytes !== "number")
        throw new Error("The upload was not completed. Please try again.");
      return data as UploadedMaterial;
    }
    if (!data.pending)
      throw new Error("Unexpected upload state. Please try again.");
  }
  throw new Error("The upload was not completed.");
}
