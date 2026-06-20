import React from "react";

/** Render `**bold**` segments inside a single line of text. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-emerald-300 font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

/**
 * Minimal, dependency-free Markdown renderer for AI replies: supports headings,
 * bullet lists, and inline `**bold**`. Text-only — never renders raw HTML, so it
 * is safe against injection. Shared by the AI coach and the chat assistant.
 */
export default function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split("\n\n").map((chunk, i) => {
        const t = chunk.trim();
        if (!t) return null;
        if (t.startsWith("### ")) {
          return <h4 key={i} className="font-display font-bold text-white text-sm pt-1">{renderInline(t.slice(4))}</h4>;
        }
        if (t.startsWith("## ")) {
          return <h3 key={i} className="font-display font-bold text-white text-base pt-1">{renderInline(t.slice(3))}</h3>;
        }
        if (/^(\*|-)\s/.test(t)) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {t.split("\n").map((li, j) => (
                <li key={j}>{renderInline(li.replace(/^(\*|-)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(t)}</p>;
      })}
    </div>
  );
}
