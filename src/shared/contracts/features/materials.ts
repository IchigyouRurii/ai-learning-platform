import { z } from "zod";
import {
  feature,
  idSchema,
  pageInputSchema,
  pageSchema,
  timestampSchema,
} from "./common";

export const materialSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: z.enum(["awaiting-upload", "processing", "ready", "failed"]),
  createdAt: timestampSchema,
});
export const uploadRequestSchema = z.strictObject({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum([
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "video/mp4",
  ]),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024),
});
export const uploadGrantSchema = z.object({
  material: materialSchema,
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: timestampSchema,
});
const ownerPolicy = "仅当前用户自己的材料；存储密钥不暴露给浏览器。";
export const materialFeatures = {
  requestUpload: feature(
    uploadRequestSchema,
    uploadGrantSchema,
    ["teacher", "student"],
    ownerPolicy +
      "按所有者和随机对象键签发短期上传权限；20 MiB 为当前框架默认上限。",
  ),
  confirmUpload: feature(
    z.strictObject({ materialId: idSchema }),
    materialSchema,
    ["teacher", "student"],
    ownerPolicy +
      "服务端向存储核对对象大小、类型与存在性；未提取内容不得标为 ready。",
  ),
  listMine: feature(
    pageInputSchema,
    pageSchema(materialSchema),
    ["teacher", "student"],
    ownerPolicy,
  ),
  getReadUrl: feature(
    z.strictObject({ materialId: idSchema }),
    z.object({ url: z.url(), expiresAt: timestampSchema }),
    ["teacher", "student"],
    ownerPolicy +
      "只签发短期读取链接；课程共享附件另按课程授权，不公开原始私有材料。",
  ),
};
export type LearningMaterial = z.infer<typeof materialSchema>;
export type UploadGrant = z.infer<typeof uploadGrantSchema>;
