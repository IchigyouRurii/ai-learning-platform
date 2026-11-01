import type { Metadata } from "next";
import "@/shared/ui/styles.css";

export const metadata: Metadata = {
  title: {
    default: "OpenLearnING · AI Learning",
    template: "%s · OpenLearnING",
  },
  description:
    "An AI-powered micro-course workspace for teachers and learners.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* Browser extensions may add body attributes before hydration (e.g. cz-shortcut-listen).
          Limit this compatibility escape hatch to body attributes; child rendering stays checked. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
