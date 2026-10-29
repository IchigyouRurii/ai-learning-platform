"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { StatCard } from "@/shared/ui/primitives";

export function PassSummary({ passed, total }: { passed: number; total: number }) {
  const [rate, setRate] = useState(false);
  return (
    <button
      type="button"
      className="w-full text-left rounded-[var(--ui-card-radius)] focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={rate ? "Show students meeting target" : "Show target achievement rate"}
      aria-pressed={rate}
      onClick={() => setRate(!rate)}
    >
      <StatCard
        label={rate ? "Target achievement rate" : "Students meeting target"}
        value={rate ? `${total ? Math.round(passed / total * 100) : 0}%` : `${passed} / ${total}`}
        detail={rate ? "Click to view count · All quizzes passed" : "Click to view rate · All quizzes passed"}
        icon={<CheckCircle2 size={17} />}
      />
    </button>
  );
}
