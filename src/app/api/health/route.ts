import { getAppMode } from "@/shared/config";

export function GET() {
  return Response.json({
    status: "ok",
    app: "ai-learning-platform",
    mode: getAppMode(),
  });
}
