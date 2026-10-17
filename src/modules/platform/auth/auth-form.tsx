"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { authClient } from "./auth-client";
import { resolveLoginEmail } from "./login-identifier";

const inputClassName =
  "h-12 rounded-[7px] bg-white text-xs shadow-none md:text-xs";
const labelClassName = "text-xs leading-normal text-[#5f7163]";

export function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "register";
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const register = mode === "register";
  const router = useRouter();
  return (
    <>
      <div className="auth-heading">
        <p className="eyebrow">
          {register ? "START YOUR JOURNEY" : "WELCOME BACK"}
        </p>
        <h1>{register ? "创建你的学习账号" : "欢迎回到小课"}</h1>
        <p className="muted">
          {register
            ? "用一次次尝试，积累属于自己的进步。"
            : "继续你的学习旅程，或开始设计下一门好课。"}
        </p>
      </div>
      {!configured && (
        <div className="auth-notice" role="status">
          项目尚未完成数据库配置，请先按项目说明连接 Neon 并初始化数据库。
        </div>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          const data = new FormData(event.currentTarget);
          const identifier = String(data.get("email") ?? "").trim();
          const email = register ? identifier : resolveLoginEmail(identifier);
          const password = String(data.get("password") ?? "");
          try {
            const result = register
              ? await authClient.signUp.email({
                  email,
                  password,
                  name: String(data.get("name") ?? "").trim(),
                })
              : await authClient.signIn.email({ email, password });
            if (result.error) {
              const code = result.error.code;
              setError(
                code === "INVALID_EMAIL_OR_PASSWORD"
                  ? "账号或密码不正确。"
                  : code === "USER_ALREADY_EXISTS" ||
                      code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
                    ? "该邮箱已注册，请直接登录。"
                    : code === "PASSWORD_TOO_SHORT"
                      ? "密码至少需要 10 个字符。"
                      : result.error.status === 429
                        ? "尝试次数较多，请稍后再试。"
                        : "暂时无法完成操作，请检查信息或稍后重试。",
              );
              setPending(false);
            } else {
              router.replace("/");
              router.refresh();
            }
          } catch {
            setError("暂时无法连接登录服务，请稍后重试。");
            setPending(false);
          }
        }}
      >
        {register && (
          <div className="mb-[18px] grid gap-[7px]">
            <Label htmlFor="auth-name" className={labelClassName}>
              你的称呼
            </Label>
            <Input
              id="auth-name"
              className={inputClassName}
              name="name"
              autoComplete="name"
              required
              minLength={1}
              maxLength={80}
              disabled={!configured || pending}
              placeholder="希望大家如何称呼你"
            />
          </div>
        )}
        <div className="mb-[18px] grid gap-[7px]">
          <Label htmlFor="auth-email" className={labelClassName}>
            {register ? "邮箱" : "账号或邮箱"}
          </Label>
          <Input
            id="auth-email"
            className={inputClassName}
            type={register ? "email" : "text"}
            name="email"
            autoComplete={register ? "email" : "username"}
            required
            maxLength={254}
            disabled={!configured || pending}
            placeholder={register ? "you@example.com" : "输入账号或邮箱"}
          />
        </div>
        <div className="mb-[18px] grid gap-[7px]">
          <Label htmlFor="auth-password" className={labelClassName}>
            密码
          </Label>
          <Input
            id="auth-password"
            className={inputClassName}
            type="password"
            name="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 10 : 1}
            maxLength={128}
            disabled={!configured || pending}
            placeholder={register ? "至少 10 个字符" : "输入你的密码"}
          />
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button
          className="auth-submit h-11 w-full rounded-[7px] text-xs"
          type="submit"
          disabled={!configured || pending}
        >
          {pending ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowRight size={16} />
          )}
          {pending ? "正在处理…" : register ? "创建账号" : "登录"}
        </Button>
      </form>
      <p className="auth-switch">
        {register ? "已有账号？" : "还没有账号？"}
        <Link href={register ? "/login" : "/register"}>
          {register ? "前往登录" : "创建账号"}
        </Link>
      </p>
      {register && (
        <p className="form-hint">
          新账号默认为学生。教师身份由项目负责人分配。
        </p>
      )}
    </>
  );
}
