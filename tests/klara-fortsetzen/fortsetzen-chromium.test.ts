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

it("R-G1-B · Originalanlage ohne Marker → Stopp → echtes Browserneuladen → nur lesender Ergebnisreadback", async () => {
  if (!stand.app) throw new Error("App fehlt");
  const auf = draht(stand.app, token);
  const v = await vorgang(stand.app, token);
  const begin = await auf("PUT", `${v.pfad}/schritte/r-g1`, {
    nr: 1,
    aktion: "entwurf_erstellen",
    ziel: v.ziele[0],
    auftragFassung: 1,
    stand: "begonnen",
  });
  expect(begin.statusCode, begin.body).toBe(200);
  // Tatsächliche Fachanlage an derselben Produkt-/Vorgangstür. Der Ergebnisbericht bleibt
  // aus: das ist der persistierte Zustand des Abbruchs unmittelbar vor jedem Marker.
  const original = await auf("POST", "/api/drafts", {
    title: v.ziele[0]?.titel,
    statement: "Fiktiver Inhalt; keine Außenaktion.",
    operationId: `klara-auftrag-${v.a.id}-1`,
    expectedOwner: v.a.verantwortlich,
  });
  expect(original.statusCode, original.body).toBe(201);
  const id = original.json().id;
  expect((await auf("PUT", `${v.pfad}/abbruch`, {})).statusCode).toBe(200);
  const vorher = (await auf("GET", v.basis)).json().auftraege[0];
  expect(vorher.ergebnisstand).toBe("unklar");
  expect(vorher.schritte[0].schreibwirkung).toBeUndefined();
  expect(vorher.schritte[0].ausgangUnklar).toBeUndefined();
  const anzahl = (await auf("GET", "/api/drafts")).json().length;
  await seite().goto(`${ORIGIN}/start`);
  await sichtbar("klara-ausfuehrung-erneut");
  const karte = seite().locator('[data-testid="klara-ausfuehrung"][data-stand="abgebrochen"]');
  expect(await karte.getAttribute("data-phase")).toBe("angehalten");
  await seite().getByTestId("klara-ausfuehrung-erneut").click();
  await seite().waitForFunction(
    fn(
      `id => !!document.querySelector('[data-testid="klara-ausfuehrung-schritt-ergebnis"][data-id="'+id+'"]')`,
    ),
    id,
    { timeout: 15_000 },
  );
  const nach = (await auf("GET", v.basis)).json().auftraege[0];
  expect(nach.stand).toBe("abgebrochen");
  expect(nach.schritte[0].ergebnis.id).toBe(id);
  expect(nach.schritte).toHaveLength(1);
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(anzahl);
  const bilder = process.env.KLARA_G_BELEGORDNER;
  if (bilder) await seite().screenshot({ path: join(bilder, "R-G1-B-NUR-READBACK.png") });
}, 60_000);

it("G-D-B · fehlende Zeit gezielt klären, dann persönliche Aufgabe und echte D-Erinnerung über denselben Auftrag", async () => {
  if (!stand.app) throw new Error("App fehlt");
  const auf = draht(stand.app, token);
  const setze = fn(
    `([id,wert])=>{const el=document.querySelector('[data-testid="'+id+'"]');const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,wert);el.dispatchEvent(new Event('input',{bubbles:true}));}`,
  );
  const text = "Lege mir die Aufgabe „Filter G prüfen“ an und erinnere mich";
  await seite().evaluate(setze, ["klara-eingabe", text]);
  await seite().getByTestId("klara-senden").click();
  await sichtbar("klara-auftrag-erinnerungszeit");
  expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(0);
  expect((await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(0);
  for (const [feld, wert] of [
    ["datum", "2035-10-22"],
    ["uhrzeit", "09:00"],
    ["zeitzone", "Europe/Berlin"],
  ])
    await seite().evaluate(setze, [`klara-auftrag-zeit-${feld}`, wert]);
  await seite().getByTestId("klara-auftrag-zeit-uebernehmen").click();
  await seite().waitForFunction(
    fn(
      `()=>[...document.querySelectorAll('[data-testid="klara-ausfuehrung"]')].some(el=>el.getAttribute('data-stand')==='abgeschlossen'&&el.textContent.includes('Filter G prüfen'))`,
    ),
    null,
    { timeout: 15_000 },
  );
  const aufgaben = (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben;
  const erinnerungen = (await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen;
  expect(aufgaben).toHaveLength(1);
  expect(erinnerungen).toHaveLength(1);
  expect(erinnerungen[0].bezug.aufgabeId).toBe(aufgaben[0].id);
  const id = erinnerungen[0].id;
  await seite()
    .locator(`[data-testid="klara-ausfuehrung-schritt-ergebnis"][data-id="${id}"]`)
    .click();
  await seite().waitForFunction(
    fn(
      `id=>document.querySelector('[data-testid="klara-erinnerungen"]')!==null&&location.search.includes(encodeURIComponent(id))`,
    ),
    id,
    { timeout: 15_000 },
  );
  expect(await seite().evaluate(fn("()=>document.body.innerText"))).toContain("Filter G prüfen");
  const bilder = process.env.KLARA_G_BELEGORDNER;
  if (bilder) await seite().screenshot({ path: join(bilder, "G-D-B-ORIGINALERINNERUNG.png") });
}, 60_000);
