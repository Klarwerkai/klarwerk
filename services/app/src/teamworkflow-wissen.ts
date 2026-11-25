import { createHash } from "node:crypto";
import { type SessionUser, type User, istKontozugangAbgelaufen } from "../../auth";
import type { ConflictRepo } from "../../conflicts";
import type { KnowledgeObject, KoService, KoSource } from "../../knowledge-object";
import { erkenneSchutzdaten } from "../../knowledge-object";
import { can } from "../../rbac";
import { rechtekontextStempel } from "./rechtekontext";
import { darfSehen } from "./sichtbarkeit";
import { TeamassistentFehler } from "./teamassistenten";
import type { TeamassistentRepo } from "./teamassistenten";
import { type TeamAntwort, teamQuellKonfliktstand } from "./teamassistenten-wissen";
import type { TeamsRepo } from "./teams";
import type {
  ErgebnisVorschlag,
  LaufBindung,
  WissensPruefBezug,
  WorkflowLaeufeRepo,
  WorkflowLauf,
} from "./teamworkflow-laeufe-repo";
import type { TeamworkflowLaufDienst } from "./teamworkflow-lauf";
import type { TeamworkflowRepo } from "./teamworkflows";
import {
  WorkflowFehler,
  type WorkflowSitzung,
  workflowEingabe,
  workflowFehlt,
  workflowObjekt,
  workflowStand,
  workflowText,
} from "./teamworkflows-vertrag";

type Quelle = TeamAntwort["quellen"][number];
type Basis = Awaited<ReturnType<TeamworkflowLaufDienst["ergebnisGrundlage"]>>;
type Person = Pick<User, "id" | "name" | "role" | "approved" | "accessExpiresAt">;
interface Dienste {
  laeufe: TeamworkflowLaufDienst;
  repo: WorkflowLaeufeRepo;
  teams: TeamsRepo;
  ko: KoService;
  konto: (id: string) => Promise<Person | undefined>;
}
const hash = (wert: unknown) => createHash("sha256").update(JSON.stringify(wert)).digest("hex");
function zugelassen(p: Person | undefined) {
  return (
    !!p && p.approved && !istKontozugangAbgelaufen(p, Date.now()) && can(p.role, "ko.validate")
  );
}
function weitergebbar(ko: KnowledgeObject) {
  return (
    ko.confidentiality === "intern" &&
    ko.spaceId === undefined &&
    (!ko.quellrechte ||
      (ko.quellrechte.stufe === "intern" &&
        ko.quellrechte.leser === undefined &&
        !ko.quellrechte.leserUnvollstaendig))
  );
}
/** Unabhängige Ablagen im Speichermodus. Entscheiden läuft unter der Schreibklammer
 * des KO-Dienstes, daher hier ausschließlich die bereits gesperrte Originalablage lesen. */
export function speicherWissensbindung(
  d: Pick<Dienste, "teams" | "konto"> & {
    quelle: (id: string) => Promise<KnowledgeObject | undefined>;
    workflows: Pick<TeamworkflowRepo, "lesen">;
    assistenten: Pick<TeamassistentRepo, "lesen">;
    konflikte: Pick<ConflictRepo, "all">;
  },
) {
  return async (lauf: WorkflowLauf, b: LaufBindung) => {
    const w = b.weitergabe;
    if (!w) return false;
    const gruppen = Object.entries(b.bindungen);
    const [team, person, pruefer, workflow, assistenten, quellen, konflikte] = await Promise.all([
      d.teams.fassungen(lauf.teamId).then((f) => f.at(-1)),
      d.konto(b.leser.id),
      d.konto(w.pruefer),
      d.workflows.lesen(lauf.workflowId),
      Promise.all(Object.keys(b.assistenten).map((id) => d.assistenten.lesen(id))),
      Promise.all(
        [...new Set(gruppen.flatMap(([, q]) => Object.keys(q)))].map((id) => d.quelle(id)),
      ),
      gruppen.some(([, q]) => Object.keys(q).length > 1) ? d.konflikte.all() : [],
    ]);
    if (
      !team ||
      team.archiviert ||
      team.version !== b.teamVersion ||
      team.verantwortlich !== w.pruefer ||
      !team.mitglieder.includes(w.pruefer) ||
      !team.mitglieder.includes(b.leser.id) ||
      !zugelassen(pruefer) ||
      !person?.approved ||
      person.role !== b.leser.role ||
      istKontozugangAbgelaufen(person, Date.now()) ||
      !workflow?.aktiv ||
      workflow.teamId !== team.id ||
      assistenten.some((a) => !a || a.teamId !== team.id || a.aktiv !== b.assistenten[a.id])
    )
      return false;
    const stand = new Map(quellen.map((q) => [q?.id, q]));
    for (const [assistent, gruppe] of gruppen) {
      for (const [id, version] of Object.entries(gruppe)) {
        const q = stand.get(id);
        if (
          !q ||
          q.deletedAt ||
          q.status !== "validiert" ||
          q.version !== version ||
          q.schutzdatenQuarantaene ||
          !darfSehen(b.leser, q) ||
          (w.quellen.includes(q.id) && !weitergebbar(q))
        )
          return false;
      }
      if (teamQuellKonfliktstand(gruppe, konflikte) !== b.konfliktstand[assistent]) return false;
    }
    return true;
  };
}
function streng(roh: unknown, erlaubt: string[]) {
  const p = workflowObjekt(roh);
  if (Object.keys(p).some((k) => !erlaubt.includes(k))) return workflowEingabe();
  return p;
}
function mitVorschlag(lauf: WorkflowLauf, id: string, p: ErgebnisVorschlag): WorkflowLauf {
  return {
    ...lauf,
    revision: lauf.revision + 1,
    wissensvorschlaege: { ...lauf.wissensvorschlaege, [id]: p },
  };
}
function ausErgebnis({ lauf, ergebnis, bindung, definition }: Basis) {
  // Only the original events that preceded THIS receipt contribute evidence.
  const ereignisse = lauf.verlauf.filter(
    (e) => e.index >= 0 && e.index < ergebnis.index && ergebnis.schritte.includes(e.index),
  );
  const auswahl = new Map<string, Quelle>();
  const grundlagen = new Set<string>();
  for (const e of ereignisse) {
    if (e.typ !== "assistent" || !e.assistentId || !e.antwort) continue;
    const gruppe = bindung.bindungen[e.assistentId];
    if (!gruppe) return workflowStand();
    for (const id of Object.keys(gruppe)) grundlagen.add(id);
    for (const q of e.antwort.quellen) {
      if (gruppe[q.id] !== q.version) return workflowStand();
      auswahl.set(JSON.stringify([q.id, q.version, q.auszug]), q);
    }
  }
  const quellen = [...auswahl.values()];
  const letzteEntscheidung = ereignisse.filter((e) => e.typ === "annehmen").at(-1);
  const schritt = letzteEntscheidung && definition.schritte[letzteEntscheidung.index];
  const beschluss =
    letzteEntscheidung && schritt?.typ === "entscheidung" && !quellen.length
      ? {
          titel: schritt.titel,
          auszug: letzteEntscheidung.notiz || lauf.fall,
          am: letzteEntscheidung.am,
          person: letzteEntscheidung.akteur,
        }
      : undefined;
  const befund = ereignisse.filter((e) => e.typ === "assistent" && e.antwort).at(-1)?.antwort;
  const aussage =
    letzteEntscheidung?.notiz ||
    (befund?.stand === "widerspruch" ? befund.quellen[0]?.auszug : lauf.fall) ||
    quellen[0]?.auszug ||
    "";
  return { quellen, grundlagen: [...grundlagen], aussage, beschluss };
}
function quellennachweis(
  ref: WissensPruefBezug,
  b: Basis,
  quellen: Quelle[],
  reviewer: string,
  at: string,
): KoSource[] {
  const vorgang: KoSource = {
    id: b.ergebnis.id,
    author: reviewer,
    at,
    label: `Workflow · v${b.lauf.version}`,
    workflowQuellart: "ergebnis",
    workflowBezug: { ...ref },
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Klarwerk",
    externalId: b.ergebnis.id,
    sourceVersion: b.lauf.version,
  };
  return [
    vorgang,
    ...[...new Map(quellen.map((q) => [q.id, q])).values()].map((q) => ({
      id: hash([q.id, q.version]),
      author: reviewer,
      at,
      label: `Klarwerk · v${q.version}`,
      url: null,
      workflowQuellart: "wissensfassung" as const,
      excerpt: null,
      kind: "external" as const,
      peerValidated: false,
      provider: "Klarwerk",
      externalId: q.id,
      sourceVersion: q.version,
    })),
  ];
}
export class TeamworkflowWissen {
  constructor(private readonly d: Dienste) {}
  private async basis(ref: WissensPruefBezug, user: SessionUser, sitzung: WorkflowSitzung) {
    const b = await this.d.laeufe.ergebnisGrundlage(
      ref.workflowId,
      ref.laufId,
      ref.ergebnisId,
      user,
      sitzung,
    );
    const aus = ausErgebnis(b);
    const quellen = await Promise.all(aus.grundlagen.map((id) => this.d.ko.get(id)));
    if (quellen.some((q) => !q || !darfSehen(user, q))) return workflowFehlt();
    const konto = await this.d.konto(b.team.verantwortlich);
    const pruefer = zugelassen(konto) && b.team.mitglieder.includes(b.team.verantwortlich);
    const p = b.lauf.wissensvorschlaege?.[b.ergebnis.id];
    const terminal = p?.stand === "freigegeben" || p?.stand === "abgelehnt";
    const hindernis =
      !aus.quellen.length && !aus.beschluss
        ? "QUELLEN_FEHLEN"
        : quellen.some((q) => !q || !weitergebbar(q))
          ? "QUELLE_GESCHUETZT"
          : !pruefer && !terminal
            ? "KEIN_PRUEFRECHT"
            : undefined;
    const artikel = p?.koId && !hindernis ? await this.d.ko.get(p.koId) : undefined;
    const stempel = hash([
      ref,
      b.team.version,
      b.lauf.version,
      b.ergebnis,
      aus.quellen,
      aus.beschluss,
      b.bindung.bindungen,
      b.bindung.konfliktstand,
      p ?? null,
    ]);
    const stand = hindernis ? "gesperrt" : (p?.stand ?? "entwurf");
    const aktuell = await sitzung();
    if (!aktuell || rechtekontextStempel(aktuell) !== rechtekontextStempel(user))
      return workflowFehlt();
    const team = (await this.d.teams.fassungen(b.team.id)).at(-1);
    if (!team || team.archiviert || !team.mitglieder.includes(user.id)) return workflowFehlt();
    if (team.version !== b.team.version) return workflowStand();
    const sicht = {
      stand,
      titel: p?.titel ?? b.ergebnis.titel,
      aussage: p?.aussage ?? aus.aussage,
      quellen: aus.quellen,
      ...(aus.beschluss ? { beschluss: aus.beschluss } : {}),
      zustaendig: b.team.verantwortlich,
      zustaendigName: konto?.name ?? null,
      kannVorschlagen: stand === "entwurf",
      kannPruefen:
        stand === "vorgeschlagen" &&
        user.id === b.team.verantwortlich &&
        can(user.role, "ko.validate"),
      stempel,
      ...(hindernis ? { grund: hindernis } : p?.grund ? { grund: p.grund } : {}),
      ...(p && artikel && darfSehen(user, artikel)
        ? { koId: artikel.id, koVersion: p.koVersion }
        : {}),
      ...(p ? { vorgeschlagenVon: p.vorgeschlagenVon, vorgeschlagenAm: p.vorgeschlagenAm } : {}),
      ...(p?.entschiedenVon
        ? { entschiedenVon: p.entschiedenVon, entschiedenAm: p.entschiedenAm }
        : {}),
    };
    const bindung = {
      ...b.bindung,
      weitergabe: { quellen: aus.grundlagen, pruefer: b.team.verantwortlich },
    };
    return { b, p, sicht, bindung };
  }
  async lesen(ref: WissensPruefBezug, user: SessionUser, sitzung: WorkflowSitzung) {
    return (await this.basis(ref, user, sitzung)).sicht;
  }
  async pruefliste(user: SessionUser, sitzung: WorkflowSitzung) {
    if (!can(user.role, "ko.validate")) return { vorschlaege: [] };
    const teams = (await this.d.teams.aktuelle()).filter(
      (t) => !t.archiviert && t.verantwortlich === user.id && t.mitglieder.includes(user.id),
    );
    const refs = await this.d.repo.offeneWissensvorschlaege(teams.map((t) => t.id));
    const vorschlaege = [];
    for (const ref of refs) {
      try {
        const p = await this.lesen(ref, user, sitzung);
        if (p.kannPruefen) vorschlaege.push({ ...ref, titel: p.titel });
      } catch (e) {
        if (
          !(e instanceof WorkflowFehler && [404, 409].includes(e.status)) &&
          !(e instanceof TeamassistentFehler)
        )
          throw e;
      }
    }
    return { vorschlaege };
  }
  async vorschlagen(
    ref: WissensPruefBezug,
    user: SessionUser,
    roh: unknown,
    sitzung: WorkflowSitzung,
  ) {
    const x = streng(roh, ["titel", "aussage", "stempel"]);
    const titel = workflowText(x.titel, 150);
    const aussage = workflowText(x.aussage, 2000);
    const stempel = workflowText(x.stempel, 64);
    const { b, p, sicht, bindung } = await this.basis(ref, user, sitzung);
    const gleich = (v?: ErgebnisVorschlag) =>
      v?.vorschauStempel === stempel && v.titel === titel && v.aussage === aussage;
    if (gleich(p)) return sicht;
    if (!sicht.kannVorschlagen || stempel !== sicht.stempel) return workflowStand();
    if (erkenneSchutzdaten([titel, aussage]).length) throw new WorkflowFehler(409, "SCHUTZDATEN");
    const neu = mitVorschlag(b.lauf, ref.ergebnisId, {
      titel,
      aussage,
      vorschauStempel: stempel,
      stand: "vorgeschlagen",
      vorgeschlagenVon: user.id,
      vorgeschlagenAm: new Date().toISOString(),
    });
    if (!(await this.d.repo.speichern(neu, b.lauf.revision, bindung))) {
      const nach = await this.basis(ref, user, sitzung);
      if (!gleich(nach.p)) return workflowStand();
      return nach.sicht;
    }
    return this.lesen(ref, user, sitzung);
  }
  async entscheiden(
    ref: WissensPruefBezug,
    user: SessionUser,
    roh: unknown,
    sitzung: WorkflowSitzung,
  ) {
    const x = streng(roh, ["entscheidung", "stempel", "grund"]);
    const entscheidung = x.entscheidung;
    if (entscheidung !== "freigeben" && entscheidung !== "ablehnen") return workflowEingabe();
    const grund = entscheidung === "ablehnen" ? workflowText(x.grund, 1000) : undefined;
    const stempel = workflowText(x.stempel, 64);
    const { b, p, sicht, bindung } = await this.basis(ref, user, sitzung);
    if (user.id !== b.team.verantwortlich || !can(user.role, "ko.validate"))
      throw new WorkflowFehler(403, "AKTION_NICHT_ERLAUBT");
    const stand = entscheidung === "freigeben" ? "freigegeben" : "abgelehnt";
    const gleich = (v?: ErgebnisVorschlag) =>
      v?.entscheidStempel === stempel &&
      v.entschiedenVon === user.id &&
      v.stand === stand &&
      v.grund === grund;
    if (gleich(p)) return sicht;
    if (!p || !sicht.kannPruefen || sicht.stempel !== stempel) return workflowStand();
    const entschiedenAm = new Date().toISOString();
    const urteil: ErgebnisVorschlag = {
      ...p,
      stand,
      entscheidStempel: stempel,
      entschiedenVon: user.id,
      entschiedenAm,
      ...(grund ? { grund } : {}),
    };
    try {
      if (entscheidung === "ablehnen") {
        if (
          !(await this.d.repo.speichern(
            mitVorschlag(b.lauf, ref.ergebnisId, urteil),
            b.lauf.revision,
            bindung,
          ))
        )
          return workflowStand();
      } else {
        await this.d.ko.createFromReviewedWorkflow(
          {
            title: p.titel,
            statement: p.aussage,
            type: "best_practice",
            category: "Workflow",
            author: p.vorgeschlagenVon,
            confidentiality: "intern",
            sources: quellennachweis(ref, b, sicht.quellen, user.id, entschiedenAm),
          },
          user.id,
          async (ko, tx) => {
            const z = await sitzung();
            if (z?.id !== user.id || !can(z.role, "ko.validate")) return workflowFehlt();
            const neu = mitVorschlag(b.lauf, ref.ergebnisId, {
              ...urteil,
              koId: ko.id,
              koVersion: ko.version,
            });
            if (!(await this.d.repo.speichern(neu, b.lauf.revision, bindung, tx)))
              return workflowStand();
            if (!tx && this.d.repo.ruecknahmeWissensfreigabe) {
              return async () => {
                await this.d.repo.ruecknahmeWissensfreigabe?.(neu, b.lauf, ref.ergebnisId);
              };
            }
          },
        );
      }
    } catch (e) {
      if (!(e instanceof WorkflowFehler && e.code === "STAND_GEAENDERT")) throw e;
      const nach = await this.basis(ref, user, sitzung);
      if (!gleich(nach.p)) throw e;
      return nach.sicht;
    }
    return this.lesen(ref, user, sitzung);
  }
}
