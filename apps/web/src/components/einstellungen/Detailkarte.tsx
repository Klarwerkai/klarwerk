// JOB 3065 H6 — DIE DETAILKARTE UND IHR „?"-MENÜ.
//
// Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren … arbeite mit
// Untermenüs … Wir haben sehr, sehr viele Informationsfunktionen."
//
// Deshalb wird kein Hilfetext gelöscht, sondern VERLEGT: jede Detailkarte trägt oben rechts EIN
// „?"; ein Klick öffnet das Untermenü mit den Hilfetexten dieser Karte — wörtlich dieselben
// i18n-Schlüssel, die vorher an den `HelpTip`s und Einleitungsabsätzen hingen. Im Sichtfeld der
// Zeilen steht davon nichts.
import { ChevronLeft, HelpCircle } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface Hilfetext {
  titel: string;
  text: string;
}

export function HilfeMenue({ hilfe }: { hilfe: readonly Hilfetext[] }): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ v: "down" | "up" }>({ v: "down" });

  // Wie beim bisherigen HelpTip: das Menü misst sich beim Öffnen und klappt bei Bedarf nach oben,
  // damit es nicht unter dem Fensterrand verschwindet.
  useLayoutEffect(() => {
    if (!offen || !popRef.current) {
      return;
    }
    const rect = popRef.current.getBoundingClientRect();
    const next = { v: rect.bottom > window.innerHeight - 8 ? ("up" as const) : ("down" as const) };
    setPos((prev) => (prev.v === next.v ? prev : next));
  }, [offen]);

  if (hilfe.length === 0) {
    return null;
  }
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-einst="hilfe"
        aria-label={t("help.open")}
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        className={`grid h-6 w-6 place-items-center rounded-full ${
          offen ? "text-brand-text" : "text-muted-2 hover:text-text"
        }`}
      >
        <HelpCircle size={16} />
      </button>
      {offen ? (
        <>
          <button
            type="button"
            aria-label={t("cmd.close")}
            tabIndex={-1}
            onClick={() => setOffen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            ref={popRef}
            data-einst="hilfemenue"
            className={`absolute right-0 z-40 w-80 max-w-[calc(100vw-1rem)] space-y-3 rounded-card border border-hairline bg-surface p-3.5 text-left shadow-popover ${
              pos.v === "up" ? "bottom-8" : "top-8"
            }`}
          >
            {hilfe.map((h) => (
              <div key={`${h.titel}-${h.text.slice(0, 24)}`}>
                <div className="text-[13px] font-semibold text-ink">{h.titel}</div>
                {/* `data-einst="hilfetext"` ist der Anker, an dem die Chromium-Messung die verlegten
                    Texte ABLEITET statt sie abzuschreiben: sie liest hier, was in dieses Menü
                    gehört, und verlangt dann, dass GENAU DAS im Sichtfeld der Karte fehlt. */}
                <p data-einst="hilfetext" className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  {h.text}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </span>
  );
}

export function Detailkarte({
  titel,
  hilfe = [],
  onZurueck,
  kopfAktion,
  children,
  testId,
}: {
  titel: string;
  hilfe?: readonly Hilfetext[];
  onZurueck: () => void;
  /** Optionale Aktion im Kopf der Karte (z. B. „Drucken"). */
  kopfAktion?: ReactNode;
  children: ReactNode;
  testId?: string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-einst="detail"
      data-testid={testId}
      className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile"
    >
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <button
          type="button"
          data-einst="zurueck"
          onClick={onZurueck}
          className="-ml-1.5 inline-flex items-center gap-1 rounded-btn px-1.5 py-1 text-[13px] font-semibold text-muted-2 hover:text-text"
        >
          <ChevronLeft size={15} />
          {t("einst.zurueck")}
        </button>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">{titel}</span>
        {kopfAktion}
        <HilfeMenue hilfe={hilfe} />
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}
