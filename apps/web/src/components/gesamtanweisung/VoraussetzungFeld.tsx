// ==================================================================================================
// JOB 4154 · DIE VORAUSSETZUNG EINES BAUSTEINS — BEARBEITBAR, UND LEEREN HEISST LEEREN.
// ==================================================================================================
//
// „Reihenfolge/Voraussetzungen bearbeiten" ist Teil der ersten vollständigen Lieferung
// (Startvertrag). Die Reihenfolge trägt die Liste; die Voraussetzung trägt dieses Feld.
//
// EIN LEERES FELD IST EINE ANGABE UND KEIN FEHLEN. Wer den Text löscht und übernimmt, nimmt die
// Voraussetzung zurück — deshalb geht `null` an den Server und nicht `undefined`, das
// `JSON.stringify` spurlos verschlucken würde (derselbe Grund wie bei `setAccessExpiry`,
// `api/endpoints.ts`).
//
// Eigenes `<form>`: Enter im Feld übernimmt, genau wie der Knopf. Kein Speichern beim Tippen —
// sonst schriebe jede Taste einen Schreibvorgang und erhöhte die Version.
//
// FE-001 · LAUF 4 (Bens Befund BEN-02, E8): ein Text, der vom gespeicherten Wert abweicht, ist
// NICHT übernommen. Das Feld sagt das selbst und meldet es nach oben (`meldeUngespeichert`) — die
// Seite sperrt dann das Vorlegen, genau wie bei ungespeicherten Kopfangaben. Verglichen wird wie
// beim Übernehmen: getrimmt, und leer entspricht `null`.
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FELD, FELD_LABEL, HINWEIS, KNOPF_NEBEN } from "./gestaltung";

/** Weicht der Feldtext von der gespeicherten Voraussetzung ab? Rein, damit einzeln prüfbar. */
export function voraussetzungUngespeichert(text: string, wert: string | null): boolean {
  const getrimmt = text.trim();
  return (getrimmt.length > 0 ? getrimmt : null) !== (wert ?? null);
}

export function VoraussetzungFeld({
  bausteinId,
  wert,
  gesperrt,
  uebernehmen,
  meldeUngespeichert,
}: {
  bausteinId: string;
  wert: string | null;
  gesperrt: boolean;
  uebernehmen: (voraussetzung: string | null) => void;
  /** Meldet, ob im Feld ein noch nicht übernommener Text steht. */
  meldeUngespeichert?: (bausteinId: string, ungespeichert: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [text, setText] = useState(wert ?? "");
  const feldId = `ga-voraussetzung-${bausteinId}`;
  const hinweisId = `${feldId}-ungespeichert`;
  const ungespeichert = voraussetzungUngespeichert(text, wert);
  // Ein NEUER Serverwert wird übernommen — aber nur, wenn das Feld bis dahin nichts Eigenes trug.
  // Sonst stünde nach einer fremden Änderung der alte Text da und gälte als ungespeichert.
  const letzterWert = useRef(wert);
  useEffect(() => {
    const vorher = letzterWert.current;
    if (vorher !== wert) {
      setText((bisher) => (voraussetzungUngespeichert(bisher, vorher) ? bisher : (wert ?? "")));
      letzterWert.current = wert;
    }
  }, [wert]);
  useEffect(() => {
    meldeUngespeichert?.(bausteinId, ungespeichert);
  }, [bausteinId, ungespeichert, meldeUngespeichert]);
  // Verschwindet der Abschnitt, verschwindet auch seine offene Eingabe.
  useEffect(
    () => () => {
      meldeUngespeichert?.(bausteinId, false);
    },
    [bausteinId, meldeUngespeichert],
  );

  function absenden(event: FormEvent): void {
    event.preventDefault();
    if (gesperrt) {
      return;
    }
    const getrimmt = text.trim();
    uebernehmen(getrimmt.length > 0 ? getrimmt : null);
  }

  return (
    <form onSubmit={absenden}>
      <label htmlFor={feldId} className={FELD_LABEL}>
        {t("ga.voraussetzung.label")}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={feldId}
          name={`voraussetzung-${bausteinId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={ungespeichert ? hinweisId : undefined}
          className={`${FELD} min-w-0 flex-1 basis-48`}
        />
        <button type="submit" disabled={gesperrt} className={`${KNOPF_NEBEN} mt-1 min-h-9`}>
          {t("ga.voraussetzung.knopf")}
        </button>
      </div>
      {ungespeichert ? (
        <p
          id={hinweisId}
          className={`${HINWEIS} mt-1`}
          data-testid="ga-voraussetzung-ungespeichert"
        >
          {t("fe001.voraussetzung.ungespeichert")}
        </p>
      ) : null}
    </form>
  );
}
