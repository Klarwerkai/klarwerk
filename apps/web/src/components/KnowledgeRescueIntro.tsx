// SCRUM-352: ruhiger, geführter „Knowledge Rescue"-Einstieg über der Erfassung. Erzählt die Kernstory
// (Erfahrungswissen sichern, bevor es verloren geht), führt in drei klaren Schritten und macht den
// Wertbeitrag leichtgewichtig sichtbar — macOS-nah: aufgeräumt, hochwertig, klar. Progressive
// Disclosure: standardmäßig offen, einklappbar; entfernt KEINE Funktion (Modi/Editor bleiben darunter).
// Reine Anzeige auf Basis des DOM-freien knowledgeRescue-Helfers.
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KNOWLEDGE_RESCUE_IMPACT, KNOWLEDGE_RESCUE_STEPS } from "../lib/knowledgeRescue";

export function KnowledgeRescueIntro(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-4 overflow-hidden rounded-card border border-hairline bg-surface">
      <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ai/10 text-ai">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ai">
              {t("capture.rescue.kicker")}
            </p>
            <h2 className="text-[15px] font-semibold leading-snug text-text">
              {t("capture.rescue.title")}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
              {t("capture.rescue.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-btn border border-hairline px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-text"
        >
          {t(open ? "capture.rescue.showLess" : "capture.rescue.showMore")}
        </button>
      </div>

      {open ? (
        <div className="border-t border-hairline px-4 py-3 sm:px-5">
          {/* Drei ruhige, geführte Schritte: erzählen → KI strukturiert → prüfen lassen. */}
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {KNOWLEDGE_RESCUE_STEPS.map((step, i) => (
              <li key={step.id} className="rounded-card border border-hairline bg-page p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[12.5px] font-semibold text-text">{t(step.labelKey)}</span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{t(step.hintKey)}</p>
              </li>
            ))}
          </ol>

          {/* Leichtgewichtiger Wertbeitrag — warum dieser Beitrag zählt (kein Score, keine Punkte). */}
          <div className="mt-3 border-t border-hairline pt-2.5">
            <p className="text-[11.5px] font-semibold text-ink">
              {t("capture.rescue.impactTitle")}
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {KNOWLEDGE_RESCUE_IMPACT.map((item) => (
                <li
                  key={item.id}
                  className="rounded-pill border border-hairline bg-page px-2.5 py-1 text-[11.5px] text-muted"
                >
                  {t(item.labelKey)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
