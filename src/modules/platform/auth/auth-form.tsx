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
  "h-11 rounded-lg bg-white text-sm shadow-none md:text-sm";
const labelClassName = "text-sm leading-normal text-foreground";

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
        <h1>
          {register
            ? "Create your learning account"
            : "Welcome back to OpenLearnING"}
        </h1>
        <p className="muted">
          {register
            ? "Build your progress, one step at a time."
            : "Continue learning or start creating your next course."}
        </p>
      </div>
      {!configured && (
        <div className="auth-notice" role="status">
          Database setup is incomplete. Follow the setup guide to connect Neon
          and initialize the database.
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
                  ? "Incorrect account or password."
                  : code === "USER_ALREADY_EXISTS" ||
                      code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
                    ? "This email is already registered. Please sign in."
                    : code === "PASSWORD_TOO_SHORT"
                      ? "Your password must contain at least 10 characters."
                      : result.error.status === 429
                        ? "Too many attempts. Please try again later."
                        : "Unable to complete this action. Check your details or try again later.",
              );
              setPending(false);
            } else {
              router.replace("/");
              router.refresh();
            }
          } catch {
            setError(
              "Unable to connect to the sign-in service. Please try again later.",
            );
            setPending(false);
          }
        }}
      >
        {register && (
          <div className="mb-[18px] grid gap-[7px]">
            <Label htmlFor="auth-name" className={labelClassName}>
              Your name
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
              placeholder="Enter your name"
            />
          </div>
        )}
        <div className="mb-[18px] grid gap-[7px]">
          <Label htmlFor="auth-email" className={labelClassName}>
            {register ? "Email" : "Account or email"}
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
            placeholder={
              register ? "you@example.com" : "Enter your account or email"
            }
          />
        </div>
        <div className="mb-[18px] grid gap-[7px]">
          <Label htmlFor="auth-password" className={labelClassName}>
            Password
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
            placeholder={
              register ? "At least 10 characters" : "Enter your password"
            }
          />
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button
          className="auth-submit h-11 w-full rounded-lg text-sm"
          type="submit"
          disabled={!configured || pending}
        >
          {pending ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowRight size={16} />
          )}
          {pending ? "Processing…" : register ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="auth-switch">
        {register ? "Already have an account? " : "New here? "}
        <Link href={register ? "/login" : "/register"}>
          {register ? "Sign in" : "Create account"}
        </Link>
      </p>
      {register && (
        <p className="form-hint">
          New accounts are students by default. Teacher access is assigned by
          the project administrator.
        </p>
      )}
    </>
  );
}
