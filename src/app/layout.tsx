import { cookies } from "next/headers";
import { LanguageProvider } from "@/shared/i18n/provider";
import { parseLocale, documentLanguage } from "@/shared/i18n/locales";
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
  const preference = (await cookies()).get("ui-locale")?.value;
  const locale = parseLocale(preference);
  return (
    <html lang={documentLanguage(locale)}>
      {/* Browser extensions may add body attributes before hydration (e.g. cz-shortcut-listen).
          Limit this compatibility escape hatch to body attributes; child rendering stays checked. */}
      <body suppressHydrationWarning>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
