import { createHash } from "node:crypto";
import type { Role } from "../../auth";
import type { KnowledgeObject } from "../../knowledge-object";
import { can } from "../../rbac";
import {
  type FreigabeRegel,
  type FreigabeVertretung,
  type SpaceFassung,
  SpaceFehler,
  darfSpaceInhalteLesen,
} from "./spaces";

// Die gespeicherte Form steht bei der Space-Fassung (`spaces.ts`); hier wird sie weitergereicht.
export type { FreigabeRegel, FreigabeVertretung } from "./spaces";

// ================================================================================================
// ADMIN-09 · FREIGABEREGELN UND PRÜFZUSTÄNDIGKEITEN JE SPACE (produkt:20261009:admin-freigaberegeln).
// ================================================================================================
//
// WAS DIESE DATEI IST. Die reinen Regeln: welche Einstellungen eine Freigaberegel zulässt, wer nach
// ihr prüfen darf, wann eine Entscheidung eine unzulässige Selbstprüfung wäre, in welchem Zustand
// ein Vorgang steht und wann eine Prüfaufgabe überfällig ist. Kein Zustand, kein Schreibweg — die
// Anwendung steht in `freigaberegel-dienst.ts`, die Routen in `routes/freigaberegeln-routes.ts`.
//
// WAS SIE NICHT IST. Keine neue Validierungsformel: ob ein Vorgang freigegeben ist, entscheidet
// weiter `computeOutcome` (services/validation/src/trust.ts) über die grünen Stimmen der AKTUELLEN
// Fassung und keine rote. Die Regel liefert ihr nur zwei bestehende Grössen zu: WER bewerten darf
// und WIE VIELE Zustimmungen nötig sind (das bestehende Band 1–5, FR-CAP-08).
//
// DIE BESTEHENDEN FACHREGELN, die hier angewendet und nicht neu erfunden werden:
//   · Mehr-Augen-Prinzip — „Nur den eigenen Beitrag prüft niemand selbst", auch ein Admin nicht
//     (Hilfe `faq.pruefen.3`/`faq.pruefen.8`, `apps/web/src/lib/faqContent.ts`). Eigener Beitrag
//     heisst: Autor oder Erstautor des Objekts.
//   · Fehlen unabhängige Prüfer, bleibt der Beitrag „in Prüfung"; der dokumentierte Sonderweg ist
//     die Admin-Kennzeichnung, die im Protokoll sichtbar bleibt (`faq.pruefen.9`, `adminValidate`).
//   · Prüfen dürfen Konten mit `ko.validate`, die den Inhalt sehen dürfen (Spacezugang).
//   · Entwurf, fachliche Freigabe und Veröffentlichung sind getrennte Vorgänge
//     (`services/app/src/veroeffentlichung.ts`, `apps/web/src/lib/statusFreigabe.ts`).

export const FREIGABE_GRENZEN = {
  zustimmungenMin: 1,
  zustimmungenMax: 5,
  fristMin: 1,
  fristMax: 90,
  pruefer: 200,
  teams: 50,
  vertretungen: 100,
} as const;

const TAG_MS = 24 * 60 * 60 * 1000;

function fehler(meldung: string): SpaceFehler {
  return new SpaceFehler("FREIGABEREGEL_UNGUELTIG", meldung);
}

function kennungen(roh: unknown, erlaubt: ReadonlySet<string>, grenze: number, was: string) {
  if (roh === undefined || roh === null) {
    return [];
  }
  if (!Array.isArray(roh) || roh.length > grenze) {
    throw fehler(`${was} sind keine gültige Liste.`);
  }
  const raus: string[] = [];
  for (const eintrag of roh) {
    const id = typeof eintrag === "string" ? eintrag.trim() : "";
    if (!id || !erlaubt.has(id)) {
      throw fehler(`${was}: ein Eintrag nennt nichts Bestehendes.`);
    }
    if (!raus.includes(id)) {
      raus.push(id);
    }
  }
  return raus;
}

/**
 * Prüft eine Freigaberegel und gibt sie bereinigt zurück — oder wirft `SpaceFehler`.
 * `konten`: bestehende Konto-Kennungen; `teams`: Teams, die diese Regel nennen darf (aktive und
 * schon genannte).
 */
export function pruefeFreigabeRegel(
  roh: unknown,
  konten: ReadonlySet<string>,
  teams: ReadonlySet<string>,
): FreigabeRegel {
  if (typeof roh !== "object" || roh === null) {
    throw fehler("Erwartet wird eine Freigaberegel als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const zustimmungen = r.zustimmungen;
  if (
    typeof zustimmungen !== "number" ||
    !Number.isInteger(zustimmungen) ||
    zustimmungen < FREIGABE_GRENZEN.zustimmungenMin ||
    zustimmungen > FREIGABE_GRENZEN.zustimmungenMax
  ) {
    throw fehler(
      `Die erforderlichen Zustimmungen sind eine ganze Zahl von ${FREIGABE_GRENZEN.zustimmungenMin} bis ${FREIGABE_GRENZEN.zustimmungenMax}.`,
    );
  }
  let fristTage: number | null = null;
  if (r.fristTage !== undefined && r.fristTage !== null) {
    const f = r.fristTage;
    if (
      typeof f !== "number" ||
      !Number.isInteger(f) ||
      f < FREIGABE_GRENZEN.fristMin ||
      f > FREIGABE_GRENZEN.fristMax
    ) {
      throw fehler(
        `Die Frist ist leer oder eine ganze Zahl von ${FREIGABE_GRENZEN.fristMin} bis ${FREIGABE_GRENZEN.fristMax} Tagen.`,
      );
    }
    fristTage = f;
  }
  const rohVertretungen = r.vertretungen ?? [];
  if (!Array.isArray(rohVertretungen) || rohVertretungen.length > FREIGABE_GRENZEN.vertretungen) {
    throw fehler("Die Vertretungen sind keine gültige Liste.");
  }
  const vertretungen: FreigabeVertretung[] = [];
  for (const eintrag of rohVertretungen) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const fuer = typeof e.fuer === "string" ? e.fuer.trim() : "";
    const durch = typeof e.durch === "string" ? e.durch.trim() : "";
    if (!fuer || !durch || !konten.has(fuer) || !konten.has(durch)) {
      throw fehler("Eine Vertretung nennt kein bestehendes Konto.");
    }
    if (fuer === durch) {
      throw fehler("Niemand vertritt sich selbst.");
    }
    if (!vertretungen.some((v) => v.fuer === fuer && v.durch === durch)) {
      vertretungen.push({ fuer, durch });
    }
  }
  return {
    zustimmungen,
    pruefer: kennungen(r.pruefer, konten, FREIGABE_GRENZEN.pruefer, "Die Prüfer"),
    prueferTeams: kennungen(r.prueferTeams, teams, FREIGABE_GRENZEN.teams, "Die Prüferteams"),
    fristTage,
    vertretungen,
  };
}

/** Hat die Regel eine eigene Prüfergruppe? Ohne sie prüft jede Person mit Prüfrecht und Zugang. */
export function hatPruefergruppe(regel: FreigabeRegel | undefined): boolean {
  return regel !== undefined && (regel.pruefer.length > 0 || regel.prueferTeams.length > 0);
}

// ------------------------------------------------------------------------------------------------
// WER PRÜFEN DARF
// ------------------------------------------------------------------------------------------------

export interface Konto {
  id: string;
  name: string;
  role: Role;
  approved: boolean;
  accessExpiresAt?: string;
}

export interface TeamStand {
  id: string;
  name: string;
  mitglieder: readonly string[];
  archiviert: boolean;
}

/**
 * Aktiv ist ein Konto, das freigegeben ist und dessen Zugang nicht abgelaufen ist. Ein unlesbares
 * Ablaufdatum zählt NICHT als aktiv — eine Prüferin, deren Zugang niemand bestätigen kann, ist keine
 * verfügbare Prüferin.
 */
export function istAktiv(k: Pick<Konto, "approved" | "accessExpiresAt">, jetztMs: number): boolean {
  if (!k.approved) {
    return false;
  }
  if (k.accessExpiresAt === undefined) {
    return true;
  }
  const ende = Date.parse(k.accessExpiresAt);
  return Number.isFinite(ende) && ende > jetztMs;
}

export type PrueferWeg = "alle" | "konto" | "team" | "vertretung";
export type PrueferHindernis = "inaktiv" | "ohne_pruefrecht" | "ohne_spacezugang";

export interface PrueferEintrag {
  id: string;
  name: string;
  role: string;
  wege: PrueferWeg[];
  /** Die Teams, über die die Person zur Gruppe gehört. */
  teams: { id: string; name: string }[];
  /** Wen sie vertritt. */
  vertritt: string[];
  aktiv: boolean;
  berechtigt: boolean;
  /** Warum sie trotz Nennung nicht prüfen kann — `null`, wenn sie es kann. */
  hindernis: PrueferHindernis | null;
}

/**
 * Der Prüferkreis eines Space nach seiner Regel. Ohne Prüfergruppe: jede Person mit `ko.validate`.
 * Mit Gruppe: genau die genannten Konten, die aktiven Mitglieder der genannten Teams und die
 * Vertretungen. Berechtigt ist, wer aktiv ist, das Prüfrecht hat und die Inhalte des Space lesen
 * darf — eine Nennung in der Regel verleiht keines davon.
 */
export function prueferkreis(
  space: SpaceFassung,
  regel: FreigabeRegel | undefined,
  konten: readonly Konto[],
  teams: readonly TeamStand[],
  jetztMs: number,
): PrueferEintrag[] {
  const eintraege = new Map<string, PrueferEintrag>();
  const eintrag = (k: Konto): PrueferEintrag => {
    let e = eintraege.get(k.id);
    if (!e) {
      const aktiv = istAktiv(k, jetztMs);
      const pruefrecht = can(k.role, "ko.validate");
      const zugang = darfSpaceInhalteLesen(space, k.id);
      e = {
        id: k.id,
        name: k.name,
        role: k.role,
        wege: [],
        teams: [],
        vertritt: [],
        aktiv,
        berechtigt: aktiv && pruefrecht && zugang,
        hindernis: !aktiv
          ? "inaktiv"
          : !pruefrecht
            ? "ohne_pruefrecht"
            : !zugang
              ? "ohne_spacezugang"
              : null,
      };
      eintraege.set(k.id, e);
    }
    return e;
  };
  const kontoVon = new Map(konten.map((k) => [k.id, k]));
  if (!hatPruefergruppe(regel)) {
    for (const k of konten) {
      if (can(k.role, "ko.validate")) {
        eintrag(k).wege.push("alle");
      }
    }
  } else if (regel) {
    for (const id of regel.pruefer) {
      const k = kontoVon.get(id);
      if (k) {
        eintrag(k).wege.push("konto");
      }
    }
    for (const teamId of regel.prueferTeams) {
      const team = teams.find((t) => t.id === teamId);
      if (!team || team.archiviert) {
        continue;
      }
      for (const mitglied of team.mitglieder) {
        const k = kontoVon.get(mitglied);
        if (k) {
          const e = eintrag(k);
          if (!e.wege.includes("team")) {
            e.wege.push("team");
          }
          e.teams.push({ id: team.id, name: team.name });
        }
      }
    }
  }
  for (const v of regel?.vertretungen ?? []) {
    const k = kontoVon.get(v.durch);
    if (k) {
      const e = eintrag(k);
      if (!e.wege.includes("vertretung")) {
        e.wege.push("vertretung");
      }
      e.vertritt.push(v.fuer);
    }
  }
  return [...eintraege.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

/** Eigener Beitrag: Autor oder Erstautor. Ihn prüft niemand selbst (Mehr-Augen-Prinzip). */
export function istEigenerBeitrag(
  ko: Pick<KnowledgeObject, "author" | "originalAuthor">,
  nutzerId: string,
): boolean {
  return ko.author === nutzerId || ko.originalAuthor === nutzerId;
}

export type Entscheidungsurteil =
  | { erlaubt: true }
  | { erlaubt: false; grund: "selbstpruefung" | "nicht_berechtigt" };

/** Darf diese Person über diesen Vorgang entscheiden — nach Mehr-Augen-Prinzip und Prüferkreis? */
export function entscheidungsurteil(
  ko: Pick<KnowledgeObject, "author" | "originalAuthor">,
  kreis: readonly PrueferEintrag[],
  nutzerId: string,
): Entscheidungsurteil {
  if (istEigenerBeitrag(ko, nutzerId)) {
    return { erlaubt: false, grund: "selbstpruefung" };
  }
  return kreis.some((p) => p.id === nutzerId && p.berechtigt)
    ? { erlaubt: true }
    : { erlaubt: false, grund: "nicht_berechtigt" };
}

/** Die Zahl der berechtigten Prüfer, die über DIESEN Vorgang unabhängig entscheiden können. */
export function unabhaengigePruefer(
  ko: Pick<KnowledgeObject, "author" | "originalAuthor">,
  kreis: readonly PrueferEintrag[],
): number {
  return kreis.filter((p) => p.berechtigt && !istEigenerBeitrag(ko, p.id)).length;
}

/**
 * Die wirksam erforderlichen Zustimmungen. Ein laufender Vorgang braucht mindestens, was die Regel
 * verlangt; eine erteilte Freigabe behält die Zahl, unter der sie erteilt wurde.
 */
export function wirksameZustimmungen(
  ko: Pick<KnowledgeObject, "status" | "neededValidations">,
  regel: FreigabeRegel | undefined,
): number {
  return regel && ko.status === "offen"
    ? Math.max(ko.neededValidations, regel.zustimmungen)
    : ko.neededValidations;
}

// ------------------------------------------------------------------------------------------------
// DER ZUSTAND EINES VORGANGS — aus vorhandenen fachlichen Zuständen abgeleitet.
// ------------------------------------------------------------------------------------------------

/**
 * `entwurf` steht in der Aufzählung, wird aus einem Wissensobjekt aber nie abgeleitet: ein Entwurf
 * ist noch kein Wissensobjekt und gehört noch keinem Space (`display-status.ts`, JOB 3024).
 */
export type Vorgangszustand =
  | "entwurf"
  | "eingereicht"
  | "korrektur_noetig"
  | "freigegeben"
  | "veroeffentlicht";

export function vorgangszustand(
  ko: Pick<KnowledgeObject, "status" | "version" | "veroeffentlichungen">,
  stimmen: { warn: number; down: number },
): Vorgangszustand {
  if (ko.status === "validiert") {
    const letzte = (ko.veroeffentlichungen ?? []).at(-1);
    return letzte !== undefined && letzte.fassung === ko.version
      ? "veroeffentlicht"
      : "freigegeben";
  }
  return stimmen.warn + stimmen.down > 0 ? "korrektur_noetig" : "eingereicht";
}

// ------------------------------------------------------------------------------------------------
// FRIST
// ------------------------------------------------------------------------------------------------

/** Fällig am — `null`, wenn die Regel keine Frist kennt oder der Beginn unlesbar ist. */
export function faelligAm(seit: string, fristTage: number | null): string | null {
  const beginn = Date.parse(seit);
  if (fristTage === null || !Number.isFinite(beginn)) {
    return null;
  }
  return new Date(beginn + fristTage * TAG_MS).toISOString();
}

export function istUeberfaellig(faellig: string | null, jetztMs: number): boolean {
  return faellig !== null && Date.parse(faellig) <= jetztMs;
}

// ------------------------------------------------------------------------------------------------
// VERGLEICH UND GRUNDLAGE
// ------------------------------------------------------------------------------------------------

export type RegelAenderung = "neu" | "zustimmungen" | "pruefer" | "teams" | "frist" | "vertretung";

function gleicheMenge(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function vertretungsSchluessel(v: readonly FreigabeVertretung[]): string[] {
  return v.map((x) => `${x.fuer}>${x.durch}`);
}

/** Was sich zwischen zwei Regeln ändert — leer: nichts. */
export function regelAenderungen(
  alt: FreigabeRegel | undefined,
  neu: FreigabeRegel,
): RegelAenderung[] {
  if (!alt) {
    return ["neu"];
  }
  const raus: RegelAenderung[] = [];
  if (alt.zustimmungen !== neu.zustimmungen) {
    raus.push("zustimmungen");
  }
  if (!gleicheMenge(alt.pruefer, neu.pruefer)) {
    raus.push("pruefer");
  }
  if (!gleicheMenge(alt.prueferTeams, neu.prueferTeams)) {
    raus.push("teams");
  }
  if (alt.fristTage !== neu.fristTage) {
    raus.push("frist");
  }
  if (
    !gleicheMenge(vertretungsSchluessel(alt.vertretungen), vertretungsSchluessel(neu.vertretungen))
  ) {
    raus.push("vertretung");
  }
  return raus;
}

/** Ein kurzer, stabiler Fingerabdruck einer Lage — bindet eine Bestätigung an die gezeigte Vorschau. */
export function grundlageVon(lage: unknown): string {
  return createHash("sha256").update(JSON.stringify(lage)).digest("hex").slice(0, 32);
}
