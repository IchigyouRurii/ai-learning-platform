"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/components/button";
import { removeMemberAction } from "../server/actions";

export function RemoveMemberButton({
  classId,
  studentId,
  studentName,
}: {
  classId: string;
  studentId: string;
  studentName: string;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove ${studentName} from this class?`)) return;
          setError("");
          startTransition(async () => {
            const result = await removeMemberAction(classId, studentId);
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
