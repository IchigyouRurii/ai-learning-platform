import "server-only";
import { getDatabasePool } from "@/shared/database/pool";
import { createAuth } from "./auth-config";

let auth: ReturnType<typeof createAuth> | undefined;
let factory: typeof createAuth | undefined;
let database: ReturnType<typeof getDatabasePool> | undefined;
export function getAuth() {
  const current = getDatabasePool();
  if (!auth || factory !== createAuth || database !== current) {
    auth = createAuth(current);
    database = current;
    factory = createAuth;
  }
  return auth;
}
