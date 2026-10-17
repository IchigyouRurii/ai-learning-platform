import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DemoState } from "@/shared/contracts";
import type { Repository } from "./repository";
import { createSeedState } from "@/shared/database/seed";

export function createDemoRepository(filePath: string): Repository {
  let pending: Promise<unknown> = Promise.resolve();
  async function load(): Promise<DemoState> {
    try {
      const state = JSON.parse(await readFile(filePath, "utf8")) as DemoState;
      if (state.schemaVersion !== 1)
        throw new Error("本地数据版本不兼容，请先备份 .local 目录。");
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return createSeedState();
    }
  }
  return {
    async read() {
      await pending;
      return load();
    },
    mutate<T>(operation: (state: DemoState) => T) {
      const result = pending.then(async () => {
        const state = await load();
        const value = operation(state);
        await mkdir(dirname(filePath), { recursive: true });
        const temporary = `${filePath}.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify(state, null, 2), {
          mode: 0o600,
        });
        await rename(temporary, filePath);
        return value;
      });
      pending = result.catch(() => undefined);
      return result;
    },
  };
}
