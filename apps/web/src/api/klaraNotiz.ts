// produkt:20261007:klara-notizen-aufgaben (Klara 06) — der Drahtvertrag der privaten Notizen
// (Spiegel von `services/app/src/klara-notiz.ts` und `routes/klara-notiz-routes.ts`). Das Konto
// kommt am Server aus der Sitzung; hier steht nie eine Kontokennung.
import { api } from "./client";
import type { KlaraObjektbezug } from "./klaraGespraech";

export type KlaraNotizArt = "notiz" | "arbeitszettel";
export type KlaraNotizWeg = "geschrieben" | "diktiert" | "gespraech" | "ausschnitt";

export interface KlaraNotiz {
  id: string;
  vorgang: string;
  art: KlaraNotizArt;
  weg: KlaraNotizWeg;
  titel: string;
  inhalt: string;
  offeneFragen: string[];
  /** Der Rücklink: Seite und Objekt beim Anlegen — ändert sich beim Bearbeiten nie. */
  objektbezug: KlaraObjektbezug;
  quelle: { gespraechId: string; nachrichtId: string } | null;
  angelegtAm: string;
  geaendertAm: string;
  fassung: number;
}

/** Was eine neue Notiz trägt. Aus dem Gespräch nennt sie nur die Quelle; den Rest liest der Server. */
export type KlaraNotizEingabe =
  | {
      weg: "geschrieben" | "diktiert" | "ausschnitt";
      inhalt: string;
      objektbezug: KlaraObjektbezug;
      titel?: string;
      art?: KlaraNotizArt;
      offeneFragen?: string[];
    }
  | {
      weg: "gespraech";
      quelle: { gespraechId: string; nachrichtId: string };
      titel?: string;
      art?: KlaraNotizArt;
      offeneFragen?: string[];
    };

export interface KlaraNotizAenderung {
  fassung: number;
  titel: string;
  inhalt: string;
  offeneFragen: string[];
  art: KlaraNotizArt;
}

const BASIS = "/me/klara/notizen";

export const klaraNotizApi = {
  liste: (q: string) =>
    api.get<{ notizen: KlaraNotiz[] }>(q.trim() ? `${BASIS}?q=${encodeURIComponent(q)}` : BASIS),
  /** `vorgang` bleibt für jede Wiederholung desselben Anlegens gleich — keine Doppelnotiz. */
  lege: (vorgang: string, eingabe: KlaraNotizEingabe) =>
    api.post<{ notiz: KlaraNotiz; wiederholt: boolean }>(BASIS, { ...eingabe, vorgang }),
  hole: (id: string) => api.get<{ notiz: KlaraNotiz }>(`${BASIS}/${encodeURIComponent(id)}`),
  aendere: (id: string, aenderung: KlaraNotizAenderung) =>
    api.put<{ notiz: KlaraNotiz; wiederholt: boolean }>(
      `${BASIS}/${encodeURIComponent(id)}`,
      aenderung,
    ),
  loesche: (id: string) => api.del<{ geloescht: number }>(`${BASIS}/${encodeURIComponent(id)}`),
};
