// @vitest-environment jsdom
// ================================================================================================
// JOB 4075 · DER BROWSER-DIREKTWEG DER BIBLIOTHEK SCHREIBT BEDINGT.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, UND WARUM ES NICHT DER AUFRUF IST. Der Prüferbefund zu JOB 3667 R9
// lautet wörtlich: „Der Browser-Direktweg sendet weiterhin `revise` ohne `expectedVersion`
// (`BibliothekLesen.tsx:554`)." Die Korrekturpflicht dazu ist ebenso wörtlich: „Prüfe den
// Browser-Direktweg separat über Oberfläche → echte API → erneutes Lesen. Belege sofortige Freigabe
// und Konfliktschutz anhand des gespeicherten Ergebnisses; ein gemockter `revise`-Aufruf genügt
// dafür nicht."
//
// DESHALB IST HIER NICHTS GEMOCKT AUSSER DEM TRANSPORT. `globalThis.fetch` reicht an `app.inject`
// der ECHTEN Fastify-Anwendung weiter (Bauform von `tests/word-rueckweg/web-einreichweg-vertrag.test.tsx`),
// und darüber steht die ECHTE Lesefläche `BibliothekLesen` in jsdom. Adresse, Rumpf, Rechtegate,
// Dienst und Ablage sind Produktcode; geprüft wird am ERNEUT GELESENEN Objekt, nicht an einem
// beobachteten Aufruf.
//
// RED-FIRST (gemessen am Basisstand fa5eff5, VOR jeder Produktänderung — wörtlich, eigener Lauf
// `Tests 5 failed | 2 passed (7)`, Arbeitsprüfung b308a1e8…):
//   · D1 rot: `der eigene Text hat den fremden still überschrieben: expected 'Bei Überdruck Ventil X
//     ZUERST entlast…' to be 'Fremder Text.'` — der stille Überschreiber, am Ergebnis gelesen.
//   · D2 rot: `kein Konfliktsatz nach dem 409: expected null not to be null`.
//   · D3 rot: `Error: „bib-speichern-satz" steht nicht auf der Fläche`.
//   · D4 rot: `expected null not to be null` — es gab keinen Konfliktsatz, also auch keinen Knopf.
//   · D5 rot: `expected 'OffenÖffentlich-internAnlage 1 · Pedi…' to contain 'ko.revise.saved'`.
//   · D6 grün (Bestandsschutz: der 403-Weg ist unverändert), A1 in jenem Lauf noch grün — die
//     Aussage war zu schwach (`expectedVersion` steht auch am `decide-proposal`) und wurde
//     nachgeschärft; danach rot, s. RUECKGABE.
//
// RUNDE 2 · RED-FIRST DER NACHGETRAGENEN FÄLLE (eigener Lauf e29ff12c…, Produktstand MIT dem Rest
// des Auftrags, aber OHNE die Erfolgsprüfung des Nachlesens — `Tests 1 failed | 9 passed (10)`):
//   · D3b rot, wörtlich: `es steht eine Zahl da, die kein gelungenes Nachlesen gebracht hat:
//     expected 'Jemand anderes hat diesen Eintrag inzwischen geändert — gespeichert wurde nichts.
//     Dein Text steht unverändert hier.' to be … Received: '… geändert, ER STEHT JETZT AUF VERSION 1
//     — …'` — genau der Befund B1 des Prüfers aus Runde 1.
//   · D7/D7b waren in jenem Lauf schon grün: sie messen den Knopf „neu lesen" (Prüflücke 6), nicht
//     die Erfolgsprüfung. Das steht hier, damit niemand sie für Belege der Reparatur hält.
//
// RUNDE 3 · H1a/H1b SIND KEINE RED-FIRST-FÄLLE, und das steht hier, damit sie niemand dafür hält:
// sie messen einen BESTEHENDEN Hinweis (`BibliothekLesen.tsx:1177`), den die Rückgabe der Runde 2
// fälschlich für abwesend erklärt hatte. Sie waren vom ersten Lauf an grün — ihr Zweck ist, die
// Weiche `hinweisSchonGesagt` in beiden Stellungen festzuhalten, damit aus der stillen Annahme
// dieser Testbühne nie wieder eine Aussage über das Produkt wird (Promptverbesserung des Prüfers,
// Runde 2). Gegenprobe dazu in der RUECKGABE: Zeile 1177 entfernt → H1a rot.
//
// BENANNTE PRÜFLÜCKE: In-Memory-Ablagen (`buildServices()`), kein echter Browser, kein Postgres.
// Was hier steht, gilt für den Weg von der Fläche bis in die Ablage — nicht als Betriebsabnahme.
import { readFileSync } from "node:fs";
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
import { AUFFRISCHUNG_HINWEIS_MARKE } from "../../apps/web/src/lib/confidentiality";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let app: App;
/** Das Konto, in dessen Namen die OBERFLÄCHE spricht. Fremde Schreiber gehen an `app.inject`. */
let flaechenToken = "";
let adminToken = "";
let zweiterAdminToken = "";
let experteToken = "";

// ================================================================================================
// DAS LESETOR — WIE „VOR DEM NACHLESEN" ÜBERHAUPT MESSBAR WIRD (D3).
// ================================================================================================
//
// Der 409 setzt die zahlenlose Aussage, das Nachlesen trägt die Zahl nach. Beide Schritte in einem
// Zug ablaufen zu lassen und dann „vorher stand keine Zahl da" zu behaupten, wäre geraten. Also
// wird der LESEZUGRIFF auf genau dieses Objekt angehalten: der PUT läuft, der 409 kommt an, die
// Fläche wird gemessen — und erst dann geht das Tor auf. Kein Zeitgeber, keine Wettlaufannahme.
let lesetor: { warten: Promise<void>; oeffnen: () => void } | null = null;
let torPfad = "";
/** Der Detailabruf dieses Laufs — Zählpfad für `leseAbrufe`, gesetzt beim Aufbau der Fläche. */
let detailPfad = "";

function torSchliessen(pfad: string): void {
  let freigeben: () => void = () => {};
  const warten = new Promise<void>((r) => {
    freigeben = r;
  });
  torPfad = pfad;
  lesetor = { warten, oeffnen: freigeben };
}

function torOeffnen(): void {
  const tor = lesetor;
  lesetor = null;
  tor?.oeffnen();
}

// ================================================================================================
// DIE LESESPERRE — „NACHLESEN SCHEITERT" IST EIN EIGENER ZUSTAND, KEIN LANGSAMES GELINGEN (D3b).
// ================================================================================================
//
// Das Lesetor oben hält das Nachlesen nur AUF; am Ende gelingt es. Der Fall, den der Prüfer in
// Runde 1 fand (Fall B1), ist ein anderer: das Nachlesen GELINGT NICHT. react-query hält dann den
// zuletzt geholten Stand weiter in `data` — und wer diese Zahl nennt, nennt die alte, längst
// überholte Fassung als „jetzt gültig". Deshalb antwortet die Sperre ECHT mit 503, statt den
// Abruf verschwinden zu lassen: `api/client.ts` baut daraus seinen `ApiError`, react-query seinen
// Fehlerzustand — gemessen wird der Weg, nicht eine Abkürzung daneben.
let lesesperre: string | null = null;
/** Wie oft der Detailabruf WIRKLICH hinausging — der Beleg, dass „neu lesen" nachliest (D7). */
let leseAbrufe = 0;

/**
 * Der Transport, und NUR er, ist ersetzt — `api/client.ts` baut Adresse, Methode, Kopfzeilen und
 * Rumpf weiterhin selbst.
 */
function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode === "GET" && detailPfad !== "" && url.startsWith(detailPfad)) {
      // Gezählt wird der VERSUCH — auch der, den die Sperre gleich abweist. „Es ging nichts
      // hinaus" und „es kam nichts zurück" sind zwei verschiedene Aussagen.
      leseAbrufe++;
    }
    if (lesetor && methode === "GET" && url.startsWith(torPfad)) {
      await lesetor.warten;
    }
    if (lesesperre !== null && methode === "GET" && url.startsWith(lesesperre)) {
      const rumpf = JSON.stringify({ error: "UNAVAILABLE", message: "Ablage nicht erreichbar." });
      return {
        status: 503,
        ok: false,
        statusText: "503",
        text: async () => rumpf,
      };
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

/** Ein Wissensobjekt über den echten Weg — noch NICHT freigegeben (der Direktweg gilt). */
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

/** Der gespeicherte Stand, roh von der Route gelesen — DAS Beweismittel dieser Datei. */
async function stand(id: string): Promise<{ version: number; statement: string; status: string }> {
  const antwort = await app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as { version: number; statement: string; status: string };
}

/** Jemand anderes schreibt — über die ECHTE Route, mit einem ECHTEN zweiten Konto. */
async function fremdSchreiben(id: string, statement: string): Promise<number> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${zweiterAdminToken}` },
    payload: { action: "revise", changes: { statement, type: "best_practice" } },
  });
  expect(antwort.statusCode).toBe(200);
  return (antwort.json() as { version: number }).version;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Die echte Lesefläche, mit `?edit=1` — dem Deep-Link, der das Bearbeiten-Formular öffnet
 * (SCRUM-417, `BibliothekLesen.tsx`, `autoEditDone`). Genau dort wird die gesehene Fassung
 * festgehalten.
 *
 * `hinweisSchonGesagt` ist die Weiche des AUFRUFERS, nicht eine Eigenschaft dieser Fläche:
 * `BibliothekFlaeche.tsx:1924` setzt sie auf `standQuelle !== null` — trägt die Liste den Satz
 * „Stand von … · Auffrischung fehlgeschlagen" schon, schweigt die Lesefläche, sonst zeigt sie ihn
 * selbst (`BibliothekLesen.tsx:1177`). Die Fälle D1–D7b setzen sie auf `true` und blenden ihn damit
 * ABSICHTLICH aus, weil sie den Konfliktsatz messen; H1 misst beide Stellungen (s. u.).
 */
async function mount(koId: string, hinweisSchonGesagt = true): Promise<void> {
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
                    hinweisSchonGesagt,
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

/** Das Feld „Aussage" des Bearbeiten-Formulars — über seine Beschriftung gefunden, nicht gezählt. */
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

/** Das Bearbeiten-Formular steht offen, wenn sein Feld „Aussage" da ist. */
function formularOffen(): boolean {
  return [...document.body.querySelectorAll("label")].some(
    (l) => l.querySelector("span")?.textContent?.trim() === i18n.t("capture.fStatement"),
  );
}

const MEIN_TEXT = "Bei Überdruck Ventil X ZUERST entlasten, dann schließen.";

beforeEach(async () => {
  app = buildApp(buildServices());
  transportEinhaengen();
  lesetor = null;
  lesesperre = null;
  detailPfad = "";
  leseAbrufe = 0;
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pedi@klarwerk.test");
  zweiterAdminToken = await konto("admin", "admin2@klarwerk.test");
  experteToken = await konto("experte", "experte@klarwerk.test");
  flaechenToken = adminToken;
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  lesesperre = null;
  torOeffnen();
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("JOB 4075 · der Direktweg der Bibliothek überschreibt fremde Änderungen nicht mehr still", () => {
  it("D1 · eine fremde Änderung überlebt den zeitgleichen Speichervorgang — am gespeicherten Ergebnis gelesen", async () => {
    const id = await objektAnlegen();
    await mount(id);
    expect(formularOffen(), "das Bearbeiten-Formular ist nicht aufgegangen").toBe(true);

    // Jemand anderes schreibt, WÄHREND das Formular offen steht.
    expect(await fremdSchreiben(id, "Fremder Text.")).toBe(2);

    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // DER KERN: nachgelesen, nicht am Aufruf beobachtet.
    const jetzt = await stand(id);
    expect(jetzt.statement, "der eigene Text hat den fremden still überschrieben").toBe(
      "Fremder Text.",
    );
    expect(jetzt.version, "es wurde doch geschrieben (Version um zwei gestiegen)").toBe(2);
  });

  it("D2 · der Mensch sieht den Konfliktsatz — und sein getippter Text steht unverändert im Formular", async () => {
    const id = await objektAnlegen();
    await mount(id);
    await fremdSchreiben(id, "Fremder Text.");

    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Der Satz steht — und er ist der des SPEICHERWEGS, nicht der des Einreichwegs.
    expect(suche("bib-speichern-lage"), "kein Konfliktsatz nach dem 409").not.toBeNull();
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
    // Und die Arbeit ist nicht verschluckt: das Formular steht, mit genau dem getippten Text.
    expect(formularOffen(), "der 409 hat das Formular geschlossen").toBe(true);
    expect(aussagefeld().value, "der getippte Text ist verschwunden").toBe(MEIN_TEXT);
  });

  it("D3 · vor dem Nachlesen steht der zahlenlose Satz, danach die WIRKLICH gelesene Fassung", async () => {
    const id = await objektAnlegen();
    await mount(id);
    await fremdSchreiben(id, "Fremder Text.");
    await tippen(aussagefeld(), MEIN_TEXT);

    // Das Nachlesen wird angehalten — so ist „vorher" eine Messung und keine Annahme.
    torSchliessen(`/api/kos/${id}`);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(
      text(el("bib-speichern-satz")),
      "es steht eine Zahl da, die noch niemand gelesen hat",
    ).toBe(i18n.t("ko.revise.stale"));

    await act(async () => {
      torOeffnen();
      await flush();
    });
    await act(flush);

    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.staleVersion", { n: "2" }));
  });

  // ==============================================================================================
  // D3b · DER FALL, DEN RUNDE 1 FALSCH BEANTWORTET HAT (Prüferbefund B1).
  // ==============================================================================================
  //
  // Runde 1 nahm die Fassung aus `r.data` des Nachlesevorgangs — ohne zu prüfen, OB er gelungen ist.
  // Scheitert er, hält react-query den zuletzt geholten Stand weiter in `data`; auf der Fläche stand
  // daraufhin „er steht jetzt auf Version 1", während der Server auf 2 stand. Das ist schlimmer als
  // keine Zahl: es ist eine Zahl, die wie nachgelesen aussieht und falsch ist. §9 sagt wörtlich:
  // „Konflikt, Nachlesen scheitert: es bleibt beim zahlenlosen Satz. Keine Zahl aus dem Cache."
  it("D3b · scheitert das Nachlesen, bleibt der Satz zahlenlos — keine Fassung aus dem Zwischenspeicher", async () => {
    const id = await objektAnlegen();
    await mount(id);
    expect(formularOffen(), "das Bearbeiten-Formular ist nicht aufgegangen").toBe(true);
    expect(await fremdSchreiben(id, "Fremder Text.")).toBe(2);
    await tippen(aussagefeld(), MEIN_TEXT);

    // Ab hier scheitert JEDER Detailabruf. Der 409 kommt weiterhin echt von der Route — nur das
    // Nachlesen danach kommt nicht mehr durch.
    lesesperre = `/api/kos/${id}`;
    const vorher = leseAbrufe;
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(
      leseAbrufe,
      "es wurde gar nicht erst nachgelesen — der Fall ist nicht der gemeinte",
    ).toBeGreaterThan(vorher);
    expect(
      text(el("bib-speichern-satz")),
      "es steht eine Zahl da, die kein gelungenes Nachlesen gebracht hat",
    ).toBe(i18n.t("ko.revise.stale"));
    // Namentlich NICHT die alte, überholte Fassung aus dem Zwischenspeicher.
    expect(
      text(document.body),
      "die Fassung von VOR dem Konflikt wird als aktuell ausgegeben",
    ).not.toContain(i18n.t("ko.revise.staleVersion", { n: "1" }));
    // Die Arbeit überlebt auch diesen Fall.
    expect(formularOffen(), "der gescheiterte Leseversuch hat das Formular geschlossen").toBe(true);
    expect(aussagefeld().value, "der getippte Text ist verschwunden").toBe(MEIN_TEXT);
    // Und geschrieben wurde nichts: `stand()` geht an `app.inject`, an der Sperre vorbei.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe("Fremder Text.");
    expect(jetzt.version).toBe(2);
  });

  // ==============================================================================================
  // H1 · DER HINWEIS „STAND VON … · AUFFRISCHUNG FEHLGESCHLAGEN" — BEIDE STELLUNGEN DER WEICHE.
  // ==============================================================================================
  //
  // WARUM DIESE ZWEI FÄLLE ÜBERHAUPT HIER STEHEN: Die Rückgabe der Runde 2 behauptete unter REST,
  // diese Fläche kenne den Hinweis aus Lehre 7 nicht. Das war falsch, und der Prüfer hat es
  // widerlegt — `BibliothekLesen.tsx:1177` bindet ihn ein. Was in D1–D7b fehlt, ist nicht der
  // Hinweis, sondern der Aufrufer, der ihn zeigen lässt: jene Fälle setzen `hinweisSchonGesagt` auf
  // `true`, weil dort der Konfliktsatz gemessen wird. Damit aus einer widerlegten Behauptung eine
  // gemessene Aussage wird, steht die Weiche hier in BEIDEN Stellungen — genau die Stellungen, die
  // `BibliothekFlaeche.tsx:1924` im Betrieb setzt (`standQuelle !== null`).
  //
  // Der Auslöser ist derselbe echte Ablauf wie in D3b: echter 409 von der Route, danach scheitert
  // das Nachlesen mit 503. Nur so entsteht `auffrischungGescheitert` (`isError && data != null`).
  it("H1a · zeigt die Liste den Satz NICHT, trägt die Lesefläche ihn selbst — nach gescheitertem Nachlesen sichtbar", async () => {
    const id = await objektAnlegen();
    await mount(id, false);
    expect(formularOffen(), "das Bearbeiten-Formular ist nicht aufgegangen").toBe(true);
    expect(await fremdSchreiben(id, "Fremder Text.")).toBe(2);
    await tippen(aussagefeld(), MEIN_TEXT);

    lesesperre = `/api/kos/${id}`;
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Der Hinweis steht da — aus der EINEN Bauform (`AuffrischungHinweis`), an seiner Marke
    // gefunden, nicht an einem abgeschriebenen Text.
    const hinweis = suche(AUFFRISCHUNG_HINWEIS_MARKE);
    expect(hinweis, "der Hinweis auf die gescheiterte Auffrischung fehlt").not.toBeNull();
    // Der unveränderliche Teil des Satzes, aus dem Wörterbuch geholt statt abgeschrieben —
    // die Zeit davor ist der Zeitpunkt des letzten GELUNGENEN Abrufs und läuft mit.
    const schwanz = i18n.t("state.staleRefetchFailed", { zeit: "§ZEIT§" }).split("§ZEIT§")[1] ?? "";
    expect(schwanz.length, "der Wortlaut hat keinen festen Teil mehr").toBeGreaterThan(0);
    expect(text(hinweis as HTMLElement)).toContain(schwanz);

    // Und er verdrängt nichts: der Konfliktsatz des Speicherwegs steht weiter, weiter zahlenlos,
    // der getippte Text steht weiter im Formular, geschrieben wurde weiter nichts.
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.stale"));
    expect(aussagefeld().value).toBe(MEIN_TEXT);
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe("Fremder Text.");
    expect(jetzt.version).toBe(2);
  });

  it("H1b · sagt die Liste den Satz schon, schweigt die Lesefläche — die Stellung der Fälle D1–D7b", async () => {
    const id = await objektAnlegen();
    await mount(id, true);
    expect(await fremdSchreiben(id, "Fremder Text.")).toBe(2);
    await tippen(aussagefeld(), MEIN_TEXT);

    lesesperre = `/api/kos/${id}`;
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Derselbe Ablauf, dieselbe gescheiterte Auffrischung — nur der Aufrufer sagt, der Satz stehe
    // schon anderswo. Kein zweiter Knoten. Das ist der Grund, warum die übrigen Fälle ihn nicht
    // sehen; ein Schluss auf eine fehlende Produktfunktion ist daraus NICHT zu ziehen.
    expect(suche(AUFFRISCHUNG_HINWEIS_MARKE), "der Satz steht zweimal auf der Fläche").toBeNull();
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.stale"));
    expect(aussagefeld().value).toBe(MEIN_TEXT);
  });

  // ==============================================================================================
  // D7 · DER KNOPF „EINTRAG NEU LESEN" — BEIDE AUSGÄNGE GEMESSEN (Prüflücke 6 aus Runde 1).
  // ==============================================================================================
  //
  // WARUM DANACH ERNEUT GEFRAGT WIRD, UND DAS ABSICHT IST: Nachlesen führt die gesehene Fassung des
  // Formulars NICHT nach (Lieferung 1: sie ist die Fassung, die beim Öffnen auf dem Bildschirm
  // stand). Wer nach dem Nachlesen wieder „Speichern" drückt, bekommt deshalb denselben ehrlichen
  // Konflikt — und nicht ein stilles Überschreiben der fremden Änderung, die er vielleicht gar nicht
  // angesehen hat. Übernommen wird über „erneut speichern", den bewussten zweiten Griff.
  it("D7 · „Eintrag neu lesen“ liest wirklich nach, räumt die Lage weg, behält jedes Wort — und überschreibt danach nichts still", async () => {
    const id = await objektAnlegen();
    await mount(id);
    await fremdSchreiben(id, "Fremder Text.");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(suche("bib-speichern-lage"), "kein Konfliktsatz nach dem 409").not.toBeNull();

    const vorher = leseAbrufe;
    await klick(el("bib-speichern-neu-lesen"));

    expect(leseAbrufe, "der Knopf hat gar nicht nachgelesen").toBeGreaterThan(vorher);
    expect(suche("bib-speichern-lage"), "die Lage steht nach dem Nachlesen weiter da").toBeNull();
    expect(formularOffen(), "das Nachlesen hat das Formular geschlossen").toBe(true);
    expect(aussagefeld().value, "das Nachlesen hat den getippten Text verworfen").toBe(MEIN_TEXT);

    // Bedienbar geblieben: es lässt sich weitertippen.
    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    expect(aussagefeld().value).toBe(ERGAENZT);

    // Und der zweite Speicherversuch fragt WIEDER, statt still zu überschreiben.
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(
      suche("bib-speichern-lage"),
      "nach dem Nachlesen wurde still überschrieben",
    ).not.toBeNull();
    const zwischen = await stand(id);
    expect(zwischen.statement).toBe("Fremder Text.");
    expect(zwischen.version).toBe(2);

    // Der bewusste Griff schreibt dann — auf der jetzt gültigen Fassung.
    await klick(el("bib-speichern-trotzdem"));
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(ERGAENZT);
    expect(jetzt.version).toBe(3);
  });

  it("D7b · scheitert dieses Nachlesen, steht der getippte Text weiter da — und keine erfundene Fassung", async () => {
    const id = await objektAnlegen();
    await mount(id);
    await fremdSchreiben(id, "Fremder Text.");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(suche("bib-speichern-lage")).not.toBeNull();

    lesesperre = `/api/kos/${id}`;
    const vorher = leseAbrufe;
    await klick(el("bib-speichern-neu-lesen"));

    expect(leseAbrufe, "der Leseversuch ging gar nicht hinaus").toBeGreaterThan(vorher);
    // Der Bestand bleibt stehen, statt zu verschwinden (`abfrageMitBestand`) — und das Formular mit
    // ihm. Der gescheiterte Leseversuch nimmt dem Menschen nichts weg.
    expect(formularOffen(), "der gescheiterte Leseversuch hat das Formular geschlossen").toBe(true);
    expect(aussagefeld().value, "der getippte Text ist verschwunden").toBe(MEIN_TEXT);
    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    expect(aussagefeld().value, "das Formular ist nicht mehr bedienbar").toBe(ERGAENZT);
    // Keine Zahl, die niemand gelesen hat — an keiner Stelle der Fläche.
    expect(text(document.body)).not.toContain(i18n.t("ko.revise.staleVersion", { n: "1" }));
    expect(text(document.body)).not.toContain(i18n.t("ko.revise.staleVersion", { n: "2" }));
    // Geschrieben wurde nichts.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe("Fremder Text.");
    expect(jetzt.version).toBe(2);
  });

  it("D4 · der Knopf „erneut speichern“ schreibt auf der JETZT gültigen Fassung — erneut gelesen steht der eigene Text da", async () => {
    const id = await objektAnlegen();
    await mount(id);
    await fremdSchreiben(id, "Fremder Text.");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(suche("bib-speichern-lage")).not.toBeNull();

    await klick(el("bib-speichern-trotzdem"));

    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(MEIN_TEXT);
    expect(jetzt.version, "der zweite Versuch hat nicht geschrieben").toBe(3);
    expect(
      suche("bib-speichern-lage"),
      "der Konfliktsatz steht nach dem Erfolg weiter da",
    ).toBeNull();
  });

  it("D5 · ohne Zwischenschreiber gelingt das Speichern — und die Bestätigung ist sichtbar", async () => {
    const id = await objektAnlegen();
    await mount(id);
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(MEIN_TEXT);
    expect(jetzt.version).toBe(2);
    // Pedis Zeile: heute schliesst sich das Formular kommentarlos. Jetzt steht ein Satz da.
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
    expect(suche("bib-speichern-lage")).toBeNull();
  });

  it("D6 · BESTANDSSCHUTZ: der 403 führt unverändert in den Einreichweg — ohne den Konflikttext des Speicherwegs", async () => {
    const id = await objektAnlegen();
    flaechenToken = experteToken;
    await mount(id);
    expect(formularOffen()).toBe(true);

    // Das Objekt wird freigegeben, WÄHREND der Experte tippt — genau die Lage, für die der
    // 403-Zweig gebaut wurde (`PROPOSAL_REQUIRED`).
    const frei = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: "admin-validate" },
    });
    expect(frei.statusCode).toBe(200);

    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(
      suche("bib-einreichen-pflicht"),
      "der Einreichweg wird nicht mehr angeboten",
    ).not.toBeNull();
    expect(suche("bib-einreichen"), "der Einreichen-Knopf fehlt").not.toBeNull();
    expect(
      suche("bib-speichern-lage"),
      "der Konflikttext des Speicherwegs steht an einem 403",
    ).toBeNull();
    // Und nichts ist geschrieben worden.
    expect((await stand(id)).statement).toBe("Bei Überdruck Ventil X manuell schließen.");
  });

  it("A1 · ABLÖSUNG: es gibt genau EINEN `revise`-Aufruf auf dieser Fläche, und er trägt die gesehene Fassung", async () => {
    // §8.7: der unbedingte Schreibzugriff wird ERSETZT, nicht ergänzt — es darf kein zweiter
    // Speicherpfad ohne `expectedVersion` stehenbleiben. Das ist am Quelltext ablesbar und keine
    // Zusage; die Wirkung misst D1.
    const quelle = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
      "utf8",
    );
    expect(quelle.match(/action: "revise"/g) ?? []).toHaveLength(1);
    // Und zwar an DIESER Stelle: der Rumpf genau dieses einen Aufrufs, nicht irgendwo sonst in der
    // Datei (`decide-proposal` trägt das Feld längst — ein Suchtreffer über die ganze Datei wäre
    // deshalb kein Beleg).
    const beginn = quelle.indexOf('action: "revise"');
    const aufruf = quelle.slice(beginn, quelle.indexOf("});", beginn));
    expect(aufruf, "der eine `revise`-Aufruf trägt die gesehene Fassung nicht").toContain(
      "expectedVersion",
    );
  });
});
