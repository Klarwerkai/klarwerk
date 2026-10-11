// Gemeinsamer Artikelentwurf — der Draht zu `services/app/src/routes/gemeinsam-routes.ts`
// (produkt:20261007:artikel-gemeinsam).
//
// Die Gestalt ist die des Servers (`services/app/src/gemeinsamer-entwurf.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";
import type { Confidentiality, KnowledgeObject } from "./types";

export type EntwurfsZustand = "offen" | "uebernommen" | "eingereicht";

export type EntwurfsSchrittArt =
  | "angelegt"
  | "gespeichert"
  | "zusammengefuehrt"
  | "angeglichen"
  | "uebernommen"
  | "eingereicht";

export interface EntwurfsSchritt {
  revision: number;
  am: string;
  name: string;
  eigen: boolean;
  art: EntwurfsSchrittArt;
  fassung?: number;
  vorschlagId?: string;
}

export interface GemeinsamerEntwurf {
  id: string;
  zustand: EntwurfsZustand;
  revision: number;
  basisVersion: number;
  titel: string;
  /** Der Inhalt als HTML — derselbe Rumpf, den der einheitliche Editor schreibt. */
  rumpf: string;
  /** Der Klartext dieses Rumpfs (Anzeige, Vergleich). */
  text: string;
  geaendertAm: string;
  geaendertVon: string;
  beteiligte: string[];
  verlauf: EntwurfsSchritt[];
}

export interface GemeinsamLage {
  entwurf: GemeinsamerEntwurf | null;
  abgeschlossen: GemeinsamerEntwurf | null;
  lesefassung: {
    version: number;
    status: string;
    titel: string;
    rumpf: string;
    text: string;
    /** Die Vertraulichkeitsstufe des Artikels (für die KI-Wege des Editors). */
    vertraulichkeit?: Confidentiality | null;
  };
  /** `vorschlag`: freigegebener Artikel ohne Freigaberecht — die Übernahme wird ein Vorschlag. */
  weg: "direkt" | "vorschlag";
  uebernahme: {
    revision: number;
    basisVersion: number;
    /** Beruht der Entwurf auf der jetzt gültigen Fassung? Sonst erst angleichen. */
    aktuell: boolean;
    titelGeht: boolean;
    aenderung: { title: string; statement: string; bodyHtml: string };
  } | null;
}

export interface GemeinsamGespeichert extends GemeinsamLage {
  zusammengefuehrt: boolean;
  unveraendert: boolean;
}

/** Ein Teil der Zusammenführung, wie der Server ihn im Konfliktfall nennt. */
export type KonfliktTeil =
  | { art: "geloest"; abschnitte: string[] }
  | { art: "konflikt"; basis: string[]; meine: string[]; deren: string[] };

/** Die Details eines `ENTWURF_KONFLIKT`/`ENTWURF_ANGLEICH_KONFLIKT` (aus `ApiError.details`). */
export interface KonfliktDetails {
  titel: { basis: string; meine: string; deren: string } | null;
  /** Der konfliktfrei zusammengeführte Titel, wenn nur der Inhalt in Konflikt steht. */
  titelGeloest?: string | null;
  teile: KonfliktTeil[];
  aktuell: { revision: number; id?: string; titel?: string; rumpf?: string; text?: string };
  seitherVon?: string[];
}

/** Titel und Inhalt (HTML) eines Arbeitsstands. */
export interface EntwurfsStand {
  titel: string;
  rumpf: string;
}

/** Was ein Speichervorgang schickt. `basisStand` nur, wenn die Eingabe auf einem gesendeten,
 * inzwischen zusammengeführten Stand beruht (s. Seite). */
export interface SpeicherEingabe extends EntwurfsStand {
  entwurfId: string;
  basisRevision: number;
  basisStand?: EntwurfsStand;
}

const pfad = (koId: string) => `/kos/${encodeURIComponent(koId)}/gemeinsam`;

export const gemeinsamApi = {
  lage: (koId: string) => api.get<GemeinsamLage>(pfad(koId)),
  oeffnen: (koId: string) => api.post<GemeinsamLage>(pfad(koId)),
  speichern: (koId: string, eingabe: SpeicherEingabe) =>
    api.put<GemeinsamGespeichert>(pfad(koId), eingabe),
  angleichen: (koId: string, entwurfId: string, revision: number, aufgeloest?: EntwurfsStand) =>
    api.post<GemeinsamLage>(`${pfad(koId)}/angleichen`, {
      entwurfId,
      revision,
      ...(aufgeloest ? { aufgeloest } : {}),
    }),
  abschluss: (
    koId: string,
    eingabe: { entwurfId: string; revision: number } & (
      | { fassung: number }
      | { vorschlagId: string }
    ),
  ) => api.post<GemeinsamLage>(`${pfad(koId)}/abschluss`, eingabe),
  /** Die Übernahme über den BESTEHENDEN Schreibweg: neue Fassung mit `expectedVersion`. */
  uebernehmen: (koId: string, u: Uebernahme) =>
    api.put<KnowledgeObject>(`/kos/${encodeURIComponent(koId)}`, {
      action: "revise",
      changes: u.aenderung,
      expectedVersion: u.basisVersion,
    }),
  /** Dasselbe als Änderungsvorschlag — der freigegebene Leserstand bleibt bis zur Freigabe. */
  einreichen: (koId: string, u: Uebernahme) =>
    api.put<KnowledgeObject>(`/kos/${encodeURIComponent(koId)}`, {
      action: "propose",
      proposal: {
        statement: u.aenderung.statement,
        bodyHtml: u.aenderung.bodyHtml,
        baseVersion: u.basisVersion,
        origin: "klarwerk_web",
      },
    }),
};

export type Uebernahme = NonNullable<GemeinsamLage["uebernahme"]>;

/** Der soeben eingereichte Vorschlag in der Antwort von `propose`. */
export function eingereichterVorschlag(ko: KnowledgeObject, u: Uebernahme): string | undefined {
  const passend = (ko.proposals ?? []).filter(
    (p) =>
      p.status === "offen" &&
      p.baseVersion === u.basisVersion &&
      p.statement === u.aenderung.statement,
  );
  return passend[passend.length - 1]?.id;
}
