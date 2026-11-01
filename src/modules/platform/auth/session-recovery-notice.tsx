"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { probeExistingSession } from "./session-probe";

export function SessionRecoveryNotice() {
  const router = useRouter();
  const [status, setStatus] = useState<"waiting" | "checking" | "anonymous">(
    "waiting",
  );
  const controller = useRef<AbortController | null>(null);
  const check = useCallback(async () => {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setStatus("checking");
    const result = await probeExistingSession(
      AbortSignal.any([current.signal, AbortSignal.timeout(11000)]),
    );
    if (!current.signal.aborted) {
      if (result === "authenticated") {
        router.replace("/");
        router.refresh();
      }
      setStatus(result === "anonymous" ? "anonymous" : "waiting");
    }
    if (controller.current === current) controller.current = null;
  }, [router]);
  useEffect(() => {
    // One automatic probe and browser reconnect events, never an endless poll loop.
    const timer = window.setTimeout(() => {
      void check();
    }, 2500);
    const online = () => {
      void check();
    };
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", online);
      controller.current?.abort();
      controller.current = null;
    };
  }, [check]);
  return (
    <div className="auth-notice" role="status">
      {status === "anonymous"
        ? "Connection restored. Please sign in to continue."
        : "The sign-in service is temporarily unavailable. Your saved session has not been cleared."}{" "}
      {status !== "anonymous" && (
        <button
          type="button"
          className="text-link"
          disabled={status === "checking"}
          onClick={() => {
            void check();
          }}
        >
          {status === "checking" ? "Checking connection…" : "Retry connection"}
        </button>
      )}
    </div>
  );
}
