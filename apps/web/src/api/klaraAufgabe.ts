// produkt:20261008:klara-aufgaben (Klara 07) — der Drahtvertrag der persönlichen Aufgaben
// (Spiegel von `services/app/src/klara-aufgabe.ts` und `routes/klara-aufgabe-routes.ts`). Das Konto
// kommt am Server aus der Sitzung; hier steht nie eine Kontokennung.
import { api } from "./client";
import type { KlaraObjektbezug } from "./klaraGespraech";

export type KlaraAufgabePrioritaet = "hoch" | "mittel" | "niedrig";
export type KlaraAufgabeStatus = "offen" | "erledigt";

export type KlaraAufgabeBezug =
  | { art: "notiz"; notizId: string; notizTitel: string }
  | {
      art: "auftrag";
      gespraechId: string;
      auftragId: string;
      wortlaut: string;
      quelle: "getippt" | "gesprochen";
    };

export interface KlaraAufgabe {
  id: string;
  vorgang: string;
  /** Immer `persoenlich` — gemeinsame Aufgaben wohnen in ihren eigenen Quellen. */
  bereich: "persoenlich";
  /** Die fragende Person ist die zuständige. */
  zustaendig: "selbst";
  weg: "notiz" | "auftrag";
  titel: string;
  inhalt: string;
  prioritaet: KlaraAufgabePrioritaet;
  status: KlaraAufgabeStatus;
  bezug: KlaraAufgabeBezug;
  /** Der Ort beim Anlegen (Rücklink der Notiz bzw. Ort des Gesprächs) — ändert sich nie. */
  objektbezug: KlaraObjektbezug;
  angelegtAm: string;
  geaendertAm: string;
  erledigtAm: string | null;
  fassung: number;
}

/** Eine Aufgabe aus einer eigenen Notiz. Aus einem Auftrag legt nur die Ausführung am Server an. */
export interface KlaraAufgabeAusNotiz {
  weg: "notiz";
  quelle: { notizId: string };
  titel?: string;
  inhalt?: string;
  prioritaet?: KlaraAufgabePrioritaet;
}

export interface KlaraAufgabeAenderung {
  fassung: number;
  titel?: string;
  inhalt?: string;
  prioritaet?: KlaraAufgabePrioritaet;
  status?: KlaraAufgabeStatus;
}

const BASIS = "/me/klara/aufgaben";

export const klaraAufgabeApi = {
  liste: () => api.get<{ aufgaben: KlaraAufgabe[] }>(BASIS),
  /** `vorgang` bleibt für jede Wiederholung desselben Anlegens gleich — keine Doppelaufgabe. */
  lege: (vorgang: string, eingabe: KlaraAufgabeAusNotiz) =>
    api.post<{ aufgabe: KlaraAufgabe; wiederholt: boolean }>(BASIS, { ...eingabe, vorgang }),
  hole: (id: string) => api.get<{ aufgabe: KlaraAufgabe }>(`${BASIS}/${encodeURIComponent(id)}`),
  aendere: (id: string, aenderung: KlaraAufgabeAenderung) =>
    api.put<{ aufgabe: KlaraAufgabe; wiederholt: boolean }>(
      `${BASIS}/${encodeURIComponent(id)}`,
      aenderung,
    ),
  loesche: (id: string) => api.del<{ geloescht: number }>(`${BASIS}/${encodeURIComponent(id)}`),
};
