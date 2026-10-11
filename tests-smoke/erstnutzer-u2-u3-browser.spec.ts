// ================================================================================================
// ERSTNUTZER-HÜRDEN U2 UND U3 AM GEBAUTEN BILDSCHIRM (R-1507 / R-1609, JOB 3007).
// ================================================================================================
//
// `OFFEN.md:124–126` führt drei Erstnutzer-Hürden aus dem Vortest. U1 (zwei Knöpfe ohne erkennbaren
// Unterschied) ist im Browser belegt: `demo-ux-v1-capture-frontdoor.spec.ts`. U2 und U3 waren bis
// hierher nur in jsdom gemessen (`tests/capture/basic-u2-suchraum-*.test.tsx`,
// `tests/bedienbarkeit/u3-*.test.tsx`). Diese Datei misst beide am gebündelten Produkt, mit echtem
// Server, echter Anmeldung und echten Klicks. U4 (`OFFEN.md:123`) ist der Sammelauftrag mega90 und
// keine vierte Hürde.
//
//   · U2 — „unklar, wo die Suche ist und worauf sie sich bezieht“: Bibliothek und Entwürfe sind zwei
//     Suchwelten. Gemessen wird, dass jede Fläche ihren Suchraum nennt, dass ein Nulltreffer weiterführt
//     und dass von der Entwurfswelt ein benannter Weg in die Bibliothek führt.
//   · U3 — „Navigation nicht selbsterklärend, ‚Meine Aufgaben‘ sagt nicht, was es meint“: seit der
//     Gesamt-Navigation 20260922 in `gesamt-navigation-u3-browser.spec.ts` (heutiger Weg
//     „Arbeitsbereiche“ → „Offene Aufgaben“ samt Seitenhilfe; vorher hier: Zahnrad → „Weitere
//     Bereiche“ → „Meine Aufgaben“).
//
// Die erwarteten Texte stehen hier wörtlich (DE ist die Standardsprache des Smoke-Browsers). Die
// Quelle ist `apps/web/src/i18n.ts`: `lib.searchLabel`, `lib.liste.leerSuche`, `lib.liste.erfassen`,
// `capture.draftScope.noteAdmin`, `capture.draftScope.toLibrary`, `nav.tasks`, `help.tasks.*`.
// Die Smoke-Sitzung ist der Admin aus der Ersteinrichtung.
//
// BENANNTE GRENZE: Die Entwurfssuche im Arbeitsraum von `/erfassen` („Entwürfe anzeigen“) misst
// weiter nur jsdom. Hier steht stattdessen die Seite „Meine Entwürfe“, die denselben Suchraumsatz
// und denselben Weg in die Bibliothek trägt (`pages/MeineEntwuerfe.tsx`). Ob ein Mensch die
// Hürde wirklich nicht mehr spürt, beantwortet kein Test, sondern nur ein Nachtest mit Menschen.
import { type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

async function entwurfAnlegen(page: Page): Promise<string> {
  const antwort = await page.request.post("/api/drafts", {
    data: {
      title: "U2-Sonde: Entwurf für den Suchraum",
      statement: "Ein Entwurf, damit die Seite „Meine Entwürfe“ ihren Suchraum zeigt.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(antwort.status(), "Der Entwurf konnte nicht angelegt werden").toBe(201);
  return ((await antwort.json()) as { id: string }).id;
}

test("U2 · Bibliothek: das Suchfeld nennt seinen Suchraum, der Nulltreffer führt zum Erfassen", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  await page.goto("/bibliothek");

  // Der Suchraum steht am Feld selbst: Name und sichtbarer Platzhalter sagen „Bibliothek“.
  const feld = page.getByRole("searchbox", { name: "Bibliothek durchsuchen" });
  await expect(feld).toBeVisible({ timeout: 15_000 });
  await expect(feld).toHaveAttribute("placeholder", "Bibliothek durchsuchen");

  // Die Ortszeile über dem Feld sagt, in welchem Bestand gesucht wird — genau einer ist gewählt.
  // (Tastatur, Adresse und schmale Breite misst `wissensraum381-ortszeile-browser.spec.ts`.)
  const ortszeile = page.getByTestId("library-scope-bar");
  await expect(ortszeile).toBeVisible();
  await expect(ortszeile.locator('button[aria-pressed="true"]')).toHaveCount(1);
  const ortBox = await ortszeile.boundingBox();
  const feldBox = await feld.boundingBox();
  expect(ortBox && feldBox, "Ortszeile oder Suchfeld ohne Box").toBeTruthy();
  if (ortBox && feldBox) {
    expect(ortBox.y, "die Ortszeile steht nicht über dem Suchfeld").toBeLessThan(feldBox.y);
  }

  // Eine Suche ohne Treffer: ein Satz statt einer leeren Fläche, daneben der nächste Schritt.
  await feld.fill(`u2-sonde-kein-treffer-${Date.now()}`);
  const leer = page.getByTestId("bib-leer");
  await expect(leer).toBeVisible({ timeout: 15_000 });
  await expect(leer).toContainText("Nichts gefunden.");
  await expect(leer).not.toContainText("Noch keine Einträge.");
  const weiter = page.getByTestId("bib-leer-erfassen");
  await expect(weiter).toHaveText("Erfassen");
  await weiter.click();
  await expect(page).toHaveURL(/\/erfassen(?:[?#]|$)/);
});

test("U2 · Meine Entwürfe: der Suchraum der Entwürfe ist benannt und führt in die Bibliothek", async ({
  page,
}) => {
  await ensureLoggedIn(page);
  const id = await entwurfAnlegen(page);
  try {
    await page.goto("/entwuerfe");
    await expect(page.getByTestId("page-entwuerfe")).toBeVisible({ timeout: 15_000 });

    // Die Entwurfswelt sagt, dass sie KEIN Bibliothekswissen enthält (Admin-Satz, weil der Admin
    // alle Entwürfe sieht).
    const suchraum = page.getByTestId("entwuerfe-suchraum");
    await expect(suchraum).toBeVisible({ timeout: 15_000 });
    await expect(suchraum).toContainText(
      "Diese Suche durchsucht nur gespeicherte Entwürfe (Admin-Ansicht: alle) — kein Wissen aus der Bibliothek.",
    );

    // Der benannte Weg in die andere Suchwelt: per Tastatur erreichbar, landet am Bibliotheksfeld.
    const weg = page.getByTestId("entwuerfe-zur-bibliothek");
    await expect(weg).toContainText("Im Klarwerk-Wissen suchen");
    await weg.focus();
    await expect(weg).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/bibliothek(?:[?#]|$)/);
    await expect(page.getByRole("searchbox", { name: "Bibliothek durchsuchen" })).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await page.request.delete(`/api/drafts/${id}`);
  }
});

// U3 ist umgezogen (Aufnahme 20260922 · Gesamt-Navigation, R-1813): `gesamt-navigation-u3-browser.spec.ts`
// misst den heutigen Weg „Arbeitsbereiche → Offene Aufgaben“. Diese Datei trägt nur noch U2.
