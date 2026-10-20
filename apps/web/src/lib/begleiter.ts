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
  | "verfallen"
  | "gestoppt";

export interface BegleiterAdapter {
  instanz: string;
  host: BegleiterHost;
  hostFassung: string;
  dokument: { titel: string; gespeichert: boolean };
  aktiv: boolean;
  stilleMs: number;
  /** Nacharbeit 64: hat das Fenster in dieser Kanalinstanz seinen laufenden Bestand gemeldet? */
  bestand?: boolean;
  auswahl: { text: string; laenge: number; stand: number; gekuerzt: boolean } | null;
  aktionen: Array<{
    id: string;
    art: BegleiterAktionArt;
    stand: BegleiterAktionStand;
    ergebnis: string | null;
    grund: string | null;
    /** Der Abbruch einer übergebenen Aktion ist angefordert; Word hat ihr Ende noch nicht gemeldet. */
    abbruchAngefordert?: boolean;
  }>;
}

export interface BegleiterKontext {
  jetzt: string;
  aktivMs: number;
  /** Nacharbeit 64: Kennung der Kanalinstanz; ein Wechsel heißt Serverneustart (Bestand verloren). */
  kanal?: string;
  adapter: BegleiterAdapter[];
}

export const begleiterApi = {
  kontext: () => api.get<BegleiterKontext>("/me/klara/begleiter/kontext"),
  beauftrage: (
    instanz: string,
    auftrag: {
      art: BegleiterAktionArt;
      text: string;
      auswahlStand: number;
      schluessel: string;
      /** Nacharbeit 59: Serverzeit (`jetzt`) des Kontexts, den die Begleitapp gesehen hat. */
      ausgestelltAm: string;
      /** Nacharbeit 64: Kanalinstanz desselben Kontexts. */
      kanal: string;
    },
  ) =>
    api.post<{ aktion: { id: string; art: BegleiterAktionArt; stand: BegleiterAktionStand } }>(
      `/me/klara/begleiter/adapter/${encodeURIComponent(instanz)}/aktionen`,
      auftrag,
    ),
  /**
   * Nacharbeit 58 (MACG57-POST-GET-01): auftragsbezogene Klärung, wenn die Antwort einer
   * Beauftragung verloren ging. `nicht_angelegt` ist endgültig — der Schlüssel ist dann gesperrt.
   */
  // Nacharbeit 63: mit dem Ausstellungszeitpunkt des Auftrags; `unbekannt` heißt: nicht mehr sicher
  // klärbar — angenommen werden kann er nicht mehr, und dazu läuft nichts.
  // Nacharbeit 64: dazu Kanalinstanz und Zielfenster. Aus einer früheren Kanalinstanz
  // (Serverneustart) entscheidet das Zielfenster: `nicht_laufend` (es führt den Auftrag nicht aus)
  // oder `offen` (es hat sich noch nicht gemeldet — weiter fragen).
  klaere: (auftrag: {
    schluessel: string;
    ausgestelltAm: string;
    kanal: string;
    instanz: string;
  }) =>
    api.post<
      | {
          stand: "angenommen";
          instanz: string;
          aktion: { id: string; art: BegleiterAktionArt; stand: BegleiterAktionStand };
          /** Nacharbeit 65: die Kanalinstanz, die die Annahme belegt. */
          kanal?: string;
        }
      | { stand: "nicht_angelegt" }
      | { stand: "unbekannt" }
      | { stand: "nicht_laufend" }
      | { stand: "offen" }
    >(`/me/klara/begleiter/auftraege/${encodeURIComponent(auftrag.schluessel)}/klaeren`, {
      ausgestelltAm: auftrag.ausgestelltAm,
      kanal: auftrag.kanal,
      instanz: auftrag.instanz,
    }),
  /**
   * UI-MIN-06/14: eine Aktion stoppen. Offen: sofort zurückgezogen. Übergeben: der Abbruch geht an
   * das ausführende Word-Fenster; das Ende bestätigt Word (`gestoppt` bzw. schon `erledigt`).
   */
  stoppe: (instanz: string, aktion: string) =>
    api.post<{
      aktion: {
        id: string;
        art: BegleiterAktionArt;
        stand: BegleiterAktionStand;
        abbruchAngefordert?: boolean;
      };
    }>(
      `/me/klara/begleiter/adapter/${encodeURIComponent(instanz)}/aktionen/${encodeURIComponent(aktion)}/stopp`,
      {},
    ),
};

/** Nacharbeit 58: ein zufälliger Auftragsschlüssel je Beauftragung (Korrelation mit `klaere`). */
export function neuerAuftragsschluessel(): string {
  // getRandomValues gilt auch ausserhalb eines sicheren Kontexts (anders als randomUUID).
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * UI-MIN-06/14: jede laufende Word-Aktion ALLER eigenen Fenster — nicht nur des gebundenen. `offen`
 * ist noch zurückziehbar, `uebergeben` führt Word gerade aus.
 */
export function laufendeWordAktionen(
  kontext: BegleiterKontext | null,
): Array<{ adapter: BegleiterAdapter; aktion: BegleiterAdapter["aktionen"][number] }> {
  const liste: Array<{ adapter: BegleiterAdapter; aktion: BegleiterAdapter["aktionen"][number] }> =
    [];
  for (const adapter of kontext?.adapter ?? []) {
    for (const aktion of adapter.aktionen) {
      if (aktion.stand === "offen" || aktion.stand === "uebergeben") {
        liste.push({ adapter, aktion });
      }
    }
  }
  return liste;
}

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

/**
 * produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-04): verlangt diese Frage nach
 * dem Dokument in Word — der Markierung, einem Absatz, dem Dokument selbst? Dann braucht sie die
 * Word-Verbindung, und die Fläche bietet GENAU DANN die Verbindungshilfe an. Eine freie Frage bleibt
 * frei. Die Wortliste ist bewusst eng (DE/EN/NL), eine falsche Erkennung kostet nur eine Rückfrage
 * mit „Ohne Dokument fragen“.
 */
const DOKUMENTBEZUG =
  /\b(markier\w*|auswahl|ausgew[aä]hlt\w*|dokument\w*|absatz|abs[aä]tze|word|selection|selected|highlighted|document|paragraph|markering|gemarkeerd\w*|selectie|alinea)\b/i;

export function dokumentBezogen(frage: string): boolean {
  return DOKUMENTBEZUG.test(frage);
}

/** Läuft für dieses Fenster noch eine Aktion (übergeben oder offen)? */
export function aktionLaeuft(adapter: BegleiterAdapter | null): boolean {
  return Boolean(adapter?.aktionen.some((a) => a.stand === "offen" || a.stand === "uebergeben"));
}
