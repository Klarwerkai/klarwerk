// ================================================================================================
// JOB 3943 · G5 — DER QUELLTEXTWÄCHTER: IN DIESEM ORDNER WIRD AUF ZUSTAND GEWARTET, NIE AUF DIE UHR.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (Auftrag §8.7, ABLÖSUNG): der alte Weg muss WEG, nicht danebenliegen.
// `durchlaufen()` — dreißig Nulltakte ohne jede Auswertung — war bis JOB 3827 die einzige
// Synchronisation zwischen Klick und Zusicherung dieses Ordners. Ein Wächter, der so wartet, wird
// nicht rot, wenn das Produkt kaputtgeht, sondern wenn die Maschine langsam ist. BEN hat ihn
// benannt (`archiv/3827/runde-1/ben.md:25`), und die Zeile TOR-CHROMIUM-ABBAU sammelt genau diese
// Sorte Fehlalarm.
//
// Eine einmalige Umstellung hält nicht: der nächste Fall, den jemand hier anlegt, greift zur
// vertrauten Schleife zurück, weil sie in der Nachbardatei
// `tests/admin-ki-oberflaeche/freigabe-durchstich.test.tsx:285` noch steht (dort zu Recht — sie ist
// nicht Zielpfad dieses Auftrags). Deshalb steht die Ablösung hier als Zusicherung und nicht als
// Behauptung in einer Rückgabe.
//
// WAS ER VERBIETET, IN GENAU DIESEN DREI FORMEN — und warum je einzeln:
//   1. Der Bezeichner `durchlaufen`. Der alte Weg kommt nicht unter seinem alten Namen zurück.
//   2. Jede Zählschleife über eine feste Zahl (`for (let i = 0; i < 30; i++)`). Das ist die Form,
//      unabhängig vom Namen: sie sitzt eine Anzahl Durchläufe ab und wertet dabei nichts aus.
//   3. Jede weitere Fundstelle von `setTimeout`. Genau EINE ist erlaubt, und zwar die im Rumpf von
//      `warteBis` — sie ist der Taktgeber der Zustandsabfrage, nicht die Wartezeit selbst: bei
//      jedem Durchgang wird die Bedingung neu GELESEN, und wird sie nicht erreicht, bricht der Lauf
//      mit ihrem Namen ab. Wer eine zweite anlegt, wartet wieder auf die Uhr.
//      RUNDE 2, GEMESSEN AM EIGENEN LEIB: er zählt auch Fundstellen in KOMMENTAREN. Zwei Sätze, die
//      erklärten, WARUM die Karte ihre Zustände verzögert meldet, nannten den Zeitgeber samt
//      Klammer — und der Lauf wurde rot („expected […] to have a length of 1 but got 3"). Das ist
//      kein Fehlalarm, sondern der Preis der Zeichenkettenlesung: wer den Zeitgeber in Prosa
//      erklärt, nennt ihn ohne seine Klammer.
//
// WAS ER NICHT LEISTET, und das ist ehrlich zu sagen: er liest Zeichenketten, keinen Syntaxbaum.
// Eine Wartezeit, die über `Promise`-Ketten oder einen Alias gebaut wird, sieht er nicht. Er deckt
// die drei Formen, die in diesem Ordner tatsächlich standen und wieder entstehen würden — nicht
// jede denkbare. Die Alternative wäre keine Zusicherung, sondern gar keine.
//
// GEGEN F2 (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts:2735`) ist diese Datei
// unbedenklich: sie nennt kein Schalterfeld, sie liest nur die Quellen dieses Ordners.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ORDNER = fileURLToPath(new URL(".", import.meta.url));

/** Diese Datei selbst — sie MUSS die verbotenen Formen nennen, um sie suchen zu können. */
const EIGENE = "keine-uhr-in-diesem-ordner.test.ts";

/** Jede Quelle dieses Ordners außer dieser hier — neue Dateien fallen automatisch darunter. */
function quellen(): { datei: string; zeilen: string[] }[] {
  return readdirSync(ORDNER)
    .filter((d) => (d.endsWith(".ts") || d.endsWith(".tsx")) && d !== EIGENE)
    .sort()
    .map((datei) => ({
      datei,
      zeilen: readFileSync(`${ORDNER}${datei}`, "utf8").split("\n"),
    }));
}

/** Fundstellen eines Musters, als `datei:zeile — Inhalt` — damit ein Rotlauf sofort hinführt. */
function fundstellen(muster: RegExp): string[] {
  const treffer: string[] = [];
  for (const { datei, zeilen } of quellen()) {
    zeilen.forEach((zeile, i) => {
      if (muster.test(zeile)) {
        treffer.push(`${datei}:${i + 1} — ${zeile.trim()}`);
      }
    });
  }
  return treffer;
}

describe("JOB 3943 · G5 — der Ordner wartet auf Zustand, nie auf die Uhr", () => {
  it("G5a · der Wächter sieht überhaupt Quellen — sonst wäre jede Zusicherung darunter leer", () => {
    const gesehen = quellen().map((q) => q.datei);
    // Kalibrierung: ein Wächter über einer leeren Liste ist immer grün und misst nichts.
    expect(gesehen.length, `keine Quellen in ${ORDNER} gefunden`).toBeGreaterThanOrEqual(3);
    expect(gesehen, "die Bühne wird nicht mitgelesen").toContain("freigabe-buehne.tsx");
  });

  it("G5b · der alte Bezeichner `durchlaufen` steht nirgends mehr", () => {
    expect(
      fundstellen(/\bdurchlaufen\b/),
      "der abgelöste Weg ist zurück — gewartet wird auf eine Bedingung, nicht auf Durchläufe",
    ).toEqual([]);
  });

  it("G5c · keine Zählschleife über eine feste Zahl", () => {
    expect(
      fundstellen(/for\s*\(\s*(?:let|var)\s+\w+\s*=\s*\d+\s*;\s*\w+\s*[<>]=?\s*\d+/),
      "eine feste Anzahl Durchläufe sitzt eine Zeit ab und wertet dabei nichts aus",
    ).toEqual([]);
  });

  it("G5d · genau eine `setTimeout`-Fundstelle, und die steht im Rumpf von `warteBis`", () => {
    const treffer = fundstellen(/setTimeout\s*\(/);
    expect(
      treffer,
      "jede weitere Wartezeit wartet wieder auf die Uhr statt auf einen Zustand",
    ).toHaveLength(1);

    // Und sie steht dort, wo sie hingehört: die nächste Funktionsdeklaration ÜBER ihr ist `warteBis`.
    const [ort] = treffer;
    const [datei, rest] = (ort ?? "").split(":");
    const zeilennr = Number.parseInt(rest ?? "", 10);
    expect(datei, "die erlaubte Wartezeit steht nicht in der Bühne").toBe("freigabe-buehne.tsx");
    const zeilen = readFileSync(`${ORDNER}${datei}`, "utf8").split("\n");
    let umgebung = "<keine Funktion darüber>";
    for (let i = zeilennr - 1; i >= 0; i--) {
      const kopf = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/.exec(zeilen[i] ?? "");
      if (kopf?.[1] !== undefined) {
        umgebung = kopf[1];
        break;
      }
    }
    expect(
      umgebung,
      "die einzige erlaubte Wartezeit ist der Taktgeber der Zustandsabfrage in `warteBis`",
    ).toBe("warteBis");
  });

  it("G5e · `warteBis` bricht mit dem NAMEN der nicht erreichten Bedingung ab, statt still weiterzulaufen", () => {
    const quelle = readFileSync(`${ORDNER}freigabe-buehne.tsx`, "utf8");
    const rumpf = quelle.slice(quelle.indexOf("export async function warteBis"));
    const ende = rumpf.indexOf("\n}\n");
    const warteBis = rumpf.slice(0, ende);
    expect(warteBis, "`warteBis` wirft gar nicht").toContain("throw new Error");
    expect(warteBis, "die Abbruchmeldung nennt die Bedingung nicht beim Namen").toContain(
      "bis.name",
    );
    expect(warteBis, "die Abbruchmeldung nennt den zuletzt gesehenen Zustand nicht").toContain(
      "bis.lage()",
    );
  });
});
