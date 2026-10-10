// produkt:20261008:klara-basis — der Drahtvertrag der persönlichen Klara-Gespräche
// (Spiegel von `services/app/src/klara-gespraech.ts` und `routes/klara-gespraech-routes.ts`) und der
// abbrechbare Frageweg für Klara. Die Frage selbst geht über den UNVERÄNDERTEN Frageweg `/api/ask`:
// KI-Abschaltung, Sichtbarkeit und die zentralen Freigaben wirken dort, nicht hier.
import type { ReasonerLocale } from "../lib/reasonerLocale";
import { api } from "./client";
import type { AnswerResult, VerschlossenHinweis } from "./types";

/** Klara 03: Seite, Markierung oder freies Gespräch. */
export type KlaraBezug = "seite" | "markierung" | "frei";

export interface KlaraObjektbezug {
  pfad: string;
  seitenName: string;
  objekt: string;
  artikelId?: string;
  absatz?: number;
  // produkt:20261007:klara-kontext-tutorial (Klara 03) — der Bezug aus dem Appzustand.
  koId?: string;
  fassung?: number;
  modus?: "lesen" | "bearbeiten";
  pruefstatus?: "geprueft" | "ungeprueft";
  lesart?: "original" | "uebersetzung";
  bezug?: KlaraBezug;
  /** Der Anfang der Markierung (höchstens 300 Zeichen), nur beim Bezug „markierung". */
  auswahl?: string;
}

/** Klara 03: Titel, Fassung und Prüfstatus einer Antwortquelle, wie der Frageweg sie nannte. */
export interface KlaraQuellenAngabe {
  koId: string;
  titel: string;
  fassung: number | null;
  geprueft: boolean | null;
}

export type KlaraModus =
  | "frage"
  | "hilfe"
  | "ki"
  | "ohne_ki"
  | "hilfetext"
  | "abgebrochen"
  | "fehler";

export interface KlaraGespraechNachricht {
  id: string;
  von: "du" | "klara";
  modus: KlaraModus;
  text: string;
  objektbezug: KlaraObjektbezug;
  antwortId: string | null;
  quellen: string[];
  /** Klara 03 — fehlt bei älteren Nachrichten. */
  quellenAngaben?: KlaraQuellenAngabe[];
  wissensklasse: string | null;
  grund: string | null;
  angelegtAm: string;
}

export type KlaraSchrittStand = "laeuft" | "beantwortet" | "abgebrochen" | "fehlgeschlagen";

export interface KlaraSchritt {
  art: "frage" | "hilfe";
  text: string;
  objektbezug: KlaraObjektbezug;
  stand: KlaraSchrittStand;
  begonnenAm: string;
  geaendertAm: string;
}

export interface KlaraGespraech {
  id: string;
  objektbezug: KlaraObjektbezug;
  nachrichten: KlaraGespraechNachricht[];
  letzterSchritt: KlaraSchritt | null;
  einwilligungAm: string | null;
  angelegtAm: string;
  geaendertAm: string;
}

/** Was Klara festhalten will — der Server prüft jedes Feld selbst. */
export interface KlaraNachrichtEingabe {
  von: "du" | "klara";
  modus: KlaraModus;
  text: string;
  objektbezug: KlaraObjektbezug;
  antwortId?: string;
  quellen?: string[];
  quellenAngaben?: KlaraQuellenAngabe[];
  wissensklasse?: string;
  grund?: string;
}

/** Die Antwort von `POST /api/ask`, soweit Klara sie liest — `answerId` bindet die Ablage. */
export interface KlaraAskAntwort {
  result: AnswerResult;
  answerId?: string | null;
  /** Klara 03: die Fassung jeder herangezogenen Quelle, wie DIESE Antwort sie las (R-0338). */
  quellenStand?: Record<string, number>;
  /** Klara 03: Treffer, die nicht antworten durften (ungeprüft, Freigabe fehlt) — nur Kennung/Titel. */
  verschlossen?: VerschlossenHinweis[];
}

const BASIS = "/me/klara";

export const klaraGespraechApi = {
  aktuelles: () => api.get<{ gespraech: KlaraGespraech | null }>(`${BASIS}/gespraech`),
  beginne: (objektbezug: KlaraObjektbezug) =>
    api.post<{ gespraech: KlaraGespraech }>(`${BASIS}/gespraeche`, { objektbezug }),
  nachricht: (id: string, eingabe: KlaraNachrichtEingabe) =>
    api.post<{ nachricht: KlaraGespraechNachricht; gespraech: KlaraGespraech }>(
      `${BASIS}/gespraeche/${encodeURIComponent(id)}/nachrichten`,
      eingabe,
    ),
  schritt: (id: string, schritt: Pick<KlaraSchritt, "art" | "text" | "objektbezug" | "stand">) =>
    api.put<{ gespraech: KlaraGespraech }>(
      `${BASIS}/gespraeche/${encodeURIComponent(id)}/schritt`,
      schritt,
    ),
  einwilligung: (id: string, erteilt: boolean) =>
    api.put<{ gespraech: KlaraGespraech }>(
      `${BASIS}/gespraeche/${encodeURIComponent(id)}/einwilligung`,
      { erteilt },
    ),
  loesche: (id: string) =>
    api.del<{ geloescht: number }>(`${BASIS}/gespraeche/${encodeURIComponent(id)}`),
  /** Der Frageweg der Fragen-Seite, nur abbrechbar. Der Faden sind die vorigen Fragen. */
  frage: (
    question: string,
    locale: ReasonerLocale,
    thread: readonly string[],
    signal: AbortSignal,
  ) =>
    api.postAbbrechbar<KlaraAskAntwort>(
      "/ask",
      { question, locale, ...(thread.length > 0 ? { thread } : {}) },
      signal,
    ),
};
