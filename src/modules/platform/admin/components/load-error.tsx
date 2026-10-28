"use client";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import styles from "../admin.module.css";

export function AdminLoadError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <section className="panel">
      <h2 className={styles.sectionTitle}>Unable to load this section</h2>
      <p className="muted" role="alert">
        {message}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={() => router.refresh()}
      >
        <RefreshCw size={15} />
        Try again
      </Button>
    </section>
  );
}
