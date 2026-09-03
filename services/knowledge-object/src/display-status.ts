import type { KnowledgeObject } from "./types";

// Abgeleiteter Anzeigestatus (Abstimmpunkt 1). Der fachliche Kern-Enum bleibt
// offen|validiert; die feineren Anzeigestufen werden aus vorhandenen Feldern und
// Kontext-Flags abgeleitet. Eine Quelle für Backend und Frontend.
export type DisplayStatus =
  | "entwurf"
  | "offen"
  | "pruefung"
  | "validiert"
  | "abgelehnt"
  | "revalidierung"
  | "konflikt";

// ================================================================================================
// JOB 3024 · `entwurf` STEHT IN DER AUFZAEHLUNG UND WIRD VON HIER NIE ZURUECKGEGEBEN.
// ================================================================================================
//
// Das ist kein Versehen und keine Luecke, die noch zu schliessen waere: ein Entwurf ist gar kein
// Wissensobjekt. Er ist eine eigene Entitaet des Erfassungsmoduls (`services/capture`, `DraftPayload`)
// mit eigenem Bestand und eigenen Routen (`/api/drafts/...`); erst die Uebernahme
// (`ko-routes.ts`, `draftPromotion`) macht aus ihm ein `KnowledgeObject` — und ab da ist er kein
// Entwurf mehr. Diese Funktion bekommt ausschliesslich Wissensobjekte zu sehen und kann die Stufe
// deshalb weder erreichen noch ehrlich behaupten.
//
// Die Stufe bleibt trotzdem in der Aufzaehlung, weil die Oberflaeche BEIDE Bestaende in EINER
// Statusleiste zeigt (`apps/web/src/components/trust/types.ts:5`). Ein zweites Vokabular fuer
// denselben Gedanken waere eine zweite Wahrheit; ein hier erfundener `entwurf`-Zweig waere eine
// Attrappe. Gepinnt in `services/app/src/routes/ko-routes-anzeigestatus.test.ts` (Fall E), und zwar
// an BEIDEN Enden: am Quelltext dieser Datei und am echten Lesepfad.
export function displayStatus(
  ko: Pick<KnowledgeObject, "status" | "assignments">,
  flags: { conflict?: boolean; revalidation?: boolean; rejected?: boolean } = {},
): DisplayStatus {
  if (flags.conflict) {
    return "konflikt";
  }
  if (flags.rejected) {
    return "abgelehnt";
  }
  if (ko.status === "validiert") {
    return flags.revalidation ? "revalidierung" : "validiert";
  }
  if (ko.assignments.length > 0) {
    return "pruefung";
  }
  return "offen";
}

// ================================================================================================
// JOB 3024 · DIE STUFE ALS AUSKUNFT — EINE REGEL, EINE STELLE, NEBEN DER ABLEITUNG.
// ================================================================================================
//
// WARUM DAS HIER STEHT UND NICHT AN DER ROUTE. Der Ausdruck „welche Stufe kommt heraus, und was ist
// dafuer NICHT erhoben worden" ist EINE Entscheidung. Steht sie beim Beschaffer der Eingaenge, gibt
// es sie einmal je Lesepfad — und jede Kopie ist eine eigene Auslegung. Der zweite Lesepfad (die
// Liste, eigener Auftrag) faende hier sonst nichts vor und schriebe die Regel neu. Es ist derselbe
// Grund, aus dem `discloseConfidentiality` neben der Stufengrenze wohnt (confidentiality.ts:44-73)
// und nicht viermal in den Routen.
//
// DIE ARBEITSTEILUNG IST SCHARF: Der Aufrufer beschafft FAKTEN (welche Zuweisungen, gibt es eine
// rote Stimme) oder nennt einen GRUND, warum er sie nicht beschafft hat. Diese Datei entscheidet
// daraus die Stufe UND die Herkunft. Der Aufrufer kann den Befund „geprueft" nicht selbst setzen —
// er entsteht allein daraus, ob ein WERT geliefert wurde. Damit gibt es keine Stelle, an der jemand
// „geprueft" behaupten koennte, ohne nachgesehen zu haben.
//
// KEIN FELD OHNE FRISCHE GRUNDLAGE: ein nicht erhobener Eingang wird NICHT als `false` gesetzt.
// `false` hiesse „nachgesehen und nicht der Fall"; hier heisst es „nicht nachgesehen, und hier ist
// der Grund". Genau diese Unterscheidung ist der Auftrag.

/** Wurde ein Eingang der Ableitung an einem konkreten Lesepfad tatsaechlich erhoben? */
export type Eingangsbefund = "geprueft" | "ungeprueft";

/** Die fuenf Eingaenge, aus denen `displayStatus` seine Stufe zieht. */
export type Anzeigestatuseingang =
  | "status"
  | "zuweisungen"
  | "bewertungen"
  | "konflikt"
  | "revalidierung";

/**
 * Ein Eingang: ENTWEDER ein erhobener Wert ODER ein benannter Grund, warum er fehlt.
 *
 * Bewusst eine Entweder-oder-Form und kein `T | undefined`: ein fehlender Wert OHNE Grund ist damit
 * nicht ausdrueckbar, und der Compiler — nicht eine Sichtpruefung — haelt die Zusage aus §9 des
 * Auftrags aufrecht („nie als ‚nicht vorhanden‘").
 */
export type Erhoben<T> = { readonly wert: T } | { readonly ungeprueft: string };

/** Die Eingaenge, die ein Lesepfad zur Ableitung beisteuert. `status` kommt vom Objekt selbst. */
export interface AnzeigestatusEingaenge {
  /** Die OFFENEN Zuweisungen dieses Objekts — NICHT `KnowledgeObject.assignments` (s. unten). */
  readonly zuweisungen: Erhoben<readonly string[]>;
  /** Liegt mindestens eine rote Bewertung der AKTUELLEN Fassung vor? */
  readonly bewertungen: Erhoben<{ readonly rejected: boolean }>;
  readonly konflikt: Erhoben<boolean>;
  readonly revalidierung: Erhoben<boolean>;
}

export interface AnzeigestatusHerkunft extends Record<Anzeigestatuseingang, Eingangsbefund> {
  /**
   * Zu JEDEM ungeprueften Eingang der benannte Grund. Ein Eingang steht genau dann hier, wenn er
   * oben „ungeprueft" ist — beides entsteht aus derselben Schleife und kann nicht auseinanderlaufen.
   */
  readonly ungeprueft: Readonly<Partial<Record<Anzeigestatuseingang, string>>>;
}

export interface AnzeigestatusAuskunft {
  readonly anzeigestatus: DisplayStatus;
  readonly anzeigestatusHerkunft: AnzeigestatusHerkunft;
}

/** Die vier Eingaenge, die ein Lesepfad beschaffen muss; `status` traegt das Objekt selbst. */
const BESCHAFFTE_EINGAENGE = [
  "zuweisungen",
  "bewertungen",
  "konflikt",
  "revalidierung",
] as const satisfies readonly Anzeigestatuseingang[];

/**
 * Die Anzeigestufe samt ausgewiesener Herkunft — reine Funktion, kein Zustand, kein Schreibweg.
 *
 * DIE ZUWEISUNGEN KOMMEN AUS DEM PARAMETER UND NICHT AUS `ko`. `KnowledgeObject.assignments` sieht
 * aus wie die Zuweisungsliste, wird im Produkt aber genau einmal geschrieben — `service.ts:1644`
 * setzt sie auf `[]`, kein Schreibweg aendert sie je; die echten Zuweisungen liegen im
 * `AssignmentRepo` der Validierung. Wer das Feld hier laese, bekaeme dauerhaft eine leere Liste und
 * damit fuer JEDES offene Objekt „offen". Deshalb nimmt diese Funktion vom Objekt NUR den Status.
 */
export function discloseDisplayStatus(
  ko: Pick<KnowledgeObject, "status">,
  eingaenge: AnzeigestatusEingaenge,
): AnzeigestatusAuskunft {
  const ungeprueft: Partial<Record<Anzeigestatuseingang, string>> = {};
  for (const name of BESCHAFFTE_EINGAENGE) {
    const eingang = eingaenge[name];
    if ("ungeprueft" in eingang) {
      ungeprueft[name] = eingang.ungeprueft;
    }
  }
  const zuweisungen = "wert" in eingaenge.zuweisungen ? eingaenge.zuweisungen.wert : [];
  // Nur erhobene Eingaenge werden gesetzt. Ein ungesetztes Flag ist fuer `displayStatus`
  // „nicht der Fall" — was hier fehlt, steht dafuer als Grund in der Herkunft.
  const flags: { conflict?: boolean; revalidation?: boolean; rejected?: boolean } = {};
  if ("wert" in eingaenge.bewertungen) {
    flags.rejected = eingaenge.bewertungen.wert.rejected;
  }
  if ("wert" in eingaenge.konflikt) {
    flags.conflict = eingaenge.konflikt.wert;
  }
  if ("wert" in eingaenge.revalidierung) {
    flags.revalidation = eingaenge.revalidierung.wert;
  }
  const befund = (name: Anzeigestatuseingang): Eingangsbefund =>
    name in ungeprueft ? "ungeprueft" : "geprueft";
  return {
    anzeigestatus: displayStatus({ status: ko.status, assignments: [...zuweisungen] }, flags),
    anzeigestatusHerkunft: {
      // Der Kern-Enum steht am Objekt und ist mit ihm geladen — an jedem Lesepfad erhoben.
      status: "geprueft",
      zuweisungen: befund("zuweisungen"),
      bewertungen: befund("bewertungen"),
      konflikt: befund("konflikt"),
      revalidierung: befund("revalidierung"),
      ungeprueft,
    },
  };
}
