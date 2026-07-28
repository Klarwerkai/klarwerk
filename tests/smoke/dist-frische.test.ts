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

  it("SAMMLER: jeder Eintrag unter apps/web ist gedeckt oder begruendet ausgenommen", () => {
    // Faende readdir nichts, liefe die Pruefung still leer.
    expect(eintraege.length).toBeGreaterThan(5);

    const gedeckt = new Set(QUELL_PFADE.map((p) => p.replace(/^apps\/web\//, "")));
    const ungeklaert = eintraege.filter((e) => !gedeckt.has(e) && !(e in NICHT_EINGANG));

    // Die Meldung nennt genau, was zu tun ist: aufnehmen oder mit Grund ausnehmen.
    expect(
      ungeklaert,
      "neue(r) Eintrag unter apps/web: entweder in QUELL_PFADE aufnehmen oder in NICHT_EINGANG mit Grund ausnehmen",
    ).toEqual([]);
  });

  it("keine Ausnahme ohne Grund — und keine verwaiste Ausnahme", () => {
    for (const [name, grund] of Object.entries(NICHT_EINGANG)) {
      expect(String(grund).length, `Ausnahme ${name} ohne Begruendung`).toBeGreaterThan(20);
    }
    // Ein Eintrag, den es gar nicht mehr gibt, hat hier nichts verloren (sonst waechst die Liste
    // still weiter und deckt irgendwann etwas ab, das wieder auftaucht).
    const verwaist = Object.keys(NICHT_EINGANG).filter((n) => !eintraege.includes(n));
    expect(verwaist).toEqual([]);
  });

  it("kein QUELL_PFAD zeigt ins Leere (Tippfehler waeren still — statSync ueberspringt sie)", () => {
    // `neuesteIn` ueberspringt fehlende Pfade absichtlich. Genau deshalb faellt ein Tippfehler dort
    // NICHT auf; er faellt hier auf.
    const fehlend = QUELL_PFADE.filter((p) => {
      const name = p.replace(/^apps\/web\//, "");
      return !eintraege.includes(name);
    });
    expect(fehlend, `nicht vorhanden unter ${join("apps", "web")}`).toEqual([]);
  });
});
