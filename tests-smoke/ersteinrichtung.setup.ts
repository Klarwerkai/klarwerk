// AUFTRAG-mega24 Block A: die Ersteinrichtung bekommt einen EIGENTÜMER.
//
// Die Ersteinrichtung ist eine EINMAL-RESSOURCE des geteilten In-Memory-Servers: sie existiert
// genau ein Mal pro `npm run smoke:ui`. Bis mega23 hatte sie keinen Eigentümer — wer alphabetisch
// zuerst lief, verbrauchte sie nebenbei. Das hatte zwei Folgen, und die zweite ist die schlimmere:
//
//   1. Die Nachzügler fielen auf ein Anmeldeformular, in dem ihr Konto nie angelegt war (der rote
//      Lauf, der mega24 ausgelöst hat). Das ist mit gemeinsamen Zugangsdaten behoben — s.
//      `support/auth.ts`.
//   2. Der Test „Ersteinrichtung legt den Admin an" in `ui-smoke.spec.ts` prüfte die Ersteinrichtung
//      nur dann WIRKLICH, wenn er zufällig als erster lief. Sonst durchlief er still das
//      Anmeldeformular und war grün, ohne je gemessen zu haben, was sein Name behauptet.
//
// Punkt 2 wäre durch gemeinsame Zugangsdaten allein NICHT behoben: der Test wäre wieder grün, aber
// seine BEDEUTUNG hinge weiter an der Dateireihenfolge — dieselbe Falle unter anderem Namen. Genau
// das ist in diesem Auftrag ausgeschlossen.
//
// Deshalb läuft die Ersteinrichtung hier: als Playwright-Setup-Projekt, von dem die drei Engines
// über `dependencies` abhängen. Sie läuft damit GENAU EIN MAL, DETERMINISTISCH ALS ERSTES und gegen
// einen garantiert frischen Server — die Zusicherungen unten dürfen deshalb HART sein (kein
// „falls das Formular da ist"). Danach finden alle Sonden verlässlich das Anmeldeformular vor.
//
// EHRLICHE GRENZE, die hier stehen bleiben soll: die Ersteinrichtung wird damit in EINER Engine
// (Chromium) durchlaufen, nicht in dreien. Das ist kein Verlust — vorher war es faktisch ebenfalls
// nur eine (die erste; die beiden anderen sahen schon das Anmeldeformular), nur unausgesprochen.
import { expect, test } from "@playwright/test";
// JOB 3337 · ADMIN-NAVIGATION — die Reiter der Verwaltung werden GELESEN, nicht abgeschrieben.
// `ADMIN_SECTIONS` ist die eine Quelle, aus der `pages/Admin.tsx:435` die Reiterspalte füllt; sie
// hat keine eigenen Importe und ist deshalb auch von hier aus benutzbar. Vorher stand hier der
// Name eines einzelnen Reiters („Daten") als Literal — er hat den Umbau dieses Jobs nicht
// überlebt, und niemand konnte das vor dem roten Lauf sehen. Ein Literal weiss nichts davon,
// dass sich die Gliederung geändert hat; dieser Import schon.
import { ADMIN_SECTIONS, adminSectionFuerDetail } from "../apps/web/src/lib/adminSections";
import { SMOKE_MAIL, SMOKE_NAME, SMOKE_PASS, workspaceMarker } from "./support/auth";

/**
 * Die Reiterspalte der VERWALTUNG.
 *
 * `page-admin` setzt `pages/Admin.tsx` über `seitenSchluessel="admin"`
 * (`components/einstellungen/Seite.tsx:90`) — diese Seite rendert das Rollen-Gate nur für einen
 * Admin; ein Nicht-Admin steht auf `/start` und hat den Anker nirgends. `data-einst="reiter"` ist
 * der eine Ort, der Reiter zeichnet (`Seite.tsx:47-61`), es gibt kein zweites Bauteil daneben.
 */
const ADMIN_REITER = '[data-testid="page-admin"] [data-einst="reiter"]';

test("Ersteinrichtung legt den Admin an und landet im Arbeitsbereich", async ({ page }) => {
  await page.goto("/");

  // HARTE Zusicherung, kein Zweig: dieses Projekt läuft als erstes gegen einen frischen
  // In-Memory-Server (`reuseExistingServer: false`), also MUSS hier die Ersteinrichtung stehen.
  // Steht stattdessen „Anmelden", ist die Reihenfolge-Garantie gebrochen — und das soll krachen.
  await expect(page.getByRole("heading", { name: "Ersteinrichtung" })).toBeVisible({
    timeout: 15_000,
  });

  // Das Namensfeld gibt es nur im Ersteinrichtungs-/Registrierungs-Formular (AuthScreens.tsx:121-125).
  const nameField = page.locator('form input:not([type="email"]):not([type="password"])');
  await expect(nameField.first()).toBeVisible();
  await nameField.first().fill(SMOKE_NAME);

  await page.locator('input[type="email"]').fill(SMOKE_MAIL);

  // Passwort + Bestätigung (Vertipper-Schutz bei der Konto-Erstellung, AuthScreens.tsx:106-109).
  const pw = page.locator('input[type="password"]');
  const pwCount = await pw.count();
  expect(pwCount).toBeGreaterThan(1);
  for (let i = 0; i < pwCount; i++) {
    await pw.nth(i).fill(SMOKE_PASS);
  }

  await page.locator('button[type="submit"]').click();
  await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });

  // „legt den ADMIN an" — die Behauptung im Testnamen wird auch geprüft, nicht nur gemacht:
  // die Verwaltung rendert nur für Admins (erstes Konto = Admin, service.ts:120-125).
  //
  // ==============================================================================================
  // AUFTRAG-mega59 BLOCK H2 — DIESER NACHWEIS KONNTE OHNE ADMIN GRÜN WERDEN.
  // ==============================================================================================
  //
  // Geprüft wurde `page.locator("h1, h2").first()`. Bei einem NICHT-Admin leitet das Rollen-Gate auf
  // `/start` um (routes.tsx), und `/start` hat eine `h1` — der Fall war also grün, ohne die
  // Admin-Eigenschaft zu belegen, obwohl sein Kommentar genau das behauptet.
  //
  // Zwei Zusicherungen schließen das, und keine braucht einen neuen Anker:
  //   · `toHaveURL(/\/admin$/)` schließt die Umleitung aus. Wer kein Admin ist, steht auf /start.
  //   · die admin-EIGENE Reiterspalte der Verwaltung — die gibt es nur hier, und der Seed-Weg unten
  //     bedient sie ohnehin. Ein Nicht-Admin sieht sie nirgends.
  //
  // JOB 3337 — NACHFÜHRUNG DER BÜHNE, NICHT ABSCHWÄCHUNG DER AUSSAGE. Bis hierher stand der
  // einzelne Reiter „Daten" als Literal. Dieser Job hat ihn aufgelöst (er trug Demodaten,
  // Werkseinstellungen, Papierkorb UND das Audit-Log — vier Dinge aus vier Welten, s.
  // `lib/adminSections.ts`); die sieben Themen der Vorlage stehen an seiner Stelle. Geprüft wird
  // deshalb, was den Umbau überdauert und dieselbe Sache belegt: dass die Verwaltung ihre
  // VOLLSTÄNDIGE Reiterspalte rendert — vollständig gemessen an `ADMIN_SECTIONS`, nicht an einer
  // Zahl aus dem Kopf. Kein höheres Timeout, kein Skip, und ausdrücklich nicht „irgendein Reiter":
  // fehlt auch nur ein Thema, ist das hier rot.
  await page.goto("/admin");
  await expect(page, "Rollen-Gate hat von /admin umgeleitet — kein Admin").toHaveURL(/\/admin$/, {
    timeout: 10_000,
  });
  await expect(
    page.locator(ADMIN_REITER),
    "die Reiter der Verwaltung fehlen oder sind unvollständig — die Verwaltung rendert nicht als Admin",
  ).toHaveCount(ADMIN_SECTIONS.length, { timeout: 10_000 });
  await expect(page.locator(ADMIN_REITER).first()).toBeVisible();

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // AUFTRAG-mega49 BLOCK A2 — DIE ZWEITE DATENLAGE, ÜBER DEN PRODUKTWEG.
  //
  // Der Anlass: der mega47-Fall hing an einem Bedienelement, das es nur im LEERZUSTAND gibt (siehe
  // `ui-smoke.spec.ts` und den Sammler `tests/smoke/mega49-leerzustands-anker-sammler.test.ts`).
  // Er war deshalb im Tor grün und im vollen Lauf rot — nicht wegen der Engine, sondern wegen der
  // Datenlage. Ein Fall, dessen Grün von der Datenlage abhängt, ist kein Beleg; also muss die
  // Suite gegen BEIDE Lagen fahrbar sein.
  //
  // OHNE diese Variable ändert sich NICHTS: der Server bleibt jungfräulich, das Prüf-Board leer,
  // und `smoke:ui:gate` fährt exakt wie bisher. MIT `KLARWERK_SMOKE_SEED=1` (npm-Skript
  // `smoke:ui:gate:daten`) wird hier — einmal, an derselben Einmal-Stelle wie die Ersteinrichtung —
  // der Demo-Bestand geladen.
  //
  // WARUM ÜBER DIE OBERFLÄCHE UND NICHT ÜBER EINEN TESTHAKEN: „Demodaten laden" ist der VORHANDENE
  // Produktweg (`Admin.tsx` → POST /api/admin/demo-seed → `services/app/src/seed-demo.ts`). Er
  // braucht kein Modell — die Duplikat-/Konfliktbefunde des Seeds laufen ohne aktiven Reasoner
  // schlicht deterministisch bzw. leer aus (`seed-demo.ts:638-649`), die Wissensobjekte entstehen
  // in jedem Fall. Damit bleibt dieser Weg auch im hermetischen Tor gangbar, ohne Egress und ohne
  // Zugangsdatum. Ein zweiter, testeigener Seed-Weg wäre eine zweite Wahrheit über „Demodaten" und
  // ist genau deshalb nicht gebaut.
  if (process.env.KLARWERK_SMOKE_SEED === "1") {
    // JOB 3337: Welcher Reiter die Demodaten trägt, sagt das Produkt selbst — `adminSectionFuerDetail`
    // beantwortet für die Detailkennung `demo` genau die Frage, die hier vorher als Reitername
    // („Daten") hartkodiert war. Seit diesem Job ist es das Thema „Vorführdaten". Verschiebt ein
    // späterer Job sie erneut, folgt dieser Weg mit, statt still am alten Namen zu scheitern.
    const demoThema = adminSectionFuerDetail("demo");
    const demoReiter = ADMIN_SECTIONS.findIndex((s) => s.id === demoThema);
    expect(
      demoReiter,
      `die Detailkennung „demo“ hat kein Thema in ADMIN_SECTIONS (gefunden: ${String(demoThema)})`,
    ).toBeGreaterThanOrEqual(0);
    await page.locator(ADMIN_REITER).nth(demoReiter).click();
    await page.getByTestId("zeile-demodaten").click();
    await page
      .getByTestId("detail-demodaten")
      .getByRole("button", { name: "Demodaten laden", exact: true })
      .click();
    // HARTE Zusicherung, kein „falls es klappt": der Server ist frisch, also MUSS geladen werden.
    // Käme „Übersprungen", wäre die Datenlage eine andere als angenommen — und das soll krachen.
    await expect(page.getByText(/Demodaten geladen:/)).toBeVisible({ timeout: 30_000 });
  }
});
