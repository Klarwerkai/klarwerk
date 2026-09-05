import type { AnzeigestatusEingang, KnowledgeObject } from "../api/types";
import type { DisplayStatus } from "../components/trust/types";

// Abgeleiteter Anzeigestatus (BRIEF §5, Abstimmpunkt 1). Der fachliche Kern-Enum
// im Backend ist offen|validiert; die feineren Pills werden hier aus den
// vorhandenen Feldern abgeleitet.
//
// JOB 3072 (N4): DIESE FUNKTION IST NICHT MEHR DIE ERSTE ADRESSE — sie ist der RÜCKFALL.
// Der Server erhebt die Stufe seit JOB 3024/3043/3054 selbst (`discloseDisplayStatus`,
// services/knowledge-object/src/display-status.ts:131) und schickt sie als `ko.anzeigestatus` mit.
// Wer den Zustand eines Eintrags ANZEIGEN will, ruft `anzeigestatusAus` darunter; `deriveStatus`
// bleibt exportiert, weil es zwei Aufgaben behält:
//   · den benannten Rückfall INNERHALB von `anzeigestatusAus`, wenn keine Auskunft mitkam, und
//   · seine Aufrufer außerhalb der Bibliothek (Prüfbrett, Start, Facetten, Mobil) — sie liegen
//     außerhalb der Zielpfade dieses Auftrags und sind in der Rückgabe als Restschuld benannt.
//
// WAS `deriveStatus` NICHT KANN, und das ist der Grund für alles darunter: `ko.assignments` ist im
// Produkt tot. `services/knowledge-object/src/service.ts:1644` setzt das Feld einmalig auf `[]`,
// und KEIN Schreibweg ändert es je (nachgewiesen in `display-status.ts:125-129`); die echten
// Zuweisungen liegen im `AssignmentRepo` der Validierung. Von den sieben Stufen sind aus dieser
// Funktion allein `offen` und `validiert` erreichbar — `pruefung`, `abgelehnt` und `revalidierung`
// nur über `flags`, die im Lesepfad der Bibliothek niemand setzen konnte.
export function deriveStatus(
  ko: { status: "offen" | "validiert"; assignments?: string[] },
  flags?: { conflict?: boolean; revalidation?: boolean; rejected?: boolean },
): DisplayStatus {
  if (flags?.conflict) {
    return "konflikt";
  }
  if (flags?.rejected) {
    return "abgelehnt";
  }
  if (ko.status === "validiert") {
    return flags?.revalidation ? "revalidierung" : "validiert";
  }
  if (ko.assignments && ko.assignments.length > 0) {
    return "pruefung";
  }
  return "offen";
}

// ================================================================================================
// JOB 3072 · N4 — DIE EINE STELLE, DIE ENTSCHEIDET, WELCHEN DER SIEBEN ZUSTÄNDE DIE APP ZEIGT.
// ================================================================================================
//
// WARUM ES SIE GEBEN MUSS. Bis zu diesem Auftrag rechnete die Bibliothek den Zustand an DREI
// Stellen selbst aus (`BibliothekFlaeche.tsx:316`, `:380`, `BibliothekLesen.tsx:424`) — auf
// Eingängen, die sie gar nicht hatte. Der Server hatte die Antwort längst erhoben und schickte sie
// mit; die Oberfläche warf sie am Draht weg. Jetzt fällt die Entscheidung einmal, hier, und Punkt,
// Wort, Pille und Segment-Umschalter lesen dasselbe Ergebnis.
//
// DIE REIHENFOLGE DER DREI ZWEIGE IST BEGRÜNDET UND NICHT BELIEBIG:
//
// 1. DER KONFLIKT DER OBERFLÄCHE SCHLÄGT ALLES. Er ist die einzige Konfliktkenntnis, die es gibt:
//    der Server weist diesen Eingang an BEIDEN Leserouten dauerhaft als `ungeprueft` aus, mit
//    Grund (`ko-routes.ts:473-480`) — `ConflictService` bietet keine Abfrage je Objekt. Die
//    Konfliktliste der Fläche (`useConflicts` + `conflictImpact`) ist also nicht eine zweite
//    Meinung neben dem Server, sondern die einzige. Sie steht vorn, weil ein offener Konflikt die
//    Auskunft ist, die den Leser am meisten angeht (dieselbe Regel wie `conflictLimitedUsability`).
//    KEIN UMKEHRSCHLUSS: `konflikt: false` heißt „kein Konflikt BEKANNT" und wird hier zu gar
//    nichts — ein fehlendes rotes Signal behauptet nichts (Lehre JOB 3025).
//
// 2. SONST GILT, WAS DER SERVER ERHOBEN HAT. Auch über dem Listendeckel und nach einer
//    fehlgeschlagenen Teilabfrage ist dieser Wert ehrlich: `discloseDisplayStatus` setzt einen
//    Flag NUR aus einem erhobenen Eingang (`display-status.ts:142-154`), ein ungeprüfter Eingang
//    wird nie zu `false`. Über dem Deckel bleibt deshalb genau der gespeicherte Status übrig —
//    also das, was die Oberfläche früher selbst geraten hätte, nicht mehr.
//
// 3. FEHLT DAS FELD, IST DER RÜCKFALL BENANNT. `herkunft: "bestand"` sagt maschinenlesbar, dass
//    hier keine Erhebung dahintersteht. Das ist der Normalfall an jeder Route, die die Auskunft
//    nicht führt (die Suche) — und es ist eine schwächere Aussage, keine stille Umdeutung.

/** Woher die gezeigte Zahl stammt: aus der Erhebung des Servers oder aus dem eigenen Bestand. */
export type AnzeigestatusQuelle = "server" | "bestand";

export interface AnzeigestatusAuskunft {
  /** Der Zustand, der gezeigt wird — Punkt, Wort, Pille und Segment nehmen genau diesen. */
  readonly status: DisplayStatus;
  readonly herkunft: AnzeigestatusQuelle;
  /**
   * Die Eingänge, die der Server für DIESE Antwort ausdrücklich NICHT erhoben hat.
   *
   * Leer heißt NICHT „alles geprüft": ohne Herkunftsauskunft (`herkunft: "bestand"`) ist gar nichts
   * erhoben worden, und genau das sagt dann die Herkunft. Hier steht nur, was der Server BENANNT
   * hat — eine erfundene Vollzähligkeit wäre die Behauptung, die dieser Auftrag abschafft.
   */
  readonly ungeprueft: readonly AnzeigestatusEingang[];
}

/** Die Felder, die diese Entscheidung braucht — mehr sieht sie vom Objekt nicht. */
export type AnzeigestatusQuellobjekt = Pick<
  KnowledgeObject,
  "status" | "assignments" | "anzeigestatus" | "anzeigestatusHerkunft"
>;

export function anzeigestatusAus(
  ko: AnzeigestatusQuellobjekt,
  lage: { konflikt: boolean },
): AnzeigestatusAuskunft {
  // Die Reihenfolge der Schlüssel kommt vom Server (`BESCHAFFTE_EINGAENGE`, display-status.ts:115)
  // und wird hier nicht neu erfunden — es entsteht keine zweite Aufzählung der Eingänge.
  const ungeprueft = Object.keys(
    ko.anzeigestatusHerkunft?.ungeprueft ?? {},
  ) as AnzeigestatusEingang[];
  if (lage.konflikt) {
    // `bestand`, und das ist wörtlich zu nehmen: diese Zahl ist NICHT die des Servers.
    return { status: "konflikt", herkunft: "bestand", ungeprueft };
  }
  if (ko.anzeigestatus) {
    return { status: ko.anzeigestatus, herkunft: "server", ungeprueft };
  }
  return { status: deriveStatus(ko), herkunft: "bestand", ungeprueft };
}

/**
 * Der Anker: Herkunft und Lücke MASCHINENLESBAR am Element, ohne ein einziges neues Wort auf dem
 * Bildschirm.
 *
 * Die Bibliothek darf keinen Erklärtext tragen (`tests/design/zielbild-h4-kein-erklaertext.test.ts`),
 * und ein neuer Übersetzungsschlüssel entsteht in diesem Auftrag ausdrücklich nicht. Wer wissen
 * will, worauf ein gezeigter Zustand steht, liest ihn deshalb am Attribut — Test, Werkzeug oder
 * Browserkonsole.
 *
 * `undefined` statt leerem Wert: React lässt das Attribut dann weg. Ein `data-…-ungeprueft=""`
 * stünde da wie „nachgesehen, nichts offen" — und genau das wäre die Aussage ohne Grundlage.
 */
export interface AnzeigestatusAnker {
  "data-anzeigestatus-herkunft": AnzeigestatusQuelle;
  "data-anzeigestatus-ungeprueft": string | undefined;
}

export function anzeigestatusAnker(auskunft: AnzeigestatusAuskunft): AnzeigestatusAnker {
  return {
    "data-anzeigestatus-herkunft": auskunft.herkunft,
    "data-anzeigestatus-ungeprueft":
      auskunft.ungeprueft.length > 0 ? auskunft.ungeprueft.join(" ") : undefined,
  };
}
