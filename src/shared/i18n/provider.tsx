"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Languages, ChevronDown, Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import {
  documentLanguage,
  languageMenuCopy,
  languages,
  type Locale,
} from "./locales";
import {
  createTranslationRegistry,
  startInterfaceTranslation,
} from "./page-translator";

const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "en", setLocale: () => {} });

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLanguage] = useState(initialLocale);
  const registry = useRef(createTranslationRegistry());
  useEffect(() => {
    document.documentElement.lang = documentLanguage(locale);
    return startInterfaceTranslation({ locale, registry: registry.current });
  }, [locale]);
  function setLocale(next: Locale) {
    document.cookie = `ui-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLanguage(next);
  }
  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useContext(LanguageContext);
  const current = languages.find((language) => language.code === locale)!;
  const copy = languageMenuCopy[locale];
  return (
    <div className="language-control notranslate" translate="no">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="language-trigger"
          aria-label={copy.menu}
        >
          <Languages size={20} aria-hidden="true" />
          <span>{current.label}</span>
          <ChevronDown
            className="language-chevron"
            size={15}
            aria-hidden="true"
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="language-menu notranslate"
            translate="no"
            align="end"
            sideOffset={10}
            collisionPadding={12}
          >
            <DropdownMenu.RadioGroup
              value={locale}
              onValueChange={(value) => setLocale(value as Locale)}
            >
              {languages.map((language) => (
                <DropdownMenu.RadioItem
                  className="language-option"
                  key={language.code}
                  value={language.code}
                >
                  <span>{language.label}</span>
                  <DropdownMenu.ItemIndicator>
                    <Check size={16} aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
