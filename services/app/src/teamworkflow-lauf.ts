import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SessionUser } from "../../auth";
import { can } from "../../rbac";
import { ergebnisVorgang } from "./klara-routine";
import { rechtekontextStempel } from "./rechtekontext";
import { type TeamassistentDienst, TeamassistentFehler } from "./teamassistenten";
import type { TeamAntwort } from "./teamassistenten-wissen";
import type {
  LaufAktion,
  LaufBindung,
  WorkflowEreignis,
  WorkflowLaeufeRepo,
  WorkflowLauf,
} from "./teamworkflow-laeufe-repo";
import {
  type WorkflowDefinition,
  WorkflowFehler,
  type WorkflowProbe,
  type WorkflowSchritt,
  type WorkflowSitzung,
  type WorkflowSprache,
  type WorkflowZugang,
  workflowEingabe,
  workflowFehlt,
  workflowNummer,
  workflowObjekt,
  workflowSprache,
  workflowStand,
  workflowText,
} from "./teamworkflows-vertrag";

type Assi = Pick<TeamassistentDienst, "fragen" | "workflowBindung">;
type Rahmen = Awaited<ReturnType<WorkflowZugang["freigabe"]>>;
type AssistentSchritt = Extract<WorkflowSchritt, { typ: "assistent" }>;
const basisFehler = () => new WorkflowFehler(409, "GRUNDLAGE_GEAENDERT");

function frageZumFall(s: AssistentSchritt, fall: string) {
  if (s.frage.includes("{{fall}}") && !fall.trim()) return workflowEingabe();
  return workflowText(
    s.frage.replaceAll("{{fall}}", () => fall),
    1000,
  );
}
async function aktuell(user: SessionUser, sitzung: WorkflowSitzung) {
  const frisch = await sitzung();
  if (!frisch || rechtekontextStempel(user) !== rechtekontextStempel(frisch))
    return workflowFehlt();
  return frisch;
}
async function auswerten(
  s: AssistentSchritt,
  fall: string,
  teamId: string,
  user: SessionUser,
  sitzung: WorkflowSitzung,
  sprache: WorkflowSprache,
  assistenten: Assi,
) {
  const vorher = await assistenten.workflowBindung(
    s.assistentId,
    await aktuell(user, sitzung),
    s.version,
    teamId,
  );
  const { antwort } = await assistenten.fragen(
    s.assistentId,
    user,
    { version: s.version, frage: frageZumFall(s, fall), sprache },
    sitzung,
    true,
  );
  const danach = await assistenten.workflowBindung(
    s.assistentId,
    await aktuell(user, sitzung),
    s.version,
    teamId,
  );
  if (!isDeepStrictEqual(vorher, danach)) throw basisFehler();
  return { antwort, bindung: danach };
}
export async function probeWorkflow(
  definition: WorkflowDefinition,
  teamId: string,
  user: SessionUser,
  sitzung: WorkflowSitzung,
  sprache: WorkflowSprache,
  assistenten: Assi,
): Promise<WorkflowProbe> {
  const bindungen: Record<string, Record<string, number>> = {};
  const konfliktstand: Record<string, string> = {};
  const schritte: WorkflowProbe["schritte"] = [];
  const fall = definition.beispielfall ?? "";
  let simulation = neuerLauf("probe", "probe", 1, user.id, teamId, fall, sprache);
  for (const [index, s] of definition.schritte.entries()) {
    const fallprobe: WorkflowProbe["schritte"][number] = { index, typ: s.typ, bestanden: true };
    if (simulation.index !== index) {
      schritte.push({ ...fallprobe, bestanden: false, code: "VORHERIGER_SCHRITT" });
      continue;
    }
    let antwort: TeamAntwort | undefined;
    if (s.typ === "assistent") {
      fallprobe.erwartet = s.erwartet;
      try {
        const ausgabe = await auswerten(s, fall, teamId, user, sitzung, sprache, assistenten);
        antwort = ausgabe.antwort;
        bindungen[s.assistentId] = ausgabe.bindung.quellen;
        konfliktstand[s.assistentId] = ausgabe.bindung.konflikte;
        fallprobe.ist = antwort.stand;
        fallprobe.bestanden = antwort.stand === s.erwartet;
      } catch (e) {
        if (
          !(
            e instanceof TeamassistentFehler ||
            (e instanceof WorkflowFehler && e.code === "GRUNDLAGE_GEAENDERT")
          )
        )
          throw e;
        fallprobe.bestanden = false;
        fallprobe.code = "GRUNDLAGE_GEAENDERT";
      }
    }
    // Exercise the same state changes and report creation as a live run, entirely in memory.
    if (fallprobe.bestanden)
      simulation = uebergang(
        simulation,
        definition,
        s,
        s.typ === "entscheidung" ? "annehmen" : "weiter",
        user.id,
        undefined,
        antwort,
      );
    schritte.push(fallprobe);
  }
  return {
    bestanden: simulation.stand === "abgeschlossen" && schritte.every((s) => s.bestanden),
    schritte,
    bindungen,
    konfliktstand,
  };
}

function neuerLauf(
  id: string,
  workflowId: string,
  version: number,
  user: string,
  teamId: string,
  fall: string,
  sprache: WorkflowSprache,
): WorkflowLauf {
  const am = new Date().toISOString();
  return {
    id,
    workflowId,
    version,
    teamId,
    revision: 1,
    index: 0,
    gestartetVon: user,
    sprache,
    fall,
    aktualisiertAm: am,
    stand: "laeuft",
    verlauf: [{ index: -1, typ: "start", akteur: user, am }],
    ergebnisse: [],
  };
}
function moeglich(
  l: WorkflowLauf,
  s: WorkflowSchritt | undefined,
  user: SessionUser,
  r: Rahmen,
): LaufAktion[] {
  if (!s || (l.stand !== "laeuft" && l.stand !== "rueckfrage")) return [];
  if (l.stand === "rueckfrage") return l.gestartetVon === user.id ? ["antworten"] : [];
  if (s.typ === "entscheidung")
    return s.rolle === "mitglied" || r.team.verantwortlich === user.id
      ? ["annehmen", "rueckfrage", "ablehnen"]
      : [];
  return s.typ === "aktion" && !can(user.role, "ko.create") ? [] : ["weiter"];
}
function uebergang(
  l: WorkflowLauf,
  def: WorkflowDefinition,
  s: WorkflowSchritt,
  a: LaufAktion,
  user: string,
  notiz?: string,
  antwort?: TeamAntwort,
): WorkflowLauf {
  const am = new Date().toISOString();
  const neu = {
    ...l,
    verlauf: [...l.verlauf],
    ergebnisse: [...l.ergebnisse],
    revision: l.revision + 1,
    aktualisiertAm: am,
  };
  const typ = a === "weiter" ? (s.typ === "assistent" ? "assistent" : "aktion") : a;
  const e: WorkflowEreignis = {
    index: l.index,
    typ,
    akteur: user,
    am,
    ...(notiz ? { notiz } : {}),
  };
  if (s.typ === "assistent" && antwort) {
    Object.assign(e, { assistentId: s.assistentId, version: s.version, antwort });
    if (antwort.stand !== s.erwartet) neu.stand = "angehalten";
  }
  if (a === "ablehnen") neu.stand = "abgelehnt";
  else if (a === "rueckfrage") neu.stand = "rueckfrage";
  else if (a === "antworten") neu.stand = "laeuft";
  else if (neu.stand === "laeuft") {
    if (s.typ === "aktion") {
      // Shared routines use the existing stable occurrence-to-result key. Keeping the report
      // and its immutable event in one CAS also covers a crash after commit before HTTP reply.
      const id = ergebnisVorgang(`${l.id}-${l.index}`);
      neu.ergebnisse.push({
        id,
        index: l.index,
        titel: s.titel,
        workflowVersion: l.version,
        erstelltVon: user,
        erstelltAm: am,
        schritte: Array.from(new Set(l.verlauf.filter((v) => v.index >= 0).map((v) => v.index))),
      });
      e.ergebnisId = id;
    }
    neu.index++;
    if (neu.index === def.schritte.length) neu.stand = "abgeschlossen";
  }
  neu.verlauf.push(e);
  return neu;
}
function kurz(l: WorkflowLauf) {
  const { id, workflowId, version, revision, stand, index, gestartetVon, aktualisiertAm } = l;
  return { id, workflowId, version, revision, stand, index, gestartetVon, aktualisiertAm };
}

export class TeamworkflowLaufDienst {
  constructor(
    private readonly repo: WorkflowLaeufeRepo,
    private readonly definitionen: WorkflowZugang,
    private readonly assistenten: Assi,
    private readonly nameFuer: (id: string) => Promise<string | undefined>,
  ) {}
  private async rahmen(
    id: string,
    user: SessionUser,
    version: number | undefined,
    laufend: boolean,
  ) {
    const r = await this.definitionen.freigabe(id, user, version, laufend);
    if (r.team.archiviert || !r.team.mitglieder.includes(user.id)) return workflowFehlt();
    return r;
  }
  private async bindung(
    r: Rahmen,
    user: SessionUser,
    sitzung: WorkflowSitzung,
  ): Promise<LaufBindung> {
    const b: LaufBindung = {
      leser: user,
      teamVersion: r.team.version,
      assistenten: {},
      bindungen: {},
      konfliktstand: {},
    };
    for (const s of r.definition.schritte) {
      if (s.typ !== "assistent" || b.assistenten[s.assistentId] === s.version) continue;
      const a = await this.assistenten.workflowBindung(
        s.assistentId,
        await aktuell(user, sitzung),
        s.version,
        r.team.id,
      );
      if (
        !isDeepStrictEqual(r.pruefung.bindungen?.[s.assistentId], a.quellen) ||
        r.pruefung.konfliktstand?.[s.assistentId] !== a.konflikte
      )
        throw basisFehler();
      b.assistenten[s.assistentId] = s.version;
      b.bindungen[s.assistentId] = a.quellen;
      b.konfliktstand[s.assistentId] = a.konflikte;
    }
    return b;
  }
  private async finde(id: string, laufId: string) {
    const l = await this.repo.lesen(laufId);
    if (!l || l.workflowId !== id) return workflowFehlt();
    return l;
  }
  async ergebnisGrundlage(
    id: string,
    laufId: string,
    ergebnisId: string,
    user: SessionUser,
    sitzung: WorkflowSitzung,
  ) {
    const lauf = await this.finde(id, laufId);
    const r = await this.rahmen(id, user, lauf.version, true);
    const ergebnis = lauf.ergebnisse.find((e) => e.id === ergebnisId);
    if (
      !ergebnis ||
      lauf.stand !== "abgeschlossen" ||
      !lauf.verlauf.some(
        (e) => e.typ === "aktion" && e.index === ergebnis.index && e.ergebnisId === ergebnis.id,
      )
    )
      return workflowFehlt();
    const bindung = await this.bindung(r, user, sitzung);
    const ende = await this.rahmen(id, await aktuell(user, sitzung), lauf.version, true);
    if (ende.team.version !== bindung.teamVersion) return workflowStand();
    return { lauf, team: ende.team, definition: r.definition, ergebnis, bindung };
  }
  async liste(id: string, user: SessionUser, sitzung: WorkflowSitzung) {
    await this.rahmen(id, user, undefined, false);
    const alle = await this.repo.fuerWorkflow(id);
    await this.rahmen(id, await aktuell(user, sitzung), undefined, false);
    return {
      laeufe: alle.map(kurz).sort((a, b) => b.aktualisiertAm.localeCompare(a.aktualisiertAm)),
    };
  }
  async lesen(id: string, laufId: string, user: SessionUser, sitzung: WorkflowSitzung) {
    const l = await this.finde(id, laufId);
    const r = await this.rahmen(id, user, l.version, true);
    const schritt = r.definition.schritte[l.index];
    const benoetigt = new Set(l.verlauf.map((e) => e.akteur));
    benoetigt.add(l.gestartetVon);
    if (schritt?.typ === "entscheidung" && schritt.rolle === "verantwortlich")
      benoetigt.add(r.team.verantwortlich);
    const personen = await Promise.all(
      [...benoetigt]
        .filter((id) => r.team.mitglieder.includes(id))
        .map(async (id) => [id, await this.nameFuer(id)] as const),
    );
    let gueltig = true;
    try {
      await this.bindung(r, user, sitzung);
    } catch (e) {
      if (
        e instanceof TeamassistentFehler ||
        (e instanceof WorkflowFehler && e.code === "GRUNDLAGE_GEAENDERT")
      )
        gueltig = false;
      else throw e;
    }
    const ende = await this.rahmen(id, await aktuell(user, sitzung), l.version, true);
    if (!gueltig)
      return {
        ...kurz(l),
        stand: "angehalten" as const,
        grund: "GRUNDLAGE_GEAENDERT",
        fall: "",
        schritt: null,
        aktionen: [],
        verlauf: [],
        ergebnisse: [],
        zustaendig: null,
        naechsteWirkung: null,
      };
    const s = r.definition.schritte[l.index];
    const zustaendig =
      l.stand === "rueckfrage"
        ? l.gestartetVon
        : s?.typ === "entscheidung" && s.rolle === "verantwortlich"
          ? ende.team.verantwortlich
          : null;
    // An approval shows the next concrete effect it can authorize; a later decision is separate.
    let naechsteWirkung: { index: number; titel: string } | null = null;
    if (s?.typ === "entscheidung" && (l.stand === "laeuft" || l.stand === "rueckfrage")) {
      for (const [offset, kandidat] of r.definition.schritte.slice(l.index + 1).entries()) {
        if (kandidat.typ === "entscheidung") break;
        if (kandidat.typ === "aktion") {
          naechsteWirkung = { index: l.index + 1 + offset, titel: kandidat.titel };
          break;
        }
      }
    }
    return {
      ...kurz(l),
      naechsteWirkung,
      namen: Object.fromEntries(
        personen.filter(([id, name]) => name && ende.team.mitglieder.includes(id)),
      ),
      workflowName: r.definition.name,
      ausloeser: r.definition.ausloeser,
      fall: l.fall,
      schritt: s ?? null,
      aktionen: moeglich(l, s, user, ende),
      zustaendig,
      verlauf: l.verlauf.map((e) => {
        const titel = r.definition.schritte[e.index]?.titel;
        return titel ? { ...e, schrittTitel: titel } : e;
      }),
      ergebnisse: l.ergebnisse,
      ...(l.stand === "angehalten" ? { grund: "ASSISTENT_ERWARTUNG" } : {}),
    };
  }
  async starten(id: string, user: SessionUser, roh: unknown, sitzung: WorkflowSitzung) {
    const p = workflowObjekt(roh);
    const version = workflowNummer(p.version);
    const vorgang = workflowText(p.vorgang, 120);
    const sprache = workflowSprache(p.sprache);
    const fall = p.fall === undefined || p.fall === "" ? "" : workflowText(p.fall, 500);
    const laufId = createHash("sha256")
      .update(JSON.stringify([id, user.id, vorgang]))
      .digest("hex");
    const vorhanden = await this.repo.lesen(laufId);
    if (vorhanden) {
      if (vorhanden.version !== version || vorhanden.fall !== fall || vorhanden.sprache !== sprache)
        return workflowStand();
      return this.lesen(id, laufId, user, sitzung);
    }
    const r = await this.rahmen(id, user, version, false);
    for (const s of r.definition.schritte) if (s.typ === "assistent") frageZumFall(s, fall);
    const bindung = await this.bindung(r, user, sitzung);
    const ende = await this.rahmen(id, await aktuell(user, sitzung), version, false);
    if (ende.team.version !== r.team.version) return workflowStand();
    const l = neuerLauf(laufId, id, version, user.id, r.team.id, fall, sprache);
    if (!(await this.repo.speichern(l, 0, bindung))) {
      const gewonnen = await this.repo.lesen(laufId);
      if (
        !gewonnen ||
        gewonnen.version !== version ||
        gewonnen.fall !== fall ||
        gewonnen.sprache !== sprache
      )
        return workflowStand();
    }
    return this.lesen(id, laufId, user, sitzung);
  }
  async weiter(
    id: string,
    laufId: string,
    user: SessionUser,
    roh: unknown,
    sitzung: WorkflowSitzung,
  ) {
    const p = workflowObjekt(roh);
    const basis = workflowNummer(p.revision);
    const a = p.aktion;
    if (
      a !== "weiter" &&
      a !== "annehmen" &&
      a !== "rueckfrage" &&
      a !== "antworten" &&
      a !== "ablehnen"
    )
      return workflowEingabe();
    const notiz = p.notiz === undefined || p.notiz === "" ? undefined : workflowText(p.notiz, 1000);
    if ((a === "rueckfrage" || a === "antworten") && !notiz) return workflowEingabe();
    const l = await this.finde(id, laufId);
    const r = await this.rahmen(id, user, l.version, true);
    if (l.revision !== basis) return this.wiederholung(id, l, basis, a, notiz, user, sitzung);
    const s = r.definition.schritte[l.index];
    if (!s || !moeglich(l, s, user, r).includes(a))
      throw new WorkflowFehler(403, "AKTION_NICHT_ERLAUBT");
    await this.bindung(r, user, sitzung);
    const ausgabe =
      s.typ === "assistent"
        ? await auswerten(s, l.fall, r.team.id, user, sitzung, l.sprache, this.assistenten)
        : undefined;
    const neu = uebergang(l, r.definition, s, a, user.id, notiz, ausgabe?.antwort);
    const b = await this.bindung(r, user, sitzung);
    const ende = await this.rahmen(id, await aktuell(user, sitzung), l.version, true);
    if (ende.team.version !== b.teamVersion || !moeglich(l, s, user, ende).includes(a))
      return workflowStand();
    if (!(await this.repo.speichern(neu, basis, b))) {
      const gewonnen = await this.finde(id, laufId);
      return this.wiederholung(id, gewonnen, basis, a, notiz, user, sitzung);
    }
    return this.lesen(id, laufId, user, sitzung);
  }
  private wiederholung(
    id: string,
    l: WorkflowLauf,
    basis: number,
    a: LaufAktion,
    notiz: string | undefined,
    user: SessionUser,
    sitzung: WorkflowSitzung,
  ) {
    const e = l.verlauf[basis];
    if (
      !e ||
      e.akteur !== user.id ||
      e.notiz !== notiz ||
      (a === "weiter" ? e.typ !== "assistent" && e.typ !== "aktion" : e.typ !== a)
    )
      return workflowStand();
    return this.lesen(id, l.id, user, sitzung);
  }
}
