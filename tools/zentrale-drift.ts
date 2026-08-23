// ================================================================================================
// DIE ZENTRALE DRIFTET — DIESE ERHEBUNG MELDET ES, STATT ES GESCHEHEN ZU LASSEN.
// ================================================================================================
//
// JOB 2065 D3/D4/D5 (Register I39). Der Registereintrag sagt es woertlich: *„Die Zentrale hat keinen
// Erzeuger — deshalb driftet sie, und deshalb zeigte sie am 31.07. um 07:07 zwei laengst
// beantwortete Entscheidungen noch als offen."* `OFFEN.md` hat mit `_relay/kopf/offen-seite.py`
// einen Erzeuger und bleibt deshalb wahr; die Zentrale wird von Hand nachgezogen.
//
// WARUM EIN WAECHTER UND NICHT DER ERZEUGER — gemessen, nicht bequem gewaehlt:
//
//   1. I29 haelt fest, dass genau das schon einmal versucht wurde: am 29.07. hat ein Kopf die
//      Zentrale durch die maschinell erzeugte Registerseite ersetzt. Pedi hat den Verlust benannt
//      („Rechts hast du auch wieder nicht meinen Ueberblick geschaffen"), die Seite wurde
//      zurueckgestellt, und der Vorgang steht als Regelverstoss im Register.
//   2. Gemessen am 23.08.: das Register fuehrt 125 offene Kennungen, die Zentrale nennt 24 davon.
//      Ein Erzeuger muesste entscheiden, WELCHE 24 — das ist eine Auswahl, kein Mechanismus.
//   3. Die Sektion „Stand" der Zentrale (Ship, Commit, unkommittierte Scheiben) hat im Register
//      ueberhaupt keine Quellspalte. Sie liesse sich aus ihm nicht erzeugen.
//
// ================================================================================================
// D4 — DIE TRENNUNG DER BEIDEN BEFUNDE.
// ================================================================================================
//
//   FALSCH_OFFEN  Eine Kennung steht in einer Handlungssektion („Jetzt dran", „Bei dir offen",
//                 „Entscheidungen"), das Register fuehrt sie aber abgeschlossen. Der Fall vom
//                 31.07., woertlich: S7 und S2 standen dort weiter als offen.
//   UNGENANNT     Das Register fuehrt eine Kennung offen, die Lesefläche nennt sie nicht. Das ist
//                 die Auswahl, fuer die die Zentrale existiert. Sie wird BERICHTET (I41: eine Zahl,
//                 die niemand sieht, ist keine Zahl) und beendet KEINEN Lauf.
//
// ================================================================================================
// D5 — MELDEN STATT SPERREN, UND WARUM DAS KEINE ABSCHWAECHUNG IST.
// ================================================================================================
//
// D4 war in jeder Pruefstufe gruen und musste trotzdem zurueckgerollt werden. Der Waechter hat vier
// echte Driftfaelle gefunden, das Tor rot gemacht — und **die Fundstelle darf niemand anfassen**.
// `_relay/board/klarwerk-board.html` gehoert zu den Kontrollwerkzeugen; das ist eine eiserne Regel
// mit Vorgeschichte, und sie gilt fuer die Bahn wie fuer den Kopf.
//
// EIN WAECHTER, DESSEN BEFUND NIEMAND BEHEBEN DARF, SPERRT DEN BETRIEB DAUERHAFT. Ein rotes Tor
// haelt zwoelf Bahnen an. Nach zwei Tagen wird so ein Waechter abgeschaltet, und dann meldet
// niemand mehr irgendetwas — der Befund waere teurer als sein Nutzen.
//
// DESHALB ENTSCHEIDET AB HIER NICHT DIE ART DES FUNDES, SONDERN SEIN FUNDORT:
//
//   Fundort in einem Kontrollwerkzeug (UNANTASTBAR)  ->  MELDEN, Rueckgabewert 0.
//                                                        Die Ausgabe sagt, wohin der Befund gehoert.
//   Fundort an einer aenderbaren Stelle              ->  SPERREN, Rueckgabewert 1.
//                                                        Wer ihn beheben darf, soll ihn auch muessen.
//
// DIE UNTERSCHEIDUNG IST EINE PFADFRAGE, KEINE ERMESSENSFRAGE — `istUnantastbar()` unten. Sie steht
// als Liste da, damit sie nachlesbar ist und nicht in einer Bedingung versteckt: was unter `_relay/`
// liegt, gehoert dem Kopf und Pedi. Alles andere liegt in git und ist damit unser.
//
// EHRLICH DAZU, WEIL „ich habe gesucht" und „es gibt nichts mehr" zwei Saetze sind: HEUTE hat die
// sperrende Klasse NULL Mitglieder. Es gibt genau eine Lesefläche, und die liegt unter `_relay/`.
// Der Weg ist gebaut und geprueft, aber er feuert erst, wenn eine Lesefläche in einem verfolgten
// Pfad entsteht. Ich behaupte nicht, dass er heute etwas faengt.
//
// AUFRUFER: `tools/check` (Zeile mit `zentrale-drift`), ueber `tools/zentrale-drift.sh`.
// Empfaenger der Meldung ist die Torausgabe — dieselbe Stelle, an der `modalgrenze` meldet.
//
// KEINE LAUFZEITABHAENGIGKEIT DES PRODUKTS: dieses Modul wird nicht gebuendelt und nicht beim Start
// ausgefuehrt. Es liest zwei Dateien und schreibt nichts — ein Werkzeug wie `tools/modalgrenze.ts`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Die Wurzel liegt eine Ebene ueber `tools/` — wie bei `tools/modalgrenze.ts` ein Parameter mit
// Vorgabe, kein fester Pfad, damit Test und Starter dieselbe Wurzel hereinreichen koennen.
const WURZEL = join(import.meta.dirname, "..");

export const REGISTER_DATEI = "OFFEN.md";
export const ZENTRALE_DATEI = "_relay/board/klarwerk-board.html";

/**
 * Pfade, die zu den Kontrollwerkzeugen gehoeren. Ein Befund dort wird GEMELDET, nie erzwungen.
 *
 * `_relay/` traegt die Zentrale, die Erzeuger und den Botenverkehr des Kopfes. Es steht ausserdem
 * in `.gitignore:25` — was dort liegt, ist in keinem Clone und in keiner Automatisierung, und ein
 * Tor kann es folglich auch nicht einfordern.
 */
export const UNANTASTBAR: readonly string[] = ["_relay/"];

/** Wohin ein Befund gehoert — als Text fuer die Ausgabe, damit niemand raten muss (§2.4). */
export const BOARD_ADRESSE = "Board — bei Pedi";

export function istUnantastbar(pfad: string): boolean {
  const normal = pfad.replaceAll("\\", "/");
  return UNANTASTBAR.some((u) => normal === u.replace(/\/$/, "") || normal.startsWith(u));
}

// Uebernommen aus _relay/kopf/offen-seite.py:24-27 (ZUSTAENDE).
export const ZUSTAENDE: readonly string[] = [
  "ENTSCHEIDUNG",
  "ENTSCHIEDEN",
  "BEAUFTRAGT",
  "GEBAUT",
  "GEPRÜFT",
  "PRÜFEN",
  "AUSGELIEFERT",
  "BEFUND",
  "ZUGESAGT",
  "BEAUFTRAGEN",
  "FREI",
  "ERLEDIGT",
  "VERWORFEN",
  "OFFEN",
];
// Uebernommen aus offen-seite.py:35-37 (OFFEN_ZUSTAENDE / FERTIG_ZUSTAENDE).
export const OFFEN_ZUSTAENDE: ReadonlySet<string> = new Set([
  "OFFEN",
  "ENTSCHEIDUNG",
  "BEAUFTRAGT",
  "PRÜFEN",
  "FREI",
  "BEFUND",
  "GEBAUT",
  "ZUGESAGT",
  "BEAUFTRAGEN",
]);
export const FERTIG_ZUSTAENDE: ReadonlySet<string> = new Set([
  "ERLEDIGT",
  "VERWORFEN",
  "GEPRÜFT",
  "AUSGELIEFERT",
  "ENTSCHIEDEN",
]);

// Die drei Sektionen, in denen etwas steht, das noch GETAN werden muss. Die Reihenfolge der neun
// Sektionen ist in SCRUM-530 §5 festgeschrieben (Register I29) — diese drei sind daraus die
// handlungstragenden. „Geplant", „Entschieden" und „Verlauf" duerfen Abgeschlossenes nennen.
export const HANDLUNGSSEKTIONEN: readonly string[] = [
  "Jetzt dran",
  "Bei dir offen",
  "Entscheidungen",
];

export interface Sektion {
  titel: string;
  kennungen: string[];
}
export interface Drift {
  falschOffen: { kennung: string; sektion: string; imRegister: string[] }[];
  ungenannt: string[];
  offenImRegister: number;
  genanntInZentrale: number;
}

/**
 * Das Register lesen — dieselbe Zellenregel wie `offen-seite.py:50-51` und `:78-87`.
 *
 * EINE KENNUNG KANN MEHRERE ZEILEN HABEN, und das ist kein Sonderfall: acht Kennungen tragen im
 * Register zwei Zeilen. Deshalb sammelt diese Funktion ALLE Zustaende je Kennung statt nur den
 * ersten — wer nur den ersten nimmt, uebersieht einen Widerspruch im Register selbst.
 */
export function liesRegister(text: string): Map<string, string[]> {
  const bekannt = new Set(ZUSTAENDE);
  const register = new Map<string, string[]>();
  for (const zeile of text.split("\n")) {
    if (!zeile.trim().startsWith("|")) {
      continue;
    }
    const zellen = zeile
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((z) => z.trim());
    // Kopfzeile, Trennzeile und leere Zeilen fallen hier heraus — wie im Erzeuger (`:72`).
    if (
      zellen.length < 2 ||
      zellen[0] === "Kennung" ||
      [...(zellen[0] ?? "")].every((c) => "-: ".includes(c))
    ) {
      continue;
    }
    const zustand = zellen.slice(1).find((z) => bekannt.has(z.toUpperCase()));
    if (!zustand) {
      continue;
    }
    const kennung = zellen[0] as string;
    const bisher = register.get(kennung);
    if (bisher) {
      bisher.push(zustand.toUpperCase());
    } else {
      register.set(kennung, [zustand.toUpperCase()]);
    }
  }
  return register;
}

/**
 * Die Lesefläche in ihre Sektionen zerlegen und je Sektion die genannten Kennungen sammeln.
 *
 * GESUCHT WIRD IM TEXT, NICHT IN EINER MARKE: die Zentrale ist von Hand geschrieben und traegt ihre
 * Kennungen mal in `<span class="kennung">`, mal im Fliesstext, mal in `<code>`. Ein Waechter, der
 * nur die Marke liest, meldet Ruhe, wo Prosa driftet.
 */
export function liesZentrale(html: string, bekannteKennungen: ReadonlySet<string>): Sektion[] {
  const teile = html.split(/<h2[^>]*>/).slice(1);
  const muster = /\b([A-ZÄÖÜ]{1,3}\d{1,3}[a-z]?)\b/g;
  return teile.map((teil) => {
    const ende = teil.indexOf("</h2>");
    const titel = (ende >= 0 ? teil.slice(0, ende) : "").replace(/<[^>]+>/g, "").trim();
    const text = teil.replace(/<[^>]+>/g, " ");
    const gefunden = new Set<string>();
    for (const treffer of text.matchAll(muster)) {
      const k = treffer[1] as string;
      // Nur Kennungen, die das Register wirklich fuehrt. Sonst zaehlte jede Versionsnummer und
      // jedes „Ship 11" als Kennung, und die Zahl waere wertlos.
      if (bekannteKennungen.has(k)) {
        gefunden.add(k);
      }
    }
    return { titel, kennungen: [...gefunden] };
  });
}

/** Beide Zahlen bilden. Reine Funktion — kein Dateizugriff, damit sie ohne Bestand pruefbar ist. */
export function messeDrift(register: Map<string, string[]>, sektionen: Sektion[]): Drift {
  const falschOffen: Drift["falschOffen"] = [];
  const genannt = new Set<string>();
  for (const sektion of sektionen) {
    for (const kennung of sektion.kennungen) {
      genannt.add(kennung);
    }
    if (!HANDLUNGSSEKTIONEN.some((h) => sektion.titel.includes(h))) {
      continue;
    }
    for (const kennung of sektion.kennungen) {
      const zustaende = register.get(kennung);
      // Nur wenn JEDE Registerzeile dieser Kennung abgeschlossen ist. Traegt eine Kennung zwei
      // Zeilen und ist eine davon offen, gehoert sie zu Recht in eine Handlungssektion.
      if (zustaende && zustaende.length > 0 && zustaende.every((z) => FERTIG_ZUSTAENDE.has(z))) {
        falschOffen.push({ kennung, sektion: sektion.titel, imRegister: zustaende });
      }
    }
  }
  const offen = [...register.entries()]
    .filter(([, zustaende]) => zustaende.some((z) => OFFEN_ZUSTAENDE.has(z)))
    .map(([kennung]) => kennung);
  return {
    falschOffen,
    ungenannt: offen.filter((k) => !genannt.has(k)),
    offenImRegister: offen.length,
    genanntInZentrale: offen.filter((k) => genannt.has(k)).length,
  };
}

export type Befund =
  | { art: "ABWESEND"; pfad: string }
  | { art: "GEPFLEGT"; pfad: string; drift: Drift }
  | { art: "DRIFT"; pfad: string; drift: Drift; meldenNichtSperren: boolean };

/**
 * Der Befund fuer eine Wurzel.
 *
 * `DRIFT` haengt AUSSCHLIESSLICH an `falschOffen` (D4). Ob er SPERRT, haengt ausschliesslich am
 * Fundort (D5) — beides bewusst je EINE Bedingung: je mehr Stellen ueber „rot" entscheiden, desto
 * leichter kommt die Auswahl wieder als Defekt zurueck oder das Board wieder als Sperre.
 *
 * `ABWESEND` IST EIN EIGENER BEFUND UND NICHT „gepflegt". Lehre aus I41. Eine fehlende Lesefläche
 * darf nicht wie eine gepflegte aussehen — und sie ist der Normalfall in jedem frischen Clone.
 *
 * Der Pfad ist ein Parameter, weil er ueber Sperren oder Melden entscheidet: der Aufrufertest
 * braucht beide Klassen, ohne dass dafuer eine zweite Lesefläche im Produkt erfunden wird.
 */
export function pruefeZentraleDrift(
  wurzel: string = WURZEL,
  zentraleDatei: string = ZENTRALE_DATEI,
): Befund {
  const zentralePfad = join(wurzel, zentraleDatei);
  if (!existsSync(zentralePfad)) {
    return { art: "ABWESEND", pfad: zentraleDatei };
  }
  const register = liesRegister(readFileSync(join(wurzel, REGISTER_DATEI), "utf8"));
  const sektionen = liesZentrale(readFileSync(zentralePfad, "utf8"), new Set(register.keys()));
  const drift = messeDrift(register, sektionen);
  if (drift.falschOffen.length === 0) {
    return { art: "GEPFLEGT", pfad: zentraleDatei, drift };
  }
  return {
    art: "DRIFT",
    pfad: zentraleDatei,
    drift,
    meldenNichtSperren: istUnantastbar(zentraleDatei),
  };
}

/** Die Restzahl als eine Zeile. Sie wird IMMER ausgegeben — auch wenn der Lauf gruen ist. */
export function restzahlZeile(drift: Drift): string {
  if (drift.ungenannt.length === 0) {
    return `Auswahl: alle ${drift.offenImRegister} offenen Registerkennungen stehen auf der Lesefläche.`;
  }
  return (
    `Auswahl: ${drift.genanntInZentrale} von ${drift.offenImRegister} offenen Registerkennungen ` +
    `stehen auf der Lesefläche, ${drift.ungenannt.length} bewusst nicht (kein Fehler).`
  );
}

// Direktaufruf ueber tools/zentrale-drift.sh — beim Import aus dem Test passiert hier nichts.
// Argument 1 ist die Wurzel, Argument 2 die Lesefläche; beides braucht der Aufrufertest, der
// synthetische Bestaende baut, statt den echten zu veraendern.
if (process.argv[1]?.endsWith("zentrale-drift.ts")) {
  const befund = pruefeZentraleDrift(process.argv[2] ?? WURZEL, process.argv[3] ?? ZENTRALE_DATEI);
  if (befund.art === "ABWESEND") {
    // Kein stilles Gruen: wer die Lesefläche nicht findet, hat nichts gemessen und sagt das.
    console.error(`✎ Lesefläche nicht gefunden: ${befund.pfad} — es wurde NICHTS gemessen.`);
    process.exit(2);
  }
  // Die Restzahl steht VOR der Entscheidung und in JEDEM Ausgang — sie ist ein Bericht, kein Alarm.
  console.log(restzahlZeile(befund.drift));
  if (befund.art === "GEPFLEGT") {
    console.log(
      "✓ Lesefläche gepflegt: keine im Register abgeschlossene Kennung steht in einer Handlungssektion",
    );
    process.exit(0);
  }
  const zeichen = befund.meldenNichtSperren ? "✎" : "✖";
  const adresse = befund.meldenNichtSperren
    ? `${BOARD_ADRESSE} — nicht hier zu beheben`
    : "hier zu beheben";
  console.error(`${zeichen} ${befund.pfad} weicht vom Register ab (${adresse}):`);
  for (const f of befund.drift.falschOffen) {
    console.error(
      `   FALSCH_OFFEN  ${f.kennung} steht unter "${f.sektion}", Register: ${f.imRegister.join("/")}`,
    );
  }
  if (befund.meldenNichtSperren) {
    console.error(
      `   → ${befund.drift.falschOffen.length} Fundstelle(n), gemeldet und NICHT gesperrt: diese Datei gehoert zu den Kontrollwerkzeugen.`,
    );
    process.exit(0);
  }
  process.exit(1);
}
