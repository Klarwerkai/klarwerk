// @vitest-environment jsdom
// JOB 1110 D1 · Admin-Anteil von D-035 („Admin und Lebenszyklus zeigen erst den Bestand, dann das
// Formular", DESIGN_AN_CHEF/LIEFERUNG-20260814-BLOCK2.md :159-167).
//
// Der Befund am gebundenen Base-Stand b7f3da71: im Konten-Tab steht „Nutzer anlegen" VOR der
// Nutzerliste. Wer die Seite öffnet, wird von einem leeren Formular begrüßt statt von dem, was da
// ist. D-035 verlangt eine REINE Geschwister-Umordnung — Texte, Logik und Tabstruktur bleiben.
//
// Diese Klammer prüft deshalb vier Dinge am echten Produktpfad (gemountet, kein Quelltextlesen):
//   1 REIHENFOLGE — die Liste rendert vor dem Anlegeweg, mit Bestand und im Leerzustand.
//   2 VORHANDENSEIN — beide Blöcke sind noch da. Ohne diesen Fall wäre die Reihenfolgezusage durch
//     schlichtes Löschen des Formulars zu erfüllen; ein Test, der das durchgehen lässt, pinnt einen
//     Defekt grün.
//   3 LOGIK — der Anlegeweg verhält sich unverändert: leere Felder erzeugen den ehrlichen Grund und
//     KEINEN Request, gefüllte Felder rufen `users.create` mit genau den eingegebenen Werten.
//   4 TABSTRUKTUR — die Bereiche, „Konten" ist der Startbereich, ein Wechsel blendet beide Blöcke
//     aus und der Rückwechsel stellt dieselbe Reihenfolge wieder her.
//
// JOB 3065 H6 — DER ORT HAT SICH GEÄNDERT, DIE ZUSAGE NICHT. Seit dem Umbau auf den Pages-Maßstab
// ist der Bestand eine Zeilenkarte und das Anlegeformular liegt hinter dem Knopf „Nutzer
// hinzufügen" DARUNTER (Detailkarte). „Erst der Bestand, dann das Formular" gilt damit stärker als
// zuvor: das leere Formular begrüßt niemanden mehr, es wird bewusst geöffnet. Geprüft wird jetzt
// genau das — Liste vor Knopf, Formular vollständig hinter dem Knopf, Logik unverändert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSpy, usersData } = vi.hoisted(() => ({
  createSpy: vi.fn(async () => ({})),
  // Veränderlich, damit derselbe Mock den Bestands- und den Leerfall bedienen kann.
  usersData: { rows: [] as unknown[] },
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      // JOB 3065 R4: `demoStatus` fehlte hier und react-query meldete „No queryFn was passed" —
      // der Bestandswert der Zeile „Demodaten" lief also gegen `undefined` statt gegen eine Antwort.
      admin: {
        factoryResetStatus: ok({ pending: false }),
        demoStatus: ok({ present: false, count: 0 }),
      },
      features: { get: ok({ features: { demodaten: false } }) },
      users: {
        list: vi.fn(async () => usersData.rows),
        create: createSpy,
        approve: ok({}),
        setRole: ok({}),
        remove: ok({}),
        resetPassword: ok({}),
      },
      analytics: { overview: ok(null) },
      audit: { list: ok([]), verify: ok({ ok: true }) },
      validation: {
        board: ok([]),
        settings: ok({ defaultNeededValidations: 3 }),
        saveSettings: ok({}),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        assistPresets: ok([]),
      },
      ko: { trash: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      external: { policy: ok({ enabled: false }) },
      duplicates: { settings: ok({ minConfidence: 0.8 }) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BESTAND = [
  { id: "a1", name: "Anna Bestand", email: "anna@bestand.de", role: "experte", approved: true },
  { id: "b2", name: "Bodo Bestand", email: "bodo@bestand.de", role: "leser", approved: false },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/admin"] }, createElement(Admin)),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

/** Alle Elemente in DOKUMENTREIHENFOLGE — der Index ist damit die Position auf der Seite. */
function elemente(): Element[] {
  return [...container.querySelectorAll("*")];
}

const text = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * Position des ersten Elements, dessen EIGENER Text genau `wert` ist. Exakt statt `includes`, damit
 * nicht ein umschließender Container (Karte, Tab-Fläche) den Anker liefert und die Reihenfolge
 * dadurch zufällig richtig aussieht.
 */
function positionVon(wert: string, was: string): number {
  const i = elemente().findIndex((el) => text(el) === wert);
  if (i === -1) {
    throw new Error(`${was} („${wert}") steht nicht im DOM`);
  }
  return i;
}

function knopf(teil: string): HTMLButtonElement {
  const b = [...container.querySelectorAll("button")].find((el) => text(el).includes(teil));
  if (!(b instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return b;
}

async function klick(b: HTMLButtonElement): Promise<void> {
  await act(async () => {
    b.click();
    await flush();
  });
}

/** Das Eingabefeld einer `Field`-Beschriftung (ui.tsx: <label><span>Text</span><input/></label>). */
function feld(beschriftung: string): HTMLInputElement {
  const l = [...container.querySelectorAll("label")].find(
    (el) => text(el.querySelector("span") ?? el) === beschriftung,
  );
  const el = l?.querySelector("input");
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Feld „${beschriftung}" nicht gefunden`);
  }
  return el;
}

async function tippe(beschriftung: string, wert: string): Promise<void> {
  const el = feld(beschriftung);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, "value")?.set;
  setter?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const FORMULAR = () => i18n.t("adm.createTitle");
const HINZUFUEGEN = () => i18n.t("einst.konten.hinzufuegen");
const LEER = () => i18n.t("einst.konten.leer");

/** Den Anlegeweg öffnen — er liegt seit JOB 3065 hinter dem Knopf unter der Liste. */
async function oeffneAnlegen(): Promise<void> {
  await klick(knopf(HINZUFUEGEN()));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  usersData.rows = [...BESTAND];
  createSpy.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 1110 D1 · Konten-Tab: erst der Bestand, dann das Formular", () => {
  it("1 REIHENFOLGE · die Nutzerliste steht vor dem Anlegeweg", async () => {
    await mount();
    const ersterNutzer = positionVon("Anna Bestand", "erste Nutzerzeile");
    const anlegen = positionVon(HINZUFUEGEN(), "Knopf zum Anlegen");
    expect(ersterNutzer).toBeLessThan(anlegen);
  });

  it("1 REIHENFOLGE · auch der Leerzustand steht vor dem Anlegeweg", async () => {
    usersData.rows = [];
    await mount();
    const leer = positionVon(LEER(), "Leerzustand der Liste");
    const anlegen = positionVon(HINZUFUEGEN(), "Knopf zum Anlegen");
    expect(leer).toBeLessThan(anlegen);
  });

  it("2 VORHANDENSEIN · beide Blöcke sind vollständig da (Umordnung, keine Streichung)", async () => {
    await mount();
    // Der Bestand: beide Nutzer als Zeile mit Namen und ihrer Rolle als Wert.
    for (const u of BESTAND) {
      expect(container.textContent).toContain(u.name);
    }
    // Der noch nicht Freigegebene sagt es im Wert; die Freigabe selbst liegt in seiner Detailkarte.
    expect(container.textContent).toContain(i18n.t("einst.konten.wartet"));
    const bodo = [...container.querySelectorAll("button")].find(
      (b) => text(b.querySelector("span") ?? b) === "Bodo Bestand",
    );
    expect(bodo, "Zeile des nicht freigegebenen Nutzers").toBeInstanceOf(HTMLButtonElement);
    await klick(bodo as HTMLButtonElement);
    // Erst in der Detailkarte: E-Mail und die Freigabe.
    expect(container.textContent).toContain("bodo@bestand.de");
    expect(knopf(i18n.t("adm.approve"))).toBeInstanceOf(HTMLButtonElement);

    // Das Formular hinter dem Knopf: Überschrift, alle fünf Eingaben und der Anlegen-Knopf.
    // Die Überschrift gehört ausdrücklich hierher: Gegenmutation G2 (Titel auf einen anderen
    // i18n-Schlüssel gelegt) ließ diesen Fall sonst grün, obwohl der Text der Fläche sich geändert
    // hatte — die Reihenfolgefälle allein sind dafür der falsche Wächter.
    await mount();
    await oeffneAnlegen();
    expect(positionVon(FORMULAR(), "Überschrift des Anlegeformulars")).toBeGreaterThan(0);
    for (const b of [
      i18n.t("adm.name"),
      i18n.t("adm.email"),
      i18n.t("adm.password"),
      i18n.t("adm.newPasswordRepeat"),
    ]) {
      expect(feld(b)).toBeInstanceOf(HTMLInputElement);
    }
    expect(positionVon(i18n.t("adm.role"), "Rollen-Beschriftung")).toBeGreaterThan(0);
    expect(knopf(i18n.t("adm.create"))).toBeInstanceOf(HTMLButtonElement);
  });

  it("3 LOGIK · leere Felder lösen KEINEN Request aus, und der Grund steht NICHT im Sichtfeld", async () => {
    await mount();
    await oeffneAnlegen();
    // SCRUM-463: der Knopf bleibt bedienbar und sagt ehrlich, was fehlt — als Meldung mit den
    // fehlenden Feldern beim Namen (`adm.createInvalid` + `adm.field.*`, von der AppShell
    // gerendert und hier nicht gemountet), NICHT als stehender Absatz.
    //
    // JOB 3065 R2 (BENs Korrekturpflicht 1): Bis Runde 1 verlangte dieser Fall genau den Absatz,
    // den Lieferung 9 verbietet — `adm.createHint` ist ein VERLEGTER Hilfetext und gehört ins
    // „?"-Menü dieser Karte. Der Test pinnt jetzt beides: kein Hinweis im Sichtfeld, kein Request.
    expect(container.textContent).not.toContain(i18n.t("adm.createHint"));
    await klick(knopf(i18n.t("adm.create")));
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("3 LOGIK · der verlegte Hinweis lebt im „?“-Menü dieser Karte", async () => {
    await mount();
    await oeffneAnlegen();
    const hilfe = container.querySelector('[data-einst="hilfe"]');
    expect(hilfe, "die Anlegekarte hat kein „?“-Menü").toBeInstanceOf(HTMLButtonElement);
    // Vor dem Klick: nichts. Nach dem Klick: der Text wörtlich.
    expect(container.querySelector('[data-einst="hilfemenue"]')).toBeNull();
    await klick(hilfe as HTMLButtonElement);
    const menue = container.querySelector('[data-einst="hilfemenue"]');
    expect(menue?.textContent ?? "").toContain(i18n.t("adm.createHint"));
  });

  it("3 LOGIK · gefüllte Felder legen mit genau diesen Werten an", async () => {
    await mount();
    await oeffneAnlegen();
    await tippe(i18n.t("adm.name"), "Cara Neu");
    await tippe(i18n.t("adm.email"), "cara@neu.de");
    await tippe(i18n.t("adm.password"), "geheim12345");
    await tippe(i18n.t("adm.newPasswordRepeat"), "geheim12345");
    expect(container.textContent).not.toContain(i18n.t("adm.createHint"));
    await klick(knopf(i18n.t("adm.create")));
    expect(createSpy).toHaveBeenCalledWith("Cara Neu", "cara@neu.de", "geheim12345", "experte");
  });

  it("4 TABSTRUKTUR · vier Bereiche, Konten ist der Startbereich", async () => {
    await mount();
    // JOB 3065 H6: vier Reiter (Konten · KI · Daten · Sicherheit) — „Bereitschaft" ist seither eine
    // Zeile unter Sicherheit, kein eigener Bereich mehr.
    const tabs = [...container.querySelectorAll('button[data-einst="reiter"]')];
    expect(tabs).toHaveLength(4);
    const konten = tabs.find((b) => text(b) === i18n.t("adm.sec.konten"));
    expect(konten?.getAttribute("aria-pressed")).toBe("true");
  });

  it("4 TABSTRUKTUR · Wechsel blendet beide Blöcke aus, Rückwechsel erhält die Reihenfolge", async () => {
    await mount();
    await klick(knopf(i18n.t("adm.sec.ki")));
    expect(container.textContent).not.toContain(HINZUFUEGEN());
    expect(container.textContent).not.toContain("Anna Bestand");
    await klick(knopf(i18n.t("adm.sec.konten")));
    expect(positionVon("Anna Bestand", "erste Nutzerzeile")).toBeLessThan(
      positionVon(HINZUFUEGEN(), "Knopf zum Anlegen"),
    );
  });
});
