export const languages = [
  { code: "en", label: "English", name: "English" },
  { code: "zh", label: "简体中文", name: "Simplified Chinese" },
] as const;
export type Locale = (typeof languages)[number]["code"];
export function parseLocale(value: unknown): Locale {
  return value === "zh" ? "zh" : "en";
}
export function documentLanguage(locale: Locale) {
  return locale === "zh" ? "zh-CN" : "en";
}
export const languageMenuCopy: Record<Locale, { menu: string }> = {
  en: { menu: "Language" },
  zh: { menu: "语言" },
};
