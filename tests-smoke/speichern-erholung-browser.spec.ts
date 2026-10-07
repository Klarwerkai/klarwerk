import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// SPEICHERN-ERHOLUNG (Ausbauliste Punkt 6) — DER WEG IM ECHTEN BROWSER GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Die Verbindung wird über Playwright wirklich getrennt (`context.setOffline`): der Browser meldet
// `offline`, react-query hält das Speichern an, und keine Anfrage erreicht den Server. Gemessen wird
// am Blatt (`/capture/frontdoor`, `/erfassen`) und an der Bibliothek:
//
//   K1/K2  „Entwurf sichern" ohne Netz → sichtbar „wartet", die Eingabe bleibt; nach der Rückkehr
//          sichtbar „gespeichert", und nach dem NEULADEN steht genau dieser Stand vom Server da.
//   K3     der Bestand trägt danach GENAU EINEN Entwurf mit dieser Marke.
//   K4     Seitenwechsel ohne Netz: „Entwurf speichern und wechseln" nennt den Grund und bleibt;
//          „Hier bleiben" behält die Eingabe; „Verwerfen und wechseln" wechselt und schreibt auch
//          nach der Rückkehr nichts.
//   K5     Nulltreffer mit Filtern: die Filter stehen da, ein Klick setzt sie zurück, der Suchtext
//          bleibt.
//   K6     der Wartesatz warnt vor dem Neuladen — dieser Weg ist NICHT gegen ein ungespeichertes
//          Neuladen ohne Netz geschützt, und das wird hier auch nicht behauptet.
//
// JEDER LAUF HAT SEINE EIGENE MARKE: der Smoke-Server hält seinen Bestand über alle Fälle im
// Speicher. Was ein Fall anlegt, räumt er im `finally` wieder ab — andere Sonden zählen Entwürfe.

const VORDERTUER = "/capture/frontdoor";

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

const fliesstext = (page: Page) =>
  page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first();
const anzeige = (page: Page) => page.getByTestId("blatt-speicherzustand");
const sichern = (page: Page) => page.getByTestId("blatt-entwurf-sichern");
const dialogTitel = (page: Page) => page.getByText("Ungespeicherte Eingabe").first();

/** Die Kennungen aller Entwürfe, deren gespeicherter Stand die Marke trägt. */
async function entwuerfeMit(page: Page, m: string): Promise<string[]> {
  const antwort = await page.request.get("/api/drafts");
  expect(antwort.ok(), "Die Entwurfsliste ist nicht lesbar").toBe(true);
  const liste = (await antwort.json()) as { id: string; payload?: unknown }[];
  return liste.filter((d) => JSON.stringify(d.payload ?? {}).includes(m)).map((d) => d.id);
}

/** Ein Bildschirmbeleg als Anhang des nativen Berichts — nicht nur als Datei im Ausgabeordner. */
async function beleg(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

async function aufraeumen(page: Page, m: string): Promise<void> {
  for (const id of await entwuerfeMit(page, m)) {
    await page.request.delete(`/api/drafts/${id}`);
  }
}

test("K1/K2/K3/K6: ohne Netz gesichert — wartet sichtbar, nach der Rückkehr gespeichert, nach dem Neuladen genau dieser Stand", async ({
  page,
  context,
}) => {
  await ensureLoggedIn(page);
  const m = marke();
  // Nur der Fliesstext wird geschrieben: das Titelfeld öffnet beim Fokus sein Menü, und ein
  // offenes Menü über dem Knopf wäre hier eine Störquelle ohne Aussage.
  const text = `Dichtung tauschen, danach Druckprobe (${m}).`;
  try {
    await page.goto(VORDERTUER);
    await expect(fliesstext(page), "das Blatt hat keine Schreibfläche").toBeVisible({
      timeout: 15_000,
    });
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "ruhe");
    await fliesstext(page).fill(text);

    await context.setOffline(true);
    await sichern(page).click();

    // K1: wartet — sichtbar unterschieden von „läuft" und „gespeichert".
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "wartet", { timeout: 10_000 });
    await expect(anzeige(page)).toContainText("Wartet auf Verbindung – noch nicht gespeichert");
    // K6: der Satz warnt vor dem Neuladen, statt einen Schutz zu behaupten.
    await expect(page.getByTestId("blatt-speicherzustand-hinweis")).toContainText(
      "nicht neu laden",
    );
    // K2: die Eingabe steht unverändert da, und nichts behauptet „gesichert".
    await expect(fliesstext(page)).toContainText(text);
    await expect(page.getByTestId("blatt-entwurf-gespeichert")).toHaveCount(0);
    // K3: ein zweiter Druck ist während des Wartens nicht möglich.
    await expect(sichern(page)).toBeDisabled();
    await beleg(page, "k2-wartet-auf-verbindung");

    await context.setOffline(false);

    // K2: erst die Quittung des Servers heisst „gespeichert".
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "gespeichert", {
      timeout: 15_000,
    });
    await expect(anzeige(page)).toContainText("Gespeichert – vom Server bestätigt");
    await expect(page.getByTestId("blatt-entwurf-gespeichert")).toBeVisible();
    await expect(page).toHaveURL(/[?&]draft=/);
    await beleg(page, "k2-nach-rueckkehr-gespeichert");

    // K3: genau EIN Entwurf mit dieser Marke.
    const ids = await entwuerfeMit(page, m);
    expect(ids, "nach Warten und Rückkehr liegt nicht genau ein Entwurf vor").toHaveLength(1);
    const id = ids[0] ?? "";
    expect(page.url()).toContain(`draft=${id}`);

    // K2: nach dem Neuladen steht genau dieser Stand — vom Server, nicht aus dem Fenster.
    await page.reload();
    await expect(fliesstext(page)).toContainText(text, { timeout: 15_000 });
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "ruhe");
    expect(await entwuerfeMit(page, m)).toHaveLength(1);
  } finally {
    await context.setOffline(false);
    await aufraeumen(page, m);
  }
});

// NACHARBEIT 1 (BEN): Weiterschreiben WÄHREND des Wartens. Gesendet wird der Klickstand; was danach
// getippt wird, bleibt ungespeichert und wird nicht bestätigt. Erst nach dem Zurückändern auf den
// gesendeten Stand heisst es „gespeichert" — und das Neuladen zeigt, was der Server wirklich trägt.
// Geändert wird der TITEL: er lässt sich exakt auf den Klickstand (leer) zurücksetzen, ein
// Editor-Rundlauf könnte das HTML anders serialisieren.
test("K2/K3 Nacharbeit: während des Wartens weitergeschrieben — gesendet und bestätigt ist derselbe Stand, nach dem Neuladen steht er da", async ({
  page,
  context,
}) => {
  await ensureLoggedIn(page);
  const m = marke();
  const text = `Lager prüfen, Spiel messen (${m}).`;
  const nachtrag = `Nachtrag-waehrend-des-Wartens-${m}`;
  try {
    await page.goto(VORDERTUER);
    await expect(fliesstext(page)).toBeVisible({ timeout: 15_000 });
    await fliesstext(page).fill(text);

    await context.setOffline(true);
    await sichern(page).click();
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "wartet", { timeout: 10_000 });

    const titel = page.getByTestId("blatt-titel");
    await titel.fill(nachtrag);
    await expect(titel).toHaveValue(nachtrag);
    await context.setOffline(false);

    // Der Server trägt den Klickstand — der Nachtrag ist NICHT mitgegangen.
    await expect
      .poll(async () => (await entwuerfeMit(page, m)).length, { timeout: 15_000 })
      .toBe(1);
    const antwort = await page.request.get("/api/drafts");
    const serverstand = JSON.stringify(
      ((await antwort.json()) as { payload?: unknown }[]).filter((d) =>
        JSON.stringify(d.payload ?? {}).includes(m),
      ),
    );
    expect(serverstand).toContain(text);
    expect(serverstand, "der während des Wartens getippte Nachtrag wurde gesendet").not.toContain(
      nachtrag,
    );
    // Und weil der Nachtrag ungespeichert ist, bestätigt die Anzeige nichts.
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "ruhe");
    await expect(page.getByTestId("blatt-entwurf-gespeichert")).toHaveCount(0);
    await beleg(page, "nacharbeit-nachtrag-unbestaetigt");

    // Zurück auf den gesendeten Stand: jetzt — und erst jetzt — „gespeichert".
    await titel.fill("");
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "gespeichert", {
      timeout: 10_000,
    });
    await beleg(page, "nacharbeit-rueckaenderung-bestaetigt");

    // Neuladen: dasselbe, was der Server trägt — der Text, nicht der Nachtrag.
    await page.reload();
    await expect(fliesstext(page)).toContainText(text, { timeout: 15_000 });
    await expect(page.getByTestId("blatt-titel")).not.toHaveValue(nachtrag);
    expect(await entwuerfeMit(page, m)).toHaveLength(1);
  } finally {
    await context.setOffline(false);
    await aufraeumen(page, m);
  }
});

test("K4: Seitenwechsel ohne Netz — Speichern nennt den Grund, Bleiben behält, Verwerfen schreibt nichts", async ({
  page,
  context,
}) => {
  await ensureLoggedIn(page);
  const m = marke();
  const text = `Ungesicherter Gedanke zur Abluft (${m}).`;
  try {
    await page.goto("/erfassen");
    await expect(fliesstext(page)).toBeVisible({ timeout: 15_000 });
    await fliesstext(page).fill(text);
    await context.setOffline(true);

    // Speichern und wechseln: ohne Netz bleibt der Dialog offen und sagt, warum.
    await page
      .getByRole("link", { name: /Bibliothek/ })
      .first()
      .click();
    await expect(dialogTitel(page)).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Entwurf speichern und wechseln" }).click();
    await expect(page.locator("[data-navguard-save-error]")).toContainText(
      "Ohne Verbindung kann jetzt nicht gespeichert werden.",
    );
    await expect(page).toHaveURL(/\/erfassen$/);
    await beleg(page, "k4-speichern-ohne-netz");

    // Hier bleiben: Ort und Eingabe bleiben.
    await page.getByRole("button", { name: "Hier bleiben" }).click();
    await expect(dialogTitel(page)).toBeHidden();
    await expect(fliesstext(page)).toContainText(text);

    // Ein explizites Speichern wartet — dann bewusst verwerfen und wechseln.
    await sichern(page).click();
    await expect(anzeige(page)).toHaveAttribute("data-zustand", "wartet", { timeout: 10_000 });
    await page
      .getByRole("link", { name: /Bibliothek/ })
      .first()
      .click();
    await expect(dialogTitel(page)).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Verwerfen und wechseln" }).click();
    await expect(page).toHaveURL(/\/bibliothek$/);

    // Auch nach der Rückkehr schreibt das verworfene Warten nichts.
    await context.setOffline(false);
    await page.waitForTimeout(2_000);
    expect(await entwuerfeMit(page, m), "ein verworfener Text wurde doch gespeichert").toEqual([]);
  } finally {
    await context.setOffline(false);
    await aufraeumen(page, m);
  }
});

test("K5: Nulltreffer zeigt die aktiven Filter und setzt sie direkt zurück — der Suchtext bleibt", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  const suchtext = `kein-treffer-${marke()}`;
  await page.goto(`/bibliothek?q=${suchtext}&zustand=validiert&von=2020-01-01`);

  const leer = page.getByTestId("bib-leer");
  await expect(leer).toBeVisible({ timeout: 15_000 });
  await expect(leer).toContainText("Nichts gefunden.");
  const filter = page.getByTestId("bib-leer-filter");
  await expect(filter).toBeVisible();
  await expect(filter).toContainText("Aktive Filter:");
  await expect(filter).toContainText("Zustand: Validiert");
  await expect(filter).toContainText("Zuletzt geändert: 2020-01-01");
  await beleg(page, "k5-nulltreffer-filter");

  await page.getByTestId("bib-leer-filter-reset").click();

  await expect(page).not.toHaveURL(/[?&]zustand=/);
  await expect(page).not.toHaveURL(/[?&]von=/);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${suchtext}`));
  await expect(page.getByRole("searchbox", { name: "Bibliothek durchsuchen" })).toHaveValue(
    suchtext,
  );
  await expect(page.getByTestId("bib-segment-alle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("bib-leer-filter")).toHaveCount(0);
});
