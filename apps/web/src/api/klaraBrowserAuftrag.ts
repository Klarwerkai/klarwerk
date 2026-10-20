// produkt:20261011:assistenz-browser-aktionen (BPA-03) — der Drahtvertrag der Browseraufträge im
// eigenen Klara-Gespräch (Spiegel von `services/app/src/klara-browser-aktion-dienst.ts`,
// `BrowserAuftragSicht`). Die Web-App LIEST hier nur den Verlauf; ausgeführt und gesteuert wird in
// der Leiste der Browsererweiterung. Entscheidungen fallen ausschliesslich am Server.
import { api } from "./client";

export interface BrowserAuftragSchritt {
  nr: number;
  aktionskennung: string;
  art: "lesen" | "fuellen" | "speichern" | "nachlesen" | "ausloesen";
  feld: string | null;
  knopf: string | null;
  stand: "offen" | "erfolgt" | "unklar" | "fehlgeschlagen" | "uebersprungen" | "zurueckgenommen";
  beleg: string | null;
  am: string | null;
}

export interface BrowserAuftragSicht {
  id: string;
  gespraechId: string | null;
  quelle: "getippt" | "gesprochen";
  wortlaut: string;
  ort: string;
  formular: string | null;
  stand: string;
  erfolg: boolean;
  text: string;
  schritte: BrowserAuftragSchritt[];
  ergebnis: { entwurfId: string; nachgelesen: boolean; zurueckgenommen: boolean } | null;
  klaerung: string | null;
  uebergabe: { grund: string; schritt: string } | null;
  bestaetigung: { knopf: string; bestaetigtAm: string } | null;
  ruecknahme: { art: string; text: string; am: string } | null;
  host: { browser: string; version: string; erweiterung: string; adapter: string };
  angelegtAm: string;
  geaendertAm: string;
}

export const klaraBrowserAuftragApi = {
  /** Die Browseraufträge des aktuellen eigenen Gesprächs, neueste zuerst. */
  liste: () => api.get<{ auftraege: BrowserAuftragSicht[] }>("/me/klara/browser-auftraege"),
};
