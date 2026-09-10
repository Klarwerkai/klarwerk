// ================================================================================================
// JOB 3448 · TOR-T1e — DIE ABBAUGRENZE WIRD GERECHNET, NICHT HINGESCHRIEBEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. `ABBAU_GRENZE_MS` macht eine Browserdatei rot, wenn ihr `close()` zu
// lange braucht. Bis zu diesem Auftrag war die Zahl dahinter ungepinnt: `GEMESSEN_MS` und
// `SICHERHEITSFAKTOR` waren nicht einmal exportiert, und die einzige Zusicherung im ganzen Baum
// (`t1d-vollstaendig.test.tsx:258`, `toBeLessThan(60_000)`) hätte auch `GEMESSEN_MS = 59` mit
// `SICHERHEITSFAKTOR = 1` durchgelassen. Wer die Grenze hinschrieb, statt sie zu rechnen, blieb grün.
//
// R1 SCHLIESST GENAU DIESE TÜR — mit reiner Arithmetik über gespeicherte Zahlen: kein Browser, keine
// Zeitmessung, bei jedem Lauf dasselbe Ergebnis. Fünf Zusicherungen, jede über eine andere Halbheit:
// eine zu kurze Reihe, ein Mittel- oder Bestwert statt des Höchstwerts, eine hingeschriebene Grenze,
// eine Grenze ohne Reserve, eine Grenze über dem Hook-Rahmen.
//
// R2 IST DER GEGENPOL: die Grenze ist erst dann eine Zusage, wenn eine echte Messung sie einhält.
// Der Fall erhebt EINE frische echte `close()`-Dauer an einem echten Chromium und sichert
// AUSSCHLIESSLICH zu, dass sie unter der Grenze liegt — das ist das Versprechen der Grenze und
// sonst nichts.
//
// AUSDRÜCKLICH NICHT GEBAUT (JOB 3448 §10.1, belegter Abbruchgrund des Vorgängers JOB 3197): eine
// Zusicherung, die eine frisch gemessene Dauer über einen FESTEN Faktor mit `GEMESSEN_MS` oder einem
// Wert aus `KALIBRIERREIHE_MS` verknüpft. Ein frisches, unbelastetes `close()` und ein Höchstwert
// unter Last sind verschiedene Größen; JOB 3197 ist daran dreimal gescheitert (`archiv/3197/runde-3/
// code.md`: „frisches close: 17.5ms · Kalibrierwert: 1527.47ms: expected 87.284 to be less than or
// equal to 10", Vorrunden 22, 34, 19 gegen dieselbe feste Grenze 10). Deshalb gibt es hier KEINE
// untere Schranke und KEINE Größenordnungsschranke — der Quotient wird protokolliert, nicht zugesichert.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type Stand, starte } from "../design/h6-chromium";
import {
  ABBAU_GRENZE_MS,
  GEMESSEN_MS,
  KALIBRIERREIHE_MS,
  SICHERHEITSFAKTOR,
  schliesseChromium,
} from "./chromium-abbau";

const DATEI = "tests/tor-bereitschaft/t1e-ableitung.test.ts";

describe("R1 · die Ableitung der Abbaugrenze ist deterministisch gepinnt", () => {
  it("R1a · die Kalibrierreihe trägt mindestens fünf Messungen", () => {
    expect(KALIBRIERREIHE_MS.length).toBeGreaterThanOrEqual(5);
  });

  it("R1b · der Kalibrierwert ist der HÖCHSTWERT der Reihe — kein Mittel-, kein Bestwert", () => {
    expect(GEMESSEN_MS).toBe(Math.max(...KALIBRIERREIHE_MS));
  });

  it("R1c · die Grenze ist gerechnet: Höchstwert × Sicherheitsfaktor", () => {
    expect(ABBAU_GRENZE_MS).toBe(GEMESSEN_MS * SICHERHEITSFAKTOR);
  });

  it("R1d · die Grenze hat Reserve über dem gemessenen Höchstwert", () => {
    expect(ABBAU_GRENZE_MS).toBeGreaterThan(GEMESSEN_MS);
  });

  it("R1e · die Grenze bleibt unter dem 60-s-Hook-Rahmen", () => {
    // Dieselbe Zusicherung steht zusätzlich in `t1d-vollstaendig.test.tsx:258`, dort innerhalb der
    // Negativfall-Schleife. Zwei Orte für DIESE Zusicherung sind erlaubt und gewollt (der dortige
    // Fall braucht sie als Vorbedingung seiner virtuellen Uhr); zwei Orte für die ABLEITUNG wären es
    // nicht — die steht ausschließlich in `chromium-abbau.ts`.
    expect(ABBAU_GRENZE_MS).toBeLessThan(60_000);
  });
});

describe("R2 · die Grenze trägt eine echte Messung", () => {
  let stand: Stand;

  beforeAll(async () => {
    stand = await starte("/admin", '[data-einst="seite"]', 1280, 900);
  }, 180_000);

  afterAll(async () => {
    // Der Browser IST der Messgegenstand und wird im Fall selbst geschlossen; hier bleibt nur die App.
    await stand?.app?.close();
  }, 60_000);

  it("R2 · ein frisches echtes close() liegt unter der Abbaugrenze", async () => {
    expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
    expect(stand.browser, "kein Browser aufgebaut — dann ist nichts gemessen").not.toBeNull();

    // Gemessen wird NICHT hier, sondern in der einen Messstelle (`chromium-abbau.ts`). Dieser Fall
    // liest nur ihre Protokollzeile — sonst gäbe es einen zweiten Messweg (Lieferpunkt 9).
    const zeilen: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...teile: unknown[]) => {
      zeilen.push(teile.map((t) => String(t)).join(" "));
    });
    let fehler: unknown;
    try {
      fehler = await schliesseChromium(DATEI, stand.browser).then(
        () => null,
        (e: unknown) => e,
      );
    } finally {
      log.mockRestore();
    }
    const zeile = zeilen.find((z) => z.startsWith("Chromium-Abbau · "));
    expect(
      zeile,
      `die eine Messstelle hat nichts protokolliert: ${JSON.stringify(zeilen)}`,
    ).toBeDefined();
    // eslint-disable-next-line no-console -- die Protokollzeile ist der Beleg der Rückgabe
    console.log(zeile);

    const dauer = Number(/· ([0-9.]+)ms · Grenze/.exec(zeile as string)?.[1]);
    expect(Number.isFinite(dauer), `unlesbare Protokollzeile: ${zeile}`).toBe(true);
    // eslint-disable-next-line no-console -- Quotient als reine Information, NICHT als Zusicherung
    console.log(
      `JOB 3448 R2 · frisches echtes close(): ${dauer}ms · Grenze ${ABBAU_GRENZE_MS}ms · ` +
        `Quotient ${(ABBAU_GRENZE_MS / dauer).toFixed(1)}× (reine Information, keine Zusicherung)`,
    );

    // DIE EINE ZUSAGE DER GRENZE. Keine untere Schranke, keine Größenordnungsschranke (§10.1).
    expect(dauer, `frisches close ${dauer}ms · Grenze ${ABBAU_GRENZE_MS}ms`).toBeLessThan(
      ABBAU_GRENZE_MS,
    );
    // Und die Voraussetzung der Aussage: gemessen wurde ein close(), das WIRKLICH fertig geworden
    // ist. Ohne sie wäre eine Dauer von 0 ms nach sofortiger Ablehnung „unter der Grenze" — und der
    // Fall grün, ohne dass ein Browser zuging (§7 Zustandsmodell, Punkt 2).
    expect(zeile, `letzter Zustand in ${zeile}`).toContain("letzter Zustand: close() bestätigt");
    expect(fehler, `close() ist nicht sauber durchgelaufen: ${String(fehler)}`).toBeNull();
  }, 120_000);
});
