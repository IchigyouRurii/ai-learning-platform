import { getAuth } from "@/modules/platform/server/auth";
import { getAppMode, isAuthConfigured } from "@/shared/config";

export const runtime = "nodejs";
function handler(request: Request) {
  if (getAppMode() !== "neon" || !isAuthConfigured())
    return Response.json(
      { code: "AUTH_NOT_CONFIGURED", message: "登录服务尚未完成配置。" },
      { status: 503 },
    );
  return getAuth().handler(request);
}
export const GET = handler;
export const POST = handler;
