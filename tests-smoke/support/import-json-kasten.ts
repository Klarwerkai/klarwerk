// ==================================================================================================
// JOB 3177 (UX-20b) — DIE HANDGRIFFE FÜR DEN JSON-KASTEN AUF /import.
// ==================================================================================================
//
// WARUM DIESE DATEI: die UX-20b-Fälle in `ui-smoke.spec.ts` betreten alle dieselbe Seite, und der Weg
// dorthin ist nicht trivial — `/import` liegt hinter dem Stufe-2-Tor. Stünde der Weg dreimal im
// Spec, gäbe es drei Fassungen davon, und die dritte wäre irgendwann die falsche. Dieselbe
// Begründung, die `support/auth.ts` trägt.
//
// WAS HIER NICHT STEHT: keine Zusicherung über das Produkt. Diese Datei bringt einen Lauf nur an den
// Ort, an dem gemessen wird. Alle Erwartungen stehen in den Fällen selbst — bis auf die
// Vorbedingungen, die ein falsches Grün ermöglichen würden (Kasten nicht da, Sprache nicht
// umgestellt, Dateidialog nicht geöffnet): die stehen hier, damit kein Fall auf einer halb
// geladenen Seite misst. Seit UX-20b-R stehen hier zusätzlich die MESSUNGEN (unten), die Zusage
// und Gegenprobe gemeinsam fahren.
import { type Page, expect } from "@playwright/test";

/** Der Anker des Kastens — `ImportJsonUpload.tsx:33` (`IMPORT_JSON_CARD_ID`), gesetzt an `:69`. */
export const JSON_KASTEN = "#import-json-card";
/** Die Kennung des Vorlagenfeldes — `ImportJsonUpload.tsx:84`, benannt vom Label an `:80`. */
export const VORLAGE_ID = "import-json-example";
export const VORLAGE = `#${VORLAGE_ID}`;
/** Der echte Dateieingang des Kastens — `importSourceGallery.ts:73` (`JSON_UPLOAD_INPUT_ID`). */
export const JSON_EINGANG = "#imp-json-upload-input";

/**
 * `/import` öffnen und dabei das Stufe-2-Tor über den ECHTEN Bedienweg nehmen.
 *
 * `/import` trägt `stufe2: true` (`app/navigation.ts:282`); ohne eingeschaltete Stufe 2 rendert
 * `routes.tsx:184` statt der Seite die Torkarte `Stage2Notice`, und ein Admin schaltet dort mit
 * genau einem Knopf ein (`Stage2Notice.tsx:72-75`). Genau dieser Knopf wird hier gedrückt — KEIN
 * `localStorage.setItem("kw.stufe2.v1", "1")`. Der Handgriff am Speicher wäre kürzer und würde
 * denselben Zustand herstellen, aber er würde am Produktweg vorbeigehen: bräche der Knopf, liefen
 * diese Fälle weiter grün.
 *
 * Der Knopf wird auf DEUTSCH adressiert, und das ist Absicht: aufgerufen wird diese Funktion vor
 * jeder Sprachumstellung, in einem frischen Browserkontext — dort steht die Vorgabe „de"
 * (`lib/sprachwahl.ts`, `STANDARD_SPRACHE`). Ein sprachabhängiger Text an einer Stelle, die
 * sprachunabhängig laufen müsste, wäre die Falle aus `ui-smoke.spec.ts:100-113`; hier ist die
 * Sprache zum Zeitpunkt des Klicks bekannt und fest.
 */
export async function schalteStufe2Ein(page: Page): Promise<void> {
  await page.goto("/import");
  const torKnopf = page.getByRole("button", { name: "Stufe 2 jetzt einschalten" });
  const kasten = page.locator(JSON_KASTEN);
  // Erst warten, bis die Seite sich entschieden hat — sonst ist `count()` ein stiller Wettlauf und
  // die Torkarte bliebe unbemerkt stehen (dieselbe Lehre wie in `support/auth.ts:54-57`).
  await expect(kasten.or(torKnopf).first()).toBeVisible({ timeout: 15_000 });
  if ((await torKnopf.count()) > 0) {
    await torKnopf.click();
  }
  await expect(kasten, "der JSON-Kasten steht nicht auf /import").toBeVisible({ timeout: 15_000 });
}

/** `/import` erneut öffnen und auf den Kasten warten (Stufe 2 muss schon eingeschaltet sein). */
export async function oeffneJsonKasten(page: Page): Promise<void> {
  await page.goto("/import");
  await expect(page.locator(JSON_KASTEN), "der JSON-Kasten steht nicht auf /import").toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Die Sprache über den ECHTEN Bedienweg des Produkts umstellen: die drei Knöpfe in der Zeile
 * „Sprache" auf `/profil` (`pages/Profile.tsx:53-73`, Anker `sprach-knoepfe`). Das ist der einzige
 * Ort, an dem ein Mensch die Sprache der App wählt — kein Testschalter, kein `localStorage`-Griff,
 * kein `i18n.changeLanguage` aus dem Test heraus.
 *
 * Die Knöpfe tragen als Beschriftung das Kürzel selbst (`de`/`en`/`nl`, per CSS in Großbuchstaben).
 * Adressiert wird deshalb schreibweisenunabhängig; BELEGT wird die Umstellung anschließend an zwei
 * Stellen, die kein Anzeigetext sind: `aria-pressed` am Knopf und `lang` am Dokument (gesetzt von
 * `bindHtmlLang`, `main.tsx:20`).
 */
export async function stelleSpracheEin(page: Page, sprache: "de" | "en" | "nl"): Promise<void> {
  await page.goto("/profil");
  const knoepfe = page.getByTestId("sprach-knoepfe");
  await expect(knoepfe, "die Sprachwahl steht nicht auf /profil").toBeVisible({ timeout: 15_000 });
  const knopf = knoepfe.getByRole("button").filter({ hasText: new RegExp(`^${sprache}$`, "i") });
  await expect(knopf, `kein Sprachknopf „${sprache}" auf /profil`).toHaveCount(1);
  await knopf.click();
  await expect(knopf).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 5_000 })
    .toBe(sprache);
}

/**
 * Ein MITSCHNITT der Statusmeldungen — nicht eine Momentaufnahme.
 *
 * Der Toast ist ein `<output>` (`shell/ToastViewport.tsx:22`) und trägt `role="status"` nativ. Auf
 * einer Seite stehen mehrere solcher Träger (Ladehinweise, Zähler), deshalb wird nicht auf einen
 * einzelnen gezeigt, sondern alles eingesammelt.
 *
 * WARUM MITSCHNITT UND NICHT MOMENTAUFNAHME: der Toast räumt sich nach 4 s selbst weg
 * (`app/ToastContext.tsx:28`). Eine Zusicherung, die 15 s lang pollt, liest im Fehlerfall am Ende
 * eine LEERE Seite — und meldete dann „erwartet X, bekommen ''", also gar nichts über die Ursache.
 * Gemessen in der Gegenprobe G3 dieses Auftrags, bevor diese Fassung stand. Der Mitschnitt behält
 * jeden einmal gesehenen Satz; im Fehlerbild steht damit die ECHTE Ablehnung des Parsers.
 */
export function meldungsSpur(page: Page): { lesen: () => Promise<string> } {
  const gesehen: string[] = [];
  return {
    lesen: async () => {
      const jetzt = (await page.getByRole("status").allInnerTexts())
        .map((text) => text.trim())
        .filter((text) => text.length > 0);
      for (const text of jetzt) {
        if (!gesehen.includes(text)) {
          gesehen.push(text);
        }
      }
      return gesehen.join(" | ");
    },
  };
}

/** Ganze Statusmeldungen vergleichen: „11 Beiträge“ darf die Zusage für 1 nicht erfüllen. */
export function meldetGenauZaehler(spur: string, anzahl: number): boolean {
  return spur
    .split(" | ")
    .some((meldung) => meldung === `${anzahl} Beiträge zur Prüfung eingereiht.`);
}

// ==================================================================================================
// UX-20b-R — DIE MESSUNGEN, EINMAL BESCHRIEBEN, VON DER ZUSAGE UND VON IHRER GEGENPROBE GEFAHREN.
// ==================================================================================================
//
// JOB 3218 hat G1–G4 als Gegenproben verlangt und nicht gefahren (`archiv/3218/runde-1/RUECKGABE.md`:
// „G1 NICHT durchgeführt … G4 NICHT durchgeführt"). Eine Gegenprobe beweist nur dann etwas über die
// Zusage, wenn sie DIESELBE Messung fährt — deshalb stehen die Messungen hier und nicht in den
// Fällen: L1/L2/L3 rufen sie mit dem unveränderten Produkt, G1–G4 mit einer benannten Verstellung.
// Eine Messung, die nur in der Gegenprobe stünde, bewiese nur sich selbst.

/** Obergrenze der Tab-Schritte: keine geratene Zahl, sondern eine Abbruchbedingung mit Meldung. */
export const MAX_TABS = 200;

/** Die Markierung im Vorlagenfeld, so wie der Browser sie gerade hält. */
export interface Markierung {
  start: number;
  ende: number;
  laenge: number;
}

export async function leseMarkierung(page: Page): Promise<Markierung> {
  return page.locator(VORLAGE).evaluate((el) => {
    const feld = el as HTMLTextAreaElement;
    return { start: feld.selectionStart, ende: feld.selectionEnd, laenge: feld.value.length };
  });
}

/** Vollmarkiert heisst: von 0 bis zum letzten Zeichen, und es GIBT Zeichen. */
export function istVollmarkiert(m: Markierung): boolean {
  return m.laenge > 0 && m.start === 0 && m.ende === m.laenge;
}

/** MAUSWEG: ein echter Klick ins Vorlagenfeld, danach die Markierung ablesen. */
export async function mausMarkierung(page: Page): Promise<Markierung> {
  await page.locator(VORLAGE).click();
  return leseMarkierung(page);
}

/**
 * TASTATURWEG: vom aktuellen Fokus aus mit echten Tab-Drücken so lange weiter, bis `istZiel` im
 * Browser wahr ist — oder `MAX_TABS` erreicht sind. Der Aufrufer sorgt für den Startpunkt (nach
 * `goto`/`reload` ist das der Dokumentanfang, dort, wo auch ein Mensch mit der Tastatur beginnt).
 */
export async function tabBis(
  page: Page,
  istZiel: () => boolean,
): Promise<{ erreicht: boolean; schritte: number }> {
  let schritte = 0;
  let erreicht = false;
  while (schritte < MAX_TABS && !erreicht) {
    await page.keyboard.press("Tab");
    schritte++;
    erreicht = await page.evaluate(istZiel);
  }
  return { erreicht, schritte };
}

/** Tab vom Seitenanfang bis ins Vorlagenfeld (Kennung fest: `ImportJsonUpload.tsx:84`). */
export function tabBisVorlage(page: Page): Promise<{ erreicht: boolean; schritte: number }> {
  return tabBis(page, () => document.activeElement?.id === "import-json-example");
}

/** Was L1 über das Layout misst — Rechtecke und Scrollbreiten, keine CSS-Klassen. */
export interface LayoutMessung {
  dokScroll: number;
  dokClient: number;
  feldScroll: number;
  feldClient: number;
  kasten: { x: number; width: number } | null;
  feld: { x: number; width: number } | null;
}

export async function messeLayout(page: Page): Promise<LayoutMessung> {
  const sicht = await page.evaluate((feldId) => {
    const feld = document.getElementById(feldId);
    return {
      dokScroll: document.documentElement.scrollWidth,
      dokClient: document.documentElement.clientWidth,
      feldScroll: feld?.scrollWidth ?? -1,
      feldClient: feld?.clientWidth ?? -1,
    };
  }, VORLAGE_ID);
  return {
    ...sicht,
    kasten: await page.locator(JSON_KASTEN).boundingBox(),
    feld: await page.locator(VORLAGE).boundingBox(),
  };
}

/** Ein Pixel Toleranz für Teilpixel-Rundung bei fraktionalen Layoutbreiten. */
export const TOLERANZ_PX = 1;

/**
 * Alle Layout-Verstösse einer Messung als Sätze — leer heisst: passt. Die fünf Aussagen sind die,
 * die L1 seit JOB 3177 einzeln zusichert: kein waagerechter Dokumentüberlauf, Kasten und
 * Vorlagenfeld links wie rechts im Sichtfenster, und der Inhalt schiebt im Feld nicht waagerecht.
 */
export function layoutVerstoesse(m: LayoutMessung, wo: string): string[] {
  const raus: string[] = [];
  const grenze = m.dokClient + TOLERANZ_PX;
  if (m.dokScroll > grenze) {
    raus.push(
      `waagerechter Überlauf (${wo}): scrollWidth ${m.dokScroll} > clientWidth ${m.dokClient}`,
    );
  }
  for (const [name, r] of [
    ["der JSON-Kasten", m.kasten],
    ["das Vorlagenfeld", m.feld],
  ] as const) {
    if (r === null) {
      raus.push(`${name} hat kein Kastenrechteck (${wo})`);
      continue;
    }
    if (r.x < -TOLERANZ_PX) {
      raus.push(`${name} ragt links hinaus (${wo}): x=${r.x}`);
    }
    if (r.x + r.width > grenze) {
      raus.push(
        `${name} ragt rechts hinaus (${wo}): x=${r.x} + Breite=${r.width} > ${m.dokClient}`,
      );
    }
  }
  if (m.feldScroll > m.feldClient + TOLERANZ_PX) {
    raus.push(
      `die Vorlage schiebt im Feld waagerecht (${wo}): scrollWidth ${m.feldScroll} > clientWidth ${m.feldClient}`,
    );
  }
  return raus;
}

/** Eine HTTP-Antwort, wie der Browser der angemeldeten Sitzung sie bekommen hat. */
export interface HttpAntwort {
  status: number;
  typ: string;
  rumpf: string;
}

/**
 * `GET` ÜBER DEN BROWSER DER SEITE: `fetch` im Dokument, mit dem Keksbeutel der Sitzung, gegen
 * denselben Server, den der Smoke ohnehin fährt — kein neuer Egress. Dass es `fetch` im Dokument
 * ist und nicht `page.request`, ist Absicht: nur so läuft die Anfrage durch `page.route`, und G4
 * kann die Serverantwort verstellen, ohne dass L3 einen anderen Weg geht als seine Gegenprobe.
 */
export function holeUeberBrowser(page: Page, pfad: string): Promise<HttpAntwort> {
  return page.evaluate(async (url) => {
    const antwort = await fetch(url, { credentials: "same-origin" });
    return {
      status: antwort.status,
      typ: antwort.headers.get("content-type") ?? "",
      rumpf: await antwort.text(),
    };
  }, pfad);
}

export const EXPORT_PFAD = "/api/library/export";
export const KANDIDATEN_PFAD = "/api/library/import/candidates";

/**
 * Die Form, die L3 vom Export verlangt: 200, JSON, eine Liste. Die Meldungen tragen Status und
 * `content-type`, damit ein roter Lauf sagt, WAS stattdessen kam (Auftrag 3218 § 9 „Fehler").
 */
export function exportFormFehler(a: HttpAntwort): { fehler: string[]; daten: unknown } {
  const fehler: string[] = [];
  if (a.status !== 200) {
    fehler.push(`Export antwortet nicht mit 200 (Status ${a.status}, content-type: ${a.typ})`);
  }
  if (!a.typ.includes("application/json")) {
    fehler.push(`Export antwortet nicht als JSON (Status ${a.status}, content-type: ${a.typ})`);
  }
  let daten: unknown = null;
  try {
    daten = JSON.parse(a.rumpf);
  } catch {
    fehler.push(`Export ist kein lesbares JSON (Status ${a.status}, content-type: ${a.typ})`);
    return { fehler, daten };
  }
  if (!Array.isArray(daten)) {
    fehler.push(
      `der Export ist keine Liste — der Import erwartet ein Array (Status ${a.status}, content-type: ${a.typ})`,
    );
  }
  return { fehler, daten };
}

/** Die Felder eines Warteschlangen-Kandidaten, die L3 liest (`ImportCandidate` im Produkt). */
export interface KandidatAufDemDraht {
  id: string;
  item: { title?: unknown; statement?: unknown; originalAuthor?: unknown };
  status: string;
  duplicate: boolean;
  dublettenbefund?: {
    ergebnis: string;
    treffer?: { art: string; koId?: string; kandidatId?: string };
  };
}

/** Die Prüfwarteschlange über HTTP neu lesen — dieselbe Route, aus der die Seite ihre Liste lädt. */
export async function leseKandidaten(page: Page): Promise<KandidatAufDemDraht[]> {
  const a = await holeUeberBrowser(page, KANDIDATEN_PFAD);
  expect(a.status, `Warteschlange antwortet nicht mit 200 (content-type: ${a.typ})`).toBe(200);
  const daten: unknown = JSON.parse(a.rumpf);
  expect(Array.isArray(daten), "die Warteschlange ist keine Liste").toBe(true);
  return daten as KandidatAufDemDraht[];
}

/** Eine Datei, wie sie der Dateidialog übergibt. */
export interface Datei {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * DATEIÜBERGABE PER MAUS: ein echter Klick auf die sichtbare Beschriftung „JSON-Datei wählen", die
 * den Dateieingang umschliesst (`ImportJsonUpload.tsx`, `<label>` um `#imp-json-upload-input`).
 * Der Klick muss den Dateidialog WIRKLICH öffnen — Playwright meldet das als `filechooser`; bleibt
 * das Ereignis aus, ist der Fall rot. Nur der Systemdialog selbst ist für den Browser nicht
 * bedienbar: die Datei wird dem geöffneten Dialog übergeben, nicht am Eingang vorbei gesetzt.
 */
export async function reicheDateiPerMaus(page: Page, datei: Datei): Promise<void> {
  const dialog = page.waitForEvent("filechooser", { timeout: 10_000 });
  await page
    .locator(JSON_KASTEN)
    .locator("label", { has: page.locator(JSON_EINGANG) })
    .click();
  await (await dialog).setFiles(datei);
}

/**
 * DATEIÜBERGABE PER TASTATUR: vom Seitenanfang mit Tab bis zur JSON-Kachel der Quellengalerie
 * (`data-id` aus `JSON_SOURCE_IDS`, `lib/importSourceGallery.ts`), dort Enter. Die Kachel ist ein
 * `<button>`; ihr Aktivieren fordert über den Cockpit-Zustand den Dateidialog an
 * (`ImportStepper.tsx`, `chooseSource("json")`). Der versteckte Eingang selbst ist nicht fokussierbar
 * — die Kachel ist der Tastaturweg, und genau der wird hier gegangen.
 */
export async function reicheDateiPerTastatur(
  page: Page,
  datei: Datei,
): Promise<{ schritte: number }> {
  const weg = await tabBis(page, () => {
    const id = document.activeElement?.getAttribute("data-id");
    return id === "json" || id === "json-file";
  });
  expect(
    weg.erreicht,
    `Tastaturweg: keine JSON-Kachel in ${MAX_TABS} Tab-Schritten vom Seitenanfang erreichbar`,
  ).toBe(true);
  const dialog = page.waitForEvent("filechooser", { timeout: 10_000 });
  await page.keyboard.press("Enter");
  await (await dialog).setFiles(datei);
  return { schritte: weg.schritte };
}
