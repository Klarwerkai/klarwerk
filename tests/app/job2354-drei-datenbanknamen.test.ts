// ================================================================================================
// JOB 2354 · D1 · E7 — DREI UMGEBUNGEN, DREI NAMEN. UND SIE BLEIBEN VERSCHIEDEN.
// ================================================================================================
//
// DER BEFUND (`OFFEN.md` E7, nachgemessen in `JOB 2312 D1` §4.6):
//
//   docker-compose.yml:9        POSTGRES_DB: klarwerk      ← Entwicklung
//   docker-compose.prod.yml:18  POSTGRES_DB: klarwerk      ← Produktion, GLEICHER NAME
//   docker-compose.prod.yml:35  DATABASE_URL: …@db:5432/klarwerk
//   + fuenfzehn Integrationsdateien, die ihre Wegwerf-Container ebenfalls `klarwerk` tauften
//
// **Drei Ebenen, ein Name.** Wer eine Verbindungszeichenkette in einem Protokoll, einem
// Fehlerbericht oder auf einem Bildschirm sah, konnte am Namen nicht erkennen, welche der drei er
// vor sich hatte. Die Warum-Spalte des Registers sagt, was das kostet: *„Der heutige Name laedt
// dazu ein, die Produktionsdatenbank fuer eine Testdatenbank zu halten. Das geht genau einmal
// schief."*
//
// ------------------------------------------------------------------------------------------------
// WARUM DIESE DATEI EXISTIERT — UND NICHT NUR DIE UMBENENNUNG
// ------------------------------------------------------------------------------------------------
//
// Eine Umbenennung ohne Wache ist in vier Wochen wieder weg. Sie hinterlaesst keine Spur, die
// jemanden aufhaelt: Wer beim naechsten Umbau in `docker-compose.yml` `klarwerk` schreibt, weil es
// kuerzer ist, bekommt von nichts und niemandem Widerspruch. **Diese Datei ist der Widerspruch.**
//
// Sie LIEST die drei Namen aus dem Baum, statt sie zu wiederholen. Eine Wache, die die Namen als
// Literal traegt, prueft nur sich selbst — sie bliebe gruen, solange jemand beide Stellen
// gleichzeitig aendert, und genau das ist der Fall, den sie fangen soll.
//
// ------------------------------------------------------------------------------------------------
// DIE NAMENSWAHL, UND SIE IST NICHT FREI ERFUNDEN
// ------------------------------------------------------------------------------------------------
//
// `klarwerk_prod` · `klarwerk_dev` · `klarwerk_test`
//
// Das Muster `klarwerk_<umgebung>` steht schon im Baum: `docker-compose.yml` fuehrt `klarwerk_dev`
// bereits als Kennwort, und `services/db-tx/src/pg-test-guard.test.ts:20` fuehrt `klarwerk_test`
// als Beispiel einer Testdatenbank.
//
// **Und der Test-Name ist nicht Geschmack, sondern eine Sicherheitsbedingung dieses Hauses.**
// `services/db-tx/src/pg-test-guard.ts:25` gibt die destruktive Pg-Suite — sie DROPPT Tabellen —
// ausschliesslich dann frei, wenn der Datenbankname `test` enthaelt. Solange die Wegwerf-Container
// `klarwerk` hiessen, erfuellte KEINER von ihnen diese Bedingung. Fall N4 haelt beide Haelften
// fest: der Testname traegt `test`, und Produktion und Entwicklung tragen es NICHT — sonst koennte
// dieselbe Sicherung eines Tages eine echte Datenbank durchwinken.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dateienMitEndung,
  datenbanknamenAusUrls,
  postgresDbAus,
  postgresDbAusTestcontainer,
} from "./job2354-datenbanknamen";

// Vitest laeuft mit der Repo-Wurzel als Arbeitsverzeichnis (`vitest.config.ts`) — dieselbe
// Voraussetzung, unter der `tests/app/coolify-compose-quellwahrheit.test.ts` seine Dateien liest.
const COMPOSE_DEV = "docker-compose.yml";
const COMPOSE_PROD = "docker-compose.prod.yml";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

// ------------------------------------------------------------------------------------------------
// DIE EINE AUSNAHME — benannt, begruendet, und sie loest sich selbst auf
// ------------------------------------------------------------------------------------------------
//
// Eine der fuenfzehn Integrationsdateien liess sich NICHT umstellen: sie ist eingefroren.
// `tests/library-analytics-freeze144.test.ts` haelt sechs Dateien des Moduls `library-analytics`
// auf ihrem Hash fest, und eine Aenderung ist nur mit einer FREIGABE gueltig, deren
// `autorisiertHash` den neuen Inhalt nennt. Der Kopf jener Datei sagt zur Zeichnungsbefugnis
// ausdruecklich:
//
//   „WER die Freigaben zeichnet, ist eine offene Ownerfrage. Sie wird hier NICHT entschieden
//    und nicht geraten."
//
// **Also zeichne ich keine.** Die Datei traegt weiter den alten, mehrdeutigen Namen `klarwerk`.
// Das ist der Preis, und er steht hier, statt in einer stillen Auslassung zu verschwinden.
//
// DIE AUSNAHME IST NICHT GESCHENKT, sondern an eine Bedingung gebunden (Fall N7): Sie gilt nur,
// solange die Datei WIRKLICH im Freeze-Manifest steht — gemessen an jener Datei, nicht behauptet.
// Faellt der Freeze, wird N7 rot, die Ausnahme muss weg, und die Datei muss umgestellt werden.
// Eine Ausnahme, die niemand mehr aufloest, ist eine Luecke mit gutem Ruf.
const FREEZE_WACHE = "tests/library-analytics-freeze144.test.ts";
const EINGEFROREN_AUSGENOMMEN = ["services/library-analytics/src/repo-pg.integration.test.ts"];

// ------------------------------------------------------------------------------------------------
// DIE DREI NAMEN, AUS DEM BAUM GELESEN
// ------------------------------------------------------------------------------------------------

const NAME_DEV = postgresDbAus(lies(COMPOSE_DEV));
const NAME_PROD = postgresDbAus(lies(COMPOSE_PROD));

const ALLE_INTEGRATIONSDATEIEN = [
  ...dateienMitEndung("tests", ".integration.test.ts"),
  ...dateienMitEndung("services", ".integration.test.ts"),
].filter((pfad) => postgresDbAusTestcontainer(lies(pfad)).length > 0);

/** Die Dateien, die die Zusicherung wirklich tragen — ohne die eingefrorene Ausnahme. */
const INTEGRATIONSDATEIEN = ALLE_INTEGRATIONSDATEIEN.filter(
  (pfad) => !EINGEFROREN_AUSGENOMMEN.includes(pfad),
);

const TESTNAMEN = [
  ...new Set(INTEGRATIONSDATEIEN.flatMap((pfad) => postgresDbAusTestcontainer(lies(pfad)))),
].sort();
const NAME_TEST = TESTNAMEN.length === 1 ? (TESTNAMEN[0] as string) : null;

const LAGE =
  `dev=${NAME_DEV} · prod=${NAME_PROD} · test=${JSON.stringify(TESTNAMEN)} ` +
  `(${INTEGRATIONSDATEIEN.length} Integrationsdateien)`;

// ================================================================================================
describe("JOB2354 D1 · E7 — drei Umgebungen, drei Namen", () => {
  it("N0 · die drei Namen sind ueberhaupt lesbar — sonst prueft alles darunter nichts", () => {
    expect(NAME_DEV, `${COMPOSE_DEV} nennt kein POSTGRES_DB. ${LAGE}`).not.toBeNull();
    expect(NAME_PROD, `${COMPOSE_PROD} nennt kein POSTGRES_DB. ${LAGE}`).not.toBeNull();
    expect(
      INTEGRATIONSDATEIEN.length,
      "keine Integrationsdatei startet einen Postgres-Container — dann ist die Testebene nicht messbar",
    ).toBeGreaterThan(0);
    expect(
      TESTNAMEN,
      `Die Wegwerf-Container tragen mehr als einen Namen: ${JSON.stringify(TESTNAMEN)}. Dann gibt es keine EINE Testdatenbank, und die Herkunft ist wieder nicht ablesbar.`,
    ).toHaveLength(1);
  });

  it("N1 · DIE ZUSICHERUNG: die drei Namen sind paarweise VERSCHIEDEN", () => {
    // Das ist der Erfuellungssatz von E7, und dies ist der Fall, der rot faellt, sobald zwei der
    // drei gleich sind — in JEDER der drei Paarungen, nicht nur in der, die heute auffiel.
    expect(NAME_DEV, `Entwicklung und Produktion heissen gleich. ${LAGE}`).not.toBe(NAME_PROD);
    expect(NAME_DEV, `Entwicklung und Test heissen gleich. ${LAGE}`).not.toBe(NAME_TEST);
    expect(NAME_PROD, `Produktion und Test heissen gleich. ${LAGE}`).not.toBe(NAME_TEST);
    // Und als Menge: drei Eintraege, keiner doppelt.
    expect(new Set([NAME_DEV, NAME_PROD, NAME_TEST]).size, LAGE).toBe(3);
  });

  it("N2 · JEDE COMPOSE-DATEI IST MIT SICH SELBST EINIG: Deklaration und Verbindungszeichenkette", () => {
    // Der stille Bruch, den eine reine Namenspruefung nicht faengt: Der Container startet unter
    // `POSTGRES_DB`, die App verbindet sich ueber die URL. Wandern die beiden auseinander, laeuft
    // alles gegen eine Datenbank, die es nicht gibt — und das faellt erst zur Laufzeit auf.
    for (const [datei, erwartet] of [
      [COMPOSE_PROD, NAME_PROD],
      [COMPOSE_DEV, NAME_DEV],
    ] as const) {
      for (const gefunden of datenbanknamenAusUrls(lies(datei))) {
        expect(
          gefunden,
          `${datei} deklariert POSTGRES_DB ${erwartet}, eine Verbindungszeichenkette dort nennt aber ${gefunden}.`,
        ).toBe(erwartet);
      }
    }
  });

  it("N3 · DIE TESTEBENE, ueber den ganzen Baum: Container und URL nennen denselben Namen", () => {
    // Vierzehn Dateien, zwanzig Verbindungszeichenketten (die fuenfzehnte ist eingefroren, s. N7).
    // Ohne diesen Fall koennte eine
    // einzelne davon beim naechsten Umbau zurueckfallen, ohne dass irgendwo etwas rot wuerde —
    // und Integrationstests laufen NICHT im schnellen Tor, sie brauchen Docker. Diese Zusicherung
    // ist deshalb die einzige, die einen solchen Rueckfall OHNE Docker bemerkt.
    for (const datei of INTEGRATIONSDATEIEN) {
      const inhalt = lies(datei);
      for (const gefunden of postgresDbAusTestcontainer(inhalt)) {
        expect(gefunden, `${datei}: POSTGRES_DB im Testcontainer`).toBe(NAME_TEST);
      }
      for (const gefunden of datenbanknamenAusUrls(inhalt)) {
        expect(
          gefunden,
          `${datei}: eine Verbindungszeichenkette nennt ${gefunden}, der Container heisst ${NAME_TEST}.`,
        ).toBe(NAME_TEST);
      }
    }
  });

  it("N4 · DIE SICHERUNG DES HAUSES GREIFT — und sie greift NUR auf der Testebene", () => {
    // `services/db-tx/src/pg-test-guard.ts:25` gibt die destruktive Pg-Suite (sie DROPPT Tabellen)
    // ausschliesslich frei, wenn der Datenbankname `test` enthaelt. Solange alle drei `klarwerk`
    // hiessen, erfuellte KEINE von ihnen diese Bedingung — die Sicherung lief ins Leere.
    expect(
      NAME_TEST?.toLowerCase().includes("test"),
      `Der Testname ${NAME_TEST} traegt kein „test“ — guardedLocalPgTestUrl wuerde ihn ablehnen.`,
    ).toBe(true);
    // Und die Gegenrichtung, die wichtiger ist: Produktion und Entwicklung duerfen das Wort NICHT
    // tragen, sonst wuerde dieselbe Sicherung sie eines Tages als Wegwerf-Datenbank durchwinken.
    expect(
      NAME_PROD?.toLowerCase().includes("test"),
      `Der Produktionsname ${NAME_PROD} traegt „test“ — die destruktive Suite duerfte darauf laufen.`,
    ).toBe(false);
    expect(
      NAME_DEV?.toLowerCase().includes("test"),
      `Der Entwicklungsname ${NAME_DEV} traegt „test“.`,
    ).toBe(false);
  });

  it("N5 · KALIBRIERUNG: die Leser lesen wirklich — an synthetischen Eingaben", () => {
    // Ohne diesen Fall waere alles oben auch dann gruen, wenn die Leser grundsaetzlich nichts
    // faenden: `null` ist von `null` nicht verschieden, und eine leere Namensliste widerspricht
    // keiner Zusicherung.
    expect(postgresDbAus("services:\n  db:\n    environment:\n      POSTGRES_DB: a_b\n")).toBe(
      "a_b",
    );
    // Ein Kommentar, der den Namen NENNT, ist keine Deklaration — genau die Falle, die dieser
    // Durchgang selbst gelegt hat, indem er Begruendungen neben die Zeilen geschrieben hat.
    expect(postgresDbAus("      # POSTGRES_DB: klarwerk (frueher)\n      POSTGRES_DB: neu\n")).toBe(
      "neu",
    );
    expect(postgresDbAus("nichts hier")).toBeNull();

    expect(datenbanknamenAusUrls("postgresql://u:p@host:5432/eins")).toEqual(["eins"]);
    expect(datenbanknamenAusUrls("postgres://u:p@h:1/a und postgresql://u@h:2/b")).toEqual([
      "a",
      "b",
    ]);
    expect(datenbanknamenAusUrls("kein treffer")).toEqual([]);

    expect(postgresDbAusTestcontainer('.withEnvironment({ POSTGRES_DB: "x_test" })')).toEqual([
      "x_test",
    ]);
    expect(postgresDbAusTestcontainer("nichts")).toEqual([]);
  });

  it("N7 · DIE AUSNAHME IST GEBUNDEN — sie gilt nur, solange der Freeze wirklich steht", () => {
    // Eine Ausnahme, die sich selbst rechtfertigt, ist keine. Diese hier gilt ausschliesslich,
    // solange die Datei WIRKLICH im Freeze-Manifest steht — gemessen an jener Datei.
    const freezeText = lies(FREEZE_WACHE);
    for (const pfad of EINGEFROREN_AUSGENOMMEN) {
      expect(
        freezeText.includes(pfad),
        `${pfad} ist hier ausgenommen, steht aber nicht mehr in ${FREEZE_WACHE}. Dann gibt es keinen Grund mehr, sie auszulassen: Ausnahme streichen und die Datei auf den Testnamen umstellen.`,
      ).toBe(true);
      // Und die Ausnahme kostet wirklich etwas — sie traegt den alten, mehrdeutigen Namen.
      // Stuende dort laengst der neue, waere die Ausnahme ueberfluessig und gehoerte weg.
      expect(
        postgresDbAusTestcontainer(lies(pfad)),
        `${pfad} traegt nicht mehr den alten Namen — die Ausnahme ist ueberholt und gehoert weg.`,
      ).not.toContain(NAME_TEST);
    }
    // Die Menge ist GEPINNT: waechst sie, faellt dieser Fall. Eine Ausnahme darf sich nicht
    // stillschweigend vermehren — genau daran ist der Gedanke sonst schon oft gestorben.
    expect(EINGEFROREN_AUSGENOMMEN).toHaveLength(1);
    expect(ALLE_INTEGRATIONSDATEIEN.length - INTEGRATIONSDATEIEN.length).toBe(1);
  });

  it("N6 · DER ALTE ZUSTAND WIRD ERKANNT — die Regel haette ihn gefangen", () => {
    // Der Stand vor diesem Durchgang, woertlich aus JOB 2312 D1 §4.6. Ohne diesen Fall bliebe
    // offen, ob N1 ueberhaupt etwas verlangt oder nur den heutigen Baum nachspricht.
    const altDev = postgresDbAus("      POSTGRES_USER: klarwerk\n      POSTGRES_DB: klarwerk\n");
    const altProd = postgresDbAus("      POSTGRES_DB: klarwerk\n");
    const altTest = postgresDbAusTestcontainer(
      '.withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })',
    )[0];
    expect(altDev).toBe("klarwerk");
    expect(altProd).toBe("klarwerk");
    expect(altTest).toBe("klarwerk");
    // Drei Ebenen, ein Name — die Menge haette EINEN Eintrag gehabt, nicht drei.
    expect(new Set([altDev, altProd, altTest]).size).toBe(1);
    // Und die Sicherung des Hauses haette auf dieser Testebene nicht gegriffen.
    expect(String(altTest).toLowerCase().includes("test")).toBe(false);
  });
});
