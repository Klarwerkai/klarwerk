// ================================================================================================
// EDITOR-EINHEITLICH (produkt:20261007:editor-einheitlich) · DAS BEARBEITEN IM ECHTEN BROWSER.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT, obwohl `tests/editor-einheitlich/bearbeiten-einheitlich-mounted.test.tsx`
// dieselben Zusagen in jsdom misst: jsdom rechnet kein Layout. „Ein Fehlschlag verschiebt die Knöpfe
// nicht" (K4) ist eine GEOMETRISCHE Aussage und nur hier belegbar — gemessen wird die Lage von
// „Speichern" und „Abbrechen" unmittelbar vor dem Klick und nach der Konfliktmeldung. Dazu kommt das
// gebündelte Produkt und echtes Tippen in den Editor (K2), und die Bildschirmfotos sind die
// Bedienbelege des Auftrags.
//
// DIE VORBEREITUNG läuft über den Draht (`POST /api/kos`), nicht über das Blatt: Gegenstand ist das
// BEARBEITEN. Angelegt wird ein Eintrag in genau der Form, die das Blatt beim Erstellen schreibt —
// die Aussage ist der Klartext des Inhalts (`frontDoorStatement`, Serverkürzung ≤ 500 Zeichen).
//
// JEDER FALL HAT SEINE EIGENE MARKE: der Smoke-Server hält seinen Bestand über Fälle und Engines im
// Speicher. Alle Texte sind fiktiv.
import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function legeAn(
  request: APIRequestContext,
  title: string,
  text: string,
): Promise<{ id: string; version: number }> {
  const antwort = await request.post("/api/kos", {
    data: {
      title,
      statement: text,
      bodyHtml: `<p>${text}</p>`,
      type: "best_practice",
      category: "Betrieb",
      confidentiality: "intern",
    },
  });
  const fehler = `Anlegen scheiterte: ${antwort.status()} ${await antwort.text()}`;
  expect(antwort.ok(), fehler).toBe(true);
  return (await antwort.json()) as { id: string; version: number };
}

/** Ein Bedienbeleg: das ganze Bild in diesem Moment, angehängt an den nativen Bericht. */
async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function oben(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${testId} hat keine Fläche`).not.toBeNull();
  return box?.y ?? Number.NaN;
}

async function formularOeffnen(page: Page, id: string): Promise<void> {
  await page.goto(`/wissen/${id}?edit=1`);
  const aussage = page.getByTestId("bib-aussage");
  await expect(aussage, "das Bearbeitungsformular ist nicht offen").toBeVisible({
    timeout: 15_000,
  });
}

test.describe("EDITOR-EINHEITLICH · Bearbeiten wie Erstellen", () => {
  test("K1/K2/K4/K5: einmal im Inhalt ändern, Aussage folgt; Konflikt verschiebt keine Knöpfe; Fassungen bleiben", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const text = `Ventil ${m} zuerst entlasten. Danach manuell schließen.`;
    const ko = await legeAn(page.request, `Ventil ${m} bei Überdruck`, text);

    await formularOeffnen(page, ko.id);
    // K1: das Titelfeld heisst wie beim Erstellen.
    await expect(page.locator('label:has([data-testid="bib-titel"]) > span')).toHaveText("Titel");
    // K2: die Aussage stammt aus dem Inhalt — der Hinweis sagt, dass sie ihm folgt.
    await expect(page.getByTestId("bib-aussage-folgt-inhalt")).toBeVisible();
    await expect(page.getByTestId("bib-aussage")).toHaveValue(text);
    // K3/K5: Pflicht und Wirkung stehen VOR dem Klick da.
    await expect(page.getByTestId("bib-pflicht-ueberblick")).toBeVisible();
    await expect(page.getByTestId("bib-wirkung")).toContainText("Version 2");
    await bild(page, "1-formular-geoeffnet");

    // EINE Änderung — getippt, nur im Inhalt.
    const editor = page.getByRole("textbox", { name: "Wissensseite — Fließtext" });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("End");
    await page.keyboard.type(` Zusatz ${m}.`);
    const nachgezogen = new RegExp(`Zusatz ${m}\\.$`);
    await expect(
      page.getByTestId("bib-aussage"),
      "die Aussage musste ein zweites Mal gepflegt werden",
    ).toHaveValue(nachgezogen);
    await bild(page, "2-inhalt-geaendert-aussage-folgt");

    // Jemand schreibt dazwischen — die nächste Speicherung läuft in den Konflikt (409).
    const fremd = await page.request.put(`/api/kos/${ko.id}`, {
      data: {
        action: "revise",
        changes: { statement: `Fremder Text ${m}.`, type: "best_practice" },
      },
    });
    expect(fremd.ok(), `fremdes Schreiben scheiterte: ${fremd.status()}`).toBe(true);

    // K4: die Knöpfe, unmittelbar vor dem Klick vermessen …
    const speichernVorher = await oben(page, "bib-speichern");
    const abbrechenVorher = await oben(page, "bib-bearbeiten-abbrechen");
    await page.getByTestId("bib-speichern").click();
    const lage = page.getByTestId("bib-speichern-lage");
    await expect(lage, "keine Konfliktmeldung").toBeVisible({ timeout: 15_000 });
    await expect(lage).toHaveAttribute("data-lage", "stale");
    // … und nach der Meldung: dieselbe Stelle, die Meldung darunter.
    const speichernNachher = await oben(page, "bib-speichern");
    const abbrechenNachher = await oben(page, "bib-bearbeiten-abbrechen");
    const versatzSpeichern = Math.abs(speichernNachher - speichernVorher);
    const versatzAbbrechen = Math.abs(abbrechenNachher - abbrechenVorher);
    expect(versatzSpeichern, "„Speichern“ ist gesprungen").toBeLessThanOrEqual(1);
    expect(versatzAbbrechen, "„Abbrechen“ ist gesprungen").toBeLessThanOrEqual(1);
    expect(await oben(page, "bib-speichern-lage")).toBeGreaterThan(speichernNachher);
    // Die Eingabe ist erhalten.
    await expect(page.getByTestId("bib-aussage")).toHaveValue(nachgezogen);
    await bild(page, "3-konflikt-knoepfe-an-ihrer-stelle");

    // Bewusst auf dem jetzigen Stand speichern — K5: die beabsichtigte Fassung entsteht.
    await page.getByTestId("bib-speichern-trotzdem").click();
    await expect(page.getByTestId("bib-speichern")).toHaveCount(0, { timeout: 15_000 });
    await bild(page, "4-gespeichert");

    const gelesen = await page.request.get(`/api/kos/${ko.id}`);
    expect(gelesen.ok()).toBe(true);
    const jetzt = (await gelesen.json()) as { version: number; statement: string };
    expect(jetzt.version).toBe(3);
    expect(jetzt.statement).toMatch(nachgezogen);

    // Die alten Fassungen bleiben nachvollziehbar — mit ihrem eigenen Text.
    const verlauf = await page.request.get(`/api/kos/${ko.id}/versions`);
    expect(verlauf.ok()).toBe(true);
    const fassungen = (await verlauf.json()) as {
      version: number;
      snapshot: { statement: string };
    }[];
    expect(fassungen.find((f) => f.version === 1)?.snapshot.statement).toBe(text);
    expect(fassungen.find((f) => f.version === 2)?.snapshot.statement).toBe(`Fremder Text ${m}.`);
  });

  test("K3: Pflichtangabe fehlt — das Titelfeld sagt es, der Knopf sperrt, die Eingaben bleiben", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const text = `Pumpe ${m} vor dem Start entlüften.`;
    const ko = await legeAn(page.request, `Pumpe ${m}`, text);

    await formularOeffnen(page, ko.id);
    await expect(page.getByTestId("bib-pflicht-ueberblick")).toContainText("Pflichtangaben");
    await expect(page.getByTestId("bib-pflicht-titel")).toHaveCount(0);

    await page.getByTestId("bib-titel").fill("");
    const hinweis = page.getByTestId("bib-pflicht-titel");
    await expect(hinweis).toBeVisible();
    await expect(page.getByTestId("bib-titel")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("bib-speichern")).toBeDisabled();
    await expect(page.getByTestId("bib-aussage")).toHaveValue(text);
    await bild(page, "5-titel-fehlt-am-feld");

    await page.getByTestId("bib-titel").fill(`Pumpe ${m} — neu`);
    await expect(hinweis).toHaveCount(0);
    await expect(page.getByTestId("bib-speichern")).toBeEnabled();
  });
});
