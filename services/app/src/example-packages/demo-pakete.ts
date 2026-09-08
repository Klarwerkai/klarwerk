// ================================================================================================
// JOB 3277 — DEMOPAKETE: WÄHLEN, LADEN, ZURÜCKSETZEN, PAKETWEISE ENTFERNEN.
// ================================================================================================
//
// WAS ES BISHER GAB (WP-B6, `../example-packages.ts`): drei kuratierte Beispielpakete, die man
// LADEN kann. Entfernen ging nur über den GESAMT-Purge `DELETE /api/admin/demo-seed` — alles oder
// nichts. Für die Vorführung am 11.09. reicht das nicht: Pedi lädt EIN Paket, führt vor, und setzt
// GENAU DIESES Paket zurück, ohne dass andere Demodaten oder echte Nutzerdaten angefasst werden.
//
// DESHALB EIN ADDITIVER ZWEITER WEG statt eines Umbaus. `EXAMPLE_PACKAGES` und
// `loadExamplePackage` bleiben zeichengleich; die Bilanz-Form der alten Route ändert sich nicht
// (`tests/app/example-packages.test.ts` prüft sie mit `toEqual` — ein neues Feld dort wäre rot).
//
// ================================================================================================
// RUNDE 2 — WAS DER PRÜFER AN RUNDE 1 ZERLEGT HAT, UND WAS DARAUS FOLGT.
// ================================================================================================
//
// (1) DIE ZUGEHÖRIGKEIT WAR GERATEN, NICHT AUFGESCHRIEBEN. Ein Objekt galt als Teil des Pakets,
//     wenn seine Quelle das Präfix `<paket>/` trug — was nur die selbst angelegten Bausteine tun.
//     Alles, was am Freitag WÄHREND der Vorführung entsteht, wäre unsichtbar geblieben. Seit dieser
//     Runde führt `./paketlauf-register.ts` einen EXPLIZITEN Eintrag je Objekt (`package_id`,
//     `run_id`, Art). Die Zugehörigkeit heißt jetzt: „es steht geschrieben" — nicht „es sieht so
//     aus". Der Bestand eines Pakets ist die VEREINIGUNG aus registrierten Objekten und Objekten
//     mit dem Paketanker; der Anker bleibt, weil er der Idempotenz-Schlüssel der sechs Bausteine
//     ist (er beantwortet „welcher Baustein?", das Register beantwortet „wessen Objekt?").
//
// (2) DAS ZURÜCKSETZEN SETZTE NUR DEN HALBEN ZUSTAND ZURÜCK. Es schrieb Titel und `statement` —
//     die LESEANSICHT zeigt aber `bodyHtml`, wenn es da ist (apps/web/src/components/ko/KoRead.tsx).
//     Wer im Editor arbeitete, sah nach dem „Zurücksetzen" weiter seinen eigenen Text. Ebenso blieb
//     eine geänderte Kategorie stehen, und ein Objekt, das nur seine Freigabe verloren hatte, galt
//     als „unverändert". AUSGANGSZUSTAND HEISST JETZT ALLES, WAS DAS LADEN GESETZT HAT: Titel,
//     Text, Rumpf, Art, Kategorie, Schlagworte UND die Freigabe. Was verglichen wird, wird auch
//     wiederhergestellt — und umgekehrt (`ABWEICHUNGEN` unten ist die eine Liste für beides).
//
// (3) DUBLETTEN WURDEN WEGGEZÄHLT. Der Bestand lag in einer `Map` nach Bausteinschlüssel; zwei
//     Objekte mit demselben Anker überschrieben einander, die Übersicht meldete sechs von zwölf und
//     das Entfernen liess sechs stehen. Der Bestand ist jetzt eine LISTE je Schlüssel. Zusätzlich
//     laufen Laden/Zurücksetzen/Entfernen eines Pakets NACHEINANDER (`nacheinander`), damit zwei
//     gleichzeitige Klicks gar nicht erst zwölf Objekte anlegen.
//
// DIE HANDGRIFFE UND IHRE EHRLICHEN ZAHLEN:
//   LADEN         legt fehlende Bausteine an, lässt vorhandene UNBERÜHRT   → created/skipped
//   ZURÜCKSETZEN  legt fehlende an, stellt bearbeitete her, räumt Dubletten → created/updated/skipped/removed
//   ENTFERNEN     löscht die Objekte dieses Pakets samt Folgeeinträgen      → removed
// Keine dieser Zahlen wird behauptet: jede zählt einen Vorgang, der stattgefunden hat, und jeder
// Fehlschlag steht mit Schlüssel und Grund in `failures` (Muster `PurgeFehler`, seed-demo.ts).
//
// FREIGEGEBENES WISSEN, ÜBER DEN ECHTEN WEG: die Bausteine entstehen mit `neededValidations: 1`
// und bekommen danach EINE grüne Stimme des ladenden Admins über `ValidationService.rate` — genau
// die Mechanik, mit der auch der Demo-Seed seine validierten Objekte erzeugt (seed-demo.ts:686).
// Kein direktes Setzen von `status: "validiert"`, keine zweite Wahrheit. Und weil `KoService.revise`
// jedes überarbeitete Objekt auf „offen" zurücksetzt (service.ts:3594), folgt auf jede
// Wiederherstellung dieselbe grüne Stimme — sonst wäre der Ausgangszustand nur halb erreicht.
import { createHash } from "node:crypto";
import type { AuditService } from "../../../audit";
import type { ConflictService, OverlapService } from "../../../conflicts";
import type { KnowledgeType, KoService, KoSource } from "../../../knowledge-object";
import type { ValidationService } from "../../../validation";
import { EXAMPLE_PROVIDER, EXAMPLE_TITLE_PREFIX } from "../example-packages";
import {
  ADVISOR_FICTION_NOTICE,
  ADVISOR_ICT_EN_V1,
  type DemoPackageDefinition,
  type DemoPackageItem,
  type DemoPackageText,
} from "./advisor-ict-en-v1";
import {
  type PaketlaufEintrag,
  lesePaketlauf,
  mitPaketlauf,
  neueLaufKennung,
  ohnePaketlauf,
} from "./paketlauf-register";

/** Die wählbaren Demopakete. Heute genau eines — die Form ist trotzdem eine Liste, weil die
 *  Fläche sie als Liste rendert und ein zweites Paket keinen UI-Umbau kosten soll. */
export const DEMO_PACKAGES: readonly DemoPackageDefinition[] = [ADVISOR_ICT_EN_V1];

export function demoPackage(id: string): DemoPackageDefinition | undefined {
  return DEMO_PACKAGES.find((pkg) => pkg.id === id);
}

// ================================================================================================
// EIN PAKET, EIN LAUF ZUR ZEIT.
// ================================================================================================
//
// BENS MESSUNG: zwei gleichzeitige Ladeaufrufe erzeugten ZWÖLF Objekte. Der Grund ist keine
// Nachlässigkeit im Anlegen, sondern die Bauform „erst den Bestand lesen, dann anlegen": zwischen
// Lesen und Anlegen liegt ein Augenblick, in dem beide Läufe dasselbe Nichts gesehen haben.
//
// DIE ECHTE LÖSUNG WÄRE EIN ANKER IN DER DATENBANK (ein partieller Unique-Index auf die
// Herkunfts-externalId, wie ihn der Import-Accept mit `kos_import_candidate_uq` hat). Der liegt in
// `services/knowledge-object` und in einer Migration — beides ausserhalb der ZIELPFADE. Also hier
// die Warteschlange im Prozess: jeder Handgriff an EINEM Paket wartet auf den vorigen.
//
// WAS SIE HÄLT UND WAS NICHT, ohne Beschönigung: sie hält zwei gleichzeitige Klicks im selben
// Serverprozess — der Fall, den Ben gemessen hat und der einzige, den eine Vorführung erzeugt.
// Sie hält NICHT zwei Prozesse (mehrere Instanzen hinter einem Balancer). Für diesen Rest sind
// Bestand-als-Liste und das Aufräumen im Zurücksetzen die zweite Verteidigungslinie: eine dennoch
// entstandene Dublette wird GEZÄHLT, ANGEZEIGT und beim Zurücksetzen entfernt — sie verschwindet
// nicht still aus der Bilanz.
const laufendeHandgriffe = new Map<string, Promise<unknown>>();

function nacheinander<T>(schluessel: string, arbeit: () => Promise<T>): Promise<T> {
  const vorher = laufendeHandgriffe.get(schluessel) ?? Promise.resolve();
  // `then(arbeit, arbeit)`: auch nach einem Fehlschlag des Vorgängers läuft der nächste Handgriff —
  // eine Warteschlange, die sich am ersten Fehler selbst verschluckt, wäre schlimmer als keine.
  const jetzt = vorher.then(arbeit, arbeit);
  laufendeHandgriffe.set(
    schluessel,
    jetzt.then(
      () => undefined,
      () => undefined,
    ),
  );
  return jetzt;
}

/** Der Idempotenz-Anker: stabil über Läufe, trägt die Paket-Id im Präfix. Er beantwortet die Frage
 *  „WELCHER Baustein ist das?" — nicht die Frage „wem gehört dieses Objekt?" (das tut das Register). */
function externalIdOf(pkg: DemoPackageDefinition, item: DemoPackageItem): string {
  return `${pkg.id}/${item.key}`;
}

/** Der Ausgangstitel auf der Fläche — mit dem Bestands-Präfix aus WP-B6, damit ein Beispiel überall
 *  gleich als Beispiel erkennbar ist. */
function baselineTitle(item: DemoPackageItem): string {
  return `${EXAMPLE_TITLE_PREFIX}${item.title}`;
}

/** Der Ausgangstext: die Absätze des Manifests, in Reihenfolge, durch Leerzeile getrennt. Genau
 *  diese Zeichenfolge misst `bodySha256` (Manifest-Definition, Nachführung 08:30). */
function baselineStatement(item: DemoPackageItem): string {
  return item.paragraphs.join("\n\n");
}

/**
 * Der Ausgangs-RUMPF. Er ist neu in Runde 2 und er ist der Kern von Bens Befund 2: die
 * Leseansicht zeigt `bodyHtml`, sobald es gesetzt ist. Ein Paket ohne Rumpf hätte nach der ersten
 * Bearbeitung im Editor einen Rumpf — und das Zurücksetzen hätte gegen ein Feld gearbeitet, das
 * gar nicht mehr gelesen wird. Jetzt hat der Ausgangszustand einen Rumpf, und er wird
 * mitgeschrieben und mitverglichen.
 *
 * Kein Maskieren nötig und keins gewollt: die Absätze des Vertrags enthalten keine Sonderzeichen
 * (`sanitizeHtml` maskiert Text ohnehin selbst). Dass der gespeicherte Rumpf zeichengleich zu
 * diesem hier ist, prüft `tests/demopaket-advisor/laden-zuruecksetzen.test.ts` nach dem Laden —
 * eine spätere Änderung am Sanitizer wird dort rot, nicht erst am Freitag.
 */
function baselineBody(item: DemoPackageItem): string {
  return item.paragraphs.map((absatz) => `<p>${absatz}</p>`).join("");
}

/** Die Ausgangs-Schlagworte OHNE den Registermerker (der trägt die wechselnde Laufkennung). */
function baselineTags(pkg: DemoPackageDefinition): string[] {
  return ["beispiel", pkg.id];
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ================================================================================================
// WAS „BEARBEITET" HEISST — DIE EINE LISTE FÜR VERGLEICH UND WIEDERHERSTELLUNG.
// ================================================================================================
//
// Diese drei Werte sind zugleich die Anzeige in der Vorschau und die Arbeitsliste des
// Zurücksetzens. Sie stehen bewusst in EINER Aufzählung: in Runde 1 verglich `istAusgangszustand`
// weniger, als das Zurücksetzen schrieb, und schrieb weniger, als die Ansicht las — drei Mengen,
// die auseinanderliefen. Wer hier etwas ergänzt, ergänzt damit beides.
export type DemoPaketAbweichung =
  /** Titel, Text, Rumpf oder Wissensart weichen vom Vertrag ab. */
  | "inhalt"
  /** Kategorie oder Schlagworte weichen ab. */
  | "metadaten"
  /** Das Objekt ist nicht (mehr) freigegeben. */
  | "freigabe";

export interface DemoPackageServices {
  ko: KoService;
  validation: ValidationService;
  conflicts: ConflictService;
  overlaps: OverlapService;
  audit?: AuditService;
}

/** Ein Fehlschlag mit Schlüssel und Grund — nie eine stumme Lücke zwischen zwei Zählern. */
export interface DemoPackageFehler {
  readonly key: string;
  readonly grund: string;
}

export interface DemoPackageResult {
  package: string;
  /** Die Laufkennung dieses Handgriffs (`run_id`); beim Entfernen `null` — dort entsteht kein Lauf. */
  run: string | null;
  /** Neu angelegte Bausteine. */
  created: number;
  /** Bausteine, die auf den Ausgangszustand zurückgesetzt wurden (nur beim Zurücksetzen). */
  updated: number;
  /** Vorhandene Bausteine, die unverändert blieben. */
  skipped: number;
  /** Endgültig gelöschte Objekte: beim Entfernen alle, beim Zurücksetzen Dubletten UND Zugeordnete. */
  removed: number;
  /**
   * Davon ZUGEORDNETE Nicht-Bausteine (Import-/Entwurfsobjekte der Vorführung), die der
   * Ausgangszustand nicht kennt. Eigener Zähler, weil „6 Dubletten entfernt" und „6 Importobjekte
   * entfernt" für Pedi zwei völlig verschiedene Nachrichten sind.
   */
  removedAssigned: number;
  /** Objekte, für die dieser Lauf einen Registereintrag geschrieben hat (Anlage oder Nachtrag). */
  registered: number;
  /** GEFUNDENE überzählige Kopien (mehr als eine je Bausteinschlüssel) — gezählt, nicht verschwiegen. */
  duplicates: number;
  /** Bausteine, deren Anker im PAPIERKORB liegt: kein Duplikat, aber auch keine Anlage. */
  skippedInTrash: number;
  /** Geschlossene Konflikte/Doppelungen, die an Objekten dieses Pakets hingen (nur beim Entfernen). */
  closedConflicts: number;
  closedDuplicates: number;
  failures: DemoPackageFehler[];
}

function leeresErgebnis(pkg: DemoPackageDefinition, run: string | null): DemoPackageResult {
  return {
    package: pkg.id,
    run,
    created: 0,
    updated: 0,
    skipped: 0,
    removed: 0,
    removedAssigned: 0,
    registered: 0,
    duplicates: 0,
    skippedInTrash: 0,
    closedConflicts: 0,
    closedDuplicates: 0,
    failures: [],
  };
}

function grundVon(ursache: unknown): string {
  return ursache instanceof Error ? ursache.message : "unbekannter Fehler";
}

// ================================================================================================
// DER BESTAND EINES PAKETS.
// ================================================================================================

/** Ein Objekt, das zu diesem Paket gehört — mit allem, was Vergleich und Anzeige brauchen. */
interface Bestandsstueck {
  readonly id: string;
  /** Der Bausteinschlüssel aus dem Paketanker (S02 …) — `null` bei Objekten ohne Anker. */
  readonly key: string | null;
  readonly title: string;
  readonly statement: string;
  readonly bodyHtml: string | null;
  readonly type: KnowledgeType;
  readonly category: string;
  readonly status: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
  /** Der Registereintrag — `null` heisst „nicht registriert", nicht „gehört nicht dazu". */
  readonly eintrag: PaketlaufEintrag | null;
}

/**
 * Alle lebenden Objekte dieses Pakets.
 *
 * ZWEI ZUGEHÖRIGKEITSGRÜNDE, BEWUSST ALS VEREINIGUNG:
 *   · der REGISTEREINTRAG (`paketlauf:<paket>:…` in den Schlagworten) — die aufgeschriebene
 *     Zugehörigkeit; sie gilt auch für Objekte, die nie einen Paketanker hatten.
 *   · der PAKETANKER (Quelle mit Beispiel-Provider und externalId-Präfix `<paket>/`) — er hält den
 *     Altbestand aus der Zeit vor dem Register und die Dubletten mit, die vor der Warteschlange
 *     entstanden sein können.
 * Ein Titelvergleich oder eine Ähnlichkeitssuche kommt hier ausdrücklich NICHT vor: beides träfe
 * früher oder später fremde Daten (Nachführung 07:50).
 */
async function bestandVon(ko: KoService, pkg: DemoPackageDefinition): Promise<Bestandsstueck[]> {
  const praefix = `${pkg.id}/`;
  const stuecke: Bestandsstueck[] = [];
  for (const objekt of await ko.list()) {
    const anker = (objekt.sources ?? []).find(
      (quelle) =>
        quelle.provider === EXAMPLE_PROVIDER && (quelle.externalId ?? "").startsWith(praefix),
    );
    const eintrag = lesePaketlauf(objekt.tags, pkg.id);
    if (!anker && !eintrag) {
      continue;
    }
    stuecke.push({
      id: objekt.id,
      key: anker ? (anker.externalId ?? "").slice(praefix.length) : null,
      title: objekt.title,
      statement: objekt.statement,
      bodyHtml: objekt.bodyHtml ?? null,
      type: objekt.type,
      category: objekt.category,
      status: objekt.status,
      tags: objekt.tags ?? [],
      createdAt: objekt.createdAt,
      eintrag,
    });
  }
  // Feste Reihenfolge: ältestes zuerst. Sie entscheidet bei Dubletten, welches Objekt der TRÄGER
  // des Bausteins ist und welche Kopien überzählig sind — das darf nicht vom Zufall abhängen.
  stuecke.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return stuecke;
}

/** Der Bestand nach Bausteinschlüssel — als LISTE, denn zwei Objekte können denselben tragen. */
function nachSchluessel(stuecke: readonly Bestandsstueck[]): Map<string, Bestandsstueck[]> {
  const karte = new Map<string, Bestandsstueck[]>();
  for (const stueck of stuecke) {
    if (!stueck.key) {
      continue;
    }
    const liste = karte.get(stueck.key);
    if (liste) {
      liste.push(stueck);
    } else {
      karte.set(stueck.key, [stueck]);
    }
  }
  return karte;
}

/** Anker dieses Pakets, die im Papierkorb liegen — sie blockieren die Neuanlage (kein Duplikat). */
async function papierkorbAnker(
  ko: KoService,
  pkg: DemoPackageDefinition,
): Promise<ReadonlySet<string>> {
  const praefix = `${pkg.id}/`;
  return new Set(
    (await ko.trashedSourceAnchors())
      .filter((a) => a.provider === EXAMPLE_PROVIDER && a.externalId.startsWith(praefix))
      .map((a) => a.externalId.slice(praefix.length)),
  );
}

function gleicheFolge(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((wert, i) => wert === b[i]);
}

/**
 * Worin weicht dieses Objekt vom Ausgangszustand ab? Leere Liste = Ausgangszustand.
 *
 * `bodySha256` aus dem Vertrag ist hier der Vergleichsanker des Textes — NICHT `contentSha256`
 * (der misst die Quelldatei mit Überschrift und Fiktionshinweis, die im Objekt gar nicht steht;
 * Nachführung 07:50 „nur als Verweis mitführen, nie vergleichen").
 */
function abweichungenVon(
  stueck: Bestandsstueck,
  pkg: DemoPackageDefinition,
  item: DemoPackageItem,
): DemoPaketAbweichung[] {
  const abweichungen: DemoPaketAbweichung[] = [];
  if (
    stueck.title !== baselineTitle(item) ||
    sha256(stueck.statement) !== item.bodySha256 ||
    (stueck.bodyHtml ?? "") !== baselineBody(item) ||
    stueck.type !== item.type
  ) {
    abweichungen.push("inhalt");
  }
  if (
    stueck.category !== item.area ||
    !gleicheFolge(ohnePaketlauf(stueck.tags, pkg.id), baselineTags(pkg))
  ) {
    abweichungen.push("metadaten");
  }
  if (stueck.status !== "validiert") {
    abweichungen.push("freigabe");
  }
  return abweichungen;
}

// ================================================================================================
// DER PLAN — EINE QUELLE FÜR VORSCHAU UND VOLLZUG (RUNDE 3).
// ================================================================================================
//
// BENS BEFUND ZU RUNDE 2, in einem Satz: die Vorschau zählte etwas anderes, als der Reset tat.
// Sie listete die registrierten Objekte, der Reset lief über die sechs Paketdefinitionen — zwei
// Mengen, die auseinanderliefen, sobald etwas anderes als ein Baustein zugeordnet war. Registrierte
// Import- und Entwurfsobjekte wurden ABGEWIESEN statt behandelt; unregistrierter Altbestand wurde
// entfernt, ohne in der Vorschau mit seiner Kennung dazustehen.
//
// DIE ABHILFE IST BAULICH, NICHT KOSMETISCH: es gibt jetzt GENAU EINE Stelle, die entscheidet, was
// mit welchem Objekt geschieht — `planeZuruecksetzen`. Die Vorschau RENDERT diesen Plan, der Reset
// VOLLZIEHT ihn. Dass beide dieselbe ID-Menge sehen, ist damit keine Zusicherung mehr, die man
// testen und wieder verlieren kann, sondern eine Eigenschaft der Bauform.
//
// WAS DER AUSGANGSZUSTAND IST: genau die sechs Bausteine des Vertrags, freigegeben, im
// Ausgangstext. Daraus folgt für jedes Objekt, das dem Paket zugeordnet ist, zwingend eines von
// beiden — und der Grund steht dabei, weil „entfernt" ohne Grund keine Vorschau ist:
//
//   BAUSTEIN     Träger eines der sechs Schlüssel  → WIEDERHERSTELLEN (Text, Rumpf, Metadaten, Freigabe)
//   DUBLETTE     zweiter Träger desselben Schlüssels → ENTFERNEN (der Ausgangszustand kennt ihn nicht)
//   ZUGEORDNET   registriert, aber kein Baustein     → ENTFERNEN (Import-/Entwurfsobjekte der Vorführung)
//
// ZUGEORDNET ist der Fall, den Runde 2 schuldig blieb. Ein über den Confluence-Import angenommenes
// Objekt gehört zum Paketlauf, aber NICHT zum Ausgangszustand: vor der Vorführung war es nicht da.
// Die Wiederholung stellt den Zustand VOR dem Import her, also muss es weg — samt der Konflikte und
// Doppelungen, die es erzeugt hat. Seine Confluence-Herkunft wird dabei nie angetastet; sie ist der
// Grund, aus dem es entstand, nicht der Grund, aus dem es geht (das ist der Registereintrag).
export type DemoPaketBehandlung = "wiederherstellen" | "entfernen";
export type DemoPaketGrund = "baustein" | "dublette" | "zugeordnet";

interface Planstueck {
  readonly stueck: Bestandsstueck;
  readonly behandlung: DemoPaketBehandlung;
  readonly grund: DemoPaketGrund;
  /** Der Baustein, gegen den verglichen wird — nur bei `baustein` gesetzt. */
  readonly item: DemoPackageItem | undefined;
}

interface Plan {
  /** Je Bausteinschlüssel der TRÄGER: das Objekt, das wiederhergestellt wird. */
  readonly traeger: Map<string, Bestandsstueck>;
  /** Jedes zugeordnete Objekt mit seiner Behandlung — die eine Liste, die beide Wege lesen. */
  readonly stuecke: Planstueck[];
  /** Bausteine, für die gar kein Objekt da ist: anzulegen (oder im Papierkorb blockiert). */
  readonly fehlend: DemoPackageItem[];
}

/**
 * Die beiden eingreifenden Handgriffe. Sie haben VERSCHIEDENE Pläne, und genau das war der Fehler
 * der Runde 3 (Bens Befund): die Vorschau zeigte vor dem ENTFERNEN den Reset-Plan und kündigte
 * „wird hergestellt (6)" an — unmittelbar bevor dieselben sechs Objekte endgültig gelöscht wurden.
 * Eine Zusage, die das Gegenteil dessen verspricht, was gleich geschieht, ist schlimmer als keine.
 */
export type DemoPaketAktion = "zuruecksetzen" | "entfernen";

/**
 * Was mit dem aktuellen Bestand geschähe, wenn die gewählte Aktion JETZT liefe. REIN LESEND — die
 * Funktion schreibt nichts und darf deshalb von der Vorschau wie vom Vollzug aufgerufen werden.
 *
 * ENTFERNEN NIMMT ALLES MIT, auch die sechs Bausteine: es gibt danach kein Paket mehr, also wird
 * nichts hergestellt und nichts angelegt. Der GRUND bleibt trotzdem stehen (`baustein`,
 * `dublette`, `zugeordnet`) — er sagt, WAS das Objekt war, und das ist beim Löschen die
 * interessantere Auskunft als beim Herstellen.
 */
function planeFuer(
  bestand: readonly Bestandsstueck[],
  pkg: DemoPackageDefinition,
  aktion: DemoPaketAktion,
): Plan {
  const plan = planeZuruecksetzen(bestand, pkg);
  if (aktion === "zuruecksetzen") {
    return plan;
  }
  return {
    traeger: plan.traeger,
    // Kein `item`: gegen einen Ausgangszustand wird hier nichts mehr verglichen.
    stuecke: plan.stuecke.map((p) => ({ ...p, behandlung: "entfernen" as const, item: undefined })),
    // Nichts fehlt, weil nichts entstehen soll.
    fehlend: [],
  };
}

/**
 * Der Plan des ZURÜCKSETZENS: die sechs Bausteine herstellen, alles andere entfernen.
 * Grundlage auch für `planeFuer("entfernen")`, das daraus die Träger übernimmt.
 */
function planeZuruecksetzen(bestand: readonly Bestandsstueck[], pkg: DemoPackageDefinition): Plan {
  const karte = nachSchluessel(bestand);
  const traeger = new Map<string, Bestandsstueck>();
  const fehlend: DemoPackageItem[] = [];
  for (const item of pkg.items) {
    const kopien = karte.get(item.key) ?? [];
    if (kopien.length === 0) {
      fehlend.push(item);
      continue;
    }
    // Träger ist das registrierte Objekt; gibt es keins, das älteste (`bestandVon` sortiert).
    // Diese Wahl darf nicht vom Zufall abhängen — sonst überlebte mal dieses, mal jenes Objekt.
    traeger.set(item.key, kopien.find((k) => k.eintrag !== null) ?? (kopien[0] as Bestandsstueck));
  }
  const traegerIds = new Set([...traeger.values()].map((s) => s.id));
  const itemVonKey = new Map(pkg.items.map((i) => [i.key, i]));
  const stuecke: Planstueck[] = bestand.map((stueck) => {
    if (traegerIds.has(stueck.id)) {
      return {
        stueck,
        behandlung: "wiederherstellen" as const,
        grund: "baustein" as const,
        item: stueck.key ? itemVonKey.get(stueck.key) : undefined,
      };
    }
    // Trägt es einen Bausteinschlüssel, ist es die überzählige Kopie eines Bausteins; trägt es
    // keinen, ist es ein sonstiges zugeordnetes Objekt (Import, Entwurf, Altbestand ohne Anker).
    return {
      stueck,
      behandlung: "entfernen" as const,
      grund:
        stueck.key && itemVonKey.has(stueck.key) ? ("dublette" as const) : ("zugeordnet" as const),
      item: undefined,
    };
  });
  return { traeger, stuecke, fehlend };
}

// ================================================================================================
// SCHREIBEN.
// ================================================================================================

/**
 * Schliesst die Konflikte und Doppelungen, die an den übergebenen Objekten hängen — der eine Weg
 * für Entfernen UND Zurücksetzen. Vorher stand diese Schleife nur im Entfernen; ein Reset, der ein
 * Importobjekt löscht und seinen Konflikt stehen lässt, hinterliesse einen Zeiger ins Leere.
 */
async function schliesseFolgeeintraege(
  services: DemoPackageServices,
  ids: ReadonlySet<string>,
  actor: string,
  grund: string,
  ergebnis: DemoPackageResult,
): Promise<void> {
  if (ids.size === 0) {
    return;
  }
  for (const konflikt of await services.conflicts.unresolved()) {
    if (!ids.has(konflikt.koA) && !ids.has(konflikt.koB)) {
      continue;
    }
    try {
      await services.conflicts.resolve(konflikt.id, actor, grund);
      ergebnis.closedConflicts += 1;
    } catch (ursache) {
      ergebnis.failures.push({ key: konflikt.id, grund: grundVon(ursache) });
    }
  }
  for (const doppelung of await services.overlaps.unresolved()) {
    if (!ids.has(doppelung.koA) && !ids.has(doppelung.koB)) {
      continue;
    }
    try {
      await services.overlaps.dismiss(doppelung.id, actor, grund);
      ergebnis.closedDuplicates += 1;
    } catch (ursache) {
      ergebnis.failures.push({ key: doppelung.id, grund: grundVon(ursache) });
    }
  }
}

/** Die eine grüne Stimme, die aus dem frisch angelegten/wiederhergestellten Baustein freigegebenes
 *  Wissen macht — über den echten Validierungsdienst, wie im Demo-Seed. */
async function freigeben(
  services: DemoPackageServices,
  koId: string,
  actor: string,
): Promise<void> {
  await services.validation.rate(koId, actor, "up");
  const danach = await services.ko.get(koId);
  if (danach?.status !== "validiert") {
    // Die Freigabe ist die Voraussetzung dafür, dass der Import am Freitag überhaupt etwas findet,
    // gegen das er prüfen kann. Bleibt sie aus (etwa weil eine fremde rote Stimme dieser Fassung
    // entgegensteht), ist das ein Fehlschlag mit Grund — keine stille Halbheit.
    throw new Error(`nicht freigegeben — Status „${danach?.status ?? "fehlt"}"`);
  }
}

async function anlegen(
  services: DemoPackageServices,
  pkg: DemoPackageDefinition,
  item: DemoPackageItem,
  actor: string,
  eintrag: PaketlaufEintrag,
): Promise<void> {
  const externalId = externalIdOf(pkg, item);
  const quelle: KoSource = {
    id: externalId,
    label: baselineTitle(item),
    url: null,
    // Der Fiktionshinweis steht wörtlich in jeder Quellseite dieses Pakets und ist der eine Satz,
    // den ein Leser am Wissensobjekt sehen muss: die Herkunftsliste (SourceEvidence,
    // MehrAbschnitte) zeigt `excerpt` an, und damit sagt jedes Objekt an seinem Beleg selbst, dass
    // es erfundenes Vorführmaterial ist — nicht nur der Kasten, in dem es geladen wurde.
    excerpt: ADVISOR_FICTION_NOTICE,
    kind: "external",
    peerValidated: false,
    provider: EXAMPLE_PROVIDER,
    externalId,
    sourceVersion: 1,
    author: actor,
    at: new Date().toISOString(),
  };
  const ko = await services.ko.create({
    title: baselineTitle(item),
    statement: baselineStatement(item),
    // Der Rumpf ist das, was die Leseansicht zeigt (KoRead) — er gehört zum Ausgangszustand.
    bodyHtml: baselineBody(item),
    type: item.type,
    category: item.area,
    author: actor,
    tags: mitPaketlauf(baselineTags(pkg), eintrag),
    sources: [quelle],
    // EINE grüne Stimme genügt: der ladende Admin ist auf einer frischen Instanz oft der einzige
    // Mensch, und das Paket soll ausdrücklich FREIGEGEBENES Wissen sein.
    neededValidations: 1,
    // Der Gesamt-Purge (DELETE /api/admin/demo-seed) nimmt das Paket weiterhin mit.
    demoSeed: true,
  });
  await freigeben(services, ko.id, actor);
}

/**
 * Stellt den Ausgangszustand eines vorhandenen Bausteins her und meldet, ob dafür etwas geschrieben
 * werden musste. Die Reihenfolge ist nicht beliebig:
 *   1. Metadaten (Kategorie, Schlagworte) — reine Metadaten-Schreibvorgänge, ohne Versions-Bump.
 *   2. Inhalt über `revise` — erhöht die Version und setzt das Objekt auf „offen".
 *   3. Freigabe zuletzt, weil Schritt 2 sie genommen hätte.
 */
async function wiederherstellen(
  services: DemoPackageServices,
  pkg: DemoPackageDefinition,
  item: DemoPackageItem,
  stueck: Bestandsstueck,
  actor: string,
  lauf: string,
): Promise<boolean> {
  const abweichungen = abweichungenVon(stueck, pkg, item);
  const fehltRegister = stueck.eintrag === null;
  if (abweichungen.length === 0 && !fehltRegister) {
    return false;
  }
  const eintrag: PaketlaufEintrag = stueck.eintrag ?? { paket: pkg.id, art: "seed", lauf };
  if (abweichungen.includes("metadaten") || fehltRegister) {
    if (stueck.category !== item.area) {
      await services.ko.updateCategory(stueck.id, item.area, actor);
    }
    await services.ko.updateTags(stueck.id, mitPaketlauf(baselineTags(pkg), eintrag), actor);
  }
  if (abweichungen.includes("inhalt")) {
    await services.ko.revise(
      stueck.id,
      {
        title: baselineTitle(item),
        statement: baselineStatement(item),
        bodyHtml: baselineBody(item),
        type: item.type,
      },
      actor,
    );
  }
  // Nach jedem Inhaltsschreiben steht das Objekt auf „offen"; und auch ohne Inhaltsänderung kann es
  // seine Freigabe verloren haben (Konfliktwirkung, rote Stimme). Beides endet hier gleich.
  const jetzt = await services.ko.get(stueck.id);
  if (jetzt?.status !== "validiert") {
    await freigeben(services, stueck.id, actor);
  }
  return true;
}

export type DemoPackageModus = "laden" | "zuruecksetzen";

/**
 * Lädt ein Demopaket. `laden` fasst vorhandene Bausteine NICHT an (wiederholtes Laden erzeugt weder
 * Kopien noch stille Textänderungen); `zuruecksetzen` stellt zusätzlich den Ausgangszustand
 * bearbeiteter Bausteine her und räumt überzählige Kopien weg.
 */
export async function ladeDemoPaket(
  services: DemoPackageServices,
  pkg: DemoPackageDefinition,
  actor: string,
  modus: DemoPackageModus,
): Promise<DemoPackageResult> {
  return nacheinander(pkg.id, () => ladeDemoPaketVollzug(services, pkg, actor, modus));
}

async function ladeDemoPaketVollzug(
  services: DemoPackageServices,
  pkg: DemoPackageDefinition,
  actor: string,
  modus: DemoPackageModus,
): Promise<DemoPackageResult> {
  const lauf = neueLaufKennung();
  const ergebnis = leeresErgebnis(pkg, lauf);
  const bestand = await bestandVon(services.ko, pkg);
  const imPapierkorb = await papierkorbAnker(services.ko, pkg);
  // EIN Plan für beide Wege. Die Vorschau hat denselben gelesen; was hier geschieht, stand dort.
  const plan = planeZuruecksetzen(bestand, pkg);

  // ------------------------------------------------------------------------------------------
  // WEGNEHMEN — nur beim Zurücksetzen, und zuerst.
  // ------------------------------------------------------------------------------------------
  // Zuerst, weil die Folgeeinträge (Konflikte/Doppelungen) an den Objekten hängen, die gleich
  // verschwinden: erst schliessen, dann löschen — sonst zeigte ein offener Konflikt ins Leere.
  const zuEntfernen = plan.stuecke.filter((p) => p.behandlung === "entfernen");
  ergebnis.duplicates = zuEntfernen.filter((p) => p.grund === "dublette").length;
  if (modus === "zuruecksetzen" && zuEntfernen.length > 0) {
    await schliesseFolgeeintraege(
      services,
      new Set(zuEntfernen.map((p) => p.stueck.id)),
      actor,
      `Demopaket ${pkg.id} zurückgesetzt`,
      ergebnis,
    );
    for (const eintrag of zuEntfernen) {
      try {
        await services.ko.delete(eintrag.stueck.id, actor, { hard: true });
        ergebnis.removed += 1;
        if (eintrag.grund === "zugeordnet") {
          ergebnis.removedAssigned += 1;
        }
      } catch (ursache) {
        ergebnis.failures.push({ key: eintrag.stueck.id, grund: grundVon(ursache) });
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // HERSTELLEN — die sechs Bausteine des Ausgangszustands.
  // ------------------------------------------------------------------------------------------
  for (const item of pkg.items) {
    const traeger = plan.traeger.get(item.key);
    try {
      if (!traeger) {
        if (imPapierkorb.has(item.key)) {
          // Der Anker lebt im Papierkorb: eine Neuanlage wäre ein Duplikat mit derselben Herkunft.
          ergebnis.skippedInTrash += 1;
          continue;
        }
        await anlegen(services, pkg, item, actor, { paket: pkg.id, art: "seed", lauf });
        ergebnis.created += 1;
        ergebnis.registered += 1;
        continue;
      }
      const musstRegistriert = traeger.eintrag === null;
      if (modus === "zuruecksetzen") {
        const geschrieben = await wiederherstellen(services, pkg, item, traeger, actor, lauf);
        if (geschrieben) {
          ergebnis.updated += 1;
        } else {
          ergebnis.skipped += 1;
        }
      } else {
        // Laden ändert nie still einen Text. Den fehlenden Registereintrag trägt es trotzdem nach:
        // das ist keine inhaltliche Änderung, sondern das Nachholen der Zugehörigkeit für
        // Altbestand aus der Zeit vor dem Register.
        if (musstRegistriert) {
          await services.ko.updateTags(
            traeger.id,
            mitPaketlauf(traeger.tags, { paket: pkg.id, art: "seed", lauf }),
            actor,
          );
        }
        ergebnis.skipped += 1;
      }
      if (musstRegistriert) {
        ergebnis.registered += 1;
      }
    } catch (ursache) {
      ergebnis.failures.push({ key: item.key, grund: grundVon(ursache) });
    }
  }

  await services.audit?.record({
    actor,
    action: modus === "laden" ? "demoPackage.load" : "demoPackage.reset",
    target: pkg.id,
    payload: {
      run: lauf,
      created: ergebnis.created,
      updated: ergebnis.updated,
      skipped: ergebnis.skipped,
      removed: ergebnis.removed,
      removedAssigned: ergebnis.removedAssigned,
      registered: ergebnis.registered,
      duplicates: ergebnis.duplicates,
      skippedInTrash: ergebnis.skippedInTrash,
      closedConflicts: ergebnis.closedConflicts,
      closedDuplicates: ergebnis.closedDuplicates,
      failures: ergebnis.failures.length,
    },
  });
  return ergebnis;
}

/**
 * Entfernt GENAU DIESES Paket: seine Objekte samt der Konflikte und Doppelungen, die an ihnen
 * hängen. Alles andere — andere Demopakete, der Demo-Seed, echte Nutzerdaten — bleibt unberührt,
 * weil die Auswahl ausschliesslich aus Registereinträgen und Paketankern entsteht.
 */
export async function entferneDemoPaket(
  services: DemoPackageServices,
  pkg: DemoPackageDefinition,
  actor: string,
): Promise<DemoPackageResult> {
  return nacheinander(pkg.id, () => entferneDemoPaketVollzug(services, pkg, actor));
}

async function entferneDemoPaketVollzug(
  services: DemoPackageServices,
  pkg: DemoPackageDefinition,
  actor: string,
): Promise<DemoPackageResult> {
  const ergebnis = leeresErgebnis(pkg, null);
  const bestand = await bestandVon(services.ko, pkg);
  // DERSELBE Plan, den die Vorschau mit `aktion=entfernen` gelesen hat — nicht eine zweite,
  // nachgebaute Auswahl. Damit gilt auch hier: was angekündigt war, geschieht, und nichts sonst.
  const plan = planeFuer(bestand, pkg, "entfernen");
  const ids = new Set(plan.stuecke.map((p) => p.stueck.id));
  ergebnis.duplicates = plan.stuecke.filter((p) => p.grund === "dublette").length;

  // Zuerst die Folgeeinträge schliessen (wie der Demo-Purge: erst Konflikte/Doppelungen, dann die
  // Objekte selbst) — sonst bliebe ein Konflikt auf ein gelöschtes Objekt zurück. Derselbe Weg,
  // den auch das Zurücksetzen für seine entfernten Objekte geht.
  await schliesseFolgeeintraege(services, ids, actor, `Demopaket ${pkg.id} entfernt`, ergebnis);
  for (const eintrag of plan.stuecke) {
    try {
      // Endgültig, nicht in den Papierkorb — wie der Demo-Purge mit Demodaten verfährt (SCRUM-422).
      await services.ko.delete(eintrag.stueck.id, actor, { hard: true });
      ergebnis.removed += 1;
      if (eintrag.grund === "zugeordnet") {
        ergebnis.removedAssigned += 1;
      }
    } catch (ursache) {
      ergebnis.failures.push({
        key: eintrag.stueck.key ?? eintrag.stueck.id,
        grund: grundVon(ursache),
      });
    }
  }

  await services.audit?.record({
    actor,
    action: "demoPackage.remove",
    target: pkg.id,
    payload: {
      removed: ergebnis.removed,
      removedAssigned: ergebnis.removedAssigned,
      duplicates: ergebnis.duplicates,
      closedConflicts: ergebnis.closedConflicts,
      closedDuplicates: ergebnis.closedDuplicates,
      failures: ergebnis.failures.length,
    },
  });
  return ergebnis;
}

// ================================================================================================
// LESEN: ÜBERSICHT UND VORSCHAU.
// ================================================================================================

/** Was die Fläche VOR dem Laden zeigt: Beschreibung, Sprache, Umfang — und der gezählte Stand. */
export interface DemoPackageUebersicht {
  id: string;
  language: "en";
  fictional: true;
  title: DemoPackageText;
  description: DemoPackageText;
  /** Umfang: wie viele Objekte das Paket anlegt, und aus welchen Bereichen. */
  items: number;
  areas: string[];
  /** Wie viele Objekte des Pakets gerade im Bestand liegen — ALLE, auch Dubletten. */
  loaded: number;
  /** Davon überzählig (mehr als eine Kopie je Baustein). */
  duplicates: number;
  /** Wie viele davon vom Ausgangszustand abweichen (Grundlage für „Zurücksetzen"). */
  edited: number;
  /** Wie viele einen Registereintrag tragen, und wie viele Läufe im Bestand vertreten sind. */
  registered: number;
  runs: number;
}

/**
 * Ein zugeordnetes Objekt in der Vorschau — JEDES, nicht nur die registrierten.
 *
 * RUNDE 3: bis hierher standen unregistrierter Altbestand und Dubletten nur als ANZAHL da, wurden
 * beim Vollzug aber gelöscht. Eine Vorschau, die einen Teil des Eingriffs verschweigt, ist keine.
 * Jetzt trägt jede Zeile ihre Kennung, ihre Behandlung und den Grund dafür.
 */
export interface DemoPaketVorschauEintrag {
  id: string;
  /** Art aus dem Register (`seed`/`import`/`entwurf`) oder `null` = nicht registriert. */
  art: string | null;
  run: string | null;
  /** Bausteinschlüssel, sofern das Objekt einen Paketanker trägt. */
  key: string | null;
  title: string;
  /** Was die ANGEFRAGTE Aktion täte, und warum — gemessen aus ihrem Plan, nicht behauptet. */
  behandlung: DemoPaketBehandlung;
  grund: DemoPaketGrund;
  /** Nur bei `wiederherstellen` aussagekräftig: worin das Objekt abweicht. Leer = nichts zu tun. */
  abweichungen: DemoPaketAbweichung[];
}

/**
 * Die Vorschau VOR dem Zurücksetzen/Entfernen (Nachführung 07:50: „listet GENAU die zugeordneten
 * IDs (Anzahl je Art)"). Sie behauptet nichts über Ähnlichkeit und nichts über Titel — sie liest
 * das Register und den Paketanker, sonst nichts.
 *
 * SIE GEHÖRT ZU EINER AKTION. Runde 3 hatte nur eine Vorschau für beide Handgriffe, und die zeigte
 * den Reset-Plan: vor dem Entfernen stand „wird hergestellt (6)", obwohl gleich alles gelöscht
 * wurde. Deshalb trägt die Antwort die Aktion, zu der sie gehört — wer sie liest, kann sie nicht
 * mehr für die andere halten.
 */
export interface DemoPaketVorschau {
  package: string;
  /** Die Aktion, deren Plan hier steht. */
  aktion: DemoPaketAktion;
  /** Die Laufkennungen, die im Bestand vertreten sind. */
  runs: string[];
  /** Anzahl je Art — `nicht_registriert` für Objekte ohne Registereintrag. */
  counts: Record<string, number>;
  /** ALLE zugeordneten Objekte, einzeln, mit Behandlung und Grund. */
  entries: DemoPaketVorschauEintrag[];
  /** Wie viele Bausteine fehlen und NEU ANGELEGT würden. Beim Entfernen immer 0. */
  missing: number;
}

function itemVon(pkg: DemoPackageDefinition, key: string | null): DemoPackageItem | undefined {
  return key ? pkg.items.find((i) => i.key === key) : undefined;
}

export async function demoPaketUebersicht(
  ko: KoService,
): Promise<{ packages: DemoPackageUebersicht[] }> {
  const packages: DemoPackageUebersicht[] = [];
  for (const pkg of DEMO_PACKAGES) {
    const bestand = await bestandVon(ko, pkg);
    let edited = 0;
    for (const stueck of bestand) {
      const item = itemVon(pkg, stueck.key);
      // Ohne passenden Baustein gibt es keinen Ausgangszustand, gegen den man messen könnte —
      // solche Objekte werden nicht als „bearbeitet" gezählt (das wäre eine erfundene Aussage).
      if (item && abweichungenVon(stueck, pkg, item).length > 0) {
        edited += 1;
      }
    }
    const mitSchluessel = bestand.filter((s) => s.key);
    packages.push({
      id: pkg.id,
      language: pkg.language,
      fictional: pkg.fictional,
      title: pkg.title,
      description: pkg.description,
      items: pkg.items.length,
      areas: [...new Set(pkg.items.map((i) => i.area))],
      loaded: bestand.length,
      duplicates: mitSchluessel.length - nachSchluessel(bestand).size,
      edited,
      registered: bestand.filter((s) => s.eintrag).length,
      runs: new Set(bestand.flatMap((s) => (s.eintrag ? [s.eintrag.lauf] : []))).size,
    });
  }
  return { packages };
}

export async function demoPaketVorschau(
  ko: KoService,
  pkg: DemoPackageDefinition,
  aktion: DemoPaketAktion,
): Promise<DemoPaketVorschau> {
  const bestand = await bestandVon(ko, pkg);
  // DERSELBE Plan, den der Vollzug DIESER Aktion ausführt — nicht eine zweite, nachgebaute
  // Rechnung (daran scheiterte Runde 2) und nicht der Plan der ANDEREN Aktion (Runde 3).
  const plan = planeFuer(bestand, pkg, aktion);
  const counts: Record<string, number> = {};
  const entries: DemoPaketVorschauEintrag[] = plan.stuecke.map((p) => {
    const art = p.stueck.eintrag?.art ?? null;
    const schluessel = art ?? "nicht_registriert";
    counts[schluessel] = (counts[schluessel] ?? 0) + 1;
    return {
      id: p.stueck.id,
      art,
      run: p.stueck.eintrag?.lauf ?? null,
      key: p.stueck.key,
      title: p.stueck.title,
      behandlung: p.behandlung,
      grund: p.grund,
      abweichungen: p.item ? abweichungenVon(p.stueck, pkg, p.item) : [],
    };
  });
  return {
    package: pkg.id,
    aktion,
    runs: [...new Set(entries.flatMap((e) => (e.run ? [e.run] : [])))],
    counts,
    entries,
    missing: plan.fehlend.length,
  };
}
