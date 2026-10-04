// @vitest-environment jsdom
// ================================================================================================
// R-1012 (Folgeauftrag gesamt-erstnutzerfuehrung-quellen) — DER ERSTE BLICK: WAS KLARWERK KANN.
// ================================================================================================
//
// Herkunft: `OFFEN.md` U4 („der erste Blick", SCRUM-474) — Nataschas zweite Bedingung fürs
// Wiederbenutzen, „ein umfassendes Bild, was Klarwerk in der Lage ist zu leisten".
//
// Gemessen wird am echten Weg: die ganze Startseite gemountet, „…" geklickt, „Über KLARWERK"
// geklickt — keine Abkürzung in den Blattzustand. Was der Fall belegt und was nicht:
//   F0  die Tabelle nennt nur vorhandene Bereiche unter ihrem angezeigten Namen, in der Reihenfolge
//       erfassen → prüfen → finden, und deckt die vier Themen von R-0928 (Erfassen, Validieren,
//       Fragen, Bibliothek) ab; jeder Text steht in DE/EN/NL.
//   F1  das Blatt trägt Zwecksatz UND Übersicht; jeder Eintrag ist für „controller" ein Weg in die
//       volle Funktion, der Hilfe-Weg führt nach `/hilfe`.
//   F2  viewer/experte × DE/EN/NL: Bereiche ausserhalb der Rolle bleiben Auskunft mit
//       Zugriffshinweis und ohne Link; die Einleitung verspricht keine Wege, die es nicht gibt.
//       controller ist die Gegenprobe mit acht Links.
//   F3  das Sichtfeld der Startseite bleibt unverändert (H5): vor dem Klick steht die Übersicht nicht da.
//   F4  ein Klick auf einen Eintrag landet wirklich auf der Route.
//   F5  EN und NL zeigen übersetzte Überschriften, keine Schlüssel.
//   F6  KI-Status aus/an/Statusfehler/abgeschaltet × DE/EN/NL: der Satz zu „Fragen“ sagt die
//       Antwort nur zu, wenn sie möglich ist; Rollenwege bleiben (Nacharbeit 3).
//   F7  regulär schliessen, Start weiter bedienen, über das Menü wieder öffnen: Fähigkeiten,
//       Reihenfolge und Grenzen stehen vollständig wieder da, ohne Zwangsdurchlauf.
// NICHT belegt: dass ein Mensch ohne Schulung damit „ein umfassendes Bild" bekommt. Das zeigt erst
// ein Nachtest mit Menschen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "controller" as "viewer" | "experte" | "controller" | "admin",
  // Der öffentliche KI-Status (`/api/reasoner/status`), wie ihn der Server in jeder Lage liefert.
  ki: "an" as "an" | "aus" | "abgeschaltet" | "fehler",
}));

const KI_STATUS = vi.hoisted(() => ({
  an: { active: true, mode: "cloud", reachable: "active", tasks: { answer: true } },
  aus: { active: false, mode: "deterministic", tasks: { answer: false } },
  abgeschaltet: {
    active: false,
    mode: "deterministic",
    tasks: { answer: false },
    kiAbgeschaltet: true,
  },
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: { list: leer },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      validation: { board: leer },
      lifecycle: { pending: leer },
      gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0 } })) },
      learningPaths: { byRole: vi.fn(async () => null), progress: leer },
      livewall: { get: vi.fn(async () => ({ saved: [], helped: [], helpedToday: 0 })) },
      notifications: { list: leer },
      admin: { demoStatus: vi.fn(async () => ({ present: false, count: 0 })) },
      analytics: { overview: vi.fn(async () => ({ total: 0, byStatus: {} })) },
      reasoner: {
        status: vi.fn(async () => {
          if (box.ki === "fehler") {
            throw new Error("Status nicht erreichbar");
          }
          return KI_STATUS[box.ki];
        }),
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
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, anzeigeNameKey, routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import {
  type AntwortLage,
  FAEHIGKEITEN,
  FAEHIGKEITS_SCHRITTE,
  antwortLage,
  faehigkeitTextKey,
  faehigkeitsSchrittKey,
} from "../../apps/web/src/lib/faehigkeiten";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;

function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-ort": "1" }, ort.pathname);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
                createElement(MemoryRouter, { initialEntries: ["/start"] }, [
                  createElement(Ort, { key: "o" }),
                  createElement(Start, { key: "s" }),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Die Sitzung löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`).
  await act(flush);
  await act(flush);
}

/** „…" → ein Menüpunkt (Vorgabe „Über KLARWERK"), über die echten Knöpfe. */
async function oeffneUeber(punkt = "ueber"): Promise<void> {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="h5-start-menu"]')?.click();
    await flush();
  });
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>(`[data-testid="h5-start-menu-punkt-${punkt}"]`)
      ?.click();
    await flush();
  });
  // Nacharbeit 4: das Blatt baut sich erst am Ende des Klick-`act` an — und mit ihm die Abfrage des
  // KI-Status. Ihre Antwort braucht eigene Durchläufe, sonst stünde der Satz der Lage „unbekannt“
  // da (Prüflauf am Kandidaten 039d5468: `expected 'unbekannt' to be 'verfuegbar'`). Derselbe
  // Abschluss wie `oeffnePanel` in `tests/kollision-netztrennung/startflaeche-mounted.test.tsx`.
  await act(flush);
  await act(flush);
}

/** Ein offenes Startblatt über seinen regulären Schließknopf im Kopf schliessen. */
async function schliesseBlatt(punkt: string): Promise<void> {
  const knopf = document.querySelector<HTMLButtonElement>(
    `[data-testid="h5-start-blatt-${punkt}"] button[aria-label="${i18n.t("cmd.close")}"]`,
  );
  expect(knopf, `Schließknopf im Blatt „${punkt}“ fehlt`).not.toBeNull();
  await act(async () => {
    knopf?.click();
    await flush();
  });
}

/** Das Blatt wird nach `document.body` portaliert — deshalb an `document` gebunden. */
function uebersicht(): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    '[data-testid="h5-start-blatt-ueber"] [data-testid="erstnutzer-faehigkeiten"]',
  );
  if (!el) {
    throw new Error("Die Fähigkeitsübersicht fehlt im Blatt „Über KLARWERK“");
  }
  return el;
}

const eintrag = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="erstnutzer-faehigkeit-${id}"]`);

const ort = (): string => container.querySelector("[data-ort]")?.textContent ?? "";

const ANTWORT_LAGEN: readonly AntwortLage[] = [
  "verfuegbar",
  "ohneModell",
  "abgeschaltet",
  "unbekannt",
];

function fragenEintrag(): (typeof FAEHIGKEITEN)[number] {
  const f = FAEHIGKEITEN.find((x) => x.id === "fragen");
  if (!f) {
    throw new Error("„Fragen“ fehlt in der Übersicht");
  }
  return f;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.rolle = "controller";
  box.ki = "an";
  window.localStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  qc.clear();
  vi.clearAllMocks();
});

describe("R-1012 · F0 — die Tabelle nennt nur Vorhandenes", () => {
  it("F0a · jeder Eintrag ist ein Navigationspunkt: Pfad und Name kommen aus der einen Registry", () => {
    expect(FAEHIGKEITEN.length).toBeGreaterThan(5);
    for (const f of FAEHIGKEITEN) {
      const item = ALL_ITEMS.find((i) => i.id === f.id);
      expect(item, `kein Navigationspunkt „${f.id}“`).toBeDefined();
      expect(f.to).toBe(item?.path);
      expect(f.nameKey).toBe(anzeigeNameKey(item as NonNullable<typeof item>));
      // Stufe-2-Bereiche sieht ein Erstnutzer nicht — die Übersicht verspricht sie nicht.
      expect(item?.stufe2, `${f.id} ist ein Stufe-2-Bereich`).not.toBe(true);
    }
    expect(new Set(FAEHIGKEITEN.map((f) => f.id)).size).toBe(FAEHIGKEITEN.length);
  });

  it("F0b · Reihenfolge der Kernschleife erfassen → prüfen → finden (R-0939)", () => {
    expect(FAEHIGKEITS_SCHRITTE).toEqual(["erfassen", "pruefen", "finden"]);
    const folge = FAEHIGKEITEN.map((f) => FAEHIGKEITS_SCHRITTE.indexOf(f.schritt));
    expect(folge).toEqual([...folge].sort((a, b) => a - b));
    for (const s of FAEHIGKEITS_SCHRITTE) {
      expect(
        FAEHIGKEITEN.some((f) => f.schritt === s),
        `Schritt „${s}“ ist leer`,
      ).toBe(true);
    }
  });

  it("F0c · die vier Themen aus R-0928 sind dabei: Erfassen, Validieren, Fragen, Bibliothek", () => {
    const ziele = FAEHIGKEITEN.map((f) => f.to);
    for (const pfad of ["/erfassen", "/validierung", "/fragen", "/bibliothek"]) {
      expect(ziele).toContain(pfad);
    }
  });

  it("F0d · jeder Text steht in DE, EN und NL, ohne offene Variable", async () => {
    const schluessel = [
      "erstnutzer.faehigkeiten.titel",
      "erstnutzer.faehigkeiten.einleitung",
      "erstnutzer.faehigkeiten.zurHilfe",
      ...FAEHIGKEITS_SCHRITTE.map(faehigkeitsSchrittKey),
      ...FAEHIGKEITEN.flatMap((f) => [f.nameKey, f.textKey]),
      // Die Sätze zu „Fragen“ je Antwortlage (Nacharbeit 3).
      ...ANTWORT_LAGEN.map((lage) => faehigkeitTextKey(fragenEintrag(), lage)),
    ];
    for (const lng of SPRACHEN) {
      const t = i18n.getFixedT(lng);
      // GEGENPROBE: ein Schlüssel ohne Text kommt als Schlüssel zurück — nur deshalb belegt
      // `not.toBe(k)` unten, dass ein Text da ist.
      const fehlt = "erstnutzer.faehigkeiten.gibtEsNicht";
      expect(t(fehlt), `${lng}: Gegenprobe`).toBe(fehlt);
      for (const k of schluessel) {
        const wert = t(k);
        expect(wert, `${lng}:${k}`).not.toBe(k);
        // Keine Mindestlänge über null: echte Namen sind kurz (EN `nav.ask` = „Ask“, Prüfung 1).
        expect(wert.trim().length, `${lng}:${k}`).toBeGreaterThan(0);
      }
      const hilfe = t("erstnutzer.faehigkeiten.hilfe", { seitenhilfe: t("menue.seitenhilfe") });
      expect(hilfe, `${lng}: Hilfesatz`).not.toContain("{{");
      expect(hilfe, `${lng}: Hilfesatz nennt den Menüpunkt`).toContain(t("menue.seitenhilfe"));
    }
  });
});

describe("R-1012 · gemountet am echten Weg „…“ → „Über KLARWERK“", () => {
  it("F1 · controller: Zwecksatz bleibt, darunter jeder Bereich als Weg in die volle Funktion", async () => {
    await mount();
    await oeffneUeber();
    const blatt = document.querySelector<HTMLElement>('[data-testid="h5-start-blatt-ueber"]');
    expect(blatt?.textContent).toContain(i18n.t("start.purpose"));
    // KALIBRIERUNG (Nacharbeit 4): der KI-Status ist angekommen, bevor Texte verglichen werden.
    expect(uebersicht().getAttribute("data-antwort-lage")).toBe("verfuegbar");
    const text = uebersicht().textContent ?? "";
    expect(text).toContain(i18n.t("erstnutzer.faehigkeiten.titel"));
    for (const s of FAEHIGKEITS_SCHRITTE) {
      expect(text).toContain(i18n.t(faehigkeitsSchrittKey(s)));
    }
    for (const f of FAEHIGKEITEN) {
      const el = eintrag(f.id);
      expect(el, `Eintrag ${f.id} fehlt`).not.toBeNull();
      expect(el?.tagName, `${f.id} ist kein Link`).toBe("A");
      expect(el?.getAttribute("href")).toBe(f.to);
      expect(el?.textContent).toContain(i18n.t(f.nameKey));
      expect(el?.textContent).toContain(i18n.t(f.textKey));
    }
    const hilfe = document.querySelector('[data-testid="erstnutzer-faehigkeiten-hilfe"]');
    expect(hilfe?.tagName).toBe("A");
    expect(hilfe?.getAttribute("href")).toBe("/hilfe");
  });

  // ----------------------------------------------------------------------------------------------
  // F2 · BENS BEFUND F1 (Nacharbeit 2): die Einleitung versprach „Jeder Eintrag führt direkt in den
  // Bereich" — für viewer und experte stimmte das nicht, `RoleLink` zeigt dort „Kein Zugriff".
  // Gemessen wird je Rolle und Sprache am echten Weg (Start → „…“ → „Über KLARWERK“):
  //   · gesperrte Einträge: kein Link, kein href, sichtbarer Zugriffshinweis, Zweck bleibt stehen
  //   · erreichbare Einträge: Link auf die Route
  //   · die Einleitung ist die rollenunabhängig wahre Fassung, nicht mehr die alte Zusage
  // controller ist die GEGENPROBE: dort ist jeder Eintrag ein Link, kein Zugriffshinweis.
  // ----------------------------------------------------------------------------------------------
  const ALTE_ZUSAGE: Record<(typeof SPRACHEN)[number], string> = {
    de: "Jeder Eintrag führt direkt in den Bereich.",
    en: "Every entry takes you straight to the area.",
    nl: "Elk item brengt je direct naar het onderdeel.",
  };

  for (const rolle of ["viewer", "experte", "controller"] as const) {
    for (const lng of SPRACHEN) {
      it(`F2-${rolle}-${lng} · Einleitung wahr; Gesperrtes bleibt Auskunft ohne Link, Erreichbares ist Weg`, async () => {
        box.rolle = rolle;
        await i18n.changeLanguage(lng);
        await mount();
        await oeffneUeber();
        const t = i18n.getFixedT(lng);
        const text = uebersicht().textContent ?? "";
        expect(text).toContain(t("erstnutzer.faehigkeiten.einleitung"));
        expect(text, "die alte, rollenblinde Zusage steht wieder da").not.toContain(
          ALTE_ZUSAGE[lng],
        );
        let gesperrt = 0;
        for (const f of FAEHIGKEITEN) {
          const el = eintrag(f.id);
          expect(el, `Eintrag ${f.id} fehlt`).not.toBeNull();
          // Der Zweck bleibt in beiden Fassungen stehen — die Übersicht verschweigt nichts.
          expect(el?.textContent).toContain(t(f.textKey));
          if (routePathAllows(f.to, rolle)) {
            expect(el?.tagName, `${f.id} sollte für ${rolle} ein Weg sein`).toBe("A");
            expect(el?.getAttribute("href")).toBe(f.to);
            expect(el?.textContent).not.toContain(t("roleLink.noReach"));
          } else {
            gesperrt += 1;
            expect(el?.tagName, `${f.id} darf für ${rolle} kein Link sein`).not.toBe("A");
            expect(el?.hasAttribute("href")).toBe(false);
            expect(el?.querySelector("a, [href]")).toBeNull();
            expect(el?.getAttribute("data-role-no-reach")).toBe("true");
            expect(el?.textContent, `${f.id}: Zugriffshinweis fehlt`).toContain(
              t("roleLink.noReach"),
            );
            expect(el?.getAttribute("title")).toBe(t("roleLink.noReachHint"));
          }
        }
        if (rolle === "controller") {
          // GEGENPROBE: alles erreichbar — kein Eintrag gesperrt, alle acht verlinkt.
          expect(gesperrt).toBe(0);
          expect(uebersicht().querySelectorAll("[data-role-no-reach]").length).toBe(0);
          const links = uebersicht().querySelectorAll('a[data-testid^="erstnutzer-faehigkeit-"]');
          expect(links.length).toBe(FAEHIGKEITEN.length);
        } else {
          // KALIBRIERUNG: ohne gesperrten Eintrag bewiese dieser Fall nichts über die Rollenfrage.
          expect(gesperrt).toBeGreaterThan(0);
        }
      });
    }
  }

  it("F2-Gegenprobe · die alte Zusage hätte die Prüfung oben wirklich verfehlt", () => {
    // Die alten Sätze sind nicht mehr im Wörterbuch — sonst prüfte `not.toContain` nichts.
    for (const lng of SPRACHEN) {
      expect(i18n.getFixedT(lng)("erstnutzer.faehigkeiten.einleitung")).not.toContain(
        ALTE_ZUSAGE[lng],
      );
      expect(ALTE_ZUSAGE[lng].length).toBeGreaterThan(10);
    }
  });

  it("F3 · das Sichtfeld der Startseite bleibt unverändert: vor dem Klick keine Übersicht", async () => {
    await mount();
    expect(document.querySelector('[data-testid="erstnutzer-faehigkeiten"]')).toBeNull();
    expect(container.textContent).not.toContain(i18n.t("erstnutzer.faehigkeiten.titel"));
    await oeffneUeber();
    expect(document.querySelector('[data-testid="erstnutzer-faehigkeiten"]')).not.toBeNull();
  });

  it("F4 · ein Klick auf „Bibliothek“ landet auf /bibliothek", async () => {
    await mount();
    await oeffneUeber();
    expect(ort()).toBe("/start");
    await act(async () => {
      eintrag("bibliothek")?.click();
      await flush();
    });
    expect(ort()).toBe("/bibliothek");
  });

  for (const lng of ["en", "nl"] as const) {
    it(`F5-${lng} · die Übersicht ist übersetzt, nicht verschlüsselt`, async () => {
      await i18n.changeLanguage(lng);
      await mount();
      await oeffneUeber();
      const text = uebersicht().textContent ?? "";
      expect(text).toContain(i18n.getFixedT(lng)("erstnutzer.faehigkeiten.titel"));
      expect(text).not.toContain("erstnutzer.");
      expect(text).not.toContain(i18n.getFixedT("de")("erstnutzer.faehigkeiten.titel"));
    });
  }
});

// ================================================================================================
// F6 · BENS BEFUND (Nacharbeit 3): KEINE ANTWORTZUSAGE, DIE DER BETRIEBSZUSTAND NICHT DECKT.
// ================================================================================================
// Der Satz zu „Fragen“ beschrieb die quellengebundene Antwort uneingeschränkt. Jetzt folgt er dem
// öffentlichen Status — gemessen je Statuslage und Sprache am echten Menüweg, mit Rollenwegen.
// GEGENPROBE: in der Lage „verfügbar“ steht die volle Zusage wirklich da — sonst bewiese ihr
// Fehlen in den anderen Lagen nichts.
describe("R-1012 · F6 — die Antwort wird nur zugesagt, wenn sie gerade möglich ist", () => {
  it("F6a · die Ableitung aus dem öffentlichen Status, und nur „Fragen“ hängt daran", () => {
    const an = { active: true, mode: "cloud", tasks: { answer: true } } as const;
    const aus = { active: false, mode: "deterministic", tasks: { answer: false } } as const;
    const unerreichbar = { ...an, reachable: "unreachable" } as const;
    const abgeschaltet = { ...aus, kiAbgeschaltet: true } as const;
    expect(antwortLage(undefined)).toBe("unbekannt");
    expect(antwortLage(an)).toBe("verfuegbar");
    expect(antwortLage(aus)).toBe("ohneModell");
    expect(antwortLage(unerreichbar)).toBe("ohneModell");
    expect(antwortLage(abgeschaltet)).toBe("abgeschaltet");
    for (const f of FAEHIGKEITEN.filter((x) => x.id !== "fragen")) {
      for (const lage of ANTWORT_LAGEN) {
        expect(faehigkeitTextKey(f, lage)).toBe(f.textKey);
      }
    }
    const fragenSaetze = ANTWORT_LAGEN.map((lage) => faehigkeitTextKey(fragenEintrag(), lage));
    expect(new Set(fragenSaetze).size).toBe(ANTWORT_LAGEN.length);
  });

  const STATUSLAGEN = [
    { ki: "aus", lage: "ohneModell" },
    { ki: "an", lage: "verfuegbar" },
    { ki: "fehler", lage: "unbekannt" },
    { ki: "abgeschaltet", lage: "abgeschaltet" },
  ] as const;

  for (const { ki, lage } of STATUSLAGEN) {
    for (const lng of SPRACHEN) {
      it(`F6-${ki}-${lng} · der Satz zu „Fragen“ folgt der Lage „${lage}“; Rollenwege bleiben`, async () => {
        box.rolle = "viewer";
        box.ki = ki;
        await i18n.changeLanguage(lng);
        await mount();
        await oeffneUeber();
        const t = i18n.getFixedT(lng);
        const zusage = t("erstnutzer.faehigkeiten.fragen");
        const satz = t(faehigkeitTextKey(fragenEintrag(), lage));
        expect(uebersicht().getAttribute("data-antwort-lage")).toBe(lage);
        const fragen = eintrag("fragen");
        expect(fragen?.textContent).toContain(satz);
        if (lage === "verfuegbar") {
          expect(fragen?.textContent, "Gegenprobe: die volle Zusage fehlt").toContain(zusage);
        } else {
          expect(satz).not.toBe(zusage);
          expect(uebersicht().textContent, "uneingeschränkte Antwortzusage").not.toContain(zusage);
        }
        // Rollenwege unverändert: für viewer sind Fragen und Bibliothek Wege, Erfassen Auskunft.
        expect(fragen?.tagName).toBe("A");
        expect(fragen?.getAttribute("href")).toBe("/fragen");
        expect(eintrag("bibliothek")?.tagName).toBe("A");
        const erfassen = eintrag("erfassen");
        expect(erfassen?.tagName).not.toBe("A");
        expect(erfassen?.getAttribute("data-role-no-reach")).toBe("true");
        expect(erfassen?.textContent).toContain(t("roleLink.noReach"));
      });
    }
  }
});

// ================================================================================================
// F7 · ÜBERSPRINGBAR UND WIEDERHOLBAR (Nacharbeit 3): schliessen über den regulären Knopf, die
// Startseite weiter bedienen, über das Menü erneut öffnen — alles steht wieder vollständig da.
// ================================================================================================
function eintragsFolge(): string[] {
  const els = uebersicht().querySelectorAll('[data-testid^="erstnutzer-faehigkeit-"]');
  return [...els].map((el) =>
    (el.getAttribute("data-testid") ?? "").replace("erstnutzer-faehigkeit-", ""),
  );
}

describe("R-1012 · F7 — schliessen, weiter bedienen, wieder öffnen", () => {
  for (const lng of SPRACHEN) {
    it(`F7-${lng} · Fähigkeiten, Reihenfolge und Grenzen stehen nach dem Wiederöffnen vollständig da`, async () => {
      await i18n.changeLanguage(lng);
      await mount();
      await oeffneUeber();
      const t = i18n.getFixedT(lng);
      // KALIBRIERUNG (Nacharbeit 4): beide Blicke müssen dieselbe Statuslage sehen, sonst vergliche
      // der Fall einen Ladezustand mit einem geladenen.
      expect(uebersicht().getAttribute("data-antwort-lage")).toBe("verfuegbar");
      const ersterBlick = { text: uebersicht().textContent ?? "", folge: eintragsFolge() };
      expect(ersterBlick.folge).toEqual(FAEHIGKEITEN.map((f) => f.id));

      // Schliessen über den regulären Knopf — keine Pflicht, die Übersicht durchzugehen.
      await schliesseBlatt("ueber");
      expect(document.querySelector('[data-testid="h5-start-blatt-ueber"]')).toBeNull();

      // Die Startseite weiter bedienen: ein anderer Menüpunkt öffnet und schliesst, das Feld bleibt
      // bedienbar.
      await oeffneUeber("kreis");
      const kreis = document.querySelector('[data-testid="h5-start-blatt-kreis"]');
      expect(kreis?.textContent).toContain(t("cycle.title"));
      await schliesseBlatt("kreis");
      const feld = container.querySelector<HTMLInputElement>(
        '[data-testid="page-start"] form input',
      );
      expect(feld, "das Startfeld fehlt").not.toBeNull();
      expect(feld?.disabled).toBe(false);

      // Erneut öffnen: derselbe vollständige Inhalt in derselben Reihenfolge.
      await oeffneUeber();
      expect(uebersicht().textContent).toBe(ersterBlick.text);
      expect(eintragsFolge()).toEqual(ersterBlick.folge);
      const schritte = [...uebersicht().querySelectorAll("h4")].map((h) => h.textContent);
      expect(schritte).toEqual(FAEHIGKEITS_SCHRITTE.map((s) => t(faehigkeitsSchrittKey(s))));
      for (const f of FAEHIGKEITEN) {
        expect(eintrag(f.id)?.textContent).toContain(t(f.nameKey));
      }
      // Die Grenzen: Rollengrenze in der Einleitung, Antwortlage bei „Fragen“, Leitsatz im Blatt.
      expect(uebersicht().textContent).toContain(t("erstnutzer.faehigkeiten.einleitung"));
      expect(eintrag("fragen")?.textContent).toContain(t("erstnutzer.faehigkeiten.fragen"));
      const blatt = document.querySelector('[data-testid="h5-start-blatt-ueber"]');
      expect(blatt?.textContent).toContain(t("start.konsole.leitsatz"));
      // Kein erzwungener Durchlauf: alles auf einmal, kein Schritt- oder Weiter-Knopf.
      expect(uebersicht().querySelectorAll("button").length).toBe(0);
      expect(uebersicht().querySelectorAll("[hidden]").length).toBe(0);
    });
  }
});
