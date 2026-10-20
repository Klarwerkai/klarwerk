// ================================================================================================
// ASSISTENZ MINIMAL (produkt:20261011:assistenz-minimalistische-oberflaeche) — DIE GRUNDANSICHT IM
// GEBÜNDELTEN PRODUKT, MIT ECHTEM SERVER UND ECHTER ANMELDUNG.
// ================================================================================================
//
// Drei Sonden, jede mit eigenem fiktiven Konto (wie `klara-basis-browser.spec.ts`):
//   1. 1280 × 800, hell und dunkel: vier Bereiche, gezählte sichtbare Bedienelemente, Eingabe ohne
//      Statusscrollen erreichbar, keine waagrechte Überbreite; Menü per Tastatur mit allen fünf
//      Einträgen und Rückweg, Entwurf bleibt; langes Gespräch scrollt, die Eingabe bleibt stehen.
//   2. 320 × 640 (schmal), hell und dunkel: dieselben Messungen an der schmalen Breite.
//   3. Laufende Anfrage: der Frageweg wird im Browser angehalten; Steuerbereich bei offenem Menü,
//      Stopp an der eingeklappten Figur, tatsächliches Ergebnis „Gestoppt“ im gespeicherten Gespräch.
//
// WAS DIESE SONDEN NICHT ERSETZEN: Im Tor ist kein Modell aktiv — die Antworten sind „Ohne KI“.
// Der native Mac-Begleiter, Word, echte Mikrofone/Lautsprecher und das Urteil eines Menschen sind
// nicht Teil dieses Laufs. Hell/Dunkel wird als Bild belegt, nicht farblich bewertet.
import {
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Assistenz-Minimal-Kennwort-1";
const ENTWURF = "Synthetischer Entwurf, noch nicht gesendet";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function eigenesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `assistenz-minimal-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Assistenz Minimal ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(
  browser: Browser,
  email: string,
  groesse: { width: number; height: number },
): Promise<Page> {
  const kontext = await browser.newContext({ viewport: groesse });
  const page = await kontext.newPage();
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  return page;
}

async function beleg(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Assistenz minimal — ${name}`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function oeffnen(page: Page): Promise<Locator> {
  const gespraech = page.getByTestId("klara-gespraech");
  if (!(await gespraech.isVisible())) {
    await page.getByTestId("klara-figur").click();
  }
  await expect(gespraech).toBeVisible();
  await expect(page.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  return gespraech;
}

/** Ein Element liegt vollständig im Fenster — ohne vorher etwas zu scrollen. */
async function imFenster(page: Page, l: Locator, wann: string): Promise<void> {
  const v = page.viewportSize();
  const b = await l.boundingBox();
  if (!v || !b) {
    throw new Error(`${wann}: keine Box`);
  }
  expect(b.x >= 0 && b.x + b.width <= v.width + 1, `${wann}: waagrecht ausserhalb`).toBe(true);
  expect(b.y >= 0 && b.y + b.height <= v.height + 1, `${wann}: senkrecht ausserhalb`).toBe(true);
}

/**
 * UI-MIN-10/11: die tatsächlich sichtbaren Bedienelemente der Fläche, einzeln (keine Gruppen).
 * Sichtbar heisst: gerendert und nicht in einem geschlossenen `<details>` (ausser dessen Kopf).
 */
async function sichtbareBedienelemente(gespraech: Locator): Promise<string[]> {
  return gespraech.evaluate((wurzel) =>
    Array.from(
      wurzel.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], summary"),
    )
      .filter((el) => {
        // Geometrie allein schließt Inhalte geschlossener details nicht zuverlässig aus.
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement && !parent.open) {
            const summary = parent.querySelector(":scope > summary");
            if (!summary?.contains(el)) return false;
          }
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.offsetParent !== null;
      })
      .map((el) => el.dataset.testid ?? el.tagName.toLowerCase()),
  );
}

/**
 * Nacharbeit 2 (Bens Befund, UI-MIN-16): vor jedem Hell-/Dunkelbild wird die WIRKSAME Darstellung
 * gemessen — Merkmal an Fläche und Figur und die tatsächlich berechnete Hintergrund-/Textfarbe.
 * Ohne diesen Nachweis wäre ein „dunkles“ Bild nur ein hell gebliebenes Bild mit anderem Namen.
 */
async function darstellungPruefen(
  page: Page,
  erwartet: "hell" | "dunkel",
  wo: string,
): Promise<void> {
  const gespraech = page.getByTestId("klara-gespraech");
  await expect(gespraech, `${wo}: Merkmal der Fläche`).toHaveAttribute(
    "data-darstellung",
    erwartet,
  );
  await expect(page.getByTestId("klara-figur-huelle")).toHaveAttribute(
    "data-darstellung",
    erwartet,
  );
  const farben = await gespraech.evaluate((el) => {
    const helligkeit = (farbe: string): number => {
      const [r = 0, g = 0, b = 0] = (farbe.match(/\d+(\.\d+)?/g) ?? []).map(Number);
      const kanal = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
    };
    const titel = el.querySelector<HTMLElement>('[data-testid="klara-panel-titel"]');
    const s = getComputedStyle(el);
    return {
      hintergrund: helligkeit(s.backgroundColor),
      text: helligkeit(getComputedStyle(titel ?? el).color),
    };
  });
  const kontrast =
    (Math.max(farben.hintergrund, farben.text) + 0.05) /
    (Math.min(farben.hintergrund, farben.text) + 0.05);
  expect(kontrast, `${wo}: Kontrast Titel/Fläche`).toBeGreaterThanOrEqual(4.5);
  if (erwartet === "dunkel") {
    expect(farben.hintergrund, `${wo}: Fläche nicht dunkel`).toBeLessThan(0.05);
    expect(farben.text, `${wo}: Schrift nicht hell`).toBeGreaterThan(0.6);
  } else {
    expect(farben.hintergrund, `${wo}: Fläche nicht hell`).toBeGreaterThan(0.8);
  }
}

async function grundansichtMessen(page: Page, info: TestInfo, wo: string): Promise<void> {
  const gespraech = await oeffnen(page);
  await expect(gespraech).toHaveAttribute("data-oberflaeche", "minimal");
  await expect(gespraech).toHaveAttribute("data-seite", "gespraech");
  for (const id of ["klara-panel-titel", "klara-menue-knopf", "klara-schliessen"]) {
    await expect(page.getByTestId(id), `${wo}: ${id}`).toBeVisible();
  }
  await expect(page.getByTestId("klara-kontext-zeile")).toBeVisible();
  for (const id of ["klara-einwilligung", "klara-offen", "klara-modi", "klara-bedienhilfe"]) {
    await expect(page.getByTestId(id), `${wo}: ${id}`).toHaveCount(0);
  }
  for (const id of [
    "klara-datenweg",
    "klara-ort",
    "klara-bezug-seite",
    "klara-bezug-markierung",
    "klara-bezug-frei",
  ]) {
    await expect(page.getByTestId(id), `${wo}: ${id} dauerhaft sichtbar`).toBeHidden();
  }
  const bedien = await sichtbareBedienelemente(gespraech);
  info.annotations.push({ type: `Bedienelemente ${wo}`, description: bedien.join(", ") });
  // Menü, Einklappen, Kontextzeile, Eingabe, Senden — und das Mikrofon, wo der Browser diktiert.
  const erwartet = [
    "klara-menue-knopf",
    "klara-schliessen",
    "klara-kontext-zeile",
    "klara-eingabe",
  ];
  for (const id of erwartet) {
    expect(bedien, `${wo}: ${id} fehlt`).toContain(id);
  }
  expect(bedien.filter((id) => !["klara-mikrofon", "klara-senden"].includes(id))).toEqual(erwartet);
  // Eingabe und nächste Handlung ohne Statusscrollen im Fenster; keine Überbreite.
  await imFenster(page, page.getByTestId("klara-eingabe"), `${wo}: Eingabe`);
  await imFenster(page, page.getByTestId("klara-senden"), `${wo}: Senden`);
  const ueberbreite = await gespraech.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(ueberbreite, `${wo}: waagrechte Überbreite`).toBeLessThanOrEqual(0);
  const seiteBreit = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(seiteBreit, `${wo}: Seite läuft waagrecht über`).toBeLessThanOrEqual(0);
}

async function frageStellen(page: Page, frage: string, ersteFrage: boolean): Promise<void> {
  const antworten = page.locator('[data-testid="klara-nachricht"][data-von="klara"]');
  const vorher = await antworten.count();
  const frageweg = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await page.getByTestId("klara-eingabe").fill(frage);
  await page.getByTestId("klara-eingabe").press("Enter");
  if (ersteFrage) {
    // Die Einwilligung wird beim ersten Senden gefragt.
    await expect(page.getByTestId("klara-einwilligung")).toBeVisible();
    await page.getByTestId("klara-einwilligung-erteilen").click();
  }
  const antwort = await frageweg;
  expect(antwort.status(), await antwort.text()).toBe(200);
  await expect(antworten).toHaveCount(vorher + 1, { timeout: 15_000 });
  await expect(antworten.last()).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  // Erst wenn nichts mehr läuft, ist die nächste Frage sendebereit.
  await expect(page.getByTestId("klara-vorgaenge")).toHaveCount(0, { timeout: 15_000 });
}

test("Assistenz minimal · 1280x800 hell/dunkel: vier Bereiche, Menü per Tastatur, Entwurf bleibt, langes Gespräch", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const email = await eigenesKonto(page, "desktop");
  const p = await anmelden(browser, email, { width: 1280, height: 800 });

  await p.emulateMedia({ colorScheme: "light" });
  await grundansichtMessen(p, info, "1280 hell");
  await darstellungPruefen(p, "hell", "1280 hell");
  await beleg(p, info, "1280 · hell · Grundansicht");
  await p.emulateMedia({ colorScheme: "dark" });
  await grundansichtMessen(p, info, "1280 dunkel");
  await darstellungPruefen(p, "dunkel", "1280 dunkel");
  await beleg(p, info, "1280 · dunkel · Grundansicht");
  await p.emulateMedia({ colorScheme: "light" });

  // Menü per Tastatur: fünf Einträge, jede Unterseite mit Rückweg; der Entwurf bleibt.
  const eingabe = p.getByTestId("klara-eingabe");
  await eingabe.fill(ENTWURF);
  for (const seite of ["verlauf", "funktionen", "einstellungen", "hilfe"]) {
    await p.getByTestId("klara-menue-knopf").focus();
    await p.keyboard.press("Enter");
    await expect(p.getByTestId("klara-menue-neu")).toBeFocused();
    await expect(p.getByTestId("klara-menue").locator("button")).toHaveCount(5);
    await p.getByTestId(`klara-menue-${seite}`).focus();
    await p.keyboard.press("Enter");
    await expect(p.getByTestId("klara-unterseite")).toHaveAttribute("data-seite", seite);
    await expect(p.getByTestId("klara-unterseite-zurueck")).toBeFocused();
    if (seite === "einstellungen") {
      await beleg(p, info, "1280 · Einstellungen (Sprache, Verbindungen, Darstellung, Daten)");
    }
    await p.keyboard.press("Escape");
    await expect(p.getByTestId("klara-unterseite")).toHaveCount(0);
    await expect(eingabe).toHaveValue(ENTWURF);
  }
  // Einklappen und wieder öffnen: ohne Rückfrage, Entwurf da.
  await p.getByTestId("klara-schliessen").click();
  await expect(p.getByTestId("klara-gespraech")).toHaveCount(0);
  await oeffnen(p);
  await expect(eingabe).toHaveValue(ENTWURF);

  // Langes Gespräch: scrollt im Gesprächsbereich, die Eingabe bleibt im Fenster.
  await eingabe.fill("");
  for (let i = 0; i < 4; i++) {
    const frage = `Synthetische Frage ${i + 1} ${marke()}: Was gilt für die Anlage?`;
    await frageStellen(p, frage, i === 0);
  }
  await expect(p.locator('[data-testid="klara-nachricht"]')).toHaveCount(8);
  await imFenster(p, eingabe, "langes Gespräch: Eingabe");
  await beleg(p, info, "1280 · langes Gespräch, Eingabe erreichbar");
  // Fokus sichtbar an der Eingabe.
  await eingabe.focus();
  const umriss = await eingabe.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(umriss, "kein sichtbarer Fokus an der Eingabe").not.toBe("none");
  await p.context().close();
});

test("Assistenz minimal · 320x640 hell/dunkel: Eingabe ohne Statusscrollen, keine Überbreite, Menü erreichbar", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const email = await eigenesKonto(page, "schmal");
  const p = await anmelden(browser, email, { width: 320, height: 640 });

  await p.emulateMedia({ colorScheme: "light" });
  await grundansichtMessen(p, info, "320 hell");
  const breite = (await p.getByTestId("klara-gespraech").boundingBox())?.width ?? 0;
  expect(Math.round(breite)).toBe(320);
  await darstellungPruefen(p, "hell", "320 hell");
  await beleg(p, info, "320 · hell · Grundansicht");
  await p.emulateMedia({ colorScheme: "dark" });
  await grundansichtMessen(p, info, "320 dunkel");
  await darstellungPruefen(p, "dunkel", "320 dunkel");
  await beleg(p, info, "320 · dunkel · Grundansicht");
  await p.emulateMedia({ colorScheme: "light" });

  await frageStellen(p, `Schmale Probe ${marke()}: Was kann ich hier tun?`, true);
  await imFenster(p, p.getByTestId("klara-eingabe"), "320: Eingabe nach Antwort");
  await p.getByTestId("klara-menue-knopf").click();
  await imFenster(p, p.getByTestId("klara-menue-hilfe"), "320: Menüpunkt Hilfe");
  await beleg(p, info, "320 · Menü offen");
  await p.getByTestId("klara-menue-einstellungen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  await expect(p.getByTestId("klara-einwilligung-widerrufen")).toBeVisible();
  await beleg(p, info, "320 · Einstellungen mit Daten & Freigaben");
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("klara-unterseite")).toHaveCount(0);
  await p.context().close();
});

test("Assistenz minimal · laufende Anfrage: Steuerbereich bei offenem Menü, Stopp an der eingeklappten Figur", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const email = await eigenesKonto(page, "vorgang");
  const p = await anmelden(browser, email, { width: 1280, height: 800 });
  await oeffnen(p);
  // Einwilligung über eine erste, normal beantwortete Frage.
  await frageStellen(p, `Vorlauf ${marke()}: Was gilt hier?`, true);

  // Der Frageweg wird im Browser angehalten — die Anfrage läuft, bis sie gestoppt wird.
  await p.route("**/api/ask", () => {
    // bewusst nicht beantworten
  });
  await p.getByTestId("klara-eingabe").fill(`Gehaltene Frage ${marke()}`);
  await p.getByTestId("klara-eingabe").press("Enter");
  const anfrage = p.locator('[data-testid="klara-vorgang"][data-art="anfrage"]');
  await expect(anfrage).toBeVisible({ timeout: 15_000 });
  await expect(p.getByTestId("klara-laeuft-seit")).toContainText("Anfrage läuft seit");
  await p.getByTestId("klara-menue-knopf").click();
  await expect(anfrage).toBeVisible();
  await beleg(p, info, "Vorgang · Menü offen, Stopp sichtbar");

  await p.keyboard.press("Escape");
  await p.getByTestId("klara-schliessen").click();
  await expect(p.getByTestId("klara-gespraech")).toHaveCount(0);
  const stopp = p.getByTestId("klara-figur-vorgaenge").getByTestId("klara-stoppen");
  await expect(stopp).toBeVisible();
  await beleg(p, info, "Vorgang · eingeklappt, Stopp an der Figur");
  await stopp.click();
  await expect(p.getByTestId("klara-figur-vorgaenge")).toHaveCount(0, { timeout: 15_000 });

  await oeffnen(p);
  const letzte = p.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();
  await expect(letzte).toHaveAttribute("data-modus", "abgebrochen");
  await expect(letzte).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await expect(p.getByTestId("klara-vorgaenge")).toHaveCount(0);
  await beleg(p, info, "Vorgang · gestoppt, ehrlicher Teilstand im Gespräch");
  await p.unroute("**/api/ask");
  await p.context().close();
});
