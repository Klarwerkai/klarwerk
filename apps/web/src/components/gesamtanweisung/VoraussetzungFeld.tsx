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
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

export function VoraussetzungFeld({
  bausteinId,
  wert,
  gesperrt,
  uebernehmen,
}: {
  bausteinId: string;
  wert: string | null;
  gesperrt: boolean;
  uebernehmen: (voraussetzung: string | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [text, setText] = useState(wert ?? "");
  const feldId = `ga-voraussetzung-${bausteinId}`;

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
      <label htmlFor={feldId}>{t("ga.voraussetzung.label")}</label>
      <input
        id={feldId}
        name={`voraussetzung-${bausteinId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" disabled={gesperrt}>
        {t("ga.voraussetzung.knopf")}
      </button>
    </form>
  );
}
