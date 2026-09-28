// ================================================================================================
// FE-003 · ZWEI ZUSTÄNDE DER ERGEBNISFLÄCHE — als gemeinsame Bausteine für Seite und Tutorial.
// ================================================================================================
//
// Warten und „KI nicht verfügbar“: das Tutorial „Fragen“ erklärt genau diese Zustände (Schritte 3
// und 6) und muss dafür zeigen, was die echte Seite zeigt — nicht eine Nachzeichnung. Bis FE-003
// standen sie inline in `pages/Ask.tsx`; das Markup ist zeichengleich umgezogen. Die Begründungen
// stehen weiter an den Aufrufstellen in `pages/Ask.tsx` (A1/§9 für das Warten, JOB 4224 D5 für die
// Alternativen).
//
// DIE LÜCKENKARTE IST BEWUSST NICHT HIER: ihr Kopf („Keine belastbare Grundlage“) ist nach
// `tests/app/mega54-ein-naechster-schritt-sammler.test.ts` an jeder Fläche mit GENAU EINEM nächsten
// Schritt verbunden; ein herausgelöster Kopf ohne diesen Schritt wäre eine Lückenfläche ohne Weg.
import { useTranslation } from "react-i18next";
import { RoleLink } from "../RoleLink";
import { FRAGEN_ZIEL } from "./ziele";

/**
 * Die ruhigen Platzhalterzeilen beim ERSTEN Abruf: sie zeigen die Form der kommenden Antwort,
 * ohne etwas über ihren Inhalt zu behaupten. Für Vorlesehilfen unsichtbar — die Ansage trägt der
 * busy-Träger der Seite.
 */
export function AntwortPlatzhalter(): JSX.Element {
  return (
    <div
      data-testid="ask-pending-platzhalter"
      data-tutorial-ziel={FRAGEN_ZIEL.warten}
      aria-hidden="true"
      className="space-y-2"
    >
      <div className="h-3 w-11/12 animate-pulse rounded-pill bg-page" />
      <div className="h-3 w-9/12 animate-pulse rounded-pill bg-page" />
      <div className="h-3 w-10/12 animate-pulse rounded-pill bg-page" />
      <div className="h-3 w-6/12 animate-pulse rounded-pill bg-page" />
    </div>
  );
}

/**
 * Ohne nutzbares Modell: der Satz, der den Zustand nennt, und die Wege, die OHNE Modell gehen —
 * Bestand durchsuchen und Wissen erfassen. Über `RoleLink`: ein Ziel, das die Rolle nicht
 * erreicht, wird als Lage gezeigt, nicht als Weg (AUFTRAG-mega71 Block E).
 */
export function KiNichtVerfuegbar({
  hinweisKey,
  hinweisTestId,
}: {
  hinweisKey: string;
  /** Kennung des Satzes, wo die Seite eine eigene Lage benennt (D5: `ask-ki-abgeschaltet-hinweis`). */
  hinweisTestId?: string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <p
        data-tutorial-ziel={FRAGEN_ZIEL.kiAus}
        data-testid={hinweisTestId}
        className="mt-1.5 text-[12px] text-muted-2"
      >
        {t(hinweisKey)}
      </p>
      <p data-testid="ask-ai-alternative" className="mt-1.5 text-[12px] text-muted-2">
        {t("ask.aiUnavailable.path")}{" "}
        <RoleLink to="/bibliothek" className="font-semibold text-brand-text">
          {() => t("ask.aiUnavailable.toLibrary")}
        </RoleLink>
        {" · "}
        <RoleLink to="/erfassen" className="font-semibold text-brand-text">
          {() => t("ask.aiUnavailable.toCapture")}
        </RoleLink>
      </p>
    </>
  );
}
