// ================================================================================================
// produkt:20261010:assistenz-name-avatar — PERSÖNLICHE ASSISTENZ IM BROWSER, AM ECHTEN PRODUKT.
// ================================================================================================
//
// Vier Sonden am gebündelten Produkt mit echtem Server, echter Anmeldung und FIKTIVEN Konten, die
// der Admin der Suite eigens anlegt (keine Personendaten):
//   1. Desktop: Erstanmeldung → Band „Wie soll deine Assistenz heißen?" → Feldprüfung → Name und
//      Motiv → Speichern → Neuladen → zweites Gerät (frischer Browserkontext) → zweites Konto mit
//      eigenem, unabhängigem Profil → serverseitige Ablehnung einer fremden Kontokennung.
//   2. Desktop: Meine Assistenz → Abbrechen → nur Motiv → Speicherfehler (einmal 500) mit
//      Wiederholen → die geöffnete Figur wechselt ohne Abmeldung.
//   3. 390 × 844 mit reduzierter Bewegung, nur Tastatur: Einrichtung mit sichtbarem Fokus,
//      vollständige Vorschauen ohne abgeschnittene Figuren, erkennbare gewählte Option.
//   4. Das Bildpaket: jedes der dreizehn Motive wird aus dem Bau ausgeliefert (kein Fremddienst).
//   5. Mimik je Motiv: die acht Gesichter blinzeln deckungsgleich über dem Bild und zeigen Sprechen,
//      Freude und Rückfrage; die fünf sachlichen Objekte bleiben ohne Gesicht (Bild je Motiv).
//
// WAS DIESE SONDEN NICHT ERSETZEN: das Urteil eines Menschen über Bildwirkung und Charaktere, die
// Abnahme emotionaler Animationen (Basis-PNGs sind keine Animationsabnahme) und eine Prüfung an
// echten Endgeräten. Eine Transport-Attrappe gibt es genau einmal: die einmal scheiternde
// Speicherung (`page.route`, Sonde 2).
import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ASSISTENZ_AVATAR_KATALOG, animationsStil } from "../apps/web/src/lib/assistenzAvatare";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Assistenz-Kennwort-1";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Ein eigenes fiktives Konto (Rolle Experte), angelegt vom Admin der Suite. */
async function fiktivesKonto(admin: Page, name: string): Promise<{ email: string; id: string }> {
  await ensureLoggedIn(admin);
  const email = `assistenz-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Fiktiv ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return { email, id: ((await angelegt.json()) as { id: string }).id };
}

async function anmelden(page: Page, email: string): Promise<void> {
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
}

async function neuerKontext(
  browser: Browser,
  email: string,
  groesse: { width: number; height: number },
): Promise<{ kontext: BrowserContext; seite: Page }> {
  const kontext = await browser.newContext({ viewport: groesse });
  const seite = await kontext.newPage();
  await anmelden(seite, email);
  return { kontext, seite };
}

/** Der Nutzungshinweis hat Vorrang; wer ihn bestätigt, bekommt danach die Einrichtung. */
async function hinweisBestaetigen(page: Page): Promise<void> {
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible().catch(() => false)) {
    await weiter.click();
    await expect(page.getByTestId("notice-banner")).toHaveCount(0);
  }
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Assistenz — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

const band = (page: Page) => page.getByTestId("assistenz-einrichtung");
const motiv = (page: Page, id: string) => page.getByTestId(`assistenz-avatar-${id}`);
const figur = (page: Page) => page.getByTestId("klara-figur");
const auswahl = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
/** Der Gesprächskopf — genau die Überschrift mit dem Namen, nicht „So arbeitest du mit …“. */
const kopf = (page: Page, name: string) =>
  page.getByTestId("klara-gespraech").getByRole("heading", { name, exact: true });

/** Bewegliche Assistenz einschalten (dokumentierter Einstieg) und zur Seite zurück. */
async function assistenzEinschalten(page: Page, zurueck: string): Promise<void> {
  await page.goto("/klara-vorschau");
  await expect(figur(page)).toBeVisible({ timeout: 15_000 });
  await page.goto(zurueck);
  await expect(figur(page)).toBeVisible({ timeout: 15_000 });
}

async function profilAmServer(page: Page): Promise<{
  profil: { name: string | null; avatar: string | null; bewegung: string } | null;
  einrichtungOffen: boolean;
}> {
  const r = await page.request.get("/api/me/assistenz");
  expect(r.status()).toBe(200);
  return r.json();
}

/**
 * Das Motiv an einer Assistenzfläche: die gewählte Kennung (`data-avatar`) steht am Bild bzw. an
 * der Ersatzgrafik; ein geladenes Bild kommt aus dem Bau unter der Kennung des Motivs.
 */
async function motivAnFigur(page: Page, testId: string, id: string): Promise<void> {
  const el = page.getByTestId(testId);
  await expect(el).toHaveAttribute("data-avatar", id);
  if ((await el.evaluate((n) => n.tagName)) === "IMG") {
    await expect(el).toHaveAttribute("src", `/assistenz/erstauswahl-v1/${id}.png`);
  } else {
    await expect(el).toHaveAttribute("data-avatar-ersatz", "datei");
  }
}

/** Die tatsächlich laufende CSS-Animation am Motiv der Figur (`none` = still). */
async function motivAnimation(page: Page): Promise<string> {
  return figur(page)
    .locator(".klara-motiv")
    .evaluate((el) => getComputedStyle(el).animationName);
}

/** Die Mimik-Ebene der Figur (nur Motive mit Gesicht). */
const mimik = (page: Page) => figur(page).getByTestId("klara-mimik");

async function lidAnimation(page: Page): Promise<string> {
  return mimik(page)
    .locator(".klara-mimik-lid")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
}

/** Liegt `innen` vollständig in `aussen`? (Vorschau nicht abgeschnitten) */
async function liegtInnen(innen: Locator, aussen: Locator): Promise<boolean> {
  const a = await aussen.boundingBox();
  const i = await innen.boundingBox();
  if (!a || !i) {
    return false;
  }
  return (
    i.x >= a.x - 0.5 &&
    i.y >= a.y - 0.5 &&
    i.x + i.width <= a.x + a.width + 0.5 &&
    i.y + i.height <= a.y + a.height + 0.5
  );
}

test("Assistenz · Erstanmeldung → Name/Avatar → Speichern → Neuladen → zweites Gerät → zweites Konto → Fremdkonto abgelehnt", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const anna = await fiktivesKonto(page, "anna");
  const bert = await fiktivesKonto(page, "bert");
  const groesse = { width: 1280, height: 800 };
  const { kontext, seite: p } = await neuerKontext(browser, anna.email, groesse);

  // Neutral, solange nichts gespeichert ist — kein fester Produktname.
  await assistenzEinschalten(p, "/start");
  await expect(figur(p)).toHaveAttribute(
    "aria-label",
    "Assistenz – Gespräch öffnen oder schließen",
  );
  await hinweisBestaetigen(p);

  await expect(band(p)).toBeVisible({ timeout: 15_000 });
  await expect(
    band(p).getByRole("heading", { name: "Wie soll deine Assistenz heißen?" }),
  ).toBeVisible();
  await beleg(p, info, "1 Band nach der ersten Anmeldung");
  await p.getByTestId("assistenz-einrichtung-starten").click();
  await expect(p.getByTestId("assistenz-formular-einrichtung")).toBeVisible();
  await expect(p.getByTestId("assistenz-name")).toBeFocused();

  // Unvollständig: nichts geht an den Server, der Grund steht am Feld.
  let gespeichert = 0;
  p.on("request", (r) => {
    if (r.method() === "PUT" && new URL(r.url()).pathname === "/api/me/assistenz") {
      gespeichert += 1;
    }
  });
  await p.getByTestId("assistenz-speichern").click();
  await expect(p.getByTestId("assistenz-name-fehler")).toHaveText("Bitte gib einen Namen ein.");
  await expect(p.getByTestId("assistenz-avatar-fehler")).toHaveText("Bitte wähle ein Motiv.");
  await expect(p.getByTestId("assistenz-name")).toHaveAttribute("aria-invalid", "true");
  expect(gespeichert).toBe(0);
  await beleg(p, info, "2 Feldprüfung ohne Name und Motiv");

  // Dreizehn Motive in zwei Gruppen nach dem Manifest (Kompass ist „expressiv“), das Original vorn.
  await expect(p.locator('[data-avatar-gruppe="ausdrucksstark"] input[type="radio"]')).toHaveCount(
    8,
  );
  await expect(p.locator('[data-avatar-gruppe="sachlich"] input[type="radio"]')).toHaveCount(5);
  await expect(motiv(p, "original")).toBeVisible();
  await expect(auswahl(p, "Original")).toHaveCount(1);

  await p.getByTestId("assistenz-name").fill("Mia");
  await motiv(p, "eule").click();
  await expect(auswahl(p, "Eule")).toBeChecked();
  await expect(motiv(p, "eule")).toHaveAttribute("data-gewaehlt", "true");
  await expect(p.getByTestId("assistenz-vorschau-name")).toHaveText("Mia");
  await p.getByTestId("assistenz-speichern").click();
  await expect(p.getByTestId("assistenz-einrichtung-fertig")).toContainText("Mia");
  expect(gespeichert).toBe(1);
  await expect(figur(p)).toHaveAttribute("aria-label", "Mia – Gespräch öffnen oder schließen");
  // Die Figur trägt das gewählte Motiv — als Bild oder, solange die Datei fehlt, als ehrlich
  // gekennzeichnete Ersatzgrafik. Dass jede Datei wirklich ausgeliefert wird, misst allein die
  // Bildpaket-Sonde unten (K15); hier geht es um die Wahl am Konto und ihre Anzeige.
  await motivAnFigur(p, "klara-avatar", "eule");
  expect((await profilAmServer(p)).profil).toMatchObject({ name: "Mia", avatar: "eule" });

  // Zustandswechsel aus einem echten Ereignis (ANIMATIONSZUSTAENDE.json): das bestätigte Speichern
  // ist Freude — kurz, mit dem Hüpfer des expressiven Stils —, danach von selbst wieder Bereit.
  await expect(figur(p)).toHaveAttribute("data-stil", "expressiv");
  await expect(figur(p)).toHaveAttribute("data-zustand", "freude");
  expect(await motivAnimation(p)).toBe("kw-assistenz-huepfer");
  await expect(p.getByTestId("klara-figur-zustand")).toHaveText("Erledigt");
  // Die Mimik der Eule folgt: zusammengezogene Augen bei Freude, danach Lidschlag in Bereit.
  await expect(mimik(p)).toHaveAttribute("data-mimik", "eule");
  await expect(mimik(p)).toHaveAttribute("data-zustand", "freude");
  await beleg(p, info, "3a Zustand Freude nach bestätigtem Speichern");
  await expect(figur(p)).toHaveAttribute("data-zustand", "bereit", { timeout: 6_000 });
  expect(await motivAnimation(p)).toBe("kw-assistenz-atmen");
  expect(await lidAnimation(p)).toBe("kw-mimik-blinzeln");
  await expect(p.getByTestId("klara-figur-zustand")).toHaveCount(0);

  await figur(p).click();
  await expect(kopf(p, "Mia")).toBeVisible();
  await beleg(p, info, "3 gespeichert: Figur und Gesprächskopf mit Name und Motiv");

  // Neuladen: Stand vom Server, kein erneutes Band.
  await p.reload();
  await expect(figur(p)).toHaveAttribute("aria-label", "Mia – Gespräch öffnen oder schließen", {
    timeout: 15_000,
  });
  await expect(band(p)).toHaveCount(0);

  // Zweites Gerät: frischer Kontext, neue Anmeldung — dieselbe Auswahl.
  const zwei = await neuerKontext(browser, anna.email, groesse);
  await assistenzEinschalten(zwei.seite, "/start");
  await expect(figur(zwei.seite)).toHaveAttribute(
    "aria-label",
    "Mia – Gespräch öffnen oder schließen",
  );
  await expect(band(zwei.seite)).toHaveCount(0);
  await beleg(zwei.seite, info, "4 zweites Gerät");

  // Zweites fiktives Konto: eigenes, unabhängiges Profil.
  const drei = await neuerKontext(browser, bert.email, groesse);
  await assistenzEinschalten(drei.seite, "/start");
  await expect(figur(drei.seite)).toHaveAttribute(
    "aria-label",
    "Assistenz – Gespräch öffnen oder schließen",
  );
  await hinweisBestaetigen(drei.seite);
  await expect(band(drei.seite)).toBeVisible({ timeout: 15_000 });
  expect(await profilAmServer(drei.seite)).toEqual({ profil: null, einrichtungOffen: true });

  // Fremdkonto: Bert versucht Annas Profil über eine manipulierte Kennung zu ändern → 403.
  const fremd = await drei.seite.request.put("/api/me/assistenz", {
    data: { kontoId: anna.id, name: "Gekapert", avatar: "wolke", fassung: 1 },
  });
  expect(fremd.status()).toBe(403);
  const fremdLesen = await drei.seite.request.get(`/api/me/assistenz?kontoId=${anna.id}`);
  expect(fremdLesen.status()).toBe(403);
  expect((await profilAmServer(p)).profil).toMatchObject({ name: "Mia", avatar: "eule" });
  await info.attach("Fremdkonto-Ablehnung (Status)", {
    body: JSON.stringify({ schreiben: fremd.status(), lesen: fremdLesen.status() }),
    contentType: "application/json",
  });

  await drei.kontext.close();
  await zwei.kontext.close();
  await kontext.close();
});

test("Assistenz · Meine Assistenz: Abbrechen, nur Motiv, Speicherfehler mit Wiederholen — Figur wechselt ohne Abmeldung", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const konto = await fiktivesKonto(page, "aendern");
  const { kontext, seite: p } = await neuerKontext(browser, konto.email, {
    width: 1280,
    height: 800,
  });
  const start = await p.request.put("/api/me/assistenz", {
    data: { name: "Mia", avatar: "eule", einrichtungAbschliessen: true, fassung: 0 },
  });
  expect(start.status(), await start.text()).toBe(200);

  await assistenzEinschalten(p, "/profil");
  // Einstellungen → Persönliche Einstellungen (/profil) → Zeile „Meine Assistenz".
  await p.getByTestId("zeile-assistenz").click();
  await expect(p.getByTestId("assistenz-formular-aendern")).toBeVisible();
  await expect(p.getByTestId("assistenz-name")).toHaveValue("Mia");
  await figur(p).click();
  await expect(p.getByTestId("klara-gespraech")).toBeVisible();
  // Seitenansicht: die App rückt zur Seite, statt vom kompakten Gespräch verdeckt zu werden — so
  // bleibt „Meine Assistenz“ bei offener Assistenz bedienbar (im kompakten Modus lag das Gespräch
  // über dem Formular, nacharbeit-3). Belegt nebenbei das Motiv in der Seitenansicht (K5).
  await p.getByTestId("klara-ansicht").click();
  await expect(p.getByTestId("klara-gespraech")).toHaveAttribute("data-ansicht", "seitlich");

  // Abbrechen erhält die bisherige Auswahl.
  await p.getByTestId("assistenz-name").fill("Kai");
  await motiv(p, "wolke").click();
  await p.getByTestId("assistenz-abbrechen").click();
  await expect(p.getByTestId("assistenz-name")).toHaveValue("Mia");
  await expect(auswahl(p, "Eule")).toBeChecked();
  expect((await profilAmServer(p)).profil).toMatchObject({ name: "Mia", avatar: "eule" });

  // Nur das Motiv ändern — die geöffnete Figur wechselt sofort.
  await motiv(p, "fuchs").click();
  await p.getByTestId("assistenz-speichern").click();
  await expect(p.getByTestId("assistenz-meldung")).toHaveText(
    "Gespeichert: Mia mit dem Motiv „Fuchs“.",
  );
  await motivAnFigur(p, "klara-avatar", "fuchs");
  await motivAnFigur(p, "klara-gespraech-avatar", "fuchs");
  await beleg(p, info, "5 Meine Assistenz: Motiv geändert, Figur gewechselt");

  // Speicherfehler: einmal 500 — Eingabe bleibt, bestätigter Stand bleibt, Wiederholen gelingt.
  let einmal = true;
  await p.route("**/api/me/assistenz", async (route) => {
    if (route.request().method() === "PUT" && einmal) {
      einmal = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "Speicher nicht erreichbar." }),
      });
      return;
    }
    await route.fallback();
  });
  await p.getByTestId("assistenz-name").fill("Kai");
  await p.getByTestId("assistenz-speichern").click();
  const fehler = p.getByTestId("assistenz-speicherfehler");
  await expect(fehler).toBeVisible();
  await expect(fehler).toContainText("Nicht gespeichert");
  // Tatsächlich fehlgeschlagen: die Figur zeigt den Fehlerzustand samt Text, bis wiederholt wird.
  await expect(figur(p)).toHaveAttribute("data-zustand", "fehler");
  await expect(p.getByTestId("klara-figur-zustand")).toContainText("Fehlgeschlagen");
  await expect(p.getByTestId("assistenz-name")).toHaveValue("Kai");
  await expect(figur(p)).toHaveAttribute("aria-label", "Mia – Gespräch öffnen oder schließen");
  expect((await profilAmServer(p)).profil).toMatchObject({ name: "Mia" });
  await beleg(p, info, "6 Speicherfehler: Eingabe bleibt, Wiederholen und Abbrechen");
  await p.getByTestId("assistenz-wiederholen").click();
  await expect(fehler).toHaveCount(0);
  // Wiederholen gelingt: der Fehler endet, kurze Freude, danach Bereit.
  await expect(figur(p)).not.toHaveAttribute("data-zustand", "fehler");
  await expect(figur(p)).toHaveAttribute("data-zustand", "bereit", { timeout: 6_000 });
  await expect(figur(p)).toHaveAttribute("aria-label", "Kai – Gespräch öffnen oder schließen");
  await expect(kopf(p, "Kai")).toBeVisible();
  expect((await profilAmServer(p)).profil).toMatchObject({ name: "Kai", avatar: "fuchs" });
  await beleg(p, info, "7 nach Wiederholen: Name in der offenen Assistenz");

  await kontext.close();
});

test("Assistenz · 390 × 844, reduzierte Bewegung, nur Tastatur: Fokus sichtbar, Vorschauen vollständig", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const konto = await fiktivesKonto(page, "schmal");
  const { kontext, seite: p } = await neuerKontext(browser, konto.email, {
    width: 390,
    height: 844,
  });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await assistenzEinschalten(p, "/start");
  await hinweisBestaetigen(p);
  await expect(band(p)).toBeVisible({ timeout: 15_000 });

  // Tastatur: „Jetzt einrichten" fokussieren und mit Enter öffnen.
  await p.getByTestId("assistenz-einrichtung-starten").focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("assistenz-name")).toBeFocused();
  await p.keyboard.type("Nordlicht");

  // Tab in die Motivgruppe; Pfeiltasten wählen. Der Fokus ist als Rahmen der Karte sichtbar.
  await p.keyboard.press("Tab");
  const fokus = await p.evaluate(() => {
    const el = document.activeElement as HTMLInputElement | null;
    const karte = el?.nextElementSibling as HTMLElement | null;
    const stil = karte ? getComputedStyle(karte) : null;
    return {
      typ: el?.type ?? "",
      wert: el?.value ?? "",
      outlineStyle: stil?.outlineStyle ?? "",
      outlineWidth: stil?.outlineWidth ?? "",
    };
  });
  expect(fokus.typ).toBe("radio");
  expect(fokus.outlineStyle).toBe("solid");
  expect(Number.parseFloat(fokus.outlineWidth)).toBeGreaterThanOrEqual(2);
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowRight");
  await expect(auswahl(p, "Roboter")).toBeChecked();
  await expect(motiv(p, "roboter")).toHaveAttribute("data-gewaehlt", "true");
  await beleg(p, info, "8 schmal: Fokus und gewählte Option sichtbar");

  // Jede Vorschau steht vollständig in ihrer Karte — nichts abgeschnitten.
  for (const m of ASSISTENZ_AVATAR_KATALOG) {
    const karte = motiv(p, m.id);
    await karte.scrollIntoViewIfNeeded();
    const bild = karte.locator("img, [data-avatar-ersatz]").first();
    expect(await liegtInnen(bild, karte), `${m.id}: Vorschau abgeschnitten`).toBe(true);
    const fensterBreite = 390;
    const b = await karte.boundingBox();
    expect(b && b.x >= 0 && b.x + b.width <= fensterBreite + 1, `${m.id} ragt hinaus`).toBe(true);
  }

  // Bewegung reduzieren per Leertaste, dann mit Enter im Namensfeld speichern.
  await p.getByTestId("assistenz-bewegung").focus();
  await p.keyboard.press("Space");
  await expect(p.getByTestId("assistenz-bewegung")).toBeChecked();
  await p.getByTestId("assistenz-name").focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("assistenz-einrichtung-fertig")).toContainText("Nordlicht");
  await expect(figur(p)).toHaveAttribute("data-bewegung", "reduziert");
  await expect(figur(p)).toHaveAttribute(
    "aria-label",
    "Nordlicht – Gespräch öffnen oder schließen",
  );
  // Reduzierte Bewegung: der Zustand wechselt trotzdem (Freude steht als Text da), das Motiv bleibt
  // aber still — kein Hüpfer, keine Dauerschleife.
  await expect(figur(p)).toHaveAttribute("data-zustand", "freude");
  await expect(p.getByTestId("klara-figur-zustand")).toHaveText("Erledigt");
  expect(await motivAnimation(p)).toBe("none");
  // Die Mimik des Roboters zeigt den Ausdruck still: kein Lidschlag, aber die Lidstellung der Freude.
  await expect(mimik(p)).toHaveAttribute("data-bewegung", "reduziert");
  await expect(mimik(p)).toHaveAttribute("data-zustand", "freude");
  expect(await lidAnimation(p)).toBe("none");
  expect(
    await mimik(p)
      .locator(".klara-mimik-lid")
      .first()
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("matrix(1, 0, 0, 0.42, 0, 0)");
  // Die Figur bleibt im Bild und bedienbar.
  await figur(p).focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("klara-gespraech")).toBeVisible();
  await beleg(p, info, "9 schmal: eingerichtet, Gespräch offen");
  expect((await profilAmServer(p)).profil).toMatchObject({
    name: "Nordlicht",
    avatar: "roboter",
    bewegung: "reduziert",
  });

  await kontext.close();
});

test("Assistenz · Mimik je Motiv: Gesichter blinzeln und sprechen, sachliche Objekte bleiben gesichtslos", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const konto = await fiktivesKonto(page, "mimik");
  const { kontext, seite: p } = await neuerKontext(browser, konto.email, {
    width: 1280,
    height: 800,
  });
  const lies = async (r: { json: () => Promise<unknown> }): Promise<number> =>
    ((await r.json()) as { profil: { fassung: number } }).profil.fassung;
  const erst = await p.request.put("/api/me/assistenz", {
    data: { name: "Mia", avatar: "original", einrichtungAbschliessen: true, fassung: 0 },
  });
  expect(erst.status(), await erst.text()).toBe(200);
  let fassung = await lies(erst);
  await assistenzEinschalten(p, "/start");

  for (const m of ASSISTENZ_AVATAR_KATALOG) {
    if (m.id !== "original") {
      const r = await p.request.put("/api/me/assistenz", { data: { avatar: m.id, fassung } });
      expect(r.status(), await r.text()).toBe(200);
      fassung = await lies(r);
    }
    await p.reload();
    await expect(figur(p)).toBeVisible({ timeout: 15_000 });
    await motivAnFigur(p, "klara-avatar", m.id);
    await expect(figur(p)).toHaveAttribute("data-zustand", "bereit");

    if (animationsStil(m) !== "expressiv") {
      // Sachliches Objekt: keine erfundenen Augen oder Münder.
      await expect(mimik(p)).toHaveCount(0);
      await info.attach(`Mimik — ${m.id}: ohne Gesicht`, {
        body: await figur(p).screenshot(),
        contentType: "image/png",
      });
      continue;
    }

    await expect(mimik(p)).toHaveAttribute("data-mimik", m.id);
    await expect(mimik(p)).toHaveAttribute("data-zustand", "bereit");
    // Bereit: Lidschlag; die Ebene atmet deckungsgleich mit dem Bild.
    expect(await lidAnimation(p)).toBe("kw-mimik-blinzeln");
    expect(await mimik(p).evaluate((el) => getComputedStyle(el).animationName)).toBe(
      "kw-assistenz-atmen",
    );
    const bild = await figur(p).getByTestId("klara-avatar").boundingBox();
    const ebene = await mimik(p).boundingBox();
    expect(bild && ebene, `${m.id}: Box fehlt`).toBeTruthy();
    if (bild && ebene) {
      const abweichung = Math.max(
        Math.abs(bild.x - ebene.x),
        Math.abs(bild.y - ebene.y),
        Math.abs(bild.width - ebene.width),
        Math.abs(bild.height - ebene.height),
      );
      expect(abweichung, `${m.id}: Ebene nicht deckungsgleich`).toBeLessThanOrEqual(4);
    }
    await info.attach(`Mimik — ${m.id}: bereit`, {
      body: await figur(p).screenshot(),
      contentType: "image/png",
    });

    // DARSTELLUNG der übrigen Ausdrücke. Ausgelöst werden sie im Produkt allein durch echte
    // Ereignisse (gemessen in tests/assistenz-profil/ausdruck.test.ts und sprachaktivitaet.test.tsx;
    // eine echte Sprachausgabe hat der kopflose Browser nicht). Hier wird nur der Zustand an der
    // Ebene gesetzt, um zu zeigen, wie jedes Gesicht ihn darstellt.
    const darstellung: Array<[string, string, string]> = [
      ["sprechen", ".klara-mimik-mund", "kw-mimik-sprechen"],
      ["freude", ".klara-mimik-lid", "none"],
      ["ratlos", ".klara-mimik-lid-r", "none"],
    ];
    for (const [zustand, teil, erwartet] of darstellung) {
      await mimik(p).evaluate((el, z) => el.setAttribute("data-zustand", z), zustand);
      expect(
        await mimik(p)
          .locator(teil)
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
        `${m.id} · ${zustand}`,
      ).toBe(erwartet);
      if (zustand !== "sprechen") {
        await p.waitForTimeout(300);
        expect(
          await mimik(p)
            .locator(teil)
            .first()
            .evaluate((el) => getComputedStyle(el).transform),
          `${m.id} · ${zustand}: Lid bewegt`,
        ).not.toBe("matrix(1, 0, 0, 0, 0, 0)");
      }
      await info.attach(`Mimik — ${m.id}: ${zustand}`, {
        body: await figur(p).screenshot(),
        contentType: "image/png",
      });
    }
  }
  await kontext.close();
});

test("Assistenz · Bildpaket: alle dreizehn Motive kommen als PNG aus dem Bau", async ({ page }) => {
  await ensureLoggedIn(page);
  const fehlend: string[] = [];
  for (const m of ASSISTENZ_AVATAR_KATALOG) {
    const r = await page.request.get(`/${m.datei}`);
    const typ = r.headers()["content-type"] ?? "";
    if (r.status() !== 200 || !typ.startsWith("image/png")) {
      fehlend.push(`${m.id} (${r.status()} ${typ})`);
    }
  }
  expect(fehlend, `nicht ausgeliefert: ${fehlend.join(", ")}`).toEqual([]);
});
