import { type APIRequestContext, type Browser, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// VORLAGEN IN DER ECHTEN APP — persönlicher Standard, Wechsel, Teilen, Fassung, Space-Pflicht
// (produkt:20261007:templates-default · ADMIN-08).
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server (isolierter Testbestand, im
// Speicher). Jeder Lauf hat eine eigene Marke und eigene, erfundene Konten; Entwürfe räumt er ab.
//
//   K1      Standard auf /vorlagen wählen → Reload → neue Eingabe im Blatt findet ihn vorgewählt.
//   K2      Vorlage eines gespeicherten Entwurfs wechseln: Vorschau nennt, was wohin geht;
//           eingegebene Werte stehen danach weiter da; nach Speichern + Reload gilt die neue.
//   K3/K10  Eigene Vorlage in der Oberfläche anlegen und im Space teilen; zweite Person wendet an.
//   K5/K10  Bearbeiten zeigt Auswirkungen (Nutzung) vor der neuen Fassung; der Beitrag nennt die
//           Fassung, mit der er entstand.
//   K4/K8   Space-Vorgaben werden bei der Auswahl erklärt; „Prüfen“ zeigt verständliche Feldfehler.
//   K12     Tastatur (Öffnen, freie Eingabe), Betrachterin ohne Anlegen, 390 × 844 ohne Überbreite.
//
// WAS HIER NICHT GEMESSEN IST: ein echter, unvertrauter Mensch und PostgreSQL (der Smoke-Server
// läuft im Speicher); der Datenweg ist in `tests/vorlagen/vorlagen-api.test.ts` belegt.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

interface Konto {
  id: string;
  email: string;
}

async function kontoAnlegen(
  request: APIRequestContext,
  daten: { name: string; email: string; role: string },
): Promise<Konto> {
  const res = await request.post("/api/users", { data: { ...daten, password: SMOKE_PASS } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Konto;
}

async function ich(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/auth/me");
  expect(res.status()).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

async function angemeldet(browser: Browser, baseURL: string, email: string): Promise<Page> {
  const kontext = await browser.newContext({ baseURL });
  const res = await kontext.request.post("/api/auth/login", {
    data: { email, password: SMOKE_PASS },
  });
  expect(res.status(), await res.text()).toBe(200);
  // Der Nutzungshinweis eines neuen Kontos ist bestätigt — wie es `ensureLoggedIn` für die
  // Smoke-Sitzung tut; er ist nicht Gegenstand dieser Probe.
  const hinweis = await kontext.request.post("/api/auth/notice");
  expect(hinweis.ok(), await hinweis.text()).toBe(true);
  return kontext.newPage();
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function ohneUeberbreite(page: Page, wo: string): Promise<void> {
  const breiten = await page.evaluate(() => ({
    inhalt: document.documentElement.scrollWidth,
    fenster: window.innerWidth,
  }));
  expect(breiten.inhalt, `${wo}: Überbreite`).toBeLessThanOrEqual(breiten.fenster + 1);
}

const fliesstext = (page: Page) =>
  page.getByRole("textbox", { name: "Wissensseite — Fließtext" }).first();

async function entwuerfeAufraeumen(page: Page, m: string): Promise<void> {
  const antwort = await page.request.get("/api/drafts");
  if (!antwort.ok()) {
    return;
  }
  const liste = (await antwort.json()) as { id: string; payload?: unknown }[];
  for (const d of liste.filter((x) => JSON.stringify(x.payload ?? {}).includes(m))) {
    await page.request.delete(`/api/drafts/${d.id}`);
  }
}

test.describe("Vorlagen · Standard, Wechsel, Teilen, Fassung, Space-Pflicht", () => {
  test("Lieferbeleg: persönlicher Standard, Space-Pflichtfeld, geteilte Vorlage, Fassungswechsel, Rechte, Reload", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (baseURL === undefined) {
      throw new Error("baseURL fehlt in der Smoke-Konfiguration.");
    }
    test.setTimeout(240_000);
    await ensureLoggedIn(page);
    const m = marke();
    const adminId = await ich(page.request);
    const erik = await kontoAnlegen(page.request, {
      name: `Erik Experte ${m}`,
      email: `erik-${m}@vorlagen.test`,
      role: "experte",
    });
    const mia = await kontoAnlegen(page.request, {
      name: `Mia Monteurin ${m}`,
      email: `mia-${m}@vorlagen.test`,
      role: "experte",
    });
    const vera = await kontoAnlegen(page.request, {
      name: `Vera Viewer ${m}`,
      email: `vera-${m}@vorlagen.test`,
      role: "viewer",
    });
    const spaceRes = await page.request.post("/api/spaces", {
      data: {
        name: `Instandhaltung ${m}`,
        zweck: "Fiktiver Arbeitsraum für den Vorlagen-Smoke.",
        verantwortlich: adminId,
        zugang: "mitglieder",
        mitglieder: [
          { nutzer: erik.id, recht: "schreiben" },
          { nutzer: mia.id, recht: "schreiben" },
        ],
        ansichten: [],
      },
    });
    expect(spaceRes.status(), await spaceRes.text()).toBe(201);
    const spaceId = ((await spaceRes.json()) as { id: string }).id;
    const vorgabe = await page.request.put(`/api/vorlagen/space-vorgaben/${spaceId}`, {
      data: {
        version: 0,
        verbindlicheVorlageId: null,
        kategorien: [],
        pflichtKategorie: true,
        mindestensTags: 1,
        tags: ["Pumpe"],
        hinweis: `Fiktiv (${m}): Anlage immer mit Kennung nennen.`,
      },
    });
    expect(vorgabe.status(), await vorgabe.text()).toBe(200);

    const ep = await angemeldet(browser, baseURL, erik.email);
    const mp = await angemeldet(browser, baseURL, mia.email);
    const vp = await angemeldet(browser, baseURL, vera.email);
    // Eriks Entwürfe ohne Marke im Inhalt (das Blatt mit der Standardvorlage) — per Kennung.
    const zuLoeschen: string[] = [];
    try {
      await ep.setViewportSize({ width: 1280, height: 800 });

      // --- K1 · Standard wählen, Reload, neue Eingabe findet ihn vor -----------------------------
      await ep.goto("/vorlagen");
      await expect(ep.getByTestId("vorlagen-seite")).toBeVisible({ timeout: 15_000 });
      const regelKarte = ep.locator('[data-testid="vorlage-karte"][data-vorlage="std-regel"]');
      await regelKarte.getByTestId("vorlage-als-standard").click();
      await expect(ep.getByTestId("vorlagen-mein-standard")).toContainText("Regel", {
        timeout: 15_000,
      });
      await ep.reload();
      await expect(ep.getByTestId("vorlagen-mein-standard")).toContainText("Regel", {
        timeout: 15_000,
      });
      await bild(ep, "k1-standard-gewaehlt-nach-reload");

      await ep.goto("/erfassen");
      await expect(fliesstext(ep)).toBeVisible({ timeout: 15_000 });
      await expect(ep.getByTestId("vorlagen-zeile-text")).toContainText("Regel", {
        timeout: 15_000,
      });
      await ep.getByTestId("vorlage-anwenden").click();
      await expect(fliesstext(ep)).toContainText("Die Regel");
      await bild(ep, "k1-neue-eingabe-mit-standard");
      // Sichern (ohne Stufe erlaubt) und neu laden: der Bezug steht am Entwurf. Nur der Fliesstext
      // trägt Inhalt — das Titelfeld öffnet beim Fokus sein Menü über dem Knopf.
      await ep.getByTestId("blatt-entwurf-sichern").click();
      await expect(ep.getByTestId("blatt-speicherzustand")).toHaveAttribute(
        "data-zustand",
        "gespeichert",
        { timeout: 15_000 },
      );
      await expect(ep).toHaveURL(/[?&]draft=/);
      const k1Entwurf = new URL(ep.url()).searchParams.get("draft");
      if (k1Entwurf) {
        zuLoeschen.push(k1Entwurf);
      }
      await ep.reload();
      await expect(ep.getByTestId("vorlagen-zeile-text")).toContainText("Regel", {
        timeout: 15_000,
      });
      await expect(ep.getByTestId("vorlagen-zeile-text")).toContainText("1");

      // --- K2 · Vorlage eines Beitrags wechseln, ohne Werte zu verlieren ---------------------------
      const entwurf = await ep.request.post("/api/drafts", {
        data: {
          title: `Gehörschutz an Presse 4 ${m}`,
          statement: "Fiktive Aussage.",
          bodyHtml:
            "<h2>Regel</h2><h3>Wofür gilt die Regel?</h3><p>Presse 4, Halle 2.</p>" +
            "<h3>Die Regel</h3><p>Gehörschutz tragen, sobald die Presse läuft.</p>",
          vorlage: { id: "std-regel", version: 1, spaceId: null },
        },
      });
      expect(entwurf.status(), await entwurf.text()).toBe(201);
      const entwurfId = ((await entwurf.json()) as { id: string }).id;
      await ep.goto(`/erfassen?draft=${encodeURIComponent(entwurfId)}`);
      await expect(fliesstext(ep)).toContainText("Gehörschutz tragen", { timeout: 15_000 });
      // Tastatur: die Auswahl öffnet sich mit Enter.
      await ep.getByTestId("vorlagen-oeffnen").focus();
      await ep.keyboard.press("Enter");
      await expect(ep.getByTestId("vorlagen-wahl")).toBeVisible();
      await ep.locator('[data-testid="vorlage-option"][data-vorlage="std-faq"]').click();
      const plan = ep.getByTestId("vorlage-wechsel");
      await expect(plan).toContainText("Die Regel");
      await expect(plan).toContainText("Weitere Inhalte");
      await bild(ep, "k2-wechsel-vorschau");
      await ep.getByTestId("vorlage-anwenden").click();
      await expect(fliesstext(ep)).toContainText("Gehörschutz tragen");
      await expect(fliesstext(ep)).toContainText("Presse 4, Halle 2.");
      await expect(fliesstext(ep)).toContainText("Frage");
      await expect(ep.getByTestId("vorlage-ergebnis")).toBeVisible();

      // --- K4/K8 · Space-Vorgaben bei der Auswahl erklärt, Prüfen mit Feldfehlern ----------------
      await ep.getByTestId("vorlagen-space").selectOption(spaceId);
      const erklaerung = ep.getByTestId("vorlagen-space-vorgabe");
      await expect(erklaerung).toContainText("Mindestens 1", { timeout: 15_000 });
      await expect(erklaerung).toContainText("Kategorie");
      await ep.getByTestId("vorlagen-pruefen").click();
      const befunde = ep.getByTestId("vorlagen-befunde");
      await expect(befunde).toContainText("Frage", { timeout: 15_000 });
      await expect(befunde).toContainText("Kategorie");
      await expect(befunde).toContainText("Tag");
      await bild(ep, "k8-space-vorgabe-und-feldfehler");
      // Speichern bleibt frei — auch unvollständig.
      await ep.getByTestId("blatt-entwurf-sichern").click();
      await expect(ep.getByTestId("blatt-speicherzustand")).toHaveAttribute(
        "data-zustand",
        "gespeichert",
        { timeout: 15_000 },
      );
      await ep.reload();
      await expect(ep.getByTestId("vorlagen-zeile-text")).toContainText("FAQ", { timeout: 15_000 });
      await expect(fliesstext(ep)).toContainText("Gehörschutz tragen");
      // Freie Eingabe per Tastatur: der Text bleibt unverändert.
      await ep.getByTestId("vorlagen-oeffnen").focus();
      await ep.keyboard.press("Enter");
      await ep.getByTestId("vorlage-frei").focus();
      await ep.keyboard.press("Space");
      await expect(ep.getByTestId("vorlagen-frei-hinweis")).toBeVisible();
      await expect(fliesstext(ep)).toContainText("Gehörschutz tragen");

      // --- K3/K10 · eigene Vorlage anlegen und im Space teilen ---------------------------------
      const name = `Pumpenwechsel ${m}`;
      await ep.goto("/vorlagen");
      await ep.getByTestId("vorlage-neu").click();
      const form = ep.getByTestId("vorlage-formular");
      await form.getByTestId("vorlage-name").fill(name);
      await form.getByTestId("vorlage-geltung").selectOption("space");
      await form.getByTestId("vorlage-space").selectOption(spaceId);
      await form.getByTestId("vorlage-feld-titel").nth(0).fill("Ausgangslage");
      await form.getByTestId("vorlage-feld-hinweis").nth(0).fill("Welche Pumpe? …");
      await form.getByTestId("vorlage-feld-pflicht").nth(0).check();
      await form.getByTestId("vorlage-feld-neu").click();
      await form.getByTestId("vorlage-feld-titel").nth(1).fill("Schritte");
      await bild(ep, "k3-vorlage-anlegen");
      await form.getByTestId("vorlage-speichern").click();
      const karte = ep.locator('[data-testid="vorlage-karte"]', { hasText: name });
      await expect(karte).toContainText("Im Space", { timeout: 15_000 });
      const vorlageId = (await karte.getAttribute("data-vorlage")) ?? "";
      expect(vorlageId).not.toBe("");

      // Mia — die zweite berechtigte Person — findet und wendet sie an.
      await mp.goto("/erfassen");
      await expect(fliesstext(mp)).toBeVisible({ timeout: 15_000 });
      await mp.getByTestId("vorlagen-oeffnen").click();
      await mp.locator(`[data-testid="vorlage-option"][data-vorlage="${vorlageId}"]`).click();
      await expect(mp.getByTestId("vorlage-felder")).toContainText("Ausgangslage");
      await mp.getByTestId("vorlage-anwenden").click();
      await expect(fliesstext(mp)).toContainText("Ausgangslage");
      await bild(mp, "k3-zweite-person-wendet-an");
      // Ihr Beitrag mit dieser Fassung (über den Draht, derselbe Server).
      const beitrag = await mp.request.post("/api/kos", {
        data: {
          confidentiality: "intern",
          type: "best_practice",
          title: `Pumpe P-7 ${m}`,
          statement: "Fiktive Aussage.",
          category: "Instandhaltung",
          tags: ["Pumpe"],
          bodyHtml: `<h2>${name}</h2><h3>Ausgangslage</h3><p>P-7 leckt.</p><h3>Schritte</h3><p>Absperren.</p>`,
          vorlage: { id: vorlageId, version: 1, spaceId },
        },
      });
      expect(beitrag.status(), await beitrag.text()).toBe(201);
      const koId = ((await beitrag.json()) as { id: string }).id;
      // Mia darf die geteilte Vorlage nicht ändern.
      const miaAendert = await mp.request.put(`/api/vorlagen/${vorlageId}`, {
        data: { version: 1, name: "Fremd", geltung: "space", spaceId, felder: [{ titel: "X" }] },
      });
      expect(miaAendert.status()).toBe(403);

      // --- K5/K10 · Fassung ändern: Auswirkungen vorher, Beitrag behält seinen Bezug -------------
      await ep.reload();
      const karteNeu = ep.locator(`[data-testid="vorlage-karte"][data-vorlage="${vorlageId}"]`);
      await karteNeu.getByTestId("vorlage-bearbeiten").click();
      const aendern = karteNeu.getByTestId("vorlage-formular");
      await aendern.getByTestId("vorlage-feld-neu").click();
      await aendern.getByTestId("vorlage-feld-titel").nth(2).fill("Prüfung danach");
      await aendern.getByTestId("vorlage-speichern").click();
      await expect(aendern.getByTestId("vorlage-wirkung")).toBeVisible({ timeout: 15_000 });
      await expect(aendern.getByTestId("vorlage-wirkung-nutzung")).toContainText("1");
      await expect(aendern.getByTestId("vorlage-wirkung-bestand")).toContainText("behalten");
      await bild(ep, "k5-auswirkungen-vor-neuer-fassung");
      await aendern.getByTestId("vorlage-speichern").click();
      await expect(
        ep.locator(`[data-testid="vorlage-karte"][data-vorlage="${vorlageId}"]`),
      ).toContainText("Fassung 2", { timeout: 15_000 });
      // Eigene Seite: Mias Blatt trägt ungesicherten Text, und dessen Entladewache bleibt unberührt.
      const detail = await mp.context().newPage();
      await detail.goto(`/wissen/${encodeURIComponent(koId)}`);
      const herkunft = detail.getByTestId("vorlagen-herkunft");
      await expect(herkunft).toContainText("Fassung 1", { timeout: 15_000 });
      await expect(herkunft).toContainText("Fassung 2");
      await bild(detail, "k10-beitrag-nennt-seine-fassung");

      // --- K12 · Rechte und schmale Fläche -------------------------------------------------------
      await vp.goto("/vorlagen");
      await expect(vp.getByTestId("vorlagen-seite")).toBeVisible({ timeout: 15_000 });
      await expect(vp.getByTestId("vorlage-neu")).toHaveCount(0);
      expect(
        (
          await vp.request.post("/api/vorlagen", {
            data: { name: "Nur lesen", felder: [{ titel: "A" }] },
          })
        ).status(),
      ).toBe(403);
      expect((await vp.request.get(`/api/vorlagen/${vorlageId}`)).status()).toBe(404);

      await ep.setViewportSize({ width: 390, height: 844 });
      await ep.goto("/vorlagen");
      await expect(ep.getByTestId("vorlagen-seite")).toBeVisible({ timeout: 15_000 });
      await ohneUeberbreite(ep, "/vorlagen 390 × 844");
      await bild(ep, "k12-vorlagen-390");
      await ep.goto(`/erfassen?draft=${encodeURIComponent(entwurfId)}`);
      await expect(fliesstext(ep)).toBeVisible({ timeout: 15_000 });
      await ep.getByTestId("vorlagen-oeffnen").click();
      await expect(ep.getByTestId("vorlagen-wahl")).toBeVisible();
      await ohneUeberbreite(ep, "/erfassen Vorlagenwahl 390 × 844");
      await bild(ep, "k12-vorlagenwahl-390");

      // Die Verwaltung sieht Geltung und Nutzungsumfang.
      await page.goto("/vorlagen");
      await expect(page.getByTestId("vorlagen-verwaltung")).toBeVisible({ timeout: 15_000 });
      await bild(page, "k7-verwaltung");
    } finally {
      for (const id of zuLoeschen) {
        await ep.request.delete(`/api/drafts/${id}`);
      }
      await entwuerfeAufraeumen(ep, m);
      await entwuerfeAufraeumen(mp, m);
      await ep.context().close();
      await mp.context().close();
      await vp.context().close();
    }
  });

  // K7/K11 · Begriffspflege: Vorschau und Ergebnis nennen die tatsächliche Wirkung auf Space-Vorgaben
  // — mitziehend, archiviert (bleibt) und zwischenzeitlich geändert (neue Vorschau statt stiller
  // Übernahme).
  test("Begriffspflege: Space-Vorgaben ziehen mit, archivierte bleiben, zwischenzeitliche Änderung wird erklärt", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await ensureLoggedIn(page);
    const m = marke();
    const adminId = await ich(page.request);
    const kategorie = `Wartung ${m}`;
    const ziel = `Instandsetzung ${m}`;
    const service = `Service ${m}`;
    const neuerSpace = async (name: string): Promise<string> => {
      const res = await page.request.post("/api/spaces", {
        data: {
          name,
          zweck: "Fiktiver Arbeitsraum für die Begriffspflege im Smoke.",
          verantwortlich: adminId,
          zugang: "alle",
          mitglieder: [],
          ansichten: [],
        },
      });
      expect(res.status(), await res.text()).toBe(201);
      return ((await res.json()) as { id: string }).id;
    };
    const vorgabeSetzen = async (spaceId: string, version: number, kategorien: string[]) => {
      const res = await page.request.put(`/api/vorlagen/space-vorgaben/${spaceId}`, {
        data: { version, kategorien },
      });
      expect(res.status(), await res.text()).toBe(200);
    };
    const vorgabeLesen = async (spaceId: string) => {
      const res = await page.request.get(`/api/vorlagen/space-vorgaben/${spaceId}`);
      expect(res.status(), await res.text()).toBe(200);
      const daten = (await res.json()) as {
        fassungen: { version: number; kategorien: string[] }[];
      };
      return daten.fassungen;
    };
    const halle = await neuerSpace(`Halle ${m}`);
    const altbau = await neuerSpace(`Altbau ${m}`);
    await vorgabeSetzen(halle, 0, [kategorie]);
    await vorgabeSetzen(altbau, 0, [kategorie]);
    // Der Altbau wird regulär archiviert (Folgenvorschau, Begründung) — er nimmt danach nichts an.
    const stand = await page.request.get(`/api/spaces/${altbau}`);
    expect(stand.status(), await stand.text()).toBe(200);
    const spaceVersion = ((await stand.json()) as { space: { version: number } }).space.version;
    const folgen = await page.request.post(`/api/spaces/${altbau}/archivierung/vorschau`);
    expect(folgen.status(), await folgen.text()).toBe(200);
    const archiv = await page.request.post(`/api/spaces/${altbau}/archivieren`, {
      data: {
        version: spaceVersion,
        grundlage: ((await folgen.json()) as { grundlage: string }).grundlage,
        begruendung: `Fiktiv (${m}): Gebäude stillgelegt.`,
      },
    });
    expect(archiv.status(), await archiv.text()).toBe(200);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/vorlagen");
    await expect(page.getByTestId("vorlagen-verwaltung")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("begriff-art").selectOption("kategorie");
    await page.getByTestId("begriff-vorgang").selectOption("umbenennen");
    await page.getByTestId("begriff-name").fill(kategorie);
    await page.getByTestId("begriff-ziel").fill(ziel);
    await page.getByTestId("begriff-begruendung").fill(`Fiktiv (${m}): einheitlicher Begriff.`);
    await page.getByTestId("begriff-absenden").click();

    // Vorschau: die Halle zieht mit, der archivierte Altbau ist schon hier als unverändert benannt.
    const vorschau = page.getByTestId("begriff-vorgaben");
    const halleZeile = vorschau.locator(`[data-vorgabe="${halle}"]`);
    const altbauZeile = vorschau.locator(`[data-vorgabe="${altbau}"]`);
    await expect(halleZeile).toContainText("ziehen mit", { timeout: 15_000 });
    await expect(halleZeile).toContainText(ziel);
    await expect(altbauZeile).toContainText("archiviert");
    await expect(altbauZeile).toContainText("bleiben unverändert");
    await expect(altbauZeile).not.toContainText(ziel);
    await bild(page, "k11-vorschau-vorgaben-archiviert");

    // Zwischenzeitlich ändert jemand die Vorgabe der Halle: nichts wird still übernommen; die
    // Ausführung wird abgelehnt, erklärt, und die neue Vorschau ersetzt die alte.
    await vorgabeSetzen(halle, 1, [kategorie, service]);
    await page.getByTestId("begriff-absenden").click();
    await expect(page.getByTestId("begriff-fehler")).toContainText("seit der Vorschau", {
      timeout: 15_000,
    });
    await expect(halleZeile).toContainText(service);
    expect((await vorgabeLesen(halle)).map((f) => f.version)).toEqual([1, 2]);
    await bild(page, "k11-vorschau-nach-zwischenzeitlicher-aenderung");

    // Bestätigt wird die neue Vorschau: das Ergebnis nennt geänderte UND übersprungene Vorgaben.
    await page.getByTestId("begriff-absenden").click();
    const ergebnis = page.getByTestId("begriff-ergebnis-vorgaben");
    await expect(ergebnis.locator(`[data-vorgabe="${halle}"]`)).toContainText("neuen Begriff", {
      timeout: 15_000,
    });
    const altbauErgebnis = ergebnis.locator(`[data-vorgabe="${altbau}"]`);
    await expect(altbauErgebnis).toContainText("nicht geändert");
    await expect(altbauErgebnis).toContainText("archiviert");
    await bild(page, "k11-ergebnis-vorgaben");

    // Der gespeicherte Stand entspricht der Anzeige — auch nach erneutem Laden.
    const halleNachher = await vorgabeLesen(halle);
    expect(halleNachher.map((f) => f.version)).toEqual([1, 2, 3]);
    expect(halleNachher.at(-1)?.kategorien).toEqual([ziel, service]);
    const altbauNachher = await vorgabeLesen(altbau);
    expect(altbauNachher.map((f) => f.version)).toEqual([1]);
    expect(altbauNachher[0]?.kategorien).toEqual([kategorie]);
    await page.reload();
    await expect(page.getByTestId("begriffe-register")).toContainText(kategorie, {
      timeout: 15_000,
    });
  });
});
