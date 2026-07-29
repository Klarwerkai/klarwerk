// @vitest-environment jsdom
// AUFTRAG-mega47 Block B → AUFTRAG-mega48 Block B — DER SAMMLER FÜR MODALE FLÄCHEN.
//
// DIE GESCHICHTE DIESER DATEI, ehrlich, weil sie die Bauform erklärt:
//
//  · sammel44 (ben, ROT): das mobile Filterblatt lag in seinem EIGENEN inerten Hintergrund. `pageRef`
//    umfasste die komplette Seite EINSCHLIESSLICH des FacetFilter; beim Öffnen wurde genau dieser
//    Root inert — Dialog, Hintergrundfläche, Schließen-Knopf und alle Filter lagen im selben
//    Teilbaum. `position: fixed` ändert nur die Darstellung, nicht die DOM-Abstammung; `inert` gilt
//    für den GANZEN Teilbaum. Im echten Browser war das Blatt weder bedienbar noch schließbar.
//
//  · mega47 hat das repariert und diesen Sammler gebaut. Er erhob Flächen über die Zeichenfolge
//    `backgroundRef={`.
//
//  · sammel45 (ben, ROT): genau daran ist er gescheitert. `ImportSelect` bindet `FacetFilter` ein und
//    LÄSST DEN PROP WEG — eine produktiv erreichbare dritte Fläche, die in der Erhebung schlicht
//    nicht vorkam und deren `aria-modal="true"` reine Behauptung war. Ein Sammler, der nur findet,
//    was sich freiwillig meldet, ist kein Sammler.
//
// DESHALB ERHEBT ER JETZT AUFRUFER STATT FREIWILLIGE. Die Modalgrenze ist seit mega48 nicht mehr ein
// Prop, den man vergessen kann, sondern ein Kontext, den eine modale Fläche HOLT
// (`app/ModalBoundaryContext.tsx`). Daran hängt die Erhebung — in zwei Stufen, beide über den
// Quellbaum und keine über eine Liste der heutigen Fälle:
//
//   (1) DIE BAUTEILE: jede Quelldatei, die `aria-modal` setzt — also App-Modalität BEHAUPTET. Das
//       ist bewusst der Anker: er hängt nicht daran, ob jemand die Grenze auch benutzt, sondern an
//       der Behauptung selbst. Jede solche Datei MUSS die eine Modalgrenze benutzen
//       (`useModalBoundary`); eine zweite, selbstgebaute Bauform ist damit rot, statt unsichtbar zu
//       sein. Aus der Datei werden die EXPORTIERTEN Komponenten gelesen (heute `FacetFilter`,
//       `MobileNavDrawer`).
//   (2) DIE AUFRUFER: jede Quelldatei, die eines dieser Bauteile im JSX EINBINDET. Weglassen kann
//       man hier nichts mehr: wer das Bauteil benutzt, steht im Fund — mit oder ohne Props.
//
// Jedes Paar (Aufrufer × Bauteil) MUSS unten einen gemounteten Fall haben, und zwar an der ECHTEN
// Verdrahtung: die Seite in der echten AppShell. Ein vierter Aufrufer, der morgen dazukommt, ist rot,
// bis er hier steht. Die Gegenrichtung gilt auch — ein Fall ohne Fundstelle ist ebenfalls rot.
//
// JE FALL WIRD BEIDES VERLANGT (mega48 B2):
//   a) der geöffnete Dialog hat KEINEN `[inert]`-Vorfahren, und
//   b) der GESAMTE übrige Bedienbereich der App ist gesperrt — Auslöser, Filterschiene, Topbar,
//      Klara, Toasts und Command Palette eingeschlossen. Der Seiteninhalt allein genügt nicht mehr;
//      genau daran ist mega47 gescheitert.
//
// BENANNTE BLINDHEIT DIESER ERHEBUNG (es gibt sie immer; verschwiegen wird sie zur Falle):
//   · Sie sieht nur, was im JSX beim Namen genannt wird. Ein Bauteil, das über eine Variable
//     (`const C = FacetFilter; <C/>`), über `createElement(FacetFilter, …)` oder aus einer
//     Wrapper-Komponente heraus eingebunden wird, fällt durch. Die Wrapper-Komponente selbst wäre
//     allerdings wieder ein Fund, sobald sie das Bauteil im JSX nennt — die Kette bricht erst bei
//     bewusster Indirektion.
//   · Sie kennt nur Bauteile, die `aria-modal` im Quelltext SETZEN. Eine Fläche, die Modalität auf
//     einem anderen Weg herstellt, fällt durch: `apps/web/src/components/Modal.tsx` (der
//     Navigations-Wächter-Dialog und viele andere) trägt bewusst weder `role="dialog"` noch
//     `aria-modal` und ist deshalb kein Fund — er ist damit aber auch NICHT gegen die Shell
//     abgegrenzt. `BodyImageGallery` benutzt das native `showModal()`, das seine Modalität vom
//     Browser bekommt (Top-Layer statt `inert`). Beide sind NICHT Gegenstand dieses Auftrags; sie
//     sind eine eigene Scheibe, und sie sind hier ausdrücklich benannt, damit niemand die grüne
//     Farbe dieser Datei für „alle Dialoge sind abgegrenzt" hält.
//   · Ein `aria-modal`, das über eine Variable oder ein Spread-Objekt in den Dialog kommt, fällt
//     ebenfalls durch das Muster.
//   · jsdom setzt `inert` nicht nativ durch. Belegbar ist hier die STRUKTUR (DOM-Abstammung), nicht
//     die WIRKUNG. Dass ein gesperrter Bereich im echten Browser wirklich tot und ein nicht
//     gesperrter Dialog wirklich bedienbar ist, belegt `tests-smoke/ui-smoke.spec.ts`.
//   · Reine Zeiger-Bedienbarkeit (`pointer-events`, Überdeckung) ist nicht Gegenstand; sie hängt am
//     Browser-Verhalten von `inert`, nicht an der Struktur.
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // Bewusst NICHT „admin": die Topbar stellt für Admins zusätzlich die Reasoner-Konfiguration und
    // würde an der leeren Antwort der stillgelegten HTTP-Grenze scheitern. Die Rolle ist für die
    // Frage dieses Sammlers ohne Belang.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Die HTTP-Grenze vollständig stillgelegt: jeder Endpunkt liefert eine leere Liste — AUSSER den
// wenigen, die eine Fläche überhaupt erst entstehen lassen. `ImportSelect` zeigt seine Filterschiene
// erst nach einer Vorschau mit Treffern; ohne Antwort gäbe es dort nichts zu prüfen.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const ANTWORTEN: Record<string, unknown> = {
    "admin.import.select": {
      matched: 2,
      limited: false,
      truncated: false,
      criteria: { themes: ["Wartung"] },
      preview: [
        { id: "a", title: "Pumpe A", hasImage: false, themes: ["Wartung"] },
        { id: "b", title: "Ventil B", hasImage: false, themes: ["Instandhaltung"] },
      ],
    },
    "reasoner.status": { active: false, mode: "deterministic" },
  };
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => ANTWORTEN[pfad] ?? []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
import { ImportSelect } from "../../apps/web/src/components/ImportSelect";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";
import { Validation } from "../../apps/web/src/pages/Validation";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ---------------------------------------------------------------------------------------------
// (1) Die Erhebung: der Quellbaum, nicht eine Liste.
// ---------------------------------------------------------------------------------------------

const WURZEL = join(__dirname, "..", "..");
const WEB_SRC = join("apps", "web", "src");
const GRENZE_MODUL = "apps/web/src/app/ModalBoundaryContext.tsx";

// Derselbe Fokus-Selektor wie in `apps/web/src/lib/focusables.ts` — bewusst gespiegelt: weicht er im
// Produktcode still auf, fällt es hier auf.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

// Kommentare zählen nicht: dieser Sammler beschreibt seine eigene Bauform ausführlich in Prosa, und
// eine Erwähnung ist keine Verdrahtung.
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

interface Fund {
  datei: string;
  quelle: string;
}

const ALLE_QUELLEN: Fund[] = quelldateien(WEB_SRC).map((datei) => ({
  datei: posix(datei),
  quelle: ohneKommentare(readFileSync(join(WURZEL, datei), "utf8")),
}));

// Ein modales BAUTEIL behauptet App-Modalität …
const MODAL_MUSTER = /aria-modal\s*=/;
// … und muss dafür die EINE Modalgrenze der Shell benutzen.
const GRENZE_MUSTER = /useModalBoundary\s*\(/;
// Eine exportierte Komponente ist das, was ein Aufrufer einbinden kann.
const EXPORT_MUSTER = /export function ([A-Z]\w*)/g;
// Ein AUFRUFER nennt das Bauteil im JSX beim Namen.
function einbindeMuster(komponente: string): RegExp {
  return new RegExp(`<\\s*${komponente}[\\s/>]`);
}

interface Bauteil {
  datei: string;
  komponente: string;
}

const BAUTEIL_DATEIEN: Fund[] = ALLE_QUELLEN.filter(
  (f) => f.datei !== GRENZE_MODUL && MODAL_MUSTER.test(f.quelle),
);

const BAUTEILE: Bauteil[] = BAUTEIL_DATEIEN.flatMap((f) =>
  [...f.quelle.matchAll(EXPORT_MUSTER)].map((m) => ({
    datei: f.datei,
    komponente: m[1] as string,
  })),
);

interface Paar {
  einbinder: string;
  bauteil: string;
}

const ERWARTETE_PAARE: Paar[] = BAUTEILE.flatMap((b) =>
  ALLE_QUELLEN.filter(
    (f) => f.datei !== b.datei && einbindeMuster(b.komponente).test(f.quelle),
  ).map((f) => ({ einbinder: f.datei, bauteil: b.komponente })),
);

function schluessel(p: Paar): string {
  return `${p.einbinder} → <${p.bauteil}>`;
}

// ---------------------------------------------------------------------------------------------
// (2) Die gemounteten Fälle — einer je Paar, an der ECHTEN Verdrahtung (Seite IN der echten Shell).
// ---------------------------------------------------------------------------------------------

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let toastZapfhahn: ((kind: "info", text: string) => void) | null = null;

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

// Schmale Darstellung (≤899px, NARROW_QUERY): erst darunter gibt es überhaupt ein Filterblatt bzw.
// einen Navigations-Drawer.
function schmal(): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: true,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Ein Zapfhahn für echte Toasts: er hängt im echten ToastProvider, und was er auslöst, rendert der
// echte ToastViewport an seinem echten Platz in der Shell. Kein Nachbau der Toast-Fläche.
function ToastZapfhahn(): null {
  const { push } = useToast();
  useEffect(() => {
    toastZapfhahn = push;
    return () => {
      toastZapfhahn = null;
    };
  }, [push]);
  return null;
}

// Die ECHTE Shell mit der echten Provider-Kette — dieselbe Reihenfolge wie in App.tsx.
async function render(inhalt: unknown): Promise<void> {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/"] },
                  createElement(AppShell, null, inhalt as never, createElement(ToastZapfhahn)),
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
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

function knopfMitText(teil: string): HTMLElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(teil),
  );
  if (!(btn instanceof HTMLElement)) {
    throw new Error(`Knopf mit Text „${teil}“ nicht gefunden`);
  }
  return btn;
}

function knopfMitAria(label: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!el) {
    throw new Error(`Element mit aria-label „${label}“ nicht gefunden`);
  }
  return el;
}

function dialog(): HTMLElement | null {
  return container.querySelector<HTMLElement>("dialog[aria-modal='true']");
}

interface Fall extends Paar {
  name: string;
  mounten: () => Promise<void>;
  ausloeser: () => HTMLElement;
}

const FAELLE: Fall[] = [
  {
    einbinder: "apps/web/src/pages/Library.tsx",
    bauteil: "FacetFilter",
    name: "Bibliothek · Filterblatt",
    mounten: () => render(createElement(Library)),
    ausloeser: () => knopfMitText(i18n.t("facet.openFilters")),
  },
  {
    einbinder: "apps/web/src/pages/Validation.tsx",
    bauteil: "FacetFilter",
    name: "Validierung · Filterblatt",
    mounten: () => render(createElement(Validation)),
    ausloeser: () => knopfMitText(i18n.t("facet.openFilters")),
  },
  {
    // bens Ship-Blocker 2: DIESE Fläche existierte bereits produktiv und hatte gar keine Grenze.
    // Sie wird durch die zentrale Modalgrenze mitgeheilt — in `ImportSelect` steht dafür keine
    // einzige Zeile; deshalb steht sie hier auch nur als FALL, nicht als Verdrahtung.
    einbinder: "apps/web/src/components/ImportSelect.tsx",
    bauteil: "FacetFilter",
    name: "Import-Auswahl · Filterblatt",
    mounten: async () => {
      await render(createElement(ImportSelect, { chip: { themes: [], authors: [], spaces: [] } }));
      // Die Filterschiene entsteht erst nach einer Vorschau mit Treffern — das ist der produktive
      // Weg in diese Fläche.
      await klick(knopfMitText(i18n.t("imp.select.previewCta")));
    },
    ausloeser: () => knopfMitText(i18n.t("facet.openFilters")),
  },
  {
    einbinder: "apps/web/src/shell/AppShell.tsx",
    bauteil: "MobileNavDrawer",
    name: "Shell · Navigations-Drawer",
    mounten: () => render(createElement("div", null, "INHALT")),
    ausloeser: () => knopfMitAria(i18n.t("topbar.openMenu")),
  },
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  schmal();
});

afterEach(() => {
  // Die reinen Erhebungs-Tests mounten nichts — nur abbauen, was wirklich steht.
  if (root) {
    act(() => root.unmount());
    container.remove();
  }
  root = undefined as unknown as ReturnType<typeof createRoot>;
  toastZapfhahn = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("mega48 Block B: die Erhebung greift", () => {
  it("der Quellbaum wird wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    expect(ALLE_QUELLEN.length).toBeGreaterThan(100);
    // Positiv-Sonde: die zwei heute bekannten modalen Bauteile müssen im Fund liegen …
    const komponenten = BAUTEILE.map((b) => b.komponente);
    expect(komponenten).toContain("FacetFilter");
    expect(komponenten).toContain("MobileNavDrawer");
    // … das Grenz-Modul selbst ist KEIN Bauteil (sonst fände sich der Sammler selbst) …
    expect(BAUTEILE.map((b) => b.datei)).not.toContain(GRENZE_MODUL);
    // … und Negativ-Sonde: eine beliebige unbeteiligte Datei darf nicht drin sein.
    expect(BAUTEILE.map((b) => b.datei)).not.toContain("apps/web/src/lib/facetRail.ts");
    // Die Aufrufer-Stufe findet ebenfalls etwas — und zwar mehr als eine Datei.
    expect(ERWARTETE_PAARE.length).toBeGreaterThan(2);
  });

  it("DER FUND, an dem mega47 gescheitert ist: ein Aufrufer OHNE Prop wird trotzdem erhoben", () => {
    // `ImportSelect` bindet FacetFilter ein und hat NIE einen Hintergrund hereingereicht. Die alte
    // Erhebung über die Zeichenfolge `backgroundRef={` sah ihn deshalb nicht — und genau daran ist
    // die Zusage „eine dritte Seite wird automatisch rot" am heutigen Baum gescheitert.
    const importSelect = ALLE_QUELLEN.find(
      (f) => f.datei === "apps/web/src/components/ImportSelect.tsx",
    );
    expect(importSelect, "ImportSelect.tsx nicht gefunden").toBeDefined();
    expect(importSelect?.quelle).not.toMatch(/backgroundRef=\{/);
    expect(ERWARTETE_PAARE.map(schluessel)).toContain(
      "apps/web/src/components/ImportSelect.tsx → <FacetFilter>",
    );
  });

  it("die Muster erkennen die Bauform und nicht die Prosa darüber", () => {
    expect(MODAL_MUSTER.test('        aria-modal="true"')).toBe(true);
    expect(MODAL_MUSTER.test("aria-modalitaet")).toBe(false);
    expect(GRENZE_MUSTER.test("const { host, enter } = useModalBoundary();")).toBe(true);
    expect(GRENZE_MUSTER.test("useModalLocked()")).toBe(false);
    expect(einbindeMuster("FacetFilter").test("      <FacetFilter\n")).toBe(true);
    expect(einbindeMuster("FacetFilter").test("<FacetFilterZweiter ")).toBe(false);
    expect(einbindeMuster("FacetFilter").test('import { FacetFilter } from "./FacetFilter";')).toBe(
      false,
    );
    // Kommentare fallen vorher raus — sonst wäre dieser Sammler seine eigene Fundstelle.
    expect(ohneKommentare("// useModalBoundary()\nconst a = 1;")).not.toMatch(GRENZE_MUSTER);
  });
});

describe("mega48 Block B1: jeder Aufrufer einer modalen Fläche ist erfasst", () => {
  it("wer aria-modal behauptet, benutzt die EINE Modalgrenze (keine zweite Bauform)", () => {
    const ohneGrenze = BAUTEIL_DATEIEN.filter((f) => !GRENZE_MUSTER.test(f.quelle)).map(
      (f) => f.datei,
    );
    expect(
      ohneGrenze,
      `\nBehauptet App-Modalität (aria-modal), holt sich aber nicht die Modalgrenze der Shell:\n${ohneGrenze.join(
        "\n",
      )}\nEine Modalität, die nur behauptet wird, ist genau der Fehler, den mega48 schließt.\n`,
    ).toEqual([]);
  });

  it("kein Aufrufer ohne gemounteten Fall (ein vierter Aufrufer wird automatisch rot)", () => {
    const registriert = new Set(FAELLE.map(schluessel));
    const fehlend = ERWARTETE_PAARE.map(schluessel).filter((k) => !registriert.has(k));
    expect(
      fehlend,
      `\nBindet ein modales Bauteil ein, hat aber keinen Fall in diesem Sammler:\n${fehlend.join(
        "\n",
      )}\nEinen Fall in FAELLE ergänzen — sonst bleibt genau bens Ship-Blocker unbewacht.\n`,
    ).toEqual([]);
  });

  it("kein Fall ohne Fundstelle (veraltete Fälle sind ebenso rot)", () => {
    const erwartet = new Set(ERWARTETE_PAARE.map(schluessel));
    const veraltet = FAELLE.map(schluessel).filter((k) => !erwartet.has(k));
    expect(
      veraltet,
      `\nFall registriert, aber dort wird das Bauteil nicht mehr eingebunden:\n${veraltet.join(
        "\n",
      )}\n`,
    ).toEqual([]);
  });
});

describe.each(FAELLE)("mega48 Block B2 · $name", (fall) => {
  it("der geöffnete Dialog hat KEINEN [inert]-Vorfahren", async () => {
    await fall.mounten();
    await klick(fall.ausloeser());

    const d = dialog();
    expect(d, `${schluessel(fall)}: kein modaler Dialog nach dem Öffnen`).not.toBeNull();
    const inerterVorfahre = d?.closest("[inert]") ?? null;
    const wo = `<${inerterVorfahre?.tagName.toLowerCase()} class="${inerterVorfahre?.className}">`;
    expect(
      inerterVorfahre === null,
      `${schluessel(fall)}: der Dialog liegt IM gesperrten Teilbaum (${wo}). Im echten Browser ist er damit weder fokussierbar noch mit Maus oder Tastatur bedienbar und nicht zu schließen — die Seite steht.`,
    ).toBe(true);
  });

  it("gleichzeitig ist der GESAMTE übrige Bedienbereich der App gesperrt", async () => {
    await fall.mounten();
    const ausloeser = fall.ausloeser();
    await klick(ausloeser);

    const d = dialog();
    expect(d).not.toBeNull();

    // Der Auslöse-Knopf selbst: er ist Teil des Hintergrunds und muss mit gesperrt sein. Läge er
    // draußen, wäre die Modalität nur behauptet (ein zweites Blatt wäre öffenbar).
    expect(
      ausloeser.closest("[inert]") !== null,
      `${schluessel(fall)}: der Auslöse-Knopf liegt AUSSERHALB des gesperrten Bereichs.`,
    ).toBe(true);

    // Kalibrierung: die Shell steht wirklich mit ihren eigenen Flächen da — sonst prüfte der Rest
    // dieses Falls eine leere Menge und wäre grün, ohne etwas zu belegen.
    const klara = container.querySelector<HTMLElement>('[data-klara="1"]');
    expect(klara, "Klara fehlt in der gemounteten Shell").not.toBeNull();
    expect(
      klara?.closest("[inert]") !== null,
      `${schluessel(fall)}: KLARA ist bei offener Modalfläche erreichbar (bens Ship-Blocker 1).`,
    ).toBe(true);

    // Und der Sammler-Teil: JEDES fokussierbare Element liegt entweder im Dialog oder im gesperrten
    // Bereich — nicht nur die namentlich bekannten. Das fängt das Aufweichen ab, den Hintergrund
    // kleiner zu schneiden, damit der Dialog herausfällt.
    const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    expect(focusables.length, "es muss fokussierbare Elemente geben").toBeGreaterThan(0);
    const draussen = focusables.filter(
      (el) => !(d?.contains(el) ?? false) && el.closest("[inert]") === null,
    );
    expect(
      draussen.map((el) => `<${el.tagName.toLowerCase()} class="${el.className}">`),
      `\n${schluessel(fall)}: fokussierbar außerhalb von Dialog UND gesperrtem Bereich\n`,
    ).toEqual([]);
  });

  it("nach dem Schließen lebt der Hintergrund wieder (kein hängendes inert)", async () => {
    await fall.mounten();
    await klick(fall.ausloeser());
    expect(container.querySelector("[inert]")).not.toBeNull();

    const schliessen = container.querySelector<HTMLElement>(
      `dialog[aria-modal='true'] [aria-label="${i18n.t("facet.closeFilters")}"], dialog[aria-modal='true'] [aria-label="${i18n.t("topbar.closeMenu")}"]`,
    );
    expect(schliessen, `${schluessel(fall)}: kein Schließen-Knopf im Dialog`).not.toBeNull();
    if (schliessen) {
      await klick(schliessen);
    }

    expect(dialog()).toBeNull();
    expect(container.querySelector("[inert]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// (3) Die drei Shell-Flächen, die ben namentlich benannt hat — und die Paarung zweier Flächen.
// ---------------------------------------------------------------------------------------------

describe("mega48 Block B2: die von ben benannten Shell-Flächen sind bei offenem Blatt gesperrt", () => {
  async function blattOeffnen(): Promise<void> {
    await render(createElement(Library));
    await klick(knopfMitText(i18n.t("facet.openFilters")));
    expect(dialog()).not.toBeNull();
  }

  it("Klara und die Topbar liegen im gesperrten Bereich", async () => {
    await blattOeffnen();
    const klara = container.querySelector<HTMLElement>('[data-klara="1"]');
    expect(klara, "Klara fehlt in der gemounteten Shell").not.toBeNull();
    expect(klara?.closest("[inert]"), "Klara ist erreichbar").not.toBeNull();
    expect(knopfMitAria(i18n.t("topbar.openMenu")).closest("[inert]")).not.toBeNull();
  });

  it("eine Toast-Aktion entsteht IM gesperrten Bereich (sie lag auf z-[60] darüber)", async () => {
    await blattOeffnen();
    expect(toastZapfhahn, "Zapfhahn nicht im echten ToastProvider angemeldet").not.toBeNull();
    await act(async () => {
      toastZapfhahn?.("info", "PROBE-TOAST");
      await flush();
    });
    const schliessen = knopfMitAria(i18n.t("toast.dismiss"));
    expect(container.textContent).toContain("PROBE-TOAST");
    expect(
      schliessen.closest("[inert]"),
      "die Toast-Aktion ist bei offener Modalfläche erreichbar",
    ).not.toBeNull();
  });

  it("Cmd/Ctrl+K öffnet die Command Palette nicht (das Kürzel hängt am Fenster, nicht am DOM)", async () => {
    await blattOeffnen();
    const vorher = container.querySelectorAll("input").length;
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }),
      );
      await flush();
    });
    expect(
      container.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`),
      "die Command Palette ist über ihr globales Kürzel durch die Modalgrenze hindurch aufgegangen",
    ).toBeNull();
    expect(container.querySelectorAll("input").length).toBe(vorher);

    // Gegenprobe, damit dieser Test nicht deshalb grün ist, weil das Kürzel gar nicht mehr wirkt:
    // Blatt zu, gleiches Kürzel, und die Palette geht auf.
    await klick(knopfMitAria(i18n.t("facet.closeFilters")));
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }),
      );
      await flush();
    });
    expect(container.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`)).not.toBeNull();
  });
});

describe("mega48 Block A2: zwei Flächen nehmen sich die Grenze nicht mehr gegenseitig weg", () => {
  it("Blatt → Drawer → Drawer zu: die Sperre steht, der Fokus kehrt INS Blatt zurück", async () => {
    await render(createElement(Library));
    await klick(knopfMitText(i18n.t("facet.openFilters")));
    const blatt = container.querySelector<HTMLElement>(
      `dialog[aria-label="${i18n.t("facet.sheetTitle")}"]`,
    );
    expect(blatt).not.toBeNull();

    // ANMERKUNG ZUR REICHWEITE: im echten Browser ist dieser Weg nach mega48 gar nicht mehr
    // begehbar — der Hamburger liegt im gesperrten Bereich und ist nicht klickbar (das belegt
    // ui-smoke). jsdom setzt `inert` nicht durch, und genau deshalb lässt sich HIER prüfen, was der
    // Zähler tut, wenn zwei Flächen doch gleichzeitig offen sind.
    await klick(knopfMitAria(i18n.t("topbar.openMenu")));
    const drawer = container.querySelector<HTMLElement>(
      `dialog[aria-label="${i18n.t("topbar.menuLabel")}"]`,
    );
    expect(drawer, "der Drawer ist nicht aufgegangen").not.toBeNull();
    // Solange der Drawer oben liegt, ist auch das Blatt darunter gesperrt.
    expect(blatt?.hasAttribute("inert")).toBe(true);

    await klick(knopfMitAria(i18n.t("topbar.closeMenu")));

    // Der Drawer ist weg, das Blatt steht — und ist wieder bedienbar.
    expect(
      container.querySelector(`dialog[aria-label="${i18n.t("topbar.menuLabel")}"]`),
    ).toBeNull();
    expect(container.contains(blatt)).toBe(true);
    expect(blatt?.hasAttribute("inert")).toBe(false);
    expect(blatt?.closest("[inert]")).toBeNull();
    // Die Sperre BLEIBT — vor mega48 hätte der Drawer sie hier für das offene Blatt aufgehoben.
    expect(
      knopfMitText(i18n.t("facet.openFilters")).closest("[inert]"),
      "der Drawer hat dem noch offenen Blatt die Modalgrenze weggenommen",
    ).not.toBeNull();
    // Und der Fokus liegt im Blatt, nicht auf dem (gesperrten) Hamburger.
    expect(
      blatt?.contains(document.activeElement),
      `Fokus steht auf <${document.activeElement?.tagName.toLowerCase()}> statt im Filterblatt`,
    ).toBe(true);
  });
});
