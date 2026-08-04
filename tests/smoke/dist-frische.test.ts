// ================================================================================================
// AUFTRAG-mega38 BLOCK C — `npm run smoke:ui` DARF KEINEN ALTEN BAU GRUEN GEBEN.
// ================================================================================================
//
// `package.json:21` startete Playwright bis mega37 UNMITTELBAR. Die Smoke-Konfiguration serviert
// das vorhandene `apps/web/dist` und schreibt selbst „erwartet gebautes apps/web/dist"
// (playwright.smoke.config.ts:5). Gebaut hat vorher NUR `tools/check` (`tools/check:5`).
//
// Mittwoch und Donnerstag ist `npm run smoke:ui` aber der Schnellaufruf, mit dem ein MENSCH
// nachsieht — und ein Gruen aus einem Buendel von vorgestern sagt ueber den Quellstand von heute
// nichts aus. Das ist schlimmer als kein Gruen: es sieht aus wie eine Aussage und ist keine.
//
// Die Antwort ist ein vorgeschalteter Frische-Vergleich, der LAUT ABBRICHT — nicht warnt. Warum
// nicht einfach vorher bauen: dann gaebe es nichts zu belegen. Ein Wachter, der abbricht, kann man
// vorfuehren (C2); ein stiller Vorbau kann nur behauptet werden.
//
// Dieser Test pinnt die ENTSCHEIDUNG (reine Funktion). Der Wirknachweis am echten Befehl steht im
// Bericht: Quelle anfassen, nicht bauen, `npm run smoke:ui:gate` rufen, Abbruch zitieren.
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NICHT_EINGANG,
  QUELL_PFADE,
  bewerteFrische,
  frischeMeldung,
  pruefeEingangsmenge,
} from "../../scripts/dist-frische";

const QUELLE = "apps/web/src/pages/Ask.tsx";

describe("mega38 C · der Frische-Waechter vor dem UI-Smoke", () => {
  it("kein Bau vorhanden: ABBRUCH — ein Smoke ohne Buendel prueft gar nichts", () => {
    const urteil = bewerteFrische({
      distVorhanden: false,
      distNeueste: 0,
      quelleNeueste: 1_000,
      quelleDatei: QUELLE,
    });
    expect(urteil.frisch).toBe(false);
    expect(urteil.grund).toBe("fehlt");
  });

  it("Quelle NEUER als der Bau: ABBRUCH, und die Meldung nennt die schuldige Datei", () => {
    const urteil = bewerteFrische({
      distVorhanden: true,
      distNeueste: 1_000,
      quelleNeueste: 2_000,
      quelleDatei: QUELLE,
    });
    expect(urteil.frisch).toBe(false);
    expect(urteil.grund).toBe("veraltet");
    // „Nicht warnen — abbrechen": die Meldung muss handlungsfaehig machen, nicht nur meckern.
    const text = frischeMeldung(urteil);
    expect(text).toContain(QUELLE);
    expect(text).toContain("./tools/build");
  });

  it("Bau NEUER als jede Quelle: durchlassen — sonst waere der Waechter nur ein Dauer-Nein", () => {
    const urteil = bewerteFrische({
      distVorhanden: true,
      distNeueste: 2_000,
      quelleNeueste: 1_000,
      quelleDatei: QUELLE,
    });
    expect(urteil.frisch).toBe(true);
    expect(urteil.grund).toBe("frisch");
  });

  it("gleicher Zeitstempel gilt als frisch — Dateisysteme runden, ein Gleichstand ist kein Beleg fuer Alter", () => {
    const urteil = bewerteFrische({
      distVorhanden: true,
      distNeueste: 1_000,
      quelleNeueste: 1_000,
      quelleDatei: QUELLE,
    });
    expect(urteil.frisch).toBe(true);
  });
});

// ================================================================================================
// AUFTRAG-mega39 BLOCK E1 — DER WAECHTER MUSS SEINE EINGANGSMENGE GANZ KENNEN.
// ================================================================================================
//
// DER BEFUND (ben): `apps/web/package-lock.json` fehlte in `QUELL_PFADE`. Der Lockfile ist ein
// echter Build-Eingang; eine reine Lockfile-Aenderung konnte den Frische-Check bei altem `dist`
// passieren.
//
// EIN NACHGEZOGENER EINZELPIN WAERE DIESELBE BAUFORM NOCH EINMAL: er kennt nur die heutige Liste
// und bemerkt den naechsten fehlenden Eingang wieder erst nach dem Schaden — das ist die Klasse,
// die uns diese Woche dreimal getroffen hat. Dieser Test ist deshalb ein SAMMLER: er liest den
// TATSAECHLICHEN Inhalt von `apps/web/` und verlangt fuer JEDEN Eintrag entweder Deckung durch
// `QUELL_PFADE` oder einen ausdruecklich BEGRUENDETEN Platz in `NICHT_EINGANG`. Eine neue
// Konfigurationsdatei (`.env.production`, `vite.config.mts`, `postcss.config.mjs`, …) macht ihn
// rot, ohne dass hier eine Zeile ueber sie steht.
describe("mega39 E1 · der Frische-Waechter kennt seine Eingangsmenge vollstaendig", () => {
  const WEB = resolve(__dirname, "../../apps/web");
  const eintraege = readdirSync(WEB);

  it("der Lockfile ist ein Build-Eingang und steht in QUELL_PFADE", () => {
    expect(QUELL_PFADE).toContain("apps/web/package-lock.json");
  });

  it("SAMMLER am ECHTEN Arbeitsbaum: jeder Eintrag unter apps/web ist gedeckt oder begruendet ausgenommen", () => {
    // Faende readdir nichts, liefe die Pruefung still leer.
    expect(eintraege.length).toBeGreaterThan(5);

    // Die Meldung nennt genau, was zu tun ist: aufnehmen oder mit Grund ausnehmen.
    expect(
      pruefeEingangsmenge(eintraege).ungeklaert,
      "neue(r) Eintrag unter apps/web: entweder in QUELL_PFADE aufnehmen oder in NICHT_EINGANG mit Grund ausnehmen",
    ).toEqual([]);
  });

  it("keine Ausnahme ohne Grund, und jede Ausnahme sagt AUSDRUECKLICH, ob sie fluechtig ist", () => {
    for (const [name, ausnahme] of Object.entries(NICHT_EINGANG)) {
      expect(ausnahme.grund.length, `Ausnahme ${name} ohne Begruendung`).toBeGreaterThan(20);
      // Kein stiller Vorgabewert: wer eine Ausnahme aufnimmt, muss sich entscheiden.
      expect(
        typeof ausnahme.fluechtig,
        `Ausnahme ${name} ohne Angabe fluechtig/verpflichtend`,
      ).toBe("boolean");
    }
    expect(pruefeEingangsmenge(eintraege).ohneGrund).toEqual([]);
  });

  it("keine verwaiste PFLICHT-Ausnahme im echten Arbeitsbaum", () => {
    // Ein VERSIONIERTER Eintrag, den es gar nicht mehr gibt, hat hier nichts verloren (sonst
    // waechst die Liste still weiter und deckt irgendwann etwas ab, das wieder auftaucht).
    expect(pruefeEingangsmenge(eintraege).verwaistePflicht).toEqual([]);
  });

  it("kein QUELL_PFAD zeigt ins Leere (Tippfehler waeren still — statSync ueberspringt sie)", () => {
    // `neuesteIn` ueberspringt fehlende Pfade absichtlich. Genau deshalb faellt ein Tippfehler dort
    // NICHT auf; er faellt hier auf.
    expect(
      pruefeEingangsmenge(eintraege).fehlendeQuellen,
      `nicht vorhanden unter ${join("apps", "web")}`,
    ).toEqual([]);
  });
});

// ================================================================================================
// AUFTRAG-PRO-CI-DIST-FRISCHE-01 — DERSELBE ARBEITSBAUM DARF NICHT MAL GRUEN UND MAL ROT SEIN.
// ================================================================================================
//
// DER BEFUND (ben, reproduziert): der Sammler oben las `apps/web` und verlangte fuer JEDE Ausnahme,
// dass der Eintrag GERADE existiert. `test-results` entsteht aber erst durch einen Playwright-Lauf.
// Ohne Lauf war der Vertrag rot („verwaiste Ausnahme: test-results"), mit Lauf gruen — bei
// unveraendertem Quellstand. Negativkontrolle vor der Korrektur: gezielter Lauf 7/8 rot, sobald der
// Eintrag aus dem gelesenen Stand faellt.
//
// WARUM DIESE TESTS SYNTHETISCHE EINTRAGSLISTEN FAHREN UND NICHT `readdirSync`: ein Vertrag, der
// erst dann etwas ueber den Fall „Verzeichnis fehlt" sagt, wenn das Verzeichnis zufaellig fehlt,
// sagt darueber nie zuverlaessig etwas. `pruefeEingangsmenge` ist rein und nimmt die Liste entgegen
// — beide Zustaende sind damit HIER erzeugbar, ohne im Arbeitsbaum irgendetwas zu loeschen (`dist`
// und `test-results` gehoeren dem Menschen, nicht dem Test).
describe("dist-frische · fluechtige und verpflichtende Ausnahmen sind unterscheidbar", () => {
  // Basis eines gedachten Arbeitsbaums: alle gedeckten Quellen plus die VERPFLICHTENDEN Ausnahmen.
  // Abgeleitet statt abgeschrieben — sonst wuerde ein neuer QUELL_PFAD diese Liste still veralten
  // lassen und der Vertrag pruefte einen Stand, den es nicht mehr gibt.
  const QUELL_NAMEN = QUELL_PFADE.map((p) => p.replace(/^apps\/web\//, ""));
  const PFLICHT_NAMEN = Object.entries(NICHT_EINGANG)
    .filter(([, a]) => !a.fluechtig)
    .map(([name]) => name);
  // `test-results` wird AUSDRUECKLICH beim Namen ausgeschlossen, nicht nur ueber das Kennzeichen:
  // sonst zoege eine Rueckstufung auf „verpflichtend" den Eintrag stillschweigend wieder in diese
  // Basis, und die Zustandstests unten wuerden dem Fehler folgen statt ihn zu fangen.
  const BASIS = [...QUELL_NAMEN, ...PFLICHT_NAMEN].filter((n) => n !== "test-results");

  // Nachschlagen mit Beweis statt mit Ausrufezeichen: verschwindet eine Ausnahme ganz, soll das
  // hier laut auffallen und nicht als `undefined` durch die Zusicherung rutschen.
  const ausnahme = (name: string) => {
    const eintrag = NICHT_EINGANG[name];
    if (!eintrag) throw new Error(`Ausnahme ${name} steht nicht mehr in NICHT_EINGANG`);
    return eintrag;
  };

  it("test-results ist als FLUECHTIG gefuehrt — das ist der ganze Unterschied", () => {
    expect(ausnahme("test-results").fluechtig).toBe(true);
    // Gegenprobe: versionierte Eintraege sind es NICHT. Waere alles fluechtig, waere die
    // Verwaist-Pruefung faktisch abgeschaltet — genau das soll sie nicht sein.
    expect(ausnahme(".gitignore").fluechtig).toBe(false);
    expect(ausnahme("README.md").fluechtig).toBe(false);
    expect(PFLICHT_NAMEN.length).toBeGreaterThan(0);
  });

  it("VORHANDEN: mit apps/web/test-results ist der Vertrag gruen", () => {
    const urteil = pruefeEingangsmenge([...BASIS, "test-results", "dist", "node_modules"]);
    expect(urteil.ungeklaert).toEqual([]);
    expect(urteil.verwaistePflicht).toEqual([]);
    expect(urteil.fehlendeQuellen).toEqual([]);
  });

  it("ABWESEND: ohne apps/web/test-results ist derselbe Vertrag EBENSO gruen", () => {
    const urteil = pruefeEingangsmenge(BASIS);
    expect(urteil.ungeklaert).toEqual([]);
    // Der Kern des Defekts: hier stand vor der Korrektur ['test-results'].
    expect(urteil.verwaistePflicht).toEqual([]);
    expect(urteil.fehlendeQuellen).toEqual([]);
  });

  it("das Urteil haengt NICHT davon ab, ob fluechtige Eintraege gerade da sind", () => {
    const mit = pruefeEingangsmenge([
      ...BASIS,
      "test-results",
      "dist",
      "node_modules",
      ".DS_Store",
    ]);
    const ohne = pruefeEingangsmenge(BASIS);
    expect(mit).toEqual(ohne);
  });

  it("UNERWARTET: eine neue Eingangsmenge wird weiterhin ROT erkannt", () => {
    const urteil = pruefeEingangsmenge([...BASIS, ".env.production"]);
    expect(urteil.ungeklaert).toEqual([".env.production"]);
  });

  it("UNERWARTET bleibt auch dann rot, wenn das fluechtige Verzeichnis gerade da ist", () => {
    const urteil = pruefeEingangsmenge([...BASIS, "test-results", "vite.config.mts"]);
    expect(urteil.ungeklaert).toEqual(["vite.config.mts"]);
  });

  it("VERPFLICHTEND VERWAIST: fehlt ein versionierter Ausnahme-Eintrag, bleibt das erkennbar", () => {
    const ohneReadme = BASIS.filter((n) => n !== "README.md");
    expect(pruefeEingangsmenge(ohneReadme).verwaistePflicht).toEqual(["README.md"]);
  });

  it("TIPPFEHLER: ein QUELL_PFAD, den es nicht gibt, faellt weiterhin auf", () => {
    const ohneLockfile = BASIS.filter((n) => n !== "package-lock.json");
    expect(pruefeEingangsmenge(ohneLockfile).fehlendeQuellen).toEqual(["package-lock.json"]);
  });
});
