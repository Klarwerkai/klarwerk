import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { KlaraAusfuehrung } from "../../services/app/src/klara-ausfuehrung";
import { ORIGIN, type Stand, fn, starte } from "../design/h6-chromium";
import { draht } from "./vorrichtung";
let stand: Stand;
let token = "";
const seite = () => {
  if (!stand.seite || stand.fehler) throw new Error(stand.fehler ?? "Seite fehlt");
  return stand.seite;
};
const setzen = fn(
  `([id,wert])=>{const e=document.querySelector('[data-testid="'+id+'"]');const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,wert);e.dispatchEvent(new Event('input',{bubbles:true}));}`,
);
const sichtbar = (id: string) =>
  seite().waitForFunction(
    fn(
      `id=>{const e=document.querySelector('[data-testid="'+id+'"]');return !!e&&e.getBoundingClientRect().width>0;}`,
    ),
    id,
    { timeout: 15000 },
  );
const auf = (m: "GET" | "POST" | "PUT" | "DELETE", p: string, b?: unknown) => {
  if (!stand.app) throw new Error("App fehlt");
  return draht(stand.app, token)(m, p, b);
};
async function jobs() {
  const g = (await auf("GET", "/api/me/klara/gespraech")).json().gespraech;
  return (await auf("GET", `/api/me/klara/gespraeche/${g.id}/auftraege`)).json()
    .auftraege as KlaraAuftrag[];
}
async function bild(name: string) {
  const p = process.env.KLARA_G_BES_BELEGE;
  if (p) {
    mkdirSync(p, { recursive: true });
    await seite().screenshot({ path: join(p, `${name}.png`) });
  }
}
beforeAll(async () => {
  stand = await starte("/start", '[data-testid="kopfband"]', 1280, 1000, async (app) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3065.test", password: "geheim12345" },
    });
    expect(r.statusCode).toBe(200);
    token = r.json().token;
  });
  expect(stand.fehler).toBeNull();
}, 120000);
afterAll(async () => {
  await stand?.browser?.close();
  await stand?.app?.close();
});
it("BES-B1 · neue kritische Rückfrage fragt nur fehlende Menge/Termin; bekannte Produkt-/Bedarfsdaten bleiben, zwei echte Entwürfe ohne Außenwirkung", async () => {
  await seite().getByTestId("klara-figur").click();
  await sichtbar("klara-eingabe");
  await seite().evaluate(setzen, [
    "klara-eingabe",
    "Besorge neue Angebote für die Verpackung von Produkt „PX-17“",
  ]);
  await seite().getByTestId("klara-senden").click();
  await sichtbar("klara-bes-rueckfrage");
  expect(await seite().getByTestId("klara-bes-produkt").count()).toBe(0);
  expect(await seite().getByTestId("klara-bes-bedarf").count()).toBe(0);
  expect(await seite().getByTestId("klara-bes-bekannt").textContent()).toContain(
    "PX-17 · Verpackung",
  );
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(0);
  await bild("BES-B1-NUR-FEHLENDE-ANGABEN");
  await seite().evaluate(setzen, ["klara-bes-menge", "500 Stück"]);
  await seite().evaluate(setzen, ["klara-bes-termin", "2035-11-30"]);
  await seite().getByTestId("klara-bes-uebernehmen").click();
  await seite().waitForFunction(
    fn(
      `()=>!!document.querySelector('[data-testid="klara-ausfuehrung"][data-stand="abgeschlossen"]')`,
    ),
    null,
    { timeout: 20000 },
  );
  const a = (await jobs()).find((a) => a.beschaffung);
  expect(a?.beschaffung).toMatchObject({
    produkt: "PX-17",
    bedarf: "Verpackung",
    menge: "500 Stück",
    termin: "2035-11-30",
    erlaubteEmpfaenger: [],
    aussenwirkung: "keine",
  });
  const ds = (await auf("GET", "/api/drafts")).json();
  expect(ds).toHaveLength(2);
  expect(
    ds.find((d: { id: string }) => d.id === a?.schritte[1]?.ergebnis?.id).payload.bodyHtml,
  ).toContain(a?.schritte[0]?.ergebnis?.id);
  expect(await seite().getByTestId("klara-ausfuehrung-fortschritt").textContent()).toContain(
    "weitere Beschaffungsschritte offen",
  );
  await bild("BES-B1-ECHTE-INTERNE-ENTWUERFE");
}, 60000);
it("BES-B2 · echte erste Wirkung → sichtbare Pause → Mengekorrektur → Browserneuladen → Fortsetzen nur offener Anfrage mit unverändertem Anforderungsoriginal", async () => {
  await seite().getByTestId("klara-ausfuehrung-schliessen").click();
  let frei!: () => void;
  let erreicht!: () => void;
  const halte = new Promise<void>((r) => {
    frei = r;
  });
  const da = new Promise<void>((r) => {
    erreicht = r;
  });
  let einmal = false;
  const echt = KlaraAusfuehrung.prototype.fuehreAus;
  const spy = vi.spyOn(KlaraAusfuehrung.prototype, "fuehreAus").mockImplementation(async function (
    this: KlaraAusfuehrung,
    ...args: Parameters<typeof echt>
  ) {
    const r = await echt.apply(this, args);
    // Nur Antworttransport nach der echten Speicherung des ersten Schritts anhalten; keine Fachantwort ersetzen.
    if (args[4].nr === 1 && !einmal) {
      einmal = true;
      erreicht();
      await halte;
    }
    return r;
  });
  try {
    await sichtbar("klara-eingabe");
    await seite().evaluate(setzen, [
      "klara-eingabe",
      "Besorge neue Angebote für die Verpackung von Produkt „PX-17“ für 500 Stück bis 2035-11-30",
    ]);
    await seite().getByTestId("klara-senden").click();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        da,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Echte erste BES-Wirkung nicht erreicht")),
            15000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    await seite().getByTestId("klara-ausfuehrung-unterbrechen").click();
    await sichtbar("klara-bes-korrigieren");
    frei();
    const a = (await jobs()).find((a) => a.unterbrochenAm);
    expect(a?.schritte).toHaveLength(1);
    const id = a?.schritte[0]?.ergebnis?.id;
    expect(id).toBeTypeOf("string");
    const original = (await auf("GET", `/api/drafts/${id}`)).body;
    await seite().getByTestId("klara-bes-korrigieren").click();
    await seite().evaluate(setzen, ["klara-bes-menge", "750 Stück"]);
    await seite().getByTestId("klara-bes-uebernehmen").click();
    await seite().waitForFunction(
      fn(
        `()=>document.querySelector('[data-testid="klara-bes-bekannt"]')?.textContent.includes('750 Stück')`,
      ),
      null,
      { timeout: 15000 },
    );
    await bild("BES-B2-KORRIGIERTE-PAUSE");
    await seite().goto(`${ORIGIN}/start`);
    await sichtbar("klara-ausfuehrung-erneut");
    expect((await auf("GET", `/api/drafts/${id}`)).body).toBe(original);
    expect((await auf("GET", "/api/drafts")).json()).toHaveLength(3);
    await seite().getByTestId("klara-ausfuehrung-erneut").click();
    await seite().waitForFunction(
      fn(
        `()=>!document.querySelector('[data-testid="klara-ausfuehrung"][data-stand="laeuft"]')&&[...document.querySelectorAll('[data-testid="klara-ausfuehrung"][data-stand="abgeschlossen"]')].length===2`,
      ),
      null,
      { timeout: 20000 },
    );
    const done = (await jobs()).find((x) => x.id === a?.id);
    expect(done?.fassung).toBe(2);
    expect(done?.beschaffung?.menge).toBe("750 Stück");
    expect(done?.fassungen[0]?.beschaffung?.menge).toBe("500 Stück");
    expect(done?.schritte[0]?.ergebnis?.id).toBe(id);
    const inquiry = (await auf("GET", `/api/drafts/${done?.schritte[1]?.ergebnis?.id}`)).json();
    expect(inquiry.payload.bodyHtml).toContain("750 Stück");
    expect(inquiry.payload.bodyHtml).toContain(id);
    expect((await auf("GET", `/api/drafts/${id}`)).body).toBe(original);
    expect((await auf("GET", "/api/drafts")).json()).toHaveLength(4);
    expect(stand.seitenfehler).toEqual([]);
    await bild("BES-B2-FORTGESETZT");
  } finally {
    frei();
    spy.mockRestore();
  }
}, 60000);
