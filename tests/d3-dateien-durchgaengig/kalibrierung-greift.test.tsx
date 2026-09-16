// @vitest-environment jsdom
// ================================================================================================
// JOB 4203 · D3 · RUNDE 4 / T10 — DIE KALIBRIERUNG KALIBRIERT SICH SELBST.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT, ist der teuerste dieses Auftrags, weil kein grüner Lauf
// ihn zeigen konnte: der Abschnitt „36-pruefliste" der Markdown-Kette prüfte die Folgeüberschrift
// gegen `imEntwurf` — einen Flächentext von VOR zwei Seitenwechseln. Der Fall war grün und sagte
// über den Wissenseintrag NICHTS. Der Prüfer hat es so nachgewiesen: er entfernte die Überschrift
// auf der Zielseite aus dem DOM, und der Fall blieb grün.
//
// `ablesungKalibrieren` (`d3-buehne.ts`) ist die Antwort darauf: sie blendet den behaupteten Inhalt
// auf der ZIELSEITE aus und verlangt, dass die Ablesung das merkt. Nur — wer prüft die Prüferin?
// Eine Kalibrierung, die selbst nicht anschlägt, ist genau die Sorte Scheinfunktion, gegen die sie
// gebaut wurde. Also bekommt sie hier ihre eigene Gegenprobe:
//
//   T10a  eine Ablesung, die WIRKLICH die Seite liest      → die Kalibrierung läuft durch
//   T10b  eine Ablesung, die einen ALTEN Wert festhält     → die Kalibrierung WIRFT (der Fehler
//         (genau der Fehler aus Runde 3)                     aus Runde 3, als Testaussage)
//   T10c  nach einem erkannten EINGEFRORENEN Wert steht die Seite wieder unverstellt da
//   T10d  fehlt die Marke schon vorher, wird das gesagt statt geraten
//   T10e  auch nach einem WERFENDEN Ableser steht die Seite wieder da — und sein Fehler
//         kommt unverfälscht heraus                         (RUNDE 5, Prüflücke des Prüfers)
//   T10f  … und es bleibt auch kein Merkposten liegen: die nächste Kalibrierung läuft sauber
//
// WAS DIESE DATEI NICHT ABDECKT, und die Funktion sagt es an ihrer Signatur ebenso: scheitert die
// Wiederherstellung SELBST (`TEXT_ZURUECK` gibt false), bleibt die Seite verstellt. Die Funktion
// meldet dann genau das; abgefangen wird es nicht.
//
// GEMESSEN WIRD DER ECHTE ABLESER: `TEXT_AUSBLENDEN` und `TEXT_ZURUECK` laufen hier gegen ein
// jsdom-`document`, nicht gegen einen Nachbau. Die Seite ist nur insofern ein Stellvertreter, als
// `evaluate` die Funktion unmittelbar aufruft statt sie an einen Browser zu schicken.
//
// WARUM `.tsx` UND NICHT `.ts`: der Node-reine Wurzel-Typcheck kennt keine DOM-Typen
// (`tsconfig.json`, `lib: ["ES2022"]`); Tests mit jsdom laufen über `tsconfig.tests-tsx.json`, und
// die Grenze dorthin verläuft an der Endung — dieselbe Regel wie bei
// `abweisung-wird-angesagt-mounted.test.tsx`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type SeiteMitDialog, ablesungKalibrieren } from "./d3-buehne";

/** Der Satz, um den es geht — eine Überschrift mit Strich, wie in der Referenzdatei. */
const MARKE = "## Abschnitt Drei | Grenzfaelle";

/**
 * Die Stellvertreterseite: sie kann GENAU das, was `ablesungKalibrieren` benutzt — `evaluate`. Die
 * übergebene Funktion wird unmittelbar ausgeführt und wirkt damit auf das jsdom-`document` dieses
 * Laufs. Alles andere fehlt bewusst: wer der Kalibrierung einen weiteren Seitenzugriff beibringt,
 * soll hier auf eine fehlende Fähigkeit stossen statt auf ein stillschweigendes Nichts.
 */
const seite = {
  evaluate: <T,>(f: (a: unknown) => unknown, a?: unknown): Promise<T> => Promise.resolve(f(a) as T),
} as unknown as SeiteMitDialog;

/** Der Flächentext, FRISCH aus dem DOM — so, wie `flaeche()` ihn im Bedienweg holt. */
function frischLesen(): Promise<string> {
  return Promise.resolve((document.body.textContent ?? "").replace(/\s+/g, " ").trim());
}

beforeEach(() => {
  document.body.innerHTML = `<div><p>Davor steht Inhalt.<br>${MARKE}<br>Und danach ein Absatz.</p></div>`;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("JOB 4203 · T10 — die Kalibrierung der Ablesung", () => {
  it("T10a · eine Ablesung, die wirklich die Seite liest, kommt durch", async () => {
    await expect(ablesungKalibrieren(seite, MARKE, frischLesen)).resolves.toBeUndefined();
    // Und die Seite steht danach unverändert da — die Kalibrierung hinterlässt nichts.
    expect(await frischLesen()).toContain(MARKE);
  });

  it("T10b · eine Ablesung, die einen ALTEN Wert festhält, wird ERTAPPT", async () => {
    // Genau der Fehler aus Runde 3: der Wert wurde einmal gelesen und danach nie wieder befragt.
    const eingefroren = await frischLesen();
    const alterWert = (): Promise<string> => Promise.resolve(eingefroren);

    await expect(ablesungKalibrieren(seite, MARKE, alterWert)).rejects.toThrow(
      /Kalibrierung GESCHEITERT/,
    );
    // Die Meldung nennt auch, WAS das bedeutet — sonst stünde da nur ein Fehlschlag ohne Diagnose.
    await expect(ablesungKalibrieren(seite, MARKE, alterWert)).rejects.toThrow(
      /liest nicht diese Seite/,
    );
  });

  it("T10c · auch nach einem Fehlschlag ist die Seite wiederhergestellt", async () => {
    const eingefroren = await frischLesen();
    await expect(
      ablesungKalibrieren(seite, MARKE, () => Promise.resolve(eingefroren)),
    ).rejects.toThrow();
    // DIE ZWEITE HÄLFTE, und sie zählt genauso: eine Kalibrierung, die bei einem Fehlschlag die
    // Seite verstellt zurücklässt, macht jede folgende Zeile des Falls zu einer Aussage über einen
    // Zustand, den es so nie gab.
    expect(await frischLesen(), "die Seite blieb nach dem Fehlschlag verstellt").toBe(eingefroren);
  });

  it("T10d · fehlt die Marke schon vorher, sagt die Kalibrierung genau das — und rät nicht", async () => {
    await expect(ablesungKalibrieren(seite, "STEHT-HIER-GAR-NICHT", frischLesen)).rejects.toThrow(
      /steht schon vor dem Ausblenden nicht auf der Seite/,
    );
  });

  // ==============================================================================================
  // RUNDE 5 — DIE LÜCKE, DIE T10c OFFEN GELASSEN HAT.
  // ==============================================================================================
  // T10c misst einen Ableser, der einen EINGEFRORENEN WERT ZURÜCKGIBT. Der Prüfer hat in Runde 4
  // nachgewiesen, dass damit nur die halbe Fehlerart abgedeckt ist: ein Ableser, der WIRFT, führt
  // an der Wiederherstellung vorbei — sie stand hinter dem `await`, ohne `try`. Die Seite bleibt
  // dann mit einem leeren Textknoten zurück, und jede folgende Zeile des Falls misst einen Zustand,
  // den es so nie gab. Das ist dieselbe Fehlerklasse, gegen die dieser ganze Auftrag steht, nur in
  // der Messvorrichtung selbst.
  //
  // Ein werfender Ableser ist im Bedienweg nicht ausgedacht: `flaeche(seite)` ruft `page.evaluate`,
  // und das wirft, sobald die Seite währenddessen navigiert, abstürzt oder der Kontext wegfällt.

  it("T10e · wirft die ZWEITE Ablesung, steht die Seite danach trotzdem wieder da", async () => {
    const ausgangszustand = document.body.innerHTML;
    let aufruf = 0;
    const brichtBeimZweitenMal = (): Promise<string> => {
      aufruf += 1;
      // Der erste Aufruf liest echt (sonst käme die Kalibrierung gar nicht bis zum Ausblenden),
      // der zweite — der auf der VERSTELLTEN Seite — bricht ab.
      return aufruf >= 2 ? Promise.reject(new Error("BEN_ABLESER_KAPUTT")) : frischLesen();
    };

    // Der Fehler des Ablesers kommt unverfälscht heraus und wird nicht durch einen Folgefehler
    // der Kalibrierung ersetzt — sonst stünde im Protokoll die Diagnose der Vorrichtung statt der
    // Ursache.
    await expect(ablesungKalibrieren(seite, MARKE, brichtBeimZweitenMal)).rejects.toThrow(
      /BEN_ABLESER_KAPUTT/,
    );

    // UND DIE EIGENTLICHE ZUSICHERUNG: die Seite ist Zeichen für Zeichen die alte.
    expect(
      document.body.innerHTML,
      "nach einem werfenden Ableser blieb die Seite mit einem ausgeblendeten Textknoten zurück",
    ).toBe(ausgangszustand);
  });

  it("T10f · nach einem werfenden Ableser ist die Vorrichtung wieder benutzbar", async () => {
    let aufruf = 0;
    // Wieder beim ZWEITEN Mal — nur dann ist die Seite überhaupt verstellt und ein Merkposten
    // gesetzt. Ein Ableser, der schon beim ersten Aufruf wirft, käme gar nicht bis zum Ausblenden
    // und bewiese hier nichts.
    await expect(
      ablesungKalibrieren(seite, MARKE, () => {
        aufruf += 1;
        return aufruf >= 2 ? Promise.reject(new Error("BEN_ABLESER_KAPUTT")) : frischLesen();
      }),
    ).rejects.toThrow(/BEN_ABLESER_KAPUTT/);

    // DIE ZWEITE HÄLFTE DER WIEDERHERSTELLUNG, und ohne sie wäre die erste wertlos: bleibt der
    // Merkposten `window.__d3Kalibrierung` liegen, stellt die NÄCHSTE Kalibrierung den falschen
    // Knoten zurück. Dass eine zweite Kalibrierung auf derselben Seite sauber durchläuft, ist der
    // Nachweis, dass nichts liegen geblieben ist.
    await expect(ablesungKalibrieren(seite, MARKE, frischLesen)).resolves.toBeUndefined();
    expect(await frischLesen()).toContain(MARKE);
  });
});
