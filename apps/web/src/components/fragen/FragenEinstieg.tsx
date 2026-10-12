// ================================================================================================
// produkt:20261010:fragen-pruefen-einstieg — DER EINSTIEG DER LEEREN FRAGENFLÄCHE.
// ================================================================================================
//
// Zwei Sätze und ein Knopf, nur solange die Fläche leer ist (`zeigeFragenEinstieg`): was diese
// Fläche tut, was der erste Schritt ist, und der Weg zu den fiktiven Beispielen. Der Knopf schaltet
// DENSELBEN Zustand wie „Beispiele" im Feld (`beispiele` in `pages/Ask.tsx`) — kein zweiter
// Beispielbestand, kein Senden. Gesendet wird erst mit einem Klick auf ein Beispiel, und das sagt
// dessen Beschriftung vorher (AUFTRAG-mega51 BLOCK H).
//
// Der erste Schritt beginnt bewusst NICHT mit „Nächster Schritt:" — dieser Satzanfang gehört auf
// dieser Fläche allein dem Antwortvertrag (`tests/app/mega54-ein-naechster-schritt-sammler.test.ts`).
// Das Bauteil steht ÜBER dem Feld: zwischen Feld und Antwort darf nichts stehen (R-0286).
import { useTranslation } from "react-i18next";
import { FRAGEN_EINSTIEG_KEYS } from "../../lib/fragenEinstieg";

export function FragenEinstieg({
  beispieleOffen,
  onBeispiele,
  beispieleId,
  beispielKnopf,
}: {
  beispieleOffen: boolean;
  onBeispiele: () => void;
  /** `id` des Beispielblocks — der Knopf steuert ihn sichtbar (`aria-controls`). */
  beispieleId: string;
  /**
   * Nur bei leerem Feld — dieselbe Regel wie „Beispiele" im Feld. Ein Beispiel ersetzt die Frage
   * im Feld; wer schon tippt, bekommt den Weg dorthin nicht zusätzlich angeboten.
   */
  beispielKnopf: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="ask-einstieg"
      className="mb-3 flex flex-col gap-1.5 rounded-btn bg-page px-3 py-2.5 text-[13px] leading-relaxed text-muted"
    >
      <p data-testid="ask-einstieg-erklaerung" className="m-0">
        {t(FRAGEN_EINSTIEG_KEYS.erklaerung)}
      </p>
      <p data-testid="ask-einstieg-schritt" className="m-0 font-semibold text-text">
        {t(FRAGEN_EINSTIEG_KEYS.ersterSchritt)}
      </p>
      {beispielKnopf ? (
        <div>
          <button
            type="button"
            data-testid="ask-einstieg-beispiele"
            aria-expanded={beispieleOffen}
            aria-controls={beispieleId}
            onClick={onBeispiele}
            className="rounded-btn text-[12.5px] font-semibold text-brand-text underline-offset-2 hover:underline"
          >
            {beispieleOffen
              ? t(FRAGEN_EINSTIEG_KEYS.beispieleVerbergen)
              : t(FRAGEN_EINSTIEG_KEYS.beispieleZeigen)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
