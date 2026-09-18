// ================================================================================================
// JOB 4329 · DER TOR-ZEUGE — „die Strecke ist da, das Format ist das des Add-ins, die Fixture hält".
// ================================================================================================
//
// WAS ER SAGT UND WAS NICHT. Die eigentliche Abnahme dieses Auftrags ist EIN Lauf gegen echtes
// PostgreSQL in einem echten Chromium. Der läuft im Cloud-Wrapper
// (`vitest.integration.config.ts:7`), NICHT im Tor: `vitest.config.ts:32` nimmt
// `**/*.integration.test.ts` ausdrücklich aus. Im Tor bliebe von diesem Auftrag sonst nur die
// Fixture-Kalibrierung — und niemand merkte, wenn
//
//   · die Integrationsdatei umbenannt würde und dadurch in KEINEM Lauf mehr liefe,
//   · das Add-in sein Nutzlastformat änderte und die Nachbildung in `pruefbilder.ts` still
//     veraltete,
//   · die Fixture sich veränderte und damit auch der Inhalt, den die Abnahme misst.
//
// Diese drei Dinge hält dieser Zeuge fest. Er behauptet KEINE PG-Abnahme und kein Grün der
// Strecke — ob sie GELAUFEN ist, sagt allein der Laufzustand-Zeuge in der Integrationsdatei, und
// zwar nur in deren eigenem Lauf. Ein Tor-Zeuge, der „gelaufen" sagen dürfte, wäre genau das
// gefälschte Grün, gegen das `archiv/4299/AUFTRAG.md` §2e steht.
//
// Leicht: keine Datenbank, kein Browser, kein Netz, kein Playwright im Importgraphen (sonst zöge
// `tests/tor-inventar/browser-gruppe.ts` diese Datei in die serielle Browser-Gruppe).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";
import { FIXTUREN, KALIBRIERUNGSMARKE, PRUEFBILDER, pngBytes, sha256 } from "./pruefbilder";

/** Die Strecke dieses Auftrags — der Pfad steht hier als Wort, damit eine Umbenennung auffällt. */
const STRECKE = "tests/rueckweg-bilder-nutzerweg/rueckweg-bilder-pg-im-browser.integration.test.ts";

const RUECKWEG_JS = "apps/web/public/word-addin/rueckweg.js";

/**
 * DIE FESTGESCHRIEBENEN BYTES DER FIXTURE.
 *
 * Gemessen am 17.09.2026 auf Node v24.16.0 (zlib 1.3.1). Sie hängen an drei Dingen: der
 * Bildpunkt-Regel in `pruefbilder.ts`, der PNG-Bauform und der Deflate-Ausgabe von `node:zlib`
 * bei `level: 9`. Ändert sich eine Zahl hier, ist das KEIN Produktfehler, sondern die Aufforderung
 * nachzusehen, WELCHE der drei sich bewegt hat — und, falls es die Bildpunkt-Regel war, die
 * Abnahme mit der neuen Fixture zu wiederholen. Die Fälle K1–K4 in `pruefbilder.test.ts` messen die
 * Regel selbst; dieser Pin misst, dass die BYTES stabil bleiben.
 */
const FIXTURE_PIN = [
  {
    nr: 1,
    bytes: 16216,
    sha256Png: "93b3e7fd6d7fc291d5b51ecb51e0adcab5b8c0a7b6aff7681573bb0036506968",
    sha256Quelle: "9359be971017236854279a254126c16c90f5a4b2db4e7ce5f904626f84d83ae8",
    sha256Rgba: "b768a7ec592beecbffd4df3ae5ab2b351bb70b83b6ec40e12dff5e354bdc1381",
  },
  {
    nr: 2,
    bytes: 11825,
    sha256Png: "e6ca1b97e0da3483ee5466c33e8cc6a73c725de42b30f15242bdc4f2a550ef53",
    sha256Quelle: "ca936e431c64a04d3d49c01795eeee22bc405bcabfbd7817416b3bd64e731bd4",
    sha256Rgba: "bc675c9c5f696d11451b654a0870cf4035ebe26d8f8d32e813b51b7e001d8113",
  },
] as const;

describe("JOB 4329 · Tor-Zeuge: Strecke vorhanden, Add-in-Format unverändert, Fixture stabil", () => {
  it("Z1 · die Integrationsdatei liegt am festen Pfad und endet auf .integration.test.ts", () => {
    expect(
      STRECKE.endsWith(".integration.test.ts"),
      "die Strecke trüge eine andere Endung und liefe damit im normalen Tor statt im Cloud-Lauf",
    ).toBe(true);
    expect(
      existsSync(repoPfad(STRECKE)),
      `die Strecke dieses Auftrags fehlt: ${STRECKE} — dann misst NIEMAND die Bilddarstellung des Rückwegs`,
    ).toBe(true);
    const quelle = readFileSync(repoPfad(STRECKE), "utf8");
    // Sie muss wirklich die Strecke sein und nicht eine leere Hülle: PostgreSQL, Chromium, echter
    // Socket und der Laufzustand-Zeuge stehen darin.
    for (const merkmal of [
      "pruefplatzOeffnen",
      "starteChromium",
      "instanzStarten",
      "nutzlastWieRwLadung",
      "Laufzustand",
    ]) {
      expect(
        quelle.includes(merkmal),
        `die Strecke nennt „${merkmal}" nicht — sie fährt dann nicht mehr, was dieser Auftrag zusagt`,
      ).toBe(true);
    }
  });

  it("Z2 · das Nutzlastformat des Add-ins steht unverändert im Produkt (rwLadung)", () => {
    const js = readFileSync(repoPfad(RUECKWEG_JS), "utf8");
    // Der EINE `JSON.stringify`-Block des Vorschlagswegs (`rueckweg.js:606-614`). Gemessen wird der
    // BLOCK und nicht vier einzelne Vorkommen: die vier Felder müssen zusammen in derselben Ladung
    // stehen, sonst bildet `pruefbilder.ts` etwas nach, das es so nicht mehr gibt.
    const block = js.match(
      /JSON\.stringify\(\{\s*action:\s*"propose",\s*proposal:\s*\{[\s\S]{0,400}?\}\s*\}\)/,
    );
    expect(
      block,
      `${RUECKWEG_JS} trägt keinen JSON.stringify-Block mit action: "propose" mehr — die Nachbildung in pruefbilder.ts ist damit veraltet`,
    ).not.toBeNull();
    const text = (block as RegExpMatchArray)[0] as string;
    for (const feld of [
      /statement:\s*statement/,
      /bodyHtml:\s*koerper/,
      /baseVersion:\s*version/,
      /origin:\s*"word_addin"/,
    ]) {
      expect(
        feld.test(text),
        `im Vorschlagsblock von ${RUECKWEG_JS} fehlt ${String(feld)} — das Add-in sendet etwas anderes als der Test`,
      ).toBe(true);
    }
    // „nicht mehr und nicht weniger": genau vier Feldzuweisungen im `proposal`.
    const proposal = text.slice(text.indexOf("proposal:"));
    const felder = [...proposal.matchAll(/(\w+):\s*(?:statement|koerper|version|"word_addin")/g)];
    expect(
      felder.map((m) => m[1]),
      "der Vorschlag des Add-ins trägt nicht mehr genau vier Felder in dieser Reihenfolge",
    ).toEqual(["statement", "bodyHtml", "baseVersion", "origin"]);
  });

  it("Z3 · der Einreichweg des Add-ins ist unverändert PUT mit application/json", () => {
    const js = readFileSync(repoPfad(RUECKWEG_JS), "utf8");
    const einreichen = js.slice(js.indexOf("function rwEinreichen("));
    expect(
      einreichen.length,
      `${RUECKWEG_JS} kennt kein rwEinreichen mehr — der Einreichweg dieses Auftrags hätte kein Vorbild`,
    ).toBeGreaterThan(0);
    const kopf = einreichen.slice(0, 500);
    expect(/method:\s*"PUT"/.test(kopf), "rwEinreichen sendet nicht mehr mit PUT").toBe(true);
    expect(
      /"content-type":\s*"application\/json"/.test(kopf),
      "rwEinreichen sendet nicht mehr mit content-type application/json",
    ).toBe(true);
    // Der EINE Abrufweg — er entscheidet, auf welche Route die Nutzlast geht.
    expect(
      /fetch\("\/api\/kos\/"\s*\+\s*encodeURIComponent\(id\),\s*init\)/.test(js),
      `${RUECKWEG_JS}: rwRuf zeigt nicht mehr auf /api/kos/<id> — die Strecke führe dann woandershin`,
    ).toBe(true);
  });

  it("Z4 · die Fixture ist stabil: Bytezahl und sha256 beider PNGs unverändert", () => {
    for (const pin of FIXTURE_PIN) {
      const fix = FIXTUREN[pin.nr - 1];
      expect(fix, `Bild ${pin.nr} fehlt in FIXTUREN`).toBeDefined();
      const f = fix as (typeof FIXTUREN)[number];
      expect(f.png.length, `Bild ${pin.nr}: die PNG-Bytezahl hat sich geändert`).toBe(pin.bytes);
      expect(f.sha256Png, `Bild ${pin.nr}: die PNG-Bytes haben sich geändert`).toBe(pin.sha256Png);
      expect(f.sha256Quelle, `Bild ${pin.nr}: die data:-Quelle hat sich geändert`).toBe(
        pin.sha256Quelle,
      );
      expect(f.sha256Rgba, `Bild ${pin.nr}: die erwarteten Bildpunkte haben sich geändert`).toBe(
        pin.sha256Rgba,
      );
    }
    // Und die Erzeugung bleibt im selben Lauf deterministisch — der Pin misst sonst einen Zufall.
    for (const bild of PRUEFBILDER) {
      expect(sha256(pngBytes(bild)), `Bild ${bild.nr}: zwei Erzeugungen, zwei Hashes`).toBe(
        sha256(pngBytes(bild)),
      );
    }
    process.stderr.write(
      `[KLARWERK] JOB 4329 TOR-ZEUGE: Strecke vorhanden · Add-in-Format unverändert · Fixture stabil (Bild1 ${FIXTURE_PIN[0].bytes} B, Bild2 ${FIXTURE_PIN[1].bytes} B). Dieser Zeuge sagt NICHT, dass die PG-/Chromium-Strecke gelaufen ist.\n`,
    );
  });

  it("Z5 · die Kalibrierungsmarke liegt NICHT im Bestand — kein dauerhaft roter Fall", () => {
    // Die sechs Kalibrierungen sind absichtlich rot. Sie laufen nur, wenn jemand sie anfordert —
    // über `KLARWERK_KALIBRIERUNG=1` oder über diese Marke (nötig, weil der Cloud-Wrapper keine
    // Umgebungsvariable entgegennimmt, s. `pruefbilder.ts` bei `KALIBRIERUNGSMARKE`). Bliebe die
    // Marke versehentlich liegen, wären sechs Fälle dauerhaft rot und niemand wüsste warum.
    expect(
      existsSync(repoPfad(KALIBRIERUNGSMARKE)),
      `${KALIBRIERUNGSMARKE} liegt im Arbeitsbaum — damit laufen die absichtlich roten Kalibrierungen bei JEDEM Integrationslauf. Die Datei gehört gelöscht.`,
    ).toBe(false);
  });
});
