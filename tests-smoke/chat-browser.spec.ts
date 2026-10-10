import { type Browser, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// INTERNER CHAT IN DER ECHTEN APP — zwei Konten in zwei Browsern (produkt:20261007:interner-chat).
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server. Das Smoke-Konto (Admin) legt nur
// die beiden Testkonten, den Space und den Rechteentzug an; alles Übrige tun Anna und Bert in je
// EINEM EIGENEN Browserkontext:
//   K1 · Direktgespräch hin und zurück, Gruppe, Space- und Artikelgespräch.
//   K2 · Neuladen erhält den Verlauf; eine fehlgeschlagene Sendung steht sichtbar da, „Erneut senden"
//        schickt dieselbe Sendekennung und es steht genau EINE Nachricht im Verlauf.
//   K3 · Die Erwähnung öffnet genau die Nachricht; der Artikelrücklink genau den Artikel.
//   K4 · Ein Artikelverweis wird nach dem Rechteentzug „nicht verfügbar" — ohne Titel.
//   K5 · Klaras Markierung (fiktiver Vorschauartikel) wird erst durch „Senden" zur Nachricht;
//        Empfänger und Text stehen vorher sichtbar da.
//   K6 · „In Wissen übernehmen" legt Berts persönlichen Entwurf an; Anna sieht den Vermerk nicht.
//
// WAS SIMULIERT IST — ehrlich benannt: der Smoke-Server hat keinen Störschalter. Die erste Sendung
// des K2-Falls wird deshalb unterwegs abgebrochen (sie erreicht den Server NICHT); die Wiederholung
// läuft unverändert gegen den Server. Den Fall „Server hat gespeichert, Antwort ging verloren" misst
// `tests/interner-chat/chat-api.test.ts` (K2) und gegen PostgreSQL `chat-pg.integration.test.ts`.
//
// JEDER LAUF HAT SEINE EIGENEN NAMEN; alle Konten und Inhalte sind erfundene Testdaten.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

interface Person {
  id: string;
  name: string;
  page: Page;
}

/** Legt ein Konto an (als Smoke-Admin) und meldet es in einem eigenen Browserkontext an. */
async function person(admin: Page, browser: Browser, name: string, email: string): Promise<Person> {
  const res = await admin.request.post("/api/users", {
    data: { name, email, password: SMOKE_PASS, role: "experte" },
  });
  expect(res.status(), await res.text()).toBe(201);
  const id = ((await res.json()) as { id: string }).id;
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
  return { id, name, page };
}

async function beleg(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

async function oeffneGespraech(p: Person, titel: string): Promise<void> {
  await p.page.goto("/chat");
  await expect(p.page.getByTestId("page-chat")).toBeVisible({ timeout: 15_000 });
  const eintrag = p.page.getByTestId("chat-gespraech-eintrag").filter({ hasText: titel });
  await expect(eintrag.first()).toBeVisible({ timeout: 15_000 });
  await eintrag.first().click();
  await expect(p.page.getByTestId("chat-gespraech")).toBeVisible({ timeout: 15_000 });
}

async function schreiben(p: Person, text: string): Promise<void> {
  await p.page.getByTestId("chat-eingabe").fill(text);
  await p.page.getByTestId("chat-senden").click();
}

function nachricht(p: Person, text: string) {
  return p.page.getByTestId("chat-nachricht").filter({ hasText: text });
}

test.describe("Interner Chat · zwei Konten in der echten App", () => {
  test("K1/K2/K3: Direkt, Gruppe, Space und Artikel — Neuladen, Fehlsendung, Erwähnung, Rücklink", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await ensureLoggedIn(page);
    const m = marke();
    const anna = await person(page, browser, `Anna ${m}`, `anna-${m}@chat.test`);
    const bert = await person(page, browser, `Bert ${m}`, `bert-${m}@chat.test`);

    // --- K1 · Anna beginnt das Direktgespräch über das Formular -------------------------------
    await anna.page.goto("/chat");
    await expect(anna.page.getByTestId("page-chat")).toBeVisible({ timeout: 15_000 });
    await anna.page.getByTestId("chat-neu-art").selectOption("direkt");
    await anna.page.getByTestId("chat-neu-person").selectOption({ label: bert.name });
    await anna.page.getByTestId("chat-neu-oeffnen").click();
    await expect(anna.page.getByTestId("chat-gespraech-titel")).toHaveText(bert.name, {
      timeout: 15_000,
    });
    const kopf = anna.page.getByTestId("chat-gespraech");
    await expect(kopf.getByTestId("chat-sichtbarkeit")).toHaveText("Persönlich");
    const direktUrl = anna.page.url();

    // --- K3 · mit Erwähnung senden --------------------------------------------------------------
    await anna.page.getByTestId("chat-eingabe").fill("Ist das Bohrwerk heute frei?");
    await anna.page.getByTestId("chat-erwaehnen").selectOption({ label: bert.name });
    await expect(anna.page.getByTestId("chat-erwaehnt-chip")).toContainText(bert.name);
    await anna.page.getByTestId("chat-senden").click();
    const ersteBeiAnna = nachricht(anna, "Ist das Bohrwerk heute frei?");
    await expect(ersteBeiAnna).toHaveAttribute("data-status", "gesendet", { timeout: 15_000 });
    await expect(ersteBeiAnna.getByTestId("chat-erwaehnt")).toContainText(bert.name);

    // --- K1 · Bert empfängt und antwortet --------------------------------------------------------
    await oeffneGespraech(bert, anna.name);
    const ersteBeiBert = nachricht(bert, "Ist das Bohrwerk heute frei?");
    await expect(ersteBeiBert).toHaveAttribute("data-status", "empfangen");
    await expect(ersteBeiBert).toContainText(anna.name);
    await schreiben(bert, "Ja, ab 14 Uhr.");
    await expect(nachricht(bert, "Ja, ab 14 Uhr.")).toHaveAttribute("data-status", "gesendet", {
      timeout: 15_000,
    });
    await beleg(bert.page, "K1 Bert hat empfangen und geantwortet");

    // --- K2 · Neuladen: der Verlauf bleibt -------------------------------------------------------
    await anna.page.goto(direktUrl);
    await anna.page.reload();
    await expect(nachricht(anna, "Ja, ab 14 Uhr.")).toHaveCount(1, { timeout: 15_000 });
    await expect(nachricht(anna, "Ist das Bohrwerk heute frei?")).toHaveCount(1);

    // --- K2 · fehlgeschlagene Sendung, dann „Erneut senden" mit derselben Kennung --------------
    const kennungen: string[] = [];
    anna.page.on("request", (r) => {
      if (r.method() === "POST" && /\/api\/chat\/gespraeche\/[^/]+\/nachrichten$/.test(r.url())) {
        kennungen.push(((r.postDataJSON() ?? {}) as { sendeKennung?: string }).sendeKennung ?? "");
      }
    });
    let abbrechen = true;
    await anna.page.route("**/api/chat/gespraeche/*/nachrichten", async (route) => {
      if (abbrechen) {
        abbrechen = false;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await schreiben(anna, "Ich komme um 14 Uhr.");
    const fehl = anna.page.locator('[data-testid="chat-nachricht"][data-status="fehlgeschlagen"]');
    await expect(fehl).toContainText("Ich komme um 14 Uhr.", { timeout: 15_000 });
    await expect(fehl.getByTestId("chat-status")).toContainText("Nicht gesendet");
    await beleg(anna.page, "K2 fehlgeschlagene Sendung sichtbar");
    await fehl.getByTestId("chat-erneut").click();
    await expect(nachricht(anna, "Ich komme um 14 Uhr.")).toHaveAttribute(
      "data-status",
      "gesendet",
      { timeout: 15_000 },
    );
    expect(kennungen).toHaveLength(2);
    expect(kennungen[0]).not.toBe("");
    expect(kennungen[1], "die Wiederholung schickt dieselbe Sendekennung").toBe(kennungen[0]);
    await anna.page.unroute("**/api/chat/gespraeche/*/nachrichten");
    await anna.page.reload();
    await expect(nachricht(anna, "Ich komme um 14 Uhr.")).toHaveCount(1, { timeout: 15_000 });

    // --- K3 · Bert öffnet die Erwähnung und landet genau auf der Nachricht ---------------------
    await bert.page.goto("/chat");
    const erwaehnung = bert.page.getByTestId("chat-erwaehnung").first();
    await expect(erwaehnung).toContainText(anna.name, { timeout: 15_000 });
    const erwaehnteId = await erwaehnung.getAttribute("data-nachricht");
    await erwaehnung.click();
    const ziel = bert.page.locator(
      `[data-testid="chat-nachricht"][data-nachricht="${erwaehnteId}"]`,
    );
    await expect(ziel).toHaveAttribute("data-hervorgehoben", "ja", { timeout: 15_000 });
    await expect(ziel).toContainText("Ist das Bohrwerk heute frei?");
    await expect(bert.page).toHaveURL(new RegExp(`nachricht=${erwaehnteId}`));
    await beleg(bert.page, "K3 Erwähnung öffnet die Nachricht");

    // --- K1 · Gruppe ------------------------------------------------------------------------------
    await anna.page.goto("/chat");
    await anna.page.getByTestId("chat-neu-art").selectOption("gruppe");
    await anna.page.getByTestId("chat-neu-gruppenname").fill(`Schicht ${m}`);
    await anna.page.locator(`[data-testid="chat-neu-mitglied"][data-konto="${bert.id}"]`).check();
    await anna.page.getByTestId("chat-neu-oeffnen").click();
    await expect(anna.page.getByTestId("chat-gespraech-titel")).toHaveText(`Schicht ${m}`, {
      timeout: 15_000,
    });
    await schreiben(anna, "Übergabe um 6 Uhr.");
    await expect(nachricht(anna, "Übergabe um 6 Uhr.")).toHaveAttribute("data-status", "gesendet", {
      timeout: 15_000,
    });
    await oeffneGespraech(bert, `Schicht ${m}`);
    await expect(nachricht(bert, "Übergabe um 6 Uhr.")).toHaveAttribute("data-status", "empfangen");

    // --- K1 · Spacegespräch über den Knopf am Space ----------------------------------------------
    const space = await page.request.post("/api/spaces", {
      data: {
        name: `Werkstatt ${m}`,
        zweck: "Bohrwerk der Werkstatt.",
        verantwortlich: anna.id,
        zugang: "mitglieder",
        mitglieder: [{ nutzer: bert.id, recht: "lesen" }],
        ansichten: [],
      },
    });
    expect(space.status(), await space.text()).toBe(201);
    const spaceId = ((await space.json()) as { id: string }).id;
    await anna.page.goto(`/spaces/${spaceId}`);
    await anna.page.getByTestId("space-gespraech").click();
    await expect(anna.page.getByTestId("chat-gespraech-titel")).toHaveText(`Werkstatt ${m}`, {
      timeout: 15_000,
    });
    await schreiben(anna, "Fett ist bestellt.");
    await expect(nachricht(anna, "Fett ist bestellt.")).toHaveAttribute("data-status", "gesendet", {
      timeout: 15_000,
    });
    await oeffneGespraech(bert, `Werkstatt ${m}`);
    await expect(nachricht(bert, "Fett ist bestellt.")).toHaveAttribute("data-status", "empfangen");

    // --- K1/K3 · Artikelgespräch über den Knopf am Artikel; Rücklink führt genau dorthin --------
    const angelegt = await anna.page.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: `Spindelschmierung ${m}`,
        statement: `Die Spindel ${m} wird wöchentlich geschmiert.`,
        type: "best_practice",
        category: "Instandhaltung",
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const koId = ((await angelegt.json()) as { id: string }).id;
    await anna.page.goto(`/wissen/${koId}`);
    await anna.page.getByTestId("artikel-gespraech").click();
    const ruecklink = anna.page.getByTestId("chat-artikel-ruecklink");
    await expect(ruecklink).toContainText(`Spindelschmierung ${m}`, { timeout: 15_000 });
    await schreiben(anna, "Gilt das auch für Bohrwerk 2?");
    await expect(nachricht(anna, "Gilt das auch für Bohrwerk 2?")).toHaveAttribute(
      "data-status",
      "gesendet",
      { timeout: 15_000 },
    );
    await oeffneGespraech(bert, `Spindelschmierung ${m}`);
    await expect(nachricht(bert, "Gilt das auch für Bohrwerk 2?")).toBeVisible();
    await bert.page.getByTestId("chat-artikel-ruecklink").click();
    await expect(bert.page).toHaveURL(new RegExp(`/wissen/${koId}`), { timeout: 15_000 });
    await beleg(bert.page, "K3 Artikelrücklink öffnet den Artikel");

    await anna.page.context().close();
    await bert.page.context().close();
  });

  test("K4/K6: Verweis nach Rechteentzug gesperrt; Nachricht als persönlicher Entwurf übernommen", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await ensureLoggedIn(page);
    const m = marke();
    const anna = await person(page, browser, `Anna ${m}`, `anna-${m}@chat.test`);
    const bert = await person(page, browser, `Bert ${m}`, `bert-${m}@chat.test`);
    const titel = `Kalibrierplan ${m}`;
    const angelegt = await anna.page.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: titel,
        statement: `Der Kalibrierplan ${m} gilt für alle Messschieber.`,
        type: "best_practice",
        category: "Prüfmittel",
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const koId = ((await angelegt.json()) as { id: string }).id;
    const g = await anna.page.request.post("/api/chat/gespraeche", {
      data: { art: "direkt", teilnehmer: [bert.id] },
    });
    expect(g.status(), await g.text()).toBe(201);
    const gespraechId = ((await g.json()) as { id: string }).id;

    await anna.page.goto(`/chat/${gespraechId}`);
    await schreiben(anna, `Bitte lesen: /wissen/${koId} — Messschieber jährlich kalibrieren.`);
    await expect(nachricht(anna, "Messschieber jährlich")).toHaveAttribute(
      "data-status",
      "gesendet",
      { timeout: 15_000 },
    );

    // Vorher: Bert sieht den Verweis mit Titel.
    await bert.page.goto(`/chat/${gespraechId}`);
    const beiBert = nachricht(bert, "Messschieber jährlich");
    await expect(beiBert.getByTestId("chat-verweis")).toContainText(titel, { timeout: 15_000 });

    // K6 · Bert übernimmt die Nachricht in Wissen — als SEIN persönlicher Entwurf.
    await beiBert.getByTestId("chat-wissen").click();
    await expect(beiBert.getByTestId("chat-wissen-erfolgt")).toContainText("persönlicher Entwurf", {
      timeout: 15_000,
    });
    const entwurfHref = await beiBert.getByTestId("chat-wissen-entwurf").getAttribute("href");
    const entwurfId = new URLSearchParams((entwurfHref ?? "").split("?")[1] ?? "").get("draft");
    expect(entwurfId).toBeTruthy();
    const entwuerfe = (await (await bert.page.request.get("/api/drafts")).json()) as {
      id: string;
      originalAuthor: string;
      payload: { confidentiality?: string };
    }[];
    const entwurf = entwuerfe.find((d) => d.id === entwurfId);
    expect(entwurf?.originalAuthor).toBe(bert.id);
    expect(entwurf?.payload.confidentiality).toBe("vertraulich");
    await beleg(bert.page, "K6 als persönlicher Entwurf übernommen");
    // Anna sieht Berts Übernahme nicht.
    await anna.page.reload();
    await expect(nachricht(anna, "Messschieber jährlich")).toBeVisible({ timeout: 15_000 });
    await expect(anna.page.getByTestId("chat-wissen-erfolgt")).toHaveCount(0);

    // K4 · Rechteentzug: der Artikel wandert in einen Space, in dem nur Anna Mitglied ist.
    const space = await page.request.post("/api/spaces", {
      data: {
        name: `Geschlossen ${m}`,
        zweck: "Nur für Anna.",
        verantwortlich: anna.id,
        zugang: "mitglieder",
        mitglieder: [],
        ansichten: [],
      },
    });
    expect(space.status(), await space.text()).toBe(201);
    const spaceId = ((await space.json()) as { id: string }).id;
    const v = await anna.page.request.post("/api/spaces/verschiebung/vorschau", {
      data: { koId, zielSpaceId: spaceId },
    });
    expect(v.status(), await v.text()).toBe(200);
    const vorschau = (await v.json()) as {
      quelle: { id: string; version: number } | null;
      ziel: { id: string; version: number } | null;
    };
    const wechsel = await anna.page.request.post("/api/spaces/verschiebung", {
      data: {
        koId,
        zielSpaceId: spaceId,
        basis: {
          quelleId: vorschau.quelle?.id ?? null,
          quelleVersion: vorschau.quelle?.version ?? null,
          zielId: vorschau.ziel?.id ?? null,
          zielVersion: vorschau.ziel?.version ?? null,
        },
      },
    });
    expect(wechsel.status(), await wechsel.text()).toBe(200);

    await bert.page.reload();
    const nachher = nachricht(bert, "Messschieber jährlich");
    await expect(nachher.getByTestId("chat-verweis-gesperrt")).toBeVisible({ timeout: 15_000 });
    await expect(nachher.getByTestId("chat-verweis")).toHaveCount(0);
    await expect(bert.page.getByTestId("chat-gespraech")).not.toContainText(titel);
    await beleg(bert.page, "K4 Verweis nach Rechteentzug nicht verfügbar");
    // Anna (Mitglied) sieht den Verweis weiter.
    await anna.page.reload();
    await expect(
      nachricht(anna, "Messschieber jährlich").getByTestId("chat-verweis"),
    ).toContainText(titel, { timeout: 15_000 });

    await anna.page.context().close();
    await bert.page.context().close();
  });

  test("K5: Klara-Markierung wird erst durch Senden zur Nachricht — Empfänger und Text vorher sichtbar", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await ensureLoggedIn(page);
    const m = marke();
    const anna = await person(page, browser, `Anna ${m}`, `anna-${m}@chat.test`);
    const bert = await person(page, browser, `Bert ${m}`, `bert-${m}@chat.test`);
    const g = await anna.page.request.post("/api/chat/gespraeche", {
      data: { art: "direkt", teilnehmer: [bert.id] },
    });
    expect(g.status(), await g.text()).toBe(201);
    const gespraechId = ((await g.json()) as { id: string }).id;
    await anna.page.setViewportSize({ width: 1280, height: 900 });

    // Fiktiver Vorschauartikel, Absatz markieren, Klara öffnen.
    await anna.page.goto("/klara-vorschau");
    await expect(anna.page.getByTestId("page-klara-vorschau")).toBeVisible({ timeout: 15_000 });
    await anna.page.getByTestId("klara-vorschau-oeffnen-foerderbandrolle").click();
    const absatz = anna.page.locator('[data-klara-absatz="2"]');
    await absatz.click({ clickCount: 3 });
    await anna.page.getByTestId("klara-auswahl-knopf").click();
    const markiert = (
      (await anna.page.getByTestId("klara-auswahl-text").textContent()) ?? ""
    ).trim();
    expect(markiert.length).toBeGreaterThan(10);

    await anna.page.getByTestId("klara-aktion-nachricht").click();
    await expect(anna.page).toHaveURL(/\/chat\?klara=1/, { timeout: 15_000 });
    // Klaras Gesprächsfläche schließen, damit sie nicht über dem Entwurf liegt.
    if (await anna.page.getByTestId("klara-gespraech").isVisible()) {
      await anna.page.getByTestId("klara-schliessen").click();
    }
    const entwurf = anna.page.getByTestId("chat-klara-entwurf");
    await expect(entwurf).toBeVisible({ timeout: 15_000 });
    await expect(entwurf.getByTestId("chat-klara-ausschnitt")).toContainText(markiert.slice(0, 40));
    await expect(entwurf.getByTestId("chat-klara-ausschnitt")).toContainText("Fiktive Markierung");
    await expect(entwurf.getByTestId("chat-klara-senden")).toBeDisabled();

    // Noch nichts gesendet: der Server kennt keine Nachricht.
    const vorher = await anna.page.request.get(`/api/chat/gespraeche/${gespraechId}`);
    expect(((await vorher.json()) as { nachrichten: unknown[] }).nachrichten).toEqual([]);

    await entwurf.getByTestId("chat-klara-ziel").selectOption(gespraechId);
    await expect(entwurf.getByTestId("chat-klara-empfaenger")).toContainText(bert.name);
    await expect(entwurf.getByTestId("chat-klara-empfaenger")).toContainText("Persönlich");
    await entwurf.getByTestId("chat-klara-text").fill("Schau dir diese Stelle an, bitte.");
    await beleg(anna.page, "K5 Empfänger und Text vor dem Senden sichtbar");
    const nochNichts = await anna.page.request.get(`/api/chat/gespraeche/${gespraechId}`);
    expect(((await nochNichts.json()) as { nachrichten: unknown[] }).nachrichten).toEqual([]);

    await entwurf.getByTestId("chat-klara-senden").click();
    await expect(anna.page).toHaveURL(new RegExp(`/chat/${gespraechId}`), { timeout: 15_000 });
    await expect(anna.page.getByTestId("chat-klara-entwurf")).toHaveCount(0);
    const gesendet = nachricht(anna, "Schau dir diese Stelle an, bitte.");
    await expect(gesendet).toHaveAttribute("data-status", "gesendet", { timeout: 15_000 });
    await expect(gesendet.getByTestId("chat-aus-klara")).toBeVisible();
    await expect(gesendet.getByTestId("chat-ausschnitt")).toHaveAttribute("data-fiktiv", "ja");

    await bert.page.goto(`/chat/${gespraechId}`);
    const beiBert = nachricht(bert, "Schau dir diese Stelle an, bitte.");
    await expect(beiBert.getByTestId("chat-ausschnitt")).toContainText(markiert.slice(0, 40), {
      timeout: 15_000,
    });
    await expect(beiBert.getByTestId("chat-ausschnitt")).toContainText("Fiktive Markierung");
    await beleg(bert.page, "K5 Bert empfängt die bewusst gesendete Markierung");
    const nachher = await anna.page.request.get(`/api/chat/gespraeche/${gespraechId}`);
    expect(((await nachher.json()) as { nachrichten: unknown[] }).nachrichten).toHaveLength(1);

    await anna.page.context().close();
    await bert.page.context().close();
  });

  // Nacharbeit 3 (Ben, K2/K3): nach mehr als 500 neueren Nachrichten öffnet die Erwähnung trotzdem
  // genau ihre Nachricht, und der ältere Verlauf lässt sich nachladen.
  test("K2/K3: alte Erwähnung nach über 500 neueren Nachrichten — Ziel öffnet, älterer Verlauf lädt nach", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    await ensureLoggedIn(page);
    const m = marke();
    const anna = await person(page, browser, `Anna ${m}`, `anna-${m}@chat.test`);
    const bert = await person(page, browser, `Bert ${m}`, `bert-${m}@chat.test`);
    const g = await anna.page.request.post("/api/chat/gespraeche", {
      data: { art: "direkt", teilnehmer: [bert.id] },
    });
    expect(g.status(), await g.text()).toBe(201);
    const gespraechId = ((await g.json()) as { id: string }).id;
    const url = `/api/chat/gespraeche/${gespraechId}/nachrichten`;
    const alt = await anna.page.request.post(url, {
      data: {
        text: `Alte Frage ${m} an Bert`,
        sendeKennung: `alt-${m}-0001`,
        erwaehnungen: [bert.id],
      },
    });
    expect(alt.status(), await alt.text()).toBe(201);
    const altId = ((await alt.json()) as { nachricht: { id: string } }).nachricht.id;
    await new Promise((fertig) => setTimeout(fertig, 10));
    for (let i = 0; i < 502; i += 1) {
      const res = await anna.page.request.post(url, {
        data: { text: `Laufende Meldung ${i}`, sendeKennung: `lauf-${m}-${i}` },
      });
      expect(res.status()).toBe(201);
    }

    await bert.page.goto("/chat");
    const erwaehnung = bert.page.locator(
      `[data-testid="chat-erwaehnung"][data-nachricht="${altId}"]`,
    );
    await expect(erwaehnung).toBeVisible({ timeout: 15_000 });
    await erwaehnung.click();
    const zielblock = bert.page.getByTestId("chat-ziel");
    const ziel = zielblock.locator(`[data-testid="chat-nachricht"][data-nachricht="${altId}"]`);
    await expect(ziel).toHaveAttribute("data-hervorgehoben", "ja", { timeout: 15_000 });
    await expect(ziel).toContainText(`Alte Frage ${m} an Bert`);
    await beleg(bert.page, "K3 alte Erwähnung öffnet ihre Nachricht");

    // Der ältere Verlauf lädt nach; danach steht die Nachricht im Verlauf selbst.
    await bert.page.getByTestId("chat-aeltere").click();
    const imVerlauf = bert.page
      .getByTestId("chat-verlauf")
      .locator(`[data-testid="chat-nachricht"][data-nachricht="${altId}"]`);
    await expect(imVerlauf).toBeVisible({ timeout: 15_000 });
    await expect(bert.page.getByTestId("chat-ziel")).toHaveCount(0);
    await expect(bert.page.getByTestId("chat-aeltere")).toHaveCount(0);
    await expect(bert.page.getByTestId("chat-verlauf").getByTestId("chat-nachricht")).toHaveCount(
      503,
    );
    await beleg(bert.page, "K2 älterer Verlauf nachgeladen");

    await anna.page.context().close();
    await bert.page.context().close();
  });
});
