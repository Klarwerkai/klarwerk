// ================================================================================================
// JOB 3761 · D1/D2 — DER SCHALTER „DIESE INSTANZ IST DIE DEMO", AN SEINER QUELLE.
// ================================================================================================
//
// Pedis Satz (11.09. 17:20 über Codex, PRIORITAETEN.md/DEMO-ZUGANG-START): „und man muss ihr
// ansehen, dass sie die Demo ist und nicht das Echte". Diese Datei prüft die SERVERHÄLFTE der
// Zusage: dass es den Schalter gibt, dass ein Unangemeldeter ihn erfährt (die Anmeldemaske ist die
// erste Fläche, auf der es zählt) — und vor allem die Gegenrichtung, die hier die eigentliche
// Zusage ist: die ECHTE Instanz trägt das Etikett unter KEINEM Umstand, auch nicht nach einem
// Konfigurationsfehler.
//
//   D1   Der Fachname steht in der Auskunft VOR der Anmeldung — und auch in der vollen.
//   D2   Die Auswertungsrichtung: Vorgabe AUS, nur `1`/`true` schaltet scharf.
//   D2b  Der Vertipper-Fall, ausgeschrieben: „ja", „on", „yes", „JA", leer, ungesetzt → aus.
//   D2c  `demoInstanz` und `demodaten` sind ZWEI Aussagen und hängen nicht aneinander.
//   D2d  Die Antwort trägt weiterhin nur Ja/Nein — kein Variablenname, keine Adresse.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import {
  SCHALTER_REGISTRY,
  schalterAn,
  schalterZustand,
  schalterZustandVorAnmeldung,
  vorgabeAn,
} from "../../services/app/src/feature-flags";

/** Der Fachname über den Draht — bewusst als Literal, nicht aus dem Registry abgeschrieben. */
const NAME = "demoInstanz";
const VARIABLE = "KLARWERK_DEMO_INSTANZ";

function schalterLeeren(): void {
  delete process.env[VARIABLE];
}
beforeEach(schalterLeeren);
afterEach(schalterLeeren);

describe("JOB 3761 D1 · die Instanz kann sagen, dass sie die Vorführinstanz ist", () => {
  it("D1a · der Schalter steht im Registry, mit einem Fachnamen und einer eigenen Variablen", () => {
    // Ein Fachname über den Draht, ein `KLARWERK_…` in der Umgebung (feature-flags.ts:24-26).
    expect(SCHALTER_REGISTRY[NAME]).toBe(VARIABLE);
    // Und er ist NICHT derselbe Schalter wie das Demodaten-Werkzeug: zwei Aussagen, zwei Hebel.
    expect(SCHALTER_REGISTRY.demodaten).not.toBe(SCHALTER_REGISTRY[NAME]);
  });

  it("D1b · die Auskunft VOR der Anmeldung führt ihn — dort ist er am meisten wert", () => {
    process.env[VARIABLE] = "1";
    const vor = schalterZustandVorAnmeldung();
    expect(Object.keys(vor)).toContain(NAME);
    expect(vor[NAME]).toBe(true);
    // Die Teilmenge bleibt eine Teilmenge: die Fähigkeiten dieses Betriebs gehen einen
    // Unangemeldeten weiterhin nichts an.
    expect(Object.keys(vor)).not.toContain("herkunft");
    expect(Object.keys(vor)).not.toContain("expertMatching");
    expect(Object.keys(vor)).not.toContain("demodaten");
  });

  it("D1c · derselbe Wert steht auch in der vollen Auskunft — eine Wahrheit, nicht zwei", () => {
    process.env[VARIABLE] = "1";
    expect(schalterZustand()[NAME]).toBe(true);
    expect(schalterZustand()[NAME]).toBe(schalterZustandVorAnmeldung()[NAME]);
  });

  it("D1d · ohne Sitzung antwortet `GET /api/features` mit dem Schalter", async () => {
    process.env[VARIABLE] = "1";
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/features" });
    expect(res.statusCode).toBe(200);
    const features = (res.json() as { features: Record<string, unknown> }).features;
    expect(features[NAME]).toBe(true);
    await app.close();
  });
});

describe("JOB 3761 D2 · die ECHTE Instanz trägt das Etikett unter keinen Umständen", () => {
  it("D2 · Vorgabe AUS — und das ist die Richtung, auf die es hier ankommt", () => {
    // Der Schaden wäre die stille ANWESENHEIT des Hinweises auf der echten Anwendung. Deshalb ist
    // dieser Schalter eine FÄHIGKEIT (Vorgabe AUS) und keine Pflichtangabe (Vorgabe AN). Wer ihn
    // in `SCHALTER_VORGABE_AN` schiebt, macht diesen Fall rot.
    expect(vorgabeAn(NAME)).toBe(false);
    expect(schalterAn(NAME)).toBe(false);
    expect(schalterZustandVorAnmeldung()[NAME]).toBe(false);
  });

  it("D2b · nur `1` und `true` schalten scharf — jeder andere Wert nicht", () => {
    for (const wert of ["1", "true"]) {
      process.env[VARIABLE] = wert;
      expect(schalterAn(NAME), `„${wert}" sollte einschalten`).toBe(true);
    }
    // Die Vertipper und die Halbherzigen. „nein"/„0"/„false" stehen hier ebenfalls, damit der Fall
    // auch dann rot wird, wenn jemand die Auswertung auf „alles außer 0 ist an" umstellt.
    for (const wert of ["", " ", "0", "false", "ja", "JA", "on", "yes", "wahr", "True", "1 "]) {
      process.env[VARIABLE] = wert;
      expect(schalterAn(NAME), `„${wert}" darf NICHT einschalten`).toBe(false);
    }
    schalterLeeren();
    expect(schalterAn(NAME), "ungesetzt darf nicht einschalten").toBe(false);
  });

  it("D2c · das Demodaten-Werkzeug schaltet das Etikett NICHT ein (und umgekehrt)", async () => {
    // Die naheliegende Halbheit wäre gewesen, den vorhandenen `demodaten`-Schalter mitzubenutzen.
    // Dann trüge jede echte Instanz, die einmal Demodaten laden durfte, ein Demo-Etikett — und eine
    // Vorführinstanz ohne geladene Demodaten keines.
    const alt = process.env.KLARWERK_DEMO_SEED;
    process.env.KLARWERK_DEMO_SEED = "1";
    expect(schalterAn("demodaten")).toBe(true);
    expect(schalterAn(NAME)).toBe(false);

    delete process.env.KLARWERK_DEMO_SEED;
    process.env[VARIABLE] = "1";
    expect(schalterAn(NAME)).toBe(true);
    expect(schalterAn("demodaten")).toBe(false);
    if (alt === undefined) {
      delete process.env.KLARWERK_DEMO_SEED;
    } else {
      process.env.KLARWERK_DEMO_SEED = alt;
    }
  });

  it("D2d · die Antwort bleibt reines Ja/Nein — kein Variablenname, keine Adresse", async () => {
    process.env[VARIABLE] = "1";
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/features" });
    expect(res.statusCode).toBe(200);
    const features = (res.json() as { features: Record<string, unknown> }).features;
    expect(typeof features[NAME]).toBe("boolean");
    expect(res.body).not.toContain("KLARWERK");
    expect(res.body).not.toContain(VARIABLE);
    // Auch nicht die Vorführadresse: der Gast soll die Tatsache sehen, nicht die Umgebung.
    expect(res.body).not.toContain("klarwerk.io");
    await app.close();
  });
});
