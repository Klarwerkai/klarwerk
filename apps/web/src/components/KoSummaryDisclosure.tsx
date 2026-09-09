// WP-SHIP9-S2 Paket 3 (E2, Pedis Vorschlag ⭐): ein Aufklapper je Wissensobjekt/Import-Kandidat mit
// einer kurzen Inhaltsvorschau — so muss man das ganze Objekt nicht öffnen, um zu sehen, worum es geht.
// KEIN Server-Roundtrip: die Vorschau kommt aus der bereits vorliegenden Kernaussage (koPreviewText).
// Klar als „Vorschau" gekennzeichnet (Inhalt ist die menschlich verfasste Kernaussage, kein KI-Text).
//
// JOB 3326 · LESEVARIANTE: Steht die Oberfläche auf einer anderen Sprache als das Original und liegt
// für DIESES Objekt eine Leseübersetzung vor, zeigt die Vorschau die übersetzte Kernaussage — mit
// dem sichtbaren Zusatz „Übersetzung · Original: Englisch". Ohne Variante ändert sich NICHTS: keine
// Kennzeichnung, kein zusätzlicher Abruf, dieselbe Vorschau wie bisher. Die Zuordnung läuft über
// `source.id`; ein Import-Kandidat (Stufe2) trägt keine Wissensobjekt-Kennung und bleibt deshalb
// unverändert beim Original.
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type KoPreviewSource, koPreviewText } from "../lib/koPreview";
import { useLesevariante } from "../lib/lesevariante";
import { cx } from "./ui";

export function KoSummaryDisclosure({
  source,
  text,
  defaultOpen = false,
  className,
}: {
  // JOB 3326: `id` ist optional und rein zur Zuordnung der Leseübersetzung — die Vorschau selbst
  // liest weiter nur `statement`/`bodyHtml`. Aufrufer ohne Kennung (Import-Kandidaten) sind davon
  // nicht betroffen.
  source: KoPreviewSource & { id?: string };
  // Optionaler Volltext-Override: wo die Fläche den Inhalt ohnehin vollständig zeigt (Import-Review),
  // reicht der Aufklapper den ehrlichen Volltext durch statt der gedeckelten Kurzvorschau — so geht
  // beim Verlagern hinter den Aufklapper nichts verloren.
  text?: string;
  // Für aktive Review-Karten (Status „neu") bereits offen — der Prüfer verliert keinen Klick.
  defaultOpen?: boolean;
  className?: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const variante = useLesevariante(source.id);
  const override = text?.replace(/\s+/g, " ").trim();
  // Die Übersetzung tritt an die Stelle der VORSCHAU, nie an die des Volltext-Overrides: wo die
  // Fläche den echten Wortlaut zeigt (Import-Review), bleibt der echte Wortlaut stehen.
  const uebersetzt = variante && !override ? variante.statement.replace(/\s+/g, " ").trim() : "";
  const preview =
    uebersetzt.length > 0
      ? uebersetzt
      : override && override.length > 0
        ? override
        : koPreviewText(source);
  // Keine Kernaussage vorhanden → gar kein Aufklapper (kein Layout-Bruch, keine leere Vorschau).
  if (preview.length === 0) {
    return null;
  }
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        // In klickbaren Karten/Zeilen: der Toggle darf weder navigieren noch die Karte öffnen.
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted hover:text-text"
      >
        <ChevronDown size={13} className={cx("transition-transform", open && "rotate-180")} />
        {open ? t("ko.preview.hide") : t("ko.preview.show")}
      </button>
      {open ? (
        <div className="mt-1 rounded-card border border-hairline bg-page px-3 py-2">
          <span className="mb-0.5 block font-mono text-[9.5px] font-semibold uppercase tracking-wide text-muted-2">
            {t("ko.preview.label")}
          </span>
          {uebersetzt.length > 0 && variante ? (
            <span
              data-testid="ko-preview-uebersetzung"
              className="mb-0.5 block text-[10.5px] font-semibold text-muted-2"
            >
              {t("lesevariante.badge.uebersetzung", {
                sprache: t(`lesevariante.sprache.${variante.originalLanguage}`),
              })}
            </span>
          ) : null}
          <p className="text-[12.5px] leading-relaxed text-muted">{preview}</p>
        </div>
      ) : null}
    </div>
  );
}
