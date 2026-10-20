// ================================================================================================
// AW-16 (produkt:20261010:klara-eigener-kalender) — „Mein Kalender" im ECHTEN Browser.
// ================================================================================================
//
// Geklickt und getippt wird gegen den echten Smoke-Server mit echter Anmeldung; die Bilder hängen am
// nativen Bericht. Jede Sonde legt über den Admin der Suite ein EIGENES Konto an (Rolle Experte) —
// der Kalender gehört einer Person, und die drei Engines teilen sich einen Server. Der Browser läuft
// fest in `Europe/Berlin`, damit die angezeigte lokale Zeitzone eine prüfbare Aussage ist. Alle
// Termine sind erfundene Testdaten.
//
//   K1 · anlegen, öffnen, ändern, löschen über die Oberfläche; Neuladen zeigt denselben Eintrag
//   K2 · Tag, Woche und Agenda zeigen denselben Eintrag mit derselben Kennung; Zeitzone, ganztägige
//        Frist, Herkunft und Status stehen da; Tastatur wechselt Tag/Ansicht und öffnet/schließt
//   K3 · Eintrag, Auftrag und Ergebnis getrennt beschriftet; ohne Ausführungsdienst wird weder eine
//        Verknüpfung noch ein Ergebnis angenommen, und die Frist bleibt offen
//   K4 · Sichtwahl eigen/vorhanden/beide; im Modus „vorhanden" bleiben interne Fristen sichtbar;
//        die Wahl übersteht das Neuladen
//   K5 · ohne Teammitgliedschaft zeigt der Teamkalender keinen persönlichen Eintrag
//   K6 · Folgen stehen vor der Änderung; Abbrechen ändert nichts; ohne Ausführungsdienst wird keine
//        Ausführungsaktion angeboten
//
// WAS DIESE SONDE NICHT ERSETZT: einen Neustart des Servers (das belegt
// `tests/eigener-kalender/kalender-pg.integration.test.ts` an PostgreSQL), die Office-Begleitung im
// echten Word-Host, einen angebundenen externen Kalender und einen echten Ausführungsdienst — die
// letzten beiden gibt es im Produkt noch nicht.
import { type Browser, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Kalender-Smoke-Kennwort-1";
const ZONE = "Europe/Berlin";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Heute als Kalendertag in Berlin — so wie die Seite ihn rechnet. */
function heuteInBerlin(): string {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const wert = (typ: string): string => teile.find((t) => t.type === typ)?.value ?? "";
  return `${wert("year")}-${wert("month")}-${wert("day")}`;
}

function plusTage(tag: string, tage: number): string {
  const [j, m, t] = tag.split("-").map(Number);
  const d = new Date(Date.UTC(j ?? 1970, (m ?? 1) - 1, t ?? 1));
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(`AW-16 — ${name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

/** Ein eigenes Konto (Rolle Experte), angelegt vom Admin der Suite über den echten Adminweg. */
async function eigeneSeite(browser: Browser, admin: Page, name: string): Promise<Page> {
  await ensureLoggedIn(admin);
  const email = `kalender-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Kalender ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  const kontext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    timezoneId: ZONE,
    locale: "de-DE",
  });
  const seite = await kontext.newPage();
  await seite.goto("/");
  const pw = seite.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await seite.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await seite.locator('button[type="submit"]').click();
  await expect(seite.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  return seite;
}

async function kalenderOeffnen(page: Page): Promise<void> {
  await page.goto("/kalender");
  await expect(page.getByTestId("page-kalender")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("kalender-sicht-eigen")).toBeEnabled();
}

const chip = (page: Page, id: string) =>
  page.locator(`[data-testid="kalender-eintrag"][data-event-id="${id}"]`);

/** Derselbe Eintrag innerhalb einer bestimmten Ansicht (Tag, Woche, Agenda). */
const inAnsicht = (page: Page, ansicht: string, id: string) =>
  page.getByTestId(`kalender-${ansicht}`).locator(`[data-event-id="${id}"]`);

/**
 * Die Sichtwahl ist ein vom SERVER bestätigter Zustand: das Radio wird erst nach der Antwort
 * markiert. Deshalb Klick und danach warten — `check()` würde den Zwischenstand prüfen.
 */
async function sichtWaehlen(page: Page, modus: string): Promise<void> {
  await page.getByTestId(`kalender-sicht-${modus}`).click();
  await expect(page.getByTestId(`kalender-sicht-${modus}`)).toBeChecked();
}

test("AW-16 · K1/K2/K4: anlegen, drei Ansichten mit derselben Kennung, Tastatur, Sichtwahl, Neuladen, ändern, löschen", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const p = await eigeneSeite(browser, page, "k1");
  const heute = heuteInBerlin();

  // Erreichbar über das Konto-Menü; kein externes Konto, lokale Zeitzone sichtbar.
  await p.getByTestId("kopfband-konto").click();
  await p.getByTestId("konto-kalender").click();
  await expect(p).toHaveURL(/\/kalender$/);
  await expect(p.getByTestId("page-kalender")).toBeVisible();
  await expect(p.getByTestId("kalender-ohne-konto")).toBeVisible();
  await expect(p.getByTestId("kalender-zone")).toContainText(ZONE);

  // K1 · ein Termin über das Formular (Vorgabe: heute 09:00 Ortszeit).
  const titel = `Smoke-Termin ${marke()}`;
  await p.getByTestId("kalender-neu").click();
  await expect(p.getByTestId("kalender-form-zone")).toContainText(ZONE);
  await p.getByTestId("kalender-form-titel").fill(titel);
  await p.getByTestId("kalender-form-speichern").click();
  await expect(p.getByTestId("kalender-detail")).toBeVisible();
  const terminId = (await p.getByTestId("kalender-detail-id").textContent())?.trim() ?? "";
  expect(terminId).not.toBe("");
  await expect(p.getByTestId("kalender-detail-zone")).toContainText(ZONE);
  await expect(p.getByTestId("kalender-detail-status")).toHaveText("offen");
  await expect(p.getByTestId("kalender-detail-herkunft")).toContainText("selbst angelegt");

  // … und eine ganztägige Frist.
  await p.getByTestId("kalender-neu").click();
  await p.getByTestId("kalender-form-titel").fill(`Smoke-Frist ${marke()}`);
  await p.getByTestId("kalender-form-art").selectOption("frist");
  await p.getByTestId("kalender-form-ganztaegig").check();
  await expect(p.getByTestId("kalender-form-beginn")).toHaveValue(heute);
  await p.getByTestId("kalender-form-speichern").click();
  await expect(p.getByTestId("kalender-detail")).toBeVisible();
  const fristId = (await p.getByTestId("kalender-detail-id").textContent())?.trim() ?? "";
  await expect(p.getByTestId("kalender-detail-zeit")).toContainText("ganztägig");

  // K2 · Woche, Tag, Agenda: derselbe Eintrag mit derselben Kennung.
  await p.getByTestId("kalender-ansicht-woche").click();
  await expect(inAnsicht(p, "woche", terminId)).toHaveCount(1);
  await expect(chip(p, terminId)).toContainText("09:00");
  await expect(chip(p, fristId)).toContainText("ganztägig");
  await expect(chip(p, fristId)).toContainText("Frist");
  await bild(p, "Woche mit Termin und ganztägiger Frist");
  await p.getByTestId("kalender-ansicht-tag").click();
  await expect(inAnsicht(p, "tag", terminId)).toHaveCount(1);
  await expect(inAnsicht(p, "tag", fristId)).toHaveCount(1);
  await p.getByTestId("kalender-ansicht-agenda").click();
  await expect(inAnsicht(p, "agenda", terminId)).toHaveCount(1);
  await expect(inAnsicht(p, "agenda", fristId)).toHaveCount(1);

  // Tastatur: Tag wechseln, Eintrag öffnen, mit Escape schließen.
  await p.getByTestId("kalender-ansicht-tag").focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("kalender-flaeche")).toHaveAttribute("data-ansicht", "tag");
  await p.keyboard.press("ArrowRight");
  await expect(p.getByTestId("kalender-flaeche")).toHaveAttribute("data-tag", plusTage(heute, 1));
  await expect(chip(p, terminId)).toHaveCount(0);
  await p.keyboard.press("ArrowLeft");
  await expect(p.getByTestId("kalender-flaeche")).toHaveAttribute("data-tag", heute);
  await chip(p, terminId).focus();
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("kalender-detail")).toHaveAttribute("data-event-id", terminId);
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("kalender-detail")).toHaveCount(0);

  // K4 · Sichtwahl „vorhandener Kalender": nicht verbunden; die interne Frist bleibt sichtbar.
  await sichtWaehlen(p, "vorhanden");
  await expect(p.getByTestId("kalender-vorhanden-stand")).toContainText("Kein vorhandener");
  await expect(p.getByTestId("kalender-intern-bleibt")).toBeVisible();
  await p.getByTestId("kalender-ansicht-woche").click();
  await expect(chip(p, fristId)).toHaveCount(1);
  await expect(chip(p, terminId)).toHaveCount(0);
  await bild(p, "Sichtwahl vorhandener Kalender — interne Frist bleibt");
  await p.reload();
  await expect(p.getByTestId("kalender-sicht-vorhanden")).toBeChecked({ timeout: 15_000 });
  await expect(chip(p, fristId)).toHaveCount(1);
  await sichtWaehlen(p, "beide");
  await expect(chip(p, terminId)).toHaveCount(1);
  await sichtWaehlen(p, "eigen");
  await expect(p.getByTestId("kalender-vorhanden")).toHaveCount(0);

  // K1 · Neuladen: derselbe Eintrag mit derselben Kennung; dann ändern und erneut neu laden.
  await kalenderOeffnen(p);
  await chip(p, terminId).click();
  await expect(p.getByTestId("kalender-detail-id")).toHaveText(terminId);
  await p.getByTestId("kalender-bearbeiten").click();
  await p.getByTestId("kalender-form-titel").fill(`${titel} geändert`);
  await p.getByTestId("kalender-form-speichern").click();
  await expect(p.getByTestId("kalender-detail")).toContainText(`${titel} geändert`);
  await kalenderOeffnen(p);
  await expect(chip(p, terminId)).toContainText(`${titel} geändert`);

  // K1 · löschen — mit Rückfrage; danach auch nach Neuladen fort.
  await chip(p, terminId).click();
  await p.getByTestId("kalender-loeschen").click();
  await expect(p.getByTestId("kalender-loeschfrage")).toBeVisible();
  await p.getByTestId("kalender-loeschen-ja").click();
  await expect(chip(p, terminId)).toHaveCount(0);
  await kalenderOeffnen(p);
  await expect(chip(p, terminId)).toHaveCount(0);
  await expect(chip(p, fristId)).toHaveCount(1);
  await bild(p, "nach Löschen und Neuladen");
  await p.context().close();
});

test("AW-16 · K3/K5/K6: Auftrag und Ergebnis getrennt, Folgen vor jeder Aktion, persönlich nicht im Team", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const p = await eigeneSeite(browser, page, "k3");
  const heute = heuteInBerlin();
  const jetzt = new Date().toISOString();
  const lege = async (daten: Record<string, unknown>): Promise<string> => {
    const res = await p.request.post("/api/me/kalender/eintraege", {
      data: { zeitzone: ZONE, ...daten },
    });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).eintrag.id as string;
  };
  // DER SMOKE-SERVER HAT KEINEN AUSFÜHRUNGSDIENST (Erinnerungssteuerung ist ein eigener, noch
  // nicht gebauter Auftrag); die gelieferten persönlichen Aufgaben sind angeschlossen (Nacharbeit
  // 8). Gemessen wird deshalb genau das ehrliche Verhalten: eine unbekannte Aufgabenkennung wird
  // abgewiesen (404), eine Lauf-/Serienverknüpfung ebenso (409), eine Ergebnisbehauptung erst recht,
  // und die Oberfläche bietet keine Ausführungsaktion an. Die Verknüpfung echter Aufgaben belegt
  // `kalender-aufgaben.test.ts`, die Wirkung MIT Ausführungsdienst `kalender-am-server.test.ts`
  // (K3/K6/K7) an einem simulierten Dienst.
  const verknuepft = await p.request.post("/api/me/kalender/eintraege", {
    data: {
      zeitzone: ZONE,
      art: "frist",
      titel: "Zertifikat Z-8 (fiktiv)",
      ganztaegig: true,
      beginn: heute,
      auftrag: { taskId: "auftrag-z8" },
    },
  });
  expect(verknuepft.status()).toBe(404);
  expect((await verknuepft.json()).grund).toBe("verweis_unbekannt");
  const mitSerie = await p.request.post("/api/me/kalender/eintraege", {
    data: {
      zeitzone: ZONE,
      art: "frist",
      titel: "Zertifikat Z-8 (fiktiv)",
      ganztaegig: true,
      beginn: heute,
      serie: { seriesId: "serie-z8" },
    },
  });
  expect(mitSerie.status()).toBe(409);
  expect((await mitSerie.json()).grund).toBe("ausfuehrung_nicht_angebunden");
  const behauptet = await p.request.post("/api/me/kalender/eintraege", {
    data: {
      zeitzone: ZONE,
      art: "frist",
      titel: "Zertifikat Z-8 (fiktiv)",
      ganztaegig: true,
      beginn: heute,
      ergebnis: { art: "erinnerung_zugestellt", am: jetzt },
    },
  });
  expect(behauptet.status()).toBe(400);
  const frist = await lege({
    art: "frist",
    titel: "Zertifikat Z-8 (fiktiv)",
    ganztaegig: true,
    beginn: heute,
    fristId: "frist-z8",
  });
  const ohneAuftrag = await lege({
    art: "termin",
    titel: "Termin ohne Auftrag",
    ganztaegig: false,
    beginn: jetzt,
  });
  await kalenderOeffnen(p);

  // K3 · drei getrennte Abschnitte; ohne Auftrag sagt der Auftragsabschnitt, dass nichts ausgelöst
  // wird, und der Ergebnisabschnitt behauptet keinen Lauf. Die Frist bleibt offen.
  await chip(p, frist).click();
  await expect(p.getByTestId("kalender-detail-status")).toHaveText("offen");
  await expect(p.getByTestId("kalender-auftrag")).toContainText("Auszuführender Auftrag");
  await expect(p.getByTestId("kalender-ergebnis")).toContainText("Tatsächliches Ergebnis");
  await expect(p.getByTestId("kalender-ergebnis")).toContainText("Kein Lauf");
  await expect(p.getByTestId("kalender-ergebnis-art")).toHaveCount(0);
  await bild(p, "Eintrag, Auftrag und Ergebnis getrennt — ohne Ausführungsdienst");
  await chip(p, ohneAuftrag).click();
  await expect(p.getByTestId("kalender-auftrag-keiner")).toContainText("löst weder Modellarbeit");

  // K6 · ohne Ausführungsdienst bietet die Seite KEINE Ausführungsaktion an — nur die Anzeige.
  for (const aktion of ["lauf_absagen", "serie_pausieren", "arbeit_abbrechen"]) {
    await expect(p.getByTestId(`kalender-aktion-${aktion}`)).toHaveCount(0);
  }
  // Folgen zuerst; „Nicht ändern" lässt alles, wie es ist.
  await p.getByTestId("kalender-aktion-anzeige_entfernen").click();
  await expect(p.getByTestId("kalender-folgen")).toHaveAttribute(
    "data-aktion",
    "anzeige_entfernen",
  );
  await expect(p.getByTestId("kalender-folgen-bleibt")).toContainText("der Kalendereintrag selbst");
  await expect(p.getByTestId("kalender-folgen-ausfuehrung")).toHaveCount(0);
  await bild(p, "Folgen vor dem Entfernen aus der Ansicht");
  await p.getByTestId("kalender-folgen-abbrechen").click();
  await expect(p.getByTestId("kalender-folgen")).toHaveCount(0);
  await expect(chip(p, ohneAuftrag)).toHaveCount(1);

  // Anzeige entfernen: der Eintrag bleibt, verschwindet nur aus der eigenen Ansicht.
  await p.getByTestId("kalender-aktion-anzeige_entfernen").click();
  await p.getByTestId("kalender-folgen-bestaetigen").click();
  await expect(chip(p, ohneAuftrag)).toHaveCount(0);
  await p.getByTestId("kalender-ausgeblendete").check();
  await expect(chip(p, ohneAuftrag)).toHaveCount(1);
  await expect(chip(p, ohneAuftrag)).toContainText("aus der eigenen Ansicht entfernt");

  // K5 · ohne Teammitgliedschaft: der Teamkalender zeigt keinen persönlichen Eintrag.
  await p.getByTestId("kalender-bereich-team").click();
  await expect(p.getByTestId("kalender-bereich")).toContainText("Teammitgliedschaft");
  await expect(p.getByTestId("kalender-eintrag")).toHaveCount(0);
  await bild(p, "Teamkalender ohne persönliche Einträge");
  await p.context().close();
});
