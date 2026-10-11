import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// FIRMENWÖRTERBUCH IN DER ECHTEN APP — Pflege, Neuladen, Hinweis im Editor, Übernehmen, Verwerfen.
// ================================================================================================
//
// Geklickt wird der ganze Weg im echten Browser gegen den echten Smoke-Server:
//   K1 · Begriff mit Definition, DE/EN, Geltungsbereich, Synonym und unerwünschter Variante auf
//        `/begriffe` anlegen — nach dem Neuladen steht genau diese Fassung da.
//   K2 · Im Blatt (`/capture/frontdoor`) erscheint zur unerwünschten Variante der Hinweis mit
//        Vorzugsbezeichnung, Bedeutung und Herkunft (Geltungsbereich, Fassung).
//   K4 · „Übernehmen" ersetzt GENAU die fett gesetzte Stelle — sie bleibt fett, der übrige Text
//        bleibt; „Verwerfen" lässt den Text unverändert.
//
// JEDER LAUF HAT SEINEN EIGENEN BEGRIFF: Der Smoke-Server hält seinen Bestand im Speicher über alle
// Fälle und Wiederholungen. Die Benennungen tragen deshalb eine frische Buchstabenmarke — ein
// zweiter Lauf fände sonst die Einträge des ersten.
//
// WAS NICHT GEMESSEN IST: Word. Der Word-Weg läuft in `tests/firmenwoerterbuch/word-begriffe.test.tsx`
// gegen eine Office.js-Attrappe; ein echter Word-Host steht dem Smoke nicht zur Verfügung.

const VORDERTUER = "/capture/frontdoor";
const EDITOR = '[data-testid="blatt-text"] [contenteditable="true"]';

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

interface Begriff {
  bereich: string;
  vorzug: string;
  synonym: string;
  unerwuenscht: string;
  definition: string;
  vorzugEn: string;
  unerwuenschtEn: string;
}

function frischerBegriff(): Begriff {
  const m = marke();
  return {
    bereich: `Vertrieb ${m}`,
    vorzug: `Kundenkonto${m}`,
    synonym: `Debitorenkonto${m}`,
    unerwuenscht: `Altkonto${m}`,
    definition: `Das Konto eines Kunden im Abrechnungssystem (${m}).`,
    vorzugEn: `customer account ${m}`,
    unerwuenschtEn: `client account ${m}`,
  };
}

async function begriffAnlegen(page: Page, b: Begriff): Promise<void> {
  await page.goto("/begriffe");
  await expect(page.getByTestId("page-begriffe")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("begriff-neu").click();
  await page.getByTestId("begriff-geltungsbereich").fill(b.bereich);
  await page.getByTestId("begriff-verantwortlich").fill("Smoke Vertriebsinnendienst");
  await page.getByTestId("begriff-de-vorzug").fill(b.vorzug);
  await page.getByTestId("begriff-de-definition").fill(b.definition);
  await page.getByTestId("begriff-de-synonyme").fill(b.synonym);
  await page.getByTestId("begriff-de-unerwuenscht").fill(b.unerwuenscht);
  await page.getByTestId("begriff-en-vorzug").fill(b.vorzugEn);
  await page.getByTestId("begriff-en-definition").fill("A customer's account in billing.");
  await page.getByTestId("begriff-en-unerwuenscht").fill(b.unerwuenschtEn);
  await page.getByTestId("begriff-speichern").click();
  await expect(page.getByTestId("begriff-pflege")).toHaveCount(0, { timeout: 15_000 });
}

function eintrag(page: Page, b: Begriff) {
  return page.getByTestId("begriff-eintrag").filter({ hasText: b.vorzug });
}

test.describe("Firmenwörterbuch · der Weg in der echten App", () => {
  test("K1: anlegen, neu laden — die konkrete Fassung steht vollständig da", async ({ page }) => {
    await ensureLoggedIn(page);
    const b = frischerBegriff();
    await begriffAnlegen(page, b);
    await expect(eintrag(page, b)).toHaveCount(1);

    await page.reload();
    await expect(page.getByTestId("page-begriffe")).toBeVisible({ timeout: 15_000 });
    const karte = eintrag(page, b);
    await expect(karte, "der Begriff hat das Neuladen nicht überlebt").toHaveCount(1, {
      timeout: 15_000,
    });
    for (const text of [
      b.vorzug,
      b.definition,
      b.synonym,
      b.unerwuenscht,
      b.vorzugEn,
      b.unerwuenschtEn,
      b.bereich,
      "Smoke Vertriebsinnendienst",
      "Fassung 1",
    ]) {
      await expect(karte, `„${text}“ fehlt nach dem Neuladen`).toContainText(text);
    }
    // Die Fassungsliste nennt genau eine Fassung.
    await karte.getByTestId("begriff-verlauf-knopf").click();
    await expect(karte.getByTestId("begriff-fassung")).toHaveCount(1);
  });

  test("K2/K4: Hinweis im Editor — Übernehmen an der fetten Stelle, Verwerfen an der anderen", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const b = frischerBegriff();
    await begriffAnlegen(page, b);

    await page.goto(VORDERTUER);
    const editor = page.locator(EDITOR);
    await expect(editor, "das Blatt hat keine Schreibfläche").toBeVisible({ timeout: 15_000 });
    await editor.click();
    await page.keyboard.type("Im ");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type(b.unerwuenscht);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type(` steht der Saldo; das ${b.unerwuenscht} bleibt offen.`);
    // Die fett gesetzte Stelle ist WIRKLICH fett — sonst sagte der Fall unten nichts.
    await expect(editor.locator("strong, b")).toHaveText(b.unerwuenscht);

    const hinweise = page.getByTestId("begriffshinweis");
    await expect(hinweise, "kein Begriffshinweis im Editor").toHaveCount(2, { timeout: 15_000 });
    const erster = hinweise.first();
    await expect(erster).toContainText(b.unerwuenscht);
    await expect(erster).toContainText(b.vorzug);
    await expect(erster).toContainText(b.definition);
    await expect(erster).toContainText(b.bereich);
    await expect(page.getByTestId("begriffshinweise")).toContainText("nicht, ob die Aussage");

    // Übernehmen an der ERSTEN (fetten) Stelle.
    await erster.getByTestId("begriffshinweis-uebernehmen").click();
    await expect(editor.locator("strong, b")).toHaveText(b.vorzug, { timeout: 15_000 });
    await expect(editor).toContainText(`Im ${b.vorzug} steht der Saldo; das ${b.unerwuenscht}`);

    // Der zweite Hinweis kommt nach der Neuprüfung wieder — Verwerfen lässt den Text stehen.
    await expect(hinweise).toHaveCount(1, { timeout: 15_000 });
    const vorher = await editor.innerHTML();
    await hinweise.first().getByTestId("begriffshinweis-verwerfen").click();
    await expect(page.getByTestId("begriffshinweise")).toHaveCount(0);
    expect(await editor.innerHTML()).toBe(vorher);
    await expect(editor).toContainText(`das ${b.unerwuenscht} bleibt offen.`);
  });
});
