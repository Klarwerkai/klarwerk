// ================================================================================================
// FE-003 · DIE QUELLENAUSKUNFT DER FRAGENFLÄCHE — Chip und Plaketten als gemeinsame Bausteine.
// ================================================================================================
//
// Bis FE-003 standen diese Bauteile in `pages/Ask.tsx`. Das Tutorial „Fragen“ führt den Quellenweg
// vor (Chip an der Antwort, Verwendungs- und Prüfstand-Plakette in der Quellenliste) — mit DEMSELBEN
// Bauteil, nicht mit einer nachgezeichneten Kopie. Die Entscheidung, WELCHER Zustand gilt
// (`verwendungsZustand`, `anzeigestatusAus`), bleibt auf der Seite; hier wird nur gezeichnet.
//
// DIE PLAKETTEN — JE ZUSTAND EIN AUSGESCHRIEBENER ZWEIG MIT FESTEN KLASSENKETTEN (JOB 3267 Q1).
// Der Klassenbindungs-Wächter (`tests/app/mega47-modale-flaechen-sammler.test.tsx`, JOB 1181) löst
// eine `className` auf, wenn ihre Bestandteile als Zeichenketten oder als Bezeichner mit literalem
// Wert dastehen. Deshalb entscheidet ein `if` über den ZWEIG, und in jedem Zweig steht die
// Klassenkette aus zwei Konstanten dieser Datei. Die Begründung der drei Verwendungszustände
// (verwendet · nicht verwendet · unbekannt) steht unverändert an `verwendungsZustand` in
// `pages/Ask.tsx`.
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

export type Verwendung = "verwendet" | "nichtVerwendet" | "unbekannt";

/** Das Wort am Chip und in der Quellenliste — je Zustand genau eines, DE/EN/NL. */
export const VERWENDUNG_BADGE: Record<Verwendung, string> = {
  verwendet: "ask.attribution.carrying.badge",
  nichtVerwendet: "ask.attribution.consulted.badge",
  unbekannt: "ask.attribution.unclear.badge",
};

/** Die ganze Aussage — Tooltip und zugänglicher Name. */
export const VERWENDUNG_HINWEIS: Record<Verwendung, string> = {
  verwendet: "ask.attribution.carrying.hint",
  nichtVerwendet: "ask.attribution.consulted.hint",
  unbekannt: "ask.attribution.unclear.hint",
};

const PLAKETTE = "shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase";
const TON_TRAGEND = "bg-trust-pos-bg text-trust-pos-text";
const TON_ANGESEHEN = "bg-hairline-soft text-muted-2";
const TON_UNKLAR = "bg-page text-muted-2";

/** Die Form eines Quellen-Chips — Link auf der Seite, Knopf in der Demo, dieselbe Gestalt. */
export const QUELLEN_CHIP_KLASSE =
  "inline-flex items-center gap-1.5 rounded-[8px] border border-hairline bg-page px-2.5 py-[5px] hover:border-ink/30";

export function VerwendungsPlakette({
  zustand,
  anker,
  titel,
  wort,
}: {
  zustand: Verwendung;
  /** `data-testid` — am Chip fest, in der Quellenliste der Anker aus `VERWENDUNG_ANKER`. */
  anker: string;
  titel: string;
  wort: string;
}): JSX.Element {
  if (zustand === "verwendet") {
    return (
      <span
        data-testid={anker}
        data-verwendung="verwendet"
        title={titel}
        className={`${PLAKETTE} ${TON_TRAGEND}`}
      >
        {wort}
      </span>
    );
  }
  if (zustand === "nichtVerwendet") {
    return (
      <span
        data-testid={anker}
        data-verwendung="nichtVerwendet"
        title={titel}
        className={`${PLAKETTE} ${TON_ANGESEHEN}`}
      >
        {wort}
      </span>
    );
  }
  return (
    <span
      data-testid={anker}
      data-verwendung="unbekannt"
      title={titel}
      className={`${PLAKETTE} ${TON_UNKLAR}`}
    >
      {wort}
    </span>
  );
}

/** Dieselbe Bauart für die ZWEITE Aussage: der Prüfstand, mit eigener Farbe und eigenem Wort. */
export function PruefstandPlakette({
  stand,
  titel,
  wort,
}: {
  stand: string | null;
  titel: string;
  wort: string;
}): JSX.Element {
  if (stand === "validiert") {
    return (
      <span
        data-testid="ask-source-pruefstand"
        data-pruefstand="validiert"
        title={titel}
        className={`${PLAKETTE} ${TON_TRAGEND}`}
      >
        {wort}
      </span>
    );
  }
  return (
    <span
      data-testid="ask-source-pruefstand"
      data-pruefstand={stand ?? "unbekannt"}
      title={titel}
      className={`${PLAKETTE} ${TON_UNKLAR}`}
    >
      {wort}
    </span>
  );
}

/**
 * Der Punkt am Chip — EINE Regel für Seite und Demo: ein ungelöster Konflikt färbt rot, eine
 * nicht validierte Quelle gelb; ist der Stand unbekannt (`null`), steht kein Punkt.
 */
export function chipPunkt(s: {
  conflictLimited: boolean;
  validated: boolean | null;
}): "konflikt" | "offen" | null {
  if (s.conflictLimited) {
    return "konflikt";
  }
  return s.validated === false ? "offen" : null;
}

/**
 * Der INHALT eines Quellen-Chips (Zielbild H5 Z.42): Punkt oder Dokumentsymbol, „n · Titel“ und
 * die Verwendungsplakette. Die Hülle (Link oder Knopf) stellt der Aufrufer mit
 * `QUELLEN_CHIP_KLASSE`.
 *
 * Der Punkt sagt, was er zeigt (JOB 3267 Q1): rot bei ungelöstem Konflikt, gelb bei nicht
 * validierter Quelle — mit dem Prüfstand als Wort in `aria-label`/`title`. Ist der Stand
 * unbekannt, steht KEIN Punkt, sondern das neutrale Dokumentsymbol.
 */
export function QuellenChipInhalt({
  punkt,
  punktHinweis,
  pruefstand,
  nummer,
  label,
  verwendung,
}: {
  /** Ungelöster Konflikt (rot), nicht validiert (gelb) — `null` = kein Punkt. */
  punkt: "konflikt" | "offen" | null;
  punktHinweis: string;
  pruefstand: string | null;
  /** Stelle in `result.sources`, 1-basiert; 0 = nicht auflösbar. */
  nummer: number;
  label: string;
  verwendung: Verwendung;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      {/* Je Farbe ein Zweig mit fester Klassenkette — auflösbar für den Klassenbindungs-Wächter. */}
      {punkt === "konflikt" ? (
        <span
          data-testid="ask-quellen-chip-punkt"
          data-pruefstand={pruefstand ?? undefined}
          role="img"
          aria-label={punktHinweis}
          title={punktHinweis}
          className="h-2 w-2 shrink-0 rounded-full bg-trust-crit-fill"
        />
      ) : punkt === "offen" ? (
        <span
          data-testid="ask-quellen-chip-punkt"
          data-pruefstand={pruefstand ?? undefined}
          role="img"
          aria-label={punktHinweis}
          title={punktHinweis}
          className="h-2 w-2 shrink-0 rounded-full bg-trust-warn-fill"
        />
      ) : (
        <FileText
          size={13}
          strokeWidth={1.8}
          aria-hidden="true"
          className="shrink-0 text-muted-2"
        />
      )}
      {/* R-1026 (Aufnahme 20260922 · antwort-quellenanzeige): auch auf dem Telefon bleibt der Titel
          lesbar — ein langer Titel ohne Umbruchstelle bricht um, statt über den Rand zu laufen. */}
      <span className="min-w-0 text-[12px] font-semibold text-text [overflow-wrap:anywhere]">
        {nummer > 0 ? `${nummer} · ${label}` : label}
      </span>
      {/* Die Verwendungsauskunft AM CHIP, NACH dem Titel: die Chipform „n · Titel“ ist gepinnt
          (`zielbild-h5-fragen.test.ts` V9/V18). */}
      <VerwendungsPlakette
        zustand={verwendung}
        anker="ask-quellen-chip-verwendung"
        titel={t(VERWENDUNG_HINWEIS[verwendung])}
        wort={t(VERWENDUNG_BADGE[verwendung])}
      />
    </>
  );
}
