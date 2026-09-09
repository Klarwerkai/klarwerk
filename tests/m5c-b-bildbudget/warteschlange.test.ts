// ================================================================================================
// JOB 3400 R2 · DIE GRENZE MUSS DIE LAUFENDE NATIVE ARBEIT ERFASSEN, NICHT NUR DEN WARTENDEN
// ================================================================================================
//
// DER PRÜFBEFUND, gegen den diese Datei steht (Steuerung 09.09. 15:4x), wörtlich:
// „`mapImage` nutzt `einreihen(() => mitZeitgrenze(ableiten(quelle)))`. Nach einem
// Zeitgrenzen-Abbruch wird der Warteschlangenplatz frei, obwohl `ableiten` WEITERLÄUFT — die
// Zusage ‚gleichzeitig höchstens 2' erfasst dann die tatsächlichen nativen Arbeiten nicht.
// Zusätzlich ist die Warteschlange pro Anfrage angelegt, es gibt keinen serverweiten Deckel."
//
// WARUM DIE ZEIT GEMESSEN WIRD UND NICHT EIN ZÄHLER AUSGELESEN: Ein Zähler „laufende Arbeiten"
// müsste dafür exportiert werden, und er hätte ausserhalb der Tests keinen Aufrufer — der
// Aufrufer-Wächter (`tests/capture/aufrufer-waechter.test.ts`) verbietet genau das, und zu Recht.
// Die Zeit misst ausserdem die EIGENTLICHE Zusage: sechs Bilder auf zwei Plätzen sind drei Runden.
// Gäbe die Zeitgrenze den Platz frei, liefen alle sechs sofort los und der Aufruf wäre nach einer
// Millisekunde zurück — der Unterschied ist keine Nuance, er ist zwei Grössenordnungen.
//
// KEIN SCHALTER, EIN VORBELEGTER PARAMETER: `bildVerkleinerung({ zeitgrenzeMs })` läuft durch
// dieselben Zeilen wie der Betrieb. Eine eingesetzte Grenze von 1 ms macht den Zeitgrenzenfall in
// Millisekunden prüfbar; mit der Vorgabe von 8 s wäre er nur simulierbar.
import { beforeEach, describe, expect, it } from "vitest";
import {
  BILD_GLEICHZEITIG,
  bildVerkleinerung,
} from "../../services/app/src/import/bildverkleinerung";
import { grossesPng } from "./bilder";

/** Ein Bild, dessen Ableitung messbar Zeit kostet — über der Zielkante und mit echtem Rauschen. */
function grossesBild(saat: number): string {
  return `data:image/png;base64,${grossesPng(1400, 1050, saat).toString("base64")}`;
}

/** Klein genug, um schnell zu sein, gross genug, um wirklich abgeleitet zu werden (> 64 KiB). */
const KLEINES_BILD = `data:image/png;base64,${grossesPng(220, 220, 7).toString("base64")}`;

async function dauer(arbeit: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await arbeit();
  return Date.now() - start;
}

/**
 * Die Warteschlange ist prozessweit — Reste einer vorigen Prüfung würden die nächste verfälschen.
 * `BILD_GLEICHZEITIG` gleichzeitige, NORMALE Ableitungen können erst starten, wenn jeder Platz
 * frei ist, und geben ihn beim Ende wieder her: wer das abwartet, startet auf leerer Schlange.
 */
async function schlangeLeeren(): Promise<void> {
  const v = bildVerkleinerung();
  await Promise.all(Array.from({ length: BILD_GLEICHZEITIG }, () => v.mapImage(KLEINES_BILD)));
}

describe("JOB 3400 R2 · Laufzeit und Parallelität, an der nativen Arbeit gemessen", () => {
  beforeEach(schlangeLeeren);

  it("Q1 · die Zeitgrenze beendet das Warten — den Platz gibt erst die fertige Arbeit zurück", async () => {
    // Referenzmass: was EINE Ableitung wirklich kostet, ohne Zeitgrenze.
    const referenz = bildVerkleinerung();
    const einzeln = await dauer(() => referenz.mapImage(grossesBild(1)));
    expect(referenz.bericht.verkleinert, "Das Referenzbild wurde gar nicht abgeleitet").toBe(1);

    // Kein Leeren nötig: die Referenzarbeit ist settled, und der Platz hängt genau daran.
    // Sechs Bilder, alle gleichzeitig eingereicht, jedes mit einer Zeitgrenze von 1 ms.
    const v = bildVerkleinerung({ zeitgrenzeMs: 1 });
    const quellen = [11, 12, 13, 14, 15, 16].map(grossesBild);
    const gebraucht = await dauer(() => Promise.all(quellen.map((q) => v.mapImage(q))));

    // Kein stiller Verlust: jedes abgelaufene Bild behält seine Originalquelle und wird benannt.
    expect(v.bericht.uebersprungen).toEqual(Array.from({ length: 6 }, () => "zeitgrenze"));
    expect(v.bericht.verkleinert).toBe(0);
    // Die Parallelitätsspitze zählt jetzt NATIVE Arbeiten, nicht Wartende.
    expect(
      v.bericht.gleichzeitigMax,
      `Es waren ${v.bericht.gleichzeitigMax} native Arbeiten gleichzeitig unterwegs`,
    ).toBeLessThanOrEqual(BILD_GLEICHZEITIG);
    // DER NACHWEIS: sechs Bilder auf zwei Plätzen brauchen mehr als eine Runde. Der Fehler aus
    // Runde 1 hätte alle sechs sofort gestartet und wäre nach ~1 ms zurück gewesen.
    console.log(`Q1: eine Ableitung=${einzeln} ms, sechs mit 1-ms-Zeitgrenze=${gebraucht} ms`);
    expect(
      gebraucht,
      `Der Platz wurde nach der Zeitgrenze freigegeben (einzeln=${einzeln} ms, sechs=${gebraucht} ms)`,
    ).toBeGreaterThan(einzeln);
  });

  it("Q2 · der Deckel gilt für den ganzen Prozess, nicht je Anfrage", async () => {
    // Anfrage A reicht EIN grosses Bild mit 1-ms-Grenze ein: sie ist sofort zurück, ihre native
    // Arbeit läuft weiter und hält ihren Platz.
    const a = bildVerkleinerung({ zeitgrenzeMs: 1 });
    await a.mapImage(grossesBild(21));
    expect(a.bericht.uebersprungen).toEqual(["zeitgrenze"]);

    // Anfrage B ist eine EIGENE Anfrage mit eigenem Bericht. Wäre die Warteschlange pro Anfrage
    // angelegt, sähe B eine leere Schlange und meldete 1. Weil sie prozessweit ist, sieht B die
    // noch laufende Arbeit von A und meldet 2 — das ist der Deckel, den es zu belegen gilt.
    const b = bildVerkleinerung();
    await b.mapImage(grossesBild(22));
    expect(
      b.bericht.gleichzeitigMax,
      "Die zweite Anfrage sah die laufende Arbeit der ersten nicht — die Schlange ist nicht geteilt",
    ).toBe(BILD_GLEICHZEITIG);
    expect(b.bericht.verkleinert, "Die zweite Anfrage hat ihr Bild nicht abgeleitet").toBe(1);
  });

  it("Q3 · begrenzte Laufzeit: der Import wartet nicht länger als seine Grenze", async () => {
    const referenz = bildVerkleinerung();
    const einzeln = await dauer(() => referenz.mapImage(grossesBild(31)));

    const v = bildVerkleinerung({ zeitgrenzeMs: 1 });
    const quelle = grossesBild(32);
    const start = Date.now();
    const raus = await v.mapImage(quelle);
    const gewartet = Date.now() - start;
    console.log(`Q3: ohne Grenze=${einzeln} ms, mit 1-ms-Grenze gewartet=${gewartet} ms`);
    expect(
      gewartet,
      `Die Zeitgrenze hat nicht gegriffen (ohne=${einzeln} ms, mit=${gewartet} ms)`,
    ).toBeLessThan(einzeln);
    // Und das Bild ist trotzdem da — die Grenze wirft nichts weg, sie hört nur auf zu warten.
    expect(raus, "Das abgelaufene Bild wurde verändert statt bei seiner Quelle belassen").toBe(
      quelle,
    );
    expect(v.bericht.uebersprungen).toEqual(["zeitgrenze"]);
  });
});
