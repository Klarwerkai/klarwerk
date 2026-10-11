import type { KnowledgeObject } from "../../knowledge-object";

// Audit-P4 (SCRUM-398): Live-Wall — „frisch gesichert / hat heute geholfen".
// Reine, DOM-freie Aggregation aus VORHANDENEN Daten (KO-Bestand + answer.helpful-Audit).
// Ehrlich: keine Scores, keine Ranglisten, keine erfundenen Zahlen — nur echte Ereignisse
// mit Zeitstempel (EK-19-Richtung, wie PMO-FEA-0002).
//
// PMO-FEA-0003 (aufnahme:20260922:gesamt-aktivitaetsanzeige): die Wand nennt eine Person NUR mit
// deren Zustimmung. Bis hierher trug jeder `saved`-Eintrag die Autorenkennung, ohne dass die
// Person je gefragt worden wäre — das Feld ist entfallen (die Oberfläche hat es nie angezeigt).
// Ein Name steht ausschließlich im Zweig `validated`, und nur, wenn `zugestimmt` ihn liefert.

export interface LiveWallSavedItem {
  koId: string;
  title: string;
  at: string;
  status: "offen" | "validiert";
}

export interface LiveWallHelpedItem {
  koId: string;
  title: string;
  at: string;
}

// Neues validiertes Wissen. `name` fehlt, solange die Autorin/der Autor nicht zugestimmt hat —
// „kein Name" ist der Normalzustand, nicht ein Fehler. Dasselbe gilt für `foto`: es steht nur da,
// wenn die Person selbst ein Foto für die Wand hinterlegt hat (livewall-fotos.ts).
export interface LiveWallValidatedItem {
  koId: string;
  title: string;
  at: string;
  name?: string;
  foto?: string;
}

export interface LiveWall {
  saved: LiveWallSavedItem[];
  helped: LiveWallHelpedItem[];
  // Anzahl „hat geholfen"-Ereignisse mit Datum von `today` (Kalendertag, ISO-Präfix).
  helpedToday: number;
  validated: LiveWallValidatedItem[];
}

const DEFAULT_LIMIT = 6;

// `today` wird hereingereicht (testbar, keine versteckte Uhr): ISO-Datum "YYYY-MM-DD".
// `zugestimmt`: Kontokennung → Anzeigename, AUSSCHLIESSLICH für Konten mit wirksamer Zustimmung.
// `fotos`: Kontokennung → Foto, AUSSCHLIESSLICH für Konten, die selbst eines hinterlegt haben.
export function buildLiveWall(input: {
  kos: KnowledgeObject[];
  helpful: Array<{ target: string; at: string; payload: Record<string, unknown> }>;
  today: string;
  limit?: number;
  zugestimmt?: ReadonlyMap<string, string>;
  fotos?: ReadonlyMap<string, string>;
}): LiveWall {
  const limit = input.limit && input.limit > 0 && input.limit <= 20 ? input.limit : DEFAULT_LIMIT;
  const neuesteZuerst = [...input.kos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const saved = neuesteZuerst.slice(0, limit).map((ko) => ({
    koId: ko.id,
    title: ko.title,
    at: ko.createdAt,
    status: ko.status,
  }));
  const zugestimmt = input.zugestimmt ?? new Map<string, string>();
  const fotos = input.fotos ?? new Map<string, string>();
  const validated = neuesteZuerst
    .filter((ko) => ko.status === "validiert")
    .slice(0, limit)
    .map((ko) => {
      const name = zugestimmt.get(ko.author);
      const foto = fotos.get(ko.author);
      return {
        koId: ko.id,
        title: ko.title,
        at: ko.createdAt,
        ...(name ? { name } : {}),
        ...(foto ? { foto } : {}),
      };
    });
  // Nur Einträge mit echtem Titel-Payload — nichts erfinden, nichts Halbes anzeigen.
  const helpedAll = input.helpful
    .filter((e) => typeof e.payload.koTitle === "string")
    .map((e) => ({ koId: e.target, title: e.payload.koTitle as string, at: e.at }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    saved,
    helped: helpedAll.slice(0, limit),
    helpedToday: helpedAll.filter((e) => e.at.startsWith(input.today)).length,
    validated,
  };
}

// Die Zustimmung zur Namensnennung lebt im Prüfprotokoll: je Konto zählt das JÜNGSTE Ereignis
// (`seq`, nicht Uhrzeit). Ein Widerruf ist damit sofort wirksam und bleibt zugleich belegt.
export const LIVEWALL_ZUSTIMMUNG = "livewall.name-consent-granted";
export const LIVEWALL_WIDERRUF = "livewall.name-consent-revoked";

export function zustimmendeKonten(
  ereignisse: ReadonlyArray<{ seq: number; actor: string; target: string; action: string }>,
): Set<string> {
  const juengstes = new Map<string, { seq: number; action: string }>();
  for (const e of ereignisse) {
    // Nur die eigene Erklärung zählt: wer für ein fremdes Konto zustimmt, stimmt für niemanden zu.
    if (e.actor !== e.target) {
      continue;
    }
    const bisher = juengstes.get(e.target);
    if (!bisher || e.seq > bisher.seq) {
      juengstes.set(e.target, { seq: e.seq, action: e.action });
    }
  }
  return new Set(
    [...juengstes].filter(([, e]) => e.action === LIVEWALL_ZUSTIMMUNG).map(([id]) => id),
  );
}
