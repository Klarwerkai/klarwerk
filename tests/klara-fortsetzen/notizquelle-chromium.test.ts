import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ORIGIN, type Stand, fn, starte } from "../design/h6-chromium";
import { gespraechsnotiz, notizauftrag } from "./notizquelle-vorrichtung";
import { draht } from "./vorrichtung";
let stand: Stand;
let token = "";
let q: Awaited<ReturnType<typeof gespraechsnotiz>>;
const seite = () => {
  if (stand.fehler || !stand.seite) throw new Error(stand.fehler ?? "Seite fehlt");
  return stand.seite;
};
const sichtbar = (id: string) =>
  seite().waitForFunction(
    fn(
      `id=>{const e=document.querySelector('[data-testid="'+id+'"]');return !!e&&e.getBoundingClientRect().width>0;}`,
    ),
    id,
    { timeout: 15000 },
  );
const setzen = fn(
  `([id,wert])=>{const e=document.querySelector('[data-testid="'+id+'"]');const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,wert);e.dispatchEvent(new Event('input',{bubbles:true}));}`,
);
beforeAll(async () => {
  stand = await starte("/start", '[data-testid="kopfband"]', 1280, 900, async (app) => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3065.test", password: "geheim12345" },
    });
    token = login.json().token;
    q = await gespraechsnotiz(app, token, "G gespeicherte Browser-Gesprächsnotiz");
  });
  expect(stand.fehler).toBeNull();
}, 120_000);
afterAll(async () => {
  await stand?.browser?.close();
  await stand?.app?.close();
});
it("N-B1 · ausdrücklicher Notizauftrag liest gespeichertes Original, zeigt Fassung/Rücklink und erzeugt echte Aufgabe/Erinnerung", async () => {
  if (!stand.app) throw new Error("App fehlt");
  const auf = draht(stand.app, token);
  await seite().getByTestId("klara-figur").click();
  await sichtbar("klara-eingabe");
  await seite().evaluate(setzen, [
    "klara-eingabe",
    `Aus der Gesprächsnotiz „${q.notiz.titel}“: Lege mir die Aufgabe „Filter aus Originalnotiz prüfen“ an und erinnere mich am 2035-10-22 um 09:00 in Europe/Berlin`,
  ]);
  await seite().getByTestId("klara-senden").click();
  await seite().waitForFunction(
    fn(
      `()=>document.querySelector('[data-testid="klara-ausfuehrung"][data-stand="abgeschlossen"]')!==null`,
    ),
    null,
    { timeout: 15000 },
  );
  const tasks = (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben;
  const es = (await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen;
  expect(tasks).toHaveLength(1);
  expect(es).toHaveLength(1);
  expect(tasks[0]).toMatchObject({
    inhalt: q.original,
    bezug: { art: "notiz", notizId: q.notiz.id },
  });
  expect(es[0].bezug.aufgabeId).toBe(tasks[0].id);
  await seite()
    .locator(`[data-testid="klara-auftrag-notiznachweis"][data-id="${q.notiz.id}"] > summary`)
    .click();
  await sichtbar("klara-auftrag-originalnotiz");
  expect(await seite().getByTestId("klara-auftrag-originalnotiz").textContent()).toContain(
    q.original,
  );
  expect(
    await seite().getByTestId("klara-auftrag-originalnotiz").getAttribute("data-fassung"),
  ).toBe("1");
  expect(await seite().getByTestId("klara-auftrag-notizruecklink").getAttribute("href")).toBe(
    "/fragen",
  );
  const bilder = process.env.KLARA_G_NOTIZ_BELEGORDNER;
  if (bilder) {
    mkdirSync(bilder, { recursive: true });
    await seite().screenshot({ path: join(bilder, "N-B1-ORIGINALNOTIZ.png") });
  }
}, 60000);
it("N-B2 · Notizwechsel nach fertiger Aufgabe und Browserreload sperrt Erinnerung und erhält Originalteilresultat", async () => {
  if (!stand.app) throw new Error("App fehlt");
  const auf = draht(stand.app, token);
  const q2 = await gespraechsnotiz(stand.app, token, "G Browser-Quellenwechsel");
  const v = await notizauftrag(stand.app, token, q2);
  const first = await v.aus(1);
  expect(first.statusCode).toBe(200);
  const id = first.json().schritt.ergebnis.id;
  await auf("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 });
  await auf("PUT", `/api/me/klara/notizen/${q2.notiz.id}`, {
    fassung: 1,
    titel: q2.notiz.titel,
    inhalt: "Tatsächlich geänderte Browserquelle",
    offeneFragen: [],
    art: "notiz",
  });
  const anzahl = (await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen.length;
  await seite().goto(`${ORIGIN}/start`);
  await sichtbar("klara-ausfuehrung-erneut");
  await seite().getByTestId("klara-ausfuehrung-erneut").click();
  await seite().waitForFunction(
    fn(
      `()=>document.querySelector('[data-testid="klara-ausfuehrung-schritt"][data-stand="quelle_gesperrt"]')!==null`,
    ),
    null,
    { timeout: 15000 },
  );
  await seite().waitForFunction(
    fn(
      `()=>document.querySelector('[data-testid="klara-ausfuehrung"][data-phase="angehalten"]')!==null`,
    ),
    null,
    { timeout: 15000 },
  );
  expect(await seite().getByTestId("klara-ausfuehrung-fortschritt").textContent()).toContain(
    "Quelle prüfen",
  );
  expect((await auf("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(anzahl);
  expect((await auf("GET", `/api/me/klara/aufgaben/${id}`)).statusCode).toBe(200);
  const a = await v.lese();
  expect(a.stand).not.toBe("abgeschlossen");
  expect(a.schritte[0]?.ergebnis?.id).toBe(id);
  const bilder = process.env.KLARA_G_NOTIZ_BELEGORDNER;
  if (bilder) await seite().screenshot({ path: join(bilder, "N-B2-QUELLE-GESPERRT.png") });
  expect(stand.seitenfehler).toEqual([]);
}, 60000);
it("N-B3 · gleiche Notiznamen brauchen Auswahl anhand des tatsächlichen Inhalts, ohne vorzeitige Anlage", async () => {
  if (!stand.app) throw new Error("App fehlt");
  const auf = draht(stand.app, token);
  const name = "G zweideutige gespeicherte Notiz";
  await gespraechsnotiz(stand.app, token, name, "Erste Originalquelle: Filter im Nordflügel.");
  const richtig = await gespraechsnotiz(
    stand.app,
    token,
    name,
    "Zweite Originalquelle: Filter im Südflügel.",
  );
  const vorher = (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben.length;
  await seite().getByTestId("klara-ausfuehrung-abbrechen").click();
  await sichtbar("klara-eingabe");
  await seite().evaluate(setzen, [
    "klara-eingabe",
    `Aus der Gesprächsnotiz „${name}“: Lege mir die Aufgabe „Filter im Südflügel prüfen“ an`,
  ]);
  await seite().getByTestId("klara-senden").click();
  await sichtbar("klara-auftrag-notizwahl");
  expect(await seite().getByTestId("klara-auftrag-notizoption").count()).toBe(2);
  expect(await seite().getByTestId("klara-auftrag-notizwahl").textContent()).toContain(
    "Filter im Südflügel",
  );
  expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(vorher);
  await seite()
    .locator(`[data-testid="klara-auftrag-notizoption"][data-id="${richtig.notiz.id}"]`)
    .click();
  await seite().waitForFunction(
    fn(
      `()=>document.querySelector('[data-testid="klara-ausfuehrung"][data-stand="abgeschlossen"]')!==null`,
    ),
    null,
    { timeout: 15000 },
  );
  const neu = (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben;
  expect(neu).toHaveLength(vorher + 1);
  expect(
    neu.find((x: { titel: string }) => x.titel === "Filter im Südflügel prüfen"),
  ).toMatchObject({ inhalt: richtig.original, bezug: { art: "notiz", notizId: richtig.notiz.id } });
  expect(stand.seitenfehler).toEqual([]);
}, 60000);
