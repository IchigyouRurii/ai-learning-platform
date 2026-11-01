import { expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createNeonRepository } from "@/shared/database/neon-repository";

it("starts independent workspace reads without waiting for course content", async () => {
  const pending: Array<(result: { rows: [] }) => void> = [];
  const query = vi.fn(
    () => new Promise<{ rows: [] }>((resolve) => pending.push(resolve)),
  );
  const repository = createNeonRepository({ query } as unknown as Pool);
  const result = repository.getWorkspace({
    id: "teacher-1",
    role: "teacher",
    name: "Teacher",
  });
  expect(query).toHaveBeenCalledTimes(6);
  for (const resolve of pending) resolve({ rows: [] });
  expect(await result).toMatchObject({
    courses: [],
    enrollments: [],
    submissions: [],
    feedback: [],
    members: [],
  });
});
