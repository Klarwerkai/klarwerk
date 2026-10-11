// ================================================================================================
// ADMIN-10 · QUALITÄTSAUFGABEN UND RÜCKMELDUNGEN — EINE ANSICHT AUF BESTEHENDE VORGÄNGE.
// ================================================================================================
//
// produkt:20261009:admin-qualitaetsaufgaben. Ausgangslage (09.10.2026): Prüfungen, Konflikte,
// Duplikate, Lücken und Lebenszyklus stehen auf getrennten Flächen; niemand sieht gemeinsam
// Zuständigkeit, Alter und nächsten Schritt.
//
// WAS DIESE DATEI IST: eine LESEansicht. Jeder Eintrag verweist auf den bestehenden Vorgang
// (`ursprung` + `arbeitsweg`) — es wird nichts kopiert, kein zweiter Aufgabenspeicher entsteht.
// Die Quellen sind die vorhandenen Dienste:
//   pruefung      — Validierungs-Board (`ValidationService.board`, offene Zuweisungen inklusive)
//   revalidierung — Merker „Stimmt das noch?" (`LifecycleService.pendingRevalidation`) samt
//                   Anforderungsbelegen (`lifecycle.revalidation-requested`)
//   konflikt      — `ConflictService.unresolved`
//   duplikat      — `OverlapService.unresolved`
//   luecke        — `AskService.listGaps` (offen), Fragetext nach `redactGapForViewer`
//   rueckmeldung  — belegte Antwortmeldungen `answer.reported` (R-1089). Das ist die EINZIGE
//                   vorhandene Ereignisquelle für Rückmeldungen aus Antworten; eine neue Quelle
//                   entsteht hier nicht.
//
// EINMAL GEZÄHLT: der Schlüssel eines Eintrags ist `typ:ursprung`. Erreichen mehrere Quellzeilen
// denselben Vorgang (Board + Prüferzuweisungen, mehrere Prüfanforderungen an dasselbe Objekt, eine
// übernommene Rückmeldung an einer laufenden Revalidierung), entsteht EIN Eintrag; die Zeilen stehen
// nachvollziehbar in `einstiege`.
//
// RÜCKMELDUNG → AUFGABE: Übernehmen legt KEINEN neuen Aufgabentyp an, sondern die vorhandene
// Prüfanforderung (`LifecycleService.rueckmeldungUebernehmen`). Der Übernahmebeleg
// (`qualitaet.rueckmeldung-uebernommen`) ist je Meldung genau einmal schreibbar (`recordOnce`) —
// wiederholtes oder gleichzeitiges Übernehmen erzeugt kein Duplikat. Erledigt ist eine übernommene
// Rückmeldung erst mit einer Bestätigung `ko.revalidated` NACH der Übernahme; fehlt dieses Signal,
// heisst ihr Zustand „unklar", nie „erledigt".
//
// RECHTE: Routenrecht `users.manage` (Verwaltung). Zeilenrecht wie überall über `darfSehen` — die
// Route bildet `sichtbarkeitsfilterFuer(user)` und reicht ihn herein. Einträge, deren Objekt der
// Betrachter nicht sehen darf oder das sich nicht auflösen lässt, fehlen — in der Liste UND in jedem
// Zähler, weil die Oberfläche beide aus derselben Antwort bildet. Ein Paar (Konflikt, Duplikat)
// erscheint nur, wenn BEIDE Seiten sichtbar sind (dieselbe Regel wie `paarSichtbar`).
import {
  ANTWORT_MELDUNG_ACTION,
  type AskService,
  isAntwortMeldeGrund,
  redactGapForViewer,
} from "../../ask";
import type { AuditService } from "../../audit";
import type { ConflictService, OverlapService } from "../../conflicts";
import {
  type KnowledgeObject,
  type KoService,
  responsibleKindOf,
  responsibleOf,
} from "../../knowledge-object";
import { type LifecycleService, REVALIDIERUNG_ANGEFORDERT } from "../../lifecycle";
import type { ValidationService } from "../../validation";
import type { SessionUser } from "./http";
import type { Sichtbarkeitsfilter } from "./sichtbarkeit";
import type { SpacesRepo } from "./spaces";

/** Der Prüfprotokoll-Vorgang „Rückmeldung als Aufgabe übernommen" — je Meldung höchstens einer. */
export const RUECKMELDUNG_UEBERNOMMEN = "qualitaet.rueckmeldung-uebernommen";
/** Der Beleg einer Bestätigung „stimmt noch" (`LifecycleService.confirmStillValid`). */
const REVALIDIERT = "ko.revalidated";

export function uebernahmeEventId(meldungId: string): string {
  return `${RUECKMELDUNG_UEBERNOMMEN}:${meldungId}`;
}

export const VORGANG_TYPEN = [
  "pruefung",
  "revalidierung",
  "konflikt",
  "duplikat",
  "luecke",
  "rueckmeldung",
] as const;
export type VorgangTyp = (typeof VORGANG_TYPEN)[number];

/**
 * Der vereinheitlichte Zustand. `unklar` heisst: ein nötiges Signal fehlt — ausdrücklich NICHT
 * erledigt (Kriterium 6).
 */
export type VorgangZustand = "offen" | "in_arbeit" | "eskaliert" | "erledigt" | "unklar";

export interface Person {
  id: string;
  /** `null`, wenn die Kennung zu keinem Konto mehr gehört — die Oberfläche sagt das so. */
  name: string | null;
}

export interface Zustaendig extends Person {
  /** Woher die Zuständigkeit kommt — damit sie nicht geraten werden muss. */
  art: "pruefer" | "verantwortlich" | "autor-ersatz" | "zugewiesen";
}

export interface QualitaetsVorgang {
  /** `typ:ursprung` — der Schlüssel, über den mehrere Einstiege zu EINEM Eintrag werden. */
  schluessel: string;
  typ: VorgangTyp;
  zustand: VorgangZustand;
  /** Der bestehende Vorgang, auf den der Eintrag verweist. */
  ursprung: { art: "ko" | "konflikt" | "duplikat" | "luecke" | "meldung"; id: string };
  /** Der vorhandene Arbeitsweg zu genau diesem Vorgang. */
  arbeitsweg: string;
  /** Konfliktbeschreibung bzw. Fragetext; `null` = für diesen Betrachter zurückgehalten / keiner. */
  titel: string | null;
  /** Betroffene Inhalte (sichtbar geprüft). */
  inhalt: { koId: string; titel: string }[];
  /** Führende Spaces der betroffenen Inhalte; leer = ohne Space. */
  spaces: string[];
  /** Leer heisst: niemand ist zugeordnet — die Oberfläche sagt das ausdrücklich. */
  zustaendig: Zustaendig[];
  /** Kalendertag oder Zeitpunkt; `null` = keine Frist hinterlegt. */
  frist: string | null;
  ueberfaellig: boolean;
  /** Beginn des laufenden Vorgangs; `null` = nicht erfasst. */
  seit: string | null;
  /** Woher der Vorgang erreicht wird — alle auf diesen EINEN Eintrag gezählt. */
  einstiege: string[];
  /** Nur bei `rueckmeldung`: der Meldegrund. */
  grund?: "antwort-falsch" | "quelle-passt-nicht";
  /** Nur bei `revalidierung`: die übernommenen Rückmeldungen, die an diesem Vorgang hängen. */
  rueckmeldungen?: { meldungId: string; grund: string; at: string }[];
  /** Nur bei übernommener `rueckmeldung`: wann, durch wen, an welchem Vorgang. */
  uebernahme?: { am: string; durch: Person; vorgang: string };
  /** Nur bei erledigter `rueckmeldung`: das Ergebnis am Ursprung. */
  ergebnis?: { art: "bestaetigt"; am: string; fassung: number | null; durch: Person };
}

export type QuellenLage = Record<VorgangTyp, "ok" | "fehler">;

export interface QualitaetsUebersicht {
  stand: string;
  vorgaenge: QualitaetsVorgang[];
  /** Je Typ: hat die Quelle geliefert? Eine gescheiterte Quelle ist NICHT „nichts offen". */
  quellen: QuellenLage;
  /** Namen der Spaces, die in `vorgaenge` vorkommen. */
  spaces: { id: string; name: string }[];
}

export interface QualitaetsDeps {
  ko: Pick<KoService, "get">;
  validation: Pick<ValidationService, "board">;
  lifecycle: Pick<
    LifecycleService,
    "pendingRevalidation" | "revalidierungAnstehtFuer" | "rueckmeldungUebernehmen"
  >;
  conflicts: Pick<ConflictService, "unresolved">;
  overlaps: Pick<OverlapService, "unresolved">;
  ask: Pick<AskService, "listGaps">;
  audit: Pick<AuditService, "list" | "recordOnce">;
  konten: () => Promise<readonly { id: string; name?: string | null }[]>;
  spaces: Pick<SpacesRepo, "aktuelle">;
  jetzt?: () => Date;
}

interface Zeile {
  /**
   * Die Position in der Prüfprotokollkette. Die Reihenfolge „Bestätigung nach Übernahme" wird an
   * ihr entschieden, nicht an `at`: zwei Belege derselben Millisekunde wären über die Zeit nicht
   * zu ordnen (Nacharbeit 2).
   */
  seq: number;
  at: string;
  actor: string;
  target: string;
  payload: Record<string, unknown>;
}

function konfliktZustand(status: string): VorgangZustand {
  if (status === "eskaliert") {
    return "eskaliert";
  }
  return status === "zweitmeinung" ? "in_arbeit" : "offen";
}

async function versuche<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Die übernommene Lage einer Meldung — aus den Belegen, nicht aus einem eigenen Speicher. */
interface Uebernahme {
  meldungId: string;
  koId: string;
  am: string;
  durch: string;
  seq: number;
}

function uebernahmenAus(zeilen: readonly Zeile[]): Map<string, Uebernahme> {
  const out = new Map<string, Uebernahme>();
  for (const z of zeilen) {
    const meldungId = z.payload.meldungId;
    if (typeof meldungId === "string" && !out.has(meldungId)) {
      out.set(meldungId, { meldungId, koId: z.target, am: z.at, durch: z.actor, seq: z.seq });
    }
  }
  return out;
}

/** Die erste Bestätigung eines Objekts NACH einem Kettenglied — oder `undefined`. */
function ersteBestaetigungNach(
  bestaetigungen: readonly Zeile[],
  koId: string,
  nachSeq: number,
): Zeile | undefined {
  return bestaetigungen
    .filter((b) => b.target === koId && b.seq > nachSeq)
    .sort((a, b) => a.seq - b.seq)[0];
}

/** Das Kettenglied der letzten Bestätigung eines Objekts — oder `null`. */
function letzteBestaetigung(bestaetigungen: readonly Zeile[], koId: string): number | null {
  let letzte: number | null = null;
  for (const b of bestaetigungen) {
    if (b.target === koId && (letzte === null || b.seq > letzte)) {
      letzte = b.seq;
    }
  }
  return letzte;
}

/**
 * Die Übersicht für EINEN Betrachter. Jede Quelle scheitert für sich: ihr Typ steht dann in
 * `quellen` als „fehler", die übrigen Einträge bleiben.
 */
export async function ladeQualitaetsaufgaben(
  deps: QualitaetsDeps,
  user: SessionUser,
  darfSehen: Sichtbarkeitsfilter,
): Promise<QualitaetsUebersicht> {
  const jetzt = deps.jetzt?.() ?? new Date();
  const heute = jetzt.toISOString().slice(0, 10);

  const [board, pending, konflikte, duplikate, luecken, meldungen, uebernahmeZeilen] =
    await Promise.all([
      versuche(() => deps.validation.board()),
      versuche(() => deps.lifecycle.pendingRevalidation()),
      versuche(() => deps.conflicts.unresolved()),
      versuche(() => deps.overlaps.unresolved()),
      versuche(() => deps.ask.listGaps()),
      versuche(() => deps.audit.list({ action: ANTWORT_MELDUNG_ACTION })),
      versuche(() => deps.audit.list({ action: RUECKMELDUNG_UEBERNOMMEN })),
    ]);
  const [anforderungen, bestaetigungen, konten, spaces] = await Promise.all([
    versuche(() => deps.audit.list({ action: REVALIDIERUNG_ANGEFORDERT })),
    versuche(() => deps.audit.list({ action: REVALIDIERT })),
    versuche(() => deps.konten()),
    versuche(() => deps.spaces.aktuelle()),
  ]);

  const namen = new Map<string, string | null>(
    (konten ?? []).map((k): [string, string | null] => [k.id, k.name ?? null]),
  );
  const person = (id: string): Person => ({ id, name: namen.get(id) ?? null });

  // Objekte einmal je Anfrage auflösen; das Board liefert sie schon mit.
  const kos = new Map<string, KnowledgeObject | undefined>();
  for (const k of board ?? []) {
    kos.set(k.id, k);
  }
  const objekt = async (id: string): Promise<KnowledgeObject | undefined> => {
    if (!kos.has(id)) {
      kos.set(id, await deps.ko.get(id).catch(() => undefined));
    }
    return kos.get(id);
  };
  /** Das Objekt, wenn es existiert UND dieser Betrachter es sehen darf. */
  const sichtbar = async (id: string): Promise<KnowledgeObject | undefined> => {
    const ko = await objekt(id);
    return ko && darfSehen(ko) ? ko : undefined;
  };
  const inhaltVon = (ko: KnowledgeObject) => ({ koId: ko.id, titel: ko.title });
  const spaceVon = (ko: KnowledgeObject): string[] =>
    typeof ko.spaceId === "string" ? [ko.spaceId] : [];
  const verantwortung = (ko: KnowledgeObject): Zustaendig => ({
    ...person(responsibleOf(ko)),
    art: responsibleKindOf(ko) === "owner" ? "verantwortlich" : "autor-ersatz",
  });

  const eintraege = new Map<string, QualitaetsVorgang>();
  const fuegeHinzu = (v: QualitaetsVorgang): void => {
    const da = eintraege.get(v.schluessel);
    if (!da) {
      eintraege.set(v.schluessel, { ...v, einstiege: [...new Set(v.einstiege)] });
      return;
    }
    // Derselbe Vorgang aus einem weiteren Einstieg: einmal gezählt, der Einstieg bleibt sichtbar.
    da.einstiege = [...new Set([...da.einstiege, ...v.einstiege])];
  };

  // ── Prüfung ──────────────────────────────────────────────────────────────────────────────────
  for (const k of board ?? []) {
    if (!darfSehen(k)) {
      continue;
    }
    const pruefer = [...new Set(k.assignments ?? [])];
    fuegeHinzu({
      schluessel: `pruefung:${k.id}`,
      typ: "pruefung",
      zustand: pruefer.length > 0 ? "in_arbeit" : "offen",
      ursprung: { art: "ko", id: k.id },
      arbeitsweg: `/wissen/${encodeURIComponent(k.id)}`,
      titel: null,
      inhalt: [inhaltVon(k)],
      spaces: spaceVon(k),
      zustaendig: pruefer.map((id) => ({ ...person(id), art: "pruefer" as const })),
      frist: null,
      ueberfaellig: false,
      // Seit wann die AKTUELLE Fassung in Prüfung steht: der Verlaufseintrag dieser Fassung.
      seit: k.history?.find((h) => h.version === k.version)?.at ?? null,
      einstiege: ["pruefboard", ...pruefer.map((id) => `zuweisung:${id}`)],
    });
  }

  // ── Rückmeldungen: Übernahmen vorab, weil sie an Revalidierungen hängen können ─────────────
  const uebernahmen = uebernahmenAus(uebernahmeZeilen ?? []);
  const pendingSet = new Set(pending ?? []);
  /** Übernommene Meldungen je Objekt, deren Revalidierung noch läuft (keine Bestätigung danach). */
  const offenUebernommen = new Map<string, Uebernahme[]>();
  for (const u of uebernahmen.values()) {
    const bestaetigt = ersteBestaetigungNach(bestaetigungen ?? [], u.koId, u.seq);
    if (!bestaetigt && pendingSet.has(u.koId)) {
      offenUebernommen.set(u.koId, [...(offenUebernommen.get(u.koId) ?? []), u]);
    }
  }
  const meldungsZeile = new Map<string, Zeile>();
  for (const m of meldungen ?? []) {
    const id = m.payload.meldungId;
    if (typeof id === "string" && !meldungsZeile.has(id)) {
      meldungsZeile.set(id, m);
    }
  }

  // ── Revalidierung ───────────────────────────────────────────────────────────────────────────
  for (const koId of new Set(pending ?? [])) {
    const k = await sichtbar(koId);
    if (!k) {
      continue;
    }
    // Der laufende Vorgang beginnt mit der ersten Anforderung nach der letzten Bestätigung.
    const seitBestaetigung = letzteBestaetigung(bestaetigungen ?? [], koId);
    const nachBestaetigung = (a: Zeile): boolean =>
      a.target === koId && (seitBestaetigung === null || a.seq > seitBestaetigung);
    const laufend = (anforderungen ?? []).filter(nachBestaetigung).sort((a, b) => a.seq - b.seq);
    const angehaengt = offenUebernommen.get(koId) ?? [];
    const frist = typeof k.revalidierungAm === "string" ? k.revalidierungAm : null;
    fuegeHinzu({
      schluessel: `revalidierung:${koId}`,
      typ: "revalidierung",
      zustand: "offen",
      ursprung: { art: "ko", id: koId },
      arbeitsweg: `/lebenszyklus?fall=${encodeURIComponent(koId)}`,
      titel: null,
      inhalt: [inhaltVon(k)],
      spaces: spaceVon(k),
      zustaendig: [verantwortung(k)],
      frist,
      ueberfaellig: frist !== null && frist < heute,
      seit: laufend[0]?.at ?? null,
      einstiege: [
        "lebenszyklus",
        ...laufend.map((a) =>
          typeof a.payload.grund === "string" ? `anforderung:${a.payload.grund}` : "anforderung",
        ),
        ...angehaengt.map((u) => `rueckmeldung:${u.meldungId}`),
      ],
      rueckmeldungen: angehaengt.map((u) => {
        const m = meldungsZeile.get(u.meldungId);
        return {
          meldungId: u.meldungId,
          grund: typeof m?.payload.grund === "string" ? m.payload.grund : "",
          at: m?.at ?? u.am,
        };
      }),
    });
  }

  // ── Konflikte und Duplikate: ein Paar, zwei Inhalte, EIN Vorgang ────────────────────────────
  for (const c of konflikte ?? []) {
    const a = await sichtbar(c.koA);
    const b = await sichtbar(c.koB);
    if (!a || !b) {
      continue;
    }
    const paar = a.id === b.id ? [a] : [a, b];
    fuegeHinzu({
      schluessel: `konflikt:${c.id}`,
      typ: "konflikt",
      zustand: konfliktZustand(c.status),
      ursprung: { art: "konflikt", id: c.id },
      arbeitsweg: `/konflikte?fall=${encodeURIComponent(c.id)}`,
      titel: c.description,
      inhalt: paar.map(inhaltVon),
      spaces: [...new Set(paar.flatMap(spaceVon))],
      // Konflikte tragen im Bestand keine Zuständigkeit — die Lücke wird gezeigt, nicht erfunden.
      zustaendig: [],
      frist: null,
      ueberfaellig: false,
      seit: c.createdAt,
      einstiege: ["konflikte"],
    });
  }
  for (const d of duplikate ?? []) {
    const a = await sichtbar(d.koA);
    const b = await sichtbar(d.koB);
    if (!a || !b) {
      continue;
    }
    const paar = a.id === b.id ? [a] : [a, b];
    fuegeHinzu({
      schluessel: `duplikat:${d.id}`,
      typ: "duplikat",
      zustand: d.status === "in_bearbeitung" ? "in_arbeit" : "offen",
      ursprung: { art: "duplikat", id: d.id },
      arbeitsweg: `/duplikate/${encodeURIComponent(d.id)}/vergleich`,
      titel: null,
      inhalt: paar.map(inhaltVon),
      spaces: [...new Set(paar.flatMap(spaceVon))],
      zustaendig: [],
      frist: null,
      ueberfaellig: false,
      seit: d.createdAt,
      einstiege: ["duplikate"],
    });
  }

  // ── Wissenslücken: Fragetext nur nach dem vorhandenen Sichtbarkeitsvertrag ───────────────────
  // produkt:20261010:antwort-beanstandung-korrektur: eine Beanstandung IST eine Lücke. Ihre
  // Meldungen (`answer.reported`) werden hier EINMAL gezählt — als Einstiege des Lückenvorgangs, nicht
  // ein zweites Mal als Rückmeldung; auch nach dem Abschluss erscheinen sie nicht wieder als offen.
  const beanstandet = new Set<string>();
  for (const g of luecken ?? []) {
    for (const m of g.beanstandung?.meldungen ?? []) {
      beanstandet.add(m.meldungId);
    }
  }
  for (const g of luecken ?? []) {
    if (g.status !== "offen") {
      continue;
    }
    const sicht = redactGapForViewer(g, { viewerId: user.id });
    const quelle = g.beanstandung?.koId ? await sichtbar(g.beanstandung.koId) : undefined;
    if (g.beanstandung?.koId && !quelle) {
      // Dieselbe Zeilenregel wie überall hier: ein Objekt, das der Betrachter nicht sieht, fehlt.
      continue;
    }
    fuegeHinzu({
      schluessel: `luecke:${g.id}`,
      typ: "luecke",
      zustand: g.assignee ? "in_arbeit" : "offen",
      ursprung: { art: "luecke", id: g.id },
      arbeitsweg: `/risiko?fall=${encodeURIComponent(g.id)}`,
      titel: sicht.redacted ? null : sicht.question,
      inhalt: quelle ? [inhaltVon(quelle)] : [],
      spaces: quelle ? spaceVon(quelle) : [],
      zustaendig: g.assignee ? [{ ...person(g.assignee), art: "zugewiesen" }] : [],
      frist: null,
      ueberfaellig: false,
      seit: g.createdAt,
      einstiege: [
        "risiko",
        ...(g.beanstandung?.meldungen ?? []).map((m) => `rueckmeldung:${m.meldungId}`),
      ],
    });
  }

  // ── Rückmeldungen ───────────────────────────────────────────────────────────────────────────
  for (const [meldungId, m] of meldungsZeile) {
    const grund = m.payload.grund;
    const responsible = m.payload.responsible;
    if (!isAntwortMeldeGrund(grund) || typeof responsible !== "string") {
      continue;
    }
    if (beanstandet.has(meldungId)) {
      continue;
    }
    const k = await sichtbar(m.target);
    if (!k) {
      continue;
    }
    const u = uebernahmen.get(meldungId);
    if (u && (offenUebernommen.get(u.koId) ?? []).some((x) => x.meldungId === meldungId)) {
      // Hängt an der laufenden Revalidierung — dort EINMAL gezählt, nicht ein zweites Mal hier.
      continue;
    }
    const bestaetigt = u ? ersteBestaetigungNach(bestaetigungen ?? [], u.koId, u.seq) : undefined;
    const fassung = bestaetigt?.payload.version;
    fuegeHinzu({
      schluessel: `rueckmeldung:${meldungId}`,
      typ: "rueckmeldung",
      zustand: !u ? "offen" : bestaetigt ? "erledigt" : "unklar",
      ursprung: { art: "meldung", id: meldungId },
      arbeitsweg: `/wissen/${encodeURIComponent(k.id)}`,
      titel: null,
      inhalt: [inhaltVon(k)],
      spaces: spaceVon(k),
      zustaendig: [
        {
          ...person(responsible),
          art: m.payload.responsibleKind === "owner" ? "verantwortlich" : "autor-ersatz",
        },
      ],
      frist: null,
      ueberfaellig: false,
      seit: m.at,
      einstiege: ["glocke"],
      grund,
      ...(u
        ? {
            uebernahme: {
              am: u.am,
              durch: person(u.durch),
              vorgang: `revalidierung:${u.koId}`,
            },
          }
        : {}),
      ...(bestaetigt
        ? {
            ergebnis: {
              art: "bestaetigt" as const,
              am: bestaetigt.at,
              fassung: typeof fassung === "number" ? fassung : null,
              durch: person(bestaetigt.actor),
            },
          }
        : {}),
    });
  }

  const vorgaenge = [...eintraege.values()];
  const genutzt = new Set(vorgaenge.flatMap((v) => v.spaces));
  return {
    stand: jetzt.toISOString(),
    vorgaenge,
    quellen: {
      pruefung: board ? "ok" : "fehler",
      revalidierung: pending ? "ok" : "fehler",
      konflikt: konflikte ? "ok" : "fehler",
      duplikat: duplikate ? "ok" : "fehler",
      luecke: luecken ? "ok" : "fehler",
      // Ohne Übernahme- oder Bestätigungsbelege wäre jeder Rückmeldungszustand geraten.
      rueckmeldung: meldungen && uebernahmeZeilen && bestaetigungen ? "ok" : "fehler",
    },
    spaces: (spaces ?? [])
      .filter((s) => genutzt.has(s.id))
      .map((s) => ({ id: s.id, name: s.name })),
  };
}

export type UebernahmeErgebnis =
  | {
      art: "angelegt" | "angehaengt" | "bereits" | "nachgeholt";
      vorgang: string;
      am: string;
      durch: Person;
    }
  | { art: "nicht_gefunden" };

/**
 * Eine belegte Rückmeldung als Aufgabe übernehmen. Idempotent: der Übernahmebeleg ist je Meldung
 * genau einmal schreibbar; die Prüfanforderung entsteht nur, wenn nach dem Beleg weder eine
 * Revalidierung läuft noch eine Bestätigung vorliegt.
 *   angelegt   — es lief keine Revalidierung; sie wird jetzt angefordert,
 *   angehaengt — es lief bereits eine; die Meldung hängt sich an DIESEN Vorgang,
 *   bereits    — jemand hat sie schon übernommen (frischer Stand: wer und wann),
 *   nachgeholt — sie war übernommen, aber die Anforderung fehlte; sie ist jetzt nachgeholt.
 * Unbekannte Meldung oder nicht sichtbares Objekt: `nicht_gefunden` (keine Existenzauskunft).
 */
export async function uebernimmRueckmeldung(
  deps: QualitaetsDeps,
  user: SessionUser,
  darfSehen: Sichtbarkeitsfilter,
  meldungId: string,
): Promise<UebernahmeErgebnis> {
  const meldung = (await deps.audit.list({ action: ANTWORT_MELDUNG_ACTION })).find(
    (e) => e.payload.meldungId === meldungId,
  );
  if (!meldung) {
    return { art: "nicht_gefunden" };
  }
  const ko = await deps.ko.get(meldung.target);
  if (!ko || !darfSehen(ko)) {
    return { art: "nicht_gefunden" };
  }
  const koId = ko.id;
  const vorgang = `revalidierung:${koId}`;
  const konten = await versuche(() => deps.konten());
  const person = (id: string): Person => ({
    id,
    name: (konten ?? []).find((k) => k.id === id)?.name ?? null,
  });
  const beleg = async () =>
    uebernahmenAus(await deps.audit.list({ action: RUECKMELDUNG_UEBERNOMMEN, target: koId })).get(
      meldungId,
    );
  // Ben (Nacharbeit 2): Beleg, Lagelesung und Anforderung laufen unter der Objektsperre des
  // Lebenszyklus, unter der auch die Bestätigung läuft — die Entscheidung „angehängt" oder „neu"
  // beruht damit auf der Lage NACH dem Beleg, nicht auf einer Lesung davor. Und ein Aufruf, der den
  // Beleg nicht mehr gewinnt, holt eine ausgefallene Anforderung nach, statt nur „bereits" zu sagen.
  const { neu, lage } = await deps.lifecycle.rueckmeldungUebernehmen(koId, user.id, meldungId, {
    belegen: () =>
      deps.audit.recordOnce(uebernahmeEventId(meldungId), {
        actor: user.id,
        action: RUECKMELDUNG_UEBERNOMMEN,
        target: koId,
        payload: { meldungId, vorgang },
      }),
    erledigtSeitBeleg: async () => {
      const u = await beleg();
      if (!u) {
        return false;
      }
      const bestaetigungen = await deps.audit.list({ action: REVALIDIERT, target: koId });
      return ersteBestaetigungNach(bestaetigungen, koId, u.seq) !== undefined;
    },
  });
  const gespeichert = await beleg();
  const am = gespeichert?.am ?? (deps.jetzt?.() ?? new Date()).toISOString();
  if (neu) {
    // `erledigt` direkt nach dem eigenen Beleg ist nur bei gleichem Zeitstempel denkbar; die
    // Bestätigung kam dann unter der Sperre NACH dem Beleg und hat genau diesen Vorgang geschlossen.
    const art = lage === "angelegt" ? "angelegt" : "angehaengt";
    return { art, vorgang, am, durch: person(user.id) };
  }
  // Jemand hat schon übernommen. Fehlte die Anforderung (Ausfall nach dem Beleg), ist sie jetzt
  // nachgeholt — und das wird so gesagt.
  return {
    art: lage === "angelegt" ? "nachgeholt" : "bereits",
    vorgang,
    am: gespeichert?.am ?? "",
    durch: person(gespeichert?.durch ?? ""),
  };
}
