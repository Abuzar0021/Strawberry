"use client";

import { useState } from "react";
import { useScene } from "@/hooks/strawberry/useScene";
import { revealBlocks } from "@/lib/strawberryReveal";
import { APPLY, BRAND, SCENES } from "@/data/strawberry";

/**
 * The application.
 *
 * There is no backend behind this site, so the form composes a mail rather than
 * pretending to post somewhere. A form that silently swallows an application
 * would be worse than no form: the whole pitch of the page is that every
 * application gets read.
 */
export function ApplyScene() {
  const [sent, setSent] = useState(false);

  const ref = useScene<HTMLDivElement>(SCENES.apply, ({ t, el }) => {
    revealBlocks(el, t, 0.5);
  });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const grow = String(data.get("grow") ?? "").trim();
    const body = `${grow}\n\n- ${name}${email ? ` (${email})` : ""}`;
    window.location.href = `mailto:${BRAND.email}?subject=${encodeURIComponent(
      `Partnership application - ${name || "no name given"}`
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <div className="layer" ref={ref} id="apply">
      <div className="col" style={{ top: "50%", transform: "translateY(-50%)" }}>
        <p className="t-mono opacity-70" data-rise>
          {APPLY.lead}
        </p>
        <p className="t-subhead mt-4 max-w-[19em]" data-rise>
          {APPLY.body}
        </p>

        <form className="mt-8 flex max-w-[30rem] flex-col gap-3" onSubmit={submit} data-rise>
          {APPLY.fields.map((f) => (
            <label className="field" key={f.k}>
              <span className="sr-only">{f.label}</span>
              {f.type === "textarea" ? (
                <textarea name={f.k} placeholder={f.label} required rows={3} />
              ) : (
                <input
                  name={f.k}
                  type={f.type}
                  placeholder={f.label}
                  autoComplete={"autoComplete" in f ? f.autoComplete : undefined}
                  required
                />
              )}
            </label>
          ))}

          <button type="submit" className="cta t-mono mt-2 self-start">
            {APPLY.cta}
            <span className="arw" aria-hidden="true">
              →
            </span>
          </button>

          <p className="t-mono mt-1 opacity-60" aria-live="polite">
            {sent ? "Opening your mail client…" : " "}
          </p>
        </form>
      </div>
    </div>
  );
}
