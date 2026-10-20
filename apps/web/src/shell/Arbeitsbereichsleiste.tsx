import { type RefObject, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { SeitenleistenPunkte } from "./KopfbandPunkte";
import { useMediaQuery } from "./useMediaQuery";

// ================================================================================================
// MACOS-20261014 · MAC-03 — DIE AUSBLENDBARE ARBEITSBEREICHSLEISTE DES HAUPTFENSTERS.
// ================================================================================================
//
// produkt:20261011:assistenz-minimalistische-oberflaeche r2, Produktleitlinie MACOS-20261014 §3
// („HAUPTFENSTER … ausblendbarer Navigation und einer dominanten Inhaltsfläche. NAVIGATION: Links die
// vorhandenen Arbeitsbereiche/Sammlungen in einer ruhigen Seitenleiste … Seitenleisten und ergänzende
// Bereiche lassen sich ausblenden, ohne Kontext zu verlieren. Die Inhaltsfläche erhält dabei
// tatsächlich den frei gewordenen Platz.“). Die Führung hat dafür die frühere September-Entscheidung
// „keine Seitenleiste“ (JOB 3060 H1, AppShell.tsx) ausdrücklich abgelöst (Nacharbeit 52).
//
// WAS DIE LEISTE IST: dieselben Arbeitsbereiche wie Kopfband und „Arbeitsbereiche“-Menü
// (`SeitenleistenPunkte`, eine Quelle: Rechte, Ziele, Aktivregel, Zähler, Ungespeichert-Wächter).
// Keine zweite Navigation mit eigenen Rechten oder Zielen. Das Kopfband bleibt unverändert, damit
// die Navigation auch bei ausgeblendeter Leiste direkt erreichbar ist.
//
// AUSGEBLENDET heisst: die Leiste ist NICHT im Baum (kein per CSS verstecktes `<aside>`), `<main>`
// nimmt die ganze Breite. Der Seiteninhalt bleibt dabei montiert (AppShell: feste Stelle) — Eingaben,
// Kontext und Arbeitsstand bleiben stehen.
//
// VORGABE OHNE EIGENE WAHL: eingeblendet ab 1440 px Fensterbreite, darunter ausgeblendet — die
// breitesten Seiten brauchen ihren Platz (Bibliothek 380 + 720 px, Wissensnetz 880 px + Leiste;
// AppShell.tsx), und die Leitlinie verlangt, bei schmaleren Breiten platzsparend anzupassen. Wer
// selbst ein- oder ausblendet, behält diese Wahl (auch nach Neuladen, in diesem Browser).

const SCHLUESSEL = "klarwerk.seitenleiste";
export const SEITENLEISTE_VORGABE_QUERY = "(min-width: 1440px)";

type Wahl = "an" | "aus";

function gemerkteWahl(): Wahl | null {
  try {
    const wert = window.localStorage.getItem(SCHLUESSEL);
    return wert === "an" || wert === "aus" ? wert : null;
  } catch {
    // Speicher gesperrt: es gilt die Vorgabe nach Fensterbreite.
    return null;
  }
}

function merke(wahl: Wahl): void {
  try {
    window.localStorage.setItem(SCHLUESSEL, wahl);
  } catch {
    // Speicher gesperrt: die Wahl gilt für diese Sitzung.
  }
}

/** Ob die Leiste eingeblendet ist, und der Umschalter (merkt die Wahl). */
export function useSeitenleiste(): { offen: boolean; umschalten: () => void } {
  const breitGenug = useMediaQuery(SEITENLEISTE_VORGABE_QUERY);
  const [wahl, setWahl] = useState<Wahl | null>(gemerkteWahl);
  const offen = wahl === null ? breitGenug : wahl === "an";
  const umschalten = useCallback((): void => {
    const neu: Wahl = offen ? "aus" : "an";
    merke(neu);
    setWahl(neu);
  }, [offen]);
  return { offen, umschalten };
}

function LeistenSymbol(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

const KNOPF =
  "inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-muted hover:bg-hairline-soft hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";

/** Die eingeblendete Leiste: Kopf mit „Seitenleiste ausblenden“, darunter die Arbeitsbereiche. */
export function Arbeitsbereichsleiste({
  onAusblenden,
  knopfRef,
}: {
  onAusblenden: () => void;
  knopfRef: RefObject<HTMLButtonElement>;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <aside
      data-testid="arbeitsbereichsleiste"
      className="flex w-[216px] shrink-0 flex-col overflow-y-auto border-r border-hairline bg-surface px-2 pb-4 pt-2"
    >
      <div className="mb-1 flex items-center justify-between pl-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-2">
          {t("seitenleiste.navigation")}
        </span>
        <button
          ref={knopfRef}
          type="button"
          data-testid="seitenleiste-ausblenden"
          aria-label={t("seitenleiste.ausblenden")}
          title={t("seitenleiste.ausblenden")}
          aria-expanded={true}
          onClick={onAusblenden}
          className={KNOPF}
        >
          <LeistenSymbol />
        </button>
      </div>
      <nav aria-label={t("seitenleiste.navigation")}>
        <SeitenleistenPunkte />
      </nav>
    </aside>
  );
}

/**
 * Ausgeblendet: nur dieser kleine Knopf, oben links im Polster des Inhalts (`<main>` hat 36 px
 * Polster) — er nimmt dem Inhalt keinen Platz und verdeckt kein Bedienelement.
 */
export function SeitenleisteEinblenden({
  onEinblenden,
  knopfRef,
}: {
  onEinblenden: () => void;
  knopfRef: RefObject<HTMLButtonElement>;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <button
      ref={knopfRef}
      type="button"
      data-testid="seitenleiste-einblenden"
      aria-label={t("seitenleiste.einblenden")}
      title={t("seitenleiste.einblenden")}
      aria-expanded={false}
      onClick={onEinblenden}
      className={`${KNOPF} absolute left-0.5 top-1.5 z-10`}
    >
      <LeistenSymbol />
    </button>
  );
}
