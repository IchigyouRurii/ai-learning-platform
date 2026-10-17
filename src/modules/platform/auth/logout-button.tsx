"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "./auth-client";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        className="role-switch"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await authClient.signOut();
            if (result.error) {
              setError("退出失败，请重试。");
              setPending(false);
            } else {
              router.replace("/login");
              router.refresh();
            }
          } catch {
            setError("连接失败，请重试。");
            setPending(false);
          }
        }}
      >
        <LogOut size={14} />
        {pending ? "正在退出…" : "退出登录"}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
