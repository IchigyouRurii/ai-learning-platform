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
              setError("Sign-out failed. Please try again.");
              setPending(false);
            } else {
              router.replace("/login");
              router.refresh();
            }
          } catch {
            setError("Connection failed. Please try again.");
            setPending(false);
          }
        }}
      >
        <LogOut size={14} />
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
