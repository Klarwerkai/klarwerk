// WP-SHIP9-S2 Paket 3 (E2, Pedis Vorschlag ⭐): ein Aufklapper je Wissensobjekt/Import-Kandidat mit
// einer kurzen Inhaltsvorschau — so muss man das ganze Objekt nicht öffnen, um zu sehen, worum es geht.
// KEIN Server-Roundtrip: die Vorschau kommt aus der bereits vorliegenden Kernaussage (koPreviewText).
// Klar als „Vorschau" gekennzeichnet (Inhalt ist die menschlich verfasste Kernaussage, kein KI-Text).
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type KoPreviewSource, koPreviewText } from "../lib/koPreview";
import { cx } from "./ui";

export function KoSummaryDisclosure({
  source,
  text,
  defaultOpen = false,
  className,
}: {
  source: KoPreviewSource;
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
  const override = text?.replace(/\s+/g, " ").trim();
  const preview = override && override.length > 0 ? override : koPreviewText(source);
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
          <p className="text-[12.5px] leading-relaxed text-muted">{preview}</p>
        </div>
      ) : null}
    </div>
  );
}
