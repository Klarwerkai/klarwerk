// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { KlaraArbeitsueberblick } from "../../apps/web/src/components/klara-vorschau/KlaraArbeitsueberblick";
import { leseNotizen, vergissNotizen } from "../../apps/web/src/components/klara-vorschau/notizen";
import i18n from "../../apps/web/src/i18n";
import {
  anfrageEpoche,
  rechtekontextGesehen,
  rechtekontextZuruecksetzen,
} from "../../apps/web/src/lib/rechtekontext";
import { buildServices } from "../../services/app/src/build-app";
import { bis, klick, ruhe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let draht: Draht;
let aufbau: Aufbau;
let services: ReturnType<typeof buildServices>;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let ich: Konto;
let kontoId: string;
const BEZUG = { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "Fiktiver Überblick" };
beforeAll(() => {
  draht = drahtAufbauen();
});
afterAll(() => {
  draht.abbauen();
});
beforeEach(async () => {
  rechtekontextZuruecksetzen();
  localStorage.clear();
  sessionStorage.clear();
  vergissNotizen();
  await i18n.changeLanguage("de");
  aufbau = await appAufbauen(true, () => {
    services = buildServices();
    return services;
  });
  draht.setzeApp(aufbau.app);
  ich = await neuesKonto(aufbau.app, "ueberblick", aufbau.admin);
  const me = await aufbau.app.inject({ url: "/api/auth/me", headers: ich.kopf });
  kontoId = me.json().id;
  draht.setzeCookie(`kw_session=${ich.token}`);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await aufbau.app.close();
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.aufrufe.length = 0;
  vergissNotizen();
});
function teil(id: string): HTMLElement {
  const e = container.querySelector<HTMLElement>(`[data-testid="arbeitsueberblick-${id}"]`);
  if (!e) throw new Error(`Abschnitt fehlt: ${id}`);
  return e;
}
async function montiere(id = kontoId) {
  await act(async () =>
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(KlaraArbeitsueberblick, { key: id, kontoId: id }),
      ),
    ),
  );
  const knopf = container.querySelector<HTMLButtonElement>('[aria-expanded="false"]');
  if (!knopf) throw new Error("Überblickknopf fehlt");
  await klick(knopf);
  await bis(() => !container.querySelector("output"), 200);
  await ruhe();
}
async function aktualisiere() {
  const button = container.querySelector<HTMLButtonElement>(
    '[data-testid="arbeitsueberblick-aktualisieren"]',
  );
  if (!button) throw new Error("Aktualisieren fehlt");
  await klick(button);
  await bis(() => !container.querySelector("output"), 200);
  await ruhe();
}
async function notiz(konto: Konto, titel: string) {
  const r = await aufbau.app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers: konto.kopf,
    payload: {
      vorgang: `ub-notiz-${crypto.randomUUID()}`,
      weg: "geschrieben",
      titel,
      inhalt: `${titel}: Inhalt`,
      objektbezug: BEZUG,
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().notiz;
}
async function erinnerung(konto: Konto, titel: string) {
  const datum = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const r = await aufbau.app.inject({
    method: "POST",
    url: "/api/me/klara/erinnerungen",
    headers: konto.kopf,
    payload: {
      vorgang: `ub-erinnerung-${crypto.randomUUID()}`,
      titel,
      zeitzone: "Europe/Berlin",
      zeitplan: { art: "einmalig", datum, uhrzeit: "09:00" },
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().erinnerung;
}

it("K1-K3: echte offene Aufgabe, Erinnerung, wartende Klärung und Notiz; Original öffnen, Änderungen frisch lesen, Fremdes nicht zeigen", async () => {
  const n = await notiz(ich, "Prüfbericht P-7");
  const a = await aufbau.app.inject({
    method: "POST",
    url: "/api/me/klara/aufgaben",
    headers: ich.kopf,
    payload: {
      vorgang: `ub-aufgabe-${crypto.randomUUID()}`,
      weg: "notiz",
      quelle: { notizId: n.id },
    },
  });
  expect(a.statusCode, a.body).toBe(201);
  const task = a.json().aufgabe;
  const e = await erinnerung(ich, "Messung morgen");
  const vorkommenId = `${e.id}@${e.zeitplan.datum}T09:00`;
  await services.klaraErinnerungen.laeufe.uebernimm({
    vorkommenId,
    erinnerungId: e.id,
    kontoId,
    geplantFuer: Date.now(),
    besitzer: "ueberblick-probe",
    jetzt: Date.now(),
    leaseMs: 120_000,
    art: "erinnerung",
    meldungId: `ke-${vorkommenId}`,
  });
  await services.klaraErinnerungen.laeufe.schliesse(
    vorkommenId,
    "ueberblick-probe",
    "unklar",
    { grund: "quelle_geaendert" },
    Date.now(),
  );
  const fremd = await neuesKonto(aufbau.app, "fremd", aufbau.admin);
  await notiz(fremd, "Fremde Privatnotiz");
  await erinnerung(fremd, "Fremde Erinnerung");
  draht.aufrufe.length = 0;
  await montiere();
  expect(teil("aufgaben").textContent).toContain("Prüfbericht P-7");
  expect(teil("aufgaben").querySelector("a")?.getAttribute("href")).toBe(
    `/aufgaben?persoenlich=${task.id}`,
  );
  expect(teil("erinnerungen").textContent).toContain("09:00 (Europe/Berlin)");
  expect(teil("entscheidungen").textContent).toContain("Öffnen und klären");
  expect(teil("entscheidungen").querySelector("a")?.getAttribute("href")).toBe(
    `/aufgaben?erinnerung=${e.id}`,
  );
  expect(container.textContent).not.toContain("Fremde");
  const noteButton = teil("notizen").querySelector("button");
  if (!noteButton) throw new Error("Notiz fehlt");
  await klick(noteButton);
  await bis(() => leseNotizen().offen?.id === n.id, 100);
  expect(leseNotizen().offen?.id).toBe(n.id);
  expect(draht.aufrufe.every((r) => r.methode === "GET")).toBe(true);
  const done = await aufbau.app.inject({
    method: "PUT",
    url: `/api/me/klara/aufgaben/${task.id}`,
    headers: ich.kopf,
    payload: { fassung: 1, status: "erledigt" },
  });
  expect(done.statusCode, done.body).toBe(200);
  const neu = await aufbau.app.inject({
    method: "PUT",
    url: `/api/me/klara/erinnerungen/${e.id}`,
    headers: ich.kopf,
    payload: { fassung: 1, zeitplan: { ...e.zeitplan, uhrzeit: "11:00" } },
  });
  expect(neu.statusCode, neu.body).toBe(200);
  await aktualisiere();
  expect(teil("aufgaben").querySelector("a")).toBeNull();
  expect(teil("erinnerungen").textContent).toContain("11:00 (Europe/Berlin)");
  expect(teil("erinnerungen").textContent).not.toContain("09:00");
});

it("K4: leerer Bestand bleibt leer; fehlgeschlagene Aufgabe und Kalenderentscheidung werden als Fehler statt Nullbefund gezeigt", async () => {
  draht.stoerungEinmal("/api/me/klara/aufgaben", 503);
  draht.stoerungEinmal("/api/me/klara/kalender", 503);
  await montiere();
  expect(teil("aufgaben").querySelector('[role="alert"]')).not.toBeNull();
  expect(teil("aufgaben").textContent).not.toContain("Hier liegt derzeit nichts");
  expect(teil("entscheidungen").textContent).toContain("unvollständig");
  expect(teil("entscheidungen").textContent).not.toContain("Hier liegt derzeit nichts");
  expect(teil("notizen").textContent).toContain("Hier liegt derzeit nichts");
  await aktualisiere();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(teil("aufgaben").textContent).toContain("Hier liegt derzeit nichts");
});

it("K1/K3: bewusst übergebene Erinnerung ist mit derselben ID sichtbar, private Quellnotiz der Eigentümerin nicht", async () => {
  const owner = await neuesKonto(aufbau.app, "eigentum", aufbau.admin);
  await notiz(owner, "Private Notiz der Eigentümerin");
  const e = await erinnerung(owner, "Bewusst übergebene Messung");
  const r = await aufbau.app.inject({
    method: "POST",
    url: `/api/me/klara/erinnerungen/${e.id}/uebergabe`,
    headers: owner.kopf,
    payload: { fassung: 1, an: ich.email },
  });
  expect(r.statusCode, r.body).toBe(200);
  await montiere();
  expect(teil("erinnerungen").querySelector("a")?.getAttribute("href")).toBe(
    `/aufgaben?erinnerung=${e.id}`,
  );
  expect(teil("erinnerungen").textContent).toContain("Bewusst übergebene Messung");
  expect(container.textContent).not.toContain("Private Notiz der Eigentümerin");
});

it("K3: erkannter Rechtewechsel verwirft angezeigte und verspätete Listen; neues Konto liest nur seine Originale", async () => {
  await notiz(ich, "Altprivat vor Rechtewechsel");
  const neu = await neuesKonto(aufbau.app, "neues-konto", aufbau.admin);
  await notiz(neu, "Neue eigene Notiz");
  // Der app.inject-Draht liefert keine HTTP-Kopfdaten; das vorhandene Rechteereignis wird hier
  // gezielt eingespeist. Konten, Listen und deren Antworten stammen aus der echten App.
  rechtekontextGesehen("probe-alter-rechtekontext", anfrageEpoche());
  await montiere();
  expect(teil("notizen").textContent).toContain("Altprivat");
  const vorherFetch = globalThis.fetch;
  let freigeben!: () => void;
  let antwortWartet = false;
  const warte = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  let einmal = true;
  globalThis.fetch = (async (input, init) => {
    const antwort = await vorherFetch(input, init);
    if (String(input) === "/api/me/klara/notizen" && einmal) {
      einmal = false;
      antwortWartet = true;
      await warte;
    }
    return antwort;
  }) as typeof fetch;
  try {
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="arbeitsueberblick-aktualisieren"]',
    );
    if (!button) throw new Error("Aktualisieren fehlt");
    await klick(button);
    await bis(() => antwortWartet, 100);
    expect(antwortWartet).toBe(true);
    act(() => rechtekontextGesehen("probe-neuer-rechtekontext", anfrageEpoche()));
    expect(container.textContent).not.toContain("Altprivat");
    freigeben();
    await ruhe();
    expect(container.textContent).not.toContain("Altprivat");
    draht.setzeCookie(`kw_session=${neu.token}`);
    await montiere("neues-konto");
    expect(teil("notizen").textContent).toContain("Neue eigene Notiz");
    expect(container.textContent).not.toContain("Altprivat");
  } finally {
    freigeben();
    globalThis.fetch = vorherFetch;
  }
});
