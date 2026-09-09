// @vitest-environment jsdom
// ================================================================================================
// JOB 3190 · UX-18 · R3 — DIE KACHEL SAGT NICHT NUR, WO ES GEHT. SIE FÜHRT DORTHIN.
// ================================================================================================
//
// Nur die Beschriftung zu ändern, erfüllte den Wortlaut des Auftrags und nicht seinen Zweck: wer
// auf `/import` liest „das gibt es im Erfassen", muss von dort auch hinkommen. Dieser Fall ist
// deshalb ein NAVIGATIONS-, kein Textfall.
//
// RUNDE 2 — WIE WEIT DIE KACHEL WIRKLICH TRÄGT. Bens Browsermessung an Runde 1:
//     BEN ZIELZUSTAND {"dateiauswahl":false,"dateieingang":true,"dateiwerkzeug":true}
// Der Klick landet auf dem Blatt des Erfassens; der Dateiimport liegt dort noch hinter zwei
// Schritten. Runde 1 hat diese zwei Schritte im Test still eingeschoben und „erreicht" gemeldet —
// das ist die Halbheit, die Ben aufgedeckt hat. Jetzt misst dieser Fall die GRENZE ausdrücklich,
// die Kachel sagt die Restschritte SICHTBAR an, und der Test läuft genau die angesagten Schritte
// ab (Wortlaut aus der Kachel gelesen, nicht im Test getippt).
//
// ================================================================================================
// JOB 3341 (UX-18-R1) — NACHGEFÜHRT: DIE GRENZE VON RUNDE 2 IST GEFALLEN.
// ================================================================================================
//
// Die drei Fälle unten (GRENZE · ANSAGE · die angesagten Schritte) hielten den Zustand fest, den
// Ben gemessen hatte. Runde 2 hat dazu ausdrücklich hingeschrieben: „Wird sie es eines Tages in
// EINEM Schritt, wird dieser Fall rot — und gehört dann gestrichen, gemeinsam mit der Wegzeile auf
// der Kachel." Genau das ist eingetreten. Die Fälle sind deshalb NICHT gelöscht, sondern
// UMGEDREHT: sie prüfen jetzt denselben Gegenstand am neuen, wahren Zustand — die Dateiauswahl
// steht nach EINEM Klick da, die Kachel sagt keine Restschritte mehr an, und der alte Menüweg ist
// nicht abgelöst, sondern nur nicht mehr der einzige.
//
// GEMESSEN AN DEN ECHTEN FLÄCHEN, NICHT AN EINER FIXTURE: gemountet wird `AppRoutes` — der echte
// Router des Produkts, mit dem echten Rollen-Gate — an einem echten Fastify-Server (`fetch` →
// `app.inject`), angemeldet als Admin, Stufe 2 eingeschaltet. `/import` ist damit die wirkliche
// Import-Fläche, `/erfassen` die wirkliche Erfassen-Fläche.
//
// WIE DIE NAVIGATION AUSGELÖST WIRD, UND WARUM SO: Die Kachel ist ein echtes `<a href>` (dieselbe
// Bauform wie der bestehende Erklärlink der Galerie). Im Browser folgt die Plattform diesem Link —
// bei Maus, bei Tab+Enter, beim Mittelklick — und lädt die Anwendung an der neuen Adresse. jsdom
// führt eine solche Navigation NICHT aus; das ist eine bekannte Grenze dieser Umgebung, dieselbe,
// die `tests/app/file-type-picker-planned-default.test.tsx` für Enter am Aufklapper benennt.
// Deshalb steht hier eine ausdrückliche Brücke: ein Hörer am Dokument nimmt genau die Klicks, die
// NICHT abgefangen wurden (`defaultPrevented === false`), liest die Adresse aus dem Element und
// reicht sie an den Router. Das ist Zug um Zug das, was der Browser täte — und es ist gerade KEIN
// `href`-Vergleich: gemessen wird danach der GEMOUNTETE Baum der Zielfläche.
//
// Der echte Browserdurchgang (Tab bis zur Kachel, Enter, gelandete Adresse) steht zusätzlich in
// `tests/import-einstieg/kachel-schmal-chromium.test.ts` (Fall B1–B3) — dort führt die Plattform
// die Navigation selbst aus.
//
// VORHER (gemessen, 07.09.2026, Gegenprobe „Navigationsziel entfernt"): rot mit
// `AssertionError: expected 'BUTTON' to be 'A'` und
// `Error: das Blatt des Erfassens ist nicht erschienen.` — 5 von 6 Fällen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useNavigate } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS } from "../../apps/web/src/app/navigation";
import {
  BLATT_WEGE,
  BLATT_WEG_DATEI,
  BLATT_WEG_PARAMETER,
} from "../../apps/web/src/components/erfassen/wege";
import i18n from "../../apps/web/src/i18n";
import { AppRoutes } from "../../apps/web/src/routes";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

interface Antwort {
  statusCode: number;
  body: string;
}
let server: { inject: (o: Record<string, unknown>) => Promise<Antwort> };
let token = "";
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Warten, bis die Sitzungsabfragen wirklich durch sind. GEMESSEN, nicht angenommen: mit 40
 * Nulltakten allein stand `useSession().user` noch auf `null`, das Rollen-Gate zeigte die
 * Rolle-Karte statt der Import-Fläche. Die beiden Abfragen (`/auth/status`, dann `/auth/me`)
 * brauchen echte Zeitscheiben; hier wird auf den ZUSTAND gewartet (Kachel bzw. Blatt da), die
 * Frist ist nur die Obergrenze.
 */
async function warteAuf(pruefung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    if (pruefung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  throw new Error(
    `${was} ist nicht erschienen. Sichtbar: ${(container.textContent ?? "").slice(0, 600)}`,
  );
}

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const res = await server.inject({
      method: init.method ?? "GET",
      url: String(input),
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<void> {
  server = buildApp(buildServices()) as unknown as typeof server;
  token = "";
  // Das erste Konto ist der Bootstrap-Admin — genau die Rolle, die `/import` verlangt.
  await server.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3190.test", password: "geheim12345" },
  });
  const login = await server.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3190.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
}

/**
 * Die Brücke, die im Browser die Plattform ist: ein nicht abgefangener Klick auf ein `<a href>`
 * mit gleicher Herkunft führt zu genau dieser Adresse. Sie hängt am Dokument (nicht an der
 * Kachel), damit sie nichts über den Auslöser voraussetzt.
 */
let zurueck: (() => void) | null = null;

function Navigationsbruecke(): null {
  const navigate = useNavigate();
  useEffect(() => {
    zurueck = () => navigate(-1);
  }, [navigate]);
  useEffect(() => {
    const hoerer = (ereignis: MouseEvent): void => {
      if (ereignis.defaultPrevented) {
        return;
      }
      const ziel = (ereignis.target as Element | null)?.closest?.("a[href]");
      const href = ziel?.getAttribute("href") ?? "";
      if (href.startsWith("/")) {
        navigate(href);
      }
    };
    document.addEventListener("click", hoerer);
    return () => document.removeEventListener("click", hoerer);
  }, [navigate]);
  return null;
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                  { initialEntries: ["/import"] },
                  createElement(Navigationsbruecke),
                  createElement(AppRoutes),
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
  await warteAuf(
    () => container.querySelector("#import-source-gallery") !== null,
    "die Import-Galerie auf `/import`",
  );
}

function kachel(id: string): HTMLElement {
  const el = container.querySelector(`[data-id="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(
      `Kachel ${id} nicht auf der Fläche. Sichtbar: ${(container.textContent ?? "").slice(0, 600)}`,
    );
  }
  return el;
}

async function klick(el: HTMLElement): Promise<boolean> {
  let nichtAbgefangen = false;
  await act(async () => {
    nichtAbgefangen = el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
  await act(flush);
  return nichtAbgefangen;
}

beforeEach(async () => {
  globalThis.localStorage?.clear();
  // Der persistierte Stufe-2-Schalter (`lib/stufe2Storage.ts`) — ohne ihn zeigt das Rollen-Gate
  // die Stufe-2-Karte statt der Import-Fläche.
  globalThis.localStorage?.setItem("kw.stufe2.v1", "1");
  await i18n.changeLanguage("de");
  await serverStarten();
  brueckeAufbauen();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 3190 · R3 — von der Kachel auf `/import` bis zum Dateiimport des Erfassens", () => {
  it("die Import-Fläche steht wirklich da (sonst prüfte alles Weitere an ihr vorbei)", async () => {
    await mount();
    expect(container.querySelector("#import-source-gallery")).not.toBeNull();
    expect(kachel("json-file").getAttribute("data-state")).toBe("active");
  });

  it("die Word-Kachel ist ein echter Weg: `<a>` mit Ziel, tastaturfokussierbar", async () => {
    await mount();
    const word = kachel("docx");
    expect(word.getAttribute("data-state")).toBe("elsewhere");
    // Ein `<a href>` ist die STRUKTURELLE Zusage, aus der die Plattform Tab-Erreichbarkeit und
    // Enter-Aktivierung ableitet. Ein `<div onClick>` sähe identisch aus und wäre keine.
    expect(word.tagName).toBe("A");
    expect(word.getAttribute("href")).toBeTruthy();
    // Fokussierbar OHNE künstliches `tabindex` — also im Tab-Lauf der Seite.
    expect(word.getAttribute("tabindex")).toBeNull();
    word.focus();
    expect(document.activeElement).toBe(word);
    // Und der Fokus ist SICHTBAR: die Kachel trägt einen eigenen Fokusring.
    expect(word.className).toContain("focus-visible:ring-2");
    // Das Badge sagt „im Erfassen"; der ausgeschriebene Satz hängt am Link und ist derselbe, den
    // eine Kachel ohne Ziel als Hinweis zeigt — kein zweiter Wortlaut für dieselbe Wahrheit.
    expect(word.textContent).toContain(i18n.t("imp.gallery.elsewhere"));
    expect(word.getAttribute("title")).toBe(i18n.t("imp.gallery.hintElsewhere"));
  });

  it("das Ziel ist die Erfassen-Route des Routers, nicht ein getippter Pfad", async () => {
    await mount();
    // Nicht der Vergleich mit einer Zeichenkette ist der Beleg, sondern der Lauf danach —
    // dieser Fall hält nur fest, dass beide Kacheln DASSELBE, im Router vorhandene Ziel tragen.
    const wordZiel = kachel("docx").getAttribute("href");
    const pdfZiel = kachel("pdf").getAttribute("href");
    expect(wordZiel).toBe(pdfZiel);
    expect(wordZiel?.startsWith("/")).toBe(true);
  });

  // JOB 3341 (UX-18-R1): der gemountete Beleg für Lieferung 3 — die Kachel trägt den Weg IN der
  // Adresse. Beide Hälften sind gelesen und nicht getippt: der Pfad kommt aus der Registry
  // (`ALL_ITEMS`, Eintrag `erfassen`), der Wert aus `BLATT_WEGE` über `wege.ts`. Verglichen wird
  // deshalb gegen genau diese zwei Quellen und nicht gegen „/erfassen?weg=datei".
  it("und sie trägt den Weg mit: Pfad aus der Registry, Wert aus den Blatt-Wegen", async () => {
    await mount();
    const ziel = new URL(kachel("docx").getAttribute("href") ?? "", "http://klarwerk.test");
    expect(ziel.pathname, "der Pfad stammt nicht aus der Registry").toBe(
      ALL_ITEMS.find((item) => item.id === "erfassen")?.path,
    );
    expect(ziel.searchParams.get(BLATT_WEG_PARAMETER), "die Kachel nennt keinen Weg").toBe(
      BLATT_WEG_DATEI,
    );
    // Und der genannte Wert ist wirklich einer der Wege des Menüs „Datei ▾" — keine Erfindung.
    expect(BLATT_WEGE).toContain(BLATT_WEG_DATEI);
  });

  it("ein Klick führt WIRKLICH auf die Erfassen-Fläche — gemessen am gemounteten Baum", async () => {
    await mount();
    const gefolgt = await klick(kachel("docx"));
    // Nichts hat den Klick abgefangen: im Browser folgt die Plattform hier dem Link.
    expect(gefolgt, "der Klick wurde abgefangen — dann führt der Link nirgends hin").toBe(true);
    // Die Zielfläche steht da — gemessen am Baum, nicht an einer Adresse.
    //
    // JOB 3341 (UX-18-R1): gewartet wird auf die WERKZEUGZEILE des Erfassens und nicht mehr auf das
    // Schreibfeld-Blatt. Sie ist der Marker, der beide Ansichten dieser Fläche trägt (Blatt UND
    // Arbeitsraum, `Blatt.tsx`); seit der Kachel-Deep-Link den Arbeitsraum aufmacht, wäre
    // `[data-testid="blatt"]` die Messung einer Ansicht statt der Fläche.
    await warteAuf(
      () => container.querySelector('[data-testid="blatt-werkzeugzeile"]') !== null,
      "die Erfassen-Fläche",
    );
    // Und die Import-Galerie ist weg: es ist wirklich eine andere Fläche, kein Beiwerk daneben.
    expect(container.querySelector("#import-source-gallery")).toBeNull();
  });

  // ==============================================================================================
  // R3/B · JOB 3341 (UX-18-R1) — WAS DER KLICK JETZT ERREICHT, UND WAS ER DAMIT ABLÖST.
  // ==============================================================================================
  //
  // Bis Runde 2 stand hier die GRENZE: der Klick landete auf dem Blatt, der Dateiimport lag hinter
  // zwei Schritten, und die Kachel sagte sie an. Die drei folgenden Fälle sind dieselben drei,
  // umgedreht — der Gegenstand ist unverändert, nur die Wahrheit darüber ist eine andere:
  //   · ERREICHT   — nach EINEM Klick steht die Dateiauswahl da (vorher: sie fehlte),
  //   · KEINE ANSAGE — die Kachel sagt keine Restschritte mehr an (vorher: sie musste es),
  //   · NICHT ABGELÖST — der Menüweg „Datei ▾" → „Datei importieren" führt weiterhin hin.
  it("ERREICHT: EIN Klick, und der Dateiimport steht offen — ohne einen weiteren Griff", async () => {
    await mount();
    await klick(kachel("docx"));
    await warteAuf(
      () => container.querySelector('[data-testid="capture-file-pick"]') !== null,
      "die Dateiauswahl des Erfassens",
    );
    // Der Eingang trägt wirklich die Formate, um die es auf der Kachel ging.
    const eingang = container.querySelector('input[type="file"]');
    expect(eingang, "der Dateieingang des Erfassens fehlt").not.toBeNull();
    expect(eingang?.getAttribute("accept")).toContain(".docx");
    expect(eingang?.getAttribute("accept")).toContain(".pdf");
    // Es ist wirklich der Arbeitsraum des Blattes und nicht die Import-Fläche mit Beiwerk daneben.
    expect(container.querySelector('[data-testid="blatt-arbeitsraum"]')).not.toBeNull();
    expect(container.querySelector("#import-source-gallery")).toBeNull();
    // Und dort trägt die Word-Kachel den Zustand, um den es geht: hier ist sie wirklich aktiv.
    expect(kachel("docx").getAttribute("data-state")).toBe("active");
  });

  it("KEINE ANSAGE: die Kachel sagt keine Restschritte mehr an — es gibt keine", async () => {
    await mount();
    // Eine Wegbeschreibung, die nicht mehr stimmt, wäre die zweite Wahrheit, die JOB 3190/3235 auf
    // dieser Fläche abgeschafft haben. Gemessen wird deshalb über ALLE Kacheln, nicht nur über die
    // eine — auch eine vergessene anderswo wäre eine.
    expect(
      container.querySelectorAll("#import-source-gallery [data-tile-steps]").length,
      "auf der Galerie steht noch eine Restschritt-Zeile",
    ).toBe(0);
    // Was die Kachel weiterhin sagt, ist der ORT — Badge und ausgeschriebener Satz sind unberührt.
    expect(kachel("docx").textContent).toContain(i18n.t("imp.gallery.elsewhere"));
    expect(kachel("docx").getAttribute("title")).toBe(i18n.t("imp.gallery.hintElsewhere"));
    // Und dieser Satz nennt die zwei Schritte nicht mehr mit: er wäre sonst die Ansage im `title`,
    // die Runde 2 gerade deshalb auf die Kachel geholt hatte.
    expect(i18n.t("imp.gallery.hintElsewhere")).not.toContain(i18n.t("erfassen.weg.datei"));
  });

  it("NICHT ABGELÖST: der Weg über „Datei ▾“ führt weiterhin zum Dateiimport", async () => {
    await mount();
    await klick(kachel("docx"));
    await warteAuf(
      () => container.querySelector('[data-testid="capture-file-pick"]') !== null,
      "die Dateiauswahl des Erfassens",
    );
    // Zurück auf das Blatt — der Rückweg aus JOB 3282. Danach steht der alte Weg zur Prüfung offen.
    const abbrechen = [...container.querySelectorAll("button")].find((el) =>
      (el.textContent ?? "").includes("Abbrechen"),
    );
    expect(abbrechen, "kein „Abbrechen“ im Dateiimport").toBeInstanceOf(HTMLElement);
    await klick(abbrechen as HTMLElement);
    expect(container.querySelector('[data-testid="blatt-arbeitsraum"]')).toBeNull();

    // Schritt 1 — das Werkzeug wird über SEIN SICHTBARES WORT gefunden, nicht über eine testid:
    // damit belegt der Fall, dass es auf der Zielfläche wirklich so heisst.
    const werkzeugWort = i18n.t("erfassen.werkzeug.datei");
    const werkzeug = [
      ...container.querySelectorAll('[data-testid="blatt-werkzeugzeile"] button'),
    ].find((el) => (el.textContent ?? "").trim() === werkzeugWort);
    expect(werkzeug, `kein Werkzeug „${werkzeugWort}“ auf dem Blatt`).toBeInstanceOf(HTMLElement);
    await klick(werkzeug as HTMLElement);

    // Schritt 2 — derselbe Griff im geöffneten Menü.
    const eintragWort = i18n.t("erfassen.weg.datei");
    const eintrag = [...container.querySelectorAll('[role="menuitem"]')].find(
      (el) => (el.textContent ?? "").trim() === eintragWort,
    );
    expect(eintrag, `kein Menüeintrag „${eintragWort}“`).toBeInstanceOf(HTMLElement);
    await klick(eintrag as HTMLElement);

    expect(
      container.querySelector('[data-testid="capture-file-pick"]'),
      "der alte Weg ist mit abgeräumt worden — abgelöst wird nur die Behauptung, er sei der einzige",
    ).not.toBeNull();
  });

  it("der Rückweg besteht: die Import-Fläche ist über die Historie wieder da", async () => {
    await mount();
    await klick(kachel("docx"));
    // JOB 3341: derselbe Marker wie oben — und zugleich die Gegenprobe zur Adressbereinigung. Der
    // Weg-Parameter wird mit `replace` entfernt, der Eintrag `/erfassen?weg=datei` ist danach
    // `/erfassen`; EIN Schritt zurück muss deshalb weiterhin auf `/import` führen und nicht auf
    // eine Zwischenadresse.
    await warteAuf(
      () => container.querySelector('[data-testid="capture-file-pick"]') !== null,
      "die Dateiauswahl des Erfassens",
    );
    // Ein Schritt zurück in der Historie — das, was der Browser-Zurück-Knopf tut.
    await act(async () => {
      zurueck?.();
      await flush();
    });
    await warteAuf(
      () => container.querySelector("#import-source-gallery") !== null,
      "die Import-Galerie nach dem Rückweg",
    );
  });
});
