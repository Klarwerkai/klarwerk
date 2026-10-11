// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische — WIE FRISCH IST EIN WISSENSOBJEKT, UND WAS FOLGT DARAUS.
// ================================================================================================
//
// Eine reine Ableitung, kein Zustand und kein Schreibweg. Sie beantwortet an EINER Stelle die
// Fragen der Originalpunkte R-0207, R-0236, R-0248, R-0266, R-0652, R-1636 und FR-EXT-06:
//   · wie frisch ist es (frisch, altert, fällig, veraltet),
//   · bis wann gilt es als gesichert (Haltbarkeit) und wer muss es bestätigen (Verantwortlicher),
//   · ist es der aktuelle Stand, darf es in erzeugte Dokumente, was wäre der nächste Schritt,
//   · wie schutzbedürftig ist es und in welchem Betriebsmodell darf es verarbeitet werden,
//   · welche geprüften Beiträge einer Person am längsten nicht bestätigt wurden (Vorlage).
//
// WORAUS GERECHNET WIRD — nur aus Feldern, die das Objekt ohnehin trägt:
//   · die letzte Fassung (`history[].at`, sonst `createdAt`) — jede Bestätigung „Noch gültig"
//     erzeugt eine neue Fassung (LifecycleService.confirmStillValid) und setzt damit beides neu;
//   · das letzte Frische-Signal (`frischeSignal`, R-0206): jemand hat das Wissen angewendet und
//     bestätigt, dass es weiterhin stimmt — es macht das Objekt FRISCHER, ist aber keine Prüfung;
//   · die letzte Fristbestätigung (`fristBestaetigung`): dasselbe Signal, aber vom Verantwortlichen.
//     Nur sie (oder eine neue Fassung) verlängert die Haltbarkeit — R-0248: „bis der
//     Verantwortliche es bestätigt".
//
// HALBWERTSZEIT (R-1636, Roadmap 4.2): „KLARWERK lernt aus der Bewährungs-Historie typische
// Halbwertszeiten pro Kategorie". Die Bewährungs-Historie ist die Fassungsfolge der Objekte: jede
// Überarbeitung und jede Bestätigung „Noch gültig" erzeugt eine Fassung. Der Abstand zweier
// aufeinanderfolgender Fassungen ist eine Beobachtung, wie lange ein Stand in dieser Kategorie
// trug. Der Lernstand (`GelernteHalbwertszeiten`) nimmt je Kategorie den Median dieser Abstände, sobald genug
// Beobachtungen vorliegen. Bis dahin gilt die AUSGANGSVORGABE je Wissensart
// (`HALBWERTSZEIT_TAGE`) — ausgewiesen als `halbwertszeitHerkunft: "vorgabe"`. Die Frist eines
// Objekts nutzt den Lernstand ZUM BEGINN seines laufenden Stands (s. `GelernteHalbwertszeiten`):
// eine später gelernte längere Zeit gibt abgelaufenes Wissen nicht ohne Bestätigung wieder frei.
//
// SCHUTZBEDARF (R-0652 / FR-EXT-06): „öffentlich … streng vertraulich". Die Zugriffs- und
// Egress-Stufe `confidentiality` bleibt unverändert dreistufig; „öffentlich" ist eine VERFEINERUNG
// von „intern" (`oeffentlich: true`, nur an internen Objekten wirksam). Damit ändert sich keine
// Sichtbarkeits- oder Egressregel, und die Schutzsicht kann alle vier Stufen zeigen.
//
// FEHLT EINE GRUNDLAGE, WIRD NICHTS GERATEN: ohne lesbares Datum gilt das Objekt als fällig und
// nicht gesichert; ein nicht erhobener Merker oder Konfliktstand steht als Grund in `ungeprueft`
// und sperrt die Freigabe in Dokumente (dieselbe Form wie `discloseDisplayStatus`).
import type { Erhoben } from "./display-status";
import { responsibleKindOf, responsibleOf } from "./ownership";
import type { Confidentiality, KnowledgeObject, KnowledgeType, KoFrischeSignal } from "./types";

export type FrischeStufe = "frisch" | "altert" | "faellig" | "veraltet";

const STUFEN_RANG: readonly FrischeStufe[] = ["frisch", "altert", "faellig", "veraltet"];

/** R-0652: die Schutzsicht — „öffentlich" ist die Verfeinerung von „intern" (s. Kopf). */
export type Schutzstufe = "oeffentlich" | Confidentiality;

/**
 * R-0652 / FR-EXT-06: die Empfehlung, in welchem Betriebsmodell das Objekt verarbeitet werden darf.
 *   · `oeffentliche_ki`  — öffentlich: jede vom Admin freigegebene KI, ohne Vertraulichkeitsvorbehalt;
 *   · `freigegebene_ki`  — intern: ein freigegebener KI-Anbieter, Inhalte bleiben intern;
 *   · `lokales_modell`   — vertraulich: nur ein im Haus betriebenes Modell;
 *   · `ohne_ki`          — streng vertraulich oder Stufe unbekannt: keine Modellverarbeitung.
 * Eine EMPFEHLUNG, kein Tor — die harten Egress-Grenzen bleiben `dropConfidential` und die
 * Cloud-Sperre der Klara-Wege.
 */
export type Betriebsmodell = "oeffentliche_ki" | "freigegebene_ki" | "lokales_modell" | "ohne_ki";

export type FrischeSchritt =
  | "konflikt_klaeren"
  | "validierung_abschliessen"
  | "erneut_bestaetigen"
  | "bald_bestaetigen"
  | "keiner";

/**
 * R-1636: die AUSGANGSVORGABE der Halbwertszeit in Tagen je Wissensart. Sie gilt, solange für die
 * Kategorie eines Objekts noch keine Halbwertszeit aus der Bewährungs-Historie gelernt ist.
 */
export const HALBWERTSZEIT_TAGE: Readonly<Record<KnowledgeType, number>> = {
  technik: 180,
  best_practice: 365,
  lernkurve: 365,
  negativwissen: 730,
  bauchgefuehl: 1095,
};

/** R-1636: so viele Fassungsabstände braucht eine Kategorie, bevor ihre Halbwertszeit gilt. */
export const HALBWERTSZEIT_MINDESTBEOBACHTUNGEN = 3;
/** R-1636: kürzere Fassungsabstände (in Tagen) zählen nicht als Beobachtung. */
export const HALBWERTSZEIT_MINDESTABSTAND_TAGE = 1;
/** R-1636: Grenzen einer gelernten Halbwertszeit in Tagen (ein Ausreisser kippt sie nicht ins Absurde). */
export const HALBWERTSZEIT_GRENZEN_TAGE = { min: 30, max: 1825 } as const;

/** R-0248: so viele Tage vor Fristende wird der Verantwortliche erinnert (höchstens die halbe Frist). */
export const ERINNERUNG_VORLAUF_TAGE = 14;

const TAG_MS = 24 * 60 * 60 * 1000;

/** R-1636: eine gelernte Halbwertszeit samt der Zahl, aus der sie stammt. */
export interface GelernteHalbwertszeit {
  tage: number;
  beobachtungen: number;
}

/** R-1636: eine Beobachtung — wie lange ein Stand trug, und ab wann sie dem Lernen bekannt war (ms). */
interface Beobachtung {
  erfasst: number;
  tage: number;
}

/**
 * R-1636 / R-0248 (Nacharbeit 5, Bens Befund) — EIN FESTGEHALTENER EINTRAG DES LERNVERLAUFS.
 *
 * Der Lernstand eines vergangenen Zeitpunkts darf NICHT aus dem heutigen Bestand rekonstruiert
 * werden: legt jemand das lernende Objekt in den Papierkorb, löscht es endgültig oder ordnet es
 * einer anderen Kategorie zu, verschwände seine Beobachtung — und ein längst abgelaufenes Objekt
 * fiele auf die längere Vorgabe zurück. Deshalb wird jede Beobachtung beim ersten Lernen DAUERHAFT
 * festgehalten (`HalbwertszeitVerlaufRepo`, nur ergänzend) — mit der Kategorie, die sie damals
 * trug, und dem Zeitpunkt `erfasst`, ab dem sie Fristen bestimmen durfte.
 */
export interface HalbwertszeitEintrag {
  koId: string;
  /** Zeitpunkt der späteren Fassung (ISO) — zusammen mit `koId` der Schlüssel. */
  ende: string;
  /** Normalisierte Kategorie zum Zeitpunkt der Erfassung (`kategorieSchluessel`). */
  kategorie: string;
  tage: number;
  /** Ab wann die Beobachtung dem Lernen bekannt war (ISO). */
  erfasst: string;
}

/**
 * R-1636 / R-0248 (Nacharbeit 4, Bens Befund) — DER LERNSTAND IST DATIERT.
 *
 * Bis hierher galt für die Frist eines Objekts immer der JETZIGE Lernwert seiner Kategorie. Stieg
 * er durch Fassungen ANDERER Objekte (etwa von 40 auf 100 Tage), wurde ein seit 60 Tagen
 * unverändertes, bereits abgelaufenes Objekt wieder „gesichert" — ohne dass sein Verantwortlicher
 * etwas bestätigt hätte. Genau das schliesst R-0248 aus.
 *
 * DIE REGEL: jede Beobachtung trägt den Zeitpunkt, ab dem sie dem Lernen bekannt war (`erfasst`).
 * Die Frist eines Objekts rechnet mit dem Lernstand ZUM BEGINN SEINES LAUFENDEN STANDS — also zur
 * letzten Fassung bzw. zur letzten Fristbestätigung des Verantwortlichen (`zum`). Was danach
 * anderswo gelernt wird, ändert diese Frist nicht mehr; es wirkt erst, wenn das Objekt selbst neu
 * bestätigt wird.
 *
 * Nacharbeit 5: im Betrieb stammen die Beobachtungen aus dem FESTGEHALTENEN Lernverlauf
 * (`halbwertszeitenAusVerlauf`, Ablage `HalbwertszeitVerlaufRepo`), nicht aus dem heutigen
 * Bestand. Papierkorb, endgültiges Löschen oder Umkategorisieren anderer Objekte nimmt einem
 * vergangenen Lernstand damit nichts weg und fügt ihm nichts hinzu.
 *
 * `get`/`has` beantworten den Lernstand JETZT — für die Auskunft „was wird gerade gelernt".
 */
export class GelernteHalbwertszeiten {
  constructor(private readonly verlauf: ReadonlyMap<string, readonly Beobachtung[]>) {}

  /** Der Lernstand der Kategorie zum Zeitpunkt `zeitpunkt` (ms) — oder `undefined` (Vorgabe). */
  zum(schluessel: string, zeitpunkt: number): GelernteHalbwertszeit | undefined {
    const liste = (this.verlauf.get(schluessel) ?? [])
      .filter((b) => b.erfasst <= zeitpunkt)
      .map((b) => b.tage);
    if (liste.length < HALBWERTSZEIT_MINDESTBEOBACHTUNGEN) {
      return undefined;
    }
    const sortiert = [...liste].sort((a, b) => a - b);
    const mitte = Math.floor(sortiert.length / 2);
    const median =
      sortiert.length % 2 === 1
        ? (sortiert[mitte] ?? 0)
        : ((sortiert[mitte - 1] ?? 0) + (sortiert[mitte] ?? 0)) / 2;
    const tage = Math.round(
      Math.min(HALBWERTSZEIT_GRENZEN_TAGE.max, Math.max(HALBWERTSZEIT_GRENZEN_TAGE.min, median)),
    );
    return { tage, beobachtungen: liste.length };
  }

  /** Der Lernstand JETZT. */
  get(schluessel: string): GelernteHalbwertszeit | undefined {
    return this.zum(schluessel, Number.POSITIVE_INFINITY);
  }

  has(schluessel: string): boolean {
    return this.get(schluessel) !== undefined;
  }
}

export interface FrischeAuskunft {
  stufe: FrischeStufe;
  halbwertszeitTage: number;
  /** R-1636: aus der Bewährungs-Historie der Kategorie gelernt — oder die Vorgabe der Wissensart. */
  halbwertszeitHerkunft: "gelernt" | "vorgabe";
  /** Zahl der Fassungsabstände, aus denen gelernt wurde (0 bei der Vorgabe). */
  halbwertszeitBeobachtungen: number;
  /** Bezug der Frische: letzte Fassung oder jüngeres Frische-Signal (ISO), `null` ohne lesbares Datum. */
  bezugAm: string | null;
  letztesSignal: KoFrischeSignal | null;
  /** Bis dahin gilt ein validiertes Objekt in Antworten als gesichert (ISO), `null` ohne Datum. */
  haltbarBis: string | null;
  erinnerungAb: string | null;
  /** Ab `erinnerungAb` und vor Fristende: der Verantwortliche soll bestätigen. */
  erinnern: boolean;
  verantwortlich: string;
  verantwortlichArt: "owner" | "author-fallback";
  /** R-0248: validiert, Frist nicht abgelaufen, keine erneute Prüfung angefordert. */
  gesichert: boolean;
  /** R-0236: validiert, frisch oder alternd, keine erneute Prüfung angefordert. */
  aktuellerStand: boolean;
  /** R-0652: die gültige Schutzstufe — `null`, wenn der Bestand keine gültige trägt. */
  schutz: Schutzstufe | null;
  betriebsmodell: Betriebsmodell;
  /** R-0207: darf in erzeugte Dokumente (validiert, aktuell, ohne Konflikt, nicht vertraulich). */
  inDokumente: boolean;
  naechsterSchritt: FrischeSchritt;
  /** Eingänge, die für diese Auskunft nicht erhoben werden konnten — mit Grund. */
  ungeprueft: { revalidierung?: string; konflikt?: string };
}

export interface FrischeEingaenge {
  readonly revalidierung: Erhoben<boolean>;
  readonly konflikt: Erhoben<boolean>;
}

type FrischeKo = Pick<
  KnowledgeObject,
  | "type"
  | "category"
  | "status"
  | "createdAt"
  | "history"
  | "author"
  | "ownership"
  | "confidentiality"
  | "oeffentlich"
  | "frischeSignal"
  | "fristBestaetigung"
  | "fristGrundlage"
>;

function zeit(wert: string | undefined): number {
  return wert === undefined ? Number.NaN : Date.parse(wert);
}

/** Der späteste lesbare Zeitpunkt — `NaN`, wenn keiner lesbar ist. */
function spaetester(...werte: number[]): number {
  const lesbar = werte.filter((w) => Number.isFinite(w));
  return lesbar.length === 0 ? Number.NaN : Math.max(...lesbar);
}

function iso(ms: number): string | null {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function letzteFassungMs(ko: Pick<KnowledgeObject, "createdAt" | "history">): number {
  return spaetester(zeit(ko.createdAt), ...(ko.history ?? []).map((h) => zeit(h.at)));
}

/** R-1636: Kategorien werden ohne Rand und ohne Gross-/Kleinschreibung zusammengefasst. */
export function kategorieSchluessel(kategorie: string | undefined): string {
  return (kategorie ?? "").trim().toLocaleLowerCase("de");
}

/**
 * R-1636: die Beobachtungen, die der HEUTIGE Bestand trägt — noch ohne Erfassungszeitpunkt.
 *
 * Beobachtung = Abstand zweier aufeinanderfolgender Fassungen desselben Objekts (in Tagen, ab
 * `HALBWERTSZEIT_MINDESTABSTAND_TAGE`), geschlüsselt über Objekt und spätere Fassung (`ende`).
 * Gelöschte Objekte liefern keine NEUEN Beobachtungen; Objekte ohne Kategorie auch nicht.
 */
export function beobachtungenAus(
  kos: readonly Pick<KnowledgeObject, "id" | "category" | "history" | "deletedAt">[],
): Omit<HalbwertszeitEintrag, "erfasst">[] {
  const aus: Omit<HalbwertszeitEintrag, "erfasst">[] = [];
  for (const ko of kos) {
    const kategorie = kategorieSchluessel(ko.category);
    if (ko.deletedAt || kategorie === "") {
      continue;
    }
    const zeiten = (ko.history ?? [])
      .map((h) => zeit(h.at))
      .filter((ms) => Number.isFinite(ms))
      .sort((a, b) => a - b);
    for (let i = 1; i < zeiten.length; i++) {
      const ende = zeiten[i] ?? 0;
      const tage = (ende - (zeiten[i - 1] ?? 0)) / TAG_MS;
      // Fassungen am selben Tag (Tippfehler, Freigabe direkt nach Anlage) sagen nichts darüber,
      // wie lange ein Stand trägt — erst ein Abstand ab einem Tag ist eine Beobachtung.
      if (tage >= HALBWERTSZEIT_MINDESTABSTAND_TAGE) {
        aus.push({ koId: ko.id, ende: new Date(ende).toISOString(), kategorie, tage });
      }
    }
  }
  return aus;
}

/**
 * R-1636 / R-0248: der Lernstand aus dem FESTGEHALTENEN Verlauf — so rechnet der Betrieb
 * (`KoService.gelernteHalbwertszeiten`). Jede Beobachtung zählt in ihrer erfassten Kategorie und
 * erst ab ihrem Erfassungszeitpunkt.
 */
export function halbwertszeitenAusVerlauf(
  eintraege: readonly HalbwertszeitEintrag[],
): GelernteHalbwertszeiten {
  const verlauf = new Map<string, Beobachtung[]>();
  for (const e of eintraege) {
    const erfasst = Date.parse(e.erfasst);
    if (!Number.isFinite(erfasst) || e.kategorie === "") {
      continue;
    }
    const liste = verlauf.get(e.kategorie) ?? [];
    liste.push({ erfasst, tage: e.tage });
    verlauf.set(e.kategorie, liste);
  }
  return new GelernteHalbwertszeiten(verlauf);
}

interface Halbwertszeit {
  tage: number;
  herkunft: "gelernt" | "vorgabe";
  beobachtungen: number;
}

/** Beginn des laufenden Stands in ms: letzte Fassung oder letzte Fristbestätigung — `NaN` ohne Datum. */
function fristBezugMs(
  ko: Pick<KnowledgeObject, "createdAt" | "history" | "fristBestaetigung">,
): number {
  return spaetester(letzteFassungMs(ko), zeit(ko.fristBestaetigung?.at));
}

/**
 * R-0248 (Nacharbeit 7, Bens Befund) — DIE KATEGORIE GEHÖRT ZUM BESTÄTIGTEN STAND.
 *
 * Eine Kategorie wird ohne neue Fassung und ohne Fristbestätigung geändert (Einordnung,
 * `KoService.updateCategory`). Rechnete die Frist mit der JETZIGEN Kategorie, gäbe schon das
 * Umkategorisieren eines abgelaufenen Objekts es wieder frei — etwa von einer gelernten 40-Tage-Frist
 * auf die 365-Tage-Vorgabe einer Kategorie ohne Lernstand.
 *
 * Deshalb hält der erste Kategoriewechsel innerhalb eines Stands die Kategorie fest, mit der dieser
 * Stand begann (`fristGrundlage`, mit dem Beginn des Stands als `ab`). Solange der Stand läuft,
 * rechnet die Frist mit ihr. Beginnt ein neuer Stand (neue Fassung oder Fristbestätigung des
 * Verantwortlichen), passt `ab` nicht mehr — dann gilt die aktuelle Kategorie.
 */
function fristKategorie(ko: FrischeKo): string {
  const grundlage = ko.fristGrundlage;
  return grundlage && grundlage.ab === iso(fristBezugMs(ko)) ? grundlage.kategorie : ko.category;
}

/**
 * R-0248: die Festschreibung beim Kategoriewechsel (s. `fristKategorie`) — für `updateCategory`.
 * Eine Grundlage, die schon zum laufenden Stand gehört, bleibt stehen (der ERSTE Wechsel zählt);
 * eine aus einem früheren Stand wird ersetzt. Ohne lesbaren Beginn gibt es nichts festzuhalten.
 */
export function fristGrundlageBeiKategoriewechsel(
  ko: Pick<
    KnowledgeObject,
    "category" | "createdAt" | "history" | "fristBestaetigung" | "fristGrundlage"
  >,
): { kategorie: string; ab: string } | undefined {
  const ab = iso(fristBezugMs(ko));
  if (ab === null) {
    return ko.fristGrundlage;
  }
  if (ko.fristGrundlage?.ab === ab) {
    return ko.fristGrundlage;
  }
  return { kategorie: ko.category, ab };
}

/**
 * R-1636: die Halbwertszeit des Objekts — gelernt für seine Kategorie, sonst die Vorgabe.
 * Nacharbeit 4 (R-0248): gelernt ZUM BEGINN DES LAUFENDEN STANDS (`GelernteHalbwertszeiten.zum`),
 * damit eine spätere Verlängerung der Kategoriezeit abgelaufenes Wissen nicht wieder freigibt.
 * Ohne lesbaren Beginn gibt es keinen Lernstand — dann gilt die Vorgabe (die Frist ist ohnehin
 * nicht belegt und damit abgelaufen).
 */
function halbwertszeitVon(
  ko: FrischeKo,
  gelernt: GelernteHalbwertszeiten | undefined,
): Halbwertszeit {
  const beginn = fristBezugMs(ko);
  const aus = Number.isFinite(beginn)
    ? gelernt?.zum(kategorieSchluessel(fristKategorie(ko)), beginn)
    : undefined;
  if (aus) {
    return { tage: aus.tage, herkunft: "gelernt", beobachtungen: aus.beobachtungen };
  }
  return { tage: HALBWERTSZEIT_TAGE[ko.type] ?? 365, herkunft: "vorgabe", beobachtungen: 0 };
}

/** Ende der Haltbarkeit in ms — `NaN` ohne lesbares Datum. */
function haltbarBisMs(ko: FrischeKo, tage: number): number {
  return fristBezugMs(ko) + tage * TAG_MS;
}

/**
 * R-0248: ist die Haltbarkeit abgelaufen? Der Fragepfad nutzt genau diese Zeile, damit ein
 * validiertes Objekt nach Fristende in Antworten nicht mehr als gesichert gilt. Ohne lesbares
 * Datum ist die Frist nicht belegt — und damit abgelaufen (fail-closed).
 */
export function haltbarkeitAbgelaufen(
  ko: FrischeKo,
  jetztMs: number,
  gelernt?: GelernteHalbwertszeiten,
): boolean {
  const bis = haltbarBisMs(ko, halbwertszeitVon(ko, gelernt).tage);
  return !Number.isFinite(bis) || jetztMs >= bis;
}

function hoehere(a: FrischeStufe, b: FrischeStufe): FrischeStufe {
  return STUFEN_RANG.indexOf(a) >= STUFEN_RANG.indexOf(b) ? a : b;
}

function betriebsmodellFuer(schutz: Schutzstufe | null): Betriebsmodell {
  if (schutz === "oeffentlich") {
    return "oeffentliche_ki";
  }
  if (schutz === "intern") {
    return "freigegebene_ki";
  }
  if (schutz === "vertraulich") {
    return "lokales_modell";
  }
  return "ohne_ki";
}

/**
 * Fehlt das Feld (Altbestand), gilt „intern"; ein ungültiger Wert ist unbekannt (`null`).
 * „öffentlich" gilt NUR an einem internen Objekt — an einem vertraulichen wäre die Marke ein
 * Widerspruch, und dann gewinnt die strengere Stufe.
 */
function schutzVon(
  ko: Pick<KnowledgeObject, "confidentiality" | "oeffentlich">,
): Schutzstufe | null {
  const wert: unknown = ko.confidentiality;
  const stufe: Confidentiality | null =
    wert === undefined || wert === null
      ? "intern"
      : wert === "intern" || wert === "vertraulich" || wert === "streng_vertraulich"
        ? wert
        : null;
  return stufe === "intern" && ko.oeffentlich === true ? "oeffentlich" : stufe;
}

export function frischeVon(
  ko: FrischeKo,
  jetztMs: number,
  eingaenge: FrischeEingaenge,
  gelernt?: GelernteHalbwertszeiten,
): FrischeAuskunft {
  const halbwertszeit = halbwertszeitVon(ko, gelernt);
  const signal = ko.frischeSignal ?? null;
  const bezug = spaetester(letzteFassungMs(ko), zeit(signal?.at));
  const bis = haltbarBisMs(ko, halbwertszeit.tage);
  const vorlauf = Math.min(ERINNERUNG_VORLAUF_TAGE, halbwertszeit.tage / 2) * TAG_MS;
  const erinnerungAb = bis - vorlauf;
  const abgelaufen = !Number.isFinite(bis) || jetztMs >= bis;

  const ungeprueft: FrischeAuskunft["ungeprueft"] = {};
  if ("ungeprueft" in eingaenge.revalidierung) {
    ungeprueft.revalidierung = eingaenge.revalidierung.ungeprueft;
  }
  if ("ungeprueft" in eingaenge.konflikt) {
    ungeprueft.konflikt = eingaenge.konflikt.ungeprueft;
  }
  const angefordert = "wert" in eingaenge.revalidierung && eingaenge.revalidierung.wert;
  const keineAnforderung = "wert" in eingaenge.revalidierung && !eingaenge.revalidierung.wert;
  const imKonflikt = "wert" in eingaenge.konflikt && eingaenge.konflikt.wert;
  const ohneKonflikt = "wert" in eingaenge.konflikt && !eingaenge.konflikt.wert;

  let stufe: FrischeStufe;
  if (!Number.isFinite(bezug)) {
    stufe = "faellig";
  } else {
    const alter = jetztMs - bezug;
    const h = halbwertszeit.tage * TAG_MS;
    stufe =
      alter < h / 2 ? "frisch" : alter < h ? "altert" : alter < 2 * h ? "faellig" : "veraltet";
  }
  if (abgelaufen || angefordert) {
    stufe = hoehere(stufe, "faellig");
  }

  const validiert = ko.status === "validiert";
  const aktuell = stufe === "frisch" || stufe === "altert";
  const schutz = schutzVon(ko);
  const erinnern = Number.isFinite(bis) && jetztMs >= erinnerungAb && jetztMs < bis;

  let naechsterSchritt: FrischeSchritt;
  if (imKonflikt) {
    naechsterSchritt = "konflikt_klaeren";
  } else if (!validiert) {
    naechsterSchritt = "validierung_abschliessen";
  } else if (!aktuell) {
    naechsterSchritt = "erneut_bestaetigen";
  } else if (erinnern) {
    naechsterSchritt = "bald_bestaetigen";
  } else {
    naechsterSchritt = "keiner";
  }

  return {
    stufe,
    halbwertszeitTage: halbwertszeit.tage,
    halbwertszeitHerkunft: halbwertszeit.herkunft,
    halbwertszeitBeobachtungen: halbwertszeit.beobachtungen,
    bezugAm: iso(bezug),
    letztesSignal: signal,
    haltbarBis: iso(bis),
    erinnerungAb: iso(erinnerungAb),
    erinnern,
    verantwortlich: responsibleOf(ko),
    verantwortlichArt: responsibleKindOf(ko),
    gesichert: validiert && !abgelaufen && keineAnforderung,
    aktuellerStand: validiert && aktuell && keineAnforderung,
    schutz,
    betriebsmodell: betriebsmodellFuer(schutz),
    inDokumente:
      validiert &&
      aktuell &&
      keineAnforderung &&
      ohneKonflikt &&
      (schutz === "intern" || schutz === "oeffentlich"),
    naechsterSchritt,
    ungeprueft,
  };
}

/** Die Auskunft als Feld der Leseantwort — dieselbe Bauform wie `discloseDisplayStatus`. */
export function discloseFrische(
  ko: FrischeKo,
  jetztMs: number,
  eingaenge: FrischeEingaenge,
  gelernt?: GelernteHalbwertszeiten,
): { frische: FrischeAuskunft } {
  return { frische: frischeVon(ko, jetztMs, eingaenge, gelernt) };
}

// ================================================================================================
// R-0248 / R-0266 — WAS DER VERANTWORTLICHEN PERSON VORGELEGT WIRD.
// ================================================================================================
//
// Für die persönliche Zustellung (Glocke, `services/app/src/frische-meldungen.ts`). Merker- und
// Konfliktlage werden hier NICHT erhoben — die Fristen hängen nur an Datum und Halbwertszeit.
const NICHT_ERHOBEN: FrischeEingaenge = {
  revalidierung: { ungeprueft: "Für die persönliche Vorlage nicht erhoben." },
  konflikt: { ungeprueft: "Für die persönliche Vorlage nicht erhoben." },
};

export interface FristHinweis {
  koId: string;
  title: string;
  /** Ab wann die Erinnerung ansteht (ISO). */
  erinnerungAb: string;
  haltbarBis: string;
  /** Die Frist ist bereits abgelaufen. */
  abgelaufen: boolean;
}

/**
 * R-0248: die geprüften Objekte, für die `person` verantwortlich ist und deren Frist im
 * Erinnerungsfenster liegt oder schon abgelaufen ist — ohne lesbares Datum gibt es keinen Termin
 * und damit auch keine Erinnerung (das Objekt steht dann ohnehin als fällig im Reiter „Erneut").
 */
export function fristHinweiseFuer(
  kos: readonly (FrischeKo & Pick<KnowledgeObject, "id" | "title">)[],
  person: string,
  jetztMs: number,
  gelernt?: GelernteHalbwertszeiten,
): FristHinweis[] {
  const aus: FristHinweis[] = [];
  for (const ko of kos) {
    if (ko.status !== "validiert" || responsibleOf(ko) !== person) {
      continue;
    }
    const auskunft = frischeVon(ko, jetztMs, NICHT_ERHOBEN, gelernt);
    if (!auskunft.haltbarBis || !auskunft.erinnerungAb) {
      continue;
    }
    const abgelaufen = jetztMs >= Date.parse(auskunft.haltbarBis);
    if (auskunft.erinnern || abgelaufen) {
      aus.push({
        koId: ko.id,
        title: ko.title,
        erinnerungAb: auskunft.erinnerungAb,
        haltbarBis: auskunft.haltbarBis,
        abgelaufen,
      });
    }
  }
  return aus;
}

/**
 * R-0266: die ältesten geprüften Beiträge, für die `person` verantwortlich ist — ältester Bezug
 * zuerst, höchstens `anzahl`. Dieselbe Regel wie die Liste im Reiter „Erneut"
 * (`apps/web/src/lib/frische.ts`, `aeltesteVorlage`), dort aus der Server-Frische gelesen.
 */
export function aeltesteVorlageFuer(
  kos: readonly (FrischeKo & Pick<KnowledgeObject, "id" | "title">)[],
  person: string,
  jetztMs: number,
  anzahl: number,
  gelernt?: GelernteHalbwertszeiten,
): { koId: string; title: string; bezugAm: string | null }[] {
  return kos
    .filter((ko) => ko.status === "validiert" && responsibleOf(ko) === person)
    .map((ko) => ({
      koId: ko.id,
      title: ko.title,
      bezugAm: frischeVon(ko, jetztMs, NICHT_ERHOBEN, gelernt).bezugAm,
    }))
    .sort((a, b) => {
      const za = a.bezugAm ? Date.parse(a.bezugAm) : Number.NEGATIVE_INFINITY;
      const zb = b.bezugAm ? Date.parse(b.bezugAm) : Number.NEGATIVE_INFINITY;
      return za === zb ? 0 : za < zb ? -1 : 1;
    })
    .slice(0, anzahl);
}
