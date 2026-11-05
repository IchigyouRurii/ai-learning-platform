import { afterEach, expect, it, vi } from "vitest";
import { uploadMaterial } from "@/modules/course-generation/components/upload-material";
afterEach(() => vi.unstubAllGlobals());
it("splits a large file into bounded requests, preserving filename and order", async () => {
  const file = new File([new Uint8Array(4_999_999)], "book.pdf", {
    type: "application/pdf",
  });
  const chunks: { offset: number; size: number; id: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const form = init.body as FormData;
      const part = form.get("file") as File;
      expect(part.name).toBe("book.pdf");
      expect(Number(form.get("totalBytes"))).toBe(file.size);
      chunks.push({
        offset: Number(form.get("offset")),
        size: part.size,
        id: String(form.get("uploadId")),
      });
      return Response.json(
        chunks.length === 2
          ? {
              id: "saved",
              filename: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              extractedCharacters: 42,
            }
          : { pending: true },
      );
    }),
  );
  expect((await uploadMaterial(file)).id).toBe("saved");
  expect(chunks.map((chunk) => [chunk.offset, chunk.size])).toEqual([
    [0, 3_000_000],
    [3_000_000, 1_999_999],
  ]);
  expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(1);
});
it("reports non-JSON hosting errors and rejects oversized files before sending", async () => {
  const fetch = vi.fn(
    async () => new Response("FUNCTION_PAYLOAD_TOO_LARGE", { status: 413 }),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(uploadMaterial(new File(["sample"], "a.pdf"))).rejects.toThrow(
    "upload size",
  );
  fetch.mockClear();
  await expect(
    uploadMaterial(new File([new Uint8Array(5_000_000)], "big.pdf")),
  ).rejects.toThrow("5 MB");
  expect(fetch).not.toHaveBeenCalled();
});
