import { localTranslation } from "./messages";
import type { Locale } from "./locales";

type Entry = {
  /** Text as rendered by the app, before this feature rewrites it. */
  source: string;
  /** Text this feature currently shows. */
  rendered: string;
  read: () => string;
  write: (value: string) => void;
  connected: () => boolean;
};

type Registry = {
  tracked: Set<Entry>;
  textEntries: WeakMap<Text, Entry>;
  attributeEntries: WeakMap<Element, Map<string, Entry>>;
};

export function createTranslationRegistry(): Registry {
  return {
    tracked: new Set(),
    textEntries: new WeakMap(),
    attributeEntries: new WeakMap(),
  };
}

const ignored =
  'script, style, noscript, pre, code, textarea, [contenteditable]:not([contenteditable="false"]), [translate="no"], .notranslate, .brand, .markdown-body, [data-course-content]';
const attributes = ["placeholder", "title", "aria-label", "alt"];
const hasWords = (text: string) =>
  /\p{L}/u.test(text) &&
  !/^https?:\/\/\S+$/.test(text) &&
  !/^[^\s@]+@[^\s@]+$/.test(text);

/**
 * Switch bundled interface copy to the selected language. Course text, code,
 * editable fields and branding keep their original language; browser
 * translation remains the user's option for lesson content.
 */
export function startInterfaceTranslation({
  locale,
  registry,
}: {
  locale: Locale;
  registry: Registry;
}) {
  const { tracked, textEntries, attributeEntries } = registry;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function apply() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (
        !node.parentElement ||
        node.parentElement.closest(ignored) ||
        !hasWords(node.data)
      )
        continue;
      let entry = textEntries.get(node);
      if (!entry) {
        entry = {
          source: node.data,
          rendered: node.data,
          read: () => node.data,
          write: (value) => {
            node.data = value;
          },
          connected: () => node.isConnected,
        };
        textEntries.set(node, entry);
      }
      tracked.add(entry);
    }

    for (const node of document.body.querySelectorAll(
      "[placeholder], [title], [aria-label], [alt]",
    )) {
      if (node.closest(ignored)) continue;
      let entries = attributeEntries.get(node);
      if (!entries) {
        entries = new Map();
        attributeEntries.set(node, entries);
      }
      for (const attribute of attributes) {
        const value = node.getAttribute(attribute);
        if (!value || !hasWords(value)) continue;
        let entry = entries.get(attribute);
        if (!entry) {
          entry = {
            source: value,
            rendered: value,
            read: () => node.getAttribute(attribute) ?? "",
            write: (text) => node.setAttribute(attribute, text),
            connected: () => node.isConnected,
          };
          entries.set(attribute, entry);
        }
        tracked.add(entry);
      }
    }

    for (const entry of tracked) {
      if (!entry.connected()) {
        tracked.delete(entry);
        continue;
      }
      const current = entry.read();
      // The app re-rendered this text; treat it as the new source.
      if (current !== entry.rendered) {
        entry.source = current;
        entry.rendered = current;
      }
      const translated = localTranslation(entry.source, locale);
      if (translated === undefined) continue;
      const output = entry.source.replace(/\S[\s\S]*\S|\S/, () => translated);
      if (current !== output) {
        entry.rendered = output;
        entry.write(output);
      }
    }
  }

  const observer = new MutationObserver((records) => {
    const changed = records.some(
      (record) =>
        record.type === "childList" ||
        (record.type === "characterData" &&
          textEntries.get(record.target as Text)?.rendered !==
            record.target.textContent) ||
        (record.type === "attributes" &&
          attributeEntries
            .get(record.target as Element)
            ?.get(record.attributeName!)?.rendered !==
            (record.target as Element).getAttribute(record.attributeName!)),
    );
    if (!changed) return;
    clearTimeout(timer);
    timer = setTimeout(apply, 0);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: attributes,
  });
  apply();
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}
