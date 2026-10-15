// ================================================================================================
// produkt:20261009:referenzki-adminauswahl (REF-03) — DER EINSTIEG „REFERENZPRÜFUNG", BEDIENT
// (Chromium, 1280 × 800 und 390 × 844, nur Tastatur, sichtbarer Fokus, Fehlerhilfe, Rückweg).
// ================================================================================================
//
// Vorrichtung: `h4-harness` — gebautes dist, ECHTE App (`buildApp`, echte Dienste), Chromium.
// Die Prüfbühne hat keinen Modellzugang. Ersetzt sind deshalb genau zwei Stellen des Reasoners:
//   · `referenzLage` meldet Claude (Anthropic) als registrierten Zugang mit fiktivem Modell, je nach
//     Szenario gesperrt (Freigabe fehlt) oder einsatzbereit mit demselben Modell wie die Antwort-KI.
//     Erlaubt/Vorrang kommen weiter aus der echten, gespeicherten Liste.
//   · `referenzFunktionsPruefer` liefert einen Prüfer-Doppelgänger (kein Netz, kein Modell), der
//     den fiktiven Prüfstoff richtig beurteilt und seine Aufrufe zählt.
// Route, Schreibweg, Audit, Zustandsableitung und Oberfläche sind echt. Der echte Modellaufruf
// steht in `tests-smoke/referenzki-funktionscheck-modell.spec.ts` (voller Smoke, @modell).
//
//   C1 · 1280 × 800: Verwaltung → KI → Zeile „Referenzprüfung" per Tastatur öffnen; Zustände je
//        Option; Claude per Leertaste erlauben → gespeichert (Server + Audit mit Modell); Sperre mit
//        nächstem Schritt; Neuladen behält die Auswahl; gleiches Modell → Konflikthilfe; kein
//        Funktionscheck beim Öffnen; Funktionscheck per Enter → Ergebnis mit Modellaufruf, danach
//        „letzte Prüfung erfolgreich"; Rückweg per Tastatur zur Zeile.
//   C2 · 390 × 844: dieselbe Karte ohne waagerechtes Überlaufen; Abwählen per Tastatur; ein
//        Speichern, das nicht protokolliert werden kann, zeigt die Fehlerhilfe und ändert nichts.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { buildServices } from "../../services/app/src/build-app";
import { REFERENZ_PRUEF_RICHTLINIE } from "../../services/ask";
import type { ReferenzLage, ReferenzPruefer } from "../../services/reasoner";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

let stand: H4Stand | null = null;
let fehler: string | null = null;
let dienste: ReturnType<typeof buildServices> | null = null;
let szenario: "gesperrt" | "bereit_gleich" = "gesperrt";
let checks = 0;

const MODELL = "claude-fiktiv-2";

const pruefer: ReferenzPruefer = {
  rolle: { anbieter: `anthropic:${MODELL}`, modell: MODELL, stufe: "cloud" },
  extern: true,
  pruefe: async (_system, user) => {
    checks += 1;
    const daten = JSON.parse(user.slice(user.indexOf("\n") + 1)) as {
      posten: { teilId: string; fundstellen: { fundstelleId: string }[] }[];
    };
    return {
      text: JSON.stringify({
        richtlinie: REFERENZ_PRUEF_RICHTLINIE,
        ergebnisse: daten.posten.map((p) => ({
          teilId: p.teilId,
          zustand: p.teilId === "fc.t1" ? "belegt" : "widersprochen",
          fundstelleId: p.fundstellen[0]?.fundstelleId ?? null,
          begruendung: "Fiktive Begründung.",
        })),
      }),
      dauerMs: 9,
      verbrauch: { eingabe: 320, ausgabe: 41 },
    };
  },
};

const DA = fn("(sel) => !!document.querySelector(sel)");
const WEG = fn("(sel) => !document.querySelector(sel)");
/** Fokus auf genau diesem Element, als Tastaturfokus (`:focus-visible`) und sichtbar gezeichnet. */
const FOKUS = fn(`(sel) => {
  const a = document.activeElement;
  if (!a || !a.matches(sel) || !a.matches(':focus-visible')) return false;
  const s = getComputedStyle(a);
  return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
}`);
const NUR_FOKUS = fn(
  "(sel) => !!document.activeElement && document.activeElement.matches(sel) && document.activeElement.matches(':focus-visible')",
);
const LAGE = fn(`() => {
  const z = (w) => {
    const li = document.querySelector('[data-testid="ki-referenz-' + w + '"]');
    return li ? li.getAttribute('data-zustand') : null;
  };
  const text = (id) => (document.querySelector('[data-testid="' + id + '"]') || {}).textContent || '';
  const k = document.querySelector('[data-testid="ki-referenz-anthropic-erlaubt"]');
  const c = document.querySelector('[data-testid="ki-referenz-anthropic-check"]');
  return {
    zustaende: { openai: z('openai'), anthropic: z('anthropic'), local: z('local') },
    anthropicErlaubt: !!k && k.checked,
    checkFrei: !!c && !c.disabled,
    hilfeAnthropic: text('ki-referenz-anthropic-hilfe'),
    hilfeOpenai: text('ki-referenz-openai-hilfe'),
    zustandText: text('ki-referenz-anthropic-zustand'),
    gleich: !!document.querySelector('[data-testid="ki-referenz-anthropic-gleich"]'),
    konflikt: text('ki-referenz-konflikt'),
    keine: text('ki-referenz-keine'),
    leer: !!document.querySelector('[data-testid="ki-referenzpruefung-leer"]'),
    grenzen: text('ki-referenz-grenzen'),
    freigabe: text('ki-referenz-freigabe'),
    ueberlauf: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}`);

interface Lage {
  zustaende: Record<string, string | null>;
  anthropicErlaubt: boolean;
  checkFrei: boolean;
  hilfeAnthropic: string;
  hilfeOpenai: string;
  zustandText: string;
  gleich: boolean;
  konflikt: string;
  keine: string;
  leer: boolean;
  grenzen: string;
  freigabe: string;
  ueberlauf: boolean;
}

async function tabBis(s: H4Stand, sel: string, max = 200, taste = "Tab"): Promise<boolean> {
  for (let i = 0; i < max; i += 1) {
    await s.seite.keyboard.press(taste);
    if (await s.seite.evaluate<boolean>(NUR_FOKUS, sel)) {
      return true;
    }
  }
  return false;
}

const KARTE = '[data-testid="detail-ki-referenz"]';

describe("REF-03 · Einstieg Referenzprüfung, bedient in Chromium", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "ref03-bedienung@ref03.test", async (z) => {
        dienste = z.services;
        const reasoner = z.services.reasoner;
        const echt = reasoner.referenzLage.bind(reasoner);
        vi.spyOn(reasoner, "referenzLage").mockImplementation((): ReferenzLage => {
          const lage = echt();
          return {
            ...lage,
            antwortmodell: { anbieter: `anthropic:${MODELL}`, modell: MODELL },
            optionen: lage.optionen.map((o) =>
              o.wahl === "anthropic"
                ? {
                    ...o,
                    eingerichtet: true,
                    anbieter: `anthropic:${MODELL}`,
                    modell: MODELL,
                    sperre: szenario === "gesperrt" ? "keine_freigabe_externe_verarbeitung" : null,
                    gleichWieAntwortmodell: szenario === "bereit_gleich",
                  }
                : o,
            ),
          };
        });
        vi.spyOn(reasoner, "referenzFunktionsPruefer").mockImplementation(() =>
          szenario === "gesperrt" ? { grund: "nicht_freigegeben" } : { pruefer },
        );
      });
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("C1 · 1280 × 800: öffnen, Zustände, erlauben, Sperre, Neuladen, Konflikt, Funktionscheck, Rückweg", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.setViewportSize({ width: 1280, height: 800 });
    szenario = "gesperrt";

    // Verwaltung → KI → Zeile „Referenzprüfung", per Tastatur geöffnet.
    await s.seite.goto(`${ORIGIN}/admin?bereich=ki`, { waitUntil: "load" });
    await s.seite.waitForFunction(DA, '[data-testid="zeile-ki-referenz"]', { timeout: 30_000 });
    expect(await tabBis(s, '[data-testid="zeile-ki-referenz"]')).toBe(true);
    await s.seite.keyboard.press("Enter");
    await s.seite.waitForFunction(DA, '[data-testid="ki-referenzpruefung"]', { timeout: 30_000 });

    const anfang = await s.seite.evaluate<Lage>(LAGE);
    console.info(`REF-03 · C1 Anfang → ${JSON.stringify(anfang)}`);
    expect(anfang.leer).toBe(true);
    expect(anfang.zustaende).toEqual({
      openai: "nicht_eingerichtet",
      anthropic: "ausgeschaltet",
      local: "nicht_eingerichtet",
    });
    expect(anfang.hilfeOpenai).toContain("Providerverwaltung");
    expect(anfang.zustandText).toContain("ausgeschaltet");
    expect(anfang.grenzen).toContain("25 s");
    expect(anfang.grenzen).toContain("keine automatische Wiederholung");
    expect(anfang.freigabe).toContain(
      "hebt keine Space-, Nutzer-, Mandanten- oder Datenfreigabe auf",
    );
    expect(anfang.ueberlauf).toBe(false);
    expect(checks).toBe(0);

    // Claude per Leertaste erlauben — sichtbarer Fokus auf dem Kästchen.
    const kaestchen = '[data-testid="ki-referenz-anthropic-erlaubt"]';
    expect(await tabBis(s, kaestchen)).toBe(true);
    expect(await s.seite.evaluate<boolean>(FOKUS, kaestchen)).toBe(true);
    await s.seite.keyboard.press("Space");
    await s.seite.waitForFunction(
      DA,
      '[data-testid="ki-referenz-anthropic"][data-zustand="nicht_verfuegbar"]',
      { timeout: 30_000 },
    );
    expect(dienste?.reasoner.getTaskConfig().referenzpruefung).toEqual(["anthropic"]);
    const gesperrt = await s.seite.evaluate<Lage>(LAGE);
    console.info(`REF-03 · C1 gesperrt → ${JSON.stringify(gesperrt)}`);
    expect(gesperrt.anthropicErlaubt).toBe(true);
    expect(gesperrt.hilfeAnthropic).toContain("Freigabe für externe Verarbeitung");
    expect(gesperrt.hilfeAnthropic).toContain("Nächster Schritt");
    expect(gesperrt.keine).toContain("nicht prüfbar");
    expect(gesperrt.checkFrei).toBe(false);

    // Das Audit nennt Akteur, Zeit und das Modell hinter der neuen Wahl.
    const eintraege = (await dienste?.audit.list({ action: "reasoner.referenzpruefung" })) ?? [];
    const letzter = eintraege.at(-1);
    expect(letzter?.payload).toMatchObject({
      vorher: [],
      nachher: ["anthropic"],
      modelleNachher: [{ wahl: "anthropic", anbieter: `anthropic:${MODELL}`, modell: MODELL }],
    });
    expect(letzter?.actor.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(letzter?.at ?? ""))).toBe(false);

    // Neuladen: die Auswahl steht weiter. Jetzt einsatzbereit, aber dasselbe Modell wie die Antwort.
    szenario = "bereit_gleich";
    await s.seite.reload({ waitUntil: "load" });
    await s.seite.waitForFunction(
      DA,
      '[data-testid="ki-referenz-anthropic"][data-zustand="konfiguriert"]',
      { timeout: 30_000 },
    );
    const bereit = await s.seite.evaluate<Lage>(LAGE);
    console.info(`REF-03 · C1 bereit → ${JSON.stringify(bereit)}`);
    expect(bereit.anthropicErlaubt).toBe(true);
    expect(bereit.zustandText).toContain("konfiguriert, noch nicht geprüft");
    expect(bereit.gleich).toBe(true);
    expect(bereit.konflikt).toContain("Kein unabhängiger Prüfer");
    expect(bereit.konflikt).toContain("kein Vier-Augen-Ergebnis");
    expect(bereit.checkFrei).toBe(true);
    // Kein Funktionscheck durch Öffnen oder Neuladen.
    expect(checks).toBe(0);

    // Funktionscheck per Tastatur.
    const checkKnopf = '[data-testid="ki-referenz-anthropic-check"]';
    expect(await tabBis(s, checkKnopf)).toBe(true);
    expect(await s.seite.evaluate<boolean>(FOKUS, checkKnopf)).toBe(true);
    await s.seite.keyboard.press("Enter");
    await s.seite.waitForFunction(
      DA,
      '[data-testid="ki-referenz-check-ergebnis"][data-ergebnis="erfolgreich"]',
      { timeout: 30_000 },
    );
    await s.seite.waitForFunction(
      DA,
      '[data-testid="ki-referenz-anthropic"][data-zustand="letzte_pruefung_erfolgreich"]',
      { timeout: 30_000 },
    );
    expect(checks).toBe(1);
    const ergebnis = await s.seite.evaluate<string>(
      fn(
        `() => document.querySelector('[data-testid="ki-referenz-check-ergebnis"]').textContent || ''`,
      ),
    );
    console.info(`REF-03 · C1 Funktionscheck → ${ergebnis}`);
    expect(ergebnis).toContain("Tatsächlicher Modellaufruf");
    expect(ergebnis).toContain(MODELL);
    expect(ergebnis).toContain("Kosten");
    const gespeichert = await dienste?.audit.list({
      action: "reasoner.referenzpruefung-funktionscheck",
    });
    expect(gespeichert?.at(-1)?.payload).toMatchObject({
      wahl: "anthropic",
      modell: MODELL,
      ergebnis: "erfolgreich",
    });

    // Rückweg per Tastatur: „Zurück" der Karte, danach steht die Zeile wieder da.
    expect(await tabBis(s, `${KARTE} [data-einst="zurueck"]`, 200, "Shift+Tab")).toBe(true);
    await s.seite.keyboard.press("Enter");
    await s.seite.waitForFunction(WEG, KARTE, { timeout: 30_000 });
    await s.seite.waitForFunction(DA, '[data-testid="zeile-ki-referenz"]', { timeout: 30_000 });
  }, 240_000);

  it("C2 · 390 × 844: ohne Überlaufen, Abwählen per Tastatur, Fehlerhilfe bei nicht protokollierbarem Speichern", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    szenario = "bereit_gleich";
    await s.seite.setViewportSize({ width: 390, height: 844 });
    await s.seite.goto(`${ORIGIN}/admin?bereich=ki&detail=kiReferenz`, { waitUntil: "load" });
    await s.seite.waitForFunction(DA, '[data-testid="ki-referenz-anthropic-erlaubt"]', {
      timeout: 30_000,
    });
    const mobil = await s.seite.evaluate<Lage>(LAGE);
    console.info(`REF-03 · C2 mobil → ${JSON.stringify(mobil)}`);
    expect(mobil.ueberlauf).toBe(false);
    expect(mobil.anthropicErlaubt).toBe(true);

    // Abwählen (Rücknahme — gilt immer und wird protokolliert).
    expect(await tabBis(s, '[data-testid="ki-referenz-anthropic-erlaubt"]')).toBe(true);
    await s.seite.keyboard.press("Space");
    await s.seite.waitForFunction(DA, '[data-testid="ki-referenzpruefung-leer"]', {
      timeout: 30_000,
    });
    expect(dienste?.reasoner.getTaskConfig().referenzpruefung).toBeUndefined();

    // Wieder erlauben, aber das Protokoll ist nicht schreibbar: 503, Fehlerhilfe, nichts geändert.
    const audit = dienste?.audit;
    const sperre = audit
      ? vi.spyOn(audit, "record").mockRejectedValue(new Error("Protokoll nicht schreibbar"))
      : null;
    try {
      expect(await tabBis(s, '[data-testid="ki-referenz-anthropic-erlaubt"]')).toBe(true);
      await s.seite.keyboard.press("Space");
      await s.seite.waitForFunction(DA, '[data-testid="ki-referenzpruefung-fehler"]', {
        timeout: 30_000,
      });
    } finally {
      sperre?.mockRestore();
    }
    const fehlerText = await s.seite.evaluate<string>(
      fn(
        `() => document.querySelector('[data-testid="ki-referenzpruefung-fehler"]').textContent || ''`,
      ),
    );
    console.info(`REF-03 · C2 Fehlerhilfe → ${fehlerText}`);
    expect(fehlerText).toContain("nicht protokolliert");
    expect(fehlerText).toContain("erneut versuchen");
    expect(dienste?.reasoner.getTaskConfig().referenzpruefung).toBeUndefined();
    const danach = await s.seite.evaluate<Lage>(LAGE);
    expect(danach.anthropicErlaubt).toBe(false);
    expect(danach.ueberlauf).toBe(false);
    // Die Fehlerhilfe ist per Tastatur weiter bedienbar: das Kästchen bleibt erreichbar.
    expect(await tabBis(s, '[data-testid="ki-referenz-anthropic-erlaubt"]')).toBe(true);
  }, 180_000);

  it("Z · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
