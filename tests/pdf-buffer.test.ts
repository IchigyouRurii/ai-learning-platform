import { expect, it, vi } from "vitest";
vi.mock("unpdf", () => ({
  extractText: async (bytes: Uint8Array) => {
    structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
    return { text: "Extracted course notes" };
  },
}));
import { extractMaterialText } from "@/modules/course-generation/server/materials";
it("preserves source PDF bytes when the parser transfers its buffer", async () => {
  const original = new TextEncoder().encode("%PDF-source-data");
  const before = original.slice();
  expect(
    await extractMaterialText(original, "book.pdf", "application/pdf"),
  ).toBe("Extracted course notes");
  expect(original).toEqual(before);
  expect(original.byteLength).toBe(before.byteLength);
});
