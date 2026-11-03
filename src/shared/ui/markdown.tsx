import type { ReactNode } from "react";

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**"))
      nodes.push(<strong key={`${keyPrefix}-b-${index}`}>{token.slice(2, -2)}</strong>);
    else
      nodes.push(
        <code key={`${keyPrefix}-c-${index}`}>{token.slice(1, -1)}</code>,
      );
    last = match.index + token.length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Small, dependency-free Markdown renderer for AI-authored lessons. It only
 * supports headings, bullets, numbered lists, blockquotes, bold, inline code
 * and fenced code, and never injects raw HTML.
 */
export function MarkdownText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];
  let code: string[] | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${key++}`}>
        {list.items.map((item, itemIndex) => (
          <li key={itemIndex}>{inline(item, `li-${key}-${itemIndex}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${key++}`}>{inline(paragraph.join(" "), `p-${key}`)}</p>,
    );
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (code) {
      if (line.trim().startsWith("```")) {
        blocks.push(
          <pre key={`pre-${key++}`}>
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
      } else code.push(raw);
      continue;
    }
    if (line.trim().startsWith("```")) {
      flushList();
      flushParagraph();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushList();
      flushParagraph();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      flushParagraph();
      const level = heading[1].length;
      const content = inline(heading[2], `h-${key}`);
      blocks.push(
        level === 1 ? (
          <h3 key={`h-${key++}`}>{content}</h3>
        ) : level === 2 ? (
          <h4 key={`h-${key++}`}>{content}</h4>
        ) : (
          <h5 key={`h-${key++}`}>{content}</h5>
        ),
      );
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    if (line.trimStart().startsWith(">")) {
      flushList();
      flushParagraph();
      blocks.push(
        <blockquote key={`q-${key++}`}>
          {inline(line.trimStart().slice(1).trim(), `q-${key}`)}
        </blockquote>,
      );
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushList();
  flushParagraph();
  if (code)
    blocks.push(
      <pre key={`pre-${key++}`}>
        <code>{code.join("\n")}</code>
      </pre>,
    );
  return <div className="markdown-body">{blocks}</div>;
}
