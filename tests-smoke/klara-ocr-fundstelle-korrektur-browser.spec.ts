// ================================================================================================
// OCR-E01/E02 · FUNDSTELLEN AM ORIGINAL UND BERICHTIGTER BILDTEXT — im echten Browser gegen den
// Smoke-Server, mit der ECHTEN Texterkennung (W01, tesseract.js unter der eigenen CSP).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen, Kriterien K1–K9 (mit K10–K12).
//
// Eine fiktive PowerPoint mit zwei Folien wird über den Dateiimport bereitgestellt (Web-App H01,
// Dateiweg Q02 — KEIN PowerPoint-Add-in, das es nicht gibt). Die Bilder werden im Browser gezeichnet;
// dabei wird gemessen, wo jedes Wort steht. Folie 1 trägt einen ABSICHTLICHEN Fehler („LAGFR“ statt
// „LAGER“), dieselbe Zahl „4711“ steht auf beiden Folien; Folie 2 trägt Name und Datum.
//
//   K1/K2  Zahl, Name, Datum: die Ansicht zeigt das Bild DIESER Folie (Bytes) und die Markierung liegt
//          auf dem gezeichneten Wort; „4711“ auf Folie 1 und 2 führt zu zwei verschiedenen Stellen.
//          Per Tastatur: Fokus, Pfeiltaste, Eingabe.
//   K3     „Ansicht drehen“ und „Vergrößern“: die Markierung liegt danach weiter auf dem Wort.
//   K4     Ein ergänztes Wort ohne Position: das ganze Bild, keine Markierung, der Grund.
//   K5     Berichtigen („LAGER“): angezeigt, unterscheidbar vom Rohbefund; Klaras Fundstellen tragen
//          die Berichtigung (im Tor ohne Modell: die deterministischen Fundstellen; eine formulierte
//          Modellantwort wird protokolliert, falls es ein Modell gibt).
//   K6     Neuladen + erneutes Einlesen derselben Datei: die Berichtigung ist wieder da.
//   K8     Veränderte Folie (andere Bytes) und andere Datei: keine Übertragung, sichtbar benannt.
//   K9     Zweites Konto (Experte) sieht die Berichtigung nicht; ein Betrachter darf nicht (403).
//   K7     Zurücksetzen: der Rohbefund ist zurück, das Originalbild unverändert.
//
// ZUSTANDSANLEGEND (Berichtigungen am Konto, zwei fiktive Konten) — läuft deshalb ausschliesslich im
// isolierten Kontext `chromium-zustand` (`ZUSTAND_SPEC` in `playwright.smoke.config.ts`). Am Ende
// werden die Berichtigungen des Prüfkontos zurückgesetzt.
import { type Browser, type Locator, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";
import {
  type GezeichnetesBild,
  type GezeichnetesWort,
  PPTX_TYP,
  deckMit,
  zeichneBild,
} from "./support/ocr-fundstellen-probe";

const DECK = "fiktive-lagerliste-ocr-e.pptx";
const DATEI = "[data-testid=datei-bild-befunde]";
const DATEI_BEFUND = `${DATEI} [data-testid=bild-befunde]`;
const KORREKTUREN = "/api/me/assistenz/bildkorrekturen";
const KENNWORT = "Fundstellen-Kennwort-1";

interface Rechteck {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Korrekturen {
  darfBearbeiten: boolean;
  korrekturen: { quelle: string; inhaltskennung: string; text: string }[];
}

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Eine Datei über den Dateiimport bereitstellen und warten, bis Befund UND Berichtigungen da sind. */
async function einlesen(page: Page, name: string, buffer: Buffer): Promise<string> {
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });
  await eingang.setInputFiles({ name, mimeType: PPTX_TYP, buffer });
  let status = "wartet";
  await expect
    .poll(
      async () => {
        status =
          (await page.evaluate(
            (auswahl) => document.querySelector(auswahl)?.getAttribute("data-status") ?? null,
            DATEI_BEFUND,
          )) ?? "wartet";
        return status;
      },
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  // Die gespeicherten Berichtigungen des Kontos sind geladen (kein „wird geladen“ mehr).
  await expect(page.locator(`${DATEI} [data-testid=bild-berichtigung-stand]`)).toHaveCount(0, {
    timeout: 20_000,
  });
  return status;
}

const zeile = (page: Page, index: number): Locator =>
  page.locator(`${DATEI_BEFUND} [data-testid=bild-befund]`).nth(index);

const text = async (page: Page, index: number): Promise<string> =>
  (await zeile(page, index).getByTestId("bild-befund-text").textContent()) ?? "";

/** Die Schaltfläche des Wortes `wort` (Groß-/Kleinschreibung egal) im Bild `index`. */
function stelle(page: Page, index: number, wort: string): Locator {
  const sicher = wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const genau = new RegExp(`^${sicher}$`, "i");
  return zeile(page, index).getByTestId("bild-befund-stelle").filter({ hasText: genau }).first();
}

/** Die Mitte der Markierung relativ zum Bild (0–1) — vergleichbar über verschieden große Bilder. */
function relativ(f: { bild: Rechteck; markierung: Rechteck }): { x: number; y: number } {
  const m = mitte(f.markierung);
  return { x: (m.x - f.bild.x) / f.bild.width, y: (m.y - f.bild.y) / f.bild.height };
}

function mitte(r: Rechteck): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Wo das gezeichnete Wort auf dem Bildschirm liegen muss — aus dem Bildrahmen der Ansicht. */
function soll(bild: Rechteck, b: GezeichnetesBild, w: GezeichnetesWort, drehung: 0 | 90) {
  const c = mitte(bild);
  const s = drehung === 0 ? bild.width / b.breite : bild.height / b.breite;
  const dx = (w.x0 + w.x1) / 2 - b.breite / 2;
  const dy = (w.y0 + w.y1) / 2 - b.hoehe / 2;
  // CSS `rotate(90deg)` dreht im Uhrzeigersinn: (dx, dy) → (−dy, dx).
  const p =
    drehung === 0 ? { x: c.x + dx * s, y: c.y + dy * s } : { x: c.x - dy * s, y: c.y + dx * s };
  const breite = (w.x1 - w.x0) * s;
  const hoehe = (w.y1 - w.y0) * s;
  return drehung === 0 ? { mitte: p, breite, hoehe } : { mitte: p, breite: hoehe, hoehe: breite };
}

/** Liegt die Markierung auf dem Wort? Mitte nahe, Größe in derselben Ordnung. */
function liegtAuf(m: Rechteck, e: ReturnType<typeof soll>): boolean {
  const c = mitte(m);
  return (
    Math.abs(c.x - e.mitte.x) <= e.breite * 0.35 + 6 &&
    Math.abs(c.y - e.mitte.y) <= e.hoehe * 0.35 + 6 &&
    m.width >= e.breite * 0.4 &&
    m.width <= e.breite * 1.8 + 10 &&
    m.height >= e.hoehe * 0.4 &&
    m.height <= e.hoehe * 1.8 + 10
  );
}

async function rechteck(l: Locator): Promise<Rechteck> {
  const r = await l.boundingBox();
  if (!r) {
    throw new Error("kein Rechteck");
  }
  return r;
}

function gezeichnet(b: GezeichnetesBild, wort: string): GezeichnetesWort {
  const w = b.woerter.find((x) => x.text === wort);
  if (!w) {
    throw new Error(`nicht gezeichnet: ${wort}`);
  }
  return w;
}

/** Öffnet die Fundstelle von `wort` im Bild `index` und misst Bild und Markierung. */
async function fundstelle(page: Page, index: number, wort: string, b: GezeichnetesBild) {
  await stelle(page, index, wort).click();
  const ansicht = page.getByTestId("bild-fundstelle-ansicht");
  await expect(ansicht).toBeVisible();
  const src = (await page.getByTestId("bild-fundstelle-bild").getAttribute("src")) ?? "";
  const bild = await rechteck(page.getByTestId("bild-fundstelle-bild"));
  const markierung = await rechteck(page.getByTestId("bild-fundstelle-markierung"));
  const e = soll(bild, b, gezeichnet(b, wort), 0);
  return {
    art: await ansicht.getAttribute("data-art"),
    gleichesBild: src.split(",")[1] === b.png.toString("base64"),
    liegtAuf: liegtAuf(markierung, e),
    bild,
    markierung,
    soll: e,
  };
}

async function schliessen(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("bild-fundstelle-ansicht")).toHaveCount(0);
}

async function fiktivesKonto(admin: Page, rolle: "experte" | "viewer"): Promise<string> {
  const email = `fundstellen-${rolle}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Fiktiv ${rolle}`, email, password: KENNWORT, role: rolle },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await kontext.newPage();
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible().catch(() => false)) {
    await weiter.click();
  }
  const einrichtung = await page.request.put("/api/me/assistenz", {
    data: { name: "Mia", avatar: "eule", einrichtungAbschliessen: true, fassung: 0 },
  });
  expect(einrichtung.status(), await einrichtung.text()).toBe(200);
  return page;
}

async function korrekturenAmServer(page: Page): Promise<Korrekturen> {
  const r = await page.request.get(KORREKTUREN);
  expect(r.status()).toBe(200);
  return (await r.json()) as Korrekturen;
}

test("OCR-E01/E02 · Fundstellen am Original markieren, Text berichtigen, Neuladen, Rücksetzen", async ({
  page,
  browser,
}) => {
  test.setTimeout(900_000);
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  const f1 = await zeichneBild(page, 1200, 260, [{ text: "LAGFR 4711", x: 60, y: 160 }]);
  const f2 = await zeichneBild(page, 1000, 400, [
    { text: "ERIKA MUSTERMANN", x: 60, y: 150 },
    { text: "12.10.2026 4711", x: 60, y: 320 },
  ]);
  const f1Veraendert = await zeichneBild(page, 1200, 260, [{ text: "LAGFR 4712", x: 60, y: 160 }]);
  const original = deckMit([
    { titel: "Lagerliste", png: f1.png },
    { titel: "Abnahme", png: f2.png },
  ]);
  const veraendert = deckMit([
    { titel: "Lagerliste", png: f1Veraendert.png },
    { titel: "Abnahme", png: f2.png },
  ]);
  const protokoll: Record<string, unknown> = {
    art: "Technische Probe mit fiktiven Daten und fiktiven Konten — keine Kundenabnahme, kein PowerPoint-Host (Dateiweg)",
    gezeichnet: { folie1: f1.woerter, folie2: f2.woerter },
  };

  try {
    // ---------------------------------------------------------------- K1/K2/K3: Fundstellen
    protokoll.einlesen = await einlesen(page, DECK, original);
    const rohFolie1 = await text(page, 0);
    protokoll.erkannt = { folie1: rohFolie1, folie2: await text(page, 1) };

    const name = await fundstelle(page, 1, "MUSTERMANN", f2);
    await schliessen(page);
    const datum = await fundstelle(page, 1, "12.10.2026", f2);
    // K3: drehen und vergrößern — die Markierung bleibt auf dem Datum.
    await page.getByTestId("bild-fundstelle-drehen").click();
    await expect(page.getByTestId("bild-fundstelle-buehne")).toHaveAttribute("data-drehung", "90");
    const gedrehtBild = await rechteck(page.getByTestId("bild-fundstelle-bild"));
    const gedrehtMarke = await rechteck(page.getByTestId("bild-fundstelle-markierung"));
    const gedreht = liegtAuf(gedrehtMarke, soll(gedrehtBild, f2, gezeichnet(f2, "12.10.2026"), 90));
    await page.getByTestId("bild-fundstelle-groesser").click();
    await expect(page.getByTestId("bild-fundstelle-buehne")).toHaveAttribute("data-zoom", "1.5");
    const groesserBild = await rechteck(page.getByTestId("bild-fundstelle-bild"));
    const groesserMarke = await rechteck(page.getByTestId("bild-fundstelle-markierung"));
    const groesser = liegtAuf(
      groesserMarke,
      soll(groesserBild, f2, gezeichnet(f2, "12.10.2026"), 90),
    );
    await test.info().attach("ocr-e01-gedreht-vergroessert.png", {
      contentType: "image/png",
      body: await page.getByTestId("bild-fundstelle-ansicht").screenshot(),
    });
    await schliessen(page);
    const zahl2 = await fundstelle(page, 1, "4711", f2);
    await schliessen(page);
    const zahl1 = await fundstelle(page, 0, "4711", f1);
    await schliessen(page);

    // Tastatur: Fokus auf das erste Wort, Pfeil nach rechts, Eingabe öffnet „4711“ auf Folie 1.
    await zeile(page, 0).getByTestId("bild-befund-stelle").first().focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("bild-fundstelle-ansicht")).toBeVisible();
    const tastatur = await page.getByTestId("bild-fundstelle-beschreibung").textContent();
    await schliessen(page);
    protokoll.fundstellen = { name, datum, gedreht, groesser, zahl1, zahl2, tastatur };

    // ---------------------------------------------------------------- K5/K4: berichtigen
    const z1 = zeile(page, 0);
    await z1.getByTestId("bild-berichtigung-bearbeiten").click();
    const feldVorher = await z1.getByTestId("bild-berichtigung-feld").inputValue();
    await z1.getByTestId("bild-berichtigung-feld").fill("LAGER 4711 GEPRUEFT");
    await z1.getByTestId("bild-berichtigung-speichern").click();
    await expect(z1.getByTestId("bild-befund-text")).toHaveText("LAGER 4711 GEPRUEFT");
    await expect(z1.getByTestId("bild-berichtigung")).toHaveAttribute("data-berichtigt", "true");
    const roh = (await z1.getByTestId("bild-berichtigung-roh").textContent()) ?? "";
    // Das berichtigte Wort führt zur Stelle des erkannten („LAGFR“).
    await stelle(page, 0, "LAGER").click();
    const berichtigtBild = await rechteck(page.getByTestId("bild-fundstelle-bild"));
    const berichtigtMarke = await rechteck(page.getByTestId("bild-fundstelle-markierung"));
    const berichtigtAufLagfr = liegtAuf(
      berichtigtMarke,
      soll(berichtigtBild, f1, gezeichnet(f1, "LAGFR"), 0),
    );
    await schliessen(page);
    // K4: das ergänzte Wort hat keine Position — das Bild, keine Markierung, der Grund.
    await stelle(page, 0, "GEPRUEFT").click();
    const ergaenzt = {
      art: await page.getByTestId("bild-fundstelle-ansicht").getAttribute("data-art"),
      grund: await page.getByTestId("bild-fundstelle-ansicht").getAttribute("data-grund"),
      markierungen: await page.getByTestId("bild-fundstelle-markierung").count(),
      bildSichtbar: await page.getByTestId("bild-fundstelle-bild").isVisible(),
      satz: await page.getByTestId("bild-fundstelle-ohne-position").textContent(),
    };
    await schliessen(page);

    // Klara: die Fundstellen einer Frage tragen die Berichtigung.
    const panel = page.locator(`${DATEI} [data-testid=klara-bild-kontext]`);
    await panel.getByTestId("klara-bild-kontext-frage").fill("Welche Nummer hat das LAGER?");
    await panel.getByTestId("klara-bild-kontext-fragen").click();
    await expect(panel.getByTestId("klara-bild-kontext-antwort")).toHaveAttribute(
      "data-auftrag",
      "frage",
      { timeout: 120_000 },
    );
    const belege = await panel
      .getByTestId("klara-bild-kontext-beleg")
      .evaluateAll((els) =>
        els.map((el) => ({ art: el.getAttribute("data-art"), text: el.textContent ?? "" })),
      );
    const modellAntwort =
      (await panel.getByTestId("klara-bild-kontext-antworttext").count()) > 0
        ? await panel.getByTestId("klara-bild-kontext-antworttext").textContent()
        : null;
    await panel.getByTestId("klara-bild-kontext-zusammenfassen").click();
    await expect(panel.getByTestId("klara-bild-kontext-antwort")).toHaveAttribute(
      "data-auftrag",
      "zusammenfassung",
      { timeout: 120_000 },
    );
    const bilderZeile = (await panel.getByTestId("klara-bild-kontext-bilder").textContent()) ?? "";
    protokoll.berichtigung = {
      feldVorher,
      roh,
      berichtigtAufLagfr,
      ergaenzt,
      belege,
      modellAntwort,
    };
    protokoll.zusammenfassung = { bilderZeile };

    // ---------------------------------------------------------------- K6: Neuladen, erneut einlesen
    await page.reload();
    await einlesen(page, DECK, original);
    const nachNeuladen = await text(page, 0);
    const amServer = await korrekturenAmServer(page);
    protokoll.neuladen = { nachNeuladen, amServer };

    // ---------------------------------------------------------------- K8: verändert, andere Datei
    await einlesen(page, DECK, veraendert);
    const veraendertText = await text(page, 0);
    const veraendertHinweis = await zeile(page, 0)
      .getByTestId("bild-berichtigung-andere-fassung")
      .count();
    const veraendertBerichtigt = await zeile(page, 0)
      .getByTestId("bild-berichtigung")
      .getAttribute("data-berichtigt");
    await einlesen(page, "andere-lagerliste-ocr-e.pptx", original);
    const andereDatei = await text(page, 0);
    protokoll.uebertragung = {
      veraendertText,
      veraendertHinweis,
      veraendertBerichtigt,
      andereDatei,
    };

    // ---------------------------------------------------------------- K9: Konten und Rollen
    const expertin = await anmelden(browser, await fiktivesKonto(page, "experte"));
    await einlesen(expertin, DECK, original);
    const expertinText = await text(expertin, 0);
    const expertinDarf = await zeile(expertin, 0)
      .getByTestId("bild-berichtigung-bearbeiten")
      .count();
    await expertin.context().close();
    const betrachter = await anmelden(browser, await fiktivesKonto(page, "viewer"));
    const betrachterStand = await korrekturenAmServer(betrachter);
    const betrachterSchreiben = await betrachter.request.put(KORREKTUREN, {
      data: {
        aktion: "setzen",
        quelle: `datei:${DECK}`,
        inhaltskennung: amServer.korrekturen[0]?.inhaltskennung ?? `sha256:${"0".repeat(64)}`,
        text: "Versuch",
      },
    });
    const betrachterNachher = await korrekturenAmServer(betrachter);
    await betrachter.context().close();
    protokoll.rollen = {
      expertinText,
      expertinDarf,
      betrachterStand,
      betrachterSchreiben: betrachterSchreiben.status(),
      betrachterNachher,
    };

    // ---------------------------------------------------------------- K7: zurücksetzen
    await einlesen(page, DECK, original);
    await zeile(page, 0).getByTestId("bild-berichtigung-zuruecksetzen").click();
    await expect(zeile(page, 0).getByTestId("bild-berichtigung")).toHaveAttribute(
      "data-berichtigt",
      "false",
    );
    const zurueck = await text(page, 0);
    const nachRuecksetzen = await korrekturenAmServer(page);
    await stelle(page, 0, "4711").click();
    const originalSrc = (await page.getByTestId("bild-fundstelle-bild").getAttribute("src")) ?? "";
    await schliessen(page);
    protokoll.zuruecksetzen = { zurueck, nachRuecksetzen };

    await test.info().attach("ocr-e01-e02-fundstellen-korrekturen.json", {
      contentType: "application/json",
      body: JSON.stringify(protokoll, null, 2),
    });

    // ------------------------------------------------------------------------ Zusicherungen
    // K1/K2: Name, Datum, Zahl — richtiges Bild (Bytes der Folie) und Markierung auf dem Wort.
    for (const f of [name, datum, zahl1, zahl2]) {
      expect(f.art).toBe("bereich");
      expect(f.gleichesBild).toBe(true);
      expect(f.liegtAuf, JSON.stringify(f)).toBe(true);
    }
    // „4711“ auf Folie 1 und 2: verschiedene Bilder (Bytes oben), verschiedene Stellen im Bild.
    const r1 = relativ(zahl1);
    const r2 = relativ(zahl2);
    expect(Math.abs(r1.x - r2.x) + Math.abs(r1.y - r2.y)).toBeGreaterThan(0.1);
    expect(tastatur ?? "").toMatch(/4711/);
    // K3: gedreht und vergrößert.
    expect(gedreht).toBe(true);
    expect(groesser).toBe(true);
    // K5: berichtigt, unterscheidbar, an der Stelle des Fehlers; Klara trägt die Berichtigung.
    expect(feldVorher).toBe(rohFolie1);
    expect(roh).toBe(rohFolie1);
    expect(berichtigtAufLagfr).toBe(true);
    expect(belege[0]?.art).toBe("bild");
    expect(belege[0]?.text).toContain(`${DECK} · Folie 1, Bild 1`);
    expect(belege[0]?.text).toContain("LAGER 4711 GEPRUEFT");
    expect(belege.map((b) => b.text).join(" ")).not.toMatch(/LAGFR/);
    expect(bilderZeile).toContain(`${DECK} · Folie 1, Bild 1`);
    // K4: ergänztes Wort ohne Position.
    expect(ergaenzt).toMatchObject({
      art: "ohne-position",
      grund: "ohne-zuordnung",
      markierungen: 0,
      bildSichtbar: true,
    });
    // K6: Neuladen und erneutes Einlesen behalten die Berichtigung.
    expect(nachNeuladen).toBe("LAGER 4711 GEPRUEFT");
    expect(amServer.korrekturen.map((k) => [k.quelle, k.text])).toEqual([
      [`datei:${DECK}`, "LAGER 4711 GEPRUEFT"],
    ]);
    // K8: keine Übertragung auf die veränderte Folie oder eine andere Datei.
    expect(veraendertText).not.toBe("LAGER 4711 GEPRUEFT");
    expect(veraendertHinweis).toBe(1);
    expect(veraendertBerichtigt).toBe("false");
    expect(andereDatei).toBe(rohFolie1);
    // K9: ein anderes Konto sieht die Berichtigung nicht (darf aber selbst berichtigen); ein
    // Betrachter darf nicht berichtigen.
    expect(expertinText).toBe(rohFolie1);
    expect(expertinDarf).toBe(1);
    expect(betrachterStand).toEqual({ darfBearbeiten: false, korrekturen: [] });
    expect(betrachterSchreiben.status()).toBe(403);
    expect(betrachterNachher).toEqual({ darfBearbeiten: false, korrekturen: [] });
    // K7: zurückgesetzt — Rohbefund zurück, nichts mehr gespeichert, Original unverändert.
    expect(zurueck).toBe(rohFolie1);
    expect(nachRuecksetzen.korrekturen).toEqual([]);
    expect(originalSrc.split(",")[1]).toBe(f1.png.toString("base64"));
  } finally {
    // Aufräumen: keine Berichtigung des Prüfkontos bleibt stehen.
    const rest = await korrekturenAmServer(page).catch(() => null);
    for (const k of rest?.korrekturen ?? []) {
      await page.request
        .put(KORREKTUREN, {
          data: { aktion: "zuruecksetzen", quelle: k.quelle, inhaltskennung: k.inhaltskennung },
        })
        .catch(() => undefined);
    }
  }
});
