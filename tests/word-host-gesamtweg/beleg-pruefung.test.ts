// ================================================================================================
// WORD-HOST-GESAMTWEG · ERGÄNZUNG 4 — DER BELEG DER REALABNAHME IST EINDEUTIG UND GEHEIMNISFREI.
// ================================================================================================
//
// Gemessen wird `tools/word-host-beleg.ts`: der Prüfer des Belegs, den ein Mensch nach der
// Rückgabe in Word Web unter Chrome ablegt (Entscheidung 756b7d22 — Testmandant
// klarwerktest4711, Rolle admin). Diese Datei ersetzt die Bedienung im echten Host NICHT; sie hält
// fest, dass ein unvollständiger, fremder oder geheimnistragender Beleg nicht als vollständig
// durchgeht. Der Rückweg selbst (dieselbe Objektkennung, neue Fassung, Direktfreigabe nur admin,
// bisherige Fassung in /versions) ist an der Route belegt: `tests/word-rueckweg/`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BELEG_PFLICHTFELDER,
  NICHT_ABGEDECKT,
  pruefeWordHostBeleg,
} from "../../tools/word-host-beleg";
import { repoPfad } from "../support/repoPfad";

const LIEFERCOMMIT = "b696203f44d4e49d305ea74f0ff689bd82b8d00f";
const KURZ = LIEFERCOMMIT.slice(0, 12);
const MANDANT_MY = "https://klarwerktest4711-my.sharepoint.com";

function gueltigerBeleg(): Record<string, unknown> {
  return {
    host: { anwendung: "Word Web", browser: "Chrome", browserVersion: "141.0.7390.66" },
    testzeit: "2026-10-06T10:15:00+02:00",
    dokumentUrl: `${MANDANT_MY}/personal/t/_layouts/15/Doc.aspx?sourcedoc=%7B1234%7D&file=A.docx`,
    bereitstellung: {
      healthVersion: "1.0.0-beta.1.686",
      healthCommit: KURZ,
      liefercommit: LIEFERCOMMIT,
    },
    konto: { rolle: "admin" },
    rueckgabe: {
      objektId: "ko-anleitung-1",
      ausgangsfassung: 3,
      neueFassung: 4,
      objektIdNachRueckgabe: "ko-anleitung-1",
      statusNachRueckgabe: "validiert",
      bisherigeFassungAbrufbar: true,
      neueFassungWiederGeoeffnet: true,
      neueObjekteDurchRueckgabe: 0,
    },
    nachweise: ["01-ziel-version-3.png", "02-freigegeben-version-4.png"],
  };
}

/** Ein Beleg mit genau EINER Abweichung — Pfad mit Punkten, `undefined` entfernt das Feld. */
function mit(pfad: string, wert: unknown): Record<string, unknown> {
  const beleg = gueltigerBeleg();
  const teile = pfad.split(".");
  let stand = beleg;
  for (const teil of teile.slice(0, -1)) {
    stand = stand[teil] as Record<string, unknown>;
  }
  const letzter = teile[teile.length - 1] as string;
  if (wert === undefined) {
    delete stand[letzter];
  } else {
    stand[letzter] = wert;
  }
  return beleg;
}

function befundFelder(beleg: unknown): string[] {
  return pruefeWordHostBeleg(beleg).befunde.map((b) => b.feld);
}

/** Die eine Abweichung ergibt genau einen Befund — an genau dem erwarteten Feld. */
function nurBefundAn(feld: string, pfad: string, wert: unknown): void {
  expect(befundFelder(mit(pfad, wert)), `${pfad} = ${String(wert)}`).toEqual([feld]);
}

describe("Ergänzung 4 · der vollständige Beleg", () => {
  it("B1 · Web/Chrome/klarwerktest4711/admin, gleiche Objektkennung, neue Fassung", () => {
    const urteil = pruefeWordHostBeleg(gueltigerBeleg());
    expect(urteil.befunde).toEqual([]);
    expect(urteil.vollstaendig).toBe(true);
    expect(urteil.giltFuer).toContain("Word Web unter Chrome");
    expect(urteil.giltFuer).toContain("klarwerktest4711");
  });

  it("B2 · auch der bestandene Beleg nennt, was er NICHT abdeckt", () => {
    const urteil = pruefeWordHostBeleg(gueltigerBeleg());
    expect(urteil.nichtAbgedeckt).toEqual(NICHT_ABGEDECKT);
    expect(urteil.nichtAbgedeckt.join(" ")).toMatch(/Mac/);
    expect(urteil.nichtAbgedeckt.join(" ")).toMatch(/ohne Admin-Recht/);
  });

  it("B3 · jedes Pflichtfeld fehlt einzeln — und wird einzeln benannt", () => {
    for (const pfad of BELEG_PFLICHTFELDER) {
      const urteil = pruefeWordHostBeleg(mit(pfad, undefined));
      expect(urteil.vollstaendig, pfad).toBe(false);
      expect(
        urteil.befunde.map((b) => b.feld),
        pfad,
      ).toContain(pfad);
    }
  });

  it("B4 · kein Objekt ist kein Beleg", () => {
    expect(pruefeWordHostBeleg(null).vollstaendig).toBe(false);
    expect(pruefeWordHostBeleg([]).vollstaendig).toBe(false);
  });
});

describe("Ergänzung 4 · Host und Kontoregel gelten ausschließlich", () => {
  it("H1 · Word für Mac ist ein getrennter Nachweis, kein Ersatz", () => {
    const urteil = pruefeWordHostBeleg(mit("host.anwendung", "Word Mac"));
    expect(urteil.vollstaendig).toBe(false);
    expect(urteil.befunde.map((b) => b.feld)).toEqual(["host.anwendung"]);
    expect(urteil.befunde[0]?.text).toMatch(/Mac ist ein getrennter Nachweis/);
  });

  it("H2 · ein anderer Browser oder eine unlesbare Version zählt nicht", () => {
    nurBefundAn("host.browser", "host.browser", "Edge");
    nurBefundAn("host.browserVersion", "host.browserVersion", "neueste");
  });

  it("H3 · nur die Rolle admin — Controller und Experte gehen den Vorschlagsweg", () => {
    for (const rolle of ["controller", "experte", "gast"]) {
      nurBefundAn("konto.rolle", "konto.rolle", rolle);
    }
  });

  it("H4 · das Dokument stammt aus SharePoint/OneDrive des Testmandanten, nichts sonst", () => {
    const fremd = [
      "https://anderermandant-my.sharepoint.com/personal/x/Doc.aspx",
      "https://klarwerktest4711.sharepoint.com.example.org/x",
      "http://klarwerktest4711-my.sharepoint.com/x",
      "https://word.cloud.microsoft/x",
      "kein-link",
    ];
    for (const adresse of fremd) {
      nurBefundAn("dokumentUrl", "dokumentUrl", adresse);
    }
    const team = "https://klarwerktest4711.sharepoint.com/sites/t/x.docx";
    expect(befundFelder(mit("dokumentUrl", team))).toEqual([]);
  });

  it("H5 · die Testzeit trägt eine Zeitzone", () => {
    nurBefundAn("testzeit", "testzeit", "2026-10-06T10:15:00");
    nurBefundAn("testzeit", "testzeit", "06.10.2026 10:15");
    expect(befundFelder(mit("testzeit", "2026-10-06T08:15:00Z"))).toEqual([]);
  });
});

describe("Ergänzung 4 · dieselbe Bereitstellung", () => {
  it("D1 · /health.commit „unbekannt“ lässt die Herkunft OFFEN", () => {
    const urteil = pruefeWordHostBeleg(mit("bereitstellung.healthCommit", "unbekannt"));
    expect(urteil.vollstaendig).toBe(false);
    expect(urteil.befunde.map((b) => [b.feld, b.lage])).toEqual([
      ["bereitstellung.healthCommit", "offen"],
    ]);
  });

  it("D2 · ein anderer Commit als der Liefercommit ist eine andere Fassung", () => {
    const urteil = pruefeWordHostBeleg(mit("bereitstellung.healthCommit", "0123456789ab"));
    expect(urteil.befunde.map((b) => [b.feld, b.lage])).toEqual([
      ["bereitstellung.healthCommit", "ungueltig"],
    ]);
  });

  it("D3 · der Liefercommit ist vollständig (40 Zeichen), eine Kurzform reicht dort nicht", () => {
    nurBefundAn("bereitstellung.liefercommit", "bereitstellung.liefercommit", KURZ);
  });
});

describe("Ergänzung 4 · dasselbe Wissensobjekt, neue Fassung, bisherige bleibt", () => {
  it("R1 · eine andere Objektkennung nach der Rückgabe ist eine Dublette", () => {
    const pfad = "rueckgabe.objektIdNachRueckgabe";
    nurBefundAn(pfad, pfad, "ko-anleitung-2");
  });

  it("R2 · ein neu angelegtes Objekt ist eine unverbundene Dublette", () => {
    const pfad = "rueckgabe.neueObjekteDurchRueckgabe";
    nurBefundAn(pfad, pfad, 1);
  });

  it("R3 · die neue Fassung ist neuer als die Ausgangsfassung", () => {
    nurBefundAn("rueckgabe.neueFassung", "rueckgabe.neueFassung", 3);
    nurBefundAn("rueckgabe.ausgangsfassung", "rueckgabe.ausgangsfassung", 0);
  });

  it("R4 · Direktfreigabe heißt Status „validiert“ — ein offener Stand ist es nicht", () => {
    const pfad = "rueckgabe.statusNachRueckgabe";
    nurBefundAn(pfad, pfad, "offen");
  });

  it("R5 · bisherige Fassung abrufbar und neue Fassung wieder geöffnet müssen JA sein", () => {
    const abrufbar = "rueckgabe.bisherigeFassungAbrufbar";
    const geoeffnet = "rueckgabe.neueFassungWiederGeoeffnet";
    nurBefundAn(abrufbar, abrufbar, false);
    nurBefundAn(geoeffnet, geoeffnet, false);
  });
});

describe("Ergänzung 4 · keine Geheimnisse im Beleg", () => {
  it("G1 · Anmeldedaten unter eigenem Schlüssel werden abgewiesen", () => {
    nurBefundAn("konto.passwort", "konto.passwort", "x");
    nurBefundAn("konto.sessionCookie", "konto.sessionCookie", "x");
    nurBefundAn("bereitstellung.apiKey", "bereitstellung.apiKey", "x");
  });

  it("G2 · Token-Werte werden auch unter harmlosen Schlüsseln erkannt", () => {
    const jwtForm = ["eyJhbGciOiJub25lIn0", "eyJzdWIiOiJwcnVlZnVuZyJ9", "x"].join(".");
    nurBefundAn("nachweise[1]", "nachweise", ["a.png", jwtForm]);
    nurBefundAn("konto.notiz", "konto.notiz", "Authorization: Bearer abc.def");
  });

  it("G3 · Freigabe- und Anmeldeschlüssel in der Dokumentadresse werden abgewiesen", () => {
    for (const parameter of ["e=AbC123", "tempauth=x", "access_token=x"]) {
      nurBefundAn("dokumentUrl", "dokumentUrl", `${MANDANT_MY}/:w:/g/personal/x/D?${parameter}`);
    }
  });

  it("G4 · Nachweise sind Dateinamen, keine Adressen", () => {
    nurBefundAn("nachweise[0]", "nachweise", ["https://example.org/bild.png"]);
    nurBefundAn("nachweise", "nachweise", []);
  });
});

describe("Anleitung und Prüfer sagen dasselbe", () => {
  const anleitung = readFileSync(repoPfad("docs/operations/word-host-gesamtweg.md"), "utf8");

  it("A1 · jedes Pflichtfeld des Prüfers steht in der Anleitung", () => {
    for (const pfad of BELEG_PFLICHTFELDER) {
      expect(anleitung, pfad).toContain(`\`${pfad}\``);
    }
  });

  it("A2 · das Muster der Anleitung hat die Form des Prüfers — offen sind nur Platzhalter", () => {
    const block = /```json\n([\s\S]*?)\n```/.exec(anleitung)?.[1];
    expect(block).toBeDefined();
    const muster = JSON.parse(block ?? "null") as unknown;
    expect(befundFelder(muster).sort()).toEqual([
      "bereitstellung.healthCommit",
      "bereitstellung.liefercommit",
    ]);
  });

  it("A3 · die Anleitung nennt die Grenzen: Word Mac getrennt, Vorschlagsweg nicht erfüllt", () => {
    expect(anleitung).toMatch(/Nicht erfüllt durch diese Abnahme:\*\* Word für Mac/);
    expect(anleitung).toMatch(/Vorschlagsweg ohne Admin-Recht/);
  });
});
