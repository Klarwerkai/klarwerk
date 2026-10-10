import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ARBEITSWEGE AM SELBEN ARTIKEL (produkt:20261007:arbeitswege-objekt) — DER WEG IM ECHTEN BROWSER.
// ================================================================================================
//
// Geklickt wird gegen den echten Smoke-Server (gebautes Bündel, echte Routen, echter Bestand):
//   K1 · Zwei Beiträge einreichen, dann „Validierung öffnen" am EIGENEN: die Prüfung zeigt genau
//        ihn — auch nach dem Neuladen —, obwohl ein anderer Beitrag in derselben Liste steht.
//   K2 · Rückfrage am eigenen Beitrag: die Zeile „Entschieden" nennt ihn mit dem Stand, den die
//        nächste Serverantwort meldet; die Auswahl wechselt sichtbar, und der Weg zum eigenen
//        Beitrag führt in seine Lesefläche.
//   K3/K5 · „Fragen" aus der Lesefläche: Kennung und Fassung stehen in Fragen und bei Klara —
//        nach Neuladen, über den Rückweg und nach Zurücknavigation dieselben.
//   K4 · Die Kopfband-Suche zeigt die Suche, die in der Bibliothek wirklich gilt; die Seitensuche
//        (⌘K) ist ein eigenes Feld.
//
// DIESE DATEI LEGT BESTAND AN und läuft deshalb ausschliesslich im isolierten Kontext
// `chromium-zustand` (`playwright.smoke.config.ts`, `ZUSTAND_SPEC`) — der geteilte Server, dessen
// Prüf-Board `ui-smoke` leer erwartet, bleibt unberührt. Jeder Lauf trägt eine frische Marke.
//
// WAS NICHT GEMESSEN IST: eine ZWEITE Person. Der Smoke kennt genau ein Konto (Admin, Autor
// beider Beiträge); die Rückfrage einer fremden Prüferin ist hier nicht nachgestellt.

const VORDERTUER = "/capture/frontdoor";
const EDITOR = '[data-testid="blatt-text"] [contenteditable="true"]';
const KARTENTITEL = '[data-testid="pruefen-karte"] [data-text="titel"]';
const EINTRAG = '[data-testid="pruefen-warteschlange-eintrag"]';

/** Sichtbare Beschriftungen — wörtlich aus `apps/web/src/woerterbuch/de.ts`. */
const T = {
  einreichen: "Einreichen", // erfassen.einreichen
  eingereicht: "Eingereicht:", // erfassen.eingereicht
  validierungOeffnen: "Validierung öffnen", // fd.openValidation
  intern: "Öffentlich-intern", // conf.level.intern
  absenden: "Absenden", // val.feedback.submit
} as const;

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

interface Eingereicht {
  id: string;
  titel: string;
  pruefweg: string;
}

async function einreichen(page: Page, titel: string, text: string): Promise<Eingereicht> {
  await page.goto(VORDERTUER);
  const editor = page.locator(EDITOR);
  await expect(editor, "das Blatt hat keine Schreibfläche").toBeVisible({ timeout: 15_000 });
  await page.getByTestId("blatt-titel").fill(titel);
  await editor.fill(text);
  await page.getByTestId("blatt-werkzeug-vertraulichkeit").click();
  await page.getByRole("menuitem", { name: T.intern }).click();
  await page.getByRole("button", { name: T.einreichen, exact: true }).click();

  const lage = page.getByTestId("blatt-lage");
  await expect(lage).toContainText(T.eingereicht, { timeout: 20_000 });
  const objekt = await lage.getByRole("link").first().getAttribute("href");
  const id = decodeURIComponent((objekt ?? "").replace(/^\/wissen\//, ""));
  expect(id, "die Erfolgszeile nennt keine Kennung").not.toBe("");
  const pruefweg =
    (await lage.getByRole("link", { name: T.validierungOeffnen }).getAttribute("href")) ?? "";
  return { id, titel, pruefweg };
}

function abfrage(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

async function zweiBeitraege(page: Page): Promise<Eingereicht> {
  const m = marke();
  await einreichen(
    page,
    `A Fremder Beitrag ${m}`,
    `Fremdprobe ${m}: Vor dem Anfahren der Linie L2 den Druck am Ventil V7 prüfen.`,
  );
  return einreichen(
    page,
    `Z Eigener Beitrag ${m}`,
    `Eigenprobe ${m}: Beim Schichtwechsel an Linie L4 den Dosierwert erst nach zehn Minuten anpassen.`,
  );
}

test.describe("Arbeitswege am selben Artikel · der Weg in der echten App", () => {
  test("K1 · Einreichen öffnet die Prüfung genau dieses Beitrags — auch nach Neuladen", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const eigen = await zweiBeitraege(page);

    // Der Weg selbst nennt den Beitrag — vor dem Klick, am Link.
    expect(new URLSearchParams(eigen.pruefweg.split("?")[1] ?? "").get("ko")).toBe(eigen.id);

    await page.getByTestId("blatt-lage").getByRole("link", { name: T.validierungOeffnen }).click();
    await expect(page.locator(KARTENTITEL)).toHaveText(eigen.titel, { timeout: 20_000 });
    await expect(page.locator(`${EINTRAG}[aria-current="true"]`)).toHaveText(eigen.titel);
    // Der andere Beitrag steht in DERSELBEN Liste — gezeigt wird trotzdem der eigene.
    await expect(page.locator(EINTRAG).filter({ hasText: "A Fremder Beitrag" })).not.toHaveCount(0);
    test.info().annotations.push({
      type: "erster Listeneintrag",
      description: (await page.locator(EINTRAG).first().textContent()) ?? "(keiner)",
    });
    expect(abfrage(page).get("ko")).toBe(eigen.id);
    await expect.poll(() => abfrage(page).get("fassung")).toMatch(/^\d+$/);
    await test.info().attach("pruefen-eigener-beitrag", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await page.reload();
    await expect(page.locator(KARTENTITEL)).toHaveText(eigen.titel, { timeout: 20_000 });
    expect(abfrage(page).get("ko")).toBe(eigen.id);
  });

  test("K2 · nach der Rückfrage: eigener Beitrag mit Serverstand erreichbar, Wechsel benannt", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await ensureLoggedIn(page);
    const eigen = await zweiBeitraege(page);
    await page.goto(eigen.pruefweg);
    await expect(page.locator(KARTENTITEL)).toHaveText(eigen.titel, { timeout: 20_000 });

    // Die Hintergrundprüfung sperrt die Entscheidung, solange sie läuft (`validationAiGate`).
    const rueckfrage = page.getByTestId("pruefen-entscheidung-warn");
    await expect(rueckfrage).toBeEnabled({ timeout: 90_000 });
    await rueckfrage.click();
    const begruendung = page.getByTestId("pruefen-begruendung");
    await begruendung.locator("textarea").fill("Bitte die Messstelle an Linie L4 ergänzen.");
    await begruendung.getByRole("button", { name: T.absenden, exact: true }).click();

    const zeile = page.getByTestId("pruefen-entschieden");
    await expect(zeile).toHaveAttribute("data-ko", eigen.id, { timeout: 20_000 });
    await expect(zeile).toHaveAttribute("data-verdict", "warn");
    // Das tatsächliche Ergebnis: was die nächste Board-Antwort über den Beitrag sagt.
    await expect(zeile).toHaveAttribute("data-stand", /^(offen|raus)$/, { timeout: 20_000 });
    await expect(page.getByTestId("pruefen-entschieden-stand")).not.toHaveText("");

    // Der Wechsel ist nachvollziehbar: Adresse, Karte und Zeile nennen denselben nächsten Beitrag.
    await expect.poll(() => abfrage(page).get("ko")).not.toBe(eigen.id);
    const weiter = page.getByTestId("pruefen-entschieden-weiter");
    await expect(weiter).toHaveAttribute("data-ko", abfrage(page).get("ko") ?? "(keine)");
    await expect(page.locator(KARTENTITEL)).not.toHaveText(eigen.titel);
    await test.info().attach("pruefen-nach-rueckfrage", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Der eigene Beitrag bleibt erreichbar — in seiner Lesefläche.
    await page.getByTestId("pruefen-entschieden-oeffnen").click();
    await expect(page).toHaveURL(new RegExp(`/wissen/${encodeURIComponent(eigen.id)}`));
    await expect(page.getByTestId("bib-titel").first()).toContainText(eigen.titel, {
      timeout: 15_000,
    });
  });

  test("K3/K5 · Frage aus dem Artikel, Klara, Neuladen und Rückweg behalten Kennung und Fassung", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const eigen = await einreichen(
      page,
      `Fragebeitrag ${m}`,
      `Frageprobe ${m}: Die Pumpe P-12 wird alle vier Wochen auf Leckage geprüft.`,
    );

    await page.goto(`/wissen/${encodeURIComponent(eigen.id)}`);
    const fragen = page.getByTestId("bib-fragen");
    await expect(fragen).toBeVisible({ timeout: 15_000 });
    const ziel = new URLSearchParams(((await fragen.getAttribute("href")) ?? "").split("?")[1]);
    expect(ziel.get("ko")).toBe(eigen.id);
    const fassung = ziel.get("fassung") ?? "";
    expect(fassung, "der Fragen-Weg nennt keine Fassung").toMatch(/^\d+$/);

    const klaraKnopf = page.locator("button[data-klara='1']");
    const klara = page.getByTestId("klara-objektbezug");
    const klaraPruefen = async (seite: string): Promise<void> => {
      if (!(await klara.isVisible())) {
        await klaraKnopf.click();
      }
      await expect(klara).toHaveAttribute("data-seite", seite);
      await expect(klara).toHaveAttribute("data-ko", eigen.id);
      await expect(klara).toHaveAttribute("data-fassung", fassung);
    };

    // In der Lesefläche: Klara nennt Kennung und gelesene Fassung.
    await klaraPruefen("lesen");
    await klaraKnopf.click();

    // Frage aus dem Artikel.
    await fragen.click();
    await expect(page).toHaveURL(/\/fragen\?/);
    const zeile = page.getByTestId("objektbezug-zeile");
    await expect(zeile).toHaveAttribute("data-ko", eigen.id, { timeout: 15_000 });
    await expect(zeile).toHaveAttribute("data-fassung", fassung);
    await expect(zeile).toContainText(eigen.titel);
    await klaraPruefen("fragen");
    await test.info().attach("fragen-mit-objektbezug", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Neuladen: derselbe Bezug.
    await page.reload();
    await expect(zeile).toHaveAttribute("data-ko", eigen.id, { timeout: 15_000 });
    await expect(zeile).toHaveAttribute("data-fassung", fassung);
    await klaraPruefen("fragen");

    // Rückweg in den Artikel: dieselbe Kennung, dieselbe Fassung.
    await page.getByTestId("objektbezug-zurueck").click();
    await expect(page).toHaveURL(
      new RegExp(`/wissen/${encodeURIComponent(eigen.id)}\\?fassung=${fassung}$`),
    );
    await klaraPruefen("lesen");
    await expect(page.getByTestId("objektbezug-fassung-abweichend")).toHaveCount(0);

    // Zurücknavigation: wieder die Frage, wieder derselbe Bezug.
    await page.goBack();
    await expect(zeile).toHaveAttribute("data-ko", eigen.id, { timeout: 15_000 });
    await expect(zeile).toHaveAttribute("data-fassung", fassung);
    await klaraPruefen("fragen");
  });

  test("K4 · Kopfband-Suche zeigt die geltende Bibliothekssuche, Seitensuche bleibt getrennt", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const kopf = page.getByTestId("kopfband-wissen-suchen");
    await kopf.fill(`Pumpe ${m}`);
    await kopf.press("Enter");
    await expect(page).toHaveURL(/\/bibliothek\?/);
    const bib = page.getByTestId("bib-suche");
    await expect(bib).toHaveValue(`Pumpe ${m}`, { timeout: 15_000 });
    await expect(kopf).toHaveValue(`Pumpe ${m}`);

    // In der Bibliothek weitersuchen: oben steht danach DIESE Suche, nicht mehr die alte.
    await bib.fill(`Ventil ${m}`);
    await expect.poll(() => abfrage(page).get("q"), { timeout: 10_000 }).toBe(`Ventil ${m}`);
    await expect(kopf).toHaveValue(`Ventil ${m}`);

    // Die Seitensuche ist ein eigenes Feld und übernimmt den Suchtext nicht.
    // Über das Tastenkürzel, nicht den Knopf: der Knopf „Seite finden" tritt in der breiten
    // Bauform bei enger Zeile bewusst zurück (FE-002, `index.css`) und ist bei 1280 px unsichtbar
    // — gemessen im Prüflauf nacharbeit-2. Strg+K ist der eigentliche Weg (`CommandPalette.tsx`).
    await page.keyboard.press("Control+k");
    // Der sprachfreie Griff der Palette (`CommandPalette.tsx`, `data-cmd="suchfeld"`).
    const seitensuche = page.locator('[data-cmd="suchfeld"]');
    await expect(seitensuche).toBeVisible();
    await expect(seitensuche).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(kopf).toHaveValue(`Ventil ${m}`);
    await expect(bib).toHaveValue(`Ventil ${m}`);
  });
});
