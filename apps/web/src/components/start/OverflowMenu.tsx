import { MoreHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

// ================================================================================================
// JOB 3064 H5 — DAS „…"-MENÜ: DER BENANNTE ORT FÜR ALLES, WAS NICHT INS SICHTFELD GEHÖRT.
// ================================================================================================
// Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs." Genau das ist dieses Bauteil: EIN Knopf, EIN Menü, je Eintrag
// ein Ort. Es ist bewusst dumm — es kennt nur Beschriftungen und Rückrufe; was ein Eintrag zeigt,
// entscheidet die Fläche.
//
// Warum kein `<details>`: ein Menü schliesst sich beim Klick daneben und beim Klick auf einen
// Eintrag. Der unsichtbare Abfangknopf darunter ist dasselbe Muster wie in `HelpTip.tsx` — kein
// zweites Overlay-Verfahren im Haus.
export interface MenuPunkt {
  id: string;
  label: string;
}

export function OverflowMenu({
  label,
  punkte,
  onWahl,
  testId,
  align = "right",
}: {
  /** Zugänglicher Name des Knopfes (er trägt nur die drei Punkte). */
  label: string;
  punkte: readonly MenuPunkt[];
  onWahl: (id: string) => void;
  testId: string;
  align?: "left" | "right";
}): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const listenId = useId();
  if (punkte.length === 0) {
    return null;
  }
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? listenId : undefined}
        onClick={() => setOffen((v) => !v)}
        className={`grid h-8 w-8 place-items-center rounded-btn text-muted-2 transition-colors hover:bg-hairline-soft hover:text-text ${
          offen ? "bg-hairline-soft text-text" : ""
        }`}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
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
            id={listenId}
            role="menu"
            data-testid={`${testId}-liste`}
            className={`absolute top-9 z-40 min-w-[13rem] rounded-card border border-hairline bg-surface py-1 shadow-popover ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {punkte.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                data-testid={`${testId}-punkt-${p.id}`}
                onClick={() => {
                  setOffen(false);
                  onWahl(p.id);
                }}
                className="block w-full px-3.5 py-1.5 text-left text-[13px] text-text hover:bg-hairline-soft"
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </span>
  );
}
