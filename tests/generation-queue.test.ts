import { expect, it } from "vitest";
import { createGenerationQueue } from "@/modules/course-generation/server/generation-queue";

it("limits concurrent requests across levels and releases slots after failure", async () => {
  const schedule = createGenerationQueue(3);
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const results = Array.from({ length: 9 }, (_, index) =>
    schedule(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      if (index === 1) throw new Error("provider failed");
      return index;
    }),
  );
  const settled = Promise.allSettled(results);
  expect(releases).toHaveLength(3);
  for (let index = 0; index < 9; index++) {
    releases[index]();
    // Allow the settled request to hand its slot to the next queued request.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const outcomes = await settled;
  expect(peak).toBe(3);
  expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
    8,
  );
  expect(outcomes[1].status).toBe("rejected");
  expect(active).toBe(0);
});
