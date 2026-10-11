import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// R-0347 · FRAGEN AN EIN HOCHGELADENES DOKUMENT — der Weg in der echten App.
// ================================================================================================
//
// Originalwortlaut: „Man lädt ein Dokument hoch und stellt Fragen dazu; die Antwort verknüpft die
// Inhalte und verweist auf die Fundstelle im Dokument." Geklickt wird im echten Browser gegen den
// echten Smoke-Server, mit den Lesern, die die App wirklich lädt (pdfjs mit Worker, mammoth):
//   · Einstieg von der Fragen-Seite, Dokument wählen, Frage stellen.
//   · Die Antwort verbindet zwei Stellen aus zwei Abschnitten; jede Marke springt zur Fundstelle
//     im gegliederten Dokument und hebt sie hervor.
//   · PDF (Seite) und Word (Absatz) mit den Referenzdateien aus `tests/fixtures/`.
//   · Steht es nicht im Dokument, gibt es keine Antwort, sondern die Lücke.
//   · Der Dokumenttext verlässt den Browser in KEINER Anfrage.
//
// Der Kern dahinter ist in `tests/dokumentfragen/fragen-an-ein-dokument.test.ts` gemessen.

const SEITE = "/fragen/dokument";
/** Kommt nur im Dokument vor — taucht es in einer Anfrage auf, hat der Text den Browser verlassen. */
const MARKE = "DOKUMENTFRAGE4711";

const HANDBUCH = [
  "# Wartung",
  "",
  `Vor jeder Wartung wird der Hauptschalter ausgeschaltet (${MARKE}).`,
  "",
  "Das Wartungsintervall beträgt 500 Betriebsstunden. Danach wird das Protokoll unterschrieben.",
  "",
  "# Filter",
  "",
  "Der Filter wird alle 200 Betriebsstunden gewechselt.",
  "",
].join("\n");

function fixture(name: string): string {
  return resolve(process.cwd(), "tests/fixtures", name);
}

async function oeffnen(page: Page): Promise<void> {
  await ensureLoggedIn(page);
  await page.goto("/fragen");
  const einstieg = page.getByTestId("ask-dokumentfragen-einstieg").getByRole("link");
  await expect(einstieg, "kein Einstieg von der Fragen-Seite").toBeVisible({ timeout: 15_000 });
  await einstieg.click();
  await expect(page).toHaveURL(new RegExp(`${SEITE}$`));
  await expect(page.getByTestId("page-dokumentfragen")).toBeVisible({ timeout: 15_000 });
}

async function fragen(page: Page, frage: string): Promise<void> {
  await page.getByTestId("dokumentfragen-frage").fill(frage);
  await page.getByTestId("dokumentfragen-senden").click();
  await expect(page.getByTestId("dokumentfragen-antwort")).toBeVisible();
}

test.describe("R-0347 · Fragen an ein hochgeladenes Dokument", () => {
  test("K1: hochladen, fragen — die Antwort verbindet zwei Stellen und springt zur Fundstelle", async ({
    page,
  }) => {
    const verraten: string[] = [];
    page.on("request", (anfrage) => {
      if (anfrage.url().includes(MARKE) || (anfrage.postData() ?? "").includes(MARKE)) {
        verraten.push(`${anfrage.method()} ${anfrage.url()}`);
      }
    });

    await oeffnen(page);
    await expect(page.getByTestId("dokumentfragen-datenschutz")).toBeVisible();
    await page.getByTestId("dokumentfragen-datei").setInputFiles({
      name: "handbuch.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(HANDBUCH, "utf8"),
    });
    await expect(page.getByTestId("dokumentfragen-geladen")).toContainText("handbuch.md");
    await expect(page.getByTestId("dokumentfragen-stelle")).toHaveCount(3);
    // Nach dem Einlesen steht der Fokus im Fragefeld.
    await expect(page.getByTestId("dokumentfragen-frage")).toBeFocused();

    await fragen(page, "Wann wird der Filter gewechselt und wann ist das Wartungsintervall?");
    const aussagen = page.getByTestId("dokumentfragen-aussage");
    await expect(aussagen).toHaveCount(2);
    await expect(aussagen.nth(0)).toHaveAttribute("data-fundstelle", "2");
    await expect(aussagen.nth(1)).toHaveAttribute("data-fundstelle", "3");
    await expect(aussagen.nth(0)).toContainText(
      "Das Wartungsintervall beträgt 500 Betriebsstunden.",
    );
    await expect(aussagen.nth(1)).toContainText(
      "Der Filter wird alle 200 Betriebsstunden gewechselt.",
    );
    await expect(page.getByTestId("dokumentfragen-etikett")).toBeVisible();

    // Die Marke nennt die Fundstelle — Abschnitt und Absatz, so wie im Dokument abzuzählen.
    const marke = aussagen.nth(0).getByTestId("dokumentfragen-marke");
    await expect(marke).toContainText("Abschnitt „Wartung“, Absatz 2");

    // Und sie führt dorthin: die Stelle ist hervorgehoben, sichtbar und hat den Fokus.
    await marke.click();
    const ziel = page.locator('[data-testid="dokumentfragen-stelle"][data-nummer="2"]');
    await expect(ziel).toHaveAttribute("data-markiert", "true");
    await expect(ziel).toBeInViewport();
    await expect(ziel).toBeFocused();
    await expect(ziel).toContainText("Das Wartungsintervall beträgt 500 Betriebsstunden.");
    await expect(page.locator('[data-markiert="true"]')).toHaveCount(1);

    expect(verraten, "der Dokumenttext hat den Browser verlassen").toEqual([]);
  });

  test("K1: ein echtes PDF — die Fundstelle nennt die Seite", async ({ page }) => {
    await oeffnen(page);
    await page.getByTestId("dokumentfragen-datei").setInputFiles(fixture("d3-referenz.pdf"));
    await expect(page.getByTestId("dokumentfragen-geladen")).toContainText("d3-referenz.pdf", {
      timeout: 30_000,
    });

    await fragen(page, "Wo steht der Suchbegriff PDFBELEG4203?");
    const aussage = page.getByTestId("dokumentfragen-aussage").first();
    await expect(aussage).toContainText("PDFBELEG4203 kommt in dieser Datei genau einmal vor.");
    await expect(aussage.getByTestId("dokumentfragen-marke")).toContainText("Seite 1, Absatz");
  });

  test("K1: eine echte Word-Datei — Antwort mit Absatzangabe", async ({ page }) => {
    await oeffnen(page);
    await page.getByTestId("dokumentfragen-datei").setInputFiles(fixture("sample.docx"));
    await expect(page.getByTestId("dokumentfragen-geladen")).toContainText("sample.docx", {
      timeout: 30_000,
    });

    await fragen(page, "Was tun bei Überdruck?");
    const aussage = page.getByTestId("dokumentfragen-aussage").first();
    await expect(aussage).toContainText("Ventil bei Überdruck schließen");
    await expect(aussage.getByTestId("dokumentfragen-marke")).toContainText("Absatz 1");
  });

  test("K1: steht es nicht im Dokument, gibt es keine Antwort, sondern die Lücke", async ({
    page,
  }) => {
    await oeffnen(page);
    await page.getByTestId("dokumentfragen-datei").setInputFiles({
      name: "handbuch.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(readFileSync(fixture("d3-referenz.md"))),
    });
    await expect(page.getByTestId("dokumentfragen-geladen")).toBeVisible();

    await fragen(page, "Wer ist der Lieferant der Kaffeemaschine?");
    await expect(page.getByTestId("dokumentfragen-luecke")).toBeVisible();
    await expect(page.getByTestId("dokumentfragen-aussage")).toHaveCount(0);
    await expect(page.getByTestId("dokumentfragen-etikett")).toHaveCount(0);
    await expect(page.getByTestId("dokumentfragen-nicht-gefunden")).toContainText("Kaffeemaschine");
  });
});
