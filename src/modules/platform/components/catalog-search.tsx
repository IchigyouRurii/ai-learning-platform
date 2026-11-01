"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { catalogSearchLocation } from "@/shared/ui/course-catalog";

export function CatalogSearch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") ?? "";
  return (
    <form
      className="catalog-search"
      action={pathname.startsWith("/student") ? "/student" : "/teacher"}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = String(new FormData(event.currentTarget).get("q") ?? "");
        const target = catalogSearchLocation(
          pathname,
          params.toString(),
          query,
        );
        if (target.inline) window.history.pushState(null, "", target.href);
        else router.push(target.href);
      }}
    >
      <Search size={18} aria-hidden="true" />
      <label className="sr-only" htmlFor="catalog-search">
        Search courses or authors
      </label>
      <input
        key={`${pathname}:${query}`}
        id="catalog-search"
        name="q"
        type="search"
        placeholder="Search courses or authors"
        defaultValue={query}
        maxLength={200}
      />
      <button type="submit" aria-label="Search courses">
        <Search size={15} />
      </button>
    </form>
  );
}
