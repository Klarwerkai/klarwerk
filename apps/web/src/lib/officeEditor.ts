// ================================================================================================
// OFFICE IM ARTIKEL · DIE NACHRICHTEN DES EINGEBETTETEN EDITORS, REIN UND OHNE DOM.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-artikel-editor`. Der Editor (Collabora Online über WOPI) spricht
// mit der einbettenden Seite über `postMessage` (JSON-Text mit `MessageId` und `Values`). Hier steht,
// was die Artikelseite davon liest und wie daraus ein sichtbarer Zustand wird. Angenommen wird nur,
// was von GENAU der Editor-Herkunft kommt (`istVomEditor`).
//
// KLARA UND DIE AUSWAHL IM EDITOR (Kriterium 7): Klara liest Markierungen aus dem Seiten-DOM. Ein
// Editor fremder Herkunft im iframe gibt seine Auswahl dort nicht preis, und die Nachrichten, die der
// Editor sendet, tragen keinen markierten Text. `auswahlVomEditor` ist deshalb die EINE Stelle, die
// das entscheidet — sie liefert heute immer `null`, und die Fläche sagt das sichtbar, statt Klara
// einen Kontext anzubieten, den es nicht gibt.

export type EditorPhase =
  | "laedt"
  | "bereit"
  | "speichert"
  | "uebernimmt"
  | "fehler"
  | "abgebrochen"
  | "geschlossen";

export interface EditorNachricht {
  readonly id: string;
  readonly werte: Readonly<Record<string, unknown>>;
}

/** Ohne `Document_Loaded` in dieser Zeit gilt das Öffnen als gescheitert — sichtbar, nie still. */
export const LADE_FRIST_MS = 45_000;
/** So lange wartet „Speichern" auf die Bestätigung des Editors. */
export const SPEICHER_FRIST_MS = 30_000;

export function istVomEditor(herkunft: string, editorHerkunft: string): boolean {
  return herkunft === editorHerkunft;
}

/** Eine Editor-Nachricht lesen; alles Unlesbare ist `null`. */
export function leseEditorNachricht(daten: unknown): EditorNachricht | null {
  let roh: unknown = daten;
  if (typeof daten === "string") {
    try {
      roh = JSON.parse(daten);
    } catch {
      return null;
    }
  }
  if (!roh || typeof roh !== "object") {
    return null;
  }
  const r = roh as { MessageId?: unknown; Values?: unknown };
  if (typeof r.MessageId !== "string") {
    return null;
  }
  const werte =
    r.Values && typeof r.Values === "object" ? (r.Values as Record<string, unknown>) : {};
  return { id: r.MessageId, werte };
}

export type EditorEreignis =
  | { art: "rahmen-bereit" }
  | { art: "geladen" }
  | { art: "ladefehler" }
  | { art: "gespeichert"; erfolg: boolean }
  | { art: "geschlossen" }
  | { art: "anderes" };

/** Was eine Nachricht für die Artikelseite bedeutet. */
export function deuteNachricht(n: EditorNachricht): EditorEreignis {
  switch (n.id) {
    case "App_LoadingStatus":
      if (n.werte.Status === "Frame_Ready") {
        return { art: "rahmen-bereit" };
      }
      if (n.werte.Status === "Document_Loaded") {
        return { art: "geladen" };
      }
      if (n.werte.Status === "Failed") {
        return { art: "ladefehler" };
      }
      return { art: "anderes" };
    case "Action_Save_Resp":
      return { art: "gespeichert", erfolg: n.werte.success === true };
    case "UI_Close":
    case "close":
      return { art: "geschlossen" };
    default:
      return { art: "anderes" };
  }
}

/** Die Nachricht, mit der die Seite den Editor speichern lässt (Collabora `Action_Save`). */
export function speicherNachricht(): string {
  return JSON.stringify({
    MessageId: "Action_Save",
    SendTime: Date.now(),
    Values: { DontTerminateEdit: true, DontSaveIfUnmodified: false, Notify: true },
  });
}

/** Antwort auf `Frame_Ready`: erst danach schickt der Editor seine Statusmeldungen. */
export function bereitNachricht(): string {
  return JSON.stringify({ MessageId: "Host_PostmessageReady", SendTime: Date.now() });
}

/**
 * Welchen markierten Text der Editor an Klara übergibt. Heute: keinen — keine Nachricht des Editors
 * trägt die Auswahl (s. Kopf). Erst wenn eine Anbindung sie tatsächlich liefert, darf hier etwas
 * anderes als `null` stehen.
 */
export function auswahlVomEditor(_nachricht: EditorNachricht): string | null {
  return null;
}
