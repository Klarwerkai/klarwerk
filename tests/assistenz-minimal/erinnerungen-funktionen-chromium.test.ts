import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { type Stand, fn, starte } from "../design/h6-chromium";

// I1: built product UI against the existing real Fastify fixture, synthetic account/content.
// No reminder engine, provider, native host, or live installation is replaced by this test.
const NACHRICHT = "Synthetische Wartungskontrolle Halle B";
const FRAGE_ENTWURF = "Ungesendeter Gesprächsentwurf bleibt erhalten";
let stand: Stand;
let token = "";

const SETZEN = fn(`([id, wert]) => {
  const el = document.querySelector('[data-testid="' + id + '"]');
  if (!el) throw new Error('Feld fehlt: ' + id);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, wert);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}`);

function seite() {
  expect(stand.fehler).toBeNull();
  if (!stand.seite) throw new Error("Chromium-Seite fehlt");
  return stand.seite;
}

async function sichtbar(id: string) {
  await seite().waitForFunction(
    fn(`(id) => {
      const el = document.querySelector('[data-testid="' + id + '"]');
      return !!el && el.getBoundingClientRect().width > 0;
    }`),
    id,
    { timeout: 10_000 },
  );
}

beforeAll(async () => {
  stand = await starte("/start", '[data-testid="kopfband"]', 1280, 900, async (app) => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3065.test", password: "geheim12345" },
    });
    token = (login.json() as { token: string }).token;
    const headers = { authorization: `Bearer ${token}` };
    const objektbezug = { pfad: "/start", seitenName: "Start", objekt: "Synthetische Wartung" };
    const neu = await app.inject({
      method: "POST",
      url: "/api/me/klara/gespraeche",
      headers,
      payload: { objektbezug },
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const id = (neu.json() as { gespraech: { id: string } }).gespraech.id;
    const zustimmung = await app.inject({
      method: "PUT",
      url: `/api/me/klara/gespraeche/${id}/einwilligung`,
      headers,
      payload: { erteilt: true },
    });
    expect(zustimmung.statusCode, zustimmung.body).toBe(200);
    const gespeichert = await app.inject({
      method: "POST",
      url: `/api/me/klara/gespraeche/${id}/nachrichten`,
      headers,
      payload: { von: "du", modus: "frage", text: NACHRICHT, objektbezug },
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(201);
  });
}, 120_000);

afterAll(async () => {
  await stand?.browser?.close();
  await stand?.app?.close();
});

it("reaches reminders through functions and opens a message draft there without a permanent card or lost input", async () => {
  await seite().getByTestId("klara-figur").click();
  await sichtbar("klara-gespraech");
  expect(await seite().getByTestId("klara-gespraech").getAttribute("data-oberflaeche")).toBe(
    "minimal",
  );
  expect(await seite().getByTestId("klara-erinnerungen").count()).toBe(0);

  await seite().getByTestId("klara-menue-knopf").click();
  await seite().getByTestId("klara-menue-funktionen").click();
  await sichtbar("klara-funktion-erinnerungen");
  expect(await seite().getByTestId("klara-erinnerungen").count()).toBe(1);
  await seite().getByTestId("klara-erinnerung-neu").click();
  await sichtbar("klara-erinnerung-entwurf");
  await seite().getByTestId("klara-erinnerung-abbrechen").click();
  expect(await seite().getByTestId("klara-erinnerung-entwurf").count()).toBe(0);
  await seite().getByTestId("klara-unterseite-zurueck").click();
  expect(await seite().getByTestId("klara-erinnerungen").count()).toBe(0);

  await seite().evaluate(SETZEN, ["klara-eingabe", FRAGE_ENTWURF]);
  await sichtbar("klara-nachricht-erinnern");
  await seite().getByTestId("klara-nachricht-erinnern").click();
  await sichtbar("klara-erinnerung-entwurf");
  expect(await seite().getByTestId("klara-gespraech").getAttribute("data-seite")).toBe(
    "funktionen",
  );
  expect(await seite().getByTestId("klara-erinnerung-entwurf-bezug").textContent()).toContain(
    NACHRICHT,
  );
  // The next required field must really be in the viewport, not only mounted below the catalogue.
  const titelSichtbar = await seite()
    .getByTestId("klara-erinnerung-titel")
    .evaluate<boolean>(
      fn(`(el) => {
    const r = el.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && (oben === el || el.contains(oben));
  }`),
    );
  expect(titelSichtbar).toBe(true);
  const datum = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  await seite().getByTestId("klara-erinnerung-datum").click();
  await seite().evaluate(SETZEN, ["klara-erinnerung-datum", datum]);
  await seite().getByTestId("klara-erinnerung-uhrzeit").click();
  await seite().evaluate(SETZEN, ["klara-erinnerung-uhrzeit", "09:00"]);
  await sichtbar("klara-erinnerung-vorschau");
  expect(
    await seite().getByTestId("klara-erinnerung-speichern").getAttribute("disabled"),
  ).toBeNull();
  const titel = "Bearbeiteter Titel vor Unterseitenwechsel";
  await seite().getByTestId("klara-erinnerung-titel").click();
  await seite().evaluate(SETZEN, ["klara-erinnerung-titel", titel]);
  const vorschau = await seite().getByTestId("klara-erinnerung-vorschau").textContent();
  for (const rueckweg of ["zurueck", "escape"] as const) {
    if (rueckweg === "zurueck") {
      await seite().getByTestId("klara-unterseite-zurueck").click();
    } else {
      await seite().keyboard.press("Escape");
    }
    expect(await seite().getByTestId("klara-gespraech").getAttribute("data-seite")).toBe(
      "gespraech",
    );
    expect(await seite().getByTestId("klara-erinnerungen").isVisible()).toBe(false);
    await seite().getByTestId("klara-menue-knopf").click();
    await seite().getByTestId("klara-menue-funktionen").click();
    await sichtbar("klara-erinnerung-entwurf");
    for (const [id, wert] of [
      ["klara-erinnerung-titel", titel],
      ["klara-erinnerung-datum", datum],
      ["klara-erinnerung-uhrzeit", "09:00"],
    ]) {
      expect(
        await seite().evaluate(
          fn(`(id) => document.querySelector('[data-testid="' + id + '"]').value`),
          id,
        ),
      ).toBe(wert);
    }
    expect(await seite().getByTestId("klara-erinnerung-vorschau").textContent()).toBe(vorschau);
    expect(
      await seite().getByTestId("klara-erinnerung-speichern").getAttribute("disabled"),
    ).toBeNull();
  }
  const bilder = process.env.KLARA_I1_BELEGORDNER;
  if (bilder) {
    mkdirSync(bilder, { recursive: true });
    await seite().screenshot({ path: join(bilder, "I1-FOLGE1-ERINNERUNGSENTWURF.png") });
  }
  await seite().getByTestId("klara-erinnerung-abbrechen").click();
  await seite().getByTestId("klara-unterseite-zurueck").click();
  expect(await seite().getByTestId("klara-erinnerungen").count()).toBe(0);
  expect(
    await seite().evaluate(
      fn(`() => document.querySelector('[data-testid="klara-eingabe"]').value`),
    ),
  ).toBe(FRAGE_ENTWURF);
  const liste = await stand.app?.inject({
    method: "GET",
    url: "/api/me/klara/erinnerungen",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(liste?.statusCode).toBe(200);
  expect(liste?.json()).toMatchObject({ erinnerungen: [] });
  expect(stand.seitenfehler).toEqual([]);
}, 30_000);
