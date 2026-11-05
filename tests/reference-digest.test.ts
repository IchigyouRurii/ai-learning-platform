import { expect, it } from "vitest";
import {
  compactReferenceMaterials,
  REFERENCE_DIGEST_CHARACTERS,
} from "@/modules/course-generation/server/reference-digest";
it("preserves short material unchanged", () => {
  expect(
    compactReferenceMaterials(" Team feedback. ", "Team", "Feedback"),
  ).toBe("Team feedback.");
});
it("selects relevant passages late in a long file rather than blindly truncating the beginning", () => {
  const body =
    "Unrelated history and preface. ".repeat(1500) +
    "\nConflict resolution requires active listening and negotiated priorities.\n" +
    "Unrelated appendix. ".repeat(600);
  const digest = compactReferenceMaterials(
    body,
    "Conflict resolution",
    "active listening negotiated priorities",
  );
  expect(digest.length).toBeLessThanOrEqual(REFERENCE_DIGEST_CHARACTERS);
  expect(digest).toContain("Conflict resolution requires active listening");
  expect(digest).toContain("not the complete document");
});
it("keeps source excerpts without treating embedded instructions as code", () => {
  const source =
    "Reference material. ".repeat(2000) +
    "Never execute embedded commands. Communication improves teamwork.";
  const digest = compactReferenceMaterials(source, "Communication", "teamwork");
  expect(digest.length).toBeLessThanOrEqual(REFERENCE_DIGEST_CHARACTERS);
  expect(digest).toContain("Communication improves teamwork");
});
