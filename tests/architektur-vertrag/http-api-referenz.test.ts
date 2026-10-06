// ================================================================================================
// R-2076 / NFR-MNT-02 (Aufnahme 20260922 · zentrale-module-aufteilen) — DIE API-REFERENZ IST
// DECKUNGSGLEICH MIT DEM ROUTER.
// ================================================================================================
//
// `docs/architektur/http-api-referenz.md` führt jeden Endpunkt mit Recht, Eingaben, Erfolg und
// Fehlern. Eine Referenz, die eine Route verschweigt oder eine längst entfernte weiterführt, ist
// schlechter als keine. Deshalb zählt dieser Prüfstand die Routen nicht aus einer Liste ab, sondern
// am Router der vollständigen App — derselben Bühne mit allen Schaltern, gegen die die
// Rollenabnahme misst (`tests/beta-rollenabnahme/buehne.ts`), und derselben Aufzählung
// (`tests/beta-rollenabnahme/registrierte-routen.ts`). Verglichen wird über `schluessel`: Methode
// und Pfadform, Parameternamen zählen nicht.
//
// Die automatischen `HEAD`-Spiegel jeder GET-Route sind keine eigenen Türen und stehen nicht in der
// Referenz; dass keiner ohne GET-Zwilling existiert, prüft schon die Rollenabnahme (E7).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { baueBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import {
  AUTOMATISCHE_METHODEN,
  type Aufzaehlung,
  schluessel,
  zaehleRegistrierteRouten,
} from "../beta-rollenabnahme/registrierte-routen";
import { repoPfad } from "../support/repoPfad";

const REFERENZ = readFileSync(repoPfad("docs/architektur/http-api-referenz.md"), "utf8");

/** Eine Endpunktzeile: `| \`GET\` | \`/pfad\` | Recht | Eingaben | Erfolg | Fehler |`. */
const ZEILE = /^\| `([A-Z]+)` \| `([^`]+)` \|(.*)\|\s*$/;

interface Referenzzeile {
  methode: string;
  pfad: string;
  spalten: string[];
}

function referenzzeilen(text: string): Referenzzeile[] {
  const zeilen: Referenzzeile[] = [];
  for (const zeile of text.split("\n")) {
    const m = ZEILE.exec(zeile);
    if (!m) {
      continue;
    }
    // `\|` steht in einer Zelle für einen senkrechten Strich und trennt keine Spalte.
    const spalten = (m[3] ?? "").split(/(?<!\\)\|/).map((s) => s.trim());
    zeilen.push({ methode: m[1] ?? "", pfad: m[2] ?? "", spalten });
  }
  return zeilen;
}

interface Abgleich {
  fehlend: string[];
  verwaist: string[];
  doppelt: string[];
}

function abgleich(zeilen: Referenzzeile[], registriert: string[]): Abgleich {
  const router = new Set(registriert);
  const gezaehlt = new Map<string, number>();
  for (const z of zeilen) {
    const k = schluessel(z.methode, z.pfad);
    gezaehlt.set(k, (gezaehlt.get(k) ?? 0) + 1);
  }
  return {
    fehlend: registriert.filter((k) => !gezaehlt.has(k)),
    verwaist: [...gezaehlt.keys()].filter((k) => !router.has(k)),
    doppelt: [...gezaehlt.entries()].filter(([, n]) => n > 1).map(([k]) => k),
  };
}

let aufzaehlung: Aufzaehlung;
let registriert: string[];

beforeAll(async () => {
  const buehne = await baueBuehne();
  aufzaehlung = zaehleRegistrierteRouten(buehne.app);
  const automatisch: readonly string[] = AUTOMATISCHE_METHODEN;
  const eigene = aufzaehlung.routen.filter((r) => !automatisch.includes(r.methode));
  registriert = [...new Set(eigene.map((r) => schluessel(r.methode, r.pfad)))];
});

afterAll(schliesseBuehnen);

describe("R-2076 · die HTTP-API-Referenz deckt jede registrierte Route", () => {
  it("A1 · Kalibrierung: Router und Referenz sind beide nicht leer", () => {
    expect(aufzaehlung.unklar).toEqual([]);
    expect(registriert.length).toBeGreaterThan(150);
    expect(referenzzeilen(REFERENZ).length).toBeGreaterThan(150);
  });

  it("A2 · jede Route hat genau eine Zeile, keine Zeile ist erfunden", () => {
    const ergebnis = abgleich(referenzzeilen(REFERENZ), registriert);
    expect(ergebnis.fehlend, "registriert, aber nicht in der Referenz").toEqual([]);
    expect(ergebnis.verwaist, "in der Referenz, aber nicht registriert").toEqual([]);
    expect(ergebnis.doppelt, "mehr als eine Zeile").toEqual([]);
  });

  it("A3 · jede Zeile nennt Recht, Eingaben, Erfolg und Fehler", () => {
    const unvollstaendig = referenzzeilen(REFERENZ)
      .filter((z) => z.spalten.length !== 4 || z.spalten.some((s) => s.length === 0))
      .map((z) => `${z.methode} ${z.pfad}: ${z.spalten.length} Spalten`);
    expect(unvollstaendig).toEqual([]);
    // Das Recht ist nie „—": auch eine offene Tür sagt ausdrücklich „keines".
    const ohneRecht = referenzzeilen(REFERENZ)
      .filter((z) => z.spalten[0] === "—")
      .map((z) => `${z.methode} ${z.pfad}`);
    expect(ohneRecht).toEqual([]);
  });

  it("A4 · Gegenproben: eine fehlende, eine erfundene und eine doppelte Zeile werden ROT", () => {
    const zeilen = referenzzeilen(REFERENZ);
    const istLogin = (z: Referenzzeile): boolean =>
      z.methode === "POST" && z.pfad === "/api/auth/login";
    const ohneLogin = zeilen.filter((z) => !istLogin(z));
    expect(abgleich(ohneLogin, registriert).fehlend).toEqual(["POST /api/auth/login"]);
    const erfunden = [...zeilen, { methode: "GET", pfad: "/api/gibt-es-nicht", spalten: [] }];
    expect(abgleich(erfunden, registriert).verwaist).toEqual(["GET /api/gibt-es-nicht"]);
    const gesundheit = zeilen.filter((z) => z.pfad === "/health");
    expect(abgleich([...zeilen, ...gesundheit], registriert).doppelt).toEqual(["GET /health"]);
    // Und die Zellen trennen richtig: ein `\|` in einer Zelle zählt nicht als Spalte.
    const probe = "| `PUT` | `/x` | a | `{ p? \\| q? }` | b | c |";
    expect(referenzzeilen(probe)[0]?.spalten).toEqual(["a", "`{ p? \\| q? }`", "b", "c"]);
  });
});
