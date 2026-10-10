import { type Browser, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// GEMEINSAM AN DERSELBEN ARTIKELFASSUNG ARBEITEN — zwei Konten in zwei Browsern
// (produkt:20261007:artikel-gemeinsam).
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server. Das Smoke-Konto (Admin) legt nur
// die Testkonten und den Artikel an; alles Übrige tun Anna und Bert in je EINEM EIGENEN
// Browserkontext:
//   K1 · Anna kommt vom Artikel ins Artikelgespräch und von dort in den gemeinsamen Entwurf; Bert
//        öffnet dasselbe Gespräch und landet im SELBEN Entwurf (dieselbe Kennung).
//   K2 · Änderungen an verschiedenen Abschnitten werden zusammengeführt; dieselbe Stelle ergibt
//        einen Konflikt mit beiden Fassungen, „Beide behalten" und Speichern legen die Lösung ab.
//   K3 · Wer dabei ist und was gespeichert ist (Arbeitsstand, Person) steht auf der Seite.
//   K4 · Der Artikel liest bis zur Übernahme die gültige Fassung.
//   K5 · Verbindungsabbruch: „unterbrochen", die Eingabe bleibt — auch über ein Neuladen.
//   K6 · Die Übernahme macht die neue Fassung; eine unabhängige, frische Anmeldung liest sie.
//
// WAS SIMULIERT IST — ehrlich benannt: der Verbindungsabbruch ist `context.setOffline(true)` des
// Browsers; der Server läuft weiter. Rechteentzug und Zusammenführung über zwei App-Prozesse misst
// `tests/artikel-gemeinsam/` (Fläche in jsdom, PostgreSQL). Alle Konten und Texte sind fiktiv.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

const A1 = "Bei Überdruck schließt Ventil X selbsttätig.";
const A2 = "Vorher den Druck über Ventil Y ablassen.";
const A3 = "Danach die Dichtheit prüfen.";
const TEXT = [A1, A2, A3].join("\n\n");
const A1_NEU = "Bei Überdruck schließt Ventil X selbsttätig und hörbar.";
const A3_NEU = "Danach die Dichtheit mit Lecksuchspray prüfen.";

interface Person {
  id: string;
  name: string;
  email: string;
  page: Page;
}

/** Legt ein Konto an (als Smoke-Admin) und meldet es in einem eigenen Browserkontext an. */
async function person(admin: Page, browser: Browser, name: string, email: string): Promise<Person> {
  const res = await admin.request.post("/api/users", {
    data: { name, email, password: SMOKE_PASS, role: "experte" },
  });
  expect(res.status(), await res.text()).toBe(201);
  const id = ((await res.json()) as { id: string }).id;
  return { id, name, email, page: await anmelden(browser, email) };
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const kontext = await browser.newContext();
  const page = await kontext.newPage();
  await page.goto("/");
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(SMOKE_PASS);
  await page.locator('button[type="submit"]').click();
  await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });
  // Den Pflichthinweis quittieren, damit kein Banner über der Seite liegt.
  await page.request.post("/api/auth/notice");
  return page;
}

async function artikel(admin: Page, titel: string): Promise<string> {
  const res = await admin.request.post("/api/kos", {
    data: {
      confidentiality: "intern",
      title: titel,
      statement: TEXT,
      bodyHtml: `<p>${A1}</p><p>${A2}</p><p>${A3}</p>`,
      type: "best_practice",
      category: "Betrieb",
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

async function beleg(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

const zustand = (p: Person) => p.page.getByTestId("gemeinsam-speicherstand");
const textfeld = (p: Person) => p.page.getByTestId("gemeinsam-text");

async function speichern(p: Person): Promise<void> {
  await p.page.getByTestId("gemeinsam-speichern").click();
}

test("K1/K2/K3: aus dem Artikelgespräch zum selben Entwurf — Anwesenheit, Zusammenführen, Konflikt mit Wahl", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  const m = marke();
  const titel = `Ventil X ${m}`;
  const anna = await person(page, browser, `Anna ${m}`, `anna-${m}@gemeinsam.test`);
  const bert = await person(page, browser, `Bert ${m}`, `bert-${m}@gemeinsam.test`);
  const koId = await artikel(page, titel);

  // --- K1 · Anna: Artikel → Artikelgespräch → gemeinsamer Entwurf ------------------------------
  await anna.page.goto(`/wissen/${koId}`);
  await anna.page.getByTestId("artikel-gespraech").click();
  await expect(anna.page.getByTestId("chat-gespraech-titel")).toHaveText(titel, {
    timeout: 15_000,
  });
  await anna.page.getByTestId("chat-artikel-gemeinsam").click();
  await expect(anna.page).toHaveURL(new RegExp(`/wissen/${koId}/gemeinsam$`));
  await anna.page.getByTestId("gemeinsam-oeffnen").click();
  const entwurfBeiAnna = anna.page.getByTestId("gemeinsam-entwurf");
  await expect(entwurfBeiAnna).toBeVisible({ timeout: 15_000 });
  const entwurfId = await entwurfBeiAnna.getAttribute("data-entwurf");
  expect(entwurfId).toBeTruthy();
  await beleg(anna.page, "K1 Anna öffnet den gemeinsamen Entwurf aus dem Artikelgespräch");

  // --- K1 · Bert: dasselbe Gespräch aus seiner Liste → derselbe Entwurf ---------------------------
  await bert.page.goto("/chat");
  const eintrag = bert.page.getByTestId("chat-gespraech-eintrag").filter({ hasText: titel });
  await expect(eintrag.first()).toBeVisible({ timeout: 15_000 });
  await eintrag.first().click();
  await bert.page.getByTestId("chat-artikel-gemeinsam").click();
  const entwurfBeiBert = bert.page.getByTestId("gemeinsam-entwurf");
  await expect(entwurfBeiBert).toHaveAttribute("data-entwurf", entwurfId ?? "", {
    timeout: 15_000,
  });
  await expect(textfeld(bert)).toHaveValue(TEXT);

  // --- K3 · Anwesenheit und Speicherstand -------------------------------------------------------
  await expect(anna.page.getByTestId("gemeinsam-anwesend-satz")).toContainText(bert.name, {
    timeout: 15_000,
  });
  await expect(zustand(bert)).toHaveAttribute("data-zustand", "gespeichert");
  await expect(zustand(bert)).toContainText(anna.name);
  await beleg(anna.page, "K3 Anna sieht Bert im Entwurf");

  // --- K2 · verschiedene Abschnitte -------------------------------------------------------------
  await textfeld(bert).fill(TEXT.replace(A3, A3_NEU));
  await expect(zustand(bert)).toHaveAttribute("data-zustand", "ungespeichert");
  await textfeld(anna).fill(TEXT.replace(A1, A1_NEU));
  await speichern(anna);
  await expect(zustand(anna)).toHaveAttribute("data-zustand", "gespeichert", { timeout: 15_000 });
  await expect(bert.page.getByTestId("gemeinsam-fremd")).toContainText(anna.name, {
    timeout: 15_000,
  });
  await beleg(bert.page, "K2 Bert wird über Annas neuen Stand informiert");
  await speichern(bert);
  await expect(zustand(bert)).toHaveAttribute("data-zustand", "gespeichert", { timeout: 15_000 });
  await expect(zustand(bert)).toContainText(anna.name);
  await expect(textfeld(bert)).toHaveValue([A1_NEU, A2, A3_NEU].join("\n\n"));
  await expect(textfeld(anna)).toHaveValue([A1_NEU, A2, A3_NEU].join("\n\n"), { timeout: 15_000 });
  await beleg(bert.page, "K2 zusammengeführt — beide Änderungen im Text");

  // --- K2 · derselbe Abschnitt: Konflikt mit Wahl -------------------------------------------------
  const zusammen = [A1_NEU, A2, A3_NEU].join("\n\n");
  const berts = "Vorher den Druck über Ventil Z ablassen.";
  const annas = "Vorher den Druck VOLLSTÄNDIG ablassen.";
  await textfeld(bert).fill(zusammen.replace(A2, berts));
  await textfeld(anna).fill(zusammen.replace(A2, annas));
  await speichern(anna);
  await expect(zustand(anna)).toHaveAttribute("data-zustand", "gespeichert", { timeout: 15_000 });
  await speichern(bert);
  const konflikt = bert.page.getByTestId("gemeinsam-konflikt");
  await expect(konflikt).toBeVisible({ timeout: 15_000 });
  await expect(konflikt.getByTestId("gemeinsam-konflikt-meine")).toContainText(berts);
  await expect(konflikt.getByTestId("gemeinsam-konflikt-deren")).toContainText(annas);
  await expect(textfeld(bert)).toHaveValue(zusammen.replace(A2, berts));
  await beleg(bert.page, "K2 Konflikt an derselben Stelle — beide Fassungen sichtbar");
  await bert.page.getByTestId("gemeinsam-wahl-beide").click();
  await bert.page.getByTestId("gemeinsam-konflikt-uebernehmen").click();
  await speichern(bert);
  await expect(zustand(bert)).toHaveAttribute("data-zustand", "gespeichert", { timeout: 15_000 });
  const loesung = [A1_NEU, annas, berts, A3_NEU].join("\n\n");
  await expect(textfeld(anna)).toHaveValue(loesung, { timeout: 15_000 });
  await beleg(anna.page, "K2 Lösung bei Anna angekommen");
});

test("K4/K5/K6: Lesefassung bleibt, Verbindungsabbruch hält die Eingabe, Übernahme als neue Fassung, unabhängig neu geöffnet", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  const m = marke();
  const titel = `Ventil Y ${m}`;
  const bert = await person(page, browser, `Bert ${m}`, `bert-${m}@gemeinsam.test`);
  const anna = await person(page, browser, `Anna ${m}`, `anna-${m}@gemeinsam.test`);
  const koId = await artikel(page, titel);

  await bert.page.goto(`/wissen/${koId}/gemeinsam`);
  await bert.page.getByTestId("gemeinsam-oeffnen").click();
  await expect(textfeld(bert)).toHaveValue(TEXT, { timeout: 15_000 });

  // --- K5 · Verbindungsabbruch: die Eingabe bleibt -----------------------------------------------
  await textfeld(bert).fill(TEXT.replace(A3, A3_NEU));
  await bert.page.context().setOffline(true);
  await speichern(bert);
  await expect(zustand(bert)).toHaveAttribute("data-zustand", "unterbrochen", { timeout: 15_000 });
  await expect(textfeld(bert)).toHaveValue(TEXT.replace(A3, A3_NEU));
  await beleg(bert.page, "K5 Verbindung unterbrochen — Eingabe steht noch da");
  await bert.page.context().setOffline(false);
  await bert.page.reload();
  await expect(bert.page.getByTestId("gemeinsam-wiederhergestellt")).toBeVisible({
    timeout: 15_000,
  });
  await expect(textfeld(bert)).toHaveValue(TEXT.replace(A3, A3_NEU));
  await speichern(bert);
  await expect(zustand(bert)).toHaveAttribute("data-zustand", "gespeichert", { timeout: 15_000 });
  await beleg(bert.page, "K5 nach Neuladen wiederhergestellt und gespeichert");

  // --- K4 · bis zur Übernahme liest der Artikel die gültige Fassung --------------------------------
  const vorher = await anna.page.request.get(`/api/kos/${koId}`);
  expect(((await vorher.json()) as { statement: string }).statement).toBe(TEXT);
  await anna.page.goto(`/wissen/${koId}`);
  await expect(anna.page.getByText(A3, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(anna.page.getByText(A3_NEU)).toHaveCount(0);
  await beleg(anna.page, "K4 Anna liest die gültige Fassung, solange der Entwurf offen ist");

  // --- K6 · Übernahme als neue Fassung ------------------------------------------------------------
  await expect(bert.page.getByTestId("gemeinsam-uebernahme")).toHaveAttribute("data-weg", "direkt");
  await bert.page.getByTestId("gemeinsam-uebernehmen").click();
  await expect(bert.page.getByTestId("gemeinsam-abgeschlossen")).toHaveAttribute(
    "data-zustand",
    "uebernommen",
    { timeout: 15_000 },
  );
  await beleg(bert.page, "K6 Entwurf als neue Fassung übernommen");

  // Eine unabhängige, frische Anmeldung liest das tatsächliche Ergebnis.
  const frisch = await anmelden(browser, anna.email);
  await frisch.goto(`/wissen/${koId}`);
  await expect(frisch.getByText(A3_NEU).first()).toBeVisible({ timeout: 15_000 });
  const ko = (await (await frisch.request.get(`/api/kos/${koId}`)).json()) as {
    version: number;
    history: Array<{ version: number; author: string }>;
  };
  expect(ko.version).toBe(2);
  expect(ko.history[ko.history.length - 1]).toMatchObject({ version: 2, author: bert.id });
  await beleg(frisch, "K6 frische Anmeldung liest die übernommene Fassung");
});
