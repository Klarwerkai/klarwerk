// @vitest-environment jsdom
// ================================================================================================
// JOB 4251 (WIKI-ZUSAMMENARBEIT) · K5/K6/K7 — WAS DER MENSCH SIEHT, WENN DIE EINORDNUNG KOLLIDIERT.
// ================================================================================================
//
// DIE LAGE. Der Speicherweg der Lesefläche ist EINE Mutation mit DREI nacheinander abgesetzten
// Schreibaufrufen (`BibliothekLesen.tsx`, `save`): `revise`, dann `tags`, dann — bei nicht leerer
// Kategorie — `category`. Bis zu diesem Auftrag liefen die beiden Folgeaufrufe UNBEDINGT: eine zehn
// Minuten alte Schlagwortabsicht ging mit 200 durch und ersetzte die jüngere Einordnung eines
// anderen Menschen, ohne dass irgendwo etwas aufschlug.
//
// WAS HIER ECHT IST UND WAS NICHT. Gebaut wie `tests/wiki-bearbeitung/…`: unter der ECHTEN
// Lesefläche in jsdom steht die ECHTE Fastify-Anwendung über `app.inject` — Adresse, Rumpf,
// Rechtegate, Dienst und Ablage sind Produktcode, und geprüft wird am ERNEUT GELESENEN Objekt.
// Ersetzt ist NUR der Transport, und dort nur so viel, wie die Fälle verlangen: ein `stoerer` darf
// EINZELNE Schreibaufrufe durch eine Fehlerantwort ersetzen (K5a, K6). Der fremde Schreiber ist
// KEIN Störer — er ist ein echtes zweites Konto an derselben Route.
//
// BENANNTE PRÜFLÜCKEN: In-Memory-Ablagen (`buildServices()`), kein echter Browser (jsdom rechnet
// kein Layout), kein PostgreSQL. Der Netzabbruch in K5a ist nachgestellt, nicht erlebt.
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
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let app: App;
let adminToken = "";
let zweiterAdminToken = "";
let flaechenToken = "";

/**
 * DAS AUFRUFPROTOKOLL. „Es ging etwas hinaus" und „auf der Fläche steht etwas" sind zwei
 * verschiedene Aussagen — und für diesen Auftrag kommt eine dritte dazu: MIT WELCHER BEDINGUNG es
 * hinausging. Genau das ist der Messpunkt von K5a (der Stempel aus der eigenen Antwort).
 */
type Schreibaufruf = {
  action: string;
  expectedVersion: number | null;
  stempel: number | null;
  hatStempel: boolean;
};
let protokoll: Schreibaufruf[] = [];

const nur = (action: string): Schreibaufruf[] => protokoll.filter((a) => a.action === action);
const zaehle = (action: string): number => nur(action).length;

type Stoerung = { status: number; error: string; message: string } | null;
/**
 * RUNDE 2: der Störer darf WARTEN, bevor er den Aufruf durchlässt. Das ist keine Aufweichung,
 * sondern die einzige Art, das Fenster ZWISCHEN zwei Aufrufen derselben Kette zu treffen — genau
 * dort schreibt in K10/K11 jemand Fremdes. Ein `null` heisst weiterhin „geh an die echte Route";
 * was in der Wartezeit passiert, passiert über die ECHTE Route mit einem ECHTEN zweiten Konto.
 */
let stoerer: ((aufruf: Schreibaufruf, nr: number) => Stoerung | Promise<Stoerung>) | null = null;
/**
 * RUNDE 4 (K14): eine GELUNGENE Antwort ohne `metadataRevision`. Das ist kein erfundener Fall,
 * sondern der Altbestand aus Lieferung 2: trägt die Projektion für diesen Eintrag keinen Stand
 * (`METADATA_REVISION_NONE`), lässt die Route das Feld weg. Der Aufruf ist durchgegangen, die
 * Quittung ist trotzdem UNBEKANNT — und danach darf nichts mehr unbedingt hinausgehen.
 *
 * Verfälscht wird AUSSCHLIESSLICH dieses eine Feld der Antwort; Status, Rechtegate, Dienst und
 * Ablage bleiben der echte Weg, und geprüft wird weiter am erneut gelesenen Objekt.
 */
let stempelWeg: ((aufruf: Schreibaufruf, nr: number) => boolean) | null = null;
let detailPfad = "";

/** Der Transport, und NUR er, ist ersetzt — `api/client.ts` baut alles Übrige weiterhin selbst. */
function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    /** Gesetzt, sobald dieser Aufruf ein protokollierter Schreibaufruf ist — für `stempelWeg`. */
    let geschriebenerAufruf: { aufruf: Schreibaufruf; nr: number } | null = null;
    if (methode === "PUT" && detailPfad !== "" && url.startsWith(detailPfad)) {
      const rumpf = JSON.parse(String(init?.body ?? "{}")) as {
        action?: unknown;
        expectedVersion?: unknown;
        expectedMetadataRevision?: unknown;
      };
      const aufruf: Schreibaufruf = {
        action: String(rumpf.action ?? ""),
        expectedVersion: typeof rumpf.expectedVersion === "number" ? rumpf.expectedVersion : null,
        stempel:
          typeof rumpf.expectedMetadataRevision === "number"
            ? rumpf.expectedMetadataRevision
            : null,
        // „Feld weggelassen" und „Feld mit unbrauchbarem Wert" sind zwei verschiedene Aussagen.
        hatStempel: rumpf.expectedMetadataRevision !== undefined,
      };
      const nr = zaehle(aufruf.action) + 1;
      protokoll.push(aufruf);
      geschriebenerAufruf = { aufruf, nr };
      const stoerung = stoerer ? await stoerer(aufruf, nr) : null;
      if (stoerung !== null) {
        const koerper = JSON.stringify({ error: stoerung.error, message: stoerung.message });
        return {
          status: stoerung.status,
          ok: false,
          statusText: String(stoerung.status),
          text: async () => koerper,
        };
      }
    }
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
    let koerper = antwort.body;
    if (
      geschriebenerAufruf !== null &&
      stempelWeg !== null &&
      antwort.statusCode === 200 &&
      stempelWeg(geschriebenerAufruf.aufruf, geschriebenerAufruf.nr)
    ) {
      const roh = JSON.parse(koerper) as Record<string, unknown>;
      koerper = JSON.stringify(
        Object.fromEntries(Object.entries(roh).filter(([name]) => name !== "metadataRevision")),
      );
    }
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => koerper,
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

async function objektAnlegen(kategorie = "Anlage 1"): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: kategorie,
      tags: ["ventil"],
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

type Stand = {
  version: number;
  statement: string;
  tags: string[];
  category: string;
  status: string;
  metadataRevision?: number;
};

/** Der gespeicherte Stand, roh von der Route gelesen — DAS Beweismittel dieser Datei. */
async function stand(id: string): Promise<Stand> {
  const antwort = await app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
}

/** Jemand anderes ordnet ein — über die ECHTE Route, mit einem ECHTEN zweiten Konto. */
async function fremdEinordnen(id: string, tags: string[]): Promise<void> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${zweiterAdminToken}` },
    payload: { action: "tags", tags },
  });
  expect(antwort.statusCode).toBe(200);
}

/**
 * Jemand anderes ändert NUR die KATEGORIE. Der Unterschied zu `fremdEinordnen` ist der ganze Punkt
 * von K11a: der Stempel klettert, die Schlagwörter dieses Menschen bleiben stehen — und genau dann
 * muss der Satz sie als gespeichert nennen, statt sie pauschal für verloren zu erklären.
 */
async function fremdeKategorie(id: string, category: string): Promise<void> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${zweiterAdminToken}` },
    payload: { action: "category", category },
  });
  expect(antwort.statusCode).toBe(200);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(koId: string): Promise<void> {
  detailPfad = `/api/kos/${koId}`;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
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
                  { initialEntries: ["/bibliothek?edit=1"] },
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

function el(testId: string): HTMLElement {
  const treffer = suche(testId);
  if (!treffer) {
    throw new Error(`„${testId}" steht nicht auf der Fläche`);
  }
  return treffer;
}

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

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

function feld<T extends HTMLElement>(beschriftung: string, tag: string): T {
  const gefunden = [...document.body.querySelectorAll("label")]
    .find((l) => l.querySelector("span")?.textContent?.trim() === beschriftung)
    ?.querySelector<T>(tag);
  if (!gefunden) {
    throw new Error(`Das Feld „${beschriftung}" steht nicht auf der Fläche`);
  }
  return gefunden;
}

const aussagefeld = (): HTMLTextAreaElement =>
  feld<HTMLTextAreaElement>(i18n.t("capture.fStatement"), "textarea");

async function tippen(ziel: HTMLTextAreaElement | HTMLInputElement, wert: string): Promise<void> {
  const prototyp =
    ziel instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(prototyp, "value")?.set;
  await act(async () => {
    setzer?.call(ziel, wert);
    ziel.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function schlagwortSetzen(wert: string): Promise<void> {
  const eingabe = feld<HTMLInputElement>(i18n.t("capture.fTags"), "input");
  await tippen(eingabe, wert);
  await act(async () => {
    eingabe.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();
  });
  await act(flush);
}

function formularOffen(): boolean {
  return [...document.body.querySelectorAll("label")].some(
    (l) => l.querySelector("span")?.textContent?.trim() === i18n.t("capture.fStatement"),
  );
}

/** Wie oft ein Satz auf der ganzen Fläche steht — „genau einmal" ist eine Zahl, keine Vermutung. */
function wieOft(satz: string): number {
  const ganz = text(document.body);
  if (satz.length === 0) {
    throw new Error("leerer Suchsatz");
  }
  let treffer = 0;
  let ab = 0;
  for (;;) {
    const bei = ganz.indexOf(satz, ab);
    if (bei === -1) {
      return treffer;
    }
    treffer++;
    ab = bei + satz.length;
  }
}

const MEIN_TEXT = "Bei Überdruck Ventil X ZUERST entlasten, dann schließen.";
const KATEGORIE_500 = {
  status: 500,
  error: "ERROR",
  message: "Ablage antwortet nicht.",
} as const;
/** Derselbe Abbruch am Schlagwortschritt — kein Konflikt, sondern ein Netzfehler (K12). */
const TAGS_500 = { status: 500, error: "ERROR", message: "Ablage antwortet nicht." } as const;

beforeEach(async () => {
  app = buildApp(buildServices());
  transportEinhaengen();
  protokoll = [];
  stoerer = null;
  stempelWeg = null;
  detailPfad = "";
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pedi@klarwerk.test");
  zweiterAdminToken = await konto("admin", "admin2@klarwerk.test");
  flaechenToken = adminToken;
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  stoerer = null;
  stempelWeg = null;
  await i18n.changeLanguage("de");
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("JOB 4251 · K5 · Teilabbruch und zweiter Griff an der Einordnung", () => {
  // ==============================================================================================
  // K5a · DER ZWEITE GRIFF SCHICKT DEN STEMPEL AUS DER EIGENEN ANTWORT.
  // ==============================================================================================
  //
  // Der Schlagwortaufruf ist durchgegangen und hat den Stempel weitergedreht; der Kategorieaufruf
  // ist abgebrochen. Griffe der Mensch jetzt erneut und die Fläche schickte den Stand, den sie beim
  // ÖFFNEN gesehen hat, liefe sie in einen Konflikt mit ihrem EIGENEN Schreibvorgang — ein Knopf,
  // der zuverlässig nichts tut. Und das nach dem Abbruch ergänzte Schlagwort ginge verloren
  // (derselbe Fall, den BEN1 in JOB 4163 am Textweg gemessen hat).
  it("K5a · nach einem Kategorieabbruch trägt der zweite Griff den eigenen Stand — und der Nachtrag geht nicht verloren", async () => {
    const id = await objektAnlegen();
    await mount(id);
    expect(formularOffen(), "das Bearbeiten-Formular ist nicht aufgegangen").toBe(true);

    stoerer = (a, nr) => (a.action === "category" && nr === 1 ? KATEGORIE_500 : null);
    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialCategory"));
    const ersterStempel = nur("tags")[0]?.stempel;
    expect(ersterStempel, "der erste Schlagwortaufruf ging OHNE Bedingung hinaus").toBe(1);
    expect(
      (await stand(id)).metadataRevision,
      "der eigene Aufruf hat den Stempel nicht bewegt",
    ).toBe(2);

    // Der Mensch ergänzt NOCH ein Schlagwort und drückt erneut.
    await schlagwortSetzen("nachtrag");
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // DER MESSPUNKT: der zweite Schlagwortaufruf trägt den Stand aus der EIGENEN Antwort (2), nicht
    // den beim Öffnen gesehenen (1).
    const zweiter = nur("tags")[1];
    expect(zweiter?.hatStempel, "der zweite Griff ging ganz ohne Bedingung hinaus").toBe(true);
    expect(
      zweiter?.stempel,
      "der zweite Griff schickte den Stand vom Öffnen und liefe gegen sich selbst",
    ).toBe(2);

    // Und es ist wirklich alles angekommen.
    const jetzt = await stand(id);
    expect(jetzt.tags, "der Nachtrag ist verlorengegangen").toContain("nachtrag");
    expect(jetzt.tags).toContain("wartung");
    expect(jetzt.category).toBe("Anlage 1");
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
    expect(formularOffen(), "das Formular steht nach dem Erfolg noch offen").toBe(false);
  });

  // ==============================================================================================
  // K5b · HAT INZWISCHEN JEMAND FREMDES EINGEORDNET, KOMMT 409 STATT EINES STILLEN ÜBERSCHREIBENS.
  // ==============================================================================================
  it("K5b · schreibt B nach dem Teilabbruch die Einordnung, fragt der zweite Griff — Bs Schlagwörter bleiben", async () => {
    const id = await objektAnlegen();
    await mount(id);

    stoerer = (a, nr) => (a.action === "category" && nr === 1 ? KATEGORIE_500 : null);
    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialCategory"));

    // JETZT ordnet jemand anderes ein — echtes zweites Konto, echte Route.
    stoerer = null;
    await fremdEinordnen(id, ["bernd", "ueberdruck"]);
    expect((await stand(id)).metadataRevision).toBe(3);

    // Der zweite Griff des Menschen.
    await schlagwortSetzen("nachtrag");
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
    // Abgewiesen wurde der SCHLAGWORTSCHRITT; die Kategorie war ohnehin noch offen. Der Satz nennt
    // beide — und nur sie (RUNDE 2, Korrekturpflicht 3).
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.staleEinordnungTagsCategory"));
    // DAS ERGEBNIS: Bs Schlagwörter stehen unverändert da.
    const jetzt = await stand(id);
    expect(jetzt.tags, "Bs Einordnung wurde still überschrieben").toEqual(["bernd", "ueberdruck"]);
    // Und die Arbeit des Menschen steht weiter im Formular.
    expect(formularOffen()).toBe(true);
    expect(aussagefeld().value).toBe(MEIN_TEXT);
    expect(text(document.body), "es steht eine Erfolgsmeldung da").not.toContain(
      i18n.t("ko.revise.saved"),
    );
  });
});

// ================================================================================================
// K6 · RECHTEENTZUG NACH TEILABBRUCH — DER EINREICHWEG BLEIBT, DIE EINGABE AUCH.
// ================================================================================================
describe("JOB 4251 · K6 · 403 PROPOSAL_REQUIRED am Einordnungsschritt", () => {
  it("K6 · die Eingabe steht noch, der Einreichweg ist erreichbar, nichts wird freigegeben", async () => {
    const id = await objektAnlegen();
    await mount(id);

    stoerer = (a) =>
      a.action === "tags"
        ? {
            status: 403,
            error: "PROPOSAL_REQUIRED",
            message: "Dieses Wissensobjekt ist freigegeben.",
          }
        : null;
    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Der Weg steht da — und er reicht NICHTS von selbst ein.
    expect(text(el("bib-einreichen-pflicht"))).toBe(i18n.t("ko.propose.mustReview"));
    expect(zaehle("propose"), "es wurde still ein Vorschlag eingereicht").toBe(0);
    // Keine Erfolgsmeldung vor vollständiger Bestätigung.
    expect(text(document.body)).not.toContain(i18n.t("ko.revise.saved"));
    // Die Eingabe steht unverändert im Formular.
    expect(formularOffen()).toBe(true);
    expect(aussagefeld().value).toBe(MEIN_TEXT);
    // Und es wurde nichts direkt freigegeben.
    expect((await stand(id)).status).not.toBe("validiert");
  });
});

// ================================================================================================
// K7 · DER SATZ AN DER ECHT MONTIERTEN FLÄCHE — EINMAL, ÜBER DIE EINORDNUNG, IN DREI SPRACHEN.
// ================================================================================================
describe("JOB 4251 · K7 · der Konfliktsatz benennt die Einordnung und behauptet keinen Textverlust", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`K7 · ${sprache}: genau ein Satz, er handelt von der Einordnung, der Entwurf bleibt`, async () => {
      await i18n.changeLanguage(sprache);
      const id = await objektAnlegen();
      await mount(id);
      expect(formularOffen()).toBe(true);

      // B ordnet ein, WÄHREND der Mensch tippt — echtes zweites Konto, echte Route.
      await fremdEinordnen(id, ["bernd", "ueberdruck"]);

      await schlagwortSetzen("wartung");
      await tippen(aussagefeld(), MEIN_TEXT);
      await klick(knopfMitText(i18n.t("ko.saveEdit")));

      const satz = i18n.t("ko.revise.staleEinordnungTagsCategory");
      expect(text(el("bib-speichern-satz"))).toBe(satz);
      expect(wieOft(satz), "der Satz steht mehr als einmal auf der Fläche").toBe(1);
      // Er behauptet NICHT, der Text sei verloren — der Satz über den Inhaltskonflikt steht nicht da.
      expect(text(document.body)).not.toContain(i18n.t("ko.revise.stale"));
      // Und der Text IST gespeichert — der Satz ist damit wahr, nicht nur freundlich.
      const jetzt = await stand(id);
      expect(jetzt.statement).toBe(MEIN_TEXT);
      expect(jetzt.tags, "Bs Einordnung wurde überschrieben").toEqual(["bernd", "ueberdruck"]);
      // Der eigene Entwurf bleibt im Formular.
      expect(formularOffen()).toBe(true);
      expect(aussagefeld().value).toBe(MEIN_TEXT);
    });
  }
});

// ================================================================================================
// RUNDE 2 · K10 — DER BEWUSSTE KONFLIKTENTSCHEID WIRD AUSGEFÜHRT, NICHT NUR ANGEBOTEN.
// ================================================================================================
//
// BENS BEFUND (Korrekturpflicht 2, Gegenprobe A, wörtlich `expected 2 to be 3`): Runde 1 bevorzugte
// nach einem gelungenen eigenen Schlagwortaufruf IMMER den Stand aus der eigenen Antwort — auch
// dann, wenn der Mensch danach ausdrücklich „Auf dem jetzigen Stand speichern" drückte. Der Knopf
// schickte also 2, während im Bild (und am Server) 3 stand, und lief zuverlässig in denselben 409.
// Ein Knopf, der nichts tun kann, ist eine Scheinfunktion.
//
// DIE REGEL, DIE HIER GEMESSEN WIRD, HAT ZWEI HÄLFTEN, und beide sind nötig:
//   · Der ausdrückliche Entscheid schreibt gegen den Stand, den der Mensch JETZT sieht.
//   · Sobald in DIESEM Lauf ein eigener Einordnungsaufruf durchgegangen ist, gilt dessen eigene
//     Quittung — sonst liefe der Kategorieaufruf gegen den Schlagwortaufruf von einer Zeile zuvor.
describe("JOB 4251 · K10 · der ausdrückliche Entscheid wirkt auch an der Einordnung", () => {
  /**
   * B ändert die KATEGORIE genau zwischen As Schlagwort- und As Kategorieaufruf — das ist das
   * Fenster. Bewusst nur die Kategorie: As Schlagworte bleiben damit stehen, und der erste Satz
   * („dein Text und deine Schlagworte sind gespeichert") ist an dieser Stelle wahr.
   */
  const bSchreibtVorDerKategorie = (id: string) => async (a: Schreibaufruf, nr: number) => {
    if (a.action === "category" && nr === 1) {
      await fremdeKategorie(id, "Anlage 9");
    }
    return null;
  };

  it("K10a · nach gelungenen eigenen Schlagworten und fremder Kategorieänderung schreibt der Entscheid WIRKLICH", async () => {
    const id = await objektAnlegen();
    await mount(id);

    stoerer = bSchreibtVorDerKategorie(id);
    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Die Voraussetzung, gemessen statt angenommen: eigene Schlagworte sind durch, die Kategorie
    // wurde abgewiesen, und der Konfliktknopf steht da.
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
    expect((await stand(id)).metadataRevision, "der Aufbau des Falls stimmt nicht").toBe(3);

    // Der Mensch ergänzt vor dem Entscheid noch ein Schlagwort. Das ist nicht Beiwerk, sondern
    // macht den Fall SCHARF: erst dadurch ist der Schlagwortaufruf des Entscheids eine WIRKSAME
    // Änderung, der Stempel klettert, und der Kategorieaufruf dahinter kann nur mit der Quittung
    // aus DEMSELBEN Lauf durchkommen — mit dem Stand von vorhin liefe er in einen 409.
    stoerer = null;
    await schlagwortSetzen("nachtrag");
    await klick(el("bib-speichern-trotzdem"));

    // DER MESSPUNKT: der Entscheid ist WIRKLICH geschrieben worden.
    const jetzt = await stand(id);
    expect(jetzt.category, "der bewusste Entscheid hat die Kategorie nicht gesetzt").toBe(
      "Anlage 1",
    );
    expect(jetzt.tags).toEqual(["ventil", "wartung", "nachtrag"]);
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
    expect(formularOffen(), "das Formular steht nach dem Erfolg noch offen").toBe(false);

    // Und er lief BEDINGT: der Kategorieaufruf des Entscheids trug die Quittung des eigenen
    // Schlagwortaufrufs aus DEMSELBEN Lauf, nicht den Stand von vorhin.
    const kategorieAufrufe = nur("category");
    const letzte = kategorieAufrufe[kategorieAufrufe.length - 1];
    expect(letzte?.hatStempel, "der Entscheid schrieb OHNE Bedingung").toBe(true);
    const tagsAufrufe = nur("tags");
    const letzterTags = tagsAufrufe[tagsAufrufe.length - 1];
    expect(letzterTags?.stempel, "der Entscheid schickte den überholten eigenen Stand").toBe(3);
    expect(letzte?.stempel, "der Kategorieaufruf lief gegen den eigenen Schlagwortaufruf").toBe(4);
  });

  // ==============================================================================================
  // K10b · RUNDE 3 — UND BEIM ZWEITEN KONFLIKT STIMMT AUCH DER SATZ.
  // ==============================================================================================
  //
  // BENS BEFUND (Runde 2, Korrekturpflicht 1, wörtlich `Tags wurden gerade abgewiesen; Kategorie
  // wurde in diesem Versuch gar nicht aufgerufen`): dieser Fall prüfte bis Runde 2 nur den
  // Schreibschutz und nicht die AUSKUNFT. Die war falsch — die Buchungsmarke des ERSTEN,
  // gelungenen Schlagwortaufrufs stand noch, also galt der Schritt als erledigt, und die Fläche
  // meldete „deine Schlagworte sind gespeichert", während sie soeben abgewiesen worden waren und
  // am Server fremde Schlagworte standen.
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`K10b · ${sprache}: zweiter fremder Schreiber — der Entscheid fragt erneut UND sagt die Wahrheit`, async () => {
      await i18n.changeLanguage(sprache);
      const id = await objektAnlegen();
      await mount(id);

      stoerer = bSchreibtVorDerKategorie(id);
      await schlagwortSetzen("wartung");
      await tippen(aussagefeld(), MEIN_TEXT);
      await klick(knopfMitText(i18n.t("ko.saveEdit")));
      // Erster Konflikt: nur die Kategorie ist offen, die eigenen Schlagworte stehen wirklich da.
      expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
      expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.staleEinordnungCategory"));
      expect((await stand(id)).tags).toEqual(["ventil", "wartung"]);

      // JETZT, nach der Meldung und VOR dem Knopf, überschreibt ein WEITERER Fremder die Schlagworte.
      stoerer = null;
      await fremdEinordnen(id, ["noch-fremder"]);
      expect((await stand(id)).metadataRevision).toBe(4);

      const kategorieVorher = zaehle("category");
      await klick(el("bib-speichern-trotzdem"));

      // Der Entscheid ging hinaus — und er trug eine Bedingung, sonst hätte er geschrieben.
      expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
      expect(
        (await stand(id)).tags,
        "der zweite fremde Schreiber wurde still überschrieben",
      ).toEqual(["noch-fremder"]);

      // DER ABBRUCHSCHRITT, gemessen am Protokoll: die Schlagworte sind abgewiesen worden, die
      // Kategorie wurde in diesem Versuch gar nicht erst aufgerufen.
      const letzterTags = nur("tags")[nur("tags").length - 1];
      expect(letzterTags?.stempel, "der Entscheid schrieb ohne oder mit falscher Bedingung").toBe(
        3,
      );
      expect(
        zaehle("category"),
        "die Kategorie ging hinaus, obwohl die Kette vorher gerissen ist",
      ).toBe(kategorieVorher);

      // UND DIE AUSKUNFT: beide Schritte sind offen, keiner darf als gespeichert gelten.
      expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.staleEinordnungTagsCategory"));
      expect(
        text(document.body),
        "die soeben abgewiesenen Schlagworte werden als gespeichert gemeldet",
      ).not.toContain(i18n.t("ko.revise.staleEinordnungCategory"));

      expect(formularOffen()).toBe(true);
      expect(aussagefeld().value).toBe(MEIN_TEXT);
      expect(text(document.body)).not.toContain(i18n.t("ko.revise.saved"));
    });
  }
});

// ================================================================================================
// RUNDE 3 · K12 — DIESELBE REGEL, WENN DER WIEDERHOLUNGSAUFRUF AM NETZ SCHEITERT.
// ================================================================================================
//
// BENS PRÜFLÜCKE (Runde 2, Punkt 6): „denselben Wiederholungsablauf mit Netzfehler statt 409
// prüfen — die alte Speichermarke darf auch dort keinen fehlgeschlagenen aktuellen Aufruf als
// erledigt ausweisen."
//
// ER IST DER SCHÄRFERE FALL, und deshalb steht er hier: bei einem 409 hat nachweislich jemand
// Fremdes geschrieben, die alte Marke ist also ohnehin verdächtig. Bei einem Netzabbruch ist sie
// das NICHT — am Server steht womöglich noch genau das, was sie sagt. Trotzdem gilt: DIESER Aufruf
// ist nicht durchgekommen, und „erledigt" wäre eine Auskunft über einen Vorgang, den es nicht
// gegeben hat. Die schwächere, wahre Aussage steht da, nicht die bequeme.
describe("JOB 4251 · K12 · ein gescheiterter Wiederholungsaufruf gilt nicht als erledigt", () => {
  it("K12 · Netzfehler am erzwungenen Schlagwortaufruf: der Satz nennt Schlagworte UND Kategorie", async () => {
    const id = await objektAnlegen();
    await mount(id);

    // Erster Griff: Schlagworte gehen durch, B ändert dazwischen die Kategorie, As Kategorie wird
    // abgewiesen. Erst dadurch steht der Konfliktknopf da — der ist der einzige Weg, einen
    // UNVERÄNDERTEN Schlagwortwert noch einmal wirklich abzusetzen.
    stoerer = async (a, nr) => {
      if (a.action === "category" && nr === 1) {
        await fremdeKategorie(id, "Anlage 9");
      }
      return null;
    };
    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
    expect((await stand(id)).tags).toEqual(["ventil", "wartung"]);

    // Der Entscheid: der Schlagwortaufruf geht mit UNVERÄNDERTEM Wert erneut hinaus — und scheitert
    // diesmal am NETZ, nicht an einem Konflikt. Seine Marke aus dem ersten Griff stimmt weiter mit
    // dem Formular überein; genau darauf zielt dieser Fall.
    stoerer = (a, nr) => (a.action === "tags" && nr === 2 ? TAGS_500 : null);
    await klick(el("bib-speichern-trotzdem"));

    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("teil");
    expect(
      text(el("bib-speichern-satz")),
      "der gescheiterte Schlagwortaufruf gilt als erledigt",
    ).toBe(i18n.t("ko.revise.partialTagsCategory"));
    expect(zaehle("tags"), "der Schlagwortaufruf ging gar nicht erst hinaus").toBe(2);
    expect(formularOffen()).toBe(true);
  });
});

// ================================================================================================
// RUNDE 2 · K11 — DER SATZ NENNT NUR, WAS WIRKLICH NICHT ANGEKOMMEN IST.
// ================================================================================================
//
// BENS BEFUND (Korrekturpflicht 3, Gegenprobe B): Runde 1 hatte EINEN Satz für jede
// Einordnungslage, und er erklärte „deine Schlagworte und deine Kategorie" pauschal für nicht
// durchgekommen. Wer seine Schlagworte gerade erfolgreich gespeichert hatte und nur an der
// Kategorie abgewiesen wurde, las damit eine Unwahrheit über die eigene Arbeit — genau die
// Glättung, die „Ehrlichkeit vor Optik" verbietet. Es sind jetzt drei Sätze, wie beim Teilabbruch
// (`teilSatzSchluessel`), und jeder nennt BEIDE Hälften: was steht und was nicht.
describe("JOB 4251 · K11 · die Konfliktauskunft über die Einordnung ist wahr", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`K11a · ${sprache}: eigene Schlagworte gespeichert, Kategorie abgewiesen — der Satz sagt genau das`, async () => {
      await i18n.changeLanguage(sprache);
      const id = await objektAnlegen();
      await mount(id);

      // B ändert NUR die Kategorie, und zwar GENAU zwischen As Schlagwort- und Kategorieaufruf.
      // As Schlagworte sind damit angekommen und bleiben stehen — das ist BENs Gegenprobe B.
      stoerer = async (a, nr) => {
        if (a.action === "category" && nr === 1) {
          await fremdeKategorie(id, "Anlage 9");
        }
        return null;
      };
      await schlagwortSetzen("wartung");
      await tippen(aussagefeld(), MEIN_TEXT);
      await klick(knopfMitText(i18n.t("ko.saveEdit")));

      const satz = i18n.t("ko.revise.staleEinordnungCategory");
      expect(text(el("bib-speichern-satz"))).toBe(satz);
      expect(wieOft(satz)).toBe(1);
      // Der pauschale Satz darf NICHT dastehen — er wäre hier die Unwahrheit.
      expect(text(document.body)).not.toContain(i18n.t("ko.revise.staleEinordnungTagsCategory"));

      // Und der Satz ist wahr, an beiden Hälften nachgelesen: die Schlagworte STEHEN am Server …
      const jetzt = await stand(id);
      expect(jetzt.tags, "der Satz nennt die Schlagworte als gespeichert — zu Unrecht").toEqual([
        "ventil",
        "wartung",
      ]);
      expect(jetzt.statement, "der Satz nennt den Text als gespeichert — zu Unrecht").toBe(
        MEIN_TEXT,
      );
      // … und die Kategorie ist die von B geblieben, nicht die von A. Genau das sagt der Satz.
      expect(jetzt.category, "As Kategorie hat Bs überschrieben").toBe("Anlage 9");
      expect(formularOffen()).toBe(true);
    });
  }

  it("K11b · ohne Kategorie am Eintrag nennt der Satz nur die Schlagworte", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    await fremdEinordnen(id, ["bernd"]);

    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.staleEinordnungTags"));
    expect(zaehle("category"), "eine leere Kategorie darf gar nicht erst hinausgehen").toBe(0);
    expect((await stand(id)).tags).toEqual(["bernd"]);
  });
});

// ================================================================================================
// RUNDE 4 · K13 — DIE FORTSETZUNG VON K5/K12: DER DRITTE GRIFF, DEN BEIDE NICHT MESSEN.
// ================================================================================================
//
// BENS GEGENPROBE AUS RUNDE 3, hier dauerhaft (Korrekturpflicht 1). K12 endete nach der
// Fehlermeldung — und genau DAHINTER lag der Schaden, den Runde 3 neu gebaut hat: das Verfallen der
// Marke des gescheiterten Aufrufs nahm den BEZUGSPUNKT der eigenen, bestätigten Quittung mit.
//
// DER ABLAUF HAT KEINEN FREMDEN SCHREIBER. Es schreibt nur EIN Mensch, zweimal bricht das Netz ab,
// und beim dritten, ganz gewöhnlichen Griff behauptete die Fläche „jemand anderes hat die Einordnung
// dieses Eintrags inzwischen geändert". Kollidiert ist sie mit sich selbst — BENs Wortlaut:
// `expected 1 to be 2`. Für den Menschen heisst das: sein Nachtrag kam nie an, und der Satz, der ihm
// das erklären sollte, war falsch. Eine Auskunft über einen Vorgang, den es nicht gab.
//
// DIE DREI GRIFFE SIND EINZELN NACHGEZÄHLT — Stempel UND Ausgang, nicht nur das Endergebnis: erst
// die Zahlen zeigen, dass der dritte Griff die EIGENE Quittung trägt und nicht zufällig durchkommt.
describe("JOB 4251 · K13 · zwei Netzabbrüche später gilt die eigene Quittung noch", () => {
  it("K13 · ohne jeden fremden Schreiber holt der dritte Griff den Nachtrag nach — kein erfundener Konflikt", async () => {
    const id = await objektAnlegen();
    await mount(id);
    expect((await stand(id)).metadataRevision, "Ausgangsstempel").toBe(1);

    // ---- GRIFF 1: Schlagworte gehen durch (Stempel 1 → Quittung 2), die Kategorie bricht am Netz ab.
    stoerer = (a, nr) => (a.action === "category" && nr === 1 ? KATEGORIE_500 : null);
    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(nur("tags")[0]?.stempel, "Griff 1 · tags · gesendeter Stempel").toBe(1);
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialCategory"));
    expect((await stand(id)).metadataRevision, "der eigene tags-Aufruf hat quittiert").toBe(2);
    expect((await stand(id)).tags).toEqual(["ventil", "wartung"]);

    // ---- GRIFF 2: der Nachtrag geht hinaus — mit der EIGENEN Quittung 2 — und bricht am Netz ab.
    await schlagwortSetzen("nachtrag");
    stoerer = (a, nr) => (a.action === "tags" && nr === 2 ? TAGS_500 : null);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(nur("tags")[1]?.stempel, "Griff 2 · tags · gesendeter Stempel").toBe(2);
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("teil");
    expect((await stand(id)).metadataRevision, "der abgebrochene Aufruf hat nichts bewegt").toBe(2);
    expect((await stand(id)).tags, "der abgebrochene Aufruf hat doch geschrieben").toEqual([
      "ventil",
      "wartung",
    ]);

    // ---- GRIFF 3: derselbe gewöhnliche Speichern-Knopf, kein Störer, kein Entscheid.
    stoerer = null;
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // DER MESSPUNKT: die eigene Quittung 2 steht noch — sie ist nicht auf den Öffnungsstand 1
    // zurückgefallen, als die Marke des gescheiterten Aufrufs verfiel.
    expect(
      nur("tags")[2]?.stempel,
      "Griff 3 · tags · die eigene Quittung 2 ist auf den Öffnungsstand 1 zurückgefallen",
    ).toBe(2);
    // Und die Kategorie desselben Griffs trägt die Quittung, die der tags-Aufruf gerade erzeugt hat.
    expect(nur("category")[1]?.stempel, "Griff 3 · category · gesendeter Stempel").toBe(3);

    // DAS ERGEBNIS AM ERNEUT GELESENEN OBJEKT: alles ist da, nichts fehlt.
    const jetzt = await stand(id);
    expect(jetzt.tags, "der Nachtrag fehlt in der Ablage").toEqual([
      "ventil",
      "wartung",
      "nachtrag",
    ]);
    expect(jetzt.category).toBe("Anlage 1");
    expect(jetzt.statement).toBe(MEIN_TEXT);
    // Kein erfundener Fremdkonflikt: weder der Satz noch die Lage stehen da.
    expect(suche("bib-speichern-lage"), "es steht ein Konflikt da, den es nicht gibt").toBe(null);
    expect(text(document.body)).not.toContain(i18n.t("ko.revise.staleEinordnungTags"));
    expect(text(document.body)).not.toContain(i18n.t("ko.revise.staleEinordnungTagsCategory"));
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
    expect(formularOffen(), "das Formular steht nach dem Erfolg noch offen").toBe(false);
  });
});

// ================================================================================================
// RUNDE 4 · K14 — EINE VERFALLENE MARKE ÖFFNET KEINEN UNBEDINGTEN SCHREIBZUGRIFF.
// ================================================================================================
//
// DER ZWEITE RANDFALL DERSELBEN TRENNUNG, und er zeigt in die andere Richtung. K13 verlangt, dass
// der Bezugspunkt eine verfallene Marke ÜBERLEBT. Die bequeme Art, das zu bauen, wäre: „ist die
// Quittung nicht da, schick eben den Stand vom Öffnen" — oder, noch bequemer, gar kein Feld. Beides
// wäre genau das stille Überschreiben, das dieser Auftrag beseitigt.
//
// GEMESSEN WIRD DER FALL, IN DEM DIE QUITTUNG WIRKLICH FEHLT: der eigene Aufruf ist durchgegangen,
// aber die Antwort trug keinen Stand (Altbestand ohne Projektionszeile, Lieferung 2). Ab da ist der
// eigene Bezugspunkt UNBEKANNT — und dann geht kein Einordnungsaufruf mehr hinaus. Wissenslücke
// statt Erfindung: eine geratene Zahl schützte vor nichts, ein weggelassenes Feld vor niemandem.
describe("JOB 4251 · K14 · ohne eigene Quittung geht kein Einordnungsaufruf hinaus", () => {
  it("K14 · Antwort ohne Stempel: die Aufrufe unterbleiben — auch nachdem die Marke verfallen ist", async () => {
    const id = await objektAnlegen();
    await mount(id);

    // ---- GRIFF 1: der tags-Aufruf GELINGT, seine Antwort trägt aber keinen Stand (Altbestand).
    // Damit ist die eigene Quittung ab hier unbekannt — und der category-Aufruf desselben Griffs
    // hat keinen Bezugspunkt mehr.
    stempelWeg = (a, nr) => a.action === "tags" && nr === 1;
    await schlagwortSetzen("wartung");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    stempelWeg = null;

    expect(nur("tags")[0]?.stempel, "Griff 1 · tags · gesendeter Stempel").toBe(1);
    expect((await stand(id)).tags, "der tags-Aufruf ist gar nicht durchgegangen").toEqual([
      "ventil",
      "wartung",
    ]);
    // DER ERSTE MESSPUNKT: der Kategorieaufruf ist NICHT hinausgegangen — weder mit einer geratenen
    // Zahl noch ohne Bedingung.
    expect(
      zaehle("category"),
      "Griff 1 · category ging ohne eigenen Bezugspunkt hinaus (unbedingt oder geraten)",
    ).toBe(0);
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("teil");
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialCategory"));
    expect(formularOffen(), "die Eingabe des Menschen ist weg").toBe(true);

    // JETZT ordnet jemand anderes ein — echtes zweites Konto, echte Route. Ab hier steht wirklich
    // etwas auf dem Spiel: As Formular trägt noch „Anlage 1", und ein unbedingter Aufruf würde Bs
    // Kategorie lautlos ersetzen.
    await fremdeKategorie(id, "Anlage 9");

    // ---- GRIFF 2: der Mensch ergänzt ein Schlagwort. Auch der tags-Aufruf hat jetzt keinen
    // Bezugspunkt und unterbleibt — und dabei VERFÄLLT seine Marke aus Griff 1.
    await schlagwortSetzen("nachtrag");
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(zaehle("tags"), "Griff 2 · tags ging ohne eigenen Bezugspunkt hinaus").toBe(1);
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTagsCategory"));

    // ---- GRIFF 3: DER MESSPUNKT DIESES FALLES. Die Marke ist verfallen — „ich habe hier noch nie
    // geschrieben" wäre jetzt die bequeme Lesart, und sie öffnete den unbedingten Schreibzugriff.
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(
      zaehle("tags"),
      "Griff 3: die verfallene Marke hat den unbedingten Schreibzugriff geöffnet",
    ).toBe(1);
    expect(zaehle("category"), "Griff 3: category ging ohne Bezugspunkt hinaus").toBe(0);

    // DAS ERGEBNIS AM ERNEUT GELESENEN OBJEKT: Bs Kategorie steht unverändert da.
    const jetzt = await stand(id);
    expect(jetzt.category, "Bs Kategorie wurde still überschrieben").toBe("Anlage 9");
    expect(jetzt.tags).toEqual(["ventil", "wartung"]);
    // Und es wird kein Erfolg gemeldet über etwas, das nie hinausgegangen ist.
    expect(text(document.body)).not.toContain(i18n.t("ko.revise.saved"));
    expect(formularOffen()).toBe(true);
  });
});
