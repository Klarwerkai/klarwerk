// ================================================================================================
// tests/smoke/smoke-torlogik.ts — DIE TORLOGIK DES BROWSER-SMOKES
// ================================================================================================
//
// JOB 1050 D2, nach BEN3s Vollurteil zu D1. Die vorige Fassung ist die, die D1 VORGESCHLAGEN hat;
// sie liegt als Red-first-Beleg unter `/private/tmp/kw-pro3-job1050-d2-arbeit/` und trug zwei
// Kernfehler:
//
//   1. ERGEBNISSEMANTIK. `playwright --list` zaehlt ENTDECKTE Faelle. Daraus `95/95` abzuleiten
//      verwechselt aufgelistet mit bestanden und verschweigt Laufzeit-Skips. Ein Fall, der zur
//      Laufzeit uebersprungen wird, ist NICHT bestanden — er ist ungemessen.
//
//   2. KLASSIFIKATION NACH ENGINEANZAHL. „Faellt in mindestens zwei Engines → Produktdefekt,
//      sonst zulaessige Engine-Eigenheit" ist in BEIDE Richtungen falsch:
//        · Drei rote Engines koennen EIN gemeinsamer Harness-, Server- oder Umgebungsfehler sein
//          (`ECONNREFUSED` sieht in jeder Engine gleich aus). Die Zahl belegt keine Ursache.
//        · Ein echter Produktdefekt wird nicht zur Eigenheit, nur weil er genau einen
//          unterstuetzten Browser trifft. Genau so verschwindet ein WebKit-Fehler.
//
// DIE KORRIGIERTE REGEL, in einem Satz:
//   Jeder unerwartete Fehler eines unterstuetzten Browsers BLOCKIERT. Eine Ausnahme entsteht
//   ausschliesslich durch eine benannte, begruendete, verantwortete und BEFRISTETE Entscheidung
//   fuer genau diese Datei, diesen Titel und diese Engine — nie durch eine Zahl.

/** Ein einzelnes Fallergebnis, wie es der Playwright-JSON-Bericht liefert. */
export interface Fallergebnis {
  readonly datei: string;
  readonly titel: string;
  readonly engine: string;
  readonly status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  /** Grund eines Laufzeit-Skips, sofern die Sonde einen nennt. */
  readonly skipGrund?: string;
  /** Kurzform der Fehlermeldung, fuer die Ursachenklassifikation. */
  readonly fehler?: string;
}

export interface EngineBilanz {
  readonly engine: string;
  readonly entdeckt: number;
  readonly bestanden: number;
  readonly fehlgeschlagen: number;
  readonly uebersprungen: number;
}

/**
 * Bilanz je Engine — vier getrennte Zahlen, keine abgeleitete.
 *
 * `bestanden` ist ausschliesslich `passed`. Alles andere ist entweder fehlgeschlagen oder
 * ungemessen; keiner der beiden Faelle darf sich als Bestehen ausgeben.
 */
export function bilanziere(ergebnisse: readonly Fallergebnis[]): EngineBilanz[] {
  const engines = [...new Set(ergebnisse.map((e) => e.engine))].sort();
  return engines.map((engine) => {
    const meine = ergebnisse.filter((e) => e.engine === engine);
    const zaehle = (...stati: Fallergebnis["status"][]) =>
      meine.filter((e) => stati.includes(e.status)).length;
    return {
      engine,
      entdeckt: meine.length,
      bestanden: zaehle("passed"),
      // Ein Timeout und ein Abbruch sind Fehlschlaege, keine Grauzone.
      fehlgeschlagen: zaehle("failed", "timedOut", "interrupted"),
      uebersprungen: zaehle("skipped"),
    };
  });
}

/**
 * Die Kurzmeldung des Tors.
 *
 * `n/n` steht nur, wenn n Faelle TATSAECHLICH bestanden sind. Sobald etwas uebersprungen wurde,
 * nennt die Meldung die Skipzahl — sonst waere sie genau die Scheinaussage, die BEN3 unter
 * „Ehrlichkeit vor Optik" verworfen hat.
 */
export function meldung(bilanzen: readonly EngineBilanz[]): string {
  if (bilanzen.length === 0) {
    return "MESSUNG UNBELEGT · keine Engine hat ein Ergebnis geliefert";
  }
  const summe = (f: (b: EngineBilanz) => number) => bilanzen.reduce((a, b) => a + f(b), 0);
  const bestanden = summe((b) => b.bestanden);
  const entdeckt = summe((b) => b.entdeckt);
  const uebersprungen = summe((b) => b.uebersprungen);
  const fehlgeschlagen = summe((b) => b.fehlgeschlagen);
  const proEngine = bilanzen
    .map(
      (b) =>
        `${b.engine} ${b.bestanden}/${b.entdeckt} (fehlgeschlagen ${b.fehlgeschlagen}, uebersprungen ${b.uebersprungen})`,
    )
    .join(" · ");
  const kopf =
    uebersprungen > 0 || fehlgeschlagen > 0
      ? `bestanden ${bestanden}/${entdeckt} · fehlgeschlagen ${fehlgeschlagen} · uebersprungen ${uebersprungen}`
      : `GRÜN · ${bestanden}/${entdeckt}`;
  return `${kopf} · ${proEngine}`;
}

export type Klasse = "K1" | "K2" | "BLOCKIERT";

/**
 * Eine ausdrueckliche, befristete Ausnahme.
 *
 * Alle fuenf Felder sind Pflicht. Eine Ausnahme ohne Verantwortlichen ist ein Freibrief, eine
 * ohne Ablaufdatum ist dauerhaft, und eine ohne Grund ist nicht nachpruefbar.
 */
export interface Ausnahme {
  readonly datei: string;
  readonly titel: string;
  readonly engine: string;
  readonly grund: string;
  readonly verantwortlich: string;
  /** ISO-Datum. Ab diesem Tag traegt die Ausnahme nicht mehr. */
  readonly laeuftAb: string;
}

function ausnahmeTraegt(a: Ausnahme, f: Fallergebnis, heute: string): boolean {
  if (a.datei !== f.datei || a.titel !== f.titel) return false;
  // Eine Ausnahme gilt fuer GENAU EINE Engine. WebKit-Eigenheiten sagen nichts ueber Firefox.
  if (a.engine !== f.engine) return false;
  if (a.grund.trim().length === 0) return false;
  if (a.verantwortlich.trim().length === 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.laeuftAb)) return false;
  return a.laeuftAb >= heute;
}

/**
 * Klassifiziert einen Fehlschlag NACH URSACHENBELEG, nie nach der Zahl betroffener Engines.
 *
 * `alle` bleibt im Vertrag, obwohl die Menge der betroffenen Engines das Urteil bewusst NICHT
 * mehr beeinflusst: Die Signatur ist die Stelle, an der die alte Regel angesetzt hat, und ein
 * spaeterer Leser soll sehen, dass die Information vorliegt und trotzdem nicht benutzt wird.
 */
export function klassifiziere(
  fehlschlag: Fallergebnis,
  _alle: readonly Fallergebnis[],
  ausnahmen: readonly Ausnahme[] = [],
  heute = "2026-08-18",
): Klasse {
  const gedeckt = ausnahmen.some((a) => ausnahmeTraegt(a, fehlschlag, heute));
  return gedeckt ? "K2" : "BLOCKIERT";
}

export interface Torurteil {
  readonly geschlossen: boolean;
  readonly exit: number;
  readonly text: string;
}

/**
 * Das Gesamturteil.
 *
 * Drei definierte Nichtnull-Exits, damit ein Aufrufer die Lagen unterscheiden kann:
 *   2 — MESSUNG UNBELEGT (gar kein Ergebnis; auch der Infrastrukturausfall landet hier)
 *   3 — BLOCKIERT (mindestens ein ungedeckter Fehler)
 *   1 — sonstige Roete
 * Keiner davon schliesst das Tor.
 */
export function torurteil(
  bilanzen: readonly EngineBilanz[],
  klassen: readonly Klasse[],
): Torurteil {
  if (bilanzen.length === 0) {
    return {
      geschlossen: false,
      exit: 2,
      text: "MESSUNG UNBELEGT · keine Engine hat ein Ergebnis geliefert — das Tor bleibt offen",
    };
  }
  const blockierend = klassen.filter((k) => k === "BLOCKIERT").length;
  if (blockierend > 0) {
    return {
      geschlossen: false,
      exit: 3,
      text: `BLOCKIERT · ${blockierend} ungedeckte Fehler — ${meldung(bilanzen)}`,
    };
  }
  const fehlgeschlagen = bilanzen.reduce((a, b) => a + b.fehlgeschlagen, 0);
  if (fehlgeschlagen > 0) {
    return { geschlossen: false, exit: 1, text: `ROT · ${meldung(bilanzen)}` };
  }
  return { geschlossen: true, exit: 0, text: meldung(bilanzen) };
}
