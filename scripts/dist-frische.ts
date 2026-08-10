// ================================================================================================
// AUFTRAG-mega38 BLOCK C — DER FRISCHE-VERGLEICH VOR DEM UI-SMOKE.
// ================================================================================================
//
// DER BEFUND (mega37 gemeldet, mega38 repariert): `npm run smoke:ui` startete Playwright
// unmittelbar. Die Smoke-Konfiguration serviert das VORHANDENE `apps/web/dist` und schreibt selbst
// „erwartet gebautes apps/web/dist" (playwright.smoke.config.ts:5) — gebaut hat aber nur
// `tools/check` (`tools/check:5`). Wer am Mittwoch schnell nachsieht, ruft den Smoke, nicht das
// ganze Tor. Ein Gruen aus einem Buendel von vorgestern sagt ueber den Quellstand von heute nichts
// aus, sieht aber aus wie eine Aussage. Das ist schlimmer als kein Gruen.
//
// WARUM ABBRUCH UND NICHT „VORHER BAUEN": ein Vorbau macht die Fehlerklasse unsichtbar statt
// belegbar — man kann ihn nur behaupten. Ein Waechter, der abbricht, laesst sich VORFUEHREN
// (Quelle anfassen, nicht bauen, Befehl rufen, Abbruch zitieren). Und er sagt dem Menschen genau
// EINEN Satz, was zu tun ist, statt ihm still vier Sekunden zu stehlen.
//
// WIE WEIT DER WAECHTER REICHT — und wie weit NICHT (AUFTRAG-mega39 BLOCK E2, bens gelber Befund):
// Er haengt an den beiden npm-Skripten `smoke:ui` und `smoke:ui:gate`. Wer Playwright DIREKT ruft
// (`npx playwright test --config playwright.smoke.config.ts`), umgeht ihn vollstaendig — der Wald
// gehoert dann dem, der ihn ruft. Fuer die zwei benannten Befehle ist das in Ordnung: sie sind der
// vereinbarte Weg, und der Wirknachweis liegt vor. Aber es ist AUSDRUECKLICH KEINE allgemeine
// Integritaetsgarantie fuer „der Smoke faehrt nie ein altes Buendel". Diese Grenze steht hier, damit
// sie niemand aus dem Vorhandensein des Waechters herausliest.
//
// WARUM MTIME UND KEIN INHALTS-HASH: der Waechter beantwortet „ist dieses Buendel juenger als
// alles, woraus es entsteht?" — das ist eine Frage nach der REIHENFOLGE, nicht nach dem Inhalt.
// Ein Hash-Vergleich braeuchte eine Manifestdatei, die selbst wieder veralten kann. Die ehrliche
// Grenze dieser Wahl steht hier statt unerwaehnt zu bleiben: ein `git checkout`, das Quelldateien
// neu schreibt, macht das Buendel formal veraltet, obwohl es inhaltlich passen kann. Der Waechter
// irrt damit auf der SICHEREN Seite — er verlangt einen Bau, den es sonst nicht gaebe.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface FrischeEingabe {
  // Gibt es ueberhaupt ein Buendel (`apps/web/dist/index.html`)?
  distVorhanden: boolean;
  // Zeitpunkt des Baus: die JUENGSTE Datei im Buendel. (Nicht die aelteste — vite schreibt sein
  // Ergebnis ueber einige hundert Millisekunden; der Bau ist fertig, wenn die letzte Datei steht.)
  distNeueste: number;
  // Zeitpunkt der juengsten Quelle, aus der gebaut wird.
  quelleNeueste: number;
  // Welche Quelle das ist — die Meldung muss die schuldige Datei nennen koennen.
  quelleDatei: string;
}

export interface FrischeUrteil {
  frisch: boolean;
  grund: "fehlt" | "veraltet" | "frisch";
  quelleDatei: string;
  alterSekunden: number;
}

export function bewerteFrische(eingabe: FrischeEingabe): FrischeUrteil {
  if (!eingabe.distVorhanden) {
    return { frisch: false, grund: "fehlt", quelleDatei: eingabe.quelleDatei, alterSekunden: 0 };
  }
  // GLEICHSTAND GILT ALS FRISCH: Dateisysteme runden Zeitstempel (HFS+ auf Sekunden), und ein
  // Gleichstand ist kein Beleg fuer Alter. Der Waechter soll den ECHTEN Fall fangen, nicht die
  // Aufloesungsgrenze des Dateisystems zum Dauer-Nein machen.
  if (eingabe.quelleNeueste > eingabe.distNeueste) {
    return {
      frisch: false,
      grund: "veraltet",
      quelleDatei: eingabe.quelleDatei,
      alterSekunden: Math.round((eingabe.quelleNeueste - eingabe.distNeueste) / 1000),
    };
  }
  return { frisch: true, grund: "frisch", quelleDatei: eingabe.quelleDatei, alterSekunden: 0 };
}

export function frischeMeldung(urteil: FrischeUrteil): string {
  if (urteil.grund === "fehlt") {
    return [
      "✖ UI-Smoke ABGEBROCHEN: es gibt gar kein gebautes apps/web/dist.",
      "  Der Smoke serviert dieses Verzeichnis. Ohne Buendel prueft er nichts — ein Gruen waere leer.",
      "  → ./tools/build   (oder: cd apps/web && npx vite build)",
    ].join("\n");
  }
  if (urteil.grund === "veraltet") {
    return [
      "✖ UI-Smoke ABGEBROCHEN: apps/web/dist ist AELTER als der Quellstand.",
      `  Juengste Quelle: ${urteil.quelleDatei}  (${urteil.alterSekunden} s neuer als das Buendel)`,
      "  Der Smoke wuerde ein Buendel fahren, das diese Aenderung nicht enthaelt — sein Gruen",
      "  sagte ueber den heutigen Quellstand nichts aus.",
      "  → ./tools/build   (oder: cd apps/web && npx vite build)",
    ].join("\n");
  }
  return "✓ apps/web/dist ist juenger als jede Quelle.";
}

// Alles, woraus `vite build` das Buendel erzeugt. Fehlende Eintraege werden uebersprungen (nicht
// jedes Repo-Layout hat jede Konfigurationsdatei) — vorhandene zaehlen vollstaendig.
//
// AUFTRAG-mega39 BLOCK E1 (ben, sammel37-mega38): `apps/web/package-lock.json` fehlte. Der Lockfile
// ist ein ECHTER Build-Eingang — er entscheidet, welche Fassung jeder Abhaengigkeit im Buendel
// landet. Eine reine Lockfile-Aenderung (etwa ein Sicherheits-Update ohne Quelltext-Anfassen) konnte
// den Frische-Check bei altem `dist` also passieren, und der Smoke haette ein Buendel mit den ALTEN
// Abhaengigkeiten gruen gemeldet. Dass diese Liste kuenftig VOLLSTAENDIG bleibt, haelt kein
// abgeschriebener Zweitabzug fest, sondern ein Sammler: tests/smoke/dist-frische.test.ts vergleicht
// sie gegen den tatsaechlichen Inhalt von `apps/web/` und wird bei jedem NEUEN Eintrag rot, der
// weder gedeckt noch ausdruecklich begruendet ausgenommen ist.
export const QUELL_PFADE: readonly string[] = [
  "apps/web/index.html",
  "apps/web/src",
  "apps/web/public",
  "apps/web/vite.config.ts",
  "apps/web/tailwind.config.ts",
  "apps/web/postcss.config.js",
  "apps/web/tsconfig.json",
  "apps/web/tsconfig.node.json",
  "apps/web/package.json",
  "apps/web/package-lock.json",
];

// Was NICHT Eingang ist — je Eintrag mit Grund. Der Sammler im Test liest diese Liste; eine
// Ausnahme ohne Grund gibt es damit nicht, und eine stillschweigende auch nicht.
//
// AUFTRAG-PRO-CI-DIST-FRISCHE-01 (ben, reproduziert): die Liste war eine flache Zuordnung
// Name → Grund, und der Test verlangte fuer JEDE Ausnahme, dass es den Eintrag unter `apps/web`
// gerade GIBT. Fuer `test-results` — das Ausgabeverzeichnis von Playwright — ist das keine Aussage
// ueber den Quellstand, sondern eine Aussage ueber den Zufall: nach einem Smoke-Lauf ist es da,
// nach `git clean` oder auf einem frischen Klon nicht. DERSELBE Arbeitsbaum war deshalb im
// Vollcheck mal gruen und mal rot („verwaiste Ausnahme"), und ein parallel laufender Playwright
// konnte das Urteil mitten im Lauf drehen. Ein Vertrag, der so wackelt, belegt nichts.
//
// WARUM NICHT EINFACH DIE VERWAIST-PRUEFUNG STREICHEN: sie faengt einen echten Fall — eine Ausnahme
// fuer etwas, das es gar nicht mehr gibt, waechst still weiter und deckt irgendwann etwas ab, das
// unter demselben Namen zurueckkommt. Die Pruefung war nicht falsch, ihr fehlte eine
// Unterscheidung: `.gitignore` und `README.md` sind VERSIONIERT, ihr Fehlen ist ein Befund;
// `dist`, `node_modules`, `test-results` und `.DS_Store` ENTSTEHEN erst durch einen Lauf, ihr
// Fehlen ist der Normalfall eines frischen Klons. Genau diese Unterscheidung steht jetzt im
// Vertrag, statt vom Zustand der Maschine abzuhaengen.
export interface Ausnahme {
  // Warum der Eintrag kein Build-Eingang ist — Pflichtangabe, sonst gaebe es stille Ausnahmen.
  grund: string;
  // `true`: der Eintrag ENTSTEHT durch einen Lauf (Bau, Installation, Smoke, Finder) und darf
  // fehlen. `false`: der Eintrag ist versioniert und MUSS da sein — fehlt er, ist die Ausnahme
  // verwaist und der Vertrag wird rot.
  fluechtig: boolean;
}

export const NICHT_EINGANG: Readonly<Record<string, Ausnahme>> = {
  dist: {
    grund: "das ERGEBNIS des Baus — es mit sich selbst zu vergleichen waere zirkulaer.",
    fluechtig: true,
  },
  node_modules: {
    grund:
      "installiertes Ergebnis, kein Quellstand. Der Eingang, der darueber entscheidet, ist package-lock.json — und der steht oben. Ein rekursiver Zeitstempel-Scan ueber node_modules waere zudem bei jedem Aufruf teuer.",
    fluechtig: true,
  },
  "test-results": {
    grund:
      "Ausgabe der Playwright-Laeufe, kein Build-Eingang. Entsteht erst beim Smoke und wird geraeumt — deshalb fluechtig.",
    fluechtig: true,
  },
  ".gitignore": {
    grund: "Werkzeug-Konfiguration von git, geht nicht in das Buendel ein.",
    fluechtig: false,
  },
  "README.md": {
    grund: "Doku, geht nicht in das Buendel ein.",
    fluechtig: false,
  },
  ".DS_Store": {
    grund:
      "Finder-Rest von macOS, kein Projektinhalt. Legt der Finder an, sonst gibt es ihn nicht — deshalb fluechtig.",
    fluechtig: true,
  },
};

export interface EingangsUrteil {
  // Eintraege unter `apps/web`, die weder von QUELL_PFADE gedeckt noch begruendet ausgenommen sind.
  ungeklaert: string[];
  // Ausnahmen, die als verpflichtend vorhanden gefuehrt werden, aber fehlen.
  verwaistePflicht: string[];
  // QUELL_PFADE-Eintraege, die es unter `apps/web` nicht gibt (Tippfehler waeren sonst still).
  fehlendeQuellen: string[];
  // Ausnahmen ohne tragfaehige Begruendung.
  ohneGrund: string[];
}

// Die ENTSCHEIDUNG ueber die Eingangsmenge — rein, ueber einer uebergebenen Eintragsliste. Dass
// diese Funktion das Dateisystem NICHT selbst liest, ist der Punkt: nur so kann der Vertrag beide
// Zustaende (fluechtiges Verzeichnis da / nicht da) selbst erzeugen, statt sie beim gerade
// laufenden Playwright zu erfragen.
export function pruefeEingangsmenge(eintraege: readonly string[]): EingangsUrteil {
  const vorhanden = new Set(eintraege);
  const gedeckt = new Set(QUELL_PFADE.map((p) => p.replace(/^apps\/web\//, "")));
  return {
    ungeklaert: eintraege.filter((e) => !gedeckt.has(e) && !(e in NICHT_EINGANG)),
    verwaistePflicht: Object.entries(NICHT_EINGANG)
      .filter(([name, a]) => !a.fluechtig && !vorhanden.has(name))
      .map(([name]) => name),
    fehlendeQuellen: [...gedeckt].filter((name) => !vorhanden.has(name)),
    ohneGrund: Object.entries(NICHT_EINGANG)
      .filter(([, a]) => a.grund.trim().length <= 20)
      .map(([name]) => name),
  };
}

export const DIST_PFAD = "apps/web/dist";

interface Neueste {
  zeit: number;
  datei: string;
}

function neuesteIn(pfad: string, bisher: Neueste): Neueste {
  let stand: ReturnType<typeof statSync>;
  try {
    stand = statSync(pfad);
  } catch {
    return bisher; // Pfad gibt es hier nicht — kein Grund, deshalb abzubrechen.
  }
  if (stand.isDirectory()) {
    let ergebnis = bisher;
    for (const eintrag of readdirSync(pfad)) {
      ergebnis = neuesteIn(join(pfad, eintrag), ergebnis);
    }
    return ergebnis;
  }
  return stand.mtimeMs > bisher.zeit ? { zeit: stand.mtimeMs, datei: pfad } : bisher;
}

// Der Dateisystem-Teil: er sammelt nur Zeitstempel. Die ENTSCHEIDUNG faellt oben in `bewerteFrische`,
// und die ist rein — deshalb ist sie pinnbar, ohne einen Bau anzulegen.
export function sammleFrische(wurzel: string): FrischeEingabe {
  const leer: Neueste = { zeit: 0, datei: "(keine)" };
  const dist = neuesteIn(join(wurzel, DIST_PFAD), leer);
  let quelle = leer;
  for (const pfad of QUELL_PFADE) {
    quelle = neuesteIn(join(wurzel, pfad), quelle);
  }
  return {
    distVorhanden: dist.zeit > 0,
    distNeueste: dist.zeit,
    quelleNeueste: quelle.zeit,
    // Relativ zur Wurzel ausgeben — die Meldung soll kopierbar sein, nicht die Maschine verraten.
    quelleDatei: quelle.datei.startsWith(`${wurzel}/`)
      ? quelle.datei.slice(wurzel.length + 1)
      : quelle.datei,
  };
}
