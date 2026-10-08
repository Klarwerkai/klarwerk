import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { LiveNegativwissen } from "../../hooks/useLiveKnowledgeCheck";

// AUFNAHME 20260922 · NEGATIVWISSEN-HINWEIS (R-1629): „Wenn jemand eine Lösung vorschlägt, die in
// der Negativwissens-Bibliothek bereits als ‚haben wir probiert, ging nicht' dokumentiert ist,
// blendet KLARWERK das proaktiv ein — bevor der Fehler ein zweites Mal gemacht wird."
//
// PROAKTIV heisst hier: offen auf dem Blatt, nicht hinter dem aufklappbaren Vorschau-Chip. Der
// Grund steht gleich mit (die dokumentierte Kurzfassung), der Eintrag öffnet sich in einem neuen
// Tab, damit der Entwurf nicht verloren geht — dieselbe Bauform wie der Treffer-Link der
// `LiveReactionZone`. Ohne Treffer rendert nichts: „nur im Fall", wie der Chip darunter.
// Der Hinweis blockiert nichts; Sichern und Einreichen bleiben unverändert.
export function NegativwissenHinweis({
  treffer,
}: {
  treffer: LiveNegativwissen;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (treffer.length === 0) {
    return null;
  }
  return (
    <aside
      data-testid="blatt-negativwissen"
      aria-label={t("negativwissen.titel")}
      className="rounded-[10px] bg-trust-warn-bg px-3 py-2.5 text-[13px] text-trust-warn-text"
    >
      <p className="font-semibold">{t("negativwissen.titel")}</p>
      <p className="mt-1 leading-relaxed">{t("negativwissen.einleitung")}</p>
      <ul className="mt-2 space-y-1.5">
        {treffer.map((n) => (
          <li key={n.id} data-testid="blatt-negativwissen-treffer">
            <Link
              to={`/wissen/${n.id}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline hover:opacity-80"
            >
              {n.title}
            </Link>
            {n.statement ? <span className="block leading-relaxed">{n.statement}</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] opacity-80">{t("negativwissen.grenze")}</p>
    </aside>
  );
}
