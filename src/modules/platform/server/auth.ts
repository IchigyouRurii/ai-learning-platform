import "server-only";
import { getDatabasePool } from "@/shared/database/pool";
import { createAuth } from "./auth-config";

let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  auth ??= createAuth(getDatabasePool());
  return auth;
}
