import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// produkt:20261010:fragen-pruefen-einstieg — ROLLENPROBE FRAGEN UND PRÜFEN IM ECHTEN BROWSER.
// ================================================================================================
//
// AUSDRÜCKLICH EINE AGENTEN-/BROWSERPROBE (Playwright gegen den gebauten Smoke-Server), KEINE
// menschliche Usability-Messung. Sie belegt, dass die Aufgaben auf Desktop (1280×800), auf
// 390×844 und per Tastatur mit sichtbarem Fokus lösbar sind — nicht, dass Menschen es leichter
// finden. Eine menschliche Probe ist nicht bestellt (Auftrag K8) und wird hier nicht ersetzt.
//
// VORAB BENANNT — ROLLEN, AUFGABEN, MESSMETHODE:
//   Rollen (dieselben fiktiven Aufgaben für beide):
//     · „neu"      — kennt Klarwerk nicht. Folgt ausschliesslich sichtbaren Texten und
//                    Beschriftungen der Fläche (Einstieg, Knopfnamen, Prüfanlass) und erreicht das
//                    Fragefeld per Tabulator vom Seitenanfang.
//     · „erfahren" — kennt Fragen und Prüfen. Geht direkt: Feld anklicken, „Beispiele" im Feld,
//                    Prüfadresse direkt aufrufen.
//   Aufgaben (ausschliesslich fiktive Inhalte):
//     F1  Erkennen, dass die angebotenen Beispiele fiktiv sind, ohne etwas zu senden.
//     F2  Die erste Frage beginnen (Feld erreichen, fiktive Frage eingeben).
//     F3  Optional „Ich frage für" setzen und wieder zuklappen — die begonnene Frage bleibt.
//     P1  Einen eingereichten fiktiven Beitrag prüfen: sehen, warum er hier liegt, was zu prüfen ist
//         und was die Entscheidung bewirkt; dann Rückfrage mit Begründung — das tatsächliche
//         Ergebnis (Stand laut Server) steht danach da.
//   Messung je Aufgabe: Erfolg (alle Zusicherungen erfüllt), benötigte Hilfe (Anzahl geöffneter
//   Hilfemenüs/Hilfeknöpfe — die Probe öffnet keine; muss sie es, ist die Aufgabe nicht ohne Hilfe
//   lösbar und der Fall rot), Dauer in Millisekunden (Uhr des Testprozesses, inklusive Netz) und
//   für „neu" die Zahl der Tabulatorschritte bis zum Fragefeld. Das Protokoll hängt als JSON am
//   Bericht (`rollenprobe-<ansicht>-<rolle>.json`), Bildschirmfotos daneben nur als Begleitbeleg.
//
// GRENZEN: kein Modell im Tor — eine KI-Antwort wird hier nicht erzeugt (der Sendeknopf ist
// gesperrt, die Fläche sagt warum). Persönliche Assistenzpräferenzen sind nicht nachgestellt;
// reduzierte Bewegung wird in der schmalen Ansicht emuliert. Ein Konto (Admin aus der
// Ersteinrichtung) trägt beide Rollen — die Rollen unterscheiden sich im Weg, nicht in Rechten.
//
// DIESE DATEI LEGT BESTAND AN (eingereichte Beiträge) und läuft deshalb ausschliesslich im
// isolierten Kontext `chromium-zustand` (`playwright.smoke.config.ts`, `ZUSTAND_SPEC`).

const VORDERTUER = "/capture/frontdoor";
const EDITOR = '[data-testid="blatt-text"] [contenteditable="true"]';
const KARTENTITEL = '[data-testid="pruefen-karte"] [data-text="titel"]';
const FRAGEFELD = '[data-testid="page-fragen"] form input';

/** Sichtbare Beschriftungen — wörtlich aus `apps/web/src/woerterbuch/de.ts`. */
const T = {
  einreichen: "Einreichen", // erfassen.einreichen
  eingereicht: "Eingereicht:", // erfassen.eingereicht
  validierungOeffnen: "Validierung öffnen", // fd.openValidation
  intern: "Öffentlich-intern", // conf.level.intern
  absenden: "Absenden", // val.feedback.submit
  beispieleZeigen: "Fiktive Beispiele zeigen", // fragenEinstieg.beispieleZeigen
  fiktiv: "fiktiv", // fragenEinstieg.fiktiv
  optional: "Optional – nur bei Bedarf", // fragenEinstieg.optionalTitel
  ersterSchritt: "Erster Schritt:", // fragenEinstieg.ersterSchritt (Anfang)
  warum: "Warum bei dir", // pruefgrund.label.warum
  was: "Was prüfen", // pruefgrund.label.was
  wirkung: "Wirkung", // pruefgrund.label.wirkung
  neuEingereicht: "Neu eingereicht.", // pruefgrund.anlass.new
} as const;

type Rolle = "neu" | "erfahren";

interface Aufgabe {
  id: string;
  erfolg: boolean;
  hilfeGeoeffnet: number;
  dauerMs: number;
  tabSchritte?: number;
  fokusSichtbar?: boolean;
}

interface Protokoll {
  art: "Agenten-/Browserprobe (Playwright), keine menschliche Usability-Messung";
  ansicht: string;
  rolle: Rolle;
  reduzierteBewegung: boolean;
  aufgaben: Aufgabe[];
}

const ANSICHTEN = [
  { name: "desktop", breite: 1280, hoehe: 800, reduzierteBewegung: false },
  { name: "mobil-390x844", breite: 390, hoehe: 844, reduzierteBewegung: true },
] as const;

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function einreichen(page: Page, titel: string, text: string): Promise<string> {
  await page.goto(VORDERTUER);
  const editor = page.locator(EDITOR);
  await expect(editor, "das Blatt hat keine Schreibfläche").toBeVisible({ timeout: 15_000 });
  await page.getByTestId("blatt-titel").fill(titel);
  await editor.fill(text);
  await page.getByTestId("blatt-werkzeug-vertraulichkeit").click();
  await page.getByRole("menuitem", { name: T.intern }).click();
  await page.getByRole("button", { name: T.einreichen, exact: true }).click();
  const lage = page.getByTestId("blatt-lage");
  await expect(lage).toContainText(T.eingereicht, { timeout: 20_000 });
  return (await lage.getByRole("link", { name: T.validierungOeffnen }).getAttribute("href")) ?? "";
}

/** Hat das fokussierte Element einen sichtbaren Fokusring (globale `*:focus-visible`-Regel)? */
async function fokusSichtbar(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== "none" && s.outlineWidth !== "0px") || s.boxShadow !== "none";
  });
}

async function messen(
  aufgaben: Aufgabe[],
  id: string,
  schritt: () => Promise<Partial<Aufgabe> | undefined>,
): Promise<void> {
  const start = Date.now();
  const extra = (await schritt()) ?? {};
  aufgaben.push({ id, erfolg: true, hilfeGeoeffnet: 0, dauerMs: Date.now() - start, ...extra });
}

async function fragenAufgaben(page: Page, rolle: Rolle, aufgaben: Aufgabe[]): Promise<void> {
  const m = marke();
  const frage = `Wie prüfe ich den Druck am fiktiven Ventil V7 vor dem Anfahren (${m})?`;
  await page.goto("/fragen");
  await expect(page.getByTestId("page-fragen")).toBeVisible({ timeout: 20_000 });

  // F1 — fiktive Beispiele erkennen, ohne zu senden.
  await messen(aufgaben, "F1-beispiele-fiktiv", async () => {
    const einstieg = page.getByTestId("ask-einstieg");
    await expect(einstieg).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ask-einstieg-schritt")).toContainText(T.ersterSchritt);
    if (rolle === "neu") {
      await page.getByRole("button", { name: T.beispieleZeigen }).click();
    } else {
      await page.getByTestId("ask-beispiele-knopf").click();
    }
    const block = page.getByTestId("ask-beispiele");
    await expect(block).toBeVisible();
    const fiktive = block.locator('[data-testid="ask-beispiel"][data-fiktiv="1"]');
    await expect(fiktive.first()).toBeVisible();
    await expect(fiktive.first().getByTestId("ask-beispiel-fiktiv")).toHaveText(T.fiktiv);
    // Ohne Modell ist kein Beispiel startbar — die Fläche sendet also auch nichts.
    await expect(page.getByTestId("ask-answer")).toHaveCount(0);
    // Wieder zu, damit die Fläche für F2 leer ist.
    if (rolle === "neu") {
      await page.getByTestId("ask-einstieg-beispiele").click();
    } else {
      await page.getByTestId("ask-beispiele-knopf").click();
    }
    await expect(block).toBeHidden();
    return undefined;
  });

  // F2 — die erste Frage beginnen.
  await messen(aufgaben, "F2-frage-beginnen", async () => {
    const feld = page.locator(FRAGEFELD);
    let tabSchritte: number | undefined;
    let sichtbar: boolean | undefined;
    if (rolle === "neu") {
      // Vom Seitenanfang per Tabulator — höchstens 120 Schritte (Seitenleiste und Kopfband liegen
      // davor), sonst gilt das Feld als nicht erreichbar.
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      tabSchritte = 0;
      for (let i = 0; i < 120; i += 1) {
        await page.keyboard.press("Tab");
        tabSchritte += 1;
        if (await feld.evaluate((el) => el === document.activeElement)) break;
      }
      await expect(feld, "das Fragefeld ist per Tabulator nicht erreichbar").toBeFocused();
      sichtbar = await fokusSichtbar(page);
      expect(sichtbar, "das Fragefeld zeigt keinen sichtbaren Fokus").toBe(true);
      await page.keyboard.type(frage);
    } else {
      await feld.click();
      await feld.fill(frage);
    }
    await expect(feld).toHaveValue(frage);
    // KI-Lage vor dem Senden erkennbar (im Tor ohne Modell).
    await expect(page.getByTestId("ask-ki-flaechensatz")).toBeVisible();
    return { tabSchritte, fokusSichtbar: sichtbar };
  });

  // F3 — optionale Angabe setzen und zuklappen; die Frage bleibt.
  await messen(aufgaben, "F3-optional-ohne-verlust", async () => {
    const gruppe = page.getByTestId("ask-optionale-angaben");
    await expect(gruppe).toContainText(T.optional);
    const umschalten = page.getByTestId("ask-fragekontext-umschalten");
    if (rolle === "neu") {
      await umschalten.focus();
      await page.keyboard.press("Enter");
    } else {
      await umschalten.click();
    }
    await page.getByTestId("ask-fragekontext-werk").fill("Werk Nord (fiktiv)");
    await umschalten.click();
    await expect(page.getByTestId("ask-fragekontext-werk")).toHaveCount(0);
    await expect(page.getByTestId("ask-fragekontext-zeile")).toContainText("Werk Nord (fiktiv)");
    await expect(page.locator(FRAGEFELD)).toHaveValue(frage);
    return undefined;
  });
}

async function pruefAufgabe(page: Page, rolle: Rolle, aufgaben: Aufgabe[]): Promise<void> {
  const m = marke();
  const titel = `Fiktiver Prüfbeitrag ${rolle} ${m}`;
  const pruefweg = await einreichen(
    page,
    titel,
    `Fiktive Probe ${m}: An der Linie L4 den Dosierwert erst nach zehn Minuten anpassen.`,
  );

  await messen(aufgaben, "P1-pruefeintrag-verstehen-und-entscheiden", async () => {
    if (rolle === "neu") {
      await page
        .getByTestId("blatt-lage")
        .getByRole("link", { name: T.validierungOeffnen })
        .click();
    } else {
      await page.goto(pruefweg);
    }
    await expect(page.locator(KARTENTITEL)).toHaveText(titel, { timeout: 20_000 });
    const grund = page.getByTestId("pruefen-grund");
    await grund.scrollIntoViewIfNeeded();
    await expect(grund).toBeVisible();
    await expect(grund).toContainText(T.warum);
    await expect(grund).toContainText(T.was);
    await expect(grund).toContainText(T.wirkung);
    await expect(page.getByTestId("pruefen-grund-warum")).toContainText(T.neuEingereicht);
    await expect(page.getByTestId("pruefen-grund-wirkung")).not.toHaveText("");
    await expect(page.getByTestId("pruefen-grund-sichtbar")).not.toHaveText("");

    // Die Hintergrundprüfung sperrt die Entscheidung, solange sie läuft (`validationAiGate`).
    const rueckfrage = page.getByTestId("pruefen-entscheidung-warn");
    await expect(rueckfrage).toBeEnabled({ timeout: 90_000 });
    if (rolle === "neu") {
      await rueckfrage.focus();
      await page.keyboard.press("Enter");
    } else {
      await rueckfrage.click();
    }
    const begruendung = page.getByTestId("pruefen-begruendung");
    await begruendung
      .locator("textarea")
      .fill("Bitte die fiktive Messstelle an Linie L4 ergänzen.");
    await begruendung.getByRole("button", { name: T.absenden, exact: true }).click();

    // Das tatsächliche Ergebnis — keine bloße Erfolgsmeldung.
    const zeile = page.getByTestId("pruefen-entschieden");
    await expect(zeile).toHaveAttribute("data-verdict", "warn", { timeout: 20_000 });
    await expect(zeile).toHaveAttribute("data-stand", /^(offen|raus)$/, { timeout: 20_000 });
    await expect(page.getByTestId("pruefen-entschieden-stand")).not.toHaveText("");
    return undefined;
  });
}

for (const ansicht of ANSICHTEN) {
  test.describe(`Rollenprobe Fragen und Prüfen · ${ansicht.name}`, () => {
    for (const rolle of ["neu", "erfahren"] as const) {
      // Die Ansicht steht auch im Testtitel: das Sollmanifest der Smoke-Mengen führt Datei › Titel
      // ohne die Beschreibung (`tests/smoke/mengenpruefung.test.ts`).
      test(`${ansicht.name} · ${rolle} · F1–F3 und P1 auf denselben fiktiven Aufgaben`, async ({
        page,
      }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe });
        if (ansicht.reduzierteBewegung) {
          await page.emulateMedia({ reducedMotion: "reduce" });
        }
        await ensureLoggedIn(page);
        const aufgaben: Aufgabe[] = [];
        await fragenAufgaben(page, rolle, aufgaben);
        await test.info().attach(`fragen-${ansicht.name}-${rolle}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        await pruefAufgabe(page, rolle, aufgaben);
        await test.info().attach(`pruefen-${ansicht.name}-${rolle}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        const protokoll: Protokoll = {
          art: "Agenten-/Browserprobe (Playwright), keine menschliche Usability-Messung",
          ansicht: `${ansicht.name} (${ansicht.breite}×${ansicht.hoehe})`,
          rolle,
          reduzierteBewegung: ansicht.reduzierteBewegung,
          aufgaben,
        };
        await test.info().attach(`rollenprobe-${ansicht.name}-${rolle}.json`, {
          body: JSON.stringify(protokoll, null, 2),
          contentType: "application/json",
        });
        expect(aufgaben.map((a) => a.id)).toEqual([
          "F1-beispiele-fiktiv",
          "F2-frage-beginnen",
          "F3-optional-ohne-verlust",
          "P1-pruefeintrag-verstehen-und-entscheiden",
        ]);
        expect(aufgaben.every((a) => a.erfolg && a.hilfeGeoeffnet === 0)).toBe(true);
      });
    }
  });
}
