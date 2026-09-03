// @vitest-environment jsdom
// ================================================================================================
// JOB 3029 — ERSTNUTZER-HÜRDE U1: DER UNTERSCHIED DER ZWEI KNÖPFE STEHT AUF DER FLÄCHE.
// ================================================================================================
//
// DER BEFUND (Natascha, Erstnutzerlauf, `OFFEN.md:124`): „nicht ersichtlich warum es die Trennung
// gibt … was mit dem Objekt danach möglich ist, blieb unklar." Die Auskunft EXISTIERT — dreisprachig
// und von Pedi abgenommen (`chelp.saveDraftHelp.*`, `chelp.submitReview.*`) — aber nur hinter einem
// Fragezeichen-Popover. Ein Popover erreicht nur, wer die Frage schon hat.
//
// GEMESSEN WIRD AN DER GEMOUNTETEN SEITE. Ein Test, der Zeichenketten in `i18n.ts` nachschlägt,
// bewiese, dass ein Satz existiert — nicht, dass ihn jemand sieht. Die drei Entscheidungsflächen
// werden deshalb EINZELN gefahren und einzeln beurteilt (U1(2), U1(3), U1(4)); nur der DOM-freie
// Vertrag U1(1) bleibt ohne Montage.
//
// SICHTBARKEIT STATT ANWESENHEIT (LEHREN JOB 3007 R2 Punkt 2, R4 Punkt 2): U1(5) misst die
// WIRKSAME Sichtbarkeit einschließlich unsichtbarer Vorfahren — `hidden`-Attribut, die Utilities
// `hidden`/`invisible`/`sr-only`/`opacity-0`, `display:none`, `visibility:hidden`, `opacity: 0`.
// Genau an dieser Trennung ist JOB 3007 viermal rot geworden.
//
// DIE DREI FLÄCHEN, MIT DEN ZEILEN DES AUFTRAGS. Der Auftrag benennt sie in Abschnitt 2; die
// Namen zweier Flächen sind dort vertauscht, die Zeilennummern stimmen. Gemessen wird nach den
// Zeilen, benannt nach dem tatsächlichen Zweig in `Capture.tsx`:
//   U1(2) Erzähl-Schritt des geführten Wegs      (`Capture.tsx:5573`, Zweig `expertView || wizStep === "tell"`)
//   U1(3) Entwurfskarte des Expertenwegs         (`Capture.tsx:5865`, Zweig `expertView`)
//   U1(4) Aktionsleiste des Schritts Wissensseite (`Capture.tsx:6243`, Zweig `!expertView && wizStep === "refine" && draft`)
//
// ZUR DATEIENDUNG `.tsx`: der Root-Typecheck ist Node-rein und schließt `tests/**/*.tsx` aus
// (`tsconfig.json:26`); gemountete Seiten sind dort nicht typisierbar. Die Datei läuft durch
// `tsconfig.tests-tsx.json` — ebenfalls im Tor.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: { list: ok([]) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({
          title: "Dosierventil bei Kaltstart vorwaermen",
          statement: "Nach Stillstand klemmt das Ventil DP-4 sporadisch.",
          conditions: ["Nach Wochenendstillstand"],
          measures: ["Ventil DP-4 vor dem Anfahren vorwaermen"],
          tags: ["ventil"],
        })),
      },
    },
  };
});

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
import { KNOPF_UNTERSCHIED } from "../../apps/web/src/components/KnopfUnterschied";
import i18n from "../../apps/web/src/i18n";
import { captureHelp } from "../../apps/web/src/lib/captureHelp";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
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
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
                  ),
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

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Der Sollwert kommt aus der Ressource, nicht aus `t()` — kein Fallback kann ihn stillschweigend ersetzen. */
const de = (key: string): string => String(i18n.getResource("de", "translation", key));

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

function knopfMitText(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    norm(b.textContent ?? "").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}“ nicht gefunden`);
  }
  return btn;
}

/** Klappt den Arbeitsraum auf — Zustand am `aria-expanded`, nicht an der Beschriftung. */
async function arbeitsraumOeffnen(): Promise<void> {
  const b = container.querySelector<HTMLButtonElement>('button[aria-controls="capture-workspace"]');
  if (!b) {
    throw new Error("Der Aufklapper des Arbeitsraums ist auf der gemounteten Seite nicht da.");
  }
  if (b.getAttribute("aria-expanded") !== "true") {
    await click(b);
  }
}

async function freitextTippen(value: string): Promise<void> {
  const ta = [...container.querySelectorAll("textarea")].find(
    (x) => x.placeholder === de("capture.rawPlaceholder"),
  );
  if (!(ta instanceof HTMLTextAreaElement)) {
    throw new Error("Freitext-Feld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta) as object, "value")?.set;
  setter?.call(ta, value);
  await act(async () => {
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

// ------------------------------------------------------------------------------------------------
// DIE DREI FLÄCHEN — jede stellt ihren Zustand selbst her.
// ------------------------------------------------------------------------------------------------

/** U1(2): geführter Weg, Erzähl-Schritt. Der Erstnutzerzustand, ohne jede Vorgeschichte. */
async function flaecheErzaehlSchritt(): Promise<void> {
  await mount();
  await arbeitsraumOeffnen();
}

/** U1(3): Expertenweg. Der Umschalter legt beim Wechsel den Entwurf an (`Capture.tsx:2222`). */
async function flaecheExpertenkarte(): Promise<void> {
  await mount();
  await arbeitsraumOeffnen();
  await click(knopfMitText(de("capture.entry.expertToggle")));
}

/** U1(4): geführter Weg, Schritt „Wissensseite" — dort stehen beide Knöpfe nebeneinander. */
async function flaecheWissensseite(): Promise<void> {
  await mount();
  await arbeitsraumOeffnen();
  await freitextTippen("Nach dem Wochenende klemmt das Dosierventil DP-4 beim Anfahren.");
  await click(knopfMitText(de("capture.structure")));
}

function bloecke(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="u1-knopfunterschied"]')];
}

function block(): HTMLElement {
  const alle = bloecke();
  if (alle.length !== 1) {
    throw new Error(`Erwartet genau ein u1-knopfunterschied, gefunden: ${alle.length}`);
  }
  return alle[0] as HTMLElement;
}

/**
 * Die Knopfgruppen dieser Fläche: das Elternelement jedes Knopfes, der „Als Entwurf speichern"
 * oder „Prüfen & einreichen" beschriftet ist. Schritt-Chips („1 · …") sind ausgenommen — sie
 * tragen dieselben Wörter, sind aber keine Entscheidung.
 */
function knopfgruppen(): HTMLElement[] {
  const beschriftungen = [de("capture.saveDraft"), de("capture.submit")];
  const gruppen: HTMLElement[] = [];
  for (const b of container.querySelectorAll("button")) {
    const text = norm(b.textContent ?? "");
    if (/^[123]\s*·/.test(text)) {
      continue;
    }
    if (!beschriftungen.some((l) => text.includes(l))) {
      continue;
    }
    const gruppe = b.parentElement;
    if (gruppe instanceof HTMLElement && !gruppen.includes(gruppe)) {
      gruppen.push(gruppe);
    }
  }
  return gruppen;
}

/** Abstand in Elternschritten vom Block bis zum gemeinsamen Vorfahren mit der Knopfgruppe. */
function naeheZu(gruppe: Element): number {
  let hoehe = 0;
  let el: Element | null = block();
  while (el && !el.contains(gruppe)) {
    el = el.parentElement;
    hoehe += 1;
  }
  return el ? hoehe : Number.POSITIVE_INFINITY;
}

/** Der normalisierte sichtbare Text EINES Eintrags. */
function eintragText(id: string): string {
  const el = container.querySelector<HTMLElement>(`[data-testid="u1-knopfunterschied-${id}"]`);
  if (!el) {
    throw new Error(`Eintrag u1-knopfunterschied-${id} fehlt`);
  }
  return norm(el.textContent ?? "");
}

// ------------------------------------------------------------------------------------------------
// WIRKSAME SICHTBARKEIT — Element UND Vorfahren.
// ------------------------------------------------------------------------------------------------
// In jsdom trägt keine Utility-Klasse eine berechnete Wirkung (es ist kein Stylesheet geladen).
// Deshalb wird BEIDES geprüft: die Klassen, mit denen in diesem Werk verborgen wird, UND die
// berechneten Werte, die ein Inline-Stil oder ein künftiges Stylesheet setzt. Wer nur eines von
// beidem prüft, hat eine Lücke, durch die genau die Verstellung aus Gegenprobe (b) passt.
const VERSTECK_UTILITIES = ["hidden", "invisible", "sr-only", "opacity-0"] as const;

function unsichtbarkeitsgrund(el: Element): string | null {
  let k: Element | null = el;
  while (k && k !== document.body) {
    if (k instanceof HTMLElement) {
      const wo = `<${k.tagName.toLowerCase()} class="${k.getAttribute("class") ?? ""}">`;
      if (k.hasAttribute("hidden")) {
        return `hidden-Attribut an ${wo}`;
      }
      if (k.getAttribute("aria-hidden") === "true") {
        return `aria-hidden="true" an ${wo}`;
      }
      const klassen = norm(k.getAttribute("class") ?? "").split(" ");
      const treffer = VERSTECK_UTILITIES.find((c) => klassen.includes(c));
      if (treffer) {
        return `Utility „${treffer}“ an ${wo}`;
      }
      const s = window.getComputedStyle(k);
      if (s.display === "none") {
        return `display:none an ${wo}`;
      }
      if (s.visibility === "hidden" || s.visibility === "collapse") {
        return `visibility:${s.visibility} an ${wo}`;
      }
      if (s.opacity !== "" && Number(s.opacity) === 0) {
        return `opacity:0 an ${wo}`;
      }
    }
    k = k.parentElement;
  }
  return null;
}

/**
 * Öffnet jedes Fragezeichen-Popover der Knopfgruppe und gibt den dabei sichtbar werdenden Text
 * zurück. Gemessen wird am GERENDERTEN Knoten, nicht am Quelltext — ein Popover, das erst auf
 * Klick etwas zeigt, ist sonst nicht messbar.
 */
async function popovertexte(gruppe: Element): Promise<string[]> {
  const raus: string[] = [];
  const knoepfe = [...gruppe.querySelectorAll("button")].filter(
    (b) => b.getAttribute("aria-label") === de("help.open"),
  );
  for (const b of knoepfe) {
    await click(b);
    raus.push(norm(gruppe.textContent ?? ""));
    await click(b);
  }
  return raus;
}

beforeEach(async () => {
  // U1(8): der Erstnutzerzustand wird HIER hergestellt (LEHREN JOB 3007 R3 Punkt 3) — kein
  // vorheriger Fall darf über `localStorage` einen eingeklappten Zustand hinterlassen.
  window.localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = undefined as unknown as ReturnType<typeof createRoot>;
  }
  container?.remove();
  vi.clearAllMocks();
});

// ================================================================================================
// U1(1) — DER VERTRAG, DOM-FREI
// ================================================================================================
describe("JOB 3029 · U1(1) — der Block bildet die zwei Knöpfe auf ihre Erklärungen ab", () => {
  it("Reihenfolge und Zuordnung: erst Entwurf, dann Einreichen", () => {
    expect(KNOPF_UNTERSCHIED.map((e) => e.id)).toEqual(["saveDraftHelp", "submitReview"]);
    expect(KNOPF_UNTERSCHIED.map((e) => e.knopfKey)).toEqual([
      "capture.saveDraft",
      "capture.submit",
    ]);
  });

  it("beide Themen liefern in de, en und nl einen echten Titel und Text — keinen Schlüsselnamen", () => {
    for (const lng of ["de", "en", "nl"] as const) {
      for (const eintrag of KNOPF_UNTERSCHIED) {
        const topic = captureHelp(eintrag.id);
        const titel = String(i18n.getResource(lng, "translation", topic.titleKey) ?? "");
        const text = String(i18n.getResource(lng, "translation", topic.bodyKey) ?? "");
        const knopf = String(i18n.getResource(lng, "translation", eintrag.knopfKey) ?? "");
        expect(titel, `${lng}:${topic.titleKey}`).not.toBe(topic.titleKey);
        expect(text, `${lng}:${topic.bodyKey}`).not.toBe(topic.bodyKey);
        expect(titel.trim().length, `${lng}:${topic.titleKey}`).toBeGreaterThan(3);
        expect(text.trim().length, `${lng}:${topic.bodyKey}`).toBeGreaterThan(120);
        // Der Knopf, zu dem die Erklärung gehört, muss in derselben Sprache beschriftet sein —
        // sonst erklärt der Block einen Knopf, den es auf dieser Sprache nicht gibt.
        expect(knopf, `${lng}:${eintrag.knopfKey}`).not.toBe(eintrag.knopfKey);
      }
    }
  });
});

// ================================================================================================
// U1(2)–U1(4) — DIE DREI FLÄCHEN, EINZELN GEMESSEN
// ================================================================================================
//
// UNABHÄNGIGE BEDEUTUNGSMERKMALE (LEHREN JOB 3007 R2 Punkt 1 und R3 Punkt 1, wörtlich:
// „gegen unabhängige Bedeutungsmerkmale statt dieselben veränderten i18n-Werte prüfen").
//
// Ein Fall, der seinen Sollwert aus DERSELBEN i18n-Quelle zieht wie die gemessene Fläche, ist
// gegen jede Textänderung blind: verfälscht man `chelp.submitReview.body`, wandern beide Seiten
// mit und der Fall bleibt grün. Genau daran ist JOB 3007 gescheitert. Deshalb stehen die drei
// TRAGENDEN Aussagen hier wörtlich — es sind die Sätze, deren Verlust Nataschas Befund
// (`OFFEN.md:124`) wiederherstellen würde: dass ein Entwurf NIEMAND sieht, dass Einreichen das
// Objekt für andere sichtbar macht, und dass es dabei NICHT als gesichert gilt.
//
// Das ist ein bewusster PIN auf den von Pedi abgenommenen deutschen Wortlaut (SCRUM-407). Wer
// diese Sätze ändert, muss hier vorbeikommen — das ist der Zweck, nicht der Preis.
const KERNAUSSAGEN: readonly string[] = [
  "Ein Entwurf ist NICHT eingereicht: Niemand sieht ihn",
  "Ab jetzt ist es für andere sichtbar",
  "NICHT als gesichert",
];

const FLAECHEN = [
  { fall: "U1(2)", name: "Erzähl-Schritt des geführten Wegs", herstellen: flaecheErzaehlSchritt },
  { fall: "U1(3)", name: "Entwurfskarte des Expertenwegs", herstellen: flaecheExpertenkarte },
  {
    fall: "U1(4)",
    name: "Aktionsleiste des Schritts Wissensseite",
    herstellen: flaecheWissensseite,
  },
] as const;

for (const flaeche of FLAECHEN) {
  describe(`JOB 3029 · ${flaeche.fall} — ${flaeche.name}`, () => {
    it("der sichtbare Text der Fläche trägt BEIDE Erklärungen wörtlich und vollständig", async () => {
      await flaeche.herstellen();
      // Vorbedingung: die Fläche trägt überhaupt eine Entscheidung. Ohne sie wäre ein grüner
      // Block eine Aussage über nichts.
      expect(
        knopfgruppen().length,
        "auf dieser Fläche steht kein Entscheidungsknopf",
      ).toBeGreaterThan(0);
      const text = norm(block().textContent ?? "");
      expect(text).toContain(norm(de("chelp.saveDraftHelp.body")));
      expect(text).toContain(norm(de("chelp.submitReview.body")));
      expect(text).toContain(norm(de("chelp.saveDraftHelp.title")));
      expect(text).toContain(norm(de("chelp.submitReview.title")));
      // Und dasselbe noch einmal gegen die unabhängigen Bedeutungsmerkmale — siehe den Kopf
      // dieses Abschnitts. Ohne sie wäre alles darüber ein i18n-Rundlauf.
      for (const satz of KERNAUSSAGEN) {
        expect(text, `die tragende Aussage „${satz}“ steht nicht auf der Fläche`).toContain(satz);
      }
    });

    // Gemessen wird die Nähe zur Knopfgruppe DIESER Einbaustelle: der Block steht unmittelbar
    // VOR ihr, als direkter Vorgänger im selben Elternknoten. Das ist zugleich die Zusicherung aus
    // Prüfpunkt 6(c) — er steht ÜBER der Leiste, nicht IN ihr, und zerreißt kein `flex flex-wrap`.
    //
    // Warum nicht „jede Knopfgruppe der Seite": im Expertenweg stehen die beiden Knöpfe in ZWEI
    // Karten (Entwurfskarte und Erzähl-Karte). Der Block steht dort einmal — an der Entwurfskarte —,
    // weil er sonst zweimal auf demselben Bildschirm stünde (U1(7)). Eine Forderung „nah an ALLEN
    // Gruppen" wäre mit U1(7) nicht gleichzeitig erfüllbar und damit keine ehrliche Zusage.
    it("er steht unmittelbar an einer Knopfgruppe — als deren direkter Vorgänger", async () => {
      await flaeche.herstellen();
      const gruppen = knopfgruppen();
      expect(gruppen.map((g) => naeheZu(g)).sort((a, b) => a - b)[0]).toBeLessThanOrEqual(1);
      expect(
        gruppen.some((g) => block().nextElementSibling === g),
        "der Block ist nicht der direkte Vorgänger einer Knopfgruppe — er steht entweder in der " +
          "Leiste oder irgendwo auf der Seite",
      ).toBe(true);
    });

    it("U1(5) · Block und beide Einträge sind WIRKSAM sichtbar — auch über die Vorfahren", async () => {
      await flaeche.herstellen();
      const knoten = [
        block(),
        ...KNOPF_UNTERSCHIED.map((e) => {
          const el = container.querySelector<HTMLElement>(
            `[data-testid="u1-knopfunterschied-${e.id}"]`,
          );
          if (!el) {
            throw new Error(`Eintrag u1-knopfunterschied-${e.id} fehlt`);
          }
          return el;
        }),
      ];
      for (const el of knoten) {
        expect(
          unsichtbarkeitsgrund(el),
          `${el.getAttribute("data-testid")} ist im DOM, aber nicht zu sehen`,
        ).toBeNull();
      }
    });

    it("U1(6) · an den Knopfgruppen führt kein Popover mehr dieselbe Auskunft", async () => {
      await flaeche.herstellen();
      for (const gruppe of knopfgruppen()) {
        for (const text of await popovertexte(gruppe)) {
          expect(
            text,
            "ein Fragezeichen-Popover an der Knopfgruppe zeigt weiterhin die Entwurfs-Erklärung",
          ).not.toContain(norm(de("chelp.saveDraftHelp.body")));
          expect(
            text,
            "ein Fragezeichen-Popover an der Knopfgruppe zeigt weiterhin die Einreich-Erklärung",
          ).not.toContain(norm(de("chelp.submitReview.body")));
        }
      }
    });

    it("U1(7) · genau EIN Block auf diesem Bildschirm", async () => {
      await flaeche.herstellen();
      expect(bloecke().length).toBe(1);
    });
  });
}

// ================================================================================================
// U1(8) — DER ERSTNUTZERZUSTAND, AUSDRÜCKLICH
// ================================================================================================
describe("JOB 3029 · U1(8) — der Block steht beim allerersten Besuch", () => {
  it("mit leerem localStorage ist der Block sofort da und vollständig", async () => {
    window.localStorage.clear();
    expect(window.localStorage.length, "der Fall stellt den Erstnutzerzustand nicht her").toBe(0);
    await flaecheErzaehlSchritt();
    expect(bloecke().length).toBe(1);
    const text = norm(block().textContent ?? "");
    expect(text).toContain(norm(de("chelp.saveDraftHelp.body")));
    expect(text).toContain(norm(de("chelp.submitReview.body")));
  });
});

// ================================================================================================
// U1(9) — ZUSTANDSMODELL: DER BLOCK WARTET AUF NICHTS
// ================================================================================================
// Auftrag Abschnitt 9: der Block trägt keine Aussage über Daten. Die Lage „erfolgreich leer"
// (frisches, leeres Formular, keine Entwürfe) ist der Regelfall von U1(2) und wird hier
// ausdrücklich als eigener Fall gemessen — samt der Zusicherung, dass er keinen Datenzustand nennt.
describe("JOB 3029 · U1(9) — Lage „erfolgreich leer“", () => {
  it("auf dem leeren Formular steht der Block unverändert und vollständig", async () => {
    await flaecheErzaehlSchritt();
    const eingabe = [...container.querySelectorAll("textarea")].find(
      (x) => x.placeholder === de("capture.rawPlaceholder"),
    );
    expect(eingabe?.value, "das Formular ist nicht leer — die Lage ist eine andere").toBe("");
    expect(bloecke().length).toBe(1);
  });

  // Lieferung 1: „Es entsteht kein einziger neuer Satz." Das ist eine GLEICHHEIT, keine Enthaltung:
  // gemessen wird der GESAMTE sichtbare Text des Blocks gegen genau Titel + Text der zwei Themen.
  // Ein zusätzlicher eigener Satz — auch ein gut gemeinter — lässt diesen Fall fallen.
  it("der Block sagt genau die zwei abgenommenen Erklärungen und sonst nichts", async () => {
    await flaecheErzaehlSchritt();
    const erwartet = KNOPF_UNTERSCHIED.map((e) => {
      const topic = captureHelp(e.id);
      return norm(`${de(topic.titleKey)} ${de(topic.bodyKey)}`);
    });
    expect(KNOPF_UNTERSCHIED.map((e) => eintragText(e.id))).toEqual(erwartet);
    expect(norm(block().textContent ?? "")).toBe(erwartet.join(""));
    expect(
      block().querySelectorAll("[data-testid^='u1-knopfunterschied-']").length,
      "der Block trägt mehr oder weniger als die zwei Einträge",
    ).toBe(2);
  });
});
