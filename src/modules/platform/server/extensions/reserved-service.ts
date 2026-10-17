import "server-only";
import type { User } from "@/shared/contracts/platform";
import type {
  FeatureDefinition,
  FeatureInput,
  FeatureOutput,
  FeatureResult,
} from "@/shared/contracts/features";

export type ReservedService<D extends Record<string, FeatureDefinition>> = {
  [K in keyof D]: (
    actor: User | null,
    input: FeatureInput<D[K]>,
  ) => Promise<FeatureResult<FeatureOutput<D[K]>>>;
};

// No "use server": these are server module contracts, not public endpoints.
// Action/HTTP adapters must derive actor from the session. No repository, model,
// email, or object-storage calls are made until a real implementation is bound.
export function createReservedService<
  D extends Record<string, FeatureDefinition>,
>(namespace: string, definitions: D): ReservedService<D> {
  const methods = Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => [
      name,
      async (
        actor: User | null,
        input: unknown,
      ): Promise<FeatureResult<never>> => {
        if (!actor)
          return { ok: false, code: "AUTH_REQUIRED", error: "请先登录。" };
        if (!definition.roles.includes(actor.role))
          return {
            ok: false,
            code: "FORBIDDEN",
            error: "当前角色无权执行此操作。",
          };
        const parsed = definition.input.safeParse(input);
        if (!parsed.success)
          return {
            ok: false,
            code: "INVALID_INPUT",
            error: parsed.error.issues[0]?.message ?? "输入格式不正确。",
          };
        return {
          ok: false,
          code: "NOT_IMPLEMENTED",
          error: `功能 ${namespace}.${name} 的接口已预留，尚未实现。`,
        };
      },
    ]),
  );
  // The mapping preserves every definition's input/output pair. A reserved
  // implementation can only return a typed failure, never fabricated success.
  return Object.freeze(methods) as ReservedService<D>;
}
