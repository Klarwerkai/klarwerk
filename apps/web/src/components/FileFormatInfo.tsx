import { Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CAPTURE_FILE_TEXT } from "../lib/captureFromFile";

// WP-D10c (Pedis Wunsch): der Infokasten „Dateiformate & Formatierung" startet ZUGEKLAPPT — nur eine
// dezente Zeile (Info-Icon + Titel), der Volltext (Formatgrenzen + unterstützte Formate) erscheint erst
// nach bewusstem Klick. Echtes <button> mit aria-expanded (kein details-Browser-Eigenleben, keine
// Blocker-Dialoge); der Volltext steht NUR im aufgeklappten Zustand im DOM. Die Texte bleiben die
// bestehenden CAPTURE_FILE_TEXT-Keys (WP-D10c Fix 1 hält sie ehrlich, z. B. PPTX-Fotos übernommen).
export function FileFormatInfo(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-card border border-hairline bg-page px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-1.5 text-left text-[12.5px] font-semibold text-muted hover:text-text"
      >
        <Info size={14} className="shrink-0" />
        {t(CAPTURE_FILE_TEXT.formatTitle)}
      </button>
      {open ? (
        <>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            {t(CAPTURE_FILE_TEXT.formatHint)}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            <strong>{t(CAPTURE_FILE_TEXT.supportedTitle)}</strong>{" "}
            {t(CAPTURE_FILE_TEXT.supportedFormats)}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
            {t(CAPTURE_FILE_TEXT.unsupportedFormats)}
          </p>
        </>
      ) : null}
    </div>
  );
}
