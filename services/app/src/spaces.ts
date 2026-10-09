import type { Pool } from "pg";
import type { Role } from "../../auth";
import { can } from "../../rbac";

// ================================================================================================
// SPACES — ARBEITSRÄUME MIT ZWECK, MITGLIEDERN, VERANTWORTLICHKEIT UND RECHTEN.
// ================================================================================================
//
// Auftrag `produkt:20261007:spaces`. Ein Space ist KEIN Ordner: er hat keine Unterordner und
// enthält keine Kopien. Ein Wissensobjekt nennt höchstens EINEN führenden Space (`spaceId` am
// Objekt); dieser bestimmt, wer das Objekt sehen darf. Tags und die gespeicherten Ansichten eines
// Space zeigen dasselbe Objekt (dieselbe Kennung, dieselbe Fassung) an weiteren Stellen — sie
// geben nie mehr Sicht, als der führende Space und die Vertraulichkeitsstufe erlauben.
//
// DIE RECHTEREGEL wird hier nur als DATUM erhoben (`lesbareSpaces`). Angewendet wird sie an der
// einen bestehenden Stelle `services/app/src/sichtbarkeit.ts` (`darfSehen` und SQL-Trim) — so gilt
// sie für Detailabruf, Liste, Suche, Vorschau, Anhänge und Klara gleich.
//
// ZWEI VERANTWORTUNGEN, BEWUSST GETRENNT:
//   · `verantwortlich` am Space — wer den Arbeitsraum führt (Zweck, Mitglieder, Zugang).
//   · `ownership.owner` am Wissensobjekt (`knowledge-object/src/ownership.ts`) — wer für den
//     einzelnen Inhalt geradesteht. Ein Spacewechsel ändert diese Angabe nicht.

export const SPACE_ZUGAENGE = ["alle", "mitglieder"] as const;
export type SpaceZugang = (typeof SPACE_ZUGAENGE)[number];

export const SPACE_RECHTE = ["lesen", "schreiben"] as const;
export type SpaceRecht = (typeof SPACE_RECHTE)[number];

export interface SpaceMitglied {
  nutzer: string;
  recht: SpaceRecht;
}

/**
 * produkt:20261009:admin-teams — ein Team als Mitgliedschaftsweg: jedes AKTIVE Mitglied des Teams
 * hat in diesem Space das genannte Recht. Gespeichert wird nur die Bindung, nie eine Kopie der
 * Mitglieder; wer im Team ist, steht allein am Team (`teams.ts`).
 */
export interface SpaceTeam {
  team: string;
  recht: SpaceRecht;
}

/**
 * Eine aus einem Team ABGELEITETE Mitgliedschaft — erhoben beim Lesen aus dem aktuellen Teamstand
 * (`teams.ts`, `TeamAufloesendeSpaces`), nie gespeichert. Ein archiviertes Team trägt keine bei.
 */
export interface SpaceTeamMitglied {
  nutzer: string;
  recht: SpaceRecht;
  team: string;
}

/** Eine gespeicherte Ansicht: alle für den Betrachter sichtbaren Objekte mit diesem Tag. */
export interface SpaceAnsicht {
  id: string;
  name: string;
  tag: string;
}

export interface SpaceEingabe {
  name: string;
  zweck: string;
  /** Spacezuständigkeit — eine Konto-Kennung. */
  verantwortlich: string;
  /** `alle`: jeder mit Leserecht sieht die Inhalte; `mitglieder`: nur Mitglieder und Zuständige. */
  zugang: SpaceZugang;
  mitglieder: SpaceMitglied[];
  ansichten: SpaceAnsicht[];
  /** Teams als Mitgliedschaftsweg. Fehlt in Fassungen von vor den Teams — dann gibt es keine. */
  teams?: SpaceTeam[];
  /** Abgeleitet aus `teams` und dem aktuellen Teamstand; nie Teil einer gespeicherten Fassung. */
  teamMitglieder?: SpaceTeamMitglied[];
}

/** Eine gespeicherte, unveränderliche Fassung eines Space. */
export interface SpaceFassung extends SpaceEingabe {
  id: string;
  version: number;
  angelegtVon: string;
  angelegtAm: string;
  geaendertVon: string;
  geaendertAm: string;
}

export const SPACE_GRENZEN = {
  name: 80,
  zweck: 1_000,
  mitglieder: 200,
  teams: 50,
  ansichten: 20,
  ansichtName: 80,
  tag: 80,
} as const;

export class SpaceFehler extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SpaceFehler";
  }
}

function text(wert: unknown): string {
  return typeof wert === "string" ? wert.normalize("NFC").replace(/\s+/g, " ").trim() : "";
}

function ansichtId(name: string, vergeben: ReadonlySet<string>): string {
  const basis =
    name
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "ansicht";
  let id = basis;
  for (let n = 2; vergeben.has(id); n += 1) {
    id = `${basis}-${n}`;
  }
  return id;
}

/**
 * Prüft eine Pflege-Eingabe und gibt sie bereinigt zurück — oder wirft `SpaceFehler`.
 *
 * `konten` ist die Menge der bestehenden Konto-Kennungen dieser Instanz: Zuständige und Mitglieder
 * müssen echte Konten sein, sonst verspräche der Space Rechte an niemanden. Eine doppelte
 * Mitgliedschaft wird zusammengefasst; das stärkere Recht gilt.
 *
 * `teams` sind die Teams, die dieser Space binden darf: die aktiven und die schon gebundenen
 * (ein archiviertes Team erzeugt keine NEUE Bindung, eine bestehende bleibt als Verlauf stehen).
 */
export function pruefeSpaceEingabe(
  roh: unknown,
  konten: ReadonlySet<string>,
  teams: ReadonlySet<string> = new Set(),
): SpaceEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new SpaceFehler("SPACE_UNGUELTIG", "Erwartet wird ein Space als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const name = text(r.name);
  const zweck = text(r.zweck);
  const verantwortlich = text(r.verantwortlich);
  if (!name || name.length > SPACE_GRENZEN.name) {
    throw new SpaceFehler("SPACE_UNGUELTIG", "Der Name fehlt oder ist zu lang.");
  }
  if (!zweck || zweck.length > SPACE_GRENZEN.zweck) {
    throw new SpaceFehler("SPACE_UNGUELTIG", "Der Zweck fehlt oder ist zu lang.");
  }
  if (!verantwortlich || !konten.has(verantwortlich)) {
    throw new SpaceFehler(
      "SPACE_UNGUELTIG",
      "Die Spacezuständigkeit fehlt oder nennt kein bestehendes Konto.",
    );
  }
  const zugang = r.zugang ?? "mitglieder";
  if (!SPACE_ZUGAENGE.includes(zugang as SpaceZugang)) {
    throw new SpaceFehler("SPACE_UNGUELTIG", "Der Zugang ist „alle“ oder „mitglieder“.");
  }
  const rohMitglieder = r.mitglieder ?? [];
  if (!Array.isArray(rohMitglieder) || rohMitglieder.length > SPACE_GRENZEN.mitglieder) {
    throw new SpaceFehler("SPACE_UNGUELTIG", "Die Mitglieder sind keine gültige Liste.");
  }
  const mitglieder: SpaceMitglied[] = [];
  for (const eintrag of rohMitglieder) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const nutzer = text(e.nutzer);
    const recht = e.recht ?? "lesen";
    if (!nutzer || !konten.has(nutzer)) {
      throw new SpaceFehler("SPACE_UNGUELTIG", "Ein Mitglied nennt kein bestehendes Konto.");
    }
    if (!SPACE_RECHTE.includes(recht as SpaceRecht)) {
      throw new SpaceFehler("SPACE_UNGUELTIG", "Ein Mitgliedsrecht ist „lesen“ oder „schreiben“.");
    }
    const vorhanden = mitglieder.find((m) => m.nutzer === nutzer);
    if (vorhanden) {
      if (recht === "schreiben") {
        vorhanden.recht = "schreiben";
      }
      continue;
    }
    mitglieder.push({ nutzer, recht: recht as SpaceRecht });
  }
  const rohTeams = r.teams ?? [];
  if (!Array.isArray(rohTeams) || rohTeams.length > SPACE_GRENZEN.teams) {
    throw new SpaceFehler("SPACE_UNGUELTIG", "Die Teams sind keine gültige Liste.");
  }
  const gebunden: SpaceTeam[] = [];
  for (const eintrag of rohTeams) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const team = text(e.team);
    const recht = e.recht ?? "lesen";
    if (!team || !teams.has(team)) {
      throw new SpaceFehler(
        "SPACE_UNGUELTIG",
        "Ein Team ist unbekannt oder archiviert und kann nicht neu gebunden werden.",
      );
    }
    if (!SPACE_RECHTE.includes(recht as SpaceRecht)) {
      throw new SpaceFehler("SPACE_UNGUELTIG", "Ein Teamrecht ist „lesen“ oder „schreiben“.");
    }
    const vorhanden = gebunden.find((t) => t.team === team);
    if (vorhanden) {
      if (recht === "schreiben") {
        vorhanden.recht = "schreiben";
      }
      continue;
    }
    gebunden.push({ team, recht: recht as SpaceRecht });
  }
  const rohAnsichten = r.ansichten ?? [];
  if (!Array.isArray(rohAnsichten) || rohAnsichten.length > SPACE_GRENZEN.ansichten) {
    throw new SpaceFehler("SPACE_UNGUELTIG", "Die Ansichten sind keine gültige Liste.");
  }
  const ansichten: SpaceAnsicht[] = [];
  const vergeben = new Set<string>();
  for (const eintrag of rohAnsichten) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const ansichtName = text(e.name);
    const tag = text(e.tag);
    if (!ansichtName || ansichtName.length > SPACE_GRENZEN.ansichtName) {
      throw new SpaceFehler("SPACE_UNGUELTIG", "Eine Ansicht braucht einen Namen.");
    }
    if (!tag || tag.length > SPACE_GRENZEN.tag) {
      throw new SpaceFehler("SPACE_UNGUELTIG", "Eine Ansicht braucht ein Tag.");
    }
    const gewuenscht = text(e.id);
    const id =
      gewuenscht && !vergeben.has(gewuenscht) && /^[\p{L}\p{N}-]{1,48}$/u.test(gewuenscht)
        ? gewuenscht
        : ansichtId(ansichtName, vergeben);
    vergeben.add(id);
    ansichten.push({ id, name: ansichtName, tag });
  }
  return {
    name,
    zweck,
    verantwortlich,
    zugang: zugang as SpaceZugang,
    mitglieder,
    ansichten,
    ...(gebunden.length > 0 ? { teams: gebunden } : {}),
  };
}

// ================================================================================================
// DIE RECHTE — EIN SPACE ENTSCHEIDET ÜBER SEINE INHALTE, NICHT DIE ROLLE ALLEIN.
// ================================================================================================

export interface SpaceNutzer {
  id: string;
  role: Role;
}

/** Direkt ODER über ein aktives Team Mitglied — beide Wege tragen dieselbe Wirkung. */
function istMitglied(space: SpaceEingabe, nutzerId: string): boolean {
  return (
    space.mitglieder.some((m) => m.nutzer === nutzerId) ||
    (space.teamMitglieder ?? []).some((m) => m.nutzer === nutzerId)
  );
}

/**
 * Darf dieser Mensch die INHALTE dieses Space lesen? Zugang `alle`, Mitgliedschaft oder
 * Zuständigkeit. Bewusst ohne Rollen-Ausnahme: die Administration verwaltet Spaces, liest aber
 * nicht automatisch jeden geschlossenen Inhalt (kein Admin-Bypass am Sichtbarkeitstrim, s.
 * `services/rbac/src/policy.ts`).
 */
export function darfSpaceInhalteLesen(space: SpaceEingabe, nutzerId: string): boolean {
  return (
    space.zugang === "alle" || space.verantwortlich === nutzerId || istMitglied(space, nutzerId)
  );
}

/** Die Kennungen aller Spaces, deren Inhalte dieser Mensch lesen darf — das Datum für den Trim. */
export function lesbareSpaces(spaces: readonly SpaceFassung[], nutzerId: string): Set<string> {
  return new Set(spaces.filter((s) => darfSpaceInhalteLesen(s, nutzerId)).map((s) => s.id));
}

/** Darf dieser Mensch Wissensobjekte in diesen Space legen oder aus ihm heraus verschieben? */
export function darfInSpaceSchreiben(space: SpaceEingabe, nutzer: SpaceNutzer): boolean {
  if (space.verantwortlich === nutzer.id) {
    return true;
  }
  if (space.mitglieder.some((m) => m.nutzer === nutzer.id && m.recht === "schreiben")) {
    return true;
  }
  if ((space.teamMitglieder ?? []).some((m) => m.nutzer === nutzer.id && m.recht === "schreiben")) {
    return true;
  }
  return space.zugang === "alle" && can(nutzer.role, "ko.create");
}

/**
 * produkt:20261009:admin-teams — WOHER ein Zugang kommt, je Weg getrennt: Spacezuständigkeit,
 * direkte Mitgliedschaft, jedes Team einzeln, offener Zugang. Die globale Rolle ist KEIN Weg zu
 * Inhalten (kein Admin-Durchgriff); sie wirkt nur im offenen Space über `ko.create` aufs Schreiben.
 */
export interface SpaceZugangsweg {
  art: "zustaendig" | "direkt" | "team" | "offen";
  recht: SpaceRecht;
  team?: string;
}

export function zugangswege(space: SpaceEingabe, nutzer: SpaceNutzer): SpaceZugangsweg[] {
  const wege: SpaceZugangsweg[] = [];
  if (space.verantwortlich === nutzer.id) {
    wege.push({ art: "zustaendig", recht: "schreiben" });
  }
  for (const m of space.mitglieder) {
    if (m.nutzer === nutzer.id) {
      wege.push({ art: "direkt", recht: m.recht });
    }
  }
  for (const m of space.teamMitglieder ?? []) {
    if (m.nutzer === nutzer.id) {
      wege.push({ art: "team", recht: m.recht, team: m.team });
    }
  }
  if (space.zugang === "alle") {
    wege.push({ art: "offen", recht: can(nutzer.role, "ko.create") ? "schreiben" : "lesen" });
  }
  return wege;
}

/** Zweck, Mitglieder, Zugang und Ansichten ändern: die Zuständigen oder die Kontoverwaltung. */
export function darfSpaceBearbeiten(space: SpaceEingabe, nutzer: SpaceNutzer): boolean {
  return space.verantwortlich === nutzer.id || can(nutzer.role, "users.manage");
}

/** Den Space selbst (Name, Zweck, Zuständigkeit) sehen: wer seine Inhalte liest oder ihn verwaltet. */
export function darfSpaceSehen(space: SpaceEingabe, nutzer: SpaceNutzer): boolean {
  return darfSpaceInhalteLesen(space, nutzer.id) || can(nutzer.role, "users.manage");
}

/** Das eigene Recht im Space, so wie es die Oberfläche und Klara benennen. */
export function eigenesSpaceRecht(
  space: SpaceEingabe,
  nutzer: SpaceNutzer,
): "zustaendig" | "schreiben" | "lesen" | "verwalten" | "keins" {
  if (space.verantwortlich === nutzer.id) {
    return "zustaendig";
  }
  if (darfInSpaceSchreiben(space, nutzer)) {
    return "schreiben";
  }
  if (darfSpaceInhalteLesen(space, nutzer.id)) {
    return "lesen";
  }
  return can(nutzer.role, "users.manage") ? "verwalten" : "keins";
}

// ================================================================================================
// DIE ABLAGE — JEDE ÄNDERUNG IST EINE NEUE, UNVERÄNDERLICHE FASSUNG.
// ================================================================================================

export interface SpacesRepo {
  /** Je Space die jüngste Fassung. */
  aktuelle(): Promise<SpaceFassung[]>;
  /** Alle Fassungen eines Space, aufsteigend nach Version — leer, wenn es ihn nicht gibt. */
  fassungen(id: string): Promise<SpaceFassung[]>;
  /** Legt eine neue Fassung ab. `false`, wenn es diese Version schon gibt (paralleler Schreiber). */
  lege(fassung: SpaceFassung): Promise<boolean>;
}

export class InMemorySpacesRepo implements SpacesRepo {
  private readonly zeilen = new Map<string, SpaceFassung[]>();

  aktuelle(): Promise<SpaceFassung[]> {
    const raus: SpaceFassung[] = [];
    for (const liste of this.zeilen.values()) {
      const letzte = liste[liste.length - 1];
      if (letzte) {
        raus.push(structuredClone(letzte));
      }
    }
    return Promise.resolve(raus);
  }

  fassungen(id: string): Promise<SpaceFassung[]> {
    return Promise.resolve((this.zeilen.get(id) ?? []).map((f) => structuredClone(f)));
  }

  lege(fassung: SpaceFassung): Promise<boolean> {
    const liste = this.zeilen.get(fassung.id) ?? [];
    if (liste.some((f) => f.version === fassung.version)) {
      return Promise.resolve(false);
    }
    liste.push(structuredClone(fassung));
    liste.sort((a, b) => a.version - b.version);
    this.zeilen.set(fassung.id, liste);
    return Promise.resolve(true);
  }
}

/**
 * Die Tabelle der Fassungen. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein
 * DROP, kein DELETE, kein UPDATE, kein Fremdschlüssel, kein Seed. Der zusammengesetzte
 * Primärschlüssel ist die Nebenläufigkeitsregel (zweiter Schreiber derselben Version → 409).
 */
export const SPACES_SCHEMA = `
CREATE TABLE IF NOT EXISTS spaces_fassungen (
  space_id text NOT NULL,
  version integer NOT NULL,
  data jsonb NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  PRIMARY KEY (space_id, version)
);
`;

interface FassungsZeile {
  data: SpaceFassung;
}

export class PgSpacesRepo implements SpacesRepo {
  constructor(private readonly pool: Pool) {}

  async aktuelle(): Promise<SpaceFassung[]> {
    const res = await this.pool.query<FassungsZeile>(
      `SELECT DISTINCT ON (space_id) data
         FROM spaces_fassungen
        ORDER BY space_id, version DESC`,
    );
    return res.rows.map((z) => z.data);
  }

  async fassungen(id: string): Promise<SpaceFassung[]> {
    const res = await this.pool.query<FassungsZeile>(
      "SELECT data FROM spaces_fassungen WHERE space_id=$1 ORDER BY version ASC",
      [id],
    );
    return res.rows.map((z) => z.data);
  }

  async lege(fassung: SpaceFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO spaces_fassungen(space_id, version, data, geaendert_von, geaendert_am)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (space_id, version) DO NOTHING`,
      [
        fassung.id,
        fassung.version,
        JSON.stringify(fassung),
        fassung.geaendertVon,
        fassung.geaendertAm,
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }
}
