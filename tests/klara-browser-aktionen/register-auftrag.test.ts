// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — REGISTER, AUFTRAG UND BESTÄTIGUNG OHNE
// BROWSER.
// ================================================================================================
//
// Was hier geprüft wird, ist der VERTRAG des Browseradapters (`services/app/src/klara-browser-aktion.ts`):
// die getrennten Handlungsarten im Capability-Register, die Abweisung überversprechender
// Seitenprofile, die Anlage eines Auftrags nur aus der Eingabe der Person, die gebundene
// Außenaktionsbestätigung und die konkrete manuelle Übergabe. Die Wirkung auf einer echten Seite
// misst `browser-aktion-chromium.test.ts` in Chromium. Die Seite wird hier durch einen kleinen
// Doppelgänger ersetzt, der nur zählt, was Klara anstößt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BROWSER_HANDLUNGSVERTRAG,
  type BrowserAuftrag,
  BrowserAusfuehrung,
  BrowserFaehigkeitsregister,
  type BrowserSeitenadapter,
  type BrowserSeitenprofil,
  BrowserVertragFehler,
  type SeitenLage,
  neuerBrowserAuftrag,
} from "../../services/app/src/klara-browser-aktion";
import { ANGREIFER, INJEKTION, ORIGIN, PFAD, TESTSEITE, eingabe } from "./testseite";

const REGISTER = new BrowserFaehigkeitsregister([TESTSEITE]);

function auftrag(teil: Parameters<typeof eingabe>[0] = {}): BrowserAuftrag {
  const anlage = neuerBrowserAuftrag(REGISTER, eingabe(teil));
  if (!anlage.ok) {
    throw new Error(`Auftrag abgewiesen: ${JSON.stringify(anlage)}`);
  }
  return anlage.auftrag;
}

/** Eine Seite als Doppelgänger: ein Formular, Werte im Speicher, jeder Klick gezählt. */
function doppelgaenger() {
  const werte = new Map<string, string>();
  const klicks: string[] = [];
  const adapter: BrowserSeitenadapter = {
    fassung: "doppelgaenger@1",
    lage: async (tabId, formular): Promise<SeitenLage> => ({
      tabId,
      origin: ORIGIN,
      pfad: PFAD,
      hindernisse: [],
      formularTreffer: 1,
      formular: {
        name: formular,
        fingerabdruck: "aufbau-1",
        felder: ["Betreff", "Empfänger", "Nachricht"].map((label) => ({
          label,
          typ: "text",
          wert: werte.get(label) ?? "",
          gesperrt: false,
        })),
        knoepfe: ["Entwurf speichern", "Endgültig senden", "Bestellung auslösen"],
      },
      entwuerfe: [],
    }),
    fuelle: async (_tab, a) => {
      werte.set(a.label, a.wert);
      return { ok: true, wert: { wert: a.wert } };
    },
    klicke: async (_tab, a) => {
      klicks.push(a.knopf);
      return { ok: true, wert: null };
    },
    loesche: async () => ({ ok: false, grund: "eintrag_fehlt" }),
  };
  return { adapter, klicks, werte };
}

function profil(teil: Partial<BrowserSeitenprofil>): BrowserSeitenprofil {
  return { ...TESTSEITE, ...teil };
}

describe("BPA-03 · Capability-Register", () => {
  it("K3 · Lesen, Entwurf füllen und endgültig auslösen sind getrennte Handlungen mit eigenem Vertrag", () => {
    const { lesen, entwurf_fuellen, entwurf_speichern, ausloesen } = BROWSER_HANDLUNGSVERTRAG;
    expect([lesen.folge, entwurf_fuellen.folge, entwurf_speichern.folge, ausloesen.folge]).toEqual([
      "keine",
      "eingabe",
      "eigener_entwurf",
      "aussenwirkung",
    ]);
    // Nur das Auslösen verlangt die Außenaktionsbestätigung; harmlose Schritte keine zusätzliche.
    expect(ausloesen.bestaetigung).toBe("aussenaktionsbestaetigung");
    for (const v of [lesen, entwurf_fuellen, entwurf_speichern]) {
      expect(v.bestaetigung).toBe("keine_zusaetzliche");
    }
    expect(ausloesen.ruecknahme).toBe("keine");
    expect(entwurf_speichern.ruecknahme).toBe("entwurf_loeschen");
    // Das Profil benennt je Formular, was dort tatsächlich unterstützt ist.
    const angebot = REGISTER.handlungen(ORIGIN, PFAD, "Angebotsentwurf").map((h) => h.art);
    expect(angebot).toEqual([
      "lesen",
      "entwurf_fuellen",
      "entwurf_speichern",
      "entwurf_loeschen",
      "ausloesen",
    ]);
    expect(REGISTER.handlungen(ORIGIN, PFAD, "Rückmeldung").map((h) => h.art)).not.toContain(
      "ausloesen",
    );
    expect(REGISTER.handlungen("https://fremd.test", PFAD, "Angebotsentwurf")).toEqual([]);
  });

  it("K3 · ein Profil, das einen Knopf zugleich als Speichern und Senden führt oder Auslösen ohne Knopf nennt, wird abgewiesen", () => {
    const [angebot] = TESTSEITE.formulare;
    if (!angebot) throw new Error("Testprofil ohne Formular");
    const doppelt = profil({
      formulare: [
        {
          ...angebot,
          handlungen: [
            { art: "lesen", knopf: null },
            { art: "entwurf_speichern", knopf: "Speichern" },
            { art: "ausloesen", knopf: "Speichern" },
          ],
        },
      ],
    });
    expect(() => new BrowserFaehigkeitsregister([doppelt])).toThrow(BrowserVertragFehler);
    const ohneKnopf = profil({
      formulare: [
        {
          ...angebot,
          handlungen: [
            { art: "lesen", knopf: null },
            { art: "ausloesen", knopf: null },
          ],
        },
      ],
    });
    expect(() => new BrowserFaehigkeitsregister([ohneKnopf])).toThrow(BrowserVertragFehler);
    const unsicher = profil({ origin: "http://unsicher.test" });
    expect(() => new BrowserFaehigkeitsregister([unsicher])).toThrow(BrowserVertragFehler);
  });

  it("K3/K4 · ein Entwurfsauftrag enthält kein Auslösen; ausgelöst wird nur der ausdrücklich genannte Knopf", () => {
    expect(auftrag().erlaubt).toEqual([
      "lesen",
      "entwurf_fuellen",
      "entwurf_speichern",
      "entwurf_loeschen",
    ]);
    const senden = auftrag({ speichern: false, ausloesen: "Endgültig senden" });
    expect(senden.erlaubt).toEqual(["lesen", "entwurf_fuellen", "ausloesen"]);
    // „Bestellung auslösen" steht auf der Seite, aber nicht im Register: gesperrt.
    const bestellung = neuerBrowserAuftrag(REGISTER, eingabe({ ausloesen: "Bestellung auslösen" }));
    expect(bestellung.ok).toBe(false);
    expect(!bestellung.ok && "uebergabe" in bestellung && bestellung.uebergabe.grund).toBe(
      "gesperrte_handlung",
    );
  });
});

describe("BPA-03 · Außenaktionsbestätigung", () => {
  it("K4 · ohne passende Bestätigung kein Klick; eine fremd gebundene zählt nicht; die passende genau einmal", async () => {
    const seite = doppelgaenger();
    const a = auftrag({ speichern: false, ausloesen: "Endgültig senden" });
    const lauf = new BrowserAusfuehrung(a, {
      adapter: seite.adapter,
      register: REGISTER,
      rechte: async () => true,
    });
    const erst = await lauf.ausfuehren();
    // Harmlose beauftragte Schritte liefen ohne Rückfrage, die Außenwirkung wartet.
    expect(erst.stand).toBe("bestaetigung_noetig");
    expect(seite.werte.get("Betreff")).toBe(a.felder[0]?.wert);
    expect(seite.klicks).toEqual([]);
    const bedarf = lauf.bestaetigungsBedarf();
    expect(bedarf?.knopf).toBe("Endgültig senden");
    const basis = {
      auftragId: a.id,
      knopf: "Endgültig senden",
      fingerabdruck: bedarf?.fingerabdruck ?? "",
      nutzer: a.nutzer,
      bestaetigtAm: "2026-10-16T12:00:00.000Z",
    };
    // Andere Werte/anderer Auftrag, anderes Konto, anderer Knopf: abgewiesen.
    const anderer = auftrag({ speichern: false, ausloesen: "Endgültig senden" });
    expect(lauf.bestaetige({ ...basis, auftragId: anderer.id })).toBe(false);
    expect(lauf.bestaetige({ ...basis, fingerabdruck: "0".repeat(64) })).toBe(false);
    expect(lauf.bestaetige({ ...basis, nutzer: "nutzer-synthetisch-b" })).toBe(false);
    expect(lauf.bestaetige({ ...basis, knopf: "Bestellung auslösen" })).toBe(false);
    expect((await lauf.fortsetzen()).stand).toBe("bestaetigung_noetig");
    expect(seite.klicks).toEqual([]);
    expect(lauf.bestaetige(basis)).toBe(true);
    const fertig = await lauf.fortsetzen();
    expect(fertig.stand).toBe("fertig");
    expect(fertig.erfolg).toBe(true);
    expect(fertig.bestaetigung).toEqual({
      knopf: "Endgültig senden",
      bestaetigtAm: "2026-10-16T12:00:00.000Z",
    });
    expect(fertig.verlauf.map((v) => v.ereignis)).toEqual(
      expect.arrayContaining(["bestaetigung_noetig", "bestaetigt", "ausgeloest"]),
    );
    await lauf.ausfuehren();
    expect(seite.klicks).toEqual(["Endgültig senden"]);
  });

  it("K4 · ein Entwurfsauftrag löst auf ausdrücklichen Einzelwunsch weder Senden noch Bestellen aus", async () => {
    const seite = doppelgaenger();
    const lauf = new BrowserAusfuehrung(auftrag(), {
      adapter: seite.adapter,
      register: REGISTER,
      rechte: async () => true,
    });
    for (const knopf of ["Endgültig senden", "Bestellung auslösen"]) {
      const sicht = await lauf.loeseAus(knopf);
      expect(sicht.uebergabe?.grund).toBe("gesperrte_handlung");
      expect(sicht.uebergabe?.schritt).toContain(knopf);
    }
    expect(seite.klicks).toEqual([]);
  });
});

describe("BPA-03 · Seiteninhalt bleibt Inhalt", () => {
  it("K5 · Injection aus Seite, Tooltip und Download wird erkannt und ändert weder Ziel, Werte noch Erlaubnis", () => {
    const a = auftrag();
    const vorher = JSON.stringify(a);
    const lauf = new BrowserAusfuehrung(a, {
      adapter: doppelgaenger().adapter,
      register: REGISTER,
      rechte: async () => true,
    });
    const befunde = [
      lauf.inhaltAufnehmen("seite", INJEKTION.seite),
      lauf.inhaltAufnehmen("tooltip", INJEKTION.tooltip),
      lauf.inhaltAufnehmen("download", INJEKTION.download),
    ];
    expect(befunde.map((b) => b.fremdeAnweisung)).toEqual([true, true, true]);
    expect(JSON.stringify(a)).toBe(vorher);
    expect(Object.isFrozen(a) && Object.isFrozen(a.felder) && Object.isFrozen(a.ziel)).toBe(true);
    expect(() => {
      (a.erlaubt as string[]).push("ausloesen");
    }).toThrow();
    // Die Sicht behält nur den Befund, nie den Text.
    expect(JSON.stringify(lauf.ansicht())).not.toContain(ANGREIFER);
  });
});

describe("BPA-03 · manuelle Übergabe statt simuliertem Erfolg", () => {
  it("K10 · nicht unterstützte Seite, fremdes Formular und gesperrtes Feld nennen einen konkreten Schritt", () => {
    const fremdesZiel = {
      tabId: 1,
      origin: "https://fremd.test",
      pfad: PFAD,
      formular: "Angebotsentwurf",
    };
    const fremd = neuerBrowserAuftrag(REGISTER, eingabe({ ziel: fremdesZiel }));
    const formular = neuerBrowserAuftrag(
      REGISTER,
      eingabe({ ziel: { tabId: 1, origin: ORIGIN, pfad: PFAD, formular: "Kontakt" } }),
    );
    const kennwort = neuerBrowserAuftrag(
      REGISTER,
      eingabe({ felder: [{ label: "Kennwort", wert: "synthetisch" }] }),
    );
    const gruende = [fremd, formular, kennwort].map((x) =>
      !x.ok && "uebergabe" in x ? x.uebergabe : null,
    );
    expect(gruende.map((u) => u?.grund)).toEqual([
      "nicht_unterstuetzt",
      "nicht_unterstuetzt",
      "gesperrte_handlung",
    ]);
    expect(gruende[0]?.schritt).toContain('„Betreff"');
    expect(gruende[0]?.schritt).toContain("selbst");
    expect(gruende[2]?.schritt).toContain('„Kennwort"');
  });

  it("K5/K10 · der Seitenausführer liest weder Sitzung noch Netz und lauscht der Seite nicht", () => {
    const quelle = readFileSync(resolve("extensions/klara-browser/aktion.js"), "utf8");
    const code = quelle.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(?<!:)\/\/.*$/gm, " ");
    expect(code).not.toMatch(
      /storage|token|fetch|XMLHttpRequest|sendMessage|innerHTML|addEventListener|getAttribute\("title"\)/,
    );
    // Kennwort-, Einmalcode- und Dateifelder sind gesperrt; CAPTCHA wird nur erkannt.
    expect(code).toContain('el.type === "password"');
    expect(code).toContain('"one-time-code"');
  });
});
