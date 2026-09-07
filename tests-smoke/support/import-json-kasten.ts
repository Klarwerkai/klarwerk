// ==================================================================================================
// JOB 3177 (UX-20b) — DIE HANDGRIFFE FÜR DEN JSON-KASTEN AUF /import.
// ==================================================================================================
//
// WARUM DIESE DATEI: die drei Fälle in `ui-smoke.spec.ts` betreten alle dieselbe Seite, und der Weg
// dorthin ist nicht trivial — `/import` liegt hinter dem Stufe-2-Tor. Stünde der Weg dreimal im
// Spec, gäbe es drei Fassungen davon, und die dritte wäre irgendwann die falsche. Dieselbe
// Begründung, die `support/auth.ts` trägt.
//
// WAS HIER NICHT STEHT: keine Zusicherung über das Produkt. Diese Datei bringt einen Lauf nur an den
// Ort, an dem gemessen wird. Alle Erwartungen stehen in den Fällen selbst — bis auf die
// Vorbedingungen, die ein falsches Grün ermöglichen würden (Kasten nicht da, Sprache nicht
// umgestellt): die stehen hier, damit kein Fall auf einer halb geladenen Seite misst.
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
