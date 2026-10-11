// ==================================================================================================
// BILDSCHIRMABLÄUFE (produkt:wettbewerb:20261003:bildschirmablaeufe) — DER BEDIENWEG IM ECHTEN BROWSER.
// ==================================================================================================
//
// Was jsdom und die Routentests nicht belegen können, steht hier: echte Dateiauswahl, echtes Ziehen
// eines Schwärzrahmens mit der Maus, echte Canvas-Neukodierung, echtes Neuladen der Seite und der
// echte Einreichweg aus der gebauten App.
//
// K1 Übernahme mit Reihenfolge/Bildern/Texten/Herkunft · K2 ändern/verschieben/löschen + Neuladen ·
// K3 Einreichen → offen, Prüfweg · K4 Bild- und Textschwärzung ohne Restkopie · K5 unpassende Datei →
// Fehler, Bearbeitung bleibt · K6 dieselbe Aufzeichnung erneut → kein zweites Objekt · K7 externe
// Herkunft sichtbar.
//
// GETRENNTE BEISPIELDATEN: Bilder entstehen im Test auf einer Canvas, Texte sind neutral. Weil sich
// drei Engines EINEN In-Memory-Server und EIN Konto teilen (`support/auth.ts`), trägt jede Datei eine
// eigene Laufkennung — sonst wäre dieselbe Aufzeichnung in der zweiten Engine schon „eingereicht".
import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

/** Erzeugt im Browser ein Bild mit hellem Grund und einem roten „Datenfeld" in der Mitte. */
async function testbild(page: Page, beschriftung: string): Promise<string> {
  return page.evaluate((text) => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 80;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, 160, 80);
    ctx.fillStyle = "#d00000";
    ctx.fillRect(40, 25, 80, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(text, 45, 45);
    return c.toDataURL("image/png");
  }, beschriftung);
}

/** Liest einen Pixel aus einer data-URL — im Browser, über eine frische Canvas. */
async function pixel(page: Page, src: string, x: number, y: number): Promise<number[]> {
  return page.evaluate(
    async ({ src: s, x: px, y: py }) => {
      const img = new Image();
      await new Promise<void>((ok, nein) => {
        img.onload = () => ok();
        img.onerror = () => nein(new Error("bild"));
        img.src = s;
      });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d") as CanvasRenderingContext2D;
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(px, py, 1, 1).data];
    },
    { src, x, y },
  );
}

function datei(name: string, inhalt: string) {
  return { name, mimeType: "application/json", buffer: Buffer.from(inhalt, "utf8") };
}

const schritte = (page: Page) => page.getByTestId("ablauf-schritt");

/** Neutraler Beispielname mit derselben „sensiblen" Angabe wie ein Schritttext. */
const DATEINAME = "Musterfirma-angebot.json";

/** Die WERTE der Handlungstexte (Textfelder — ihr Textinhalt folgt einer Eingabe nicht). */
function texte(page: Page): Promise<string[]> {
  return page
    .getByTestId("ablauf-schritt-text")
    .evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value));
}

test.describe("Bildschirmablauf übernehmen · Browser", () => {
  test("Import → bearbeiten → schwärzen → speichern → neu laden → einreichen → Wiederholung", async ({
    page,
  }, info) => {
    const lauf = `${info.project.name}-${Date.now()}`;
    const titel = `Angebot anlegen (${lauf})`;
    await ensureLoggedIn(page);

    // Einstieg über „Meine Entwürfe".
    await page.goto("/entwuerfe");
    await page.getByTestId("entwuerfe-ablauf-uebernehmen").click();
    await expect(page.getByTestId("page-ablauf")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("ablauf-datenfluss")).toContainText("kein KI-Dienst");

    // ---- K5: nicht unterstütztes Format → verständlicher Fehler, keine Anleitung ----------------
    await page
      .getByTestId("ablauf-datei")
      .setInputFiles(datei("tango.json", '{"format":"tango/2"}'));
    await expect(page.getByTestId("ablauf-fehler")).toContainText("nicht unterstützt");
    await expect(schritte(page)).toHaveCount(0);

    // ---- K1/K7: der Beispielablauf ---------------------------------------------------------------
    const b1 = await testbild(page, "Kd-Nr 4711");
    const b2 = await testbild(page, "Schritt 2");
    const b3 = await testbild(page, "Schritt 3");
    const inhalt = JSON.stringify({
      format: "klarwerk-ablauf/1",
      titel,
      werkzeug: "Smoke-Testrekorder",
      aufgezeichnetAm: "2026-10-05T09:12:00Z",
      anwendung: "Testanwendung Angebote",
      schritte: [
        { text: "Neues Angebot öffnen", bild: b1 },
        { text: "Kunde Musterfirma wählen", bild: b2 },
        { text: "Falsch vorgeführter Zwischenschritt", bild: b3 },
      ],
    });
    // Nacharbeit 4 (Ben, K4): derselbe sensible Begriff steht im Schritttext UND im Dateinamen der
    // Herkunft — nach dem Schwärzen darf er auch dort nicht mehr stehen.
    await page.getByTestId("ablauf-datei").setInputFiles(datei(DATEINAME, inhalt));
    await expect(schritte(page)).toHaveCount(3, { timeout: 10_000 });
    await expect(page.getByTestId("ablauf-fehler")).toHaveCount(0);
    await expect(page).toHaveURL(/\/erfassen\/ablauf\?entwurf=/);
    await expect(page.getByTestId("ablauf-herkunft")).toContainText(
      "Außerhalb Klarwerks aufgezeichnet mit Smoke-Testrekorder",
    );
    await expect(page.getByTestId("ablauf-herkunft")).toContainText(DATEINAME);
    await expect
      .poll(() => texte(page))
      .toEqual([
        "Neues Angebot öffnen",
        "Kunde Musterfirma wählen",
        "Falsch vorgeführter Zwischenschritt",
      ]);
    const srcs = await page
      .getByTestId("ablauf-bild")
      .evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
    expect(srcs).toEqual([b1, b2, b3]);

    // ---- K2: ändern, verschieben, löschen --------------------------------------------------------
    await page.getByTestId("ablauf-schritt-text").nth(1).fill("Kunde Musterfirma auswählen");
    await schritte(page).nth(2).getByTestId("ablauf-entfernen").click();
    await expect(schritte(page)).toHaveCount(2);
    await schritte(page).nth(1).getByTestId("ablauf-hoch").click();
    await expect
      .poll(() => texte(page))
      .toEqual(["Kunde Musterfirma auswählen", "Neues Angebot öffnen"]);

    // ---- K4: Text schwärzen ----------------------------------------------------------------------
    await page.getByTestId("ablauf-schwaerzen-feld").fill("Musterfirma");
    await page.getByTestId("ablauf-schwaerzen-knopf").click();
    await expect(page.getByTestId("ablauf-schritt-text").first()).toHaveValue(
      "Kunde █████ auswählen",
    );
    expect((await texte(page)).join(" ")).not.toContain("Musterfirma");
    await expect(page.getByTestId("ablauf-herkunft")).toContainText("█████-angebot.json");
    await expect(page.getByTestId("ablauf-herkunft")).not.toContainText("Musterfirma");
    await expect(page.getByTestId("ablauf-herkunft")).toContainText(
      "Außerhalb Klarwerks aufgezeichnet mit Smoke-Testrekorder",
    );

    // ---- K4: Bild schwärzen — Rahmen mit der Maus über das rote Datenfeld ziehen ----------------
    // Nacharbeit 3 (Trace des Prüflaufs): Der Datenschutzhinweis des Produkts lag über dem Bild,
    // und der Mausweg markierte seinen Text statt einen Rahmen zu ziehen. Ein sichtbarer Hinweis
    // wird deshalb wie von einem Menschen über seinen regulären Knopf bestätigt. Steht keiner da,
    // hat ihn derselbe geteilte Smoke-Account schon quittiert.
    const hinweisWeiter = page.getByTestId("notice-ack");
    if (await hinweisWeiter.isVisible()) {
      await hinweisWeiter.click();
      await expect(page.getByTestId("notice-banner")).toHaveCount(0);
    }
    const bildB1 = schritte(page).nth(1).getByTestId("ablauf-bild");
    await bildB1.scrollIntoViewIfNeeded();
    const box = await bildB1.boundingBox();
    if (!box) {
      throw new Error("Bild ohne Fläche");
    }
    // Das Datenfeld liegt bei 40..120 × 25..55 von 160 × 80 — Rahmen mit Rand darum.
    const fx = box.width / 160;
    const fy = box.height / 80;
    const start = { x: box.x + 35 * fx, y: box.y + 20 * fy };
    const ende = { x: box.x + 125 * fx, y: box.y + 60 * fy };
    // Start und Ende des Mauswegs treffen wirklich das Bild und nicht etwas, das darüber liegt.
    for (const p of [start, ende]) {
      const getroffen = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-testid") ?? null,
        p,
      );
      const meldung = `der Mausweg trifft bei ${p.x},${p.y} nicht das Bild`;
      expect(getroffen, meldung).toBe("ablauf-bild");
    }
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(ende.x, ende.y, { steps: 5 });
    await page.mouse.up();
    const schwaerzKnopf = schritte(page).nth(1).getByTestId("ablauf-bild-schwaerzen");
    const freigabe = "der gezogene Rahmen hat den Knopf nicht freigegeben";
    await expect(schwaerzKnopf, freigabe).toBeEnabled();
    await schwaerzKnopf.click();
    await expect(page.getByTestId("ablauf-meldung")).toContainText("Bereich geschwärzt");
    const geschwaerzt = await bildB1.evaluate((e) => (e as HTMLImageElement).src);
    expect(geschwaerzt).not.toBe(b1);
    expect(geschwaerzt.startsWith("data:image/png;base64,")).toBe(true);
    // Die Pixel des Datenfelds sind schwarz — im neu kodierten Bild, nicht in einer Überlagerung.
    expect(await pixel(page, geschwaerzt, 80, 40)).toEqual([0, 0, 0, 255]);
    expect(await pixel(page, geschwaerzt, 5, 5)).toEqual(await pixel(page, b1, 5, 5));

    // ---- Angaben und Speichern -------------------------------------------------------------------
    await page
      .getByTestId("ablauf-meta-aussage")
      .fill("So wird ein Angebot angelegt und gespeichert.");
    await page.getByTestId("ablauf-meta-art").selectOption("best_practice");
    await page.getByTestId("ablauf-meta-kategorie").fill("Vertrieb");
    await page.getByTestId("ablauf-meta-stufe").selectOption("intern");
    await page.getByTestId("ablauf-speichern").click();
    await expect(page.getByTestId("ablauf-meldung")).toContainText("Entwurf gespeichert");
    await expect(page.getByTestId("ablauf-ungespeichert")).toHaveCount(0);

    // ---- K2: nach dem Neuladen derselbe Stand ----------------------------------------------------
    await page.reload();
    await expect(schritte(page)).toHaveCount(2, { timeout: 10_000 });
    await expect.poll(() => texte(page)).toEqual(["Kunde █████ auswählen", "Neues Angebot öffnen"]);
    const nachLaden = await page
      .getByTestId("ablauf-bild")
      .evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
    expect(nachLaden).toEqual([b2, geschwaerzt]);
    expect(nachLaden).not.toContain(b1);
    await expect(page.getByTestId("ablauf-herkunft")).toContainText("Smoke-Testrekorder");
    expect(await page.content()).not.toContain("Musterfirma");

    // ---- K5: ein zweiter, kaputter Import lässt die Bearbeitung stehen --------------------------
    await page.getByTestId("ablauf-datei").setInputFiles(datei("kaputt.json", "{ kein json"));
    await expect(page.getByTestId("ablauf-fehler")).toContainText("kein gültiges JSON");
    await expect(page.getByTestId("ablauf-fehler")).toContainText("bleibt unverändert");
    await expect(schritte(page)).toHaveCount(2);

    // ---- K3: Einreichen über den vorhandenen Weg ---------------------------------------------------
    await page.getByTestId("ablauf-einreichen").click();
    const eingereicht = page.getByTestId("ablauf-eingereicht");
    await expect(eingereicht).toContainText("kein gültiges Wissen", { timeout: 15_000 });
    await expect(eingereicht.getByRole("link")).toHaveAttribute("href", /^\/wissen\/[\w-]+$/);

    // ---- K6: dieselbe Aufzeichnung noch einmal → kein zweites Wissensobjekt ---------------------
    await page.getByTestId("ablauf-datei").setInputFiles(datei(DATEINAME, inhalt));
    await expect(schritte(page)).toHaveCount(3, { timeout: 10_000 });
    await page.getByTestId("ablauf-meta-aussage").fill("Zweiter Versuch derselben Aufzeichnung.");
    await page.getByTestId("ablauf-meta-art").selectOption("best_practice");
    await page.getByTestId("ablauf-meta-kategorie").fill("Vertrieb");
    await page.getByTestId("ablauf-meta-stufe").selectOption("intern");
    await page.getByTestId("ablauf-einreichen").click();
    await expect(page.getByTestId("ablauf-bereits")).toContainText("kein zweites Objekt", {
      timeout: 15_000,
    });
  });
});
