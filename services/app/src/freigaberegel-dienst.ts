import type { AuditEntry, AuditService } from "../../audit";
import type { AuthService } from "../../auth";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { Assignment, KoPruefstand, ValidationService, Verdict } from "../../validation";
import {
  type FreigabeRegel,
  type Konto,
  type PrueferEintrag,
  type RegelAenderung,
  type TeamStand,
  type Vorgangszustand,
  entscheidet,
  entscheidungsurteil,
  faelligAm,
  grundlageVon,
  hatPruefergruppe,
  istAktiv,
  istEigenerBeitrag,
  istUeberfaellig,
  prueferkreis,
  regelAenderungen,
  unabhaengigePruefer,
  vorgangszustand,
  wirksameZustimmungen,
} from "./freigaberegeln";
import type { SessionUser } from "./http";
import type { AssignmentNotifier } from "./notify";
import { darfSehen } from "./sichtbarkeit";
import { type SpaceFassung, type SpacesRepo, istArchiviert, lesbareSpaces } from "./spaces";
import type { TeamsRepo } from "./teams";

// ================================================================================================
// ADMIN-09 · DIE FREIGABEREGEL IM BETRIEB — Prüfpunkt, Übersicht, Wirkungsvorschau, Fristlauf.
// ================================================================================================
//
// Die Regeln selbst stehen in `freigaberegeln.ts`. Hier werden sie auf den Bestand angewendet:
//
//   · PRÜFPUNKT (`tor`): an `rate`, `owner-validate` und `admin-validate` (ko-routes.ts) prüft der
//     Server — nicht die Oberfläche — Mehr-Augen-Prinzip, Prüferkreis und die geprüfte Fassung.
//   · ÜBERSICHT: berechtigte Prüfer, Schritte, fehlende Voraussetzungen und die laufenden Vorgänge
//     mit Zustand, Zustimmungen, Aufgaben und datierten Entscheidungen.
//   · VORSCHAU UND ÜBERNAHME: alte und neue Regel samt Wirkung auf laufende Vorgänge VOR der
//     Bestätigung; die Bestätigung ist an die gezeigte Vorschau gebunden (`grundlage`).
//   · FRISTLAUF: überfällige oder verwaiste Prüfaufgaben gehen an die Vertretung — wiederholbar,
//     ohne doppelte Aufgabe, ohne doppelte Meldung.
//
// SICHTBARKEIT: Titel eines Vorgangs nennt jede Antwort nur, wo `darfSehen` es dem Betrachter
// erlaubt; unsichtbare Vorgänge zählen nur mit. Die Verwaltungsrolle liest nicht automatisch jeden
// geschlossenen Inhalt (kein Admin-Durchgriff, `spaces.ts`).

export type FreigabeWeg = "rate" | "owner-validate" | "admin-validate";

/** Das Sichtbarkeitsurteil des Betrachters — von der Route gebildet (`darfSehen`). */
export type Sieht = (ko: KnowledgeObject) => boolean;

export interface RegelBezug {
  spaceId: string;
  version: number;
}

/** Was eine Entscheidung bewirkt hat — gelesen aus der Antwort des Validierungsdienstes. */
export interface Entscheidungsergebnis {
  status: string;
  validationDecisionRef: unknown;
}

export type TorUrteil =
  | {
      erlaubt: true;
      regel: RegelBezug | null;
      erwarteteFassung?: number;
      /** Nach einer wirksamen Entscheidung auf einem Ausnahmeweg: den Ausnahmebeleg schreiben. */
      nachEntscheidung?: (ergebnis: Entscheidungsergebnis) => Promise<void>;
    }
  | {
      erlaubt: false;
      status: 400 | 403 | 409;
      error: string;
      message: string;
      details?: Record<string, unknown>;
    };

export interface FreigabeRegelDienstDeps {
  spaces: SpacesRepo;
  teams?: TeamsRepo;
  auth: Pick<AuthService, "listUsers">;
  ko: KoService;
  validation: ValidationService;
  audit?: AuditService;
  notifyAssignment?: AssignmentNotifier;
  jetzt?: () => Date;
}

/** Die Regel am Prüfbrett — genug, um die geprüfte Fassung mitzuschicken und richtig zu zählen. */
export interface FreigabeAuskunft {
  spaceId: string;
  spaceName: string;
  regelVersion: number;
  zustimmungen: number;
  gruppe: boolean;
}

/** Eine Vertretung in Namen. */
export interface VertretungSicht {
  fuer: string;
  fuerName: string | null;
  durch: string;
  durchName: string | null;
}

/** Die Regel in Worten und Namen — für Übersicht, Vorschau und Verlauf. */
export interface RegelSicht {
  zustimmungen: number;
  fristTage: number | null;
  pruefer: { id: string; name: string | null }[];
  prueferTeams: { id: string; name: string | null; archiviert: boolean }[];
  vertretungen: VertretungSicht[];
}

export type Voraussetzung =
  | { art: "keine_regel" }
  | { art: "space_archiviert" }
  | { art: "zu_wenige_pruefer"; berechtigt: number; erforderlich: number }
  | { art: "pruefer_ohne_wirkung"; personen: { id: string; name: string; hindernis: string }[] }
  | ({ art: "vertretung_ohne_wirkung"; hindernis: string } & VertretungSicht)
  | { art: "team_archiviert"; team: string; name: string | null };

export type VorgangsLuecke =
  | { art: "zustimmungen_fehlen"; anzahl: number }
  | { art: "ablehnung_offen"; anzahl: number }
  | { art: "zu_wenige_unabhaengige_pruefer"; verfuegbar: number; erforderlich: number }
  | { art: "aufgabe_ueberfaellig"; person: string; name: string | null };

export interface Entscheidung {
  art: "zustimmung" | "rueckfrage" | "ablehnung" | "admin_kennzeichnung" | "eigentuemerfreigabe";
  person: string;
  name: string | null;
  am: string;
  /** Die geprüfte Fassung — `null`, wenn der Beleg sie nicht trägt (Altbestand). */
  fassung: number | null;
  aktuell: boolean;
  /** Ein Ausnahmeweg — keine Peer-Zustimmung, sondern eine Einzelentscheidung mit Beleg. */
  ausnahme: boolean;
  /** Die Person ist Autor oder Erstautor — nach Mehr-Augen-Prinzip unzulässig. */
  selbst: boolean;
}

export interface Pruefaufgabe {
  person: string;
  name: string | null;
  seit: string;
  faelligAm: string | null;
  ueberfaellig: boolean;
  aktiv: boolean;
  vertretungFuer: string | null;
  vertretungFuerName: string | null;
}

export interface Vorgang {
  id: string;
  title: string;
  version: number;
  status: string;
  zustand: Vorgangszustand;
  autor: { id: string; name: string | null };
  zustimmungen: {
    gruen: number;
    gelb: number;
    rot: number;
    veraltet: number;
    erforderlich: number;
  };
  veroeffentlichteFassung: number | null;
  aufgaben: Pruefaufgabe[];
  entscheidungen: Entscheidung[];
  luecken: VorgangsLuecke[];
}

const URTEIL_ART: Record<Verdict, Entscheidung["art"]> = {
  up: "zustimmung",
  warn: "rueckfrage",
  down: "ablehnung",
};

function fassungAus(e: AuditEntry): number | null {
  const v = e.payload.koVersion;
  return typeof v === "number" ? v : null;
}

function urteilsArt(e: AuditEntry): Entscheidung["art"] {
  const v = e.payload.verdict;
  return v === "up" || v === "warn" || v === "down" ? URTEIL_ART[v] : "rueckfrage";
}

export class FreigabeRegelDienst {
  constructor(private readonly deps: FreigabeRegelDienstDeps) {}

  private jetzt(): Date {
    return this.deps.jetzt?.() ?? new Date();
  }

  private async konten(): Promise<Konto[]> {
    return (await this.deps.auth.listUsers()).map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      approved: u.approved,
      ...(u.accessExpiresAt === undefined ? {} : { accessExpiresAt: u.accessExpiresAt }),
    }));
  }

  private async teamStaende(): Promise<TeamStand[]> {
    if (!this.deps.teams) {
      return [];
    }
    return (await this.deps.teams.aktuelle()).map((t) => ({
      id: t.id,
      name: t.name,
      mitglieder: t.mitglieder,
      archiviert: t.archiviert,
    }));
  }

  async aktuellerSpace(id: string): Promise<SpaceFassung | undefined> {
    return (await this.deps.spaces.fassungen(id)).at(-1);
  }

  /** Space und Regel eines Objekts — `undefined`, wenn sein führender Space keine Regel trägt. */
  async regelFuer(
    ko: Pick<KnowledgeObject, "spaceId">,
  ): Promise<{ space: SpaceFassung; regel: FreigabeRegel } | undefined> {
    if (typeof ko.spaceId !== "string") {
      return undefined;
    }
    const space = await this.aktuellerSpace(ko.spaceId);
    return space?.freigabe ? { space, regel: space.freigabe } : undefined;
  }

  /**
   * Für das Prüfbrett: je Objekt die Regel seines führenden Space — Kennung, Name, Regelfassung und
   * Mindestzahl. Objekte ohne Regel fehlen in der Karte.
   */
  async auskunftFuer(
    kos: readonly { id: string; spaceId?: string | undefined }[],
  ): Promise<Map<string, FreigabeAuskunft>> {
    const raus = new Map<string, FreigabeAuskunft>();
    const gesucht = new Set(kos.flatMap((k) => (typeof k.spaceId === "string" ? [k.spaceId] : [])));
    if (gesucht.size === 0) {
      return raus;
    }
    const mitRegel = (await this.deps.spaces.aktuelle()).filter(
      (s) => gesucht.has(s.id) && s.freigabe !== undefined,
    );
    for (const ko of kos) {
      const space = mitRegel.find((s) => s.id === ko.spaceId);
      if (space?.freigabe) {
        raus.set(ko.id, {
          spaceId: space.id,
          spaceName: space.name,
          regelVersion: space.version,
          zustimmungen: space.freigabe.zustimmungen,
          gruppe: hatPruefergruppe(space.freigabe),
        });
      }
    }
    return raus;
  }

  /** Die Mindestzahl der Regel auf einen laufenden Vorgang anwenden (nur anheben, mit Beleg). */
  private async anwendenAuf(
    ko: KnowledgeObject,
    space: SpaceFassung,
    regel: FreigabeRegel,
    akteur: string,
  ): Promise<boolean> {
    if (ko.status !== "offen" || ko.neededValidations >= regel.zustimmungen) {
      return false;
    }
    const nachher = await this.deps.ko.raiseNeededValidations(ko.id, regel.zustimmungen, akteur, {
      spaceId: space.id,
      version: space.version,
    });
    return nachher.neededValidations !== ko.neededValidations;
  }

  /** Für Spacewechsel und Bestandszuordnung: die Regel des neuen Space sofort anwenden. */
  async anwenden(koId: string, akteur: string): Promise<void> {
    const ko = await this.deps.ko.get(koId);
    const lage = ko ? await this.regelFuer(ko) : undefined;
    if (ko && lage) {
      await this.anwendenAuf(ko, lage.space, lage.regel, akteur);
    }
  }

  // ==============================================================================================
  // DER PRÜFPUNKT — serverseitig, vor jeder Entscheidung.
  // ==============================================================================================

  async tor(
    user: SessionUser,
    koId: string,
    weg: FreigabeWeg,
    eingabe: { verdict?: Verdict | undefined; expectedVersion?: unknown },
  ): Promise<TorUrteil> {
    let erwartet: number | undefined;
    if (eingabe.expectedVersion !== undefined) {
      const v = eingabe.expectedVersion;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
        return {
          erlaubt: false,
          status: 400,
          error: "VALIDATION",
          message: "expectedVersion muss eine Ganzzahl ab 1 sein (die geprüfte Fassung).",
        };
      }
      erwartet = v;
    }
    const fassung = erwartet === undefined ? {} : { erwarteteFassung: erwartet };
    const jetzt = this.jetzt().getTime();
    const ko = await this.deps.ko.get(koId);
    const lage = ko ? await this.regelFuer(ko) : undefined;
    if (!ko || !lage) {
      return { erlaubt: true, regel: null, ...fassung };
    }
    const { space, regel } = lage;
    if (istEigenerBeitrag(ko, user.id)) {
      return {
        erlaubt: false,
        status: 403,
        error: "SELBSTPRUEFUNG",
        message:
          "Den eigenen Beitrag prüft niemand selbst (Mehr-Augen-Prinzip) — auch kein Administrator. Eine andere berechtigte Person muss entscheiden.",
      };
    }
    // Ein ZUSTIMMENDER Weg nennt die Fassung, die geprüft wurde. Rückfrage und Ablehnung geben nichts
    // frei; nennen sie eine Fassung, gilt sie trotzdem.
    const freigebend = weg !== "rate" || eingabe.verdict === "up";
    if (freigebend && erwartet === undefined) {
      return {
        erlaubt: false,
        status: 400,
        error: "FASSUNG_FEHLT",
        message:
          "In diesem Space gilt eine Freigaberegel: eine Zustimmung nennt die geprüfte Fassung (expectedVersion). Es wurde nichts entschieden.",
      };
    }
    if (erwartet !== undefined && erwartet !== ko.version) {
      return {
        erlaubt: false,
        status: 409,
        error: "KO_STALE",
        message: `Der Beitrag wurde inzwischen überarbeitet (jetzt Fassung ${ko.version}, geprüft wurde Fassung ${erwartet}). Es wurde nichts entschieden; bitte die neue Fassung prüfen.`,
        details: { currentVersion: ko.version },
      };
    }
    const konten = await this.konten();
    const kreis = prueferkreis(space, regel, konten, await this.teamStaende(), jetzt);
    // Die Zuweisungen DIESES Vorgangs — dieselbe Aktivierungsbedingung (`entscheidet`) wie in der
    // Übersicht: eine Vertretung entscheidet erst, wenn sie eingesetzt ist.
    const zuweisungen = await this.deps.validation.zuweisungenZu([ko.id]);
    if (weg !== "admin-validate") {
      const urteil = entscheidungsurteil(ko, kreis, user.id, zuweisungen);
      if (!urteil.erlaubt) {
        return {
          erlaubt: false,
          status: 403,
          error: "NICHT_PRUEFBERECHTIGT",
          message:
            urteil.grund === "vertretung_ruht"
              ? "Als Vertretung prüfen Sie erst, wenn die Prüfaufgabe an Sie übergeben ist oder die vertretene Person nicht aktiv ist."
              : `Nach der Freigaberegel des Space „${space.name}“ gehören Sie nicht zu den berechtigten Prüfern dieses Beitrags.`,
        };
      }
    }
    await this.anwendenAuf(ko, space, regel, user.id);
    const bezug: RegelBezug = { spaceId: space.id, version: space.version };
    if (weg === "rate") {
      return { erlaubt: true, regel: bezug, ...fassung };
    }
    // Admin-Kennzeichnung und Eigentümerfreigabe sind EINZELENTSCHEIDUNGEN neben der Zustimmungszahl.
    // Sie bleiben die zulässigen, bestehenden Ausnahmewege — aber sichtbar: ein eigener Beleg nennt
    // Regel, Fassung und die Lage, in der sie getroffen wurden.
    const nachEntscheidung = async (ergebnis: Entscheidungsergebnis): Promise<void> => {
      if (ergebnis.status !== "validiert" || ergebnis.validationDecisionRef === null) {
        return;
      }
      const stand = await this.deps.validation.pruefstandFuer(ko.id, ko.version);
      await this.deps.audit?.record({
        actor: user.id,
        action: "freigaberegel.ausnahme",
        target: ko.id,
        payload: {
          weg,
          koVersion: ko.version,
          spaceId: space.id,
          regelVersion: space.version,
          zustimmungen: stand.votes.up,
          erforderlich: Math.max(ko.neededValidations, regel.zustimmungen),
          unabhaengigePruefer: unabhaengigePruefer(ko, kreis, zuweisungen),
        },
      });
    };
    return { erlaubt: true, regel: bezug, ...fassung, nachEntscheidung };
  }

  // ==============================================================================================
  // ÜBERSICHT
  // ==============================================================================================

  private regelSicht(
    regel: FreigabeRegel | undefined,
    konten: readonly Konto[],
    teams: readonly TeamStand[],
  ): RegelSicht | null {
    if (!regel) {
      return null;
    }
    const name = (id: string) => konten.find((k) => k.id === id)?.name ?? null;
    return {
      zustimmungen: regel.zustimmungen,
      fristTage: regel.fristTage,
      pruefer: regel.pruefer.map((id) => ({ id, name: name(id) })),
      prueferTeams: regel.prueferTeams.map((id) => {
        const t = teams.find((x) => x.id === id);
        return { id, name: t?.name ?? null, archiviert: t?.archiviert ?? false };
      }),
      vertretungen: regel.vertretungen.map((v) => ({
        fuer: v.fuer,
        fuerName: name(v.fuer),
        durch: v.durch,
        durchName: name(v.durch),
      })),
    };
  }

  private voraussetzungen(
    space: SpaceFassung,
    regel: FreigabeRegel | undefined,
    kreis: readonly PrueferEintrag[],
    erforderlich: number,
    konten: readonly Konto[],
    teams: readonly TeamStand[],
  ): Voraussetzung[] {
    const raus: Voraussetzung[] = [];
    if (!regel) {
      raus.push({ art: "keine_regel" });
    }
    if (istArchiviert(space)) {
      raus.push({ art: "space_archiviert" });
    }
    // Gezählt wird, wer JETZT entscheiden darf — eine Vertretung erst, wenn sie eingesetzt ist
    // (dieselbe Bedingung wie am Entscheidungstor). Bereitstehende Vertretungen nennt `pruefer`.
    const berechtigt = kreis.filter((p) => entscheidet(p)).length;
    if (berechtigt < erforderlich) {
      raus.push({ art: "zu_wenige_pruefer", berechtigt, erforderlich });
    }
    const ohneWirkung = kreis.filter(
      (p) => !p.berechtigt && (p.wege.includes("konto") || p.wege.includes("team")),
    );
    if (ohneWirkung.length > 0) {
      raus.push({
        art: "pruefer_ohne_wirkung",
        personen: ohneWirkung.map((p) => ({
          id: p.id,
          name: p.name,
          hindernis: p.hindernis ?? "",
        })),
      });
    }
    const name = (id: string) => konten.find((k) => k.id === id)?.name ?? null;
    for (const v of regel?.vertretungen ?? []) {
      const p = kreis.find((x) => x.id === v.durch);
      if (!p?.berechtigt) {
        raus.push({
          art: "vertretung_ohne_wirkung",
          fuer: v.fuer,
          fuerName: name(v.fuer),
          durch: v.durch,
          durchName: name(v.durch),
          hindernis: p?.hindernis ?? "inaktiv",
        });
      }
    }
    for (const id of regel?.prueferTeams ?? []) {
      const t = teams.find((x) => x.id === id);
      if (!t || t.archiviert) {
        raus.push({ art: "team_archiviert", team: id, name: t?.name ?? null });
      }
    }
    return raus;
  }

  /** Beginn einer offenen Zuweisung: ihr eigener Vermerk, sonst der letzte Zuweisungsbeleg. */
  private seitVon(
    a: Assignment,
    ko: KnowledgeObject,
    zuweisungsBelege: readonly AuditEntry[],
  ): string {
    if (a.seit) {
      return a.seit;
    }
    const belege = zuweisungsBelege.filter((e) => {
      const ids = e.payload.userIds;
      return e.target === ko.id && Array.isArray(ids) && ids.includes(a.userId);
    });
    return belege.at(-1)?.at ?? ko.createdAt;
  }

  private async belege(action: string, ids: ReadonlySet<string>): Promise<AuditEntry[]> {
    if (!this.deps.audit || ids.size === 0) {
      return [];
    }
    return (await this.deps.audit.list({ action }))
      .filter((e) => ids.has(e.target))
      .sort((a, b) => a.seq - b.seq);
  }

  private async artikelImSpace(space: SpaceFassung): Promise<KnowledgeObject[]> {
    return (await this.deps.ko.list({})).filter((k) => k.spaceId === space.id);
  }

  private async vorgaengeFuer(
    kos: readonly KnowledgeObject[],
    regel: FreigabeRegel | undefined,
    kreis: readonly PrueferEintrag[],
    konten: readonly Konto[],
    jetzt: number,
  ): Promise<Vorgang[]> {
    if (kos.length === 0) {
      return [];
    }
    const ids = new Set(kos.map((k) => k.id));
    const name = (id: string) => konten.find((k) => k.id === id)?.name ?? null;
    const [staende, zuweisungen, bewertet, admin, eigentuemer, zugewiesen] = await Promise.all([
      this.deps.validation.pruefstaendeFuer(kos.map((k) => ({ id: k.id, version: k.version }))),
      this.deps.validation.zuweisungenZu([...ids]),
      this.belege("ko.rated", ids),
      this.belege("ko.admin-validated", ids),
      this.belege("ko.owner-validated", ids),
      this.belege("ko.assigned", ids),
    ]);
    return kos.map((ko) => {
      const stand: KoPruefstand = staende.get(ko.id) ?? {
        assignments: [],
        votes: { up: 0, warn: 0, down: 0 },
        staleVotes: 0,
      };
      const erforderlich = wirksameZustimmungen(ko, regel);
      const aufgaben: Pruefaufgabe[] = zuweisungen
        .filter((a) => a.koId === ko.id && a.status === "open")
        .map((a) => {
          const seit = this.seitVon(a, ko, zugewiesen);
          const faellig = faelligAm(seit, regel?.fristTage ?? null);
          const konto = konten.find((k) => k.id === a.userId);
          return {
            person: a.userId,
            name: name(a.userId),
            seit,
            faelligAm: faellig,
            ueberfaellig: istUeberfaellig(faellig, jetzt),
            aktiv: konto ? istAktiv(konto, jetzt) : false,
            vertretungFuer: a.vertretungFuer ?? null,
            vertretungFuerName: a.vertretungFuer ? name(a.vertretungFuer) : null,
          };
        });
      const entscheidung = (
        e: AuditEntry,
        art: Entscheidung["art"],
        ausnahme: boolean,
      ): Entscheidung => {
        const fassung = fassungAus(e);
        return {
          art,
          person: e.actor,
          name: name(e.actor),
          am: e.at,
          fassung,
          aktuell: fassung === ko.version,
          ausnahme,
          selbst: istEigenerBeitrag(ko, e.actor),
        };
      };
      const zuDiesem = (e: AuditEntry) => e.target === ko.id;
      const entscheidungen = [
        ...bewertet.filter(zuDiesem).map((e) => entscheidung(e, urteilsArt(e), false)),
        ...admin.filter(zuDiesem).map((e) => entscheidung(e, "admin_kennzeichnung", true)),
        ...eigentuemer.filter(zuDiesem).map((e) => entscheidung(e, "eigentuemerfreigabe", true)),
      ].sort((a, b) => a.am.localeCompare(b.am));
      const luecken: VorgangsLuecke[] = [];
      if (ko.status === "offen") {
        const fehlen = Math.max(0, erforderlich - stand.votes.up);
        if (fehlen > 0) {
          luecken.push({ art: "zustimmungen_fehlen", anzahl: fehlen });
        }
        if (stand.votes.down > 0) {
          luecken.push({ art: "ablehnung_offen", anzahl: stand.votes.down });
        }
        // Mit den Zuweisungen DIESES Vorgangs: eine übergebene Vertretung zählt, eine ruhende nicht.
        const zuDiesemVorgang = zuweisungen.filter((a) => a.koId === ko.id);
        const verfuegbar = unabhaengigePruefer(ko, kreis, zuDiesemVorgang);
        if (verfuegbar < erforderlich) {
          luecken.push({ art: "zu_wenige_unabhaengige_pruefer", verfuegbar, erforderlich });
        }
        for (const a of aufgaben.filter((x) => x.ueberfaellig || !x.aktiv)) {
          luecken.push({ art: "aufgabe_ueberfaellig", person: a.person, name: a.name });
        }
      }
      const letzte = (ko.veroeffentlichungen ?? []).at(-1);
      return {
        id: ko.id,
        title: ko.title,
        version: ko.version,
        status: ko.status,
        zustand: vorgangszustand(ko, stand.votes),
        autor: { id: ko.author, name: name(ko.author) },
        zustimmungen: {
          gruen: stand.votes.up,
          gelb: stand.votes.warn,
          rot: stand.votes.down,
          veraltet: stand.staleVotes,
          erforderlich,
        },
        veroeffentlichteFassung: letzte ? letzte.fassung : null,
        aufgaben,
        entscheidungen,
        luecken,
      };
    });
  }

  async uebersicht(space: SpaceFassung, sieht: Sieht, darfAendern: boolean) {
    const jetzt = this.jetzt().getTime();
    const regel = space.freigabe;
    const [konten, teams, standard, alle, fassungen] = await Promise.all([
      this.konten(),
      this.teamStaende(),
      this.deps.validation.defaultNeededValidations(),
      this.artikelImSpace(space),
      this.deps.spaces.fassungen(space.id),
    ]);
    const kreis = prueferkreis(space, regel, konten, teams, jetzt);
    const erforderlich = regel?.zustimmungen ?? standard;
    const sichtbar = alle.filter(sieht);
    const name = (id: string) => konten.find((k) => k.id === id)?.name ?? null;
    // Der Verlauf der REGEL: jede Fassung, mit der sie sich geändert hat — prüfbar nach Reload.
    const verlauf: {
      version: number;
      am: string;
      von: string;
      vonName: string | null;
      begruendung: string | null;
      regel: RegelSicht | null;
    }[] = [];
    let bisher = JSON.stringify(null);
    for (const f of fassungen) {
      const stand = JSON.stringify(f.freigabe ?? null);
      if (stand !== bisher) {
        verlauf.push({
          version: f.version,
          am: f.geaendertAm,
          von: f.geaendertVon,
          vonName: name(f.geaendertVon),
          begruendung: f.vorgang === "freigaberegel" ? (f.begruendung ?? null) : null,
          regel: this.regelSicht(f.freigabe, konten, teams),
        });
        bisher = stand;
      }
    }
    return {
      space: {
        id: space.id,
        name: space.name,
        version: space.version,
        archiviert: istArchiviert(space),
        verantwortlich: space.verantwortlich,
        verantwortlichName: name(space.verantwortlich),
      },
      regel: this.regelSicht(regel, konten, teams),
      standardZustimmungen: standard,
      gruppe: hatPruefergruppe(regel) ? ("gruppe" as const) : ("alle" as const),
      schritte: [
        { art: "einreichen" },
        { art: "zustimmungen", anzahl: erforderlich },
        { art: "keine_ablehnung" },
        { art: "freigabe" },
        { art: "veroeffentlichen" },
      ],
      selbstpruefung: "ausgeschlossen" as const,
      ausnahmewege: [
        { art: "admin_kennzeichnung", recht: "users.manage" },
        { art: "eigentuemerfreigabe", recht: "ko.validate" },
      ],
      pruefer: kreis.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        wege: p.wege,
        teams: p.teams,
        vertritt: p.vertritt.map((id) => ({ id, name: name(id) })),
        aktiv: p.aktiv,
        berechtigt: p.berechtigt,
        hindernis: p.hindernis,
        // Getrennt sichtbar: `berechtigt` (Voraussetzungen erfüllt) und `entscheidet` (jetzt im
        // Space entscheidungsbefugt). Eine bereitstehende, noch nicht eingesetzte Vertretung ist
        // berechtigt, entscheidet aber nur an Vorgängen mit übergebener Aufgabe.
        entscheidet: entscheidet(p),
        bereitstehendeVertretung: p.berechtigt && !entscheidet(p),
      })),
      voraussetzungen: this.voraussetzungen(space, regel, kreis, erforderlich, konten, teams),
      vorgaenge: await this.vorgaengeFuer(sichtbar, regel, kreis, konten, jetzt),
      vorgaengeGesamt: alle.length,
      vorgaengeVerborgen: alle.length - sichtbar.length,
      verlauf,
      darfAendern,
      stand: new Date(jetzt).toISOString(),
    };
  }

  // ==============================================================================================
  // VORSCHAU UND ÜBERNAHME
  // ==============================================================================================

  async vorschau(space: SpaceFassung, neu: FreigabeRegel, sieht: Sieht) {
    const jetzt = this.jetzt().getTime();
    const alt = space.freigabe;
    const [konten, teams, alle] = await Promise.all([
      this.konten(),
      this.teamStaende(),
      this.artikelImSpace(space),
    ]);
    const kreisAlt = prueferkreis(space, alt, konten, teams, jetzt);
    const kreisNeu = prueferkreis(space, neu, konten, teams, jetzt);
    const offen = alle.filter((k) => k.status === "offen");
    const freigegeben = alle.filter((k) => k.status === "validiert");
    const [staende, zuweisungen] = await Promise.all([
      this.deps.validation.pruefstaendeFuer(offen.map((k) => ({ id: k.id, version: k.version }))),
      this.deps.validation.zuweisungenZu(offen.map((k) => k.id)),
    ]);
    const laufend = offen.map((ko) => {
      const stimmen = staende.get(ko.id)?.votes ?? { up: 0, warn: 0, down: 0 };
      return {
        ko,
        bisher: wirksameZustimmungen(ko, alt),
        danach: wirksameZustimmungen(ko, neu),
        gruen: stimmen.up,
        rot: stimmen.down,
      };
    });
    // Dieselbe Bedingung wie Tor und Übersicht: eine ruhende Vertretung wird nicht „neu prüfberechtigt".
    const berechtigteAlt = new Set(kreisAlt.filter((p) => entscheidet(p)).map((p) => p.id));
    const berechtigteNeu = new Set(kreisNeu.filter((p) => entscheidet(p)).map((p) => p.id));
    const name = (id: string) => konten.find((k) => k.id === id)?.name ?? null;
    const offeneAufgabenVon = (id: string): number =>
      zuweisungen.filter((a) => a.userId === id && a.status === "open").length;
    const aenderungen: RegelAenderung[] = regelAenderungen(alt, neu);
    const sichtbareLaufende = laufend.filter((l) => sieht(l.ko));
    const grundlage = grundlageVon({
      space: [space.id, space.version],
      alt: alt ?? null,
      neu,
      laufend: laufend.map((l) => [l.ko.id, l.ko.version, l.bisher, l.danach, l.gruen, l.rot]),
      freigegeben: freigegeben.map((k) => [k.id, k.version]),
      berechtigteAlt: [...berechtigteAlt].sort(),
      berechtigteNeu: [...berechtigteNeu].sort(),
    });
    const danach = this.voraussetzungen(space, neu, kreisNeu, neu.zustimmungen, konten, teams);
    return {
      spaceId: space.id,
      spaceVersion: space.version,
      alt: this.regelSicht(alt, konten, teams),
      neu: this.regelSicht(neu, konten, teams),
      aenderungen,
      laufend: {
        gesamt: laufend.length,
        angehoben: laufend.filter((l) => l.danach > l.bisher).length,
        gesenkt: laufend.filter((l) => l.danach < l.bisher).length,
        unveraendert: laufend.filter((l) => l.danach === l.bisher).length,
        eintraege: sichtbareLaufende.map((l) => ({
          id: l.ko.id,
          title: l.ko.title,
          version: l.ko.version,
          bisher: l.bisher,
          danach: l.danach,
          gruen: l.gruen,
          // Erreicht die Stimmenlage danach die Schwelle, wird trotzdem NICHTS freigegeben: erst die
          // nächste Entscheidung rechnet neu. Die Vorschau sagt es, damit es niemand erwartet.
          schwelleErreicht: l.gruen >= l.danach && l.rot === 0,
        })),
        verborgen: laufend.length - sichtbareLaufende.length,
      },
      freigegeben: {
        gesamt: freigegeben.length,
        verborgen: freigegeben.filter((k) => !sieht(k)).length,
      },
      pruefer: {
        neu: [...berechtigteNeu]
          .filter((id) => !berechtigteAlt.has(id))
          .map((id) => ({ id, name: name(id) })),
        entfaellt: [...berechtigteAlt]
          .filter((id) => !berechtigteNeu.has(id))
          .map((id) => ({ id, name: name(id), offeneAufgaben: offeneAufgabenVon(id) })),
        // Nach der neuen Regel nur bereitstehende Vertretungen: berechtigt, aber erst nach
        // Übergabe entscheidungsbefugt — getrennt genannt, nicht als stiller Wegfall.
        bereit: kreisNeu
          .filter((p) => p.berechtigt && !entscheidet(p))
          .map((p) => ({ id: p.id, name: p.name })),
      },
      voraussetzungenDanach: danach.filter((v) => v.art !== "keine_regel"),
      grundlage,
    };
  }

  /**
   * Die neue Regel als neue Space-Fassung — nur mit der Grundlage der gezeigten Vorschau. Danach gilt
   * sie für die laufenden Vorgänge dieses Space (Mindestzahl angehoben, mit Beleg je Vorgang);
   * erteilte Freigaben bleiben, wie sie sind.
   */
  async uebernehmen(
    space: SpaceFassung,
    neu: FreigabeRegel,
    user: SessionUser,
    sieht: Sieht,
    eingabe: { grundlage: string; begruendung: string | null },
  ): Promise<
    | { ok: true; fassung: SpaceFassung; angehoben: number }
    | { ok: false; grund: "veraltet" | "vorschau_veraltet" | "unveraendert"; vorschau?: unknown }
  > {
    const vorschau = await this.vorschau(space, neu, sieht);
    if (vorschau.aenderungen.length === 0) {
      return { ok: false, grund: "unveraendert" };
    }
    if (vorschau.grundlage !== eingabe.grundlage) {
      return { ok: false, grund: "vorschau_veraltet", vorschau };
    }
    const { begruendung: _alteBegruendung, ...ohne } = space;
    const fassung: SpaceFassung = {
      ...ohne,
      version: space.version + 1,
      geaendertVon: user.id,
      geaendertAm: this.jetzt().toISOString(),
      vorgang: "freigaberegel",
      freigabe: neu,
      ...(eingabe.begruendung ? { begruendung: eingabe.begruendung } : {}),
    };
    if (!(await this.deps.spaces.lege(fassung))) {
      return { ok: false, grund: "veraltet" };
    }
    await this.deps.audit?.record({
      actor: user.id,
      action: "space.freigaberegel-geaendert",
      target: space.id,
      payload: {
        vorherVersion: space.version,
        version: fassung.version,
        alt: space.freigabe ?? null,
        neu,
        aenderungen: vorschau.aenderungen,
        laufend: vorschau.laufend.gesamt,
        laufendAngehoben: vorschau.laufend.angehoben,
        freigegebenUnveraendert: vorschau.freigegeben.gesamt,
        ...(eingabe.begruendung ? { begruendung: eingabe.begruendung } : {}),
      },
    });
    let angehoben = 0;
    for (const ko of await this.artikelImSpace(fassung)) {
      if (await this.anwendenAuf(ko, fassung, neu, user.id)) {
        angehoben += 1;
      }
    }
    return { ok: true, fassung, angehoben };
  }

  // ==============================================================================================
  // FRISTLAUF — Frist und Vertretung führen zu sichtbaren Aufgaben, wiederholbar.
  // ==============================================================================================

  async fristlauf(space: SpaceFassung, user: SessionUser, sieht: Sieht) {
    const regel = space.freigabe;
    if (!regel) {
      return { regel: false, neu: [], bestehend: 0, faellig: [], ohneVertretung: [] };
    }
    const jetzt = this.jetzt().getTime();
    const [konten, teams, alle, alleSpaces] = await Promise.all([
      this.konten(),
      this.teamStaende(),
      this.artikelImSpace(space),
      this.deps.spaces.aktuelle(),
    ]);
    const kreis = prueferkreis(space, regel, konten, teams, jetzt);
    const offen = alle.filter((k) => k.status === "offen");
    const ids = new Set(offen.map((k) => k.id));
    const [zuweisungen, zugewiesen] = await Promise.all([
      this.deps.validation.zuweisungenZu([...ids]),
      this.belege("ko.assigned", ids),
    ]);
    const sitzungVon = (id: string): SessionUser | undefined => {
      const k = konten.find((x) => x.id === id);
      return k
        ? { id: k.id, role: k.role, spaceLesbar: lesbareSpaces(alleSpaces, k.id) }
        : undefined;
    };
    const kannVertreten = (ko: KnowledgeObject, durch: string): boolean => {
      const p = kreis.find((x) => x.id === durch);
      const sitzung = sitzungVon(durch);
      return (
        p?.berechtigt === true &&
        !istEigenerBeitrag(ko, durch) &&
        sitzung !== undefined &&
        darfSehen(sitzung, ko)
      );
    };
    const neu: { koId: string; durch: string; fuer: string; art: "neu" | "uebergeben" }[] = [];
    const faellig: { koId: string; person: string; grund: "ueberfaellig" | "inaktiv" }[] = [];
    const ohneVertretung: { koId: string; fuer: string }[] = [];
    let bestehend = 0;
    // Aufgaben, die dieser Lauf eben zur Vertretungsaufgabe gemacht hat — sie stehen in der vorab
    // gelesenen Liste noch als gewöhnliche Aufgabe und werden nicht ihrerseits weiterdelegiert.
    const uebergeben = new Set<string>();
    for (const ko of offen) {
      await this.anwendenAuf(ko, space, regel, user.id);
      for (const a of zuweisungen.filter((x) => x.koId === ko.id && x.status === "open")) {
        // Eine Vertretungsaufgabe wird nicht weiterdelegiert — sonst entstünde eine Kette.
        if (a.quelle === "vertretung" || uebergeben.has(`${ko.id}:${a.userId}`)) {
          continue;
        }
        const konto = konten.find((k) => k.id === a.userId);
        const aktiv = konto ? istAktiv(konto, jetzt) : false;
        const seit = this.seitVon(a, ko, zugewiesen);
        if (aktiv && !istUeberfaellig(faelligAm(seit, regel.fristTage), jetzt)) {
          continue;
        }
        faellig.push({ koId: ko.id, person: a.userId, grund: aktiv ? "ueberfaellig" : "inaktiv" });
        const geeignet = regel.vertretungen
          .filter((v) => v.fuer === a.userId && kannVertreten(ko, v.durch))
          .map((v) => v.durch);
        if (geeignet.length === 0) {
          ohneVertretung.push({ koId: ko.id, fuer: a.userId });
          continue;
        }
        for (const durch of geeignet) {
          const art = await this.deps.validation.vertretungZuweisen(
            ko.id,
            durch,
            a.userId,
            user.id,
          );
          if (art === "bestehend") {
            bestehend += 1;
          } else {
            neu.push({ koId: ko.id, durch, fuer: a.userId, art });
            uebergeben.add(`${ko.id}:${durch}`);
          }
          await this.benachrichtige(ko.id, durch);
        }
      }
    }
    if (neu.length > 0) {
      await this.deps.audit?.record({
        actor: user.id,
        action: "freigaberegel.fristlauf",
        target: space.id,
        payload: {
          regelVersion: space.version,
          neu,
          faellig: faellig.length,
          ohneVertretung: ohneVertretung.length,
        },
      });
    }
    const name = (id: string) => konten.find((k) => k.id === id)?.name ?? null;
    // Titel nur, wo der Ausführende sie sehen darf; sonst zählt der Eintrag nur mit.
    const titel = (koId: string): string | null => {
      const ko = offen.find((k) => k.id === koId);
      return ko && sieht(ko) ? ko.title : null;
    };
    return {
      regel: true,
      neu: neu.map((n) => ({
        ...n,
        title: titel(n.koId),
        durchName: name(n.durch),
        fuerName: name(n.fuer),
      })),
      bestehend,
      faellig: faellig.map((f) => ({ ...f, title: titel(f.koId), name: name(f.person) })),
      ohneVertretung: ohneVertretung.map((o) => ({
        ...o,
        title: titel(o.koId),
        fuerName: name(o.fuer),
      })),
    };
  }

  /**
   * Gemeldet wird nur, was noch aussteht — und nur von dem Lauf, der den Versand ÜBERNOMMEN hat
   * (`benachrichtigungUebernehmen`, ein Schritt der Ablage). Zwei gleichzeitige Fristläufe melden
   * so nicht doppelt; scheitert der Versand, steht die Meldung wieder aus.
   */
  private async benachrichtige(koId: string, person: string): Promise<void> {
    const melde = this.deps.notifyAssignment;
    if (!melde) {
      return;
    }
    if (!(await this.deps.validation.benachrichtigungUebernehmen(koId, person))) {
      return;
    }
    try {
      await melde(koId, [person]);
    } catch (fehler) {
      await this.deps.validation.benachrichtigungZuruecknehmen(koId, person);
      throw fehler;
    }
  }
}
