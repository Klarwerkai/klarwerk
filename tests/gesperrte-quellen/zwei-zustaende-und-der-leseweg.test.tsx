// @vitest-environment jsdom
// ================================================================================================
// JOB 3109 · UX-09 — GEFUNDEN, ABER GESPERRT: DER LESEBERECHTIGTE KOMMT ZUM BERICHT.
// ================================================================================================
//
// Pedis Lage: „Gefunden — aber diese Tore sind zu:" nennt Dokumenttitel, und dort endet der Weg.
// Wer den Bericht lesen will, muss ihn ueber die Bibliothekssuche noch einmal suchen — obwohl er
// ihn ohnehin oeffnen darf. Denn die Liste entsteht hinter ZWEI Sperren des Servers:
//   `dropConfidential(prefilteredRaw).filter(verschlossenSicht)` (services/ask/src/service.ts:829-833)
//   `verschlossenSicht = darfSehen(user, ko)`                    (services/app/src/sichtbarkeit.ts:108-110)
// `darfSehen` beantwortet ausweislich seines eigenen Kopfkommentars „darf dieser Mensch dieses
// OBJEKT OEFFNEN" und bewacht damit auch den Leseweg des einzelnen Objekts. Der Leselink legt also
// nichts offen — er spart einen Umweg.
//
// GEMESSEN WIRD AN DER VOLLEN KETTE, nicht an einem Renderer mit eingespeistem Payload (Bens
// Auflage zu JOB 2626 D2, deren Vorrichtung diese Datei uebernimmt):
//   echte App (`buildApp`, echte Dienste, echter Bestand aus `services.ko`)
//     → echte Anmeldung (Bearer der echten Sitzung an der Transportbruecke)
//     → die ECHTE Ask-Seite, gemountet, tippt die Frage und sendet ab
//     → der ECHTE Client (`endpoints.ask.ask` → `api.post` → `fetch`) ruft POST /api/ask
//     → die ECHTE Route entscheidet (mit oder ohne Betrachter) und antwortet
//     → die Flaeche rendert, was sie bekam.
// Ersetzt ist NUR die Browserschale um `fetch` (`fetch → app.inject`) und die
// Modell-VERFUEGBARKEITSANZEIGE (`reasoner.publicStatus`) — kein Endpunkt gemockt, kein
// `verschlossen`-Payload eingespeist.
//
// DIE FAELLE:
//   A1 · Zustand 1, Antwort mit Quellenlink — der MASSSTAB, an dem A2 gemessen wird. Heute gruen.
//   A2 · Zustand 2, Wissensluecke mit Sperrquelle: der Titel ist ein `<a>` auf `/wissen/<id>`.
//   A3 · Der Leselink fuehrt zum RICHTIGEN Dokument (zwei Eintraege, zwei verschiedene Kennungen).
//   A4 · Der Link ist beschriftet: sein zugaenglicher Name traegt Titel UND das Wort „lesen".
//   A5 · Der Sperrgrund haengt nicht mehr allein am `title=` — er steht im zugaenglichen Namen.
//   A6 · Der Trennungssatz steht GENAU EINMAL je Liste, auch bei zwei Eintraegen.
//   A7 · WAECHTER: ohne Sitzung weist die Route ab — keine Torlage, kein Leselink, kein Absturz.
//   A8 · WAECHTER: ein vertrauliches Dokument steht gar nicht in der Liste — also kein Link darauf.
//   A9 · Leere Liste: kein Trennungssatz, kein Link, unveraenderter Lueckenkasten.
import { afterEach, describe, expect, it } from "vitest";

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
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

type Services = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

// Zwei gesperrte Dokumente, damit A3 „das RICHTIGE Dokument" ueberhaupt messen kann: bei nur einem
// Eintrag waere jede Kennung im `href` zufaellig richtig.
const TITEL_A = "Turbinenwartung Kesselhaus";
const TITEL_B = "Turbinenwartung Rohrleitungsnetz";
const TITEL_ZU = "Turbinenwartung Sperrbezirk";
const SATZ_A = "Zustaendigkeit liegt beim Schichtleiter.";
const SATZ_B = "Die Abnahme erfolgt durch den Anlagenverantwortlichen.";
const SATZ_ZU = "Der Zutritt wird einzeln erteilt.";
// Genau EIN gemeinsames Token mit den Titeln: Vorauswahl ja, Antwort nein (der Pedi-Fall).
const FRAGE =
  "Welche Schutzausruestung ist bei der Turbinenwartung im Druckbehaelter vorgeschrieben?";

// ---- Die Transportbruecke: der echte Client spricht mit der echten App -------------------------
const bruecke = {
  app: null as unknown as App,
  token: "",
  requests: [] as { method: string; url: string; status: number; body: string }[],
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: {
      method?: string;
      body?: string;
      headers?: ConstructorParameters<typeof Headers>[0];
    } = {},
  ) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: (init.method ?? "GET") as "GET",
      url: String(input),
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    bruecke.requests.push({
      method: init.method ?? "GET",
      url: String(input),
      status: res.statusCode,
      body: res.body,
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<{ services: Services; autorId: string }> {
  const services = buildServices();
  // Ersetzt wird NUR die Modell-VERFUEGBARKEITSANZEIGE: ohne aktives Modell graut die Ask-Seite den
  // Fragen-Knopf hart aus (AI-STATE). Die Frage selbst geht durch den echten Ask-Dienst, der hier
  // deterministisch antwortet (KLARWERK_SKIP_KEYCHAIN) — kein Modell, kein Netz.
  (services.reasoner as unknown as { publicStatus: () => unknown }).publicStatus = () => ({
    active: true,
    mode: "cloud",
    reachable: "active",
    tasks: { answer: true },
  });
  bruecke.app = buildApp(services);
  bruecke.token = "";
  bruecke.requests = [];
  brueckeAufbauen();
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3109.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3109.test", password: "geheim12345" },
  });
  bruecke.token = (login.json() as { token: string }).token;
  const me = await bruecke.app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return { services, autorId: (me.json() as { id: string }).id };
}

/** Ein Dokument im echten Bestand — Tore nach Bedarf offen oder zu. */
async function dokument(
  services: Services,
  autorId: string,
  titel: string,
  satz: string,
  tore: { validiert?: boolean; stufe?: "intern" | "vertraulich"; volltext?: boolean } = {},
): Promise<string> {
  const ko = await services.ko.create({
    title: titel,
    statement: satz,
    type: "best_practice",
    category: "Wartung",
    author: autorId,
    ...(tore.volltext
      ? { bodyHtml: "<p>Der Pruefplan des Kesselhauses wird jaehrlich fortgeschrieben.</p>" }
      : {}),
  } as never);
  const id = (ko as { id: string }).id;
  if (tore.stufe) {
    await services.ko.setConfidentiality(id, tore.stufe, autorId);
  }
  if (tore.validiert) {
    await services.validation.adminValidate(id, autorId);
  }
  return id;
}

// ---- Die echte Ask-Seite -----------------------------------------------------------------------
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function askMounten(): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    (root as ReturnType<typeof createRoot>).render(
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
                createElement(MemoryRouter, { initialEntries: ["/fragen"] }, createElement(Ask)),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return container;
}

async function warteAufZustand(zustand: () => boolean, obergrenzeMs = 10_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    await act(flush);
    if (zustand()) return;
    if (Date.now() - start > obergrenzeMs) {
      const anfragen = bruecke.requests
        .map((r) => `${r.method} ${r.url} → ${r.status}`)
        .join(" | ");
      throw new Error(
        `Zustand nicht innerhalb von ${obergrenzeMs} ms erreicht. Anfragen: ${anfragen || "keine"}`,
      );
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Die Frage tippen und absenden — der Weg, den auch Pedi geht. */
async function fragen(c: HTMLDivElement, frage: string): Promise<void> {
  await warteAufZustand(() => c.querySelector("form input") !== null);
  const feld = c.querySelector("form input") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(
      feld,
      frage,
    );
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  const vorher = bruecke.requests.filter((r) => r.url === "/api/ask").length;
  await act(async () => {
    (c.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
  await warteAufZustand(() => bruecke.requests.filter((r) => r.url === "/api/ask").length > vorher);
  await act(flush);
  await act(flush);
}

const torlage = (c: HTMLElement): HTMLElement | null =>
  c.querySelector<HTMLElement>('[data-testid="ask-verschlossen"]');

function leselinks(c: HTMLElement): HTMLAnchorElement[] {
  const waehler = '[data-testid="ask-verschlossen-link"]';
  return [...c.querySelectorAll<HTMLAnchorElement>(waehler)];
}

const letzteAskAntwort = (): { status: number; body: Record<string, unknown> } => {
  const r = bruecke.requests.filter((x) => x.url === "/api/ask").at(-1);
  if (!r) throw new Error("kein /api/ask-Request beobachtet");
  return { status: r.status, body: r.body ? (JSON.parse(r.body) as Record<string, unknown>) : {} };
};

// ================================================================================================
// DER ZUGAENGLICHE NAME — und warum er hier nicht einfach `textContent` ist.
// ================================================================================================
// Ein `title=`-Attribut erscheint nur beim Verweilen mit dem Zeiger; ueber die Tastatur und fuer ein
// Vorleseprogramm ist es nicht verlaesslich erreichbar. Genau das ist die Luecke, die UX-09
// schliesst — `title` zaehlt hier deshalb bewusst NICHT als Traeger des Sperrgrunds.
// Und ein `aria-label` an einem NACKTEN `<span>` (Rolle `generic`) wird von Vorleseprogrammen
// ignoriert; es waere ein Name nur auf dem Papier. `nimmtNamenAn` prueft deshalb mit, dass das
// Element ueberhaupt eine Rolle traegt, die einen Namen annimmt.
function zugaenglicherName(el: Element): string {
  const label = el.getAttribute("aria-label");
  if (label !== null && label.trim().length > 0) {
    return label.trim();
  }
  return (el.textContent ?? "").trim();
}

function nimmtNamenAn(el: Element): boolean {
  const rolle = el.getAttribute("role");
  if (rolle !== null) {
    return !["generic", "presentation", "none"].includes(rolle);
  }
  return (el.tagName === "A" && el.hasAttribute("href")) || el.tagName === "BUTTON";
}

/** Der Eintrag (`<li>`) zu genau diesem Titel — A3 misst je Zeile, nicht ueber die ganze Liste. */
function eintragMitTitel(c: HTMLElement, titel: string): HTMLElement {
  const waehler = '[data-testid="ask-verschlossen-eintrag"]';
  const alle = [...c.querySelectorAll<HTMLElement>(waehler)];
  const treffer = alle.filter((li) => (li.textContent ?? "").includes(titel));
  expect(treffer, `kein Torlage-Eintrag mit dem Titel ${titel}`).toHaveLength(1);
  return treffer[0] as HTMLElement;
}

afterEach(() => {
  if (root) {
    act(() => (root as ReturnType<typeof createRoot>).unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

describe("JOB 3109 UX-09 · von der echten Route bis zum Leseweg der gesperrten Quelle", () => {
  it("A1 · MASSSTAB (heute gruen): eine Antwort traegt ihre Quelle als Link auf /wissen/<id>", async () => {
    const { services, autorId } = await serverStarten();
    const id = await dokument(services, autorId, TITEL_A, SATZ_A, {
      validiert: true,
      stufe: "intern",
      volltext: true,
    });
    const c = await askMounten();
    await fragen(c, `${TITEL_A} Zustaendigkeit`);

    const antwort = letzteAskAntwort();
    expect(antwort.status).toBe(200);
    expect(
      (antwort.body.result as { answered: boolean }).answered,
      "der Prueffall traegt nur als Antwort",
    ).toBe(true);
    expect(c.textContent ?? "").toContain(SATZ_A);

    const chips = [...c.querySelectorAll<HTMLElement>('[data-testid="ask-quellen-chip"]')];
    expect(chips.length, "die Antwort zeigt keine Quelle").toBeGreaterThan(0);
    const chip = chips[0] as HTMLElement;
    expect(chip.tagName, "der Quellen-Chip ist kein Link").toBe("A");
    expect(chip.getAttribute("href")).toBe(`/wissen/${id}`);
    await bruecke.app.close();
  });

  it("A2 · die Wissensluecke nennt die gesperrte Quelle — und ihr Titel ist ein Leselink", async () => {
    const { services, autorId } = await serverStarten();
    const idA = await dokument(services, autorId, TITEL_A, SATZ_A);
    const c = await askMounten();
    await fragen(c, FRAGE);

    // Der reale Response, den die Flaeche bekam — beobachtet an der Bruecke, nicht eingespeist.
    const antwort = letzteAskAntwort();
    expect(antwort.status).toBe(200);
    expect(
      (antwort.body.result as { answered: boolean }).answered,
      "der Prueffall traegt nur als Nicht-Antwort",
    ).toBe(false);
    expect(
      antwort.body.verschlossen,
      "die Route hat die Torlage nicht geliefert — der Betrachter kam nicht bis zum Dienst",
    ).toBeDefined();

    expect(c.textContent ?? "").toContain(i18n.t("ask.noBasisTitle"));
    const lage = torlage(c);
    expect(lage, "die Torlage fehlt in der Antwortflaeche").not.toBeNull();
    expect(lage?.textContent ?? "").toContain(TITEL_A);

    const links = leselinks(c);
    expect(links, "der Titel ist keine Sackgasse mehr — er wird Leselink").toHaveLength(1);
    const link = links[0] as HTMLAnchorElement;
    expect(link.tagName, "der Titel ist kein Link").toBe("A");
    expect(link.getAttribute("href")).toBe(`/wissen/${idA}`);
    expect(link.textContent, "sichtbar bleibt genau der Titel").toBe(TITEL_A);
    await bruecke.app.close();
  });

  it("A3 · der Leselink fuehrt zum RICHTIGEN Dokument: zwei Zeilen, zwei Kennungen", async () => {
    const { services, autorId } = await serverStarten();
    const idA = await dokument(services, autorId, TITEL_A, SATZ_A);
    const idB = await dokument(services, autorId, TITEL_B, SATZ_B);
    expect(idA, "die Kalibrierung braucht zwei Kennungen").not.toBe(idB);
    const c = await askMounten();
    await fragen(c, FRAGE);

    expect((letzteAskAntwort().body.result as { answered: boolean }).answered).toBe(false);
    const eintraege = c.querySelectorAll('[data-testid="ask-verschlossen-eintrag"]');
    expect(eintraege, "beide gesperrten Dokumente gehoeren in die Liste").toHaveLength(2);

    const hrefVon = (titel: string): string | null => {
      const li = eintragMitTitel(c, titel);
      const waehler = '[data-testid="ask-verschlossen-link"]';
      return li.querySelector<HTMLAnchorElement>(waehler)?.getAttribute("href") ?? null;
    };
    expect(hrefVon(TITEL_A), "Zeile A zeigt woandershin").toBe(`/wissen/${idA}`);
    expect(hrefVon(TITEL_B), "Zeile B zeigt woandershin").toBe(`/wissen/${idB}`);
    await bruecke.app.close();
  });

  it("A4 · der Link ist beschriftet: sein zugaenglicher Name traegt Titel und Leseabsicht", async () => {
    const { services, autorId } = await serverStarten();
    await dokument(services, autorId, TITEL_A, SATZ_A);
    const c = await askMounten();
    await fragen(c, FRAGE);

    const gefunden = leselinks(c)[0];
    expect(gefunden, "ohne Leselink gibt es keinen Namen zu pruefen").toBeDefined();
    const el = gefunden as HTMLAnchorElement;
    expect(nimmtNamenAn(el), "das Element nimmt gar keinen Namen an").toBe(true);
    const name = zugaenglicherName(el);
    expect(name, "der Name nennt das Dokument nicht").toContain(TITEL_A);
    expect(name, "der Name ist der nackte Titel — wohin er fuehrt, bleibt offen").not.toBe(TITEL_A);
    expect(name.toLowerCase(), "der Name sagt nicht, dass man hier LIEST").toContain("lesen");
    expect(name).toBe(i18n.t("ask.verschlossen.lesen", { titel: TITEL_A }));
    await bruecke.app.close();
  });

  it("A5 · der Sperrgrund haengt nicht mehr allein am `title=` — er steht im zugaenglichen Namen", async () => {
    const { services, autorId } = await serverStarten();
    await dokument(services, autorId, TITEL_A, SATZ_A);
    const c = await askMounten();
    await fragen(c, FRAGE);

    const lage = torlage(c);
    expect(lage, "ohne Torlage gibt es keine Plakette").not.toBeNull();
    const plaketten = [...(lage as HTMLElement).querySelectorAll<HTMLElement>("[title]")];
    const kurz = i18n.t("ask.verschlossen.freigabe");
    const satz = i18n.t("ask.verschlossen.freigabeHint");
    const gefunden = plaketten.find((p) => (p.textContent ?? "").trim() === kurz);
    expect(gefunden, "die Plakette zum fehlenden Freigabe-Tor fehlt").toBeDefined();
    const pille = gefunden as HTMLElement;
    // Kalibrierung: der Maus-Hinweis ist da — er ist nur nicht mehr der EINZIGE Traeger.
    expect(pille.title, "der Maus-Hinweis wurde entfernt").toBe(satz);
    expect(nimmtNamenAn(pille), "ein Name nur auf dem Papier").toBe(true);
    expect(zugaenglicherName(pille), "der Grund ist ohne Maus nicht lesbar").toContain(satz);
    // Und der sichtbare Kurztext bleibt der Wortlaut von Station 3 (JOB 2623).
    expect(lage?.textContent ?? "", "der sichtbare Kurztext ist weg").toContain(kurz);
    await bruecke.app.close();
  });

  it("A6 · der Trennungssatz steht GENAU EINMAL je Liste — auch bei zwei Eintraegen", async () => {
    const { services, autorId } = await serverStarten();
    await dokument(services, autorId, TITEL_A, SATZ_A);
    await dokument(services, autorId, TITEL_B, SATZ_B);
    const c = await askMounten();
    await fragen(c, FRAGE);

    const eintraege = c.querySelectorAll('[data-testid="ask-verschlossen-eintrag"]');
    expect(eintraege, "der Fall traegt nur mit zwei Eintraegen").toHaveLength(2);
    const saetze = c.querySelectorAll('[data-testid="ask-verschlossen-trennung"]');
    expect(saetze, "der Trennungssatz steht je Eintrag statt je Liste").toHaveLength(1);
    const satz = saetze[0] as HTMLElement;
    expect(satz.textContent ?? "").toBe(i18n.t("ask.verschlossen.trennung"));
    expect(satz.closest('[data-testid="ask-verschlossen"]')).not.toBeNull();
    await bruecke.app.close();
  });

  it("A7 · WAECHTER: ohne Sitzung weist die Route ab — keine Torlage, kein Leselink", async () => {
    const { services, autorId } = await serverStarten();
    await dokument(services, autorId, TITEL_A, SATZ_A);
    bruecke.token = "";
    const c = await askMounten();
    await fragen(c, FRAGE);

    expect(letzteAskAntwort().status).toBe(401);
    expect(torlage(c), "eine Torlage ohne Betrachter — erfunden").toBeNull();
    expect(leselinks(c), "ein Leselink ohne Betrachter").toHaveLength(0);
    expect(c.querySelector('[data-testid="ask-verschlossen-trennung"]')).toBeNull();
    expect(c.textContent ?? "").not.toContain(i18n.t("ask.verschlossen.freigabe"));
    // Und der Dienst direkt, wie ihn ein Weg OHNE Betrachterfilter ruft: das Feld fehlt ganz.
    const ohne = (await services.ask.ask(FRAGE, autorId, "de")) as unknown as Record<
      string,
      unknown
    >;
    expect((ohne.result as { answered: boolean }).answered).toBe(false);
    expect("verschlossen" in ohne).toBe(false);
    await bruecke.app.close();
  });

  it("A8 · WAECHTER: ein vertrauliches Dokument steht nicht in der Liste — also kein Link", async () => {
    const { services, autorId } = await serverStarten();
    const idOffen = await dokument(services, autorId, TITEL_A, SATZ_A);
    const idZu = await dokument(services, autorId, TITEL_ZU, SATZ_ZU, {
      stufe: "vertraulich",
    });
    // Kalibrierung: die Stufe steht wirklich am Objekt — gemessen, nicht angenommen.
    const ko = (await services.ko.get(idZu)) as { confidentiality?: string } | undefined;
    expect(ko?.confidentiality, "die Kalibrierung greift nicht").toBe("vertraulich");

    const c = await askMounten();
    await fragen(c, FRAGE);
    expect((letzteAskAntwort().body.result as { answered: boolean }).answered).toBe(false);

    const hrefs = leselinks(c).map((a) => a.getAttribute("href"));
    const hrefOffen = `/wissen/${idOffen}`;
    const hrefZu = `/wissen/${idZu}`;
    expect(hrefs, "das offene Dokument fehlt — der Fall misst ins Leere").toContain(hrefOffen);
    expect(hrefs, "ein Leselink auf Vertrauliches").not.toContain(hrefZu);
    expect(c.textContent ?? "", "vertraulicher Titel sichtbar").not.toContain(TITEL_ZU);
    await bruecke.app.close();
  });

  it("A9 · leere Liste: kein Trennungssatz, kein Leselink — der Lueckenkasten bleibt", async () => {
    // Leerer Bestand: die Vorauswahl kann gar keinen Kandidaten liefern, die Torlage ist also
    // ERFOLGREICH LEER — kein „vielleicht hat der Vorfilter doch etwas gefunden". Genau dieser
    // Zustand steht in §9 des Auftrags: Antwort kam, `verschlossen` ist `[]`.
    await serverStarten();
    const c = await askMounten();
    await fragen(c, FRAGE);

    const antwort = letzteAskAntwort();
    expect(antwort.status).toBe(200);
    expect((antwort.body.result as { answered: boolean }).answered).toBe(false);
    expect(antwort.body.verschlossen, "der Fall traegt nur mit LEERER Liste").toEqual([]);

    expect(c.textContent ?? "").toContain(i18n.t("ask.noBasisTitle"));
    expect(torlage(c), "eine Torlage ohne Grundlage — erfunden").toBeNull();
    expect(leselinks(c)).toHaveLength(0);
    expect(c.querySelector('[data-testid="ask-verschlossen-trennung"]')).toBeNull();
    expect(c.querySelector('[data-testid="ask-gap"]')).not.toBeNull();
    await bruecke.app.close();
  });
});
