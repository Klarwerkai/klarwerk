// ================================================================================================
// FE-003 · DAS FRAGEFELD DER FRAGENFLÄCHE — EIN Baustein für die echte Seite und das Tutorial.
// ================================================================================================
//
// Bis FE-003 stand dieses Formular inline in `pages/Ask.tsx`. Das Tutorial „Fragen“ muss die
// Eingabe, den Beispiele-Knopf und den Sendeknopf VORFÜHREN — mit demselben Bauteil, nicht mit
// einer nachgezeichneten Kopie (Ticket FE-003, Kriterium 4). Deshalb ist es hierher umgezogen,
// zeichengleich im Markup; die Seite reicht Zustand und Handlungen herein, die Demo reicht
// Demo-Zustand herein. Eine Änderung hier erscheint zwangsläufig an beiden Orten.
//
// WAS DER BAUSTEIN NICHT TUT: er sendet nichts. Er meldet `onAbsenden` — ob daraus eine Anfrage
// wird, entscheidet der Aufrufer (`submitAsk` in `pages/Ask.tsx` mit seiner KI- und Pending-Sperre;
// im Tutorial ein reiner Anzeigewechsel ohne Netz).
//
// Die Begründungen der einzelnen Entscheidungen (Beispiele im leeren Feld, Mikrofon als Symbol,
// `type="button"` am Diktat, Spinner im Sendeknopf) stehen seit JOB 3038/3064 an diesen Zeilen und
// sind mit umgezogen.
import { ArrowUp, Loader2, Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FRAGEN_ZIEL } from "./ziele";

export function FrageFeld({
  wert,
  onWert,
  onAbsenden,
  ungueltig,
  beschreibungId,
  beispieleOffen,
  onBeispiele,
  diktat,
  wartet,
  gesperrt,
  sperrHinweis,
  nurLesen = false,
  lage = "unten",
}: {
  wert: string;
  onWert: (wert: string) => void;
  /** Formular abgeschickt (Knopf oder Eingabetaste). Der Aufrufer entscheidet, was folgt. */
  onAbsenden: () => void;
  /** E2E-018 / mega39 G: erst NACH einem leeren Absendeversuch „ungültig“. */
  ungueltig: boolean;
  beschreibungId?: string | undefined;
  beispieleOffen: boolean;
  onBeispiele: () => void;
  /** Ohne Spracherkennung `null` — dann steht KEIN Mikrofon da (JOB 3038). */
  diktat: { laeuft: boolean; umschalten: () => void; zwischen?: string } | null;
  /** Eine Anfrage läuft: Spinner im Sendeknopf, Knopf gesperrt. */
  wartet: boolean;
  /** Kein nutzbares Modell (D-AISTATE): der Sendeknopf ist hart gesperrt. */
  gesperrt: boolean;
  sperrHinweis?: string | undefined;
  /** Nur die Vorführung: das Feld zeigt Text, nimmt aber keine Eingabe an. */
  nurLesen?: boolean;
  /**
   * R-0286: „Nach dem Absenden ist die Antwort das erste, was der Nutzer liest — direkt unter dem
   * Eingabefeld." `"oben"` stellt das Feld in seine Quelltextstelle (vor das Ergebnis); `"unten"`
   * ist die Zielbild-H5-Lage (`order-3 mt-auto`), die die Tutorial-Vorführung weiter nutzt.
   */
  lage?: "oben" | "unten";
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <form
      className={`${lage === "unten" ? "order-3 mt-auto " : ""}flex items-center gap-3 rounded-[14px] border border-hairline bg-surface px-[18px] py-3.5 shadow-tile`}
      onSubmit={(e) => {
        e.preventDefault();
        onAbsenden();
      }}
    >
      <input
        value={wert}
        onChange={(e) => onWert(e.target.value)}
        readOnly={nurLesen}
        placeholder={t("beispielfragen.platzhalter")}
        aria-invalid={ungueltig}
        aria-describedby={beschreibungId}
        data-tutorial-ziel={FRAGEN_ZIEL.fragefeld}
        className="min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-muted-2"
      />
      {wert.trim().length === 0 ? (
        <button
          type="button"
          data-testid="ask-beispiele-knopf"
          data-tutorial-ziel={FRAGEN_ZIEL.beispiele}
          aria-expanded={beispieleOffen}
          onClick={onBeispiele}
          className={`shrink-0 rounded-btn px-2 py-0.5 text-[12px] font-semibold transition-colors ${
            beispieleOffen ? "text-brand-text" : "text-muted-2 hover:text-text"
          }`}
        >
          {t("ask.examplesLabel")}
        </button>
      ) : null}
      {/* FR-CAP-03: was gerade gesprochen wird, steht sofort sichtbar neben dem Feld — ins Feld
          selbst kommt erst das endgültig Erkannte. */}
      {diktat?.laeuft && diktat.zwischen ? (
        <span
          data-testid="ask-diktat-zwischen"
          aria-live="polite"
          className="min-w-0 max-w-[40%] shrink truncate text-[13px] italic text-muted-2"
        >
          {diktat.zwischen}
        </span>
      ) : null}
      {diktat ? (
        <button
          type="button"
          className={`shrink-0 rounded-btn p-0.5 transition-colors ${
            diktat.laeuft ? "text-brand-text" : "text-muted-2 hover:text-text"
          }`}
          onClick={diktat.umschalten}
          aria-pressed={diktat.laeuft}
          aria-label={diktat.laeuft ? t("ask.diktatStop") : t("ask.diktatStart")}
          title={diktat.laeuft ? t("ask.diktatStop") : t("ask.diktatStart")}
        >
          <Mic size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="submit"
        // PAKET 1 (D-AISTATE): hart ausgrauen, wenn kein Modell für „answer" nutzbar ist.
        // E2E-018: zusätzlich sperren, solange die Frage leer/Whitespace-only ist.
        disabled={wartet || gesperrt || wert.trim().length === 0}
        title={sperrHinweis}
        data-tutorial-ziel={FRAGEN_ZIEL.absenden}
        className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[50%] bg-ink text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="sr-only">{t("ask.submit")}</span>
        {wartet ? (
          <Loader2 size={16} strokeWidth={2.2} aria-hidden="true" className="animate-spin" />
        ) : (
          <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
        )}
      </button>
    </form>
  );
}
