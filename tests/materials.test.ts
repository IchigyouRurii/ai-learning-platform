import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  extractMaterialText,
  isSupportedMaterial,
} from "@/modules/course-generation/server/materials";

describe("course material extraction", () => {
  it("accepts the supported attachment types", () => {
    for (const name of ["a.pdf", "b.DOCX", "c.pptx", "d.txt", "e.md"])
      expect(isSupportedMaterial(name)).toBe(true);
    for (const name of ["a.doc", "b.ppt", "c.exe", "d.png"])
      expect(isSupportedMaterial(name)).toBe(false);
  });

  it("extracts and normalizes plain text", async () => {
    const text = await extractMaterialText(
      new TextEncoder().encode("Line one\r\n\r\n\r\nLine two"),
      "notes.txt",
      "text/plain",
    );
    expect(text).toBe("Line one\n\nLine two");
  });

  it("extracts text from PPTX slide XML", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide1.xml",
      "<p:sld><a:p><a:t>Faust makes a bargain.</a:t></a:p></p:sld>",
    );
    zip.file(
      "ppt/slides/slide2.xml",
      "<p:sld><a:p><a:t>Mephistopheles returns.</a:t></a:p></p:sld>",
    );
    const buffer = await zip.generateAsync({ type: "uint8array" });
    const text = await extractMaterialText(
      buffer,
      "faust.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(text).toContain("Faust makes a bargain.");
    expect(text).toContain("Mephistopheles returns.");
  });

  it("rejects empty or unsupported files", async () => {
    await expect(
      extractMaterialText(new Uint8Array(), "empty.pdf", "application/pdf"),
    ).rejects.toThrow("empty");
    await expect(
      extractMaterialText(
        new TextEncoder().encode("hello"),
        "legacy.doc",
        "application/msword",
      ),
    ).rejects.toThrow("Unsupported");
  });
});

// Reject at the exact boundary before parsing or accessing external services.
it("rejects new attachments at 5 MB before extraction", async () => {
  await expect(
    extractMaterialText(new Uint8Array(5_000_000), "large.txt", "text/plain"),
  ).rejects.toThrow("smaller than 5 MB");
});
