import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ORIGIN, type Stand, fn, starte } from "../design/h6-chromium";
import { draht, vorgang } from "./vorrichtung";

let stand: Stand;
let token = "";
let basis = "";
let pfad = "";
let originalId = "";
const seite = () => {
  if (stand.fehler || !stand.seite) throw new Error(stand.fehler ?? "Seite fehlt");
  return stand.seite;
};
const sichtbar = (id: string) =>
  seite()
    .waitForFunction(
      fn(
        `id => { const el = document.querySelector('[data-testid="' + id + '"]'); return !!el && el.getBoundingClientRect().width > 0; }`,
      ),
      id,
      { timeout: 15_000 },
    )
    .catch(async (error) => {
      console.log(
        "G-B1-DIAGNOSE",
        await seite().evaluate(fn("() => document.body.innerText")),
        JSON.stringify([...stand.abrufe.entries()]),
      );
      const ordner = process.env.KLARA_G_BELEGORDNER;
      if (ordner) {
        mkdirSync(ordner, { recursive: true });
        await seite().screenshot({ path: join(ordner, "G-B1-FEHLENDER-ANKER.png") });
      }
      throw error;
    });
beforeAll(async () => {
  stand = await starte("/start", '[data-testid="kopfband"]', 1280, 900, async (app) => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3065.test", password: "geheim12345" },
    });
    token = login.json().token;
    const v = await vorgang(app, token);
    basis = v.basis;
    pfad = v.pfad;
    const gespeichert = await v.aus(1);
    expect(gespeichert.statusCode).toBe(200);
    originalId = gespeichert.json().schritt.ergebnis.id;
    expect(
      (await draht(app, token)("POST", `${pfad}/unterbrechen`, { auftragFassung: 1 })).statusCode,
    ).toBe(200);
  });
  expect(stand.fehler).toBeNull();
}, 120_000);
afterAll(async () => {
  await stand?.browser?.close();
  await stand?.app?.close();
});

it("G-B1 · gebaute Klara lädt denselben Plan, zeigt kompakten Fortschritt und setzt nach Neuladen ohne Doppelanlage fort", async () => {
  await seite().getByTestId("klara-figur").click();
  await sichtbar("klara-ausfuehrung-erneut");
  expect(await seite().getByTestId("klara-ausfuehrung-fortschritt").textContent()).toContain(
    "1 von 3",
  );
  expect(await seite().getByTestId("klara-ausfuehrung-erneut").textContent()).toContain(
    "Fortsetzen",
  );
  expect(await seite().getByTestId("klara-ausfuehrung-details").getAttribute("open")).toBeNull();
  await seite().locator('[data-testid="klara-ausfuehrung-details"] > summary').click();
  expect(await seite().getByTestId("klara-ausfuehrung-verantwortlich").isVisible()).toBe(true);
  const bilder = process.env.KLARA_G_BELEGORDNER;
  if (bilder) {
    mkdirSync(bilder, { recursive: true });
    await seite().screenshot({ path: join(bilder, "G-B1-PAUSE-DETAILS.png") });
  }
  await seite().goto(`${ORIGIN}/start`);
  await sichtbar("klara-ausfuehrung-erneut");
  // Reales Neuladen löscht Browsermodulzustand; Lesen allein erzeugt keine weiteren Ergebnisse.
  const auf = draht(stand.app!, token);
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(1);
  await seite().getByTestId("klara-ausfuehrung-erneut").click();
  await seite().waitForFunction(
    fn(
      `() => document.querySelector('[data-testid="klara-ausfuehrung"]').getAttribute('data-stand') === 'abgeschlossen'`,
    ),
    null,
    { timeout: 15_000 },
  );
  expect(await seite().getByTestId("klara-ausfuehrung-fortschritt").textContent()).toContain(
    "3 von 3",
  );
  const fertig = (await auf("GET", basis)).json().auftraege[0];
  expect(fertig.schritte[0].ergebnis.id).toBe(originalId);
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(3);
  expect(
    fertig.verlauf.filter((v: { ereignis: string }) => v.ereignis === "fortgesetzt"),
  ).toHaveLength(1);
  if (bilder) await seite().screenshot({ path: join(bilder, "G-B1-FORTGESETZT.png") });
  expect(stand.seitenfehler).toEqual([]);
  console.log(
    JSON.stringify({
      fall: "G-B1",
      chromium: stand.version,
      auftrag: fertig.id,
      ergebnisse: fertig.schritte.map((s: { ergebnis: { id: string } }) => s.ergebnis.id),
      originalId,
    }),
  );
}, 60_000);
