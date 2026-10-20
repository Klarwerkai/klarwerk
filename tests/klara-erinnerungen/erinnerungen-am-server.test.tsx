// @vitest-environment jsdom
// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) — DIE ERINNERUNGEN IN DER OBERFLÄCHE, AM
// ECHTEN SERVER.
// ================================================================================================
//
// Die echte Hülle (`AppShell`) mit der echten Seite „Meine Aufgaben“ (`pages/MyTasks.tsx`), über den
// Draht aus `tests/klara-quellen-nutzerweg/kette.ts` mit der ECHTEN App im selben Prozess verbunden.
// „Neuladen“ ist: abbauen, den Browserzustand vergessen (`vergiss`) und neu montieren. Die Uhr ist
// die echte — der erwartete Tag wird aus derselben Zeitrechnung bestimmt, die der Server benutzt.
// Die Zustellung selbst (Steuerung, Glocke) misst `erinnerung-am-server.test.ts`; ein echtes Layout
// und echte Bildschirmleser misst diese Datei nicht.
//
//   U1 (K1) „Morgen um neun erinnern“ → Klärung mit Wahl → Vorschau mit Datum, Uhrzeit, Zeitzone
//           (IANA, Versatz) und Ziel; „Abbrechen“ speichert nichts.
//   U2 (K2) Gespeichert, pausiert, nach Neuladen derselbe Stand vom Server; Bedienhilfe in Klara.
//   U4 (EQF-07) Routine: Aktion und Abschnitte wählen, speichern ohne Lauf, Definition (Wirkung)
//           sichtbar, Änderung in Worten erst prüfen, dann übernehmen.
//   U3 (P07, Nacharbeit 2) Einrichtungsassistent mit Zauberhut: Schließen speichert nichts,
//           Übernehmen speichert die Zone, erneut aufrufbar, neuer Entwurf nutzt die Vorgabe.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { loeseMitRegel, lokalVon, plusTage } from "../../services/app/src/klara-erinnerung-zeit";
import { alle, bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
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

const BERLIN = "Europe/Berlin";
const URL_ERINNERUNGEN = "/api/me/klara/erinnerungen";

interface ServerErinnerung {
  id: string;
  titel: string;
  status: string;
  zeitzone: string;
  zeitplan: { art: string; datum?: string; uhrzeit?: string };
}

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;

beforeAll(() => {
  draht = drahtAufbauen();
  echterFetch = globalThis.fetch;
});

afterAll(() => {
  draht.abbauen();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  vergiss();
  setzeKlaraVorschauAktiv(true);
  medienStub();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.aufrufe.length = 0;
});

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

async function vorrichtung(): Promise<{ a: Aufbau; ich: Konto }> {
  const a = await appAufbauen(true);
  aufbau = a;
  draht.setzeApp(a.app);
  const ich = await neuesKonto(a.app, "klara-erinnerungen", a.admin);
  draht.setzeCookie(`kw_session=${ich.token}`);
  return { a, ich };
}

async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seite = createElement(
    Routes,
    null,
    createElement(Route, { path: "/aufgaben", element: createElement(MyTasks) }),
    createElement(Route, { path: "*", element: createElement("div", null, "Seite") }),
  );
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [pfad] },
                  createElement(AppShell, null, seite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  await bis(() => Boolean(flaeche()), 200);
  await bis(() => {
    const f = flaeche();
    return Boolean(f && (q(f, "klara-erinnerungen-leer") || q(f, "klara-erinnerung-eintrag")));
  }, 200);
}

/** Der Abschnitt „Meine Erinnerungen“ auf der Seite (nicht der in Klara). */
function flaeche(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="aufgaben-erinnerungen"]');
}

function inFlaeche<T extends Element = HTMLElement>(testId: string): T | null {
  const f = flaeche();
  return f ? q<T>(f, testId) : null;
}

async function waehle(feld: HTMLSelectElement | null, wert: string): Promise<void> {
  if (!feld) {
    throw new Error("Auswahlfeld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await ruhe(3);
}

async function serverErinnerungen(a: Aufbau, ich: Konto): Promise<ServerErinnerung[]> {
  const r = await a.app.inject({ method: "GET", url: URL_ERINNERUNGEN, headers: ich.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { erinnerungen: ServerErinnerung[] }).erinnerungen;
}

/** „Morgen“ in Berlin, aus derselben Zeitrechnung wie am Server. */
function morgenInBerlin(): string {
  return plusTage(lokalVon(Date.now(), BERLIN).datum, 1);
}

async function bisKlaerung(): Promise<HTMLElement> {
  await bis(() => Boolean(inFlaeche("klara-erinnerung-klaerung")), 120);
  const k = inFlaeche("klara-erinnerung-klaerung");
  if (!k) {
    throw new Error("Keine Klärung angezeigt");
  }
  return k;
}

describe("U1 · K1 — „Morgen um neun“ wird geklärt und eindeutig gezeigt", () => {
  it("Klärung mit Wahl, Vorschau mit Datum, Uhrzeit, Zone und Ziel; Abbrechen speichert nichts", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/aufgaben");
    expect(inFlaeche("klara-erinnerungen-leer")).toBeTruthy();

    await klick(inFlaeche("klara-erinnerung-neu"));
    await bis(() => Boolean(inFlaeche("klara-erinnerung-entwurf")));
    await waehle(inFlaeche<HTMLSelectElement>("klara-erinnerung-zone-wahl"), BERLIN);
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-titel") as HTMLInputElement,
      "Halle 3 lüften",
    );
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-wann") as HTMLInputElement,
      "Morgen um neun erinnern",
    );
    await klick(inFlaeche("klara-erinnerung-deuten"));
    const klaerung = await bisKlaerung();
    expect(["tageszeit_mehrdeutig", "morgen_mehrdeutig"]).toContain(klaerung.dataset.grund);
    // Vor der Wahl ist nichts speicherbar.
    expect(inFlaeche<HTMLButtonElement>("klara-erinnerung-speichern")?.disabled).toBe(true);

    const morgen = morgenInBerlin();
    const option = alle(klaerung, "klara-erinnerung-option").find(
      (o) => o.dataset.datum === morgen && o.dataset.uhrzeit === "09:00",
    );
    expect(option, "die Wahl „morgen 09:00“ fehlt").toBeTruthy();
    await klick(option);

    const erwartet = loeseMitRegel({ datum: morgen, uhrzeit: "09:00" }, BERLIN, {
      luecke: "verschieben",
      doppelt: "erste",
    }).ms;
    await bis(
      () =>
        inFlaeche("klara-erinnerung-naechste")?.dataset.zeitpunkt ===
        new Date(erwartet ?? 0).toISOString(),
      160,
    );
    const vorschau = inFlaeche("klara-erinnerung-vorschau");
    expect(vorschau).toBeTruthy();
    expect(q(vorschau as HTMLElement, "klara-erinnerung-naechste")?.dataset.zeitpunkt).toBe(
      new Date(erwartet ?? 0).toISOString(),
    );
    expect(q(vorschau as HTMLElement, "klara-erinnerung-zone")?.textContent).toMatch(
      /^Europe\/Berlin \(UTC[+-]\d{2}:\d{2}\)$/,
    );
    expect(q(vorschau as HTMLElement, "klara-erinnerung-ziel")?.dataset.ziel).toBe("glocke");
    expect(q(vorschau as HTMLElement, "klara-erinnerung-ziel")?.textContent).toContain("Glocke");
    expect(inFlaeche<HTMLButtonElement>("klara-erinnerung-speichern")?.disabled).toBe(false);

    // Abbrechen ist keine Zustimmung: nichts gespeichert.
    await klick(inFlaeche("klara-erinnerung-abbrechen"));
    expect(inFlaeche("klara-erinnerung-entwurf")).toBeNull();
    expect(await serverErinnerungen(a, ich)).toEqual([]);
  });
});

describe("U2 · K2 — gespeichert, pausiert, nach Neuladen derselbe Stand; Bedienhilfe in Klara", () => {
  it("speichern → Eintrag mit Zeitzone; pausieren → Server bestätigt; Neuladen zeigt dasselbe", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/aufgaben");
    await klick(inFlaeche("klara-erinnerung-neu"));
    await bis(() => Boolean(inFlaeche("klara-erinnerung-entwurf")));
    await waehle(inFlaeche<HTMLSelectElement>("klara-erinnerung-zone-wahl"), BERLIN);
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-titel") as HTMLInputElement,
      "Zähler ablesen",
    );
    const morgen = morgenInBerlin();
    await tippe(inFlaeche<HTMLInputElement>("klara-erinnerung-datum") as HTMLInputElement, morgen);
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-uhrzeit") as HTMLInputElement,
      "09:00",
    );
    await bis(
      () => inFlaeche<HTMLButtonElement>("klara-erinnerung-speichern")?.disabled === false,
      160,
    );
    await klick(inFlaeche("klara-erinnerung-speichern"));
    await bis(() => alle(flaeche() as HTMLElement, "klara-erinnerung-eintrag").length === 1, 160);

    const [gespeichert] = await serverErinnerungen(a, ich);
    expect(gespeichert).toMatchObject({
      titel: "Zähler ablesen",
      status: "aktiv",
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: morgen, uhrzeit: "09:00" },
    });

    await klick(inFlaeche("klara-erinnerung-pausieren"));
    await bis(() => inFlaeche("klara-erinnerung-eintrag")?.dataset.status === "pausiert", 160);
    expect((await serverErinnerungen(a, ich))[0]?.status).toBe("pausiert");

    abbauen();
    vergiss();
    await montiere("/aufgaben");
    const eintrag = inFlaeche("klara-erinnerung-eintrag");
    expect(eintrag?.dataset.status).toBe("pausiert");
    expect(eintrag?.dataset.lage).toBe("pausiert");
    expect(q(eintrag as HTMLElement, "klara-erinnerung-fortsetzen")).toBeTruthy();

    // Die Bedienhilfe dieser Fähigkeit steht von Anfang an in Klara.
    await bis(() => Boolean(q(document, "klara-figur")), 200);
    await klick(q(document, "klara-figur"));
    await bis(() => Boolean(q(document, "klara-bedienhilfe-erinnerung")), 160);
    expect(q(document, "klara-bedienhilfe-erinnerung")?.textContent).toContain("Erinnern");
  });
});

async function serverEinstellungen(
  a: Aufbau,
  ich: Konto,
): Promise<{ zeitzone: string | null; fassung: number; eingerichtetAm: string | null }> {
  const r = await a.app.inject({
    method: "GET",
    url: `${URL_ERINNERUNGEN}/einstellungen`,
    headers: ich.kopf,
  });
  expect(r.statusCode, r.body).toBe(200);
  return (
    r.json() as {
      einstellungen: { zeitzone: string | null; fassung: number; eingerichtetAm: string | null };
    }
  ).einstellungen;
}

describe("U4 · EQF-07 — Routine anlegen, Definition sehen, in Worten ändern", () => {
  it("Wochenbericht: Abschnitte wählen, speichern ohne Lauf, Definition sichtbar, „künftig dienstags“ übernehmen", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/aufgaben");
    await klick(inFlaeche("klara-erinnerung-neu"));
    await bis(() => Boolean(inFlaeche("klara-erinnerung-entwurf")));
    await waehle(inFlaeche<HTMLSelectElement>("klara-erinnerung-zone-wahl"), BERLIN);
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-titel") as HTMLInputElement,
      "Wochenbericht Halle 2",
    );
    await waehle(inFlaeche<HTMLSelectElement>("klara-erinnerung-art"), "serie");
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-datum") as HTMLInputElement,
      morgenInBerlin(),
    );
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-uhrzeit") as HTMLInputElement,
      "09:00",
    );
    await waehle(inFlaeche<HTMLSelectElement>("klara-erinnerung-aktion"), "routine_bericht");
    await bis(() => Boolean(inFlaeche("klara-erinnerung-routine-abschnitte")), 120);
    await klick(inFlaeche("klara-erinnerung-routine-abschnitt-neue_notizen"));
    await bis(
      () => inFlaeche<HTMLButtonElement>("klara-erinnerung-speichern")?.disabled === false,
      160,
    );
    await klick(inFlaeche("klara-erinnerung-speichern"));
    await bis(() => alle(flaeche() as HTMLElement, "klara-erinnerung-eintrag").length === 1, 160);

    const r = await a.app.inject({ method: "GET", url: URL_ERINNERUNGEN, headers: ich.kopf });
    const [gespeichert] = (
      r.json() as {
        erinnerungen: (ServerErinnerung & {
          id: string;
          fassung: number;
          aktion: string;
          routine: { abschnitte: string[]; fassung: number };
          laeufe: unknown[];
        })[];
      }
    ).erinnerungen;
    expect(gespeichert).toMatchObject({
      aktion: "routine_bericht",
      routine: {
        fassung: 1,
        abschnitte: ["offene_aufgaben", "erledigte_aufgaben", "neue_notizen"],
      },
      laeufe: [],
    });

    // Definition sichtbar: Quellen, Ziel, erlaubte Wirkung, Modus.
    await klick(inFlaeche("klara-erinnerung-oeffnen"));
    await bis(() => Boolean(inFlaeche("klara-erinnerung-routine")), 120);
    expect(inFlaeche("klara-erinnerung-routine-wirkung")?.textContent).toContain("kein Versand");

    // Änderung in Worten: erst prüfen, dann übernehmen.
    await tippe(
      inFlaeche<HTMLInputElement>("klara-erinnerung-routine-text") as HTMLInputElement,
      "künftig dienstags",
    );
    await klick(inFlaeche("klara-erinnerung-routine-deuten"));
    await bis(() => Boolean(inFlaeche("klara-erinnerung-routine-deutung")), 160);
    expect(inFlaeche("klara-erinnerung-routine-deutung")?.dataset.art).toBe("wochentag");
    await klick(inFlaeche("klara-erinnerung-routine-uebernehmen"));
    // Nach dem Übernehmen verschwindet die Deutung; der Server führt den neuen Wochentag.
    await bis(() => !inFlaeche("klara-erinnerung-routine-deutung"), 160);
    const [nach] = await serverErinnerungen(a, ich);
    expect(
      (nach?.zeitplan as { wiederholung?: { wochentage?: number[] } } | undefined)?.wiederholung
        ?.wochentage,
    ).toEqual([2]);
  });
});

describe("U3 · P07 — Einrichtungsassistent mit Zauberhut: freiwillig, erneut aufrufbar", () => {
  it("Schließen speichert nichts; Übernehmen speichert Zone; erneut geöffnet zeigt die Vorgabe", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/aufgaben");
    const hut = () => inFlaeche<HTMLButtonElement>("klara-erinnerung-assistent");
    await bis(() => Boolean(hut()), 120);
    expect(hut()?.textContent).toContain("🎩");

    // Freiwillig: öffnen und schließen speichert nichts.
    await klick(hut());
    await bis(() => Boolean(inFlaeche("klara-erinnerung-assistent-dialog")), 120);
    expect(inFlaeche("klara-erinnerung-assistent-dialog")?.getAttribute("dir")).toBe("ltr");
    await waehle(
      inFlaeche<HTMLSelectElement>("klara-erinnerung-assistent-zeitzone"),
      "America/New_York",
    );
    await klick(inFlaeche("klara-erinnerung-assistent-schliessen"));
    expect(inFlaeche("klara-erinnerung-assistent-dialog")).toBeNull();
    expect(await serverEinstellungen(a, ich)).toMatchObject({ zeitzone: null, fassung: 0 });

    // Übernehmen: Zone und Regeln werden Vorgabe.
    await klick(hut());
    await bis(() => Boolean(inFlaeche("klara-erinnerung-assistent-dialog")), 120);
    await waehle(inFlaeche<HTMLSelectElement>("klara-erinnerung-assistent-zeitzone"), "Asia/Tokyo");
    await klick(inFlaeche("klara-erinnerung-assistent-weiter"));
    await bis(() => Boolean(inFlaeche("klara-erinnerung-assistent-regeln")), 120);
    await waehle(inFlaeche<HTMLSelectElement>("klara-erinnerung-assistent-verpasst"), "nur_melden");
    await klick(inFlaeche("klara-erinnerung-assistent-uebernehmen"));
    await bis(() => !inFlaeche("klara-erinnerung-assistent-dialog"), 160);
    const gespeichert = await serverEinstellungen(a, ich);
    expect(gespeichert).toMatchObject({ zeitzone: "Asia/Tokyo", fassung: 1 });
    expect(gespeichert.eingerichtetAm).not.toBeNull();

    // Erneut aufrufbar — nach Neuladen, mit der gespeicherten Vorgabe.
    abbauen();
    vergiss();
    await montiere("/aufgaben");
    await bis(() => Boolean(hut()?.textContent?.includes("Einstellungen ändern")), 160);
    await klick(hut());
    await bis(() => Boolean(inFlaeche("klara-erinnerung-assistent-dialog")), 120);
    expect(inFlaeche<HTMLSelectElement>("klara-erinnerung-assistent-zeitzone")?.value).toBe(
      "Asia/Tokyo",
    );
    await klick(inFlaeche("klara-erinnerung-assistent-schliessen"));

    // Ein neuer Entwurf beginnt mit der Vorgabe.
    await klick(inFlaeche("klara-erinnerung-neu"));
    await bis(() => Boolean(inFlaeche("klara-erinnerung-entwurf")));
    expect(inFlaeche<HTMLSelectElement>("klara-erinnerung-zone-wahl")?.value).toBe("Asia/Tokyo");
    expect(inFlaeche("klara-erinnerung-kalenderfelder")?.getAttribute("dir")).toBe("ltr");
  });
});
