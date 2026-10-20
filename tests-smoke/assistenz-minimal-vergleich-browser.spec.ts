// ================================================================================================
// ASSISTENZ MINIMAL · UI-MIN-10 / UI-S12 — VORHER-NACHHER-VERGLEICH IM GEBÜNDELTEN PRODUKT.
// ================================================================================================
//
// Drei Szenarien, je auf beiden Flächen, je mit eigenem fiktiven Konto und mit IDENTISCHEN Inhalten
// und Handlungsschritten:
//   · Gespräch      — Startseite, Assistenz öffnen, dieselbe erste Frage stellen (samt Einwilligung);
//   · Markierung    — denselben Seitentext markieren, übergeben, „Erklären“, Markierung entfernen;
//   · Aufnahme      — Spracheingabe starten, synthetischen Erkennungstext einspeisen, Aufnahme stoppen,
//                     den erkannten Text im Feld korrigieren.
// Gemessen und als Anhang „VERGLEICH-UI-MIN-10.json“ abgelegt — GETRENNT gezählt:
//   · funktionale Gruppen (sichtbare Bereiche) und einzelne sichtbare Bedienelemente;
//   · Schritte (dieselben Handlungen auf beiden Seiten), Rückfragen (Karten, die vor dem Ziel
//     beantwortet werden mussten), Such-/Scrollaufwand (nächste Handlung ohne Scrollen im Bild?),
//     Fehlerkorrektur (Aktionen, um den Fehler des Szenarios zu beheben);
//   · ZUSATZPRÜFUNGEN, die es nur auf einer Seite gibt (z. B. Stopp bei offenem Menü), GETRENNT —
//     sie zählen nicht als Schritte.
//
// VORHER IST DIE BISHERIGE PRODUKTFLÄCHE (Nacharbeit 3, Bens Befund): derselbe Produktbetrieb auf
// derselben Startseite, über den Sitzungsschalter `klarwerk.assistenz.vergleich = frueher` der
// unveränderte bisherige Zweig von `KlaraVorschau.tsx` (produkt:20261010:assistenz-produkteinstieg).
// Kein Vorschau-Ersatz mehr.
//
// GRENZEN, ausdrücklich: Die Aufnahme ist eine TESTSIMULATION der Browser-Spracherkennung — der
// erkannte Text wird synthetisch eingespeist; keine reale Mikrofon- oder Audioprobe. Beobachtung und
// Ausführung gibt es im Produkt nicht; sie stehen als offen im Bericht. Menschlicher Nutzen ist hier
// nicht gemessen. Der Mac-Begleiter (`/begleiter`) prüft `tests/klara-office/`. Alles fiktiv.
import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Assistenz-Vergleich-Kennwort-1";
const FRAGE = "Vergleichsprobe: Was gilt hier für die Anlage?";
const VERTIPPT = "Vergleichsprobe: Was gilt hier für die Anlgae?";
const ERKANNT = "Synthetischer Diktattext mit Fehlre";
const KORRIGIERT = "Synthetischer Diktattext mit Fehler";

type Flaeche = "vorher" | "nachher";

interface Messung {
  gruppen: string[];
  bedienelemente: string[];
  naechsteHandlungOhneScrollen: Record<string, boolean>;
}

interface Szenario {
  flaeche: Flaeche;
  szenario: "gespraech" | "markierung" | "aufnahme";
  ruhe?: Messung;
  imSzenario?: Messung;
  schritte: string[];
  rueckfragen: string[];
  fehlerkorrektur: { fehler: string; schritte: string[] };
  /** Prüfungen, die es nur auf dieser Fläche gibt — getrennt, keine Schritte. */
  zusatzpruefungen: string[];
}

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Testsimulation der Browser-Spracherkennung — KEIN reales Mikrofon. Der erkannte Text wird über
 * `window.__klaraErkennung(text)` synthetisch eingespeist, im selben Ergebnisformat wie der Browser.
 */
const REKORDER_SIMULATION = `
  (() => {
    let aktiv = null;
    class Simulation {
      constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; }
      start() { aktiv = this; setTimeout(() => this.onaudiostart && this.onaudiostart(), 0); }
      stop() { this.onaudioend && this.onaudioend(); this.onend && this.onend(); if (aktiv === this) aktiv = null; }
      abort() { this.stop(); }
    }
    window.SpeechRecognition = Simulation;
    window.webkitSpeechRecognition = Simulation;
    window.__klaraErkennung = (text) => {
      if (!aktiv || !aktiv.onresult) return false;
      const ergebnis = [{ transcript: text }];
      ergebnis.isFinal = true;
      aktiv.onresult({ resultIndex: 0, results: [ergebnis] });
      return true;
    };
  })();
`;

async function eigenesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `assistenz-vergleich-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Assistenz Vergleich ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(browser: Browser, email: string, flaeche: Flaeche): Promise<Page> {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await kontext.addInitScript(REKORDER_SIMULATION);
  if (flaeche === "vorher") {
    await kontext.addInitScript(() => {
      sessionStorage.setItem("klarwerk.assistenz.vergleich", "frueher");
    });
  }
  const page = await kontext.newPage();
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  return page;
}

/** Funktionale Gruppen: Bereich → Testkennungen, die ihn tragen (vorher und nachher). */
const GRUPPEN: Record<string, readonly string[]> = {
  kopf: ["klara-panel-titel"],
  menue: ["klara-menue-knopf"],
  betrieb: ["klara-betrieb", "klara-demo-hinweis"],
  kontextzeile: ["klara-kontext-zeile"],
  ort: ["klara-ort"],
  bezug: ["klara-bezug"],
  markierung: ["klara-auswahl", "klara-auswahl-leer"],
  seitenhilfe: ["klara-modi"],
  bedienhilfe: ["klara-bedienhilfe"],
  sprachausgabe: ["klara-sprachausgabe"],
  betriebshinweis: ["klara-echt-hinweis"],
  ki: ["klara-ki-ohne-modell", "klara-ki-aus", "klara-ki-unbekannt", "klara-ki-aus-hinweis"],
  extern: ["klara-extern"],
  einwilligung: ["klara-einwilligung", "klara-einwilligung-erteilt"],
  verlauf: ["klara-verlauf"],
  sprache: ["klara-sprache", "klara-mikrofon"],
  eingabe: ["klara-eingabe-form"],
  vorgaenge: ["klara-vorgaenge"],
  offen: ["klara-offen"],
  fuss: ["klara-andocken"],
};

async function messen(page: Page, naechste: readonly string[]): Promise<Messung> {
  return page.getByTestId("klara-gespraech").evaluate(
    (wurzel, args) => {
      const sichtbar = (el: Element): boolean => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (p instanceof HTMLDetailsElement && !p.open) {
            const kopf = p.querySelector(":scope > summary");
            if (!kopf?.contains(el)) {
              return false;
            }
          }
        }
        const r = el.getBoundingClientRect();
        const pruef = (el as HTMLElement).checkVisibility?.({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
        return r.width > 0 && r.height > 0 && pruef !== false;
      };
      const ohneScrollen = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight + 1) {
          return false;
        }
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) {
            const pr = p.getBoundingClientRect();
            if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1) {
              return false;
            }
          }
        }
        return true;
      };
      const gruppen = Object.entries(args.gruppen)
        .filter(([, ids]) =>
          ids.some((id) =>
            Array.from(wurzel.querySelectorAll(`[data-testid="${id}"]`)).some(sichtbar),
          ),
        )
        .map(([name]) => name);
      const bedienelemente = Array.from(
        wurzel.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], summary"),
      )
        .filter(sichtbar)
        .map((el) => el.dataset.testid ?? el.tagName.toLowerCase());
      const naechsteHandlungOhneScrollen: Record<string, boolean> = {};
      for (const id of args.naechste) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        naechsteHandlungOhneScrollen[id] = el ? sichtbar(el) && ohneScrollen(el) : false;
      }
      return { gruppen, bedienelemente, naechsteHandlungOhneScrollen };
    },
    { gruppen: GRUPPEN, naechste },
  );
}

async function oeffnen(page: Page, flaeche: Flaeche): Promise<void> {
  const gespraech = page.getByTestId("klara-gespraech");
  if (!(await gespraech.isVisible())) {
    await page.getByTestId("klara-figur").click();
  }
  await expect(gespraech).toBeVisible();
  await expect(page.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  // Beide Seiten sind der Produktbetrieb; nur die Fläche unterscheidet sich.
  await expect(page.getByTestId("klara-figur")).toHaveAttribute("data-betriebsart", "produkt");
  if (flaeche === "nachher") {
    await expect(gespraech).toHaveAttribute("data-oberflaeche", "minimal");
  } else {
    await expect(gespraech).not.toHaveAttribute("data-oberflaeche", "minimal");
  }
}

async function antwortAbwarten(page: Page, vorher: number): Promise<void> {
  const antworten = page.locator('[data-testid="klara-nachricht"][data-von="klara"]');
  await expect(antworten).toHaveCount(vorher + 1, { timeout: 20_000 });
  await expect(antworten.last()).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
}

/** Markiert den ersten längeren Text der Seite ausserhalb der Assistenz — auf beiden Seiten gleich. */
async function seitentextMarkieren(page: Page): Promise<string> {
  const text = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const gang = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = gang.nextNode(); n; n = gang.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest("[data-klara]") || (n.textContent ?? "").trim().length < 12) {
        continue;
      }
      const r = document.createRange();
      r.selectNodeContents(n);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      document.dispatchEvent(new Event("selectionchange"));
      return (n.textContent ?? "").trim();
    }
    return "";
  });
  expect(text, "kein markierbarer Seitentext").not.toBe("");
  return text;
}

async function szenarienAuf(page: Page, flaeche: Flaeche): Promise<Szenario[]> {
  const ergebnisse: Szenario[] = [];
  const neu = (szenario: Szenario["szenario"], fehler: string): Szenario => ({
    flaeche,
    szenario,
    schritte: [],
    rueckfragen: [],
    fehlerkorrektur: { fehler, schritte: [] },
    zusatzpruefungen: [],
  });

  // --- Gespräch: dieselbe Frage, dieselben Handlungen --------------------------------------------
  const gespraech = neu("gespraech", "Frage vor dem Senden vertippt");
  await oeffnen(page, flaeche);
  gespraech.schritte.push("Assistenz öffnen");
  gespraech.ruhe = await messen(page, [
    "klara-eingabe",
    "klara-senden",
    "klara-einwilligung-erteilen",
  ]);
  const eingabe = page.getByTestId("klara-eingabe");
  if (flaeche === "vorher") {
    // Bisher stand die Einwilligung als Block im Verlauf und musste VOR dem Tippen gefunden werden.
    if (!gespraech.ruhe.naechsteHandlungOhneScrollen["klara-einwilligung-erteilen"]) {
      await page.getByTestId("klara-einwilligung-erteilen").scrollIntoViewIfNeeded();
      gespraech.schritte.push("zum Einwilligungsblock scrollen");
    }
    await page.getByTestId("klara-einwilligung-erteilen").click();
    gespraech.schritte.push("Einwilligung erteilen");
    gespraech.rueckfragen.push("Einwilligungsblock vor der ersten Frage");
    await expect(page.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  }
  await eingabe.fill(VERTIPPT);
  gespraech.schritte.push("Frage tippen");
  await eingabe.fill(FRAGE);
  gespraech.fehlerkorrektur.schritte.push("Tippfehler im selben Feld korrigieren");
  await eingabe.press("Enter");
  gespraech.schritte.push("Senden");
  if (flaeche === "nachher") {
    await expect(page.getByTestId("klara-einwilligung")).toBeVisible();
    gespraech.rueckfragen.push("Einwilligung beim ersten Senden");
    await page.getByTestId("klara-einwilligung-erteilen").click();
    gespraech.schritte.push("Einwilligung erteilen");
  }
  await antwortAbwarten(page, 0);
  gespraech.imSzenario = await messen(page, ["klara-eingabe", "klara-senden"]);
  ergebnisse.push(gespraech);

  // --- Markierung: derselbe Seitentext, dieselben Handlungen --------------------------------------
  const markierung = neu("markierung", "falsche Stelle markiert und übergeben");
  await page.getByTestId("klara-schliessen").click();
  markierung.schritte.push("Assistenz schliessen, um auf der Seite zu markieren");
  await seitentextMarkieren(page);
  markierung.schritte.push("Text markieren");
  await expect(page.getByTestId("klara-auswahl-knopf")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("klara-auswahl-knopf").click();
  markierung.schritte.push("„… fragen“ an der Markierung");
  await expect(page.getByTestId("klara-auswahl")).toBeVisible();
  markierung.ruhe = gespraech.imSzenario;
  markierung.imSzenario = await messen(page, ["klara-aktion-erklaeren", "klara-auswahl-entfernen"]);
  const antwortenVorher = await page
    .locator('[data-testid="klara-nachricht"][data-von="klara"]')
    .count();
  if (!markierung.imSzenario.naechsteHandlungOhneScrollen["klara-aktion-erklaeren"]) {
    await page.getByTestId("klara-aktion-erklaeren").scrollIntoViewIfNeeded();
    markierung.schritte.push("zu „Erklären“ scrollen");
  }
  await page.getByTestId("klara-aktion-erklaeren").click();
  markierung.schritte.push("Erklären");
  await antwortAbwarten(page, antwortenVorher);
  const entfernen = page.getByTestId("klara-auswahl-entfernen");
  if (!(await entfernen.isVisible())) {
    await page.getByTestId("klara-auswahl-mehr").locator("summary").click();
    markierung.fehlerkorrektur.schritte.push("„Weitere Möglichkeiten“ öffnen");
  }
  await entfernen.click();
  markierung.fehlerkorrektur.schritte.push("Markierung entfernen");
  await expect(page.getByTestId("klara-auswahl")).toHaveCount(0);
  ergebnisse.push(markierung);

  // --- Aufnahme (Testsimulation): dieselben Handlungen, echter Erkennungstext ---------------------
  const aufnahme = neu("aufnahme", "Diktat falsch erkannt");
  aufnahme.ruhe = await messen(page, ["klara-mikrofon", "klara-diktieren"]);
  const start = flaeche === "nachher" ? "klara-mikrofon" : "klara-diktieren";
  await page.getByTestId(start).click();
  aufnahme.schritte.push("Spracheingabe starten");
  await expect(page.getByTestId("klara-aufnahme-stoppen")).toBeVisible();
  aufnahme.imSzenario = await messen(page, ["klara-aufnahme-stoppen"]);
  const eingespeist = await page.evaluate(
    (text) =>
      (window as unknown as { __klaraErkennung: (t: string) => boolean }).__klaraErkennung(text),
    ERKANNT,
  );
  expect(eingespeist, "Erkennungstext nicht eingespeist").toBe(true);
  await expect(page.getByTestId("klara-eingabe")).toHaveValue(ERKANNT);
  if (flaeche === "nachher") {
    // Nur nachher gibt es ein Menü — GETRENNT ausgewiesen, kein Schritt.
    await page.getByTestId("klara-menue-knopf").click();
    await expect(page.getByTestId("klara-aufnahme-stoppen")).toBeVisible();
    await page.keyboard.press("Escape");
    aufnahme.zusatzpruefungen.push("Stopp bleibt bei offenem Menü sichtbar");
  }
  await page.getByTestId("klara-aufnahme-stoppen").click();
  aufnahme.schritte.push("Aufnahme stoppen");
  await expect(page.getByTestId("klara-aufnahme-stoppen")).toHaveCount(0);
  await page.getByTestId("klara-eingabe").fill(KORRIGIERT);
  aufnahme.fehlerkorrektur.schritte.push("erkannten Text im Eingabefeld korrigieren");
  await expect(page.getByTestId("klara-eingabe")).toHaveValue(KORRIGIERT);
  ergebnisse.push(aufnahme);
  return ergebnisse;
}

async function bericht(info: TestInfo, ergebnisse: Szenario[]): Promise<void> {
  const zusammenfassung = ergebnisse.map((e) => ({
    flaeche: e.flaeche,
    szenario: e.szenario,
    gruppenRuhe: e.ruhe?.gruppen.length ?? null,
    bedienelementeRuhe: e.ruhe?.bedienelemente.length ?? null,
    gruppenImSzenario: e.imSzenario?.gruppen.length ?? null,
    bedienelementeImSzenario: e.imSzenario?.bedienelemente.length ?? null,
    schritte: e.schritte.length,
    rueckfragen: e.rueckfragen.length,
    fehlerkorrekturSchritte: e.fehlerkorrektur.schritte.length,
    zusatzpruefungen: e.zusatzpruefungen.length,
  }));
  await info.attach("VERGLEICH-UI-MIN-10.json", {
    body: JSON.stringify(
      {
        auftrag: "produkt:20261011:assistenz-minimalistische-oberflaeche",
        kriterium: "UI-MIN-10 / UI-S12",
        vorher:
          "bisherige Produktfläche (produkt:20261010:assistenz-produkteinstieg) im selben Bündel, Startseite, Sitzungsschalter klarwerk.assistenz.vergleich=frueher",
        nachher: "Minimaloberfläche, Startseite",
        identisch: {
          frage: FRAGE,
          vertippt: VERTIPPT,
          erkannterText: ERKANNT,
          korrigiert: KORRIGIERT,
          markierung: "erster längerer Text der Startseite ausserhalb der Assistenz",
        },
        offen: [
          "Aufnahme: synthetisch eingespeister Erkennungstext — keine reale Mikrofon- oder Audioprobe.",
          "Beobachtung und Ausführung: im Produkt nicht vorhanden — keine Probe möglich.",
          "Menschlicher Nutzen und Peters Sichtung: nicht gemessen.",
          "Mac-Begleiter (/begleiter): Vergleich der Grundansicht in tests/klara-office/, kein Vorher-Bild.",
        ],
        zusammenfassung,
        einzelheiten: ergebnisse,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
}

test("Assistenz minimal · UI-MIN-10: Vorher-Nachher für Gespräch, Markierung und Aufnahme", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const vorherKonto = await eigenesKonto(page, "vorher");
  const nachherKonto = await eigenesKonto(page, "nachher");

  const pv = await anmelden(browser, vorherKonto, "vorher");
  const vorher = await szenarienAuf(pv, "vorher");
  await pv.context().close();

  const pn = await anmelden(browser, nachherKonto, "nachher");
  const nachher = await szenarienAuf(pn, "nachher");
  await pn.context().close();

  await bericht(info, [...vorher, ...nachher]);

  const g = (liste: Szenario[], s: Szenario["szenario"]): Szenario => {
    const e = liste.find((x) => x.szenario === s);
    if (!e) {
      throw new Error(`Szenario ${s} fehlt`);
    }
    return e;
  };
  // Identische Inhalte: dieselbe Zahl Fehlerkorrekturen für dieselben Fehler (ausser Markierung).
  expect(g(nachher, "aufnahme").fehlerkorrektur.schritte).toEqual(
    g(vorher, "aufnahme").fehlerkorrektur.schritte,
  );
  // Was der Auftrag zusagt — gemessen, nicht geschätzt.
  const gv = g(vorher, "gespraech");
  const gn = g(nachher, "gespraech");
  expect(gn.ruhe?.gruppen.length ?? 99).toBeLessThan(gv.ruhe?.gruppen.length ?? 0);
  expect(gn.ruhe?.bedienelemente.length ?? 99).toBeLessThan(gv.ruhe?.bedienelemente.length ?? 0);
  expect(gn.ruhe?.naechsteHandlungOhneScrollen["klara-eingabe"]).toBe(true);
  expect(gn.ruhe?.naechsteHandlungOhneScrollen["klara-senden"]).toBe(true);
  const mn = g(nachher, "markierung");
  const vorschlaege = (mn.imSzenario?.bedienelemente ?? []).filter((id) =>
    id.startsWith("klara-aktion-"),
  );
  expect(vorschlaege.length).toBeLessThanOrEqual(2);
  const an = g(nachher, "aufnahme");
  expect(an.imSzenario?.naechsteHandlungOhneScrollen["klara-aufnahme-stoppen"]).toBe(true);
  // Zusatzprüfungen zählen nie als Schritte.
  expect(an.schritte).not.toContain("Stopp bleibt bei offenem Menü sichtbar");
});
