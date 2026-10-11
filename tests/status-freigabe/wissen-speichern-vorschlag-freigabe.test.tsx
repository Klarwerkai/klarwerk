// @vitest-environment jsdom
// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · GESPEICHERT, EINGEREICHT, FREIGEGEBEN — DREI VERSCHIEDENE SÄTZE.
// ================================================================================================
//
// Originalkriterien dieses Prüfstands:
//   K2 · Änderungsvorschlag, direkt gespeicherte Änderung und tatsächlich freigegebene Fassung sind
//        klar getrennt. („Eine gespeicherte Änderung an einem offenen Artikel darf keinen
//        freigegebenen Stand behaupten.")
//   K5 · (Teil) Klaras Zeige-Modus liest den Status des gezeigten Objekts über `objektstatusAus`
//        aus GENAU dem gezeichneten Statusblock — hier am echten Wissenseintrag gemessen.
//
// BAUFORM wörtlich aus `tests/bibliothek-bedingtes-speichern/direktweg-bedingtes-speichern.test.tsx`:
// NICHTS ist gemockt ausser dem Transport. `globalThis.fetch` reicht an `app.inject` der ECHTEN
// Fastify-Anwendung weiter, darüber steht die ECHTE Lesefläche `BibliothekLesen` in jsdom. Was die
// Fläche sagt, wird gegen den danach ERNEUT GELESENEN Stand des Servers gehalten.
//
// BENANNTE PRÜFLÜCKE: In-Memory-Ablagen (`buildServices()`), kein echter Browser, kein Postgres.
//
// GEGENPROBEN (benannt, nicht gefahren):
//   · In `speicherFolgeSatz` den Zweig `validiert` für jeden Status nehmen → G1/G2 werden rot
//     („bleibt freigegeben" an einem offenen Eintrag).
//   · In `BibliothekLesen` `merkeStand` nicht aufrufen → G1 wird rot (kein Folgesatz).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BibliothekLesen } from "../../apps/web/src/components/bibliothek/BibliothekLesen";
import i18n from "../../apps/web/src/i18n";
import {
  einreichSchluessel,
  objektstatusAus,
  speicherFolgeSatz,
  vorschlagFolgeSatz,
} from "../../apps/web/src/lib/statusFreigabe";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let app: App;
/** Das Konto, in dessen Namen die OBERFLÄCHE spricht. */
let flaechenToken = "";
let adminToken = "";
let zweiterAdminToken = "";
let experteToken = "";

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    if (flaechenToken) {
      kopf.authorization = `Bearer ${flaechenToken}`;
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function token(email: string, password = "secret123"): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return token(email);
}

/** Ein offener Wissenseintrag über den echten Weg (fiktive Testdaten). */
async function objektAnlegen(): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

/** Ein ZWEITES Konto gibt den Eintrag frei — über die echte Route. */
async function freigeben(id: string): Promise<void> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${zweiterAdminToken}` },
    payload: { action: "admin-validate" },
  });
  expect(antwort.statusCode).toBe(200);
}

interface Serverstand {
  version: number;
  status: string;
  statement: string;
  proposals?: { status: string }[];
}

/** Der gespeicherte Stand, roh von der Route gelesen — das Beweismittel. */
async function stand(id: string): Promise<Serverstand> {
  const antwort = await app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Serverstand;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function abbauen(): Promise<void> {
  if (root) {
    const r = root;
    await act(async () => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
}

async function mount(koId: string, bearbeiten: boolean): Promise<void> {
  await abbauen();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
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
                  { initialEntries: [bearbeiten ? "/bibliothek?edit=1" : "/bibliothek"] },
                  createElement(BibliothekLesen, {
                    koId,
                    suchtext: "",
                    treffer: [],
                    onGeloescht: () => {},
                    hinweisSchonGesagt: true,
                    lesevarianteSchonGesagt: true,
                  }),
                  createElement(ToastViewport, null),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

function suche(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();
const seitentext = (): string => text(document.body);
const satz = (schluessel: string, werte?: Record<string, unknown>): string =>
  String(i18n.t(schluessel, werte ?? {}))
    .replace(/\s+/g, " ")
    .trim();

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

function knopfMitText(beschriftung: string): HTMLButtonElement {
  const treffer = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === beschriftung,
  );
  if (!treffer) {
    throw new Error(`Der Knopf „${beschriftung}" steht nicht auf der Fläche`);
  }
  return treffer;
}

function aussagefeld(): HTMLTextAreaElement {
  const beschriftung = i18n.t("capture.fStatement");
  const feld = [...document.body.querySelectorAll("label")]
    .find((l) => l.querySelector("span")?.textContent?.trim() === beschriftung)
    ?.querySelector("textarea");
  if (!feld) {
    throw new Error(`Das Feld „${beschriftung}" steht nicht auf der Fläche`);
  }
  return feld;
}

async function tippen(feld: HTMLTextAreaElement, wert: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

const MEIN_TEXT = "Bei Überdruck Ventil X ZUERST entlasten, dann schließen.";

beforeEach(async () => {
  app = buildApp(buildServices());
  transportEinhaengen();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pia Beispiel", email: "pia@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pia@klarwerk.test");
  zweiterAdminToken = await konto("admin", "admin2@klarwerk.test");
  experteToken = await konto("experte", "experte@klarwerk.test");
  flaechenToken = adminToken;
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await abbauen();
  qc?.clear();
});

// ================================================================================================
// A · DIE FOLGESÄTZE — rein, aus der Serverantwort
// ================================================================================================

describe("A · K2 — der Folgesatz liest die Antwort, er rechnet keine Freigabe aus", () => {
  it("offen → gespeichert, NICHT freigegeben; validiert → bleibt freigegeben; ohne Stand → nichts", () => {
    expect(speicherFolgeSatz({ status: "offen", version: 4 })).toEqual({
      schluessel: "statusfreigabe.speichern.nichtFreigegebenFassung",
      werte: { version: 4 },
    });
    expect(satz("statusfreigabe.speichern.nichtFreigegebenFassung", { version: 4 })).toContain(
      "nicht freigegeben",
    );
    expect(speicherFolgeSatz({ status: "validiert", version: 4 })?.schluessel).toBe(
      "statusfreigabe.speichern.freigegebenFassung",
    );
    // Jeder andere Status ist NICHT freigegeben — auch einer, den diese Fläche nicht kennt.
    expect(speicherFolgeSatz({ status: "in_review", version: null })?.schluessel).toBe(
      "statusfreigabe.speichern.nichtFreigegeben",
    );
    expect(speicherFolgeSatz(null)).toBeNull();
  });

  it("Vorschlag: übernommen-und-freigegeben nur mit `validiert` in der Antwort", () => {
    expect(vorschlagFolgeSatz("uebernehmen", { status: "validiert", version: 3 })).toEqual({
      schluessel: "statusfreigabe.vorschlag.uebernommenFreigegebenFassung",
      werte: { version: 3 },
    });
    expect(vorschlagFolgeSatz("uebernehmen", { status: "offen", version: 3 }).schluessel).toBe(
      "statusfreigabe.vorschlag.uebernommenOffen",
    );
    expect(vorschlagFolgeSatz("uebernehmen", null).schluessel).toBe(
      "statusfreigabe.vorschlag.uebernommenOffen",
    );
    expect(vorschlagFolgeSatz("ablehnen", { status: "validiert", version: 3 }).schluessel).toBe(
      "statusfreigabe.vorschlag.abgelehnt",
    );
  });
});

// ================================================================================================
// G · DIE ECHTE FLÄCHE — direkt gespeichert, eingereicht, freigegeben
// ================================================================================================

describe("G · K2 — an der echten Lesefläche gegen den nachgelesenen Serverstand", () => {
  it("G1 · offener Eintrag, direkt gespeichert: „gespeichert, nicht freigegeben“ — und so steht es am Server", async () => {
    const id = await objektAnlegen();
    await mount(id, true);
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(MEIN_TEXT);
    expect(jetzt.status).toBe("offen");
    expect(jetzt.version).toBe(2);

    const seite = seitentext();
    expect(seite).toContain(satz("ko.revise.saved"));
    expect(seite).toContain(
      satz("statusfreigabe.speichern.nichtFreigegebenFassung", { version: jetzt.version }),
    );
    const behauptet = satz("statusfreigabe.speichern.freigegebenFassung", { version: 2 });
    expect(seite).not.toContain(behauptet);
    expect(seite).not.toContain(satz("statusfreigabe.speichern.freigegeben"));
  });

  it("G2 · freigegebener Eintrag, vom Berechtigten direkt geändert: die frühere Freigabe wird nicht behauptet", async () => {
    const id = await objektAnlegen();
    await freigeben(id);
    expect((await stand(id)).status).toBe("validiert");

    await mount(id, true);
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    const jetzt = await stand(id);
    // Der Server setzt eine überarbeitete Fassung auf „offen" (`KoService.revise`) …
    expect(jetzt.status).toBe("offen");
    // … und die Fläche sagt genau das, nicht „freigegeben".
    expect(seitentext()).toContain(
      satz("statusfreigabe.speichern.nichtFreigegebenFassung", { version: jetzt.version }),
    );
    expect(seitentext()).not.toContain(
      satz("statusfreigabe.speichern.freigegebenFassung", { version: jetzt.version }),
    );
  });

  it("G3 · Änderungsvorschlag ≠ Freigabe: eingereicht bleibt der freigegebene Stand; erst die Übernahme gibt frei", async () => {
    const id = await objektAnlegen();
    await freigeben(id);
    const vorher = await stand(id);

    // Die Expertin darf einen freigegebenen Stand nicht direkt ersetzen — sie reicht ein.
    flaechenToken = experteToken;
    await mount(id, true);
    expect(suche("bib-einreichen-pflicht"), "der Einreichweg wird nicht angesagt").not.toBeNull();
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.propose.submit")));

    expect(seitentext()).toContain(satz("ko.propose.done"));
    // Kein Speicher- und kein Freigabesatz für einen eingereichten Vorschlag.
    expect(seitentext()).not.toContain(satz("ko.revise.saved"));
    const eingereicht = await stand(id);
    expect(eingereicht.status).toBe("validiert");
    expect(eingereicht.version).toBe(vorher.version);
    expect(eingereicht.statement).toBe(vorher.statement);
    expect((eingereicht.proposals ?? []).filter((p) => p.status === "offen")).toHaveLength(1);

    // Eine ANDERE berechtigte Person übernimmt — erst jetzt ist die neue Fassung freigegeben.
    flaechenToken = adminToken;
    await mount(id, false);
    const uebernehmen = suche("bib-vorschlag-uebernehmen");
    expect(uebernehmen, "der Übernahmeknopf steht nicht da").not.toBeNull();
    await klick(uebernehmen as HTMLElement);

    const freigegeben = await stand(id);
    expect(freigegeben.status).toBe("validiert");
    expect(freigegeben.version).toBe(vorher.version + 1);
    expect(freigegeben.statement).toBe(MEIN_TEXT);
    expect(seitentext()).toContain(
      satz("statusfreigabe.vorschlag.uebernommenFreigegebenFassung", {
        version: freigegeben.version,
      }),
    );
  });

  // Ben (nacharbeit-2): der freiwillige Prüfweg steht Freigabeberechtigten auch an OFFENEN
  // Einträgen offen. Dort darf die Einreichbestätigung keinen freigegebenen Stand behaupten.
  it("G4 · Vorschlag zu einem OFFENEN Eintrag: eingereicht, die bisherige Fassung bleibt offen — kein „freigegebener Stand“", async () => {
    const id = await objektAnlegen();
    const vorher = await stand(id);
    expect(vorher.status).toBe("offen");

    flaechenToken = adminToken;
    await mount(id, true);
    const haken = suche("bib-pruefweg-haken")?.querySelector("input");
    expect(haken, "der freiwillige Prüfweg wird nicht angeboten").toBeTruthy();
    await klick(haken as HTMLInputElement);
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.propose.submit")));

    const lage = suche("bib-einreichen-lage");
    expect(lage?.getAttribute("data-lage")).toBe("eingereicht");
    expect(text(lage)).toBe(satz("statusfreigabe.vorschlag.eingereichtOffen"));
    expect(seitentext()).not.toContain(satz("ko.propose.done"));
    expect(seitentext()).not.toContain(satz("ko.revise.saved"));

    // Am Server: nichts übernommen, nichts freigegeben, ein offener Vorschlag.
    const jetzt = await stand(id);
    expect(jetzt.status).toBe("offen");
    expect(jetzt.version).toBe(vorher.version);
    expect(jetzt.statement).toBe(vorher.statement);
    expect((jetzt.proposals ?? []).filter((p) => p.status === "offen")).toHaveLength(1);
  });
});

describe("A · K2 — die Einreichbestätigung folgt dem gemeldeten Status", () => {
  it("nur `validiert` trägt „freigegebener Stand“; offen/anderes nicht; ohne Status keine Aussage", () => {
    expect(einreichSchluessel("validiert")).toBe("ko.propose.done");
    expect(einreichSchluessel("offen")).toBe("statusfreigabe.vorschlag.eingereichtOffen");
    expect(einreichSchluessel("in_review")).toBe("statusfreigabe.vorschlag.eingereichtOffen");
    expect(einreichSchluessel(null)).toBe("statusfreigabe.vorschlag.eingereicht");
    const saetze = [
      "statusfreigabe.vorschlag.eingereichtOffen",
      "statusfreigabe.vorschlag.eingereicht",
    ];
    for (const s of saetze) {
      expect(satz(s)).not.toContain("freigegebenen Stand");
    }
    expect(satz("statusfreigabe.vorschlag.eingereichtOffen")).toContain("nicht freigegeben");
  });
});

// ================================================================================================
// K · K5 (Teil) — derselbe Status für Klaras Zeige-Modus
// ================================================================================================

describe("K · K5 — Klaras Statusweg liest den gezeichneten Block des Objekts", () => {
  it("ein beliebiges Element im Eintrag führt zum Text der Statuspille — wörtlich", async () => {
    const id = await objektAnlegen();
    await mount(id, false);
    const lesen = suche("bib-lesen");
    const pille = suche("bib-pille");
    expect(lesen).not.toBeNull();
    expect(pille?.getAttribute("data-objektstatus")).toBe("wissen");
    // Gezeigt wird z. B. auf die Meta-Zeile — nicht auf die Pille selbst.
    const gezeigt = suche("bib-meta");
    const status = objektstatusAus(gezeigt);
    expect(status).toEqual({ art: "wissen", text: text(pille) });
    expect(status?.text.length).toBeGreaterThan(0);

    // Nach der Freigabe zeigt die Fläche einen anderen Status — und Klara liest genau diesen.
    await freigeben(id);
    await mount(id, false);
    const neu = objektstatusAus(suche("bib-meta"));
    expect(neu?.text).toBe(text(suche("bib-pille")));
    expect(neu?.text).not.toBe(status?.text);
  });

  it("ausserhalb eines Objekts nennt Klara keinen Status", () => {
    const frei = document.createElement("p");
    document.body.appendChild(frei);
    expect(objektstatusAus(frei)).toBeNull();
    frei.remove();
  });
});
