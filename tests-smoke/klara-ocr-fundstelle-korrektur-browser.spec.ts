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
  docxMit,
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
  // Nacharbeit 2 (Bens Befund): ein ANDERES Dokument mit demselben Namen und demselben Bild auf
  // Folie 1 — nur der Folientext unterscheidet sich.
  const gleichnamigAnders = deckMit([
    { titel: "Andere Lagerliste", png: f1.png },
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
    await einlesen(page, DECK, gleichnamigAnders);
    const gleichnamigText = await text(page, 0);
    const gleichnamigBerichtigt = await zeile(page, 0)
      .getByTestId("bild-berichtigung")
      .getAttribute("data-berichtigt");
    protokoll.uebertragung = {
      veraendertText,
      veraendertHinweis,
      veraendertBerichtigt,
      andereDatei,
      gleichnamigText,
      gleichnamigBerichtigt,
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
        quelle: amServer.korrekturen[0]?.quelle ?? `datei:${DECK}`,
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
    // Die Quelle ist die Datei selbst (Inhalt und Name), nicht nur ihr Name.
    expect(amServer.korrekturen.map((k) => k.text)).toEqual(["LAGER 4711 GEPRUEFT"]);
    expect(amServer.korrekturen[0]?.quelle).toMatch(
      /^datei:sha256:[0-9a-f]{64}\|fiktive-lagerliste-ocr-e\.pptx$/,
    );
    // K8: keine Übertragung auf die veränderte Folie, eine andere Datei oder ein anderes Dokument
    // gleichen Namens mit demselben Bild.
    expect(veraendertText).not.toBe("LAGER 4711 GEPRUEFT");
    expect(veraendertHinweis).toBe(1);
    expect(veraendertBerichtigt).toBe("false");
    expect(andereDatei).toBe(rohFolie1);
    expect(gleichnamigText).toBe(rohFolie1);
    expect(gleichnamigBerichtigt).toBe("false");
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

// ================================================================================================
// Nacharbeit 2 (Bens Befund K5) · DIE TATSÄCHLICHE ANTWORT UND ZUSAMMENFASSUNG MIT DER BERICHTIGUNG.
// ================================================================================================
//
// Derselbe vorhandene Modellprüfweg wie `klara-bild-kontext-browser.spec.ts` (@modell, nur im
// VOLLEN Smoke; Zugang ausschliesslich über die Betreiber-Einspeisung): ein fiktiver, „intern“
// eingestufter Entwurf mit einem Bild, das ABSICHTLICH falsch beschriftet ist („LAGFR 4711“). Im
// Editor wird „LAGFR“ zu „LAGER“ berichtigt; danach müssen die formulierte Antwort UND die
// Zusammenfassung des Modells die Berichtigung tragen und dürfen den Fehler nicht enthalten. Fehlt
// ein nutzbares Modell oder ist eine Antwort leer, ist der Fall ROT — er wird nie übersprungen.

interface Zuordnung {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

async function zuordnungLesen(admin: Page): Promise<Zuordnung> {
  const antwort = await admin.request.get("/api/reasoner/config");
  expect(antwort.status(), await antwort.text()).toBe(200);
  return ((await antwort.json()) as { taskConfig: Zuordnung }).taskConfig;
}

async function freigabeSetzen(
  admin: Page,
  basis: Zuordnung,
  kiFreigabe: { oeffentlicheKi: boolean; vertraulicheInhalte: boolean },
): Promise<void> {
  const antwort = await admin.request.put("/api/reasoner/config", {
    data: { global: basis.global, perTask: basis.perTask, kiFreigabe },
  });
  expect(antwort.status(), await antwort.text()).toBe(200);
}

const RUMPF = "[data-testid=rumpf-bild-befunde]";

test("OCR-E02 · Klara antwortet und fasst zusammen mit dem berichtigten Bildtext @modell", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  const vorher = await zuordnungLesen(page);
  await freigabeSetzen(page, vorher, { oeffentlicheKi: true, vertraulicheInhalte: false });
  let entwurfId: string | null = null;
  const protokoll: Record<string, unknown> = {
    art: "Modelllauf mit fiktiven Daten — keine Kundenabnahme",
  };
  try {
    const statusAntwort = await page.request.get("/api/reasoner/status");
    const status = (await statusAntwort.json()) as {
      active?: boolean;
      reachable?: string;
      kiAbgeschaltet?: boolean;
      extern?: string;
      tasks?: { assist?: boolean };
    };
    protokoll.modellstatus = status;
    expect(status.extern, "die Grundfreigabe ist nicht wirksam").toBe("frei");
    expect(
      status.active === true &&
        status.tasks?.assist === true &&
        status.kiAbgeschaltet !== true &&
        status.reachable !== "unreachable",
      `Kein nutzbares Modell für „assist“ (Status ${JSON.stringify(status)}).`,
    ).toBe(true);

    await page.goto("/");
    const bild = await zeichneBild(page, 1200, 260, [{ text: "LAGFR 4711", x: 60, y: 160 }]);
    const bodyHtml = [
      "<h2>Lagerliste</h2>",
      "<p>Die Bestände werden jede Woche gezählt.</p>",
      `<figure><img src="data:image/png;base64,${bild.png.toString("base64")}"></figure>`,
    ].join("");
    const angelegt = await page.request.post("/api/drafts", {
      data: {
        title: "Fiktive Lagerliste OCR-E02",
        statement: "Fiktiver Entwurf für die Berichtigungsprobe.",
        type: "best_practice",
        category: "Lager 1",
        confidentiality: "intern",
        bodyHtml,
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    entwurfId = ((await angelegt.json()) as { id: string }).id;

    await page.goto(`/capture/frontdoor?draft=${entwurfId}`);
    await expect
      .poll(
        async () =>
          (await page.evaluate(
            (auswahl) => document.querySelector(auswahl)?.getAttribute("data-status") ?? null,
            `${RUMPF} [data-testid=bild-befunde]`,
          )) ?? "wartet",
        { timeout: 240_000, intervals: [1_000] },
      )
      .not.toMatch(/^(wartet|laeuft)$/);
    const rumpf = page.locator(RUMPF).first();
    const zeileRumpf = rumpf.getByTestId("bild-befund").first();
    const roh = (await zeileRumpf.getByTestId("bild-befund-text").textContent()) ?? "";

    // Berichtigen: der absichtliche Fehler wird zu „LAGER“.
    await zeileRumpf.getByTestId("bild-berichtigung-bearbeiten").click();
    await zeileRumpf.getByTestId("bild-berichtigung-feld").fill("LAGER 4711");
    await zeileRumpf.getByTestId("bild-berichtigung-speichern").click();
    await expect(zeileRumpf.getByTestId("bild-befund-text")).toHaveText("LAGER 4711");

    const p = rumpf.getByTestId("klara-bild-kontext");
    const frageText = "Welches Wort und welche Nummer stehen auf dem Bild?";
    await p.getByTestId("klara-bild-kontext-frage").fill(frageText);
    await p.getByTestId("klara-bild-kontext-fragen").click();
    await expect(p.getByTestId("klara-bild-kontext-antwort")).toHaveAttribute(
      "data-auftrag",
      "frage",
      { timeout: 180_000 },
    );
    const ohneModell1 = await p.getByTestId("klara-bild-kontext-ohne-modell").count();
    const antwort = (await p.getByTestId("klara-bild-kontext-antworttext").count())
      ? ((await p.getByTestId("klara-bild-kontext-antworttext").textContent()) ?? "")
      : "";
    await p.getByTestId("klara-bild-kontext-zusammenfassen").click();
    await expect(p.getByTestId("klara-bild-kontext-antwort")).toHaveAttribute(
      "data-auftrag",
      "zusammenfassung",
      { timeout: 180_000 },
    );
    const ohneModell2 = await p.getByTestId("klara-bild-kontext-ohne-modell").count();
    const zusammenfassung = (await p.getByTestId("klara-bild-kontext-antworttext").count())
      ? ((await p.getByTestId("klara-bild-kontext-antworttext").textContent()) ?? "")
      : "";
    protokoll.ergebnis = { roh, antwort, zusammenfassung, ohneModell1, ohneModell2 };
    await test.info().attach("ocr-e02-klara-modell-berichtigung.json", {
      contentType: "application/json",
      body: JSON.stringify(protokoll, null, 2),
    });
    await test.info().attach("ocr-e02-klara-modell-berichtigung.png", {
      contentType: "image/png",
      body: await p.screenshot(),
    });

    // Keine fehlende, leere oder ersatzweise Antwort — und beide tragen die Berichtigung.
    expect(ohneModell1, "keine Modellantwort auf die Frage").toBe(0);
    expect(antwort.trim().length, "leere Antwort").toBeGreaterThan(0);
    expect(antwort).toMatch(/LAGER/i);
    expect(antwort).toMatch(/\b4711\b/);
    expect(antwort).not.toMatch(/LAGFR/i);
    expect(ohneModell2, "keine Modellzusammenfassung").toBe(0);
    expect(zusammenfassung.trim().length, "leere Zusammenfassung").toBeGreaterThan(0);
    expect(zusammenfassung).toMatch(/LAGER/i);
    expect(zusammenfassung).not.toMatch(/LAGFR/i);
  } finally {
    const rest = await korrekturenAmServer(page).catch(() => null);
    for (const k of rest?.korrekturen ?? []) {
      await page.request
        .put(KORREKTUREN, {
          data: { aktion: "zuruecksetzen", quelle: k.quelle, inhaltskennung: k.inhaltskennung },
        })
        .catch(() => undefined);
    }
    if (entwurfId) {
      await page.request.delete(`/api/drafts/${entwurfId}`).catch(() => undefined);
    }
    await freigabeSetzen(page, vorher, {
      oeffentlicheKi: vorher.kiFreigabe?.oeffentlicheKi === true,
      vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
    });
  }
});

// ================================================================================================
// Nacharbeit 4 (Bens Befund K12) · DIE E01/E02-NUTZERWEGE DER VERFÜGBAREN HOSTS.
// ================================================================================================
//
// H06 „Office im Artikel“: ein Artikel mit PowerPoint-Anhang über die echten Routen; die Bildbefunde
// der Anhangsfassung (OfficeBildBefunde) — Fundstelle, Berichtigung (gebunden an den Anhang),
// Neuladen, Klara. Im Prüfaufbau ist KEIN Office-Editor (Collabora/WOPI) eingerichtet
// (`office-artikel-browser.spec.ts`, „nicht eingerichtet“); dieser Weg braucht ihn nicht — der
// Editor selbst ist hier nicht Gegenstand.
//
// H02 „Klara in Word“: der Prüfaufbau hat KEINEN Word-Host (kein Word mit eingespieltem Add-in).
// Geprüft wird deshalb der Klarwerk-Teil desselben Wegs: genau die Anfrage, die das Add-in für das
// ganze Dokument schickt (`POST /api/drafts/from-docx`, Name + Base64 der .docx), dann der
// Entwurf über den Deep-Link des Add-ins (`/capture/frontdoor?draft=<id>`). Die Bedienung IN Word
// bleibt offen.

/** Wie `office-artikel-browser.spec.ts`: der einmalige Nutzungshinweis wird quittiert. */
async function nutzungshinweisQuittieren(page: Page): Promise<void> {
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible().catch(() => false)) {
    await weiter.click();
  }
}

/** Wartet, bis der Bildbefund unter `bereich` abgeschlossen ist. */
async function befundFertig(page: Page, bereich: string): Promise<void> {
  await expect
    .poll(
      async () =>
        (await page.evaluate(
          (auswahl) => document.querySelector(auswahl)?.getAttribute("data-status") ?? null,
          `${bereich} [data-testid=bild-befunde]`,
        )) ?? "wartet",
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  // Die gespeicherten Berichtigungen sind geladen.
  await expect(page.locator(`${bereich} [data-testid=bild-berichtigung-stand]`)).toHaveCount(0, {
    timeout: 20_000,
  });
}

/**
 * Klickt die Stelle `wort` in `zeile` und misst Bild und Markierung der Ansicht. `imBild` ist das
 * Wort, wie es GEZEICHNET wurde — nach einer Berichtigung („LAGER“) liegt die Markierung auf dem
 * ursprünglich erkannten Wort („LAGFR“).
 */
async function fundstelleIn(
  page: Page,
  zeileL: Locator,
  wort: string,
  b: GezeichnetesBild,
  imBild: string = wort,
) {
  const sicher = wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await zeileL
    .getByTestId("bild-befund-stelle")
    .filter({ hasText: new RegExp(`^${sicher}$`, "i") })
    .first()
    .click();
  await expect(page.getByTestId("bild-fundstelle-ansicht")).toBeVisible();
  const src = (await page.getByTestId("bild-fundstelle-bild").getAttribute("src")) ?? "";
  const bild = await rechteck(page.getByTestId("bild-fundstelle-bild"));
  const markierung = await rechteck(page.getByTestId("bild-fundstelle-markierung"));
  const ergebnis = {
    gleichesBild: src.split(",")[1] === b.png.toString("base64"),
    liegtAuf: liegtAuf(markierung, soll(bild, b, gezeichnet(b, imBild), 0)),
  };
  await schliessen(page);
  return ergebnis;
}

async function berichtigeIn(zeileL: Locator, text: string): Promise<void> {
  await zeileL.getByTestId("bild-berichtigung-bearbeiten").click();
  await zeileL.getByTestId("bild-berichtigung-feld").fill(text);
  await zeileL.getByTestId("bild-berichtigung-speichern").click();
  await expect(zeileL.getByTestId("bild-befund-text")).toHaveText(text);
}

async function aufraeumen(page: Page): Promise<void> {
  const rest = await korrekturenAmServer(page).catch(() => null);
  for (const k of rest?.korrekturen ?? []) {
    await page.request
      .put(KORREKTUREN, {
        data: { aktion: "zuruecksetzen", quelle: k.quelle, inhaltskennung: k.inhaltskennung },
      })
      .catch(() => undefined);
  }
}

test("OCR-E01/E02 · H06 Office im Artikel · Fundstelle und Berichtigung am PowerPoint-Anhang", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/");
  const bild = await zeichneBild(page, 1200, 260, [{ text: "LAGFR 4711", x: 60, y: 160 }]);
  const name = `lagerliste-h06-${marke()}.pptx`;
  const protokoll: Record<string, unknown> = {
    art: "Fiktiver Artikel mit PowerPoint-Anhang; Office-Editor im Prüfaufbau nicht eingerichtet",
  };
  try {
    const ko = await page.request.post("/api/kos", {
      data: {
        title: `Fiktive Lagerliste H06 ${marke()}`,
        statement: "Fiktiver Artikel für die Bildbefunde eines Office-Anhangs.",
        type: "best_practice",
        category: "Lager",
        confidentiality: "intern",
      },
    });
    expect(ko.ok(), await ko.text()).toBe(true);
    const { id: koId } = (await ko.json()) as { id: string };
    const deck = deckMit([{ titel: "Lagerliste", png: bild.png }]);
    const objekt = await page.request.post("/api/objects", {
      data: {
        name,
        mime: PPTX_TYP,
        data: `data:${PPTX_TYP};base64,${deck.toString("base64")}`,
        purpose: "attachment",
      },
    });
    expect(objekt.ok(), await objekt.text()).toBe(true);
    const { id: objectId } = (await objekt.json()) as { id: string };
    const angehaengt = await page.request.put(`/api/kos/${koId}`, {
      data: { action: "attach", attachment: { name, mime: PPTX_TYP, objectId } },
    });
    expect(angehaengt.ok(), await angehaengt.text()).toBe(true);
    const stand = (await angehaengt.json()) as { attachments?: { id: string }[] };
    const anhangId = stand.attachments?.at(-1)?.id ?? "";
    expect(anhangId).not.toBe("");

    const bereich = `[data-office-bild-befund="${anhangId}"]`;
    const oeffnen = async (): Promise<void> => {
      await page.goto(`/wissen/${koId}`);
      await expect(page.getByTestId("bib-titel")).toBeVisible({ timeout: 15_000 });
      await nutzungshinweisQuittieren(page);
      await page.getByTestId("bib-mehr").click();
      await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
      await befundFertig(page, bereich);
    };
    await oeffnen();
    const zeileL = page.locator(bereich).getByTestId("bild-befund").first();
    const roh = (await zeileL.getByTestId("bild-befund-text").textContent()) ?? "";
    const zahl = await fundstelleIn(page, zeileL, "4711", bild);
    await berichtigeIn(zeileL, "LAGER 4711");
    const amServer = await korrekturenAmServer(page);

    // Neuladen: der Artikel neu geöffnet, die Fassung erneut gelesen — die Berichtigung bleibt.
    await page.reload();
    await oeffnen();
    const nachNeuladen = (await zeileL.getByTestId("bild-befund-text").textContent()) ?? "";
    const berichtigtStelle = await fundstelleIn(page, zeileL, "LAGER", bild, "LAGFR");

    // Klara zu diesem Anhang: die Fundstelle der Frage trägt die Berichtigung.
    const panel = page.locator(bereich).getByTestId("klara-bild-kontext");
    await panel.getByTestId("klara-bild-kontext-frage").fill("Welche Nummer hat das LAGER?");
    await panel.getByTestId("klara-bild-kontext-fragen").click();
    await expect(panel.getByTestId("klara-bild-kontext-antwort")).toHaveAttribute(
      "data-auftrag",
      "frage",
      { timeout: 120_000 },
    );
    const belege = await panel
      .getByTestId("klara-bild-kontext-beleg")
      .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
    Object.assign(protokoll, { roh, zahl, amServer, nachNeuladen, berichtigtStelle, belege });
    await test.info().attach("ocr-e01-e02-h06-office-im-artikel.json", {
      contentType: "application/json",
      body: JSON.stringify(protokoll, null, 2),
    });

    expect(zahl).toEqual({ gleichesBild: true, liegtAuf: true });
    expect(amServer.korrekturen.map((k) => [k.quelle, k.text])).toEqual([
      [`office:${anhangId}`, "LAGER 4711"],
    ]);
    expect(nachNeuladen).toBe("LAGER 4711");
    expect(berichtigtStelle).toEqual({ gleichesBild: true, liegtAuf: true });
    expect(belege.join(" ")).toContain("LAGER 4711");
    expect(belege.join(" ")).not.toMatch(/LAGFR/);
  } finally {
    await aufraeumen(page);
  }
});

test("OCR-E01/E02 · H02-Übernahmeweg (Word-Add-in-Route) · Fundstelle und Berichtigung im Entwurf", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/");
  const bild = await zeichneBild(page, 1200, 260, [{ text: "LAGFR 4711", x: 60, y: 160 }]);
  let entwurfId: string | null = null;
  try {
    // Genau die Nutzlast, die das Add-in für „Ganzes Dokument“ schickt (taskpane.js, sendeDocxDatei).
    const angelegt = await page.request.post("/api/drafts/from-docx", {
      data: {
        name: "Lagerliste aus Word.docx",
        data: docxMit("Lagerliste aus Word", bild.png).toString("base64"),
        confidentiality: "intern",
      },
    });
    expect(angelegt.ok(), await angelegt.text()).toBe(true);
    entwurfId = ((await angelegt.json()) as { id: string }).id;

    // Der Deep-Link des Add-ins.
    await page.goto(`/capture/frontdoor?draft=${entwurfId}`);
    await befundFertig(page, RUMPF);
    const zeileL = page.locator(RUMPF).first().getByTestId("bild-befund").first();
    const zahl = await fundstelleIn(page, zeileL, "4711", bild);
    await berichtigeIn(zeileL, "LAGER 4711");
    const amServer = await korrekturenAmServer(page);

    await page.reload();
    await befundFertig(page, RUMPF);
    const nachNeuladen = (await zeileL.getByTestId("bild-befund-text").textContent()) ?? "";
    await test.info().attach("ocr-e01-e02-h02-word-route.json", {
      contentType: "application/json",
      body: JSON.stringify(
        { art: "Word-Add-in-Route ohne Word-Host", zahl, amServer, nachNeuladen },
        null,
        2,
      ),
    });

    expect(zahl).toEqual({ gleichesBild: true, liegtAuf: true });
    expect(amServer.korrekturen.map((k) => [k.quelle, k.text])).toEqual([
      [`entwurf:${entwurfId}`, "LAGER 4711"],
    ]);
    expect(nachNeuladen).toBe("LAGER 4711");
  } finally {
    await aufraeumen(page);
    if (entwurfId) {
      await page.request.delete(`/api/drafts/${entwurfId}`).catch(() => undefined);
    }
  }
});
