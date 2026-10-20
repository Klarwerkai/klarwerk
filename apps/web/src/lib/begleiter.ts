// ================================================================================================
// produkt:20261010:klara-office-mac-maskottchen (KLARA-OFFICE-02) — DIE BEGLEITAPP, OHNE REACT.
// ================================================================================================
//
// Was die Fläche der Begleitapp (`pages/Begleiter.tsx`) entscheidet, steht hier als reine Funktion:
//   · WELCHES Word-Fenster gilt (`waehleAdapter`) — nur eines, das der Office-Adapter angemeldet hat;
//   · WAS die Figur zeigt (`figurZustand`) — aus den tatsächlichen Zuständen von Gespräch,
//     Spracheingabe, Vorlesen und Kontextkanal, nie aus einer Animation „auf Verdacht";
//   · WIE WEIT eine Taste die Figur schiebt (`bewegungsSchritt`).
// Den Kanal selbst beschreibt `services/app/src/klara-begleiter.ts`; die Typen unten sind sein
// Drahtvertrag (`GET /api/me/klara/begleiter/kontext`).
import { api } from "../api/client";

export type BegleiterHost = "word-mac" | "word-web" | "word-windows" | "word-andere";
export type BegleiterAktionArt = "einfuegen" | "frage";
export type BegleiterAktionStand =
  | "offen"
  | "uebergeben"
  | "erledigt"
  | "abgelehnt"
  | "fehler"
  | "verfallen";

export interface BegleiterAdapter {
  instanz: string;
  host: BegleiterHost;
  hostFassung: string;
  dokument: { titel: string; gespeichert: boolean };
  aktiv: boolean;
  stilleMs: number;
  auswahl: { text: string; laenge: number; stand: number; gekuerzt: boolean } | null;
  aktionen: Array<{
    id: string;
    art: BegleiterAktionArt;
    stand: BegleiterAktionStand;
    ergebnis: string | null;
    grund: string | null;
  }>;
}

export interface BegleiterKontext {
  jetzt: string;
  aktivMs: number;
  adapter: BegleiterAdapter[];
}

export const begleiterApi = {
  kontext: () => api.get<BegleiterKontext>("/me/klara/begleiter/kontext"),
  beauftrage: (
    instanz: string,
    auftrag: { art: BegleiterAktionArt; text: string; auswahlStand: number },
  ) =>
    api.post<{ aktion: { id: string; art: BegleiterAktionArt; stand: BegleiterAktionStand } }>(
      `/me/klara/begleiter/adapter/${encodeURIComponent(instanz)}/aktionen`,
      auftrag,
    ),
};

/** So oft liest die Begleitapp den Kanal, solange sie angemeldet ist. */
export const BEGLEITER_ABRUF_MS = 1500;

/**
 * Das Word-Fenster, an das die Begleitapp gebunden ist.
 *
 *   · Hat die Person eines gewählt und meldet der Kanal es noch, bleibt es gebunden — auch wenn es
 *     gerade inaktiv ist. Dann zeigt die Fläche das ehrlich („meldet sich nicht"), statt still auf
 *     ein anderes Fenster zu springen.
 *   · Sonst gilt das zuletzt aktive Fenster (der Kanal sortiert nach der jüngsten Auswahländerung —
 *     ein Signal aus Office, nicht aus dem Bildschirm).
 *   · Gibt es kein aktives, ist KEINES gebunden: ohne aktiven Adapter keine Auswahl.
 */
export function waehleAdapter(
  kontext: BegleiterKontext | null,
  gewaehlt: string | null,
): BegleiterAdapter | null {
  if (!kontext) {
    return null;
  }
  if (gewaehlt !== null) {
    const fest = kontext.adapter.find((a) => a.instanz === gewaehlt);
    if (fest) {
      return fest;
    }
  }
  return kontext.adapter.find((a) => a.aktiv) ?? null;
}

/** Die Auswahl, die die Begleitapp verwenden darf — nur von einem AKTIVEN, gebundenen Adapter. */
export function gueltigeAuswahl(adapter: BegleiterAdapter | null): BegleiterAdapter["auswahl"] {
  return adapter?.aktiv ? adapter.auswahl : null;
}

export type FigurZustand = "ruhe" | "wartet" | "antwortet" | "fehler" | "hoert" | "spricht";

export interface FigurEingang {
  /** Eine Frage läuft (`echt.laeuftSeit`) oder eine Aktion wartet auf Word. */
  wartet: boolean;
  /** Die Spracheingabe hört gerade zu. */
  hoert: boolean;
  /** Eine Antwort wird gerade vorgelesen. */
  liest: boolean;
  /** Modus der jüngsten Nachricht von Klara — oder `null`. */
  letzteModus: string | null;
  /** Wann sie angelegt wurde (ms) — oder `null`. */
  letzteAm: number | null;
  /** Ein Ladefehler des Gesprächs oder des Kontextkanals steht an. */
  stoerung: boolean;
  jetzt: number;
}

/** So lange zeigt die Figur „Antwort da" bzw. „Fehler" nach der jüngsten Nachricht. */
export const FIGUR_NACHKLANG_MS = 8_000;

/**
 * Was die Figur zeigt. Vorrang hat, was die Person gerade TUT (Zuhören, Vorlesen), dann was sie
 * erwartet (Warten), dann was zuletzt geschah (Fehler vor Antwort), sonst Ruhe.
 */
export function figurZustand(e: FigurEingang): FigurZustand {
  if (e.hoert) {
    return "hoert";
  }
  if (e.liest) {
    return "spricht";
  }
  if (e.wartet) {
    return "wartet";
  }
  if (e.stoerung) {
    return "fehler";
  }
  const frisch = e.letzteAm !== null && e.jetzt - e.letzteAm <= FIGUR_NACHKLANG_MS;
  if (frisch && (e.letzteModus === "fehler" || e.letzteModus === "abgebrochen")) {
    return "fehler";
  }
  if (frisch && (e.letzteModus === "ki" || e.letzteModus === "ohne_ki")) {
    return "antwortet";
  }
  return "ruhe";
}

/** Schritt je Pfeiltaste in Bildschirmpunkten; mit Umschalt der grosse Schritt. */
export const SCHRITT_KLEIN = 12;
export const SCHRITT_GROSS = 60;

export function bewegungsSchritt(taste: string, gross: boolean): { dx: number; dy: number } | null {
  const weite = gross ? SCHRITT_GROSS : SCHRITT_KLEIN;
  switch (taste) {
    case "ArrowLeft":
      return { dx: -weite, dy: 0 };
    case "ArrowRight":
      return { dx: weite, dy: 0 };
    // Bildschirmkoordinaten: nach oben ist kleiner y (die App rechnet selbst um).
    case "ArrowUp":
      return { dx: 0, dy: -weite };
    case "ArrowDown":
      return { dx: 0, dy: weite };
    default:
      return null;
  }
}

/** Läuft für dieses Fenster noch eine Aktion (übergeben oder offen)? */
export function aktionLaeuft(adapter: BegleiterAdapter | null): boolean {
  return Boolean(adapter?.aktionen.some((a) => a.stand === "offen" || a.stand === "uebergeben"));
}
