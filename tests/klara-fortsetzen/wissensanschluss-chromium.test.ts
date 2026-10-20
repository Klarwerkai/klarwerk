import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { KlaraWissensDienst } from "../../services/app/src/klara-wissensuebernahme";
import { type Stand, fn, starte } from "../design/h6-chromium";
import { draht } from "./vorrichtung";
let stand: Stand;
let token = "";
const ids: string[] = [];
const seite = () => {
  if (!stand.seite || stand.fehler) throw new Error(stand.fehler ?? "Seite fehlt");
  return stand.seite;
};
const setze = fn(
  `([id,wert])=>{const e=document.querySelector('[data-testid="'+id+'"]');const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,wert);e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}));}`,
);
const auf = (m: "GET" | "POST" | "PUT" | "DELETE", p: string, b?: unknown) => {
  if (!stand.app) throw new Error("App fehlt");
  return draht(stand.app, token)(m, p, b);
};
beforeAll(async () => {
  stand = await starte("/start", '[data-testid="kopfband"]', 1280, 1000, async (app) => {
    const l = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3065.test", password: "geheim12345" },
    });
    token = l.json().token;
    for (let i = 1; i <= 2; i++) {
      const r = await draht(app, token)("POST", "/api/me/klara/notizen", {
        vorgang: `gf08-browser-${i}`,
        weg: "geschrieben",
        titel: `G F08 Browser ${i}`,
        inhalt: `Original ${i}: Nur im Stillstand prüfen.`,
        objektbezug: {
          pfad: "/fragen",
          seitenName: "Fragen",
          objekt: "G privates Browseroriginal",
        },
      });
      expect(r.statusCode, r.body).toBe(201);
      ids.push(r.json().notiz.id);
    }
  });
  expect(stand.fehler).toBeNull();
}, 120000);
afterAll(async () => {
  await stand?.browser?.close();
  await stand?.app?.close();
});
async function waehle(id: string) {
  await seite().locator(`[data-testid="klara-notiz-eintrag"][data-notiz="${id}"]`).click();
  await seite().locator('[data-testid="klara-wissen"] > button').click();
  await seite().evaluate(setze, ["wissen-stufe", "intern"]);
  await seite().evaluate(setze, ["wissen-kategorie", "G-Wartung"]);
  await seite().getByTestId("wissen-vorschau").click();
  await seite().waitForFunction(
    fn(`()=>!!document.querySelector('[data-testid="wissen-vorschau-inhalt"]')`),
    null,
    { timeout: 15000 },
  );
}
it("GF-B1 · vorhandener bewusster F08-Endknopf erzeugt eine einzige echte G-Auftragskarte mit Original-/Zielbindung und gespeichertem Ergebnis", async () => {
  await seite().getByTestId("klara-figur").click();
  await seite().getByTestId("klara-menue-knopf").click();
  await seite().getByTestId("klara-menue-funktionen").click();
  await waehle(ids[0] ?? "");
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(0);
  await seite().getByTestId("wissen-uebernehmen").click();
  await seite().waitForFunction(
    fn(
      `()=>!!document.querySelector('[data-testid="klara-ausfuehrung"][data-stand="abgeschlossen"]')`,
    ),
    null,
    { timeout: 20000 },
  );
  const sichtbar = await seite().evaluate<number>(
    fn(
      `()=>[...document.querySelectorAll('[data-testid="klara-ausfuehrung"]')].filter(e=>e.getBoundingClientRect().width>0).length`,
    ),
  );
  expect(sichtbar).toBe(1);
  const kos = (await auf("GET", "/api/kos")).json();
  expect(kos).toHaveLength(1);
  expect(kos[0].bodyHtml).toContain(ids[0]);
  const g = (await auf("GET", "/api/me/klara/gespraech")).json().gespraech;
  const jobs = (await auf("GET", `/api/me/klara/gespraeche/${g.id}/auftraege`)).json().auftraege;
  const a = jobs.find(
    (a: { plan: { wissen?: { notizId: string } }[] }) => a.plan[0]?.wissen?.notizId === ids[0],
  );
  expect(a.plan[0].wissen.ziel.confidentiality).toBe("intern");
  expect(a.schritte[0].ergebnis.id).toBe(kos[0].id);
  expect((await auf("GET", `/api/me/klara/notizen/${ids[0]}`)).statusCode).toBe(200);
  const bilder = process.env.KLARA_G_F08_BELEGE;
  if (bilder) {
    mkdirSync(bilder, { recursive: true });
    await seite().screenshot({ path: join(bilder, "GF-B1-BEWUSSTES-JOURNAL.png") });
  }
}, 60000);
it("GF-B2 · derselbe sichtbare Journal-Stopp während frischer F08-Vorschau verhindert die abhängige Übernahme", async () => {
  if ((await seite().getByTestId("klara-notiz-offen").count()) > 0)
    await seite().getByTestId("klara-notiz-schliessen").click();
  else {
    await seite().getByTestId("klara-figur").click();
    await seite().getByTestId("klara-menue-knopf").click();
    await seite().getByTestId("klara-menue-funktionen").click();
  }
  const vorher = (await auf("GET", "/api/kos")).json().length;
  let zaehler = 0;
  let frei!: () => void;
  let erreicht!: () => void;
  const halte = new Promise<void>((r) => {
    frei = r;
  });
  const istDa = new Promise<void>((r) => {
    erreicht = r;
  });
  const echt = KlaraWissensDienst.prototype.vorschau;
  const spy = vi.spyOn(KlaraWissensDienst.prototype, "vorschau").mockImplementation(async function (
    this: KlaraWissensDienst,
    user,
    id,
    fassung,
    ziel,
  ) {
    const v = await echt.call(this, user, id, fassung, ziel);
    // UI-Vorschau, Journalbindung, frische Ausführungsvorschau: alle sind echte serverseitige F08-Aufrufe.
    if (id === ids[1] && ++zaehler === 3) {
      erreicht();
      await halte;
    }
    return v;
  });
  try {
    await waehle(ids[1] ?? "");
    await seite().getByTestId("wissen-uebernehmen").click();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        istDa,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`F08-Haltepunkt fehlt; tatsächliche Vorschauen: ${zaehler}`)),
            15000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    await seite().getByTestId("klara-ausfuehrung-abbrechen").click();
    frei();
    await seite().waitForFunction(
      fn(
        `()=>!!document.querySelector('[data-testid="klara-ausfuehrung"][data-stand="abgebrochen"][data-phase="fertig"]')`,
      ),
      null,
      { timeout: 20000 },
    );
    expect((await auf("GET", "/api/kos")).json()).toHaveLength(vorher);
    const g = (await auf("GET", "/api/me/klara/gespraech")).json().gespraech;
    const jobs = (await auf("GET", `/api/me/klara/gespraeche/${g.id}/auftraege`)).json().auftraege;
    const a = jobs.find(
      (a: { plan: { wissen?: { notizId: string } }[] }) => a.plan[0]?.wissen?.notizId === ids[1],
    );
    expect(a.abgebrochenAm).toBeTypeOf("string");
    expect(a.schritte[0].ergebnis).toBeNull();
    expect(stand.seitenfehler).toEqual([]);
    const bilder = process.env.KLARA_G_F08_BELEGE;
    if (bilder) await seite().screenshot({ path: join(bilder, "GF-B2-STOPP.png") });
  } finally {
    frei();
    spy.mockRestore();
  }
}, 60000);
