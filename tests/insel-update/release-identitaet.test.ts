// ================================================================================================
// JOB 4012 · RUNDE 2 — EIN RÜCKFALL BRAUCHT EINE VORVERSION, DIE ES NOCH GIBT.
// ================================================================================================
//
// DER FEHLER, DEN BEN IN RUNDE 1 GEMESSEN HAT (Gegenprobe BEN1, Cloud 3aabe847): Die Baudatei
// vergab EINEN festen Releasenamen (`klarwerk-insel-2026-07-09-current-01`), und das Update löschte
// sein Zielverzeichnis vor dem Auspacken (`rm -rf "$ZIEL"`). Zwei Bauläufe hießen damit gleich, und
// das zweite Einspielen überschrieb genau die Fassung, auf die der Rückfall gleich zurückgreifen
// wollte. Blieb der Health danach rot, startete der „Rückfall" dasselbe kaputte Release erneut —
// gemessen: Exit 9, danach HTTP 500. Das Netz hing an einem Nagel, den es selbst gezogen hatte.
//
// DIE ZWEI HÄLFTEN DER ANTWORT, und beide werden hier gemessen:
//   1. IDENTITÄT   Jeder Baulauf trägt seinen eigenen Namen (App-Version, Commit, Bauzeit).
//   2. UNVERSEHRTHEIT  Ein vorhandenes Release wird NIE überschrieben. Auch nicht bei Namensgleichheit
//                      durch ein umbenanntes oder von Hand gebautes Paket — dann bricht der Weg ab,
//                      BEVOR er etwas anfasst.
//
// Punkt 2 ist der tragende: Punkt 1 kann ein Mensch mit einem umbenannten Zip umgehen, Punkt 2 nicht.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  WURZEL,
  aktivesRelease,
  fahreRueckfall,
  fahreUpdate,
  feldAus,
  gesundheit,
  legeInselAn,
  legeJournalAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
} from "./insel-probe";

const RELEASE_TEXTE = join(WURZEL, "scripts/insel/release-texte.mjs");
const BAU = join(WURZEL, "scripts/insel/build-current-release.mjs");

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/**
 * Ruft eine Funktion aus `release-texte.mjs` in einem echten Node-Lauf.
 *
 * WARUM NICHT IMPORTIERT: `tsconfig.json` kennt kein `allowJs`; ein Import der `.mjs` aus einer
 * `.ts`-Datei wäre im Typcheck rot. Der Unterlauf misst dieselbe Funktion — und zusätzlich, dass die
 * Datei überhaupt als Modul lädt.
 */
function ausReleaseTexte(ausdruck: string): { code: number | null; text: string; fehler: string } {
  const lauf = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as t from ${JSON.stringify(RELEASE_TEXTE)};
process.stdout.write(String(${ausdruck}));`,
    ],
    { encoding: "utf8" },
  );
  return { code: lauf.status, text: lauf.stdout ?? "", fehler: lauf.stderr ?? "" };
}

describe("JOB 4012 · jeder Baulauf hat seine eigene Identität", () => {
  it("K1 · zwei Bauläufe desselben Commits tragen zwei Namen — Version, Commit und Bauzeit stecken drin", () => {
    const eins = ausReleaseTexte(
      't.releaseIdentitaet({ appVersion: "1.0.0-beta.1.503", commit: "f9117cb9bc8c5c43fc10a4398046035345fdd6b3", gebautAm: "2026-09-14T19:30:00.000Z" })',
    );
    const zwei = ausReleaseTexte(
      't.releaseIdentitaet({ appVersion: "1.0.0-beta.1.503", commit: "f9117cb9bc8c5c43fc10a4398046035345fdd6b3", gebautAm: "2026-09-14T20:05:17.000Z" })',
    );
    expect(eins.code, eins.fehler).toBe(0);
    expect(zwei.code, zwei.fehler).toBe(0);

    expect(eins.text).toBe("klarwerk-insel-1.0.0-beta.1.503-f9117cb9-20260914T193000Z");
    expect(zwei.text).toBe("klarwerk-insel-1.0.0-beta.1.503-f9117cb9-20260914T200517Z");
    expect(eins.text, "zwei Bauläufe dürfen nie denselben Namen tragen").not.toBe(zwei.text);
  });

  it("K2 · eine unplausible Herkunft wird abgelehnt, nicht in einen Namen eingebaut", () => {
    // Ein Branchname, ein `latest` oder ein uneingesetztes `$SOURCE_COMMIT` sind KEIN Commit. Wer
    // sie in die Identität einbaute, bekäme wieder Namensgleichheit zwischen zwei Ständen.
    for (const commit of ['"latest"', '"main"', '""']) {
      const lauf = ausReleaseTexte(
        `t.releaseIdentitaet({ appVersion: "1.0.0", commit: ${commit}, gebautAm: "2026-09-14T19:30:00.000Z" })`,
      );
      expect(lauf.code, `commit=${commit} wurde angenommen: ${lauf.text}`).not.toBe(0);
    }
    const ohneVersion = ausReleaseTexte(
      't.releaseIdentitaet({ appVersion: "", commit: "f9117cb9bc8c5c43fc10a4398046035345fdd6b3", gebautAm: "2026-09-14T19:30:00.000Z" })',
    );
    expect(ohneVersion.code, ohneVersion.text).not.toBe(0);
  });

  it("K3 · die Baudatei vergibt keinen festen Releasenamen mehr", () => {
    const quelle = readFileSync(BAU, "utf8");
    expect(quelle, "die Identität muss aus der geprüften Funktion kommen").toContain(
      "releaseIdentitaet(",
    );
    expect(
      /const version = "klarwerk-insel-[^"]*"/.test(quelle),
      "ein fest verdrahteter Releasename macht zwei Bauläufe wieder namensgleich",
    ).toBe(false);
  });
});

describe("JOB 4012 · ein vorhandenes Release wird nie überschrieben (BEN1)", () => {
  const GLEICH = "klarwerk-insel-gleicher-name";

  async function inselMitLaufenderFassung(): Promise<Insel> {
    const neue = await legeInselAn();
    schreibeRelease(neue.releases, { name: GLEICH, appVersion: "1.0.0" });
    setzeCurrent(neue, GLEICH);
    legeJournalAn(neue);
    return neue;
  }

  it("K4 · gleicher Name, anderer Inhalt: Abbruch VOR dem Umschalten, die Vorversion bleibt vollständig", async () => {
    insel = await inselMitLaufenderFassung();
    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    // Ein umbenanntes Paket: derselbe Releasename, eine andere Fassung — und sie kommt nicht hoch.
    schreibeRelease(eingang, { name: GLEICH, appVersion: "1.1.0", gesundheit: "rot" });

    const lauf = fahreUpdate(insel, join(eingang, GLEICH));

    expect(lauf.code, lauf.ausgabe).toBe(6);
    expect(lauf.ergebnis).toBe(
      "Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: kollision",
    );
    expect(aktivesRelease(insel)).toBe(GLEICH);
    // Das Entscheidende: der Inhalt der Vorversion ist unangetastet.
    const vertrag = readFileSync(join(insel.releases, GLEICH, "SCHEMA-VERTRAG"), "utf8");
    expect(feldAus(vertrag, "app_version"), "die Vorversion wurde überschrieben").toBe("1.0.0");
  });

  it("K5 · und sie lässt sich danach wirklich noch starten — nicht nur behaupten", async () => {
    insel = await inselMitLaufenderFassung();
    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    schreibeRelease(eingang, { name: GLEICH, appVersion: "1.1.0", gesundheit: "rot" });

    expect(fahreUpdate(insel, join(eingang, GLEICH)).code).toBe(6);

    const zurueck = fahreRueckfall(insel, [GLEICH]);

    expect(zurueck.code, zurueck.ausgabe).toBe(0);
    expect(zurueck.ergebnis).toBe("Vorversion 1.0.0 aktiv");
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });

  it("K6 · ein rotes Release mit EIGENEM Namen lässt die Vorversion unberührt liegen", async () => {
    insel = await inselMitLaufenderFassung();
    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    schreibeRelease(eingang, {
      name: "klarwerk-insel-neuer-name",
      appVersion: "1.1.0",
      gesundheit: "rot",
    });

    const lauf = fahreUpdate(insel, join(eingang, "klarwerk-insel-neuer-name"));

    expect(lauf.code, lauf.ausgabe).toBe(7);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft wieder, Grund: health");
    expect(aktivesRelease(insel)).toBe(GLEICH);
    // Beide Fassungen liegen nebeneinander — der Rückfall hatte etwas, worauf er zurückfallen konnte.
    expect(existsSync(join(insel.releases, GLEICH, "SCHEMA-VERTRAG"))).toBe(true);
    expect(existsSync(join(insel.releases, "klarwerk-insel-neuer-name", "SCHEMA-VERTRAG"))).toBe(
      true,
    );
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });
});
