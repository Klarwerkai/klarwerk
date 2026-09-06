// @vitest-environment jsdom
// ================================================================================================
// JOB 3124 · UX-12 — DIE GESPERRTE SEITE SAGT SOFORT „DU BLEIBST ADMIN" UND TRÄGT DEN RÜCKWEG.
// ================================================================================================
//
// DER BEFUND: Ein Admin stellt in den Einstellungen die Ansicht auf „Betrachter" und landet auf
// `/admin` sofort auf der Sperrkarte (`routes.tsx` → `RoleNotice`). Dort stand bis JOB 3124 NUR,
// dass der Bereich einer anderen Rolle gehört — für den Lesenden nicht von „ich habe meine Rechte
// verloren" zu unterscheiden. Der Satz „du bleibst Admin" und der Rückweg steckten im Zahnrad-Menü,
// also hinter einem zusätzlichen Öffnen.
//
// GEMESSEN WIRD AN DER ECHTEN KETTE, nicht an einem Nachbau des Zustands: echter `AuthProvider` mit
// gemockter Sitzung → echter `RoleProvider` (`previewActive` entsteht dort und nirgends sonst) →
// Spiegel der Guard-Zeilen aus `routes.tsx` (per Quelltext-Pin unten ans Original gebunden;
// `routes.tsx` selbst importiert ALLE Seiten und darf laut mega61-rechtsseiten nicht in `tests/**`
// gezogen werden) → echtes `RoleNotice` → echtes `VorschauHinweis`.
//
// Die vier Zustände des Auftrags §9 stehen als V1/V2 (laufende Vorschau), V3 (echte
// Nicht-Admin-Sitzung) und V4 (Sitzungsabfrage noch offen). V5 hält den EINEN Rollennamen fest.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Die gemockte Sitzung. `haengt` = `/auth/me` antwortet nie (Auftrag §9 „laden"). */
const sitzung = vi.hoisted(() => ({ rolle: "admin" as string, haengt: false }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => {
      if (sitzung.haengt) {
        // Bewusst ohne Auflösung: genau das ist der Zustand „die Sitzung steht noch nicht".
        await new Promise(() => {});
      }
      return { id: "u1", name: "Anna Admin", email: "a@x.de", role: sitzung.rolle };
    }),
    logout: vi.fn(async () => ({})),
  },
}));

// Die Detailkarte „Ansicht als Rolle" hängt am Modul `api/endpoints` (Nutzerliste, Mutationen).
// Dieser Test misst das Rollen-Tor, nicht die Kontenverwaltung — die Fläche bekommt deshalb eine
// leere, ehrliche Kartei statt eines erfundenen Bestands.
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { users: { list: vi.fn(async () => []) } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import {
  ALL_ITEMS,
  HOME_ROUTE,
  type NavItem,
  ROLES,
  type Role,
  roleAllows,
} from "../../apps/web/src/app/navigation";
import { RoleNotice } from "../../apps/web/src/components/Stage2Notice";
import i18n from "../../apps/web/src/i18n";
import { AnsichtAlsRolleDetail } from "../../apps/web/src/pages/AdminKontenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die vorhandene Rollenquelle, kein nachgebautes Item: /admin verlangt `admin`. */
const ITEM = ALL_ITEMS.find((i) => i.id === "admin");
if (!ITEM || ITEM.minRole !== "admin") {
  throw new Error("Nav-Item admin fehlt oder verlangt nicht mehr admin");
}
const ADMIN_ITEM: NavItem = ITEM;

/**
 * Spiegel der Guard-Zeilen aus `routes.tsx`. Erlaubt rendert er die ECHTE Detailkarte „Ansicht als
 * Rolle" — genau die Fläche, die der Rollen-Guard dem Admin während der Vorschau wegnimmt. Sie ist
 * damit zugleich der Beleg „die Adminansicht ist zurück" (V2) und die Quelle des Rollennamens im
 * Auswahl-Raster (V5).
 */
function GuardedZiel(): JSX.Element {
  const { role } = useRole();
  if (!roleAllows(ADMIN_ITEM, role)) {
    return createElement(RoleNotice, { item: ADMIN_ITEM });
  }
  return createElement(AnsichtAlsRolleDetail, { onZurueck: () => {} });
}

/**
 * Setzt die Vorschau über DENSELBEN Haken, den die Einstellungen benutzen (`useRole().setRole`) —
 * und GENAU EINMAL. Ohne die Sperre liefe der Effekt nach jedem Rollenwechsel erneut und setzte die
 * Vorschau sofort wieder; der Rückweg wäre wirkungslos und der Test grün, obwohl er nichts mehr
 * misst. (Hausform aus `tests/app/h1-vorschau-rueckweg-mounted.test.tsx`.)
 */
function Vorschau({ rolle }: { rolle: Role | null }): null {
  const { setRole, isSessionRole } = useRole();
  const gesetzt = useRef(false);
  useEffect(() => {
    if (rolle !== null && isSessionRole && !gesetzt.current) {
      gesetzt.current = true;
      setRole(rolle);
    }
  }, [rolle, isSessionRole, setRole]);
  return null;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(rolle: Role | null): Promise<void> {
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
              createElement(
                MemoryRouter,
                { initialEntries: [ADMIN_ITEM.path] },
                createElement(Vorschau, { rolle }),
                createElement(
                  Routes,
                  null,
                  createElement(Route, {
                    path: ADMIN_ITEM.path,
                    element: createElement(GuardedZiel),
                  }),
                  createElement(Route, {
                    path: HOME_ROUTE,
                    element: createElement("div", null, "START-MARKER"),
                  }),
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

const text = (): string => container.textContent ?? "";
const knoepfe = (): HTMLButtonElement[] => [...container.querySelectorAll("button")];
const rueckweg = (): HTMLButtonElement | undefined =>
  knoepfe().find((b) => (b.textContent ?? "").trim() === i18n.t("role.backToAdmin"));

/** Der Code einer Datei ohne ihre Kommentare — Griff aus `tests/app/h6-bedienort-register.test.ts`. */
function ohneKommentare(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((z) => !/^\s*\/\//.test(z))
    .join("\n");
}

/** Der Vorschausatz, wie ihn die Fläche für diese Rolle zeigen MUSS. */
const vorschauSatz = (rolle: Role): string =>
  i18n.t("role.previewNote", { role: i18n.t(`role.name.${rolle}`) });

/**
 * DIE TASTATURPROBE — und was sie ehrlicherweise beweist.
 *
 * jsdom hat KEINE Aktivierungsmechanik: weder läuft `Tab` durch den Baum, noch erzeugt `Enter` auf
 * einem Knopf den Klick, den ein Browser dort erzeugt. Ein Test, der einfach `keydown` schickt und
 * dann grün ist, würde nichts messen — er wäre bei einem `<div onClick>` genauso grün.
 *
 * Diese Helfer bilden deshalb die BEDINGUNGEN des HTML-Standards nach, an denen es hängt, und
 * prüfen sie einzeln:
 *   `tabweg()`    — die Reihenfolge, in der ein Browser fokussiert: Elemente in Baumfolge, die von
 *                   sich aus fokussierbar sind (`button`, `a[href]`, Felder) und nicht `disabled`
 *                   oder `tabindex="-1"` tragen. Steht der Knopf nicht darin, ist er per Tab nicht
 *                   erreichbar.
 *   `ausloesen()` — die Aktivierung: `keydown` wird geschickt; wird sie nicht abgefangen UND ist
 *                   das Ziel ein Element MIT eingebautem Aktivierungsverhalten (`<button>`,
 *                   `<a href>`), erzeugt der Browser den Klick — und nur dann erzeugt ihn auch
 *                   diese Probe. Auf einem `<div onClick>` bleibt sie wirkungslos, der Test rot.
 * Bei Leertaste gilt dasselbe für `<button>` (bei `<a href>` nicht — deshalb die Fallunterscheidung).
 */
function tabweg(): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]",
    ),
  ].filter((el) => {
    if ((el as HTMLButtonElement).disabled) {
      return false;
    }
    const ti = el.getAttribute("tabindex");
    return ti === null || Number(ti) >= 0;
  });
}

async function ausloesen(el: HTMLElement, key: "Enter" | " "): Promise<void> {
  await act(async () => {
    const ereignis = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    const durchgelassen = el.dispatchEvent(ereignis);
    const tag = el.tagName.toLowerCase();
    const eingebauteAktivierung =
      tag === "button" || (tag === "a" && el.getAttribute("href") !== null && key === "Enter");
    if (durchgelassen && eingebauteAktivierung) {
      el.click();
    }
    await flush();
  });
}

beforeEach(async () => {
  sitzung.rolle = "admin";
  sitzung.haengt = false;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3124 UX-12 · die Sperrkarte erklärt die laufende Vorschau an Ort und Stelle", () => {
  it("V1 · Admin in der Vorschau als Betrachter auf /admin: Vorschausatz UND Rückweg-Knopf stehen auf der Karte", async () => {
    await mount("viewer");

    // Die Karte ist wirklich das Rollen-Tor (kein stiller Rückwurf, keine Seite).
    expect(text()).not.toContain("START-MARKER");
    expect(text()).toContain(i18n.t("role.gate.title"));

    // NEU: der Satz steht auf der Karte selbst, ohne dass ein Menü geöffnet werden müsste.
    expect(text(), "kein Vorschausatz auf der Sperrkarte").toContain(vorschauSatz("viewer"));
    expect(container.querySelector('[data-testid="sperrkarte-vorschau"]')).not.toBeNull();
    // … und der Rückweg gleich daneben.
    expect(rueckweg(), "kein Knopf „Zur Admin-Ansicht“ auf der Sperrkarte").toBeTruthy();
    // Der bestehende Weg zur Startseite bleibt daneben bestehen.
    expect([...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))).toContain(
      HOME_ROUTE,
    );
    expect(text()).toContain(i18n.t("stage2.gate.back"));
  });

  it("V2 · der Rückweg ist ein echter Knopf: per Tab erreichbar, mit Enter und Leertaste auslösbar — danach ist die Adminansicht da", async () => {
    await mount("viewer");
    const knopf = rueckweg();
    expect(knopf).toBeTruthy();
    if (!knopf) {
      return;
    }

    // (a) Ein echtes <button> — die Voraussetzung dafür, dass der Browser Enter und Leertaste
    //     überhaupt in eine Aktivierung übersetzt.
    expect(knopf.tagName.toLowerCase()).toBe("button");
    expect(knopf.getAttribute("type")).toBe("button");
    expect(knopf.hasAttribute("disabled")).toBe(false);

    // (b) Er steht in der Tabreihenfolge und nimmt den Fokus an.
    expect(tabweg(), "der Rückweg liegt nicht im Tabweg").toContain(knopf);
    await act(async () => {
      knopf.focus();
      await flush();
    });
    expect(document.activeElement).toBe(knopf);

    // (c) Leertaste zuerst — sie darf nicht die Ausnahme sein.
    await ausloesen(knopf, " ");
    expect(
      container.querySelector('[data-testid="detail-ansicht-rolle"]'),
      "Leertaste hat den Rückweg nicht ausgelöst",
    ).not.toBeNull();
  });

  it("V2b · Enter auf dem fokussierten Rückweg stellt die Adminansicht her und der Vorschausatz verschwindet", async () => {
    await mount("viewer");
    const knopf = rueckweg();
    expect(knopf).toBeTruthy();
    if (!knopf) {
      return;
    }
    await act(async () => {
      knopf.focus();
      await flush();
    });
    expect(document.activeElement).toBe(knopf);

    await ausloesen(knopf, "Enter");

    // Die zuvor gesperrte Seite ist da …
    expect(
      container.querySelector('[data-testid="detail-ansicht-rolle"]'),
      "nach Enter ist die Adminansicht nicht erschienen",
    ).not.toBeNull();
    // … die Sperrkarte und der Vorschausatz sind fort.
    expect(text()).not.toContain(i18n.t("role.gate.title"));
    expect(text()).not.toContain(vorschauSatz("viewer"));
    expect(container.querySelector('[data-testid="sperrkarte-vorschau"]')).toBeNull();
  });

  it("V3 · echte Betrachter-Sitzung (keine Vorschau): Sperrkarte OHNE Vorschausatz und OHNE Rückweg — die Rollen-Erklärung steht unverändert", async () => {
    sitzung.rolle = "viewer";
    await mount(null);

    // Die Erklärung ist vollständig da und wird durch nichts abgeschwächt.
    expect(text()).toContain(i18n.t("role.gate.title"));
    expect(text()).toContain(
      i18n.t("role.gate.body", {
        owner: i18n.t("role.name.admin"),
        own: i18n.t("role.name.viewer"),
      }),
    );
    // Aber keine Behauptung über eine Adminrolle, die diese Sitzung nicht hat.
    expect(text(), "Vorschausatz ohne laufende Vorschau").not.toContain(vorschauSatz("viewer"));
    expect(text()).not.toContain(i18n.t("role.backToAdmin"));
    expect(container.querySelector('[data-testid="sperrkarte-vorschau"]')).toBeNull();
    expect(rueckweg()).toBeUndefined();
  });

  it("V4 · die Sitzungsabfrage läuft noch (user === null): kein Vorschausatz, kein Rückweg — die Karte behauptet nichts", async () => {
    sitzung.haengt = true;
    await mount(null);

    // Der Beleg, dass wirklich KEINE Sitzung steht: die Karte nennt als eigene Rolle den
    // Dev-Rückfall `experte` aus RoleContext, nicht die (nie geladene) Adminrolle.
    expect(text()).toContain(i18n.t("role.gate.title"));
    expect(text()).toContain(
      i18n.t("role.gate.body", {
        owner: i18n.t("role.name.admin"),
        own: i18n.t("role.name.experte"),
      }),
    );
    for (const rolle of ROLES) {
      expect(text(), `Vorschausatz (${rolle}) bei ungeklärter Sitzung`).not.toContain(
        vorschauSatz(rolle),
      );
    }
    expect(text()).not.toContain(i18n.t("role.backToAdmin"));
    expect(container.querySelector('[data-testid="sperrkarte-vorschau"]')).toBeNull();
  });

  it("V5 · ein Name je Rolle: Auswahl-Raster, Vorschauhinweis und Sperrkarte nennen dieselbe Zeichenfolge", async () => {
    await mount("viewer");
    const name = i18n.t("role.name.viewer");
    const kurz = i18n.t("role.short.viewer");
    expect(name, "Kurzform und Name sind gleich — dieser Fall unterscheidet nichts").not.toBe(kurz);

    // Stelle 2 (Vorschauhinweis) und Stelle 3 (Sperrkarte) — beide auf der gesperrten Fläche.
    const karte = container.querySelector('[data-testid="sperrkarte-vorschau"]');
    expect((karte?.textContent ?? "").includes(name)).toBe(true);
    expect(text()).toContain(
      i18n.t("role.gate.body", { owner: i18n.t("role.name.admin"), own: name }),
    );
    expect(text(), "die Kurzform steht noch auf der Fläche").not.toContain(kurz);

    // Zurück in die Adminansicht — Stelle 1 (Auswahl-Raster).
    const knopf = rueckweg();
    expect(knopf).toBeTruthy();
    if (!knopf) {
      return;
    }
    await ausloesen(knopf, "Enter");
    const detail = container.querySelector('[data-testid="detail-ansicht-rolle"]');
    expect(detail).not.toBeNull();
    const rasterTexte = [...(detail?.querySelectorAll("button[aria-pressed]") ?? [])].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(rasterTexte).toEqual(ROLES.map((r) => i18n.t(`role.name.${r}`)));
    expect(rasterTexte).toContain(name);
    expect(rasterTexte).not.toContain(kurz);
  });

  it("V5b · Stelle 4 (die Übersichtszeile „Ansicht als Rolle“) benennt die Rolle mit demselben Schlüssel", () => {
    // `pages/Admin.tsx` ist NICHT Zielpfad dieses Auftrags — die vierte Stelle wird deshalb hier
    // festgehalten statt geändert: sie zeigte schon immer `role.name.*`, und dabei muss es bleiben.
    const admin = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Admin.tsx"), "utf8");
    expect(admin).toContain('testId="zeile-ansicht-rolle"');
    expect(admin).toMatch(/wert=\{previewActive \? t\(`role\.name\.\$\{role\}`\)/);
    expect(admin, "die Übersichtszeile ist auf die Kurzform zurückgefallen").not.toMatch(
      /role\.short\./,
    );
  });

  it("Quelltext-Pin: routes.tsx trägt genau die Gate-Logik, die dieser Test spiegelt", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    expect(src).toContain("if (!roleAllows(item, role)) {");
    expect(src).toContain("return <RoleNotice item={item} />;");
  });

  it("Quelltext-Pin: der Rückweg ist EIN Bauteil — Sperrkarte rendert, die Hülle ruft setRole", () => {
    const notice = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/Stage2Notice.tsx"),
      "utf8",
    );
    const vorschau = readFileSync(
      resolve(process.cwd(), "apps/web/src/shell/RollenVorschau.tsx"),
      "utf8",
    );
    // Die Karte rendert das Bauteil …
    expect(notice).toContain('VorschauHinweis flaeche="sperrkarte"');
    // … und schaltet die Rolle NICHT selbst um (sonst entstünde ein zweiter Bedienort).
    // Gezählt wird, was AUSGEFÜHRT wird: wo ein Bedienort NICHT steht, erklärt der Kommentar
    // daneben, warum — dieselbe Trennung wie in `tests/app/h6-bedienort-register.test.ts`.
    expect(ohneKommentare(notice)).not.toMatch(/(?<![.\w])setRole\(/);
    // Der eine Aufruf wohnt weiterhin in der Hülle (R4 des Bedienort-Registers).
    expect(vorschau).toMatch(/setRole\(["']admin["']\)/);
    // Und der Text existiert genau einmal: eine Stelle, an der `role.previewNote` gelesen wird.
    expect(vorschau.match(/role\.previewNote/g)?.length).toBe(1);
    expect(notice).not.toContain("role.previewNote");
  });
});
