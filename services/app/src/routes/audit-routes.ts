import type { FastifyPluginAsync } from "fastify";
import {
  type AuditEntry,
  type AuditFilter,
  type AuditSeitenAnfrage,
  type AuditService,
  type ChainInspection,
  auditSeiteTrifft,
  auditSeitengroesse,
  hashEntryFuerVersion,
  namensbelegeAus,
} from "../../../audit";
import {
  type AuditObjektSicht,
  type AuditObjektZugang,
  type AuditSicht,
  auditSichtFuer,
} from "../audit-sicht";
import type { Guards, SessionUser } from "../http";
import { LESEVARIANTEN_LADE_AKTION, LESEVARIANTEN_LADE_PROTOKOLLFELDER } from "../lesevarianten";
import { type SichtbarkeitsFakten, darfSehen, freigaberang } from "../sichtbarkeit";

/** Wer die Befunde (Konflikte, Überschneidungen) eines Objekts kennt — nur deren Kennungen. */
export interface BefundKennungen {
  idsForKo(koId: string): Promise<string[]>;
}

/**
 * Was das Protokoll braucht, um je Leser zu entscheiden (aufnahme:20260922:gesamt-leserechte):
 * die Sichtbarkeitsfakten des Bestands samt Papierkorb, die Kennungen aller Spaces und je Befund
 * (Konflikt, Überschneidung) seine Objekte. Nur Kennungen und Fakten, kein Inhalt.
 */
export interface AuditLeseQuelle {
  sichtbarkeitsfaktenAller(): Promise<readonly ({ id: string } & SichtbarkeitsFakten)[]>;
  spaceKennungen(): Promise<readonly string[]>;
  befundZuordnungen(): Promise<readonly { id: string; koIds: readonly string[] }[]>;
  /**
   * Nacharbeit 20 (Integration main): Kennungen weiterer bekannter Bezugsziele, deren Einträge
   * Zahlen über GENAU dieses Ziel tragen (Teams aus produkt:20261009:admin-teams: `version`,
   * `vorherVersion`) — keine Bestandsbilanz. Fehlt die Angabe, bleibt die Regel unverändert eng.
   */
  weitereZiele?(): Promise<readonly string[]>;
}

// ================================================================================================
// aufnahme:20260922:gesamt-leserechte (Ben, Nacharbeit 13–15) — DAS PROTOKOLL NACH LESERECHT.
// ================================================================================================
//
// WER IST EINGESCHRÄNKT. Seit Variante B (Nacharbeit 19) öffnet `ko.validate` nicht mehr jede
// Stufe: was `darfSehen` vorenthält, liegt an Spaces UND am persönlichen Freigabeniveau.
// Eingeschränkt ist deshalb, wer mindestens einen bekannten Space nicht lesen darf (Space-Bestand
// und jeder Space, den die Kette je genannt hat) ODER keinen Freigaberang 2 („streng vertraulich",
// `freigaberang`) hat. Das hängt nur an Spaces, Mitgliedschaft und dem eigenen Niveau — nicht
// daran, ob es gerade verborgene Vorgänge gibt. Ein uneingeschränkter Leser bekommt das Protokoll
// unverändert: Liste, Prüfbericht und die nachrechenbare Kette (R-0613).
//
// WAS EIN EINGESCHRÄNKTER LESER BEKOMMT — eine Leseransicht, die nichts von verborgenen Vorgängen
// abhängen lässt:
//   · Kein Eintrag, der ein verborgenes Objekt oder einen verborgenen Befund nennt (Ziel, `eventId`,
//     Nutzlast, auch eingebettet), keine historische Ladebilanz.
//   · Verborgen ist ein Objekt, das er nicht sehen darf — für den Bestand samt Papierkorb nach den
//     aktuellen Fakten, für ENDGÜLTIG GELÖSCHTE Objekte nach der Kette selbst: der Space eines
//     Objekts ändert sich nur über `ko.space-changed` (`KoService.setzeSpace`), der letzte solche
//     Eintrag nennt ihn also auch nach der Löschung. Die Stufe gilt dabei als unbekannt und streng.
//   · Ein Befund ist verborgen, wenn eines seiner Objekte verborgen ist; seine Objekte kommen aus dem
//     Befundbestand oder aus `koIds` der Kette. Ist ein Befund NICHT zuzuordnen, gilt er als
//     verborgen (fail-closed) — ebenso ein Objekt, das ein Befund nennt, das aber nirgends bekannt ist.
//   · Statt der Kettennummer trägt jeder Eintrag seine laufende Nummer IN DER ANSICHT (keine
//     Lücken); `hash`, `prevHash`, `hashVersion` fehlen. Exportbelege (`audit.exported`,
//     `audit.view-exported`) erscheinen ohne ihre Zählwerte und Kettenköpfe.
//   · Der Prüfbericht prüft die Einträge der Ansicht je für sich (eigener Hash) und nennt nur ihre
//     Zahl; die Verkettung ist in einer Ansicht nicht prüfbar und wird nicht behauptet.
//   · Der Export ist `klarwerk-audit-ansicht`, ausdrücklich keine Kette.
//   · BESTANDSBILANZEN (Nacharbeit 16, Ben): ein Eintrag, dessen Ziel KEIN bekanntes Objekt, kein
//     Befund, kein Space und (seit Nacharbeit 20) kein Team ist und dessen Nutzlast Zahlen trägt,
//     fasst einen Bestand zusammen
//     (`import.cleanup` → „library" mit `trashedKos`/`claimedKos`, …). Seine Zahlen können
//     verborgene Objekte mitzählen, ohne sie zu nennen; nachweisbar auf den Leser begrenzen lassen
//     sie sich nicht. Er geht an einen eingeschränkten Leser nicht hinaus — auch historisch.
//     Ausgenommen sind nur die Exportbelege, deren Zahlen ohnehin entfernt werden (s. o.).
// Ohne Lesequelle ist nichts entscheidbar: dann gilt jeder Leser als eingeschränkt und jeder
// Eintrag als verborgen.

interface Leselage {
  eingeschraenkt: boolean;
  /** Kennungen verborgener Objekte und Befunde. */
  verborgen: ReadonlySet<string>;
  /** Kennungen aller bekannten Bezugsziele: Objekte (auch gelöschte), Befunde, Spaces. */
  ziele: ReadonlySet<string>;
  /** Ohne Lesequelle: alles verborgen. */
  alles: boolean;
}

const UNEINGESCHRAENKT: Leselage = {
  eingeschraenkt: false,
  verborgen: new Set(),
  ziele: new Set(),
  alles: false,
};

const EXPORTBELEGE = new Set(["audit.exported", "audit.view-exported"]);

function istBefundAktion(action: string): boolean {
  return action.startsWith("conflict.") || action.startsWith("overlap.");
}

function texte(wert: unknown): string[] {
  return Array.isArray(wert) ? wert.filter((w): w is string => typeof w === "string") : [];
}

async function leselage(
  user: SessionUser,
  quelle: AuditLeseQuelle | undefined,
  kette: readonly AuditEntry[],
): Promise<Leselage> {
  if (!quelle) {
    return { eingeschraenkt: true, verborgen: new Set(), ziele: new Set(), alles: true };
  }
  // Die Geschichte jedes Objekts aus der Kette: letzter Space, Autor, letzte Stufe.
  const ausKette = new Map<string, { spaceId?: string | null; author?: string; stufe?: string }>();
  const spaces = new Set<string>(await quelle.spaceKennungen());
  const befundKos = new Map<string, Set<string>>();
  for (const e of kette) {
    if (e.action.startsWith("ko.")) {
      const g = ausKette.get(e.target) ?? {};
      if (e.action === "ko.created" && !g.author) {
        g.author = e.actor;
      }
      if (e.action === "ko.space-changed") {
        const nachher = e.payload.nachher;
        g.spaceId = typeof nachher === "string" ? nachher : null;
        for (const s of [e.payload.vorher, nachher]) {
          if (typeof s === "string") {
            spaces.add(s);
          }
        }
      }
      if (e.action === "ko.confidentiality" && typeof e.payload.level === "string") {
        g.stufe = e.payload.level;
      }
      ausKette.set(e.target, g);
    }
    if (istBefundAktion(e.action)) {
      const kos = befundKos.get(e.target) ?? new Set<string>();
      for (const id of texte(e.payload.koIds)) {
        kos.add(id);
      }
      befundKos.set(e.target, kos);
    }
  }
  const lesbar = user.spaceLesbar;
  const eingeschraenkt = freigaberang(user) < 2 || [...spaces].some((s) => lesbar?.has(s) !== true);
  if (!eingeschraenkt) {
    return UNEINGESCHRAENKT;
  }
  const verborgen = new Set<string>();
  const aktuell = new Map((await quelle.sichtbarkeitsfaktenAller()).map((f) => [f.id, f]));
  for (const [id, fakten] of aktuell) {
    if (!darfSehen(user, fakten)) {
      verborgen.add(id);
    }
  }
  for (const [id, g] of ausKette) {
    if (aktuell.has(id)) {
      continue;
    }
    // Endgültig gelöscht: die Kette weiß, wo es zuletzt lag. Die Stufe gilt als streng, wo sie
    // nicht belegt ist — für Leser mit `ko.validate` ändert das nichts, für alle anderen schließt es.
    const fakten: SichtbarkeitsFakten = {
      ...(g.spaceId ? { spaceId: g.spaceId } : {}),
      confidentiality: (g.stufe ?? "streng_vertraulich") as SichtbarkeitsFakten["confidentiality"],
      author: g.author ?? null,
    };
    if (!darfSehen(user, fakten)) {
      verborgen.add(id);
    }
  }
  const bekannt = (koId: string): boolean => aktuell.has(koId) || ausKette.has(koId);
  for (const { id, koIds } of await quelle.befundZuordnungen()) {
    const kos = befundKos.get(id) ?? new Set<string>();
    for (const k of koIds) {
      kos.add(k);
    }
    befundKos.set(id, kos);
  }
  for (const [befund, kos] of befundKos) {
    const zuzuordnen = kos.size > 0 && [...kos].every(bekannt);
    if (!zuzuordnen || [...kos].some((k) => verborgen.has(k))) {
      verborgen.add(befund);
    }
  }
  const ziele = new Set<string>([
    ...aktuell.keys(),
    ...ausKette.keys(),
    ...befundKos.keys(),
    ...spaces,
    ...((await quelle.weitereZiele?.()) ?? []),
  ]);
  return { eingeschraenkt: true, verborgen, ziele, alles: false };
}

function traegtZahl(wert: unknown): boolean {
  if (typeof wert === "number") {
    return true;
  }
  if (Array.isArray(wert)) {
    return wert.some(traegtZahl);
  }
  if (wert !== null && typeof wert === "object") {
    return Object.values(wert as Record<string, unknown>).some(traegtZahl);
  }
  return false;
}

/** Eine Zahlenbilanz über einen Bestand statt über ein bekanntes Bezugsziel (s. Kopf). */
function zahlenIn(wert: unknown, zahlen: number[]): number[] {
  if (typeof wert === "number") {
    zahlen.push(wert);
  } else if (Array.isArray(wert)) {
    for (const w of wert) {
      zahlenIn(w, zahlen);
    }
  } else if (wert !== null && typeof wert === "object") {
    for (const w of Object.values(wert as Record<string, unknown>)) {
      zahlenIn(w, zahlen);
    }
  }
  return zahlen;
}

/**
 * Nacharbeit 22: jede Zahl der Nutzlast ist die Länge ihrer EIGENEN Kennungsliste `koIds` (etwa
 * `library.export`: `count` = `koIds.length`). Solche Zahlen zählen nur Aufgezähltes — und jede
 * aufgezählte Kennung prüft `lesbar` einzeln (`nenntEine`). Sie sind keine Bestandsbilanz.
 */
function zaehltNurAufgezaehltes(payload: Record<string, unknown>): boolean {
  const ids = payload.koIds;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return false;
  }
  return zahlenIn(payload, []).every((z) => z === ids.length);
}

function istBestandsbilanz(e: AuditEntry, lage: Leselage): boolean {
  return (
    !EXPORTBELEGE.has(e.action) &&
    !lage.ziele.has(e.target) &&
    traegtZahl(e.payload) &&
    !zaehltNurAufgezaehltes(e.payload)
  );
}

// Eine Kennung kann auch EINGEBETTET stehen — `eventId` „ko.created:<id>", ein Pfad „/kos/<id>".
const KENNUNG_IM_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function nenntEine(wert: unknown, kennungen: ReadonlySet<string>): boolean {
  if (typeof wert === "string") {
    return (
      kennungen.has(wert) || (wert.match(KENNUNG_IM_TEXT) ?? []).some((id) => kennungen.has(id))
    );
  }
  if (Array.isArray(wert)) {
    return wert.some((w) => nenntEine(w, kennungen));
  }
  if (wert !== null && typeof wert === "object") {
    return Object.values(wert as Record<string, unknown>).some((w) => nenntEine(w, kennungen));
  }
  return false;
}

function istAlteLadebilanz(e: AuditEntry): boolean {
  return (
    e.action === LESEVARIANTEN_LADE_AKTION &&
    !Object.keys(e.payload).every((k) => LESEVARIANTEN_LADE_PROTOKOLLFELDER.includes(k))
  );
}

function lesbar(e: AuditEntry, lage: Leselage): boolean {
  if (lage.alles) {
    return false;
  }
  if (!lage.eingeschraenkt) {
    return true;
  }
  if (istAlteLadebilanz(e) || istBestandsbilanz(e, lage)) {
    return false;
  }
  return ![e.target, e.eventId, e.payload].some((teil) => nenntEine(teil, lage.verborgen));
}

/** Ein Eintrag der Leseransicht: laufende Nummer statt Kettennummer, ohne Kettenfelder. */
type Ansichtseintrag = Omit<AuditEntry, "hash" | "prevHash" | "hashVersion">;

function alsAnsicht(
  { hash: _h, prevHash: _p, hashVersion: _v, ...rest }: AuditEntry,
  seq: number,
): Ansichtseintrag {
  return { ...rest, seq, ...(EXPORTBELEGE.has(rest.action) ? { payload: {} } : {}) };
}

/** Je lesbarer Eintrag das Original (für Filter- und Namensregeln) und sein Ansichtseintrag. */
function lesepaare(
  kette: readonly AuditEntry[],
  lage: Leselage,
): { original: AuditEntry; ansicht: Ansichtseintrag }[] {
  return kette
    .filter((e) => lesbar(e, lage))
    .map((original, i) => ({ original, ansicht: alsAnsicht(original, i + 1) }));
}

function leseansicht(kette: readonly AuditEntry[], lage: Leselage): Ansichtseintrag[] {
  return lesepaare(kette, lage).map((p) => p.ansicht);
}

function filterTrifft(e: { actor: string; action: string; target: string }, f: AuditFilter) {
  return (
    (!f.actor || e.actor === f.actor) &&
    (!f.action || e.action === f.action) &&
    (!f.target || e.target === f.target)
  );
}

/** Prüfbericht der Ansicht: jeder Eintrag gegen seinen eigenen Hash; keine Verkettung behauptet. */
function ansichtsbericht(kette: readonly AuditEntry[], lage: Leselage) {
  const sichtbar = kette.filter((e) => lesbar(e, lage));
  const abweichend = sichtbar.filter((e) => {
    const { hash, ...material } = e;
    return hashEntryFuerVersion(material) !== hash;
  }).length;
  const bericht: ChainInspection & { ansicht: "leserecht"; kette: false } = {
    ok: abweichend === 0,
    count: sichtbar.length,
    linkageBreaks: 0,
    payloadDeviations: abweichend,
    serialisationDeviations: 0,
    unresolvedDeviations: 0,
    uncheckedDeviations: 0,
    ansicht: "leserecht",
    kette: false,
  };
  return bericht;
}

/** Die Abfrage des Seitenwegs, wie sie über die Adresse ankommt — alles Zeichenketten. */
interface SeitenQuery {
  actor?: string;
  action?: string;
  actions?: string;
  target?: string;
  from?: string;
  to?: string;
  before?: string;
  limit?: string;
}

/** Ein Zeitpunkt aus der Adresse als ISO-Zeichenkette in UTC — `null` heißt „unlesbar". */
function isoZeitpunkt(wert: string): string | null {
  const ms = Date.parse(wert);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Eine positive ganze Zahl aus der Adresse — `null` heißt „unlesbar". */
function ganzzahl(wert: string): number | null {
  return /^\d{1,9}$/.test(wert) && Number(wert) > 0 ? Number(wert) : null;
}

/**
 * Die Abfrage des Seitenwegs, geprüft. Ein unlesbarer Wert wird NICHT still verworfen — sonst
 * zeigte die Fläche eine ungefilterte Liste unter einem gesetzten Filter. Er ist ein 400.
 */
function leseSeitenAnfrage(q: SeitenQuery): AuditSeitenAnfrage | string {
  const anfrage: AuditSeitenAnfrage = {};
  const text = (wert: string | undefined): string | undefined =>
    typeof wert === "string" && wert.trim() !== "" ? wert.trim() : undefined;
  const actor = text(q.actor);
  const action = text(q.action);
  const target = text(q.target);
  if (actor) {
    anfrage.actor = actor;
  }
  if (action) {
    anfrage.action = action;
  }
  if (target) {
    anfrage.target = target;
  }
  const actions = text(q.actions)
    ?.split(",")
    .map((a) => a.trim())
    .filter((a) => a !== "");
  if (actions && actions.length > 0) {
    anfrage.actions = actions;
  }
  for (const feld of ["from", "to"] as const) {
    const roh = text(q[feld]);
    if (roh !== undefined) {
      const iso = isoZeitpunkt(roh);
      if (iso === null) {
        return `Zeitpunkt „${feld}" ist nicht lesbar.`;
      }
      anfrage[feld] = iso;
    }
  }
  if (anfrage.from && anfrage.to && anfrage.from >= anfrage.to) {
    return "Der Zeitraum endet nicht nach seinem Beginn.";
  }
  for (const feld of ["before", "limit"] as const) {
    const roh = text(q[feld]);
    if (roh !== undefined) {
      const zahl = ganzzahl(roh);
      if (zahl === null) {
        return `„${feld}" ist keine positive ganze Zahl.`;
      }
      anfrage[feld] = zahl;
    }
  }
  return anfrage;
}

type Namensbeleg = Pick<AuditEntry, "seq" | "actor" | "action" | "target" | "payload">;

/**
 * Die Namensbelege auf das Nötige verkürzt: wer, welche Aktion, welches Ziel und NUR die
 * gespeicherten Namen. Die übrige Nutzlast eines fremden Eintrags gehört nicht zu dieser Seite.
 */
function namensbeleg(e: AuditEntry): Namensbeleg {
  const payload: Record<string, unknown> = {};
  if (typeof e.payload.actorName === "string") {
    payload.actorName = e.payload.actorName;
  }
  if (typeof e.payload.targetName === "string") {
    payload.targetName = e.payload.targetName;
  }
  return { seq: e.seq, actor: e.actor, action: e.action, target: e.target, payload };
}

/** Titel der Ziele einer Seite — nur für Objekte, die der Betrachter jetzt öffnen darf. */
async function objekteFuer(
  sicht: AuditSicht,
  eintraege: readonly { target: string }[],
): Promise<Record<string, AuditObjektSicht>> {
  const objekte: Record<string, AuditObjektSicht> = {};
  for (const ziel of new Set(eintraege.map((e) => e.target))) {
    const o = await sicht.objekt(ziel);
    if (o !== undefined) {
      objekte[ziel] = o;
    }
  }
  return objekte;
}

/**
 * aufnahme:20260922:gesamt-leserechte (Nacharbeit 20, Integration main): der Seitenweg für einen
 * eingeschränkten Leser. Dieselben Filter (`auditSeiteTrifft`), dieselbe Seitengröße
 * (`auditSeitengroesse`) und dieselbe Namensregel (`namensbelegeAus`) wie `AuditService.page` und
 * `namensbelege` — aber über SEINER Leseansicht: `before`, `nextBefore` und jede `seq` sind
 * laufende Nummern der Ansicht, und Namensbelege kommen nur aus Einträgen, die er lesen darf.
 */
async function ansichtsseite(
  kette: readonly AuditEntry[],
  lage: Leselage,
  anfrage: AuditSeitenAnfrage,
  sicht: AuditSicht,
) {
  const paare = lesepaare(kette, lage);
  const limit = auditSeitengroesse(anfrage.limit);
  const { before } = anfrage;
  const trifft = (p: { original: AuditEntry; ansicht: Ansichtseintrag }): boolean =>
    (before === undefined || p.ansicht.seq < before) && auditSeiteTrifft(p.original, anfrage);
  const gelesen = paare
    .filter(trifft)
    .reverse()
    .slice(0, limit + 1);
  const seite = gelesen.slice(0, limit).map((p) => p.ansicht);
  const nextBefore = gelesen.length > limit ? (seite.at(-1)?.seq ?? null) : null;
  const nummer = new Map(paare.map((p) => [p.original.seq, p.ansicht.seq]));
  const kennungen = new Set(seite.flatMap((e) => [e.actor, e.target]));
  const gesucht = [...kennungen].filter((id) => id !== "");
  const belege = namensbelegeAus(
    paare.map((p) => p.original),
    gesucht,
  );
  const namensbelege = belege.map((e) => namensbeleg({ ...e, seq: nummer.get(e.seq) ?? 0 }));
  return {
    entries: await Promise.all(seite.map((e) => sicht.eintrag(e))),
    nextBefore,
    limit,
    objekte: await objekteFuer(sicht, seite),
    namensbelege,
  };
}

// Audit-Log (§2.4 / FR-AUD). Governance-Einsicht: Controller/Admin (ko.validate-Recht).
//
// produkt:20261009:admin-audit-verstaendlich: `kos` ist der Objektzugang, über den die Ausgabe
// Titel und Rücklinks nur für Objekte nennt, die der Betrachter JETZT öffnen darf, und Inhaltsfelder
// fremder Objekte schwärzt (`../audit-sicht.ts`). Fehlt er, ist nichts sichtbar — enger, nie weiter.
//
// aufnahme:20260922:gesamt-leserechte (Nacharbeit 20, Integration main): `quelle` trägt die Fakten,
// gegen die die Lesepolicy je Leser entschieden wird (s. o.). Beide Schichten gelten zugleich: für
// einen eingeschränkten Leser zuerst die Leseransicht (Einträge zu Verborgenem fehlen ganz, laufende
// Nummern der Ansicht), darauf die Schwärzung aus `../audit-sicht.ts`. Ohne `quelle` ist für jeden
// Leser alles verborgen — enger, nie weiter.
export function auditRoutes(
  audit: AuditService,
  guards: Guards,
  befunde: readonly BefundKennungen[] = [],
  kos?: AuditObjektZugang,
  quelle?: AuditLeseQuelle,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: AuditFilter }>("/api/audit", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const sicht = auditSichtFuer(user, kos);
      const kette = await audit.list({});
      const lage = await leselage(user, quelle, kette);
      if (!lage.eingeschraenkt) {
        const eintraege = await audit.list(request.query);
        reply.code(200).send(await Promise.all(eintraege.map((e) => sicht.eintrag(e))));
        return;
      }
      const filter = request.query ?? {};
      const ansicht = leseansicht(kette, lage).filter((e) => filterTrifft(e, filter));
      reply.code(200).send(await Promise.all(ansicht.map((e) => sicht.eintrag(e))));
    });

    // produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DER SEITENWEG DER VERWALTERANSICHT.
    //
    // Dieselbe Tür wie `/api/audit`. Statt der Gesamtliste eine Seite (jüngste zuerst, höchstens
    // `AUDIT_SEITE_MAX`), kombinierbar gefiltert nach Person (`actor`), Aktion (`action` oder
    // mehrere über `actions`), Ziel (`target`) und Zeitraum (`from`/`to`). Dazu, was die Fläche zum
    // Lesen braucht, ohne die Kette ein zweites Mal zu laden:
    //   · `objekte`       Titel der betroffenen Objekte — NUR die, die der Betrachter öffnen darf;
    //   · `namensbelege`  die Einträge, in denen die Kette Namen zu Kennungen dieser Seite gespeichert
    //                     hat (für gelöschte Konten), auf Kennungen und Namen verkürzt.
    app.get<{ Querystring: SeitenQuery }>("/api/audit/seite", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const anfrage = leseSeitenAnfrage(request.query ?? {});
      if (typeof anfrage === "string") {
        reply.code(400).send({ error: "BAD_REQUEST", message: anfrage });
        return;
      }
      const sicht = auditSichtFuer(user, kos);
      const kette = await audit.list({});
      const lage = await leselage(user, quelle, kette);
      if (lage.eingeschraenkt) {
        reply.code(200).send(await ansichtsseite(kette, lage, anfrage, sicht));
        return;
      }
      const seite = await audit.page(anfrage);
      const entries = await Promise.all(seite.entries.map((e) => sicht.eintrag(e)));
      const objekte = await objekteFuer(sicht, seite.entries);
      const kennungen = seite.entries.flatMap((e) => [e.actor, e.target]);
      const namensbelege = (await audit.namensbelege(kennungen)).map(namensbeleg);
      reply.code(200).send({
        entries,
        nextBefore: seite.nextBefore,
        limit: seite.limit,
        objekte,
        namensbelege,
      });
    });

    // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (verify statt nur Aussage). Governance-
    // Einsicht wie /api/audit (ko.validate). Antwort: { ok, count } — Grundlage des Admin-Knopfs.
    // Für einen eingeschränkten Leser der Bericht SEINER Ansicht (s. Kopf dieser Datei).
    //
    // produkt:20261009:admin-audit-verstaendlich: die Antwort trägt den ZEITPUNKT der Prüfung
    // (`checkedAt`). Die Fläche nennt einen erfolgreichen Nachweis nur mit diesem Zeitpunkt — ein
    // Ergebnis ohne Zeit ist für sie kein Nachweis.
    app.get("/api/audit/verify", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const kette = await audit.list({});
      const lage = await leselage(user, quelle, kette);
      const bericht = lage.eingeschraenkt
        ? ansichtsbericht(kette, lage)
        : await audit.verifyReport();
      reply.code(200).send({ ...bericht, checkedAt: new Date().toISOString() });
    });

    // R-0766 (Aufnahme gesamt-auditprotokoll, Lauf 2): die Kennungen der Konflikte und
    // Überschneidungen eines Objekts — offen und abgeschlossen. Die Kette am Objekt (`koAuditEvents`)
    // ordnet damit auch Altbelege zu, die das Objekt nicht selbst nennen. Nur Kennungen, die im
    // Protokoll ohnehin als Ziel stehen; deshalb dieselbe Tür wie `/api/audit`.
    // Ein verborgenes Objekt hat keine Befunde, ein verborgener Befund erscheint nicht.
    app.get<{ Params: { koId: string } }>(
      "/api/audit/ko/:koId/findings",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const lage = await leselage(user, quelle, await audit.list({}));
        if (lage.alles || lage.verborgen.has(request.params.koId)) {
          reply.code(200).send({ ids: [] });
          return;
        }
        const ids = new Set<string>();
        for (const befund of befunde) {
          for (const id of await befund.idsForKo(request.params.koId)) {
            if (!lage.verborgen.has(id)) {
              ids.add(id);
            }
          }
        }
        reply.code(200).send({ ids: [...ids] });
      },
    );

    // R-0613: die Kette als Datei — Einträge, Prüfbericht und Kopf (letzte Sequenz + Hash) für die
    // Ablage außerhalb der Datenbank. Dieselbe Einsichtsstufe wie `/api/audit`. Der Abruf selbst wird
    // als `audit.exported` angehängt. Ein eingeschränkter Leser bekommt die Leseransicht (s. Kopf),
    // nie eine umgeschriebene Kette.
    //
    // FR-AUD-02: unter `/api/audit` gibt es ausschließlich GET-Wege. Ein POST/PUT/PATCH/
    // DELETE ist nirgends registriert — `tests/audit-gesamt/append-only-http.test.ts` misst das.
    //
    // produkt:20261009:admin-audit-verstaendlich: auch die Datei schwärzt Inhaltsfelder zu Objekten,
    // die der Exportierende nicht öffnen darf (`geschwaerzt` je Eintrag, Anzahl im Kopf). Kopf und
    // `inspection` beschreiben weiter die VOLLSTÄNDIGE Kette; ein geschwärzter Eintrag lässt sich in
    // der Datei deshalb nicht nachrechnen, und genau das sagt sein `geschwaerzt`.
    app.get("/api/audit/export", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const sicht = auditSichtFuer(user, kos);
      const vorher = await audit.list({});
      const lage = await leselage(user, quelle, vorher);
      if (!lage.eingeschraenkt) {
        const datei = await audit.exportChain(user.id);
        const entries = await Promise.all(datei.entries.map((e) => sicht.eintrag(e)));
        const geschwaerzt = entries.filter((e) => e.geschwaerzt !== undefined).length;
        const stempel = datei.exportedAt.replace(/[:.]/g, "-");
        reply
          .header("content-disposition", `attachment; filename="klarwerk-audit-${stempel}.json"`)
          .code(200)
          .send({ ...datei, entries, geschwaerzt });
        return;
      }
      // Die Ansicht entsteht aus der Kette VOR ihrem eigenen Beleg — wie beim Kettenexport.
      const eintraege = await Promise.all(leseansicht(vorher, lage).map((e) => sicht.eintrag(e)));
      const geschwaerzt = eintraege.filter((e) => e.geschwaerzt !== undefined).length;
      const exportedAt = new Date().toISOString();
      await audit.record({
        actor: user.id,
        action: "audit.view-exported",
        target: "audit",
        payload: {},
      });
      const name = `klarwerk-audit-ansicht-${exportedAt.replace(/[:.]/g, "-")}.json`;
      reply.header("content-disposition", `attachment; filename="${name}"`).code(200).send({
        format: "klarwerk-audit-ansicht",
        formatVersion: 1,
        exportedAt,
        kette: false,
        hinweis:
          "Leseansicht nach Leserecht: Einträge zu nicht sichtbaren Objekten fehlen; laufende Nummern der Ansicht, ohne Kettenfelder, nicht als Kette prüfbar.",
        count: eintraege.length,
        geschwaerzt,
        entries: eintraege,
      });
    });
  };
}
