"use client";
import Link from "next/link";
import { useState, type ComponentProps } from "react";

/** Prepare a full dynamic page only after intent, rather than fetching every card. */
export function IntentLink(props: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? true : null}
      onPointerEnter={(event) => {
        setIntent(true);
        props.onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        props.onFocus?.(event);
      }}
    />
  );
}
