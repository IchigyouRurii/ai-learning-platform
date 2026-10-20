"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import { deleteClassAction } from "../server/actions";

export function DeleteClassButton({
  classId,
  className,
}: {
  classId: string;
  className: string;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <div>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Delete "${className}"? Students will be removed from the class, but their course enrollment and learning records are kept.`,
            )
          )
            return;
          setError("");
          startTransition(async () => {
            const result = await deleteClassAction(classId);
            if (result.ok) router.push("/teacher/classes");
            else setError(result.error);
          });
        }}
      >
        <Trash2 aria-hidden="true" />
        {pending ? "Deleting…" : "Delete class"}
      </Button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
