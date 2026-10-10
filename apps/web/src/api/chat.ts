// Interner Chat — der Draht zu `services/app/src/routes/chat-routes.ts`.
//
// Die Gestalt ist die des Servers; sie steht hier ein zweites Mal, weil die Web-App keine Servertypen
// importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export type GespraechArt = "direkt" | "gruppe" | "space" | "artikel";
export type ChatSichtbarkeit = "persoenlich" | "geteilt";

export interface ChatKonto {
  id: string;
  name: string;
  role: string;
}

export interface GespraechSicht {
  id: string;
  art: GespraechArt;
  sichtbarkeit: ChatSichtbarkeit;
  titel: string;
  teilnehmer: { id: string; name: string | null }[];
  space: { id: string; name: string } | null;
  artikel: {
    koId: string;
    titel: string;
    fassung: number;
    anhaenge: { id: string; name: string }[];
  } | null;
  angelegtAm: string;
}

export interface GespraechZeile extends GespraechSicht {
  anzahl: number;
  letzte: { vonName: string | null; text: string; am: string } | null;
}

export type VerweisSicht =
  | { sichtbar: true; koId: string; titel: string; fassung: number; vorschau: string }
  | { sichtbar: false };

export type AnhangSicht =
  | {
      sichtbar: true;
      koId: string;
      anhangId: string;
      name: string;
      mime: string;
      groesse: number | null;
      url: string;
    }
  | { sichtbar: false };

export type AusschnittSicht =
  | {
      sichtbar: true;
      text: string;
      fiktiv: boolean;
      quelle: string;
      koId: string | null;
      fassung: number | null;
      pfad: string | null;
    }
  | { sichtbar: false };

export interface NachrichtSicht {
  id: string;
  gespraechId: string;
  von: string;
  vonName: string | null;
  eigene: boolean;
  text: string;
  am: string;
  sendeKennung: string | null;
  erwaehnungen: { id: string; name: string | null }[];
  verweise: VerweisSicht[];
  anhaenge: AnhangSicht[];
  ausschnitt: AusschnittSicht | null;
  ausKlara: boolean;
  eigeneUebernahme: { entwurfId: string; am: string } | null;
}

export interface AusschnittEingabe {
  text: string;
  quelle: string;
  fiktiv: boolean;
  koId?: string;
  fassung?: number;
  pfad?: string;
}

export interface NachrichtEingabe {
  text: string;
  sendeKennung: string;
  erwaehnungen: string[];
  anhaenge: { koId: string; anhangId: string }[];
  ausschnitt?: AusschnittEingabe;
  ausKlara?: boolean;
}

export interface VerlaufSeite {
  gespraech: GespraechSicht;
  nachrichten: NachrichtSicht[];
  /** Es gibt ältere Nachrichten als die erste dieser Seite. */
  aelterVorhanden: boolean;
}

export interface Erwaehnung {
  nachrichtId: string;
  gespraechId: string;
  gespraechTitel: string;
  art: GespraechArt;
  vonName: string | null;
  am: string;
  auszug: string;
}

export type GespraechAnlage =
  | { art: "direkt"; teilnehmer: string[] }
  | { art: "gruppe"; titel: string; teilnehmer: string[] }
  | { art: "space"; spaceId: string }
  | { art: "artikel"; koId: string };

const pfad = (id: string): string => `/chat/gespraeche/${encodeURIComponent(id)}`;

export const chatApi = {
  konten: () => api.get<{ ich: string; konten: ChatKonto[] }>("/chat/konten"),
  liste: () =>
    api.get<{ gespraeche: GespraechZeile[]; spaces: { id: string; name: string }[] }>(
      "/chat/gespraeche",
    ),
  anlegen: (eingabe: GespraechAnlage) => api.post<GespraechSicht>("/chat/gespraeche", eingabe),
  gespraech: (id: string) => api.get<VerlaufSeite>(pfad(id)),
  /** Die Seite davor: Nachrichten, die älter sind als `vor` (die älteste schon gezeigte). */
  aeltere: (id: string, vor: string) =>
    api.get<VerlaufSeite>(`${pfad(id)}?vor=${encodeURIComponent(vor)}`),
  /** Eine einzelne Nachricht samt Gespräch — der Weg einer Erwähnung zu ihrem Ziel. */
  nachricht: (id: string) =>
    api.get<{ gespraech: GespraechSicht; nachricht: NachrichtSicht }>(
      `/chat/nachrichten/${encodeURIComponent(id)}`,
    ),
  senden: (id: string, eingabe: NachrichtEingabe) =>
    api.post<{ nachricht: NachrichtSicht; neu: boolean }>(`${pfad(id)}/nachrichten`, eingabe),
  inWissen: (nachrichtId: string) =>
    api.post<{ entwurfId: string; neu: boolean; herkunft: ChatSichtbarkeit }>(
      `/chat/nachrichten/${encodeURIComponent(nachrichtId)}/wissen`,
    ),
  erwaehnungen: () => api.get<{ erwaehnungen: Erwaehnung[] }>("/chat/erwaehnungen"),
};

/** Eine neue Sendekennung — sie bleibt bei jeder Wiederholung derselben Nachricht gleich. */
export function neueSendeKennung(): string {
  const zufall =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return zufall.replace(/[^A-Za-z0-9_-]/g, "");
}

// ================================================================================================
// DER ENTWURF AUS KLARA — er liegt nur im Speicher dieser Seite, bis ihn die Person sendet oder
// verwirft. Nichts davon geht an den Server, bevor „Senden" gedrückt ist.
// ================================================================================================

export interface KlaraNachrichtEntwurf {
  ausschnitt: AusschnittEingabe;
}

let klaraEntwurf: KlaraNachrichtEntwurf | null = null;
const klaraHoerer = new Set<() => void>();

export function setzeKlaraEntwurf(entwurf: KlaraNachrichtEntwurf | null): void {
  klaraEntwurf = entwurf;
  for (const hoerer of klaraHoerer) {
    hoerer();
  }
}

export function leseKlaraEntwurf(): KlaraNachrichtEntwurf | null {
  return klaraEntwurf;
}

export function abonniereKlaraEntwurf(hoerer: () => void): () => void {
  klaraHoerer.add(hoerer);
  return () => {
    klaraHoerer.delete(hoerer);
  };
}
