import type { AuditEntry, AuditFilter } from "../../audit";
import type { KnowledgeObject, KoVersionSnapshot } from "../../knowledge-object";
import type { KenntnisnahmeRepo } from "./kenntnisnahme";

// ================================================================================================
// WISSENSAUSKUNFT ZUM ZEITPUNKT — „Wer hat was gewusst und wann" (R-1644, Roadmap 6.2).
// ================================================================================================
//
// DIE FRAGE. War ein bestimmter Eintrag zu einem bestimmten Zeitpunkt im System verfügbar — in
// welcher Fassung — und wer hatte bis dahin nachweislich mit ihm zu tun?
//
// NUR VORHANDENE BELEGE, KEINE NEUE ERFASSUNG. Die Auskunft liest drei Ablagen, die es schon gibt:
//   · die unveränderlichen Fassungsstände (`ko_versions`, je Fassung Zeitpunkt und Verfasser),
//   · das append-only Audit-Protokoll mit dem Eintrag als Ziel (wer hat wann was getan),
//   · die Kenntnisnahmen (angefordert, ausdrücklich bestätigt — je Fassung).
// Sie schreibt nichts und legt kein Leseprotokoll an. Das bloße Öffnen eines Eintrags wird im
// Produkt bewusst nicht mitgeschrieben (Zweckbindung des Audits: Nachvollziehbarkeit, keine
// Leistungs- oder Verhaltenskontrolle — `docs/operations/monitoring-logging.md`). Deshalb heißt
// „kein Beleg" hier nie „hat es nicht gesehen"; die Antwort nennt diese Grenze ausdrücklich mit.
//
// DER PRÜFSTATUS ZUM ZEITPUNKT IST NICHT GESPEICHERT. Ein Prüfentscheid setzt den Status, ohne eine
// neue Fassung anzulegen; der Status im Fassungsstand ist deshalb der beim Schreiben der Fassung.
// Die Auskunft behauptet ihn nicht, sondern nennt die belegte Freigabe (`ko.admin-validated`) der
// Fassung und die einzelnen Bewertungen als Belege der jeweiligen Person.

/** Was zu einer Person belegt ist. */
export type Belegart =
  | "angelegt"
  | "ueberarbeitet"
  | "vorgeschlagen"
  | "kommentiert"
  | "geprueft"
  | "freigegeben"
  | "antwortquelle"
  | "kenntnisnahme_verteilt"
  | "kenntnisnahme_angefordert"
  | "kenntnisnahme_bestaetigt"
  | "sonstige_bearbeitung";

/** Was diese Auskunft grundsätzlich nicht belegen kann — fester Bestandteil jeder Antwort. */
export const NICHT_ERFASST = ["oeffnen", "pruefstatus", "antwortquellen"] as const;

export interface Kenntnisbeleg {
  art: Belegart;
  /** ISO-Zeitpunkt des Belegs. */
  am: string;
  /**
   * Die Fassung, auf die sich der Beleg bezieht — NUR aus einer ausdrücklichen Angabe des Belegs
   * selbst (`fassungAus`). `null`: der Beleg nennt keine; sie wird nicht aus dem Zeitpunkt geraten.
   */
  fassung: number | null;
  /** Die Audit-Sequenz des Belegs — `null` bei Belegen aus der Kenntnisnahme. */
  seq: number | null;
  /**
   * Bis zum Zeitpunkt durch `ko.change-rolled-back` ausdrücklich zurückgenommen: der Vorgang ist
   * belegt versucht worden, aber nicht wirksam geblieben. Er zählt weder als Freigabe noch als
   * Papierkorbwechsel.
   */
  zurueckgenommen: boolean;
}

export interface Person {
  id: string;
  name: string;
}

export interface PersonMitBelegen extends Person {
  belege: Kenntnisbeleg[];
}

export interface Wissensauskunft {
  koId: string;
  zeitpunkt: string;
  /** Gab es den Eintrag zum Zeitpunkt schon? */
  vorhanden: boolean;
  /** Lag er zum Zeitpunkt im Papierkorb (letzter Beleg bis dahin: gelöscht)? */
  imPapierkorb: boolean;
  /** Die zum Zeitpunkt geltende Fassung — `null`, wenn keine Fassung bis dahin gespeichert war. */
  fassung: {
    version: number;
    seit: string;
    von: Person;
    titel: string;
    aussage: string;
  } | null;
  /** Die bis zum Zeitpunkt belegte Freigabe genau dieser Fassung — `null`: keine belegt. */
  freigabe: { am: string; von: Person } | null;
  /** Die heutige Fassung — damit sichtbar ist, ob sich seitdem etwas geändert hat. */
  aktuelleFassung: number;
  /** Personen mit mindestens einem Beleg bis zum Zeitpunkt, nach ihrem ersten Beleg geordnet. */
  personen: PersonMitBelegen[];
  nichtErfasst: typeof NICHT_ERFASST;
}

export interface WissensauskunftEingabe {
  ko: Pick<KnowledgeObject, "id" | "version">;
  zeitpunkt: number;
  versionen: readonly KoVersionSnapshot[];
  /** Die Audit-Einträge mit dem Eintrag als Ziel. */
  audit: readonly AuditEntry[];
  kenntnisnahmen: ReadonlyArray<{
    anforderung: { fassung: number; angefordertVon: string; angefordertAm: string };
    empfaenger: ReadonlyArray<{ empfaengerId: string; bestaetigtAm: string | null }>;
  }>;
  namen: ReadonlyMap<string, string>;
}

/** Audit-Aktionen mit eigener Belegart. Alle übrigen `ko.*` zählen als sonstige Bearbeitung. */
const ART_JE_AKTION: Readonly<Record<string, Belegart>> = {
  "ko.created": "angelegt",
  "ko.revised": "ueberarbeitet",
  "ko.document-appended": "ueberarbeitet",
  "ko.proposed": "vorgeschlagen",
  "ko.commented": "kommentiert",
  "ko.rated": "geprueft",
  "ko.revalidated": "geprueft",
  "ko.admin-validated": "freigegeben",
  "ask.query": "antwortquelle",
};

/**
 * Belege, die kein eigener Kontakt sind: technische Belege eines gescheiterten oder
 * zurückgenommenen Schritts, und die Fortschreibung von Prüfer-/Validiererrollen — sie ist die
 * Spur einer Zuweisung oder Freigabe, die selbst schon als Beleg zählt
 * (`KoService.recordOwnershipRole`).
 */
function istTechnisch(action: string): boolean {
  if (action === "ko.ownership-role") {
    return true;
  }
  return action.endsWith("-failed") || action.endsWith("rolled-back");
}

function belegartAus(e: AuditEntry): Belegart | null {
  if (e.actor === "" || e.actor === "system" || istTechnisch(e.action)) {
    return null;
  }
  const art = ART_JE_AKTION[e.action];
  if (art === "antwortquelle") {
    // `ask.query` trägt als Ziel die erste Quelle der Antwort; nur eine gegebene Antwort hat sie
    // der fragenden Person tatsächlich ausgeliefert.
    return e.payload.answered === true ? art : null;
  }
  if (art) {
    return art;
  }
  return e.action.startsWith("ko.") ? "sonstige_bearbeitung" : null;
}

const zahl = (wert: unknown): number | null =>
  typeof wert === "number" && Number.isInteger(wert) && wert > 0 ? wert : null;

/**
 * Die Fassung eines Audit-Belegs — je Ereignisart aus dem Feld, das der Schreibweg dafür setzt:
 *   · `ko.created`                      Fassung 1 — die Anlage IST die erste Fassung,
 *   · `ko.revised`, `ko.document-appended`   `version` (die neu geschriebene Fassung),
 *   · `ko.proposed`                     `baseVersion` (die Fassung, auf der der Vorschlag beruht),
 *   · `ko.rated`, `ko.admin-validated`  `koVersion` (die geprüfte Fassung),
 *   · `ask.query`                       KEINE: der Beleg nennt nur die erste Quelle, nicht deren
 *                                       Fassung, und ist mit dem Antwortbeleg (der die Fassung
 *                                       hält) nicht verknüpft. Die Fassung zum Zeitpunkt wäre
 *                                       geraten — während einer laufenden Antwort kann schon die
 *                                       nächste gespeichert sein.
 *   · `ko.merged-into`                  `eigeneVersion` — `version` ist dort die Fassung des
 *                                       ZIELartikels (`KoService`, Aufgehen in einem anderen
 *                                       Eintrag), nicht die des abgefragten.
 *   · übrige                            `koVersion`, sonst `version`, sonst keine.
 * Ohne ausdrückliche Angabe gibt es `null`; die Fassung wird nie aus dem Zeitpunkt abgeleitet.
 */
function fassungAus(e: AuditEntry): number | null {
  switch (e.action) {
    case "ko.created":
      return 1;
    case "ko.revised":
    case "ko.document-appended":
      return zahl(e.payload.version);
    case "ko.proposed":
      return zahl(e.payload.baseVersion);
    case "ko.rated":
    case "ko.admin-validated":
      return zahl(e.payload.koVersion);
    case "ask.query":
      return null;
    case "ko.merged-into":
      return zahl(e.payload.eigeneVersion);
    default:
      return zahl(e.payload.koVersion) ?? zahl(e.payload.version);
  }
}

/**
 * Die Sequenzen, die bis zum Zeitpunkt ausdrücklich zurückgenommen wurden. Im Schreibweg ohne
 * Transaktion bleibt ein schon angehängter Beleg stehen, wenn die Änderung danach scheitert; die
 * Kette ist append-only, deshalb folgt `ko.change-rolled-back` mit `rolledBackSeqs`
 * (`KoService.belegeRuecknahme`). Eine Rücknahme NACH dem Zeitpunkt ist dort noch nicht geschehen.
 */
function zurueckgenommeneSeqs(bisher: readonly AuditEntry[]): Set<number> {
  const seqs = new Set<number>();
  for (const e of bisher) {
    if (e.action !== "ko.change-rolled-back" || !Array.isArray(e.payload.rolledBackSeqs)) {
      continue;
    }
    for (const seq of e.payload.rolledBackSeqs) {
      if (typeof seq === "number") {
        seqs.add(seq);
      }
    }
  }
  return seqs;
}

/** Die zum Zeitpunkt `t` geltende Fassung: die jüngste, die bis dahin gespeichert war. */
function fassungZu(
  versionen: readonly KoVersionSnapshot[],
  t: number,
): KoVersionSnapshot | undefined {
  let treffer: KoVersionSnapshot | undefined;
  for (const v of versionen) {
    if (Date.parse(v.at) <= t && (!treffer || v.version > treffer.version)) {
      treffer = v;
    }
  }
  return treffer;
}

/** Die rein rechnende Auskunft — ohne Ablage, damit sie für sich prüfbar bleibt. */
export function wissensauskunft(eingabe: WissensauskunftEingabe): Wissensauskunft {
  const { ko, zeitpunkt, versionen, audit, kenntnisnahmen, namen } = eingabe;
  const bis = (iso: string): boolean => Date.parse(iso) <= zeitpunkt;
  const person = (id: string): Person => ({ id, name: namen.get(id) ?? "" });
  const bisher = audit.filter((e) => bis(e.at)).sort((a, b) => a.seq - b.seq);
  const zurueck = zurueckgenommeneSeqs(bisher);
  const wirksam = bisher.filter((e) => !zurueck.has(e.seq));

  const stand = fassungZu(versionen, zeitpunkt);
  const fassung = stand
    ? {
        version: stand.version,
        seit: stand.at,
        von: person(stand.author),
        titel: stand.snapshot.title,
        aussage: stand.snapshot.statement,
      }
    : null;

  let imPapierkorb = false;
  for (const e of wirksam) {
    if (e.action === "ko.deleted") {
      imPapierkorb = true;
    } else if (e.action === "ko.restored") {
      imPapierkorb = false;
    }
  }

  // Eine zurückgenommene Freigabe ist keine: sie zählt hier nicht und erscheint bei der Person
  // ausdrücklich als zurückgenommen.
  const giltFassung = (e: AuditEntry): boolean =>
    fassung !== null && fassungAus(e) === fassung.version;
  const freigabeBeleg = wirksam
    .filter((e) => e.action === "ko.admin-validated" && giltFassung(e))
    .at(-1);

  const belegeJePerson = new Map<string, Kenntnisbeleg[]>();
  const hinzu = (id: string, beleg: Kenntnisbeleg): void => {
    const liste = belegeJePerson.get(id) ?? [];
    liste.push(beleg);
    belegeJePerson.set(id, liste);
  };
  for (const e of bisher) {
    const art = belegartAus(e);
    if (!art) {
      continue;
    }
    hinzu(e.actor, {
      art,
      am: e.at,
      fassung: fassungAus(e),
      seq: e.seq,
      zurueckgenommen: zurueck.has(e.seq),
    });
  }
  for (const { anforderung, empfaenger } of kenntnisnahmen) {
    if (!bis(anforderung.angefordertAm)) {
      continue;
    }
    hinzu(anforderung.angefordertVon, {
      art: "kenntnisnahme_verteilt",
      am: anforderung.angefordertAm,
      fassung: anforderung.fassung,
      seq: null,
      zurueckgenommen: false,
    });
    for (const e of empfaenger) {
      // Eine Bestätigung nach dem Zeitpunkt zählt dort noch nicht: dann war nur angefordert.
      const bestaetigtAm = e.bestaetigtAm !== null && bis(e.bestaetigtAm) ? e.bestaetigtAm : null;
      hinzu(e.empfaengerId, {
        art: bestaetigtAm ? "kenntnisnahme_bestaetigt" : "kenntnisnahme_angefordert",
        am: bestaetigtAm ?? anforderung.angefordertAm,
        fassung: anforderung.fassung,
        seq: null,
        zurueckgenommen: false,
      });
    }
  }

  const personen = [...belegeJePerson.entries()]
    .map(([id, belege]) => ({
      ...person(id),
      belege: belege.sort((a, b) => a.am.localeCompare(b.am)),
    }))
    .sort((a, b) => (a.belege[0]?.am ?? "").localeCompare(b.belege[0]?.am ?? ""));

  return {
    koId: ko.id,
    zeitpunkt: new Date(zeitpunkt).toISOString(),
    vorhanden: fassung !== null || wirksam.some((e) => e.action === "ko.created"),
    imPapierkorb,
    fassung,
    freigabe: freigabeBeleg ? { am: freigabeBeleg.at, von: person(freigabeBeleg.actor) } : null,
    aktuelleFassung: ko.version,
    personen,
    nichtErfasst: NICHT_ERFASST,
  };
}

// ================================================================================================
// DER DIENST — beschafft die drei Bestände und rechnet.
// ================================================================================================

export interface WissensauskunftDeps {
  ko: { versionsOf(id: string): Promise<readonly KoVersionSnapshot[]> };
  audit: { list(filter: AuditFilter): Promise<AuditEntry[]> };
  kenntnisnahmen: Pick<KenntnisnahmeRepo, "anforderungenZu" | "eintraegeZu">;
  konten: () => Promise<ReadonlyArray<{ id: string; name: string }>>;
}

export async function wissensauskunftFuer(
  deps: WissensauskunftDeps,
  ko: Pick<KnowledgeObject, "id" | "version">,
  zeitpunkt: number,
): Promise<Wissensauskunft> {
  const [versionen, audit, anforderungen, konten] = await Promise.all([
    deps.ko.versionsOf(ko.id),
    deps.audit.list({ target: ko.id }),
    deps.kenntnisnahmen.anforderungenZu(ko.id),
    deps.konten(),
  ]);
  const kenntnisnahmen = await Promise.all(
    anforderungen.map(async (anforderung) => ({
      anforderung,
      empfaenger: await deps.kenntnisnahmen.eintraegeZu(anforderung.id),
    })),
  );
  return wissensauskunft({
    ko,
    zeitpunkt,
    versionen,
    audit,
    kenntnisnahmen,
    namen: new Map(konten.map((k) => [k.id, k.name])),
  });
}
