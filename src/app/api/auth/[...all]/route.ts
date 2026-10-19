import { getAuth } from "@/modules/platform/server/auth";
import { getAppMode, isAuthConfigured } from "@/shared/config";

export const runtime = "nodejs";
function handler(request: Request) {
  if (getAppMode() !== "neon" || !isAuthConfigured())
    return Response.json(
      {
        code: "AUTH_NOT_CONFIGURED",
        message: "Authentication is not configured.",
      },
      { status: 503 },
    );
  return getAuth().handler(request);
}
export const GET = handler;
export const POST = handler;
