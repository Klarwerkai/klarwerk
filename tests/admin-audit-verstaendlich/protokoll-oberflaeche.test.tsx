// @vitest-environment jsdom
// ================================================================================================
// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DIE VERWALTERANSICHT, GEMOUNTET.
// ================================================================================================
//
// Die echten Karten (`PruefprotokollDetail`, `AuditDetail`) hinter einem echten Router mit zwei
// Orten: der Verwaltung und einem Beitrag (`/wissen/:id`, hier ein Platzhalter mit „Zurück“). Der
// Endpunkt ist ein Mock, der die Antwort des Seitenwegs liefert — WAS der Server freigibt, misst
// `seitenweg-und-rechte.test.ts`; hier geht es darum, was die Fläche daraus macht. Alle Namen,
// Kennungen und Titel sind erfunden.
//
//   K1 · Namen statt Kennungen; zwei „Anna Meier“ bleiben über eine Kurzkennung unterscheidbar;
//        das System heißt System.
//   K2 · Vorgang beim Namen; Rohaktion, Kennung und gespeicherter Zeitpunkt in den Details.
//   K3 · ein heute aufgelöster Name steht als solcher da.
//   K4 · Filter kombiniert in die Anfrage; Rücksprung aus dem Beitrag erhält Filter und Seite;
//        leerer Filterzustand lesbar mit Ausweg; verkehrter Zeitraum als verständlicher Fehler.
//   K5 · Rücklink nur für ein freigegebenes Objekt; ein anderes bleibt Kennung ohne Titel.
//   K6 · Haken nur mit Prüfzeitpunkt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { lage } = vi.hoisted(() => ({
  lage: {
    verify: { ok: true, count: 4 } as Record<string, unknown>,
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    audit: {
      seite: vi.fn(async () => ({})),
      verify: vi.fn(async () => ({
        linkageBreaks: 0,
        payloadDeviations: 0,
        serialisationDeviations: 0,
        unresolvedDeviations: 0,
        uncheckedDeviations: 0,
        ...lage.verify,
      })),
      exportChain: vi.fn(async () => ({})),
    },
    directory: {
      list: vi.fn(async () => [
        { id: "u-anna-1", name: "Anna Meier" },
        { id: "u-anna-2", name: "Anna Meier" },
        { id: "u-ben", name: "Ben Beispiel" },
      ]),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KONTO_AUDIT_AKTIONEN } from "../../apps/web/src/lib/adminForms";
import { AuditDetail } from "../../apps/web/src/pages/AdminDatenDetails";
import { PruefprotokollDetail } from "../../apps/web/src/pages/AdminSicherheitDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TITEL = "Wartungsanleitung Presse P9 (fiktiv)";

const eintrag = (
  seq: number,
  at: string,
  actor: string,
  action: string,
  target: string,
  payload: Record<string, unknown> = {},
) => ({ seq, at, actor, action, target, payload, prevHash: `p${seq}`, hash: `h${seq}` });

/** Die Protokollseite — jüngster zuerst. ko-1 ist freigegeben, ko-2 nicht. */
const PROTOKOLL = [
  eintrag(4, "2026-10-08T08:00:00.000Z", "u-anna-1", "ko.revised", "ko-1", { version: 2 }),
  eintrag(3, "2026-10-07T08:00:00.000Z", "u-anna-2", "ko.revised", "ko-2", { version: 5 }),
  eintrag(2, "2026-10-06T08:00:00.000Z", "u-ben", "auth.login", "u-ben"),
  eintrag(1, "2026-10-05T08:00:00.000Z", "system", "gap.created", "gap-1"),
];

const seite = (entries: unknown[], objekte: Record<string, { titel: string }> = {}) => ({
  entries,
  nextBefore: null,
  limit: 25,
  objekte,
  namensbelege: [],
});

const seiteMock = endpoints.audit.seite as unknown as ReturnType<typeof vi.fn>;

/** Die Verwaltung im Kleinen: die Karte aus `?detail=…`, wie `Admin.tsx` sie wählt. */
function Verwaltung(): JSX.Element {
  const [params] = useSearchParams();
  return params.get("detail") === "audit"
    ? createElement(AuditDetail, { onZurueck: () => undefined })
    : createElement(PruefprotokollDetail, { onZurueck: () => undefined });
}

/** Der Beitrag als Platzhalter — mit dem Weg zurück, den der Browser auch hat. */
function Beitrag(): JSX.Element {
  const navigate = useNavigate();
  return createElement(
    "button",
    { type: "button", "data-testid": "beitrag-zurueck", onClick: () => navigate(-1) },
    "Zurück",
  );
}

/** Wo der Router gerade steht — für die Messung des Rückwegs. */
function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-testid": "ort" }, `${ort.pathname}${ort.search}`);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            MemoryRouter,
            { initialEntries: [url] },
            createElement(Ort),
            createElement(
              Routes,
              null,
              createElement(Route, { path: "/admin", element: createElement(Verwaltung) }),
              createElement(Route, { path: "/wissen/:id", element: createElement(Beitrag) }),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();

const ort = (): string => text(container.querySelector('[data-testid="ort"]'));

function eintragsZeile(seq: number): Element {
  const el = container.querySelector(`[data-audit-eintrag="${seq}"]`);
  if (!el) {
    throw new Error(`Eintrag ${seq} nicht im DOM`);
  }
  return el;
}

function zelle(seq: number, labelKey: string): Element {
  const el = eintragsZeile(seq).querySelector(`[data-audit-zeile="${labelKey}"]`);
  if (!el) {
    throw new Error(`Zelle ${labelKey} fehlt bei Eintrag ${seq}`);
  }
  return el;
}

/** Spaltentext ohne die eingeklappten technischen Angaben. */
function spaltentext(): string {
  const kopie = container.cloneNode(true) as HTMLElement;
  for (const technik of kopie.querySelectorAll("[data-audit-technik], [data-audit-filter]")) {
    technik.remove();
  }
  return kopie.textContent ?? "";
}

/** Einen Feldwert so setzen, wie React ihn von einer Eingabe erwartet. */
async function setze(id: string, wert: string): Promise<void> {
  const el = container.querySelector(`#${id}`);
  if (el instanceof HTMLSelectElement) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(el, wert);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return;
  }
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Feld #${id} fehlt`);
  }
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function klick(el: Element | null | undefined, was: string): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Zum Klicken fehlt: ${was}`);
  }
  await act(async () => {
    el.click();
    await flush();
  });
  // Eine Navigation (Filter, Seite, Rücklink, Zurück) wird erst am Ende von `act` gezeichnet; der
  // Abruf zur neuen Adresse startet danach und braucht eine zweite Runde — wie beim Einhängen.
  await act(flush);
}

function knopf(beschriftung: string): HTMLButtonElement | undefined {
  const knoepfe = [...container.querySelectorAll("button")];
  return knoepfe.find((b) => text(b) === beschriftung);
}

const PROTOKOLL_URL = "/admin?bereich=sicherheit&detail=protokoll";

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.verify = { ok: true, count: 4 };
  seiteMock.mockImplementation(async (anfrage: { actor?: string } = {}) =>
    anfrage.actor === "u-niemand" ? seite([]) : seite(PROTOKOLL, { "ko-1": { titel: TITEL } }),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("K1/K2/K3/K5 · lesbare Zeilen, Details für die Prüfung, Rücklink nur mit Recht", () => {
  it("Namen, Mehrdeutigkeit, System; Vorgang beim Namen; Rohwerte nur in den Details", async () => {
    await mount(PROTOKOLL_URL);
    // K1: zwei Konten mit demselben Namen — die Kurzkennung unterscheidet sie.
    expect(text(zelle(4, "audit.detail.actor"))).toContain("Anna Meier");
    expect(text(zelle(3, "audit.detail.actor"))).toContain("Anna Meier");
    const kurz4 = zelle(4, "audit.detail.actor").querySelector("[data-audit-kurzkennung]");
    const kurz3 = zelle(3, "audit.detail.actor").querySelector("[data-audit-kurzkennung]");
    expect(kurz4?.getAttribute("title")).toBe("u-anna-1");
    expect(kurz3?.getAttribute("title")).toBe("u-anna-2");
    expect(text(kurz4)).not.toBe(text(kurz3));
    // Ein eindeutiger Name trägt keine Kurzkennung.
    expect(zelle(2, "audit.detail.actor").querySelector("[data-audit-kurzkennung]")).toBeNull();
    // Das System heißt System.
    expect(text(zelle(1, "audit.detail.actor"))).toBe(i18n.t("audit.detail.systemActor"));
    // K3: der Eintrag hat keinen Namen gespeichert — der heutige steht als solcher da.
    expect(
      zelle(2, "audit.detail.actor").querySelector('[data-audit-herkunft="verzeichnis"]'),
    ).not.toBeNull();

    // K2: verständlicher Vorgang in der Spalte, Rohwerte nur in den technischen Angaben.
    expect(text(zelle(4, "audit.detail.event"))).toBe(i18n.t("audit.action.ko_revised"));
    expect(text(zelle(2, "audit.detail.event"))).toBe(i18n.t("audit.action.auth_login"));
    expect(spaltentext()).not.toContain("ko.revised");
    expect(spaltentext()).not.toContain("auth.login");
    const technik = eintragsZeile(4).querySelector("[data-audit-technik]");
    expect(text(technik?.querySelector('[data-audit-kennung="action"]'))).toBe("ko.revised");
    expect(text(technik?.querySelector('[data-audit-kennung="at"]'))).toBe(
      "2026-10-08T08:00:00.000Z",
    );
    expect(text(technik?.querySelector('[data-audit-kennung="audit.detail.actor"]'))).toBe(
      "u-anna-1",
    );
    // Zeitpunkt in der Spalte: gelesen, mit Uhrzeit — nicht der rohe Wert.
    const zeit = eintragsZeile(4).querySelector("time");
    expect(zeit?.getAttribute("datetime")).toBe("2026-10-08T08:00:00.000Z");
    expect(text(zeit)).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(text(zeit)).not.toBe("2026-10-08T08:00:00.000Z");

    // K5: der freigegebene Beitrag mit Titel und Rücklink; der andere bleibt Kennung ohne Titel.
    const link = zelle(4, "audit.detail.targetObject").querySelector("a[data-audit-objektlink]");
    expect(link?.getAttribute("href")).toBe("/wissen/ko-1");
    expect(text(link)).toBe(TITEL);
    expect(zelle(3, "audit.detail.targetObject").querySelector("a")).toBeNull();
    expect(text(zelle(3, "audit.detail.targetObject"))).toBe("ko-2");
    // Eine Zeile hat außer dem Rücklink und dem Aufklapper keine Bedienelemente.
    expect(eintragsZeile(3).querySelectorAll("button, input, select, a")).toHaveLength(0);
  });
});

describe("K4 · Filter kombinieren, Rückweg aus dem Beitrag, lesbare Leere, verständlicher Fehler", () => {
  it("vier Filter in EINER Anfrage; aus dem Beitrag zurück stehen Filter und Anfrage wieder da", async () => {
    await mount(PROTOKOLL_URL);
    expect(seiteMock.mock.calls[0]?.[0]).toEqual({});

    await setze("pruefprotokoll-filter-person", "u-anna-1");
    await setze("pruefprotokoll-filter-aktion", "ko.revised");
    await setze("pruefprotokoll-filter-ziel", "ko-1");
    await setze("pruefprotokoll-filter-von", "2026-10-01");
    await setze("pruefprotokoll-filter-bis", "2026-10-08");
    await klick(knopf(i18n.t("auditprotokoll.filter.anwenden")), "Filter anwenden");

    const erwartet = {
      actor: "u-anna-1",
      action: "ko.revised",
      target: "ko-1",
      from: new Date(2026, 9, 1).toISOString(),
      to: new Date(2026, 9, 9).toISOString(),
    };
    expect(seiteMock.mock.calls.at(-1)?.[0]).toEqual(erwartet);
    // Die Filter stehen in der Adresse — neben Bereich und Karte, ohne sie zu verdrängen.
    const adresse = new URLSearchParams(ort().split("?")[1] ?? "");
    expect(adresse.get("detail")).toBe("protokoll");
    expect(adresse.get("a_person")).toBe("u-anna-1");
    expect(adresse.get("a_aktion")).toBe("ko.revised");
    expect(adresse.get("a_ziel")).toBe("ko-1");
    expect(adresse.get("a_von")).toBe("2026-10-01");
    expect(adresse.get("a_bis")).toBe("2026-10-08");

    // In den Beitrag springen …
    await klick(container.querySelector('a[data-audit-objektlink="ko-1"]'), "Rücklink");
    expect(ort()).toBe("/wissen/ko-1");
    // … und zurück: dieselbe Adresse, dieselben Feldwerte, dieselbe Anfrage.
    await klick(container.querySelector('[data-testid="beitrag-zurueck"]'), "Zurück");
    expect(new URLSearchParams(ort().split("?")[1] ?? "").get("a_person")).toBe("u-anna-1");
    const person = container.querySelector("#pruefprotokoll-filter-person") as HTMLSelectElement;
    expect(person.value).toBe("u-anna-1");
    const bis = container.querySelector("#pruefprotokoll-filter-bis") as HTMLInputElement;
    expect(bis.value).toBe("2026-10-08");
    expect(seiteMock.mock.calls.at(-1)?.[0]).toEqual(erwartet);
  });

  it("ein Filter ohne Treffer sagt das lesbar und bietet den Ausweg „Filter zurücksetzen“", async () => {
    await mount(`${PROTOKOLL_URL}&a_person=u-niemand`);
    expect(container.querySelector("[data-audit-eintrag]")).toBeNull();
    expect(text(container.querySelector('[data-audit-leer="gefiltert"]'))).toContain(
      i18n.t("auditprotokoll.leer.gefiltert"),
    );
    const zuruecksetzen = [...container.querySelectorAll('[data-audit-leer="gefiltert"] button')];
    await klick(zuruecksetzen[0], "Filter zurücksetzen");
    expect(ort()).not.toContain("a_person");
    expect(container.querySelectorAll("[data-audit-eintrag]").length).toBe(PROTOKOLL.length);
  });

  it("ein verkehrter Zeitraum ist ein verständlicher Fehler am Feld — und kein Abruf", async () => {
    await mount(PROTOKOLL_URL);
    const vorher = seiteMock.mock.calls.length;
    await setze("pruefprotokoll-filter-von", "2026-10-09");
    await setze("pruefprotokoll-filter-bis", "2026-10-01");
    await klick(knopf(i18n.t("auditprotokoll.filter.anwenden")), "Filter anwenden");
    const fehler = container.querySelector('[role="alert"]');
    expect(text(fehler)).toBe(i18n.t("auditprotokoll.filter.zeitraumFalsch"));
    const bis = container.querySelector("#pruefprotokoll-filter-bis");
    expect(bis?.getAttribute("aria-invalid")).toBe("true");
    expect(bis?.getAttribute("aria-describedby")).toBe(fehler?.id);
    expect(seiteMock.mock.calls.length).toBe(vorher);
    expect(ort()).not.toContain("a_von");
  });

  it("jedes Filterfeld hat eine sichtbare Beschriftung (Tastatur und Bildschirmleser)", async () => {
    await mount(PROTOKOLL_URL);
    for (const feld of ["person", "aktion", "ziel", "von", "bis"]) {
      const el = container.querySelector(`#pruefprotokoll-filter-${feld}`);
      expect(el, feld).not.toBeNull();
      const beschriftung = el?.closest("label");
      expect(text(beschriftung).length, feld).toBeGreaterThan(text(el).length);
      expect(el?.getAttribute("tabindex"), feld).toBeNull();
    }
    // Die Vorschläge nennen Personen und Vorgänge — keine Objekttitel.
    const vorschlaege = [...container.querySelectorAll("[data-audit-filter] option")].map(text);
    expect(vorschlaege.join(" ")).not.toContain(TITEL);
  });
});

describe("K6 · ein Haken nur mit Prüfzeitpunkt", () => {
  it("mit Zeitpunkt: Haken und gelesene Zeit; ohne Zeitpunkt: kein Haken", async () => {
    lage.verify = { ok: true, count: 4, checkedAt: "2026-10-09T08:00:00.000Z" };
    await mount(PROTOKOLL_URL);
    await klick(knopf(i18n.t("adm.sich.verify.button")), "Integrität prüfen");
    const gruen = container.querySelector('[data-testid="audit-verify-result"]');
    expect(gruen?.getAttribute("data-tone")).toBe("ok");
    expect(text(gruen)).toContain("✓");
    expect(text(gruen)).toMatch(/\d{2}:\d{2}:\d{2}/);
    act(() => root.unmount());
    container.remove();

    lage.verify = { ok: true, count: 4 };
    await mount(PROTOKOLL_URL);
    await klick(knopf(i18n.t("adm.sich.verify.button")), "Integrität prüfen");
    const ohne = container.querySelector('[data-testid="audit-verify-result"]');
    expect(ohne?.getAttribute("data-tone")).toBe("warn");
    expect(text(ohne)).not.toContain("✓");
    expect(text(ohne)).toBe(i18n.t("auditprotokoll.pruefung.ohneZeitpunkt"));
  });
});

describe("Die knappe Auth-Ansicht nutzt dieselbe Darstellung", () => {
  it("nur Kontoereignisse, am Server gefiltert; Vorgang beim Namen, Rohwert in den Details", async () => {
    seiteMock.mockImplementation(async () => seite([PROTOKOLL[2]]));
    await mount("/admin?bereich=sicherheit&detail=audit");
    expect(seiteMock.mock.calls[0]?.[0]).toEqual({ actions: KONTO_AUDIT_AKTIONEN });
    expect(container.querySelector('[data-testid="detail-audit"]')).not.toBeNull();
    expect(text(zelle(2, "audit.detail.event"))).toBe(i18n.t("audit.action.auth_login"));
    expect(text(zelle(2, "audit.detail.actor"))).toContain("Ben Beispiel");
    expect(spaltentext()).not.toContain("auth.login");
    expect(text(eintragsZeile(2).querySelector('[data-audit-kennung="action"]'))).toBe(
      "auth.login",
    );
    // Die Vorgangsauswahl bietet nur Kontoereignisse an.
    const optionen = container.querySelectorAll<HTMLOptionElement>("#audit-filter-aktion option");
    const aktionen = [...optionen].map((o) => o.value).filter((a) => a !== "");
    expect(aktionen).toEqual([...KONTO_AUDIT_AKTIONEN]);
  });
});
