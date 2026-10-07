// ================================================================================================
// KLARA-VORSCHAU (produkt:20261007:klara-vorschau) — der zusammenhängende Bedienbeleg im Browser.
// ================================================================================================
//
// Eine Sonde, ein Weg, wie ihn das Kriterium K10 verlangt:
//   verschieben → Artikel öffnen → Absatz markieren → fragen → zu Fragen wechseln → Tutorial mit
//   Zwischenfrage → Notizentwurf → verkleinern und wieder öffnen.
// Unterwegs werden die Einzelkriterien am echten Layout gemessen (K1–K9): Avatar geladen und relativ,
// Ziehen mit der Maus öffnet nichts, Tastatur, Scrollen, Fensteränderung, Andocken, seitliche
// Ansicht mit erreichbarer Seite, Fokusrückgabe, Kontext und Herkunft, Vorschlag mit Original,
// Tutorialzeiger auf dem echten Bedienelement, Zwischenfrage am selben Schritt, Fehlziel, Demo-
// Kennzeichnung, Status mit sparsamer Animation. Eine zweite Sonde prüft schmal (390 px) mit
// reduzierter Bewegung und Touch-Zeigerereignissen.
//
// Im hermetischen Tor (`smoke:ui:gate`) ist kein Modell aktiv — Klara braucht keins: alle Antworten
// sind vorgefertigt. Die Sonde legt NICHTS an (keine verändernde Anfrage, gemessen), sie stört also
// den geteilten Bestand der anderen Sonden nicht.
//
// WAS SIE NICHT ERSETZT: das Urteil eines Menschen, ob sich Klara gut anfühlt; einen echten Finger
// auf einem echten Telefon (hier: Touch-Zeigerereignisse) und eine echte Bildschirmtastatur.
import {
  type Locator,
  type Page,
  type Request,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const ARTIKEL_TITEL = "Förderbandrolle FB-200 tauschen (fiktiv)";

function veraendernd(anfragen: Request[]): string[] {
  return anfragen
    .filter((r) => r.url().includes("/api/") && !["GET", "HEAD", "OPTIONS"].includes(r.method()))
    .map((r) => `${r.method()} ${new URL(r.url()).pathname}`);
}

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  if (!b) {
    throw new Error("Element ohne Box");
  }
  return b;
}

async function imFenster(page: Page, l: Locator, wann: string): Promise<void> {
  const v = page.viewportSize();
  if (!v) {
    throw new Error("keine Fenstergrösse");
  }
  // Nacharbeit 6: nach `setViewportSize` zeichnet die App erst auf das `resize`-Ereignis hin neu —
  // gemessen wurde vorher noch die Lage im alten Fenster (1268 = 1280 − 12, angedockt). Gewartet
  // wird deshalb, bis die Lage im Fenster liegt; die Grenzen selbst bleiben dieselben.
  await expect
    .poll(
      async () => {
        const p = await box(l);
        return (
          p.x >= 0 && p.y >= 0 && p.x + p.width <= v.width + 1 && p.y + p.height <= v.height + 1
        );
      },
      { message: `${wann}: Element bleibt ausserhalb des Fensters`, timeout: 3_000 },
    )
    .toBe(true);
  const b = await box(l);
  expect(b.x, `${wann}: links abgeschnitten`).toBeGreaterThanOrEqual(0);
  expect(b.y, `${wann}: oben abgeschnitten`).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, `${wann}: rechts abgeschnitten`).toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height, `${wann}: unten abgeschnitten`).toBeLessThanOrEqual(v.height + 1);
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Klara-Vorschau — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

test("Klara-Vorschau · Avatar lädt aus dem Bau über eine relative Adresse", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  const antwort = page.waitForResponse((r) => r.url().endsWith("/klara/klara-avatar-v1.png"));
  await page.goto("/klara-vorschau");
  const avatar = page.getByTestId("klara-avatar");
  await expect(avatar).toHaveAttribute("src", "/klara/klara-avatar-v1.png");
  const r = await antwort;
  expect(r.status(), "der Avatar muss aus dem Bau geliefert werden").toBe(200);
  expect(r.headers()["content-type"] ?? "").toContain("image/png");
  await expect
    .poll(() => avatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
});

test("Klara-Vorschau · Bedienbeleg Desktop: verschieben → Artikel → Markierung → Fragen → Tutorial → Notiz → verkleinern", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);

  const anfragen: Request[] = [];
  page.on("request", (r) => anfragen.push(r));

  // --- K1 · dokumentierter Einstieg, Avatar aus dem Bau ------------------------------------------
  await page.goto("/klara-vorschau");
  await expect(page.getByTestId("page-klara-vorschau")).toBeVisible({ timeout: 15_000 });
  const figur = page.getByTestId("klara-figur");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  // Dass die Bilddatei tatsächlich lädt, prüft der eigene Fall „Avatar lädt aus dem Bau“ — so
  // hängt dieser Bedienbeleg nicht an der Datei, und ein fehlendes Bild bleibt trotzdem rot.
  const avatar = page.getByTestId("klara-avatar");
  await expect(avatar).toHaveAttribute("src", "/klara/klara-avatar-v1.png");
  await expect(page.getByTestId("klara-figur")).toHaveCount(1);
  await imFenster(page, figur, "Startplatz");
  const start = await box(figur);
  await beleg(page, info, "1 Einstieg mit Avatar");

  // --- K2 · Ziehen mit der Maus öffnet das Gespräch NICHT ----------------------------------------
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x - 300, start.y - 200, { steps: 12 });
  await page.mouse.up();
  // Der Zeiger griff die Mitte und wanderte um (−300 − w/2, −200 − h/2) — die Figur mit ihm.
  const gezogen = await box(figur);
  expect(Math.abs(gezogen.x - (start.x - 300 - start.width / 2))).toBeLessThan(12);
  expect(Math.abs(gezogen.y - (start.y - 200 - start.height / 2))).toBeLessThan(12);
  await expect(page.getByTestId("klara-gespraech")).toHaveCount(0);
  await beleg(page, info, "2 nach dem Ziehen, Gespräch zu");

  // --- K2 · Tastatur verschiebt, Pos1 setzt zurück ----------------------------------------------
  await figur.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await box(figur)).x).toBeLessThan(gezogen.x - 20);
  await page.keyboard.press("Home");
  await expect.poll(async () => Math.round((await box(figur)).x)).toBe(Math.round(start.x));
  await expect(page.getByTestId("klara-gespraech")).toHaveCount(0);

  // --- Artikel öffnen ----------------------------------------------------------------------------
  await page.getByTestId("klara-vorschau-oeffnen-foerderbandrolle").click();
  await expect(page.getByTestId("klara-artikel-titel")).toHaveText(ARTIKEL_TITEL);
  const absatz2 = page.locator('[data-klara-absatz="2"]');
  const absatz2Text = (await absatz2.textContent())?.trim() ?? "";

  // --- K5 · Absatz markieren → „Klara fragen“ ----------------------------------------------------
  await absatz2.click({ clickCount: 3 });
  const fragenKnopf = page.getByTestId("klara-auswahl-knopf");
  await expect(fragenKnopf).toBeVisible();
  await fragenKnopf.click();
  const gespraech = page.getByTestId("klara-gespraech");
  await expect(gespraech).toBeVisible();
  await expect(page.getByTestId("klara-auswahl-titel")).toBeFocused();
  await expect(page.getByTestId("klara-auswahl-text")).toContainText("Lagerböcken");
  await expect(page.getByTestId("klara-auswahl-herkunft")).toContainText("Artikel");
  await expect(page.getByTestId("klara-auswahl-herkunft")).toContainText("Absatz 2");
  await expect(page.getByTestId("klara-ort-seite")).toHaveText("Artikel");
  await expect(page.getByTestId("klara-ort-objekt")).toContainText(ARTIKEL_TITEL);

  // --- K5/K9 · erklären: Anfrage läuft (mit sparsamer Bewegung) → Antwort bereit ----------------
  await page.getByTestId("klara-aktion-erklaeren").click();
  await expect(figur).toHaveAttribute("data-status", "laeuft");
  await expect(page.getByTestId("klara-status-text")).toHaveText("Anfrage läuft …");
  const animation = await avatar.evaluate((img) => getComputedStyle(img).animationName);
  expect(animation).toBe("kw-klara-denkt");
  await expect(page.getByTestId("klara-status-text")).toHaveText("Antwort bereit");
  await expect(figur).toHaveAttribute("data-status", "antwort");
  await expect(page.getByTestId("klara-demo-kennzeichen").last()).toHaveText(
    "Demo-Antwort · vorgefertigt",
  );
  await page.getByTestId("klara-aktion-zusammenfassen").click();
  await expect(page.getByTestId("klara-status-text")).toHaveText("Antwort bereit");
  await expect(
    page.locator('[data-testid="klara-nachricht"][data-aktion="zusammenfassen"][data-von="klara"]'),
  ).toHaveCount(1);
  await beleg(page, info, "3 Absatz markiert, erklärt und zusammengefasst");

  // --- K6 · Umformulierung als Vorschlag mit Original — Artikel erst nach Übernahme geändert ------
  await page.getByTestId("klara-aktion-umformulieren").click();
  await expect(page.getByTestId("klara-status-text")).toHaveText("Entscheidung nötig");
  await expect(figur).toHaveAttribute("data-status", "entscheidung");
  await expect(page.getByTestId("klara-vorschlag-original")).toHaveText(absatz2Text);
  const neu = ((await page.getByTestId("klara-vorschlag-neu").textContent()) ?? "").trim();
  expect(neu.length).toBeGreaterThan(20);
  expect(neu).not.toBe(absatz2Text);
  await expect(absatz2).toHaveText(absatz2Text);
  await beleg(page, info, "4 Vorschlag mit Originalvergleich, Entscheidung nötig");
  await page.getByTestId("klara-vorschlag-uebernehmen").click();
  await expect(absatz2).toHaveText(neu);
  await expect(page.getByTestId("klara-absatz-geaendert")).toBeVisible();
  await expect(page.getByTestId("klara-status-text")).toHaveText("Antwort bereit");

  // --- K2 · nach Scrollen erreichbar -------------------------------------------------------------
  await page.evaluate(() => {
    const main = document.querySelector("main");
    if (main) {
      main.scrollTop = main.scrollHeight;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await imFenster(page, figur, "nach Scrollen");

  // --- K3 · seitliche Ansicht: die Seite rückt zur Seite, ihre Aktionen bleiben erreichbar -------
  await page.getByTestId("klara-ansicht").click();
  await expect(gespraech).toHaveAttribute("data-ansicht", "seitlich");
  const seitlich = await box(gespraech);
  expect(Math.round(seitlich.x + seitlich.width)).toBeGreaterThanOrEqual(1279);
  const zuFragen = page.getByTestId("klara-vorschau-zu-fragen");
  await zuFragen.scrollIntoViewIfNeeded();
  const link = await box(zuFragen);
  expect(link.x + link.width, "Seitenaktion unter der seitlichen Ansicht").toBeLessThanOrEqual(
    seitlich.x,
  );
  await imFenster(page, figur, "seitliche Ansicht");
  await beleg(page, info, "5 seitliche Ansicht, Seite rückt zur Seite");
  await page.getByTestId("klara-ansicht").click();
  await expect(gespraech).toHaveAttribute("data-ansicht", "kompakt");

  // --- K4 · zu Fragen wechseln: Seite, Objekt, Verlauf und Herkunft der Auswahl -----------------
  const nachrichtenVorher = await page.getByTestId("klara-nachricht").count();
  // Das Laden der echten Fragen-Seite gehört nicht zu Klara; gemessen wird davor und danach.
  const vorFragen = anfragen.length;
  await zuFragen.click();
  await expect(page.getByTestId("page-fragen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("klara-ort-seite")).toHaveText("Fragen");
  await expect(page.getByTestId("klara-ort-objekt")).toHaveText("Noch keine Frage eingegeben");
  await expect(page.getByTestId("klara-nachricht")).toHaveCount(nachrichtenVorher);
  await expect(page.getByTestId("klara-auswahl-herkunft")).toContainText("Absatz 2");
  await expect(page.getByTestId("klara-auswahl-andere-seite")).toBeVisible();
  const echtesFeld = page
    .getByTestId("page-fragen")
    .locator('input[data-tutorial-ziel="fragen.fragefeld"]');
  await echtesFeld.fill("Wie lange dauert der Testlauf?");
  await expect(page.getByTestId("klara-ort-objekt")).toHaveText(
    "Frage „Wie lange dauert der Testlauf?“",
  );
  const abFragen = anfragen.length;

  // --- K7 · Tutorial begleiten: Zeiger auf dem ECHTEN Bedienelement ------------------------------
  await page.getByTestId("klara-modus-begleite").click();
  await expect(page.getByTestId("tutorial-bereich")).toBeVisible();
  await expect(page.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 1 von 7");
  const zeiger = page.getByTestId("klara-zeiger");
  await expect(zeiger).toHaveAttribute("data-ort", "echt");
  const zBox = await box(zeiger);
  const fBox = await box(echtesFeld);
  expect(Math.abs(zBox.x - fBox.x)).toBeLessThan(4);
  expect(Math.abs(zBox.width - fBox.width)).toBeLessThan(4);
  await beleg(page, info, "6 Tutorial: Klara zeigt auf das echte Fragefeld");

  // Schritt 2, dann eine Zwischenfrage: das Tutorial hält an GENAU diesem Schritt.
  await page.getByTestId("klara-tutorial-weiter").click();
  await expect(page.getByTestId("klara-tutorial-schritt")).toContainText("Schritt 2 von 7");
  const aktuell = page.locator('[data-testid="tutorial-kapitel"][aria-current="step"]');
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await expect(page.getByTestId("tutorial-abspielen")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("klara-eingabe").fill("Was heisst hier Kontext?");
  await page.getByTestId("klara-eingabe").press("Enter");
  await expect(page.getByTestId("tutorial-abspielen")).toHaveAttribute("aria-pressed", "false");
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await expect(page.getByTestId("klara-tutorial-hinweis")).toContainText("Pausiert bei Schritt 2");
  await expect(
    page.locator('[data-testid="klara-nachricht"][data-von="klara"]').last(),
  ).toContainText("Zwischenfrage zu Schritt 2");
  await beleg(page, info, "7 Zwischenfrage, Tutorial pausiert bei Schritt 2");
  await page.getByTestId("klara-tutorial-fortsetzen").click();
  await expect(page.getByTestId("tutorial-abspielen")).toHaveAttribute("aria-pressed", "true");
  await expect(aktuell).toHaveAttribute("data-schritt", "formulieren");
  await page.getByTestId("klara-tutorial-zurueck").click();
  await expect(aktuell).toHaveAttribute("data-schritt", "verstehen");

  // Fehlziel: im Schritt „Antwort“ gibt es auf der echten Seite noch keine Antwort.
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("klara-tutorial-weiter").click();
  }
  await expect(aktuell).toHaveAttribute("data-schritt", "antwort");
  await expect(page.getByTestId("klara-tutorial-fehlziel")).toBeVisible();
  await expect(page.getByTestId("klara-tutorial-fehlziel")).toContainText(
    "auf der echten Seite gerade nicht zu sehen",
  );
  await expect(zeiger).toHaveAttribute("data-ort", "demo");

  // --- K8 · Notizentwurf mit Artikelrücklink, alles als Demo gekennzeichnet ---------------------
  await page.getByTestId("klara-tutorial-ende").click();
  await page.getByTestId("klara-aktion-notiz").click();
  const entwurf = page.getByTestId("klara-entwurf");
  await expect(entwurf).toBeVisible();
  await expect(page.getByTestId("klara-entwurf-inhalt")).not.toHaveValue("");
  const ruecklink = page.getByTestId("klara-entwurf-ruecklink");
  await expect(ruecklink).toContainText("Absatz 2");
  await expect(ruecklink).toHaveAttribute(
    "href",
    "/klara-vorschau/artikel/foerderbandrolle#absatz-2",
  );
  await expect(entwurf).toContainText("Erinnerung");
  await expect(entwurf).toContainText("Termin");
  await expect(entwurf).toContainText("in keinen Kalender");
  await page.getByTestId("klara-entwurf-art-aufgabe").check();
  await page.getByTestId("klara-entwurf-speichern").click();
  await expect(page.getByTestId("klara-entwurf-gespeichert")).toContainText("Demo-Speicherung");
  await beleg(page, info, "8 Notizentwurf mit Rücklink, Demo gekennzeichnet");

  // --- K3/K10 · verkleinern → Fokus zurück → wieder öffnen, Verlauf erhalten --------------------
  const verlauf = await page.getByTestId("klara-nachricht").count();
  await page.getByTestId("klara-minimieren").click();
  await expect(gespraech).toHaveCount(0);
  await expect(figur).toHaveAttribute("data-minimiert", "true");
  await expect(figur).toBeFocused();
  await beleg(page, info, "9 verkleinert");
  await figur.click();
  await expect(gespraech).toBeVisible();
  await expect(figur).toHaveAttribute("data-minimiert", "false");
  await expect(page.getByTestId("klara-nachricht")).toHaveCount(verlauf);
  await expect(page.getByTestId("klara-entwurf")).toBeVisible();
  await beleg(page, info, "10 wieder geöffnet, Verlauf und Entwurf erhalten");

  // Der Rücklink führt zum Absatz des Artikels zurück.
  await ruecklink.click();
  await expect(page.getByTestId("klara-artikel-titel")).toHaveText(ARTIKEL_TITEL);
  await expect(page.getByTestId("klara-ort-seite")).toHaveText("Artikel");

  // --- K2 · Andocken und Fensteränderung ---------------------------------------------------------
  await page.getByTestId("klara-andocken").click();
  await expect(figur).toHaveAttribute("data-angedockt", /links|rechts/);
  const rand = await figur.getAttribute("data-angedockt");
  await page.getByTestId("klara-schliessen").click();
  await expect(figur).toBeFocused();
  await page.setViewportSize({ width: 900, height: 600 });
  await imFenster(page, figur, "nach Fensteränderung");
  const klein = await box(figur);
  if (rand === "rechts") {
    expect(klein.x + klein.width).toBeGreaterThan(900 - 40);
  } else {
    expect(klein.x).toBeLessThan(40);
  }

  // --- K2 · Vollbild: Klara bleibt im Bild ------------------------------------------------------
  await figur.click();
  await page.getByTestId("klara-vollbild").click();
  const imVollbild = await page
    .waitForFunction(() => document.fullscreenElement !== null, undefined, { timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  await imFenster(page, figur, imVollbild ? "im Vollbild" : "nach Vollbild-Anforderung");
  await info.attach("Vollbild vom Browser gewährt", {
    body: String(imVollbild),
    contentType: "text/plain",
  });
  if (imVollbild) {
    await page.evaluate(() => document.exitFullscreen());
  }

  // Klaras Handlungen haben nichts an den Server geschickt, das etwas verändert — auch nicht die
  // Demo-Speicherung des Entwurfs.
  expect(veraendernd(anfragen.slice(0, vorFragen))).toEqual([]);
  expect(veraendernd(anfragen.slice(abFragen))).toEqual([]);
});

test("Klara-Vorschau · schmal 390 px mit reduzierter Bewegung und Touch-Zeiger", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Nacharbeit 3 (Bens Befund): eine Bildschirmtastatur verkleinert im Browser den SICHTBAREN
  // Bereich (`window.visualViewport`), nicht das Fenster. Kein Playwright-Browser blendet eine echte
  // Bildschirmtastatur ein; nachgebildet wird deshalb genau das, worauf das Produkt reagiert: ein
  // visualViewport, dessen Höhe um die Tastatur kleiner wird und der dabei `resize` meldet.
  await page.addInitScript(() => {
    const vv = new EventTarget();
    let tastatur = 0;
    const fest = (wert: () => number) => ({ get: wert, configurable: true });
    Object.defineProperties(vv, {
      width: fest(() => window.innerWidth),
      height: fest(() => window.innerHeight - tastatur),
      offsetTop: fest(() => 0),
      offsetLeft: fest(() => 0),
      pageTop: fest(() => window.scrollY),
      pageLeft: fest(() => window.scrollX),
      scale: fest(() => 1),
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, get: () => vv });
    (window as unknown as { klaraTastatur: (px: number) => void }).klaraTastatur = (px) => {
      tastatur = px;
      vv.dispatchEvent(new Event("resize"));
    };
  });
  await ensureLoggedIn(page);
  await page.goto("/klara-vorschau");
  const figur = page.getByTestId("klara-figur");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  await imFenster(page, figur, "schmal, Startplatz");
  const start = await box(figur);

  // K2 · Touch: Zeigerereignisse vom Typ „touch“ verschieben Klara, ohne das Gespräch zu öffnen.
  const cx = start.x + start.width / 2;
  const cy = start.y + start.height / 2;
  const zeiger = { pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true };
  await figur.dispatchEvent("pointerdown", { ...zeiger, clientX: cx, clientY: cy, button: 0 });
  for (let i = 1; i <= 6; i++) {
    await figur.dispatchEvent("pointermove", {
      ...zeiger,
      clientX: cx - i * 25,
      clientY: cy - i * 40,
    });
  }
  await figur.dispatchEvent("pointerup", { ...zeiger, clientX: cx - 150, clientY: cy - 240 });
  await expect.poll(async () => (await box(figur)).y).toBeLessThan(start.y - 150);
  await expect(page.getByTestId("klara-gespraech")).toHaveCount(0);
  await imFenster(page, figur, "schmal, nach Touch-Ziehen");

  // K3 · Tastatur öffnet; schmal ist das Gespräch ein Blatt unten über die volle Breite.
  await figur.focus();
  await page.keyboard.press("Enter");
  const gespraech = page.getByTestId("klara-gespraech");
  await expect(gespraech).toBeVisible();
  const blatt = await box(gespraech);
  expect(Math.round(blatt.width)).toBe(390);
  expect(Math.round(blatt.y + blatt.height)).toBeGreaterThanOrEqual(843);
  const eingabe = page.getByTestId("klara-eingabe");
  await eingabe.focus();
  await imFenster(page, eingabe, "schmal, Eingabe");
  await imFenster(page, page.getByTestId("klara-schliessen"), "schmal, Schliessen");

  // K9 · reduzierte Bewegung: der Zustand steht als Text da, die Figur bewegt sich nicht.
  await eingabe.fill("Was kann ich hier tun?");
  await eingabe.press("Enter");
  await expect(page.getByTestId("klara-status-text")).toHaveText("Anfrage läuft …");
  const animation = await page
    .getByTestId("klara-avatar")
    .evaluate((img) => getComputedStyle(img).animationName);
  expect(animation).toBe("none");
  await expect(page.getByTestId("klara-status-text")).toHaveText("Antwort bereit");
  await info.attach("Klara-Vorschau — schmal, reduzierte Bewegung", {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  // K3 · Escape schliesst, der Fokus kehrt zur Figur zurück.
  await page.keyboard.press("Escape");
  await expect(gespraech).toHaveCount(0);
  await expect(figur).toBeFocused();

  // K3 · Bildschirmtastatur: 320 px des Fensters sind verdeckt. In kompakter UND seitlicher Ansicht
  // müssen Eingabe, Senden und Schliessen im sichtbaren Bereich liegen und bedienbar sein.
  const TASTATUR = 320;
  const sichtbarBis = 844 - TASTATUR;
  for (const ansicht of ["kompakt", "seitlich"] as const) {
    await figur.focus();
    await page.keyboard.press("Enter");
    await expect(gespraech).toBeVisible();
    if ((await gespraech.getAttribute("data-ansicht")) !== ansicht) {
      await page.getByTestId("klara-ansicht").click();
    }
    await expect(gespraech).toHaveAttribute("data-ansicht", ansicht);
    await page.evaluate(
      (px) => (window as unknown as { klaraTastatur: (px: number) => void }).klaraTastatur(px),
      TASTATUR,
    );
    await eingabe.focus();
    await eingabe.fill(`Frage mit Tastatur (${ansicht})`);
    for (const id of ["klara-eingabe", "klara-senden", "klara-schliessen"]) {
      const b = await box(page.getByTestId(id));
      expect(b.y, `${ansicht}: ${id} oben abgeschnitten`).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, `${ansicht}: ${id} unter der Tastatur`).toBeLessThanOrEqual(
        sichtbarBis + 1,
      );
    }
    const f = await box(figur);
    expect(f.y + f.height, `${ansicht}: Figur unter der Tastatur`).toBeLessThanOrEqual(
      sichtbarBis + 1,
    );
    await info.attach(`Klara-Vorschau — schmal, Bildschirmtastatur, ${ansicht}`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    const vorher = await page.getByTestId("klara-nachricht").count();
    await page.getByTestId("klara-senden").click();
    await expect(page.getByTestId("klara-nachricht")).toHaveCount(vorher + 2);
    await expect(page.getByTestId("klara-status-text")).toHaveText("Antwort bereit");
    await page.getByTestId("klara-schliessen").click();
    await expect(gespraech).toHaveCount(0);
    await expect(figur).toBeFocused();
    await page.evaluate(() =>
      (window as unknown as { klaraTastatur: (px: number) => void }).klaraTastatur(0),
    );
  }
});
