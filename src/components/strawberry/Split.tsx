"use client";

/**
 * Split text.
 *
 * Both of these split at render rather than by rewriting the DOM afterwards, so
 * the markup is the same on the server and the client and nothing reflows once
 * the font lands. The cost is that line breaks have to be authored — which is
 * how the reference build does it too, and at these sizes a headline that
 * chooses its own breaks is a headline nobody art-directed.
 *
 * The accessible name is always the real string in an `.sr-only` span; the
 * pieces are decoration and are hidden from assistive tech. Letting the
 * fragments be the name is how you end up with a screen reader spelling out
 * "P — e — a — r".
 */

/** Per-character, kept inside per-word groups so the line can still wrap. */
export function Chars({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  let index = 0;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) => (
          <span key={w}>
            <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
              {[...word].map((c) => (
                <span className="ch" data-i={index++} key={`${w}-${index}`}>
                  {c}
                </span>
              ))}
            </span>
            {w < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Authored lines, each in its own mask so it can slide out from behind itself. */
export function Lines({
  lines,
  className,
  as: Tag = "p",
}: {
  lines: readonly string[];
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  return (
    <Tag className={className}>
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true">
        {lines.map((line, i) => (
          <span className="ln" key={i}>
            <i data-i={i}>{line}</i>
          </span>
        ))}
      </span>
    </Tag>
  );
}
