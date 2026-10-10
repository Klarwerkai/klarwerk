import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// OFFICE IM ARTIKEL (produkt:20261007:office-artikel-editor) — DIE FLÄCHE IM ECHTEN BROWSER.
// ================================================================================================
//
// ZWEI ARTEN VON BELEG, ausdrücklich getrennt:
//
//   ECHT   Der Smoke-Server hat KEINEN Office-Editor eingerichtet (keine Editor-Herkunft, kein
//          Schlüssel in `playwright.smoke.config.ts`). Gemessen wird, was ein Mensch dann am Artikel
//          sieht: „nicht eingerichtet", Fassung, Dokumentstand, kein Start — und dass der Server die
//          Sitzung wirklich mit 503 verweigert.                                          (K3, K7)
//
//   NACHGESTELLT  Der Bedienablauf der Fläche mit einem EDITOR-DOUBLE gleicher Herkunft: eine kleine
//          Seite, die das Nachrichtenprotokoll des Editors (Frame_Ready, Document_Loaded,
//          Action_Save_Resp bzw. Failed) spricht. Sitzung und Übernahme sind dabei per `page.route`
//          SIMULIERT — der Server-Weg dahinter ist in `tests/office-artikel-editor/office-routes.test.ts`
//          geprüft. Das belegt die Oberfläche (Laden, Übernehmen, Konflikt, Fehler, Abbruch,
//          Klara-Hinweis), NICHT Collabora und NICHT den echten Speicherweg.        (K1, K4, K7)

const ADRESSE_DOUBLE = "/__office-probe/editor";

function marke(): string {
  const zeichen = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += zeichen[Math.floor(Math.random() * zeichen.length)];
  }
  return raus;
}

async function beleg(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

/** Ein Artikel mit einem fiktiven Word-Anhang über die echten Routen. */
async function artikelMitDokument(
  request: APIRequestContext,
  m: string,
): Promise<{ koId: string; anhangId: string }> {
  const ko = await request.post("/api/kos", {
    data: {
      title: `Pumpe P1 fiktiv warten ${m}`,
      statement: `Die fiktive Pumpe P1 wird monatlich geprüft (${m}).`,
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: "intern",
    },
  });
  expect(ko.ok(), `Anlegen scheiterte: ${ko.status()}`).toBe(true);
  const { id: koId } = (await ko.json()) as { id: string };
  const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const inhalt = Buffer.from(`Fiktive Anleitung ${m}`).toString("base64");
  const objekt = await request.post("/api/objects", {
    data: {
      name: `Anleitung-${m}.docx`,
      mime,
      data: `data:${mime};base64,${inhalt}`,
      purpose: "attachment",
    },
  });
  expect(objekt.ok(), `Hochladen scheiterte: ${objekt.status()}`).toBe(true);
  const { id: objectId } = (await objekt.json()) as { id: string };
  const angehaengt = await request.put(`/api/kos/${koId}`, {
    data: { action: "attach", attachment: { name: `Anleitung-${m}.docx`, mime, objectId } },
  });
  expect(angehaengt.ok(), `Anhängen scheiterte: ${angehaengt.status()}`).toBe(true);
  const stand = (await angehaengt.json()) as { attachments?: { id: string }[] };
  const anhangId = stand.attachments?.at(-1)?.id ?? "";
  expect(anhangId).not.toBe("");
  return { koId, anhangId };
}

/** Wie bei `lesen-inhalt-zuerst-browser.spec.ts`: der einmalige Nutzungshinweis wird quittiert. */
async function nutzungshinweisQuittieren(page: Page): Promise<void> {
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible()) {
    await weiter.click();
    await expect(page.getByTestId("notice-banner")).toHaveCount(0, { timeout: 15_000 });
  }
}

/** Artikel öffnen → „Mehr" → „Anhänge" → „Im Artikel öffnen". */
async function oeffneOfficeFlaeche(page: Page, koId: string, anhangId: string) {
  await page.goto(`/wissen/${koId}`);
  await expect(page.getByTestId("bib-titel")).toBeVisible({ timeout: 15_000 });
  await nutzungshinweisQuittieren(page);
  await page.getByTestId("bib-mehr").click();
  await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
  await page.locator(`[data-office-oeffnen="${anhangId}"]`).click();
  const flaeche = page.locator(`[data-office-flaeche="${anhangId}"]`);
  await expect(flaeche).toBeVisible({ timeout: 15_000 });
  return flaeche;
}

/** Die Seite des Editor-Doubles: spricht das postMessage-Protokoll des Editors nach. */
function editorDouble(modus: "laedt" | "scheitert"): string {
  const skript =
    modus === "scheitert"
      ? `send({ MessageId: "App_LoadingStatus", Values: { Status: "Failed" } });`
      : `
window.addEventListener("message", (e) => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (m.MessageId === "Host_PostmessageReady") {
    send({ MessageId: "App_LoadingStatus", Values: { Status: "Document_Loaded" } });
  }
  if (m.MessageId === "Action_Save") {
    document.body.dataset.gespeichert = String(Number(document.body.dataset.gespeichert || 0) + 1);
    send({ MessageId: "Action_Save_Resp", Values: { success: true } });
  }
});
send({ MessageId: "App_LoadingStatus", Values: { Status: "Frame_Ready" } });`;
  return `<!doctype html><meta charset="utf-8"><title>Editor-Double</title>
<body style="font:14px sans-serif;padding:16px">Editor-Double (Probe, kein Collabora)
<script>
const send = (m) => window.parent.postMessage(JSON.stringify(m), "*");
${skript}
</script></body>`;
}

/** Simuliert Lage (eingerichtet), Sitzung und Editorseite; die Übernahme bestimmt der Aufrufer. */
async function simuliereEditor(
  page: Page,
  koId: string,
  anhangId: string,
  modus: "laedt" | "scheitert",
): Promise<void> {
  const herkunft = new URL(page.url()).origin;
  await page.route(`**/api/kos/${koId}/office/${anhangId}`, async (route) => {
    const echt = await route.fetch();
    const lage = (await echt.json()) as Record<string, unknown>;
    await route.fulfill({ response: echt, json: { ...lage, editorEingerichtet: true } });
  });
  await page.route(`**/api/kos/${koId}/office/${anhangId}/sitzung`, (route) =>
    route.fulfill({
      json: {
        editorUrl: `${herkunft}${ADRESSE_DOUBLE}?WOPISrc=probe`,
        editorHerkunft: herkunft,
        accessToken: "simuliert-keine-echte-marke",
        accessTokenTtl: Date.now() + 60_000,
        schreibweg: "direkt",
        fassung: 1,
      },
    }),
  );
  await page.route(`**${ADRESSE_DOUBLE}**`, (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: editorDouble(modus) }),
  );
}

test.describe("Office im Artikel", () => {
  test("ECHT · K3/K7: ohne eingerichteten Editor sagt die Fläche es, und der Server öffnet nichts", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDokument(page.request, marke());
    const flaeche = await oeffneOfficeFlaeche(page, koId, anhangId);

    await expect(flaeche.locator("[data-office-nicht-eingerichtet]")).toContainText(
      "nicht eingerichtet",
    );
    await expect(flaeche.locator("[data-office-schreibweg]")).toHaveAttribute(
      "data-office-schreibweg",
      "direkt",
    );
    await expect(flaeche.locator("[data-office-fassung]")).toContainText("Artikelfassung 1");
    await expect(flaeche.locator('[data-office-verlauf] [data-office-stand="1"]')).toContainText(
      "aktuell",
    );
    await expect(flaeche.locator("[data-office-starten]")).toHaveAttribute("aria-disabled", "true");
    await beleg(page, "echt-nicht-eingerichtet");

    const sitzung = await page.request.post(`/api/kos/${koId}/office/${anhangId}/sitzung`);
    expect(sitzung.status()).toBe(503);
    expect(((await sitzung.json()) as { error: string }).error).toBe(
      "OFFICE_EDITOR_NICHT_EINGERICHTET",
    );
    // Und die WOPI-Tür bleibt ohne Einrichtung zu.
    expect((await page.request.get(`/wopi/files/${anhangId}`)).status()).toBe(404);
  });

  test("NACHGESTELLT · K1/K7: laden, als Fassung übernehmen, speichern und zurück — sichtbar", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDokument(page.request, marke());
    await page.goto("/");
    await simuliereEditor(page, koId, anhangId, "laedt");
    let uebernahmen = 0;
    await page.route(`**/api/kos/${koId}/office/${anhangId}/uebernahme`, (route) => {
      uebernahmen += 1;
      return route.fulfill({ json: { fassung: 1 + uebernahmen, status: "offen" } });
    });
    const flaeche = await oeffneOfficeFlaeche(page, koId, anhangId);

    await flaeche.locator("[data-office-starten]").click();
    await expect(flaeche.locator("[data-office-phase]")).toHaveAttribute(
      "data-office-phase",
      "bereit",
      { timeout: 15_000 },
    );
    // K7: Klara bekommt aus dem Editor keine Auswahl — und das steht sichtbar da.
    await expect(flaeche.locator("[data-office-klara]")).toContainText(
      "Klara sieht Markierungen in diesem Editor nicht",
    );
    await beleg(page, "nachgestellt-editor-bereit");

    await flaeche.locator("[data-office-uebernehmen]").click();
    await expect(flaeche.locator('[data-office-meldung="erfolg"]')).toContainText(
      "Gespeichert als Artikelfassung 2",
    );
    await expect(flaeche.locator('[data-office-meldung="erfolg"]')).toContainText("Status: offen");
    expect(uebernahmen).toBe(1);
    // Der Editor bekam den Speicherbefehl über das Protokoll, nicht über einen Seitenumweg.
    const gespeichert = await page
      .frameLocator("iframe[name^='office-editor-']")
      .locator("body")
      .getAttribute("data-gespeichert");
    expect(gespeichert).toBe("1");
    await beleg(page, "nachgestellt-als-fassung-uebernommen");

    await flaeche.locator("[data-office-schliessen]").click();
    await expect(flaeche.locator("[data-office-editor]")).toHaveCount(0);
    expect(uebernahmen).toBe(2);
    await beleg(page, "nachgestellt-zurueck-am-artikel");
  });

  test("NACHGESTELLT · K4: Konflikt bei der Übernahme — verständlich, Editor bleibt offen", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDokument(page.request, marke());
    await page.goto("/");
    await simuliereEditor(page, koId, anhangId, "laedt");
    await page.route(`**/api/kos/${koId}/office/${anhangId}/uebernahme`, (route) =>
      route.fulfill({
        status: 409,
        json: { error: "KO_STALE", message: "simuliert", currentVersion: 2 },
      }),
    );
    const flaeche = await oeffneOfficeFlaeche(page, koId, anhangId);
    await flaeche.locator("[data-office-starten]").click();
    await expect(flaeche.locator("[data-office-phase]")).toHaveAttribute(
      "data-office-phase",
      "bereit",
      { timeout: 15_000 },
    );
    await flaeche.locator("[data-office-uebernehmen]").click();
    const meldung = flaeche.locator('[data-office-meldung="fehler"]');
    await expect(meldung).toContainText("anderweitig geändert");
    await expect(meldung).toContainText("nichts überschrieben");
    // Nichts geht verloren: der Editor bleibt offen.
    await expect(flaeche.locator("iframe")).toBeVisible();
    await beleg(page, "nachgestellt-konflikt");
  });

  test("NACHGESTELLT · K7: Ladefehler und Abbruch sind sichtbar", async ({ page }) => {
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDokument(page.request, marke());
    await page.goto("/");
    await simuliereEditor(page, koId, anhangId, "scheitert");
    const flaeche = await oeffneOfficeFlaeche(page, koId, anhangId);
    await flaeche.locator("[data-office-starten]").click();
    await expect(flaeche.locator("[data-office-phase]")).toHaveAttribute(
      "data-office-phase",
      "fehler",
      { timeout: 15_000 },
    );
    await expect(flaeche.locator('[data-office-meldung="fehler"]')).toContainText("nicht geladen");
    await beleg(page, "nachgestellt-ladefehler");

    await flaeche.locator("[data-office-abbrechen]").click();
    await expect(flaeche.locator("[data-office-editor]")).toHaveCount(0);
    await expect(flaeche.locator('[data-office-meldung="hinweis"]')).toContainText("abgebrochen");
    await beleg(page, "nachgestellt-abgebrochen");
  });

  // Nacharbeit 2 (bens Befund): Zuklappen bei offenem Editor nimmt denselben Speicher- und
  // Übernahmeweg wie „Speichern und zurück" — und scheitert er, bleibt der Editor offen.
  test("NACHGESTELLT · K4/K7: Zuklappen speichert und übernimmt zuerst", async ({ page }) => {
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDokument(page.request, marke());
    await page.goto("/");
    await simuliereEditor(page, koId, anhangId, "laedt");
    let uebernahmen = 0;
    await page.route(`**/api/kos/${koId}/office/${anhangId}/uebernahme`, (route) => {
      uebernahmen += 1;
      return route.fulfill({ json: { fassung: 2, status: "offen" } });
    });
    const flaeche = await oeffneOfficeFlaeche(page, koId, anhangId);
    await flaeche.locator("[data-office-starten]").click();
    await expect(flaeche.locator("[data-office-phase]")).toHaveAttribute(
      "data-office-phase",
      "bereit",
      { timeout: 15_000 },
    );
    await page.locator(`[data-office-oeffnen="${anhangId}"]`).click();
    await expect(flaeche).toHaveCount(0);
    expect(uebernahmen).toBe(1);
    await expect(page.locator('[data-office-letzte-meldung="erfolg"]')).toContainText(
      "Gespeichert als Artikelfassung 2",
    );
    await beleg(page, "nachgestellt-zuklappen-uebernommen");
  });

  test("NACHGESTELLT · K4: Zuklappen bei Konflikt — Editor bleibt offen, nichts verschwindet", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDokument(page.request, marke());
    await page.goto("/");
    await simuliereEditor(page, koId, anhangId, "laedt");
    await page.route(`**/api/kos/${koId}/office/${anhangId}/uebernahme`, (route) =>
      route.fulfill({
        status: 409,
        json: { error: "KO_STALE", message: "simuliert", currentVersion: 2 },
      }),
    );
    const flaeche = await oeffneOfficeFlaeche(page, koId, anhangId);
    await flaeche.locator("[data-office-starten]").click();
    await expect(flaeche.locator("[data-office-phase]")).toHaveAttribute(
      "data-office-phase",
      "bereit",
      { timeout: 15_000 },
    );
    await page.locator(`[data-office-oeffnen="${anhangId}"]`).click();
    await expect(flaeche.locator('[data-office-meldung="fehler"]')).toContainText(
      "anderweitig geändert",
    );
    await expect(flaeche.locator("iframe")).toBeVisible();
    await beleg(page, "nachgestellt-zuklappen-konflikt");
  });
});
