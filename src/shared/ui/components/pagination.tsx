import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { paginationItems } from "@/shared/ui/pagination";
import { cn } from "@/shared/ui/utils";

const controlClass =
  "inline-flex size-9 items-center justify-center rounded-[var(--ui-control-radius)] border border-border text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const disabledClass =
  "inline-flex size-9 items-center justify-center rounded-[var(--ui-control-radius)] border border-border text-sm opacity-40";

export function Pagination({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row"
    >
      <span className="muted text-sm">
        Page {page} of {totalPages}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <Link
            href={hrefForPage(page - 1)}
            className={controlClass}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <ChevronLeft size={16} aria-hidden="true" />
          </span>
        )}
        {paginationItems(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-1 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={hrefForPage(item)}
              className={cn(
                controlClass,
                item === page &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link
            href={hrefForPage(page + 1)}
            className={controlClass}
            aria-label="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
