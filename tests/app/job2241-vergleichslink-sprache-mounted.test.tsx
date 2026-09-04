// @vitest-environment jsdom
// ================================================================================================
// JOB 2241 · D1 (Mounted) — DER VERGLEICHSLINK SPRICHT DIE SPRACHE DES NUTZERS.
// ================================================================================================
//
// DER BEFUND, gemessen am Stand 039637e vor diesem Bau:
//
//   apps/web/src/pages/Duplicates.tsx
//     <Link to={`/duplikate/${e.id}/vergleich`} className="…">
//       Read-only Vergleich →                            ← harter Text, eine Sprache fuer alle
//     </Link>
//
// Die unmittelbaren Nachbarn im selben JSX gehen laengst ueber den Uebersetzungsweg
// (`t("dup.compareOpen")`, `t("dup.versus")`, `t("dup.shared")`). Genau dieser eine Text nicht.
// Wer das Produkt auf Englisch oder Niederlaendisch benutzt, bekommt hier Deutsch.
//
// WARUM DIESE DATEI GEMOUNTET IST UND NICHT GREPPT. Das ist ein SICHTBARER Auftrag; ein
// Quellbefund belegt hier gar nichts. Drei rote Urteile am 22.08. hatten dieselbe Ursache —
// `1962 D3`: „die fuenf Aufrufer und der Sperrzweig sind als Quellbefund belegt, aber die fuer
// diesen sichtbaren UI-Auftrag erforderliche konkrete Renderpruefung fehlt."
// Deshalb faehrt diese Datei die ECHTE `Duplicates`-Seite im jsdom und liest den Text am
// ausgegebenen `<a>`-Element — nicht die Quelle, die ihn erzeugen soll.
//
// GERUEST UND MUSTER folgen dem direkten Nachbarn tests/app/nebenweg-redaktion-mounted.test.tsx,
// der dieselbe Seite mountet und bereits im Tor laeuft (§TSX: kein neuer Anwendungscode im
// tsx-Pruefpfad, dieselben Importwege ueber `apps/web/node_modules`).
//
// WAS HIER KALIBRIERUNG IST UND NICHT ROTBEFUND — ausdruecklich, damit es niemand verwechselt:
// Der DEUTSCHE Text bleibt bytegleich. Der Bau ist additiv (en/nl kommen hinzu), er ersetzt
// kein deutsches Wort. V1 und V4 sind deshalb gegen den unveraenderten Stand GRUEN und pruefen
// keinen Befund, sondern bewachen, dass der Bau nichts mitnimmt. Der Rotbefund sind V2, V3, V5,
// V6 und V7.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ duplikate: [] as unknown[] }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  return {
    endpoints: {
      duplicates: {
        list: ok(() => daten.duplikate),
        settings: ok(() => ({ minConfidence: 0.5 })),
      },
      conflicts: { list: ok(() => []) },
      // JOB 3061 · H2: der gemeinsame Reiterkopf zaehlt alle vier Reiter aus echten Abrufen.
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
      ko: { list: ok(() => KOS) },
      gaps: { list: ok(() => []), summary: ok(() => ({ total: 0, byPriority: {} })) },
      directory: { list: ok(() => []) },
      analytics: { busfactor: ok(() => []), expertise: ok(() => []) },
      aiCheck: {
        coverageSummary: ok(() => ({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 })),
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Volle Objekte: `KoView` liest `conditions`/`measures`/`sources` ohne Absicherung. Eine verkuerzte
// Attrappe zeigte einen Fehler MEINER Attrappe an, nicht einen Fehler meiner Arbeit.
const ko = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `Aussage ${id}`,
  status: "validiert",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [ko("ko-a", "Beitrag A"), ko("ko-b", "Beitrag B")];

// BEIDE Seiten muessen aufloesen: der Link haengt an `pair.a && pair.b ? … : null`
// (Duplicates.tsx). Faellt eine Seite weg, ist der Link gar nicht im DOM — und jeder Fall unten
// pruefte dann die Abwesenheit statt der Beschriftung.
const DUPLIKAT = {
  id: "d-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "gleich",
  aspects: [],
  eigenanteilA: "NUR-IN-A",
  eigenanteilB: "NUR-IN-B",
  recommendation: "merge",
  status: "offen",
  origin: "auto",
  detector: { trigger: "background", method: "model", lexicalScore: 0.9, rationale: "Grund" },
  createdAt: "2026-08-01T06:00:00.000Z",
};

const ZIEL = "/duplikate/d-1/vergleich";

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
                MemoryRouter,
                { initialEntries: ["/duplikate"] },
                createElement(Duplicates),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
  // JOB 3061 · H2: der Vergleichslink liegt jetzt im „···"-Menü der linken Karte (Pages-Art) und
  // nicht mehr im <details>-Block. Ein GESCHLOSSENES Menü rendert seinen Inhalt gar nicht — die
  // Faelle unten pruefen also weiterhin genau den Zustand, den ein Mensch wirklich sieht, nur
  // hinter einem echten Klick statt hinter einem gesetzten `open`.
  await act(async () => {
    (
      container.querySelector('[data-testid="pruefen-menue-duplikat-a"]') as HTMLElement | null
    )?.click();
  });
  for (const d of [...container.querySelectorAll("details")]) {
    (d as HTMLDetailsElement).open = true;
  }
  await act(flush);
}

/** Das ausgegebene Element — nicht der Quelltext, der es erzeugen soll. */
function vergleichslink(): HTMLAnchorElement {
  const a = container.querySelector<HTMLAnchorElement>(`a[href="${ZIEL}"]`);
  if (!a) {
    throw new Error(
      `Kein Vergleichslink mit Ziel ${ZIEL} im gerenderten Baum. ` +
        `Vorhandene Links: ${[...container.querySelectorAll("a")]
          .map((x) => x.getAttribute("href"))
          .join(", ")}`,
    );
  }
  return a;
}

/** Was ein Vorlesewerkzeug ansagt: sichtbarer Text OHNE die rein dekorativen Teile. */
function vorgelesen(a: HTMLAnchorElement): string {
  const klon = a.cloneNode(true) as HTMLAnchorElement;
  for (const versteckt of [...klon.querySelectorAll('[aria-hidden="true"]')]) {
    versteckt.remove();
  }
  return (klon.textContent ?? "").replace(/\s+/g, " ").trim();
}

beforeEach(async () => {
  daten.duplikate = [DUPLIKAT];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

describe("JOB 2241 · der Vergleichslink spricht die Sprache des Nutzers", () => {
  // KALIBRIERUNG, kein Rotbefund: der deutsche Text bleibt bytegleich. Ohne diesen Fall koennte
  // der Bau Deutsch mitnehmen und die anderen Faelle waeren trotzdem gruen.
  it("V1 · deutsch: die Beschriftung bleibt unveraendert (Kalibrierung)", async () => {
    await mount();
    expect(vergleichslink().textContent).toContain("Read-only Vergleich");
  });

  it("V2 · englisch: die Beschriftung ist englisch, nicht deutsch", async () => {
    await i18n.changeLanguage("en");
    await mount();
    const a = vergleichslink();
    expect(a.textContent).toContain("Read-only comparison");
    expect(a.textContent).not.toContain("Vergleich →");
  });

  it("V3 · niederlaendisch: die Beschriftung ist niederlaendisch", async () => {
    await i18n.changeLanguage("nl");
    await mount();
    const a = vergleichslink();
    expect(a.textContent).toContain("Alleen-lezen vergelijking");
    expect(a.textContent).not.toContain("Vergleich →");
  });

  // KALIBRIERUNG: die Uebersetzung darf das Ziel nicht anfassen. Ein Link, der in der falschen
  // Sprache richtig heisst und ins Leere zeigt, waere schlechter als vorher.
  it("V4 · das Linkziel bleibt in jeder Sprache dasselbe (Kalibrierung)", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      await mount();
      expect(vergleichslink().getAttribute("href")).toBe(ZIEL);
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
    // Der letzte Durchlauf haengt den Container ab; afterEach braucht wieder einen.
    await mount();
  });

  // Der Grund, aus dem `redaktionstext` in derselben Datei den Sprachanteil kuerzt: `i18n.language`
  // kann „en-GB" sein. Ein Register, das nur auf „en" passt, faellt sonst auf Deutsch zurueck —
  // und der englische Nutzer saehe wieder Deutsch, obwohl die Uebersetzung existiert.
  it("V5 · die Regionalvariante faellt auf ihre Sprache, nicht auf Deutsch", async () => {
    await i18n.changeLanguage("en-GB");
    await mount();
    const a = vergleichslink();
    expect(a.textContent).toContain("Read-only comparison");
    expect(a.textContent).not.toContain("Vergleich →");
  });

  // §3 verlangt, dass die Sache fuer Vorlesewerkzeuge richtig ausgezeichnet BLEIBT. Der Pfeil ist
  // Dekoration; steht er im zugaenglichen Namen, sagt ein Screenreader „Rechtspfeil" mit an. Er
  // gehoert deshalb nicht in den uebersetzten Text, sondern hinter `aria-hidden`.
  it("V6 · der Pfeil ist Dekoration und wird nicht mitgelesen", async () => {
    await mount();
    const a = vergleichslink();
    expect(a.textContent, "der Pfeil bleibt sichtbar").toContain("→");
    expect(vorgelesen(a), "…aber er steht nicht im zugaenglichen Namen").not.toContain("→");
    expect(vorgelesen(a).length, "der zugaengliche Name darf nicht leer werden").toBeGreaterThan(0);
  });

  // DIE NEGATIVPROBE, ohne die V2/V3 wertlos waeren: ein Bau, der in JEDER Sprache denselben
  // neuen Text zeigt, bestuende V2 und V3 ebenfalls. Hier muss die deutsche Fassung in der
  // englischen Oberflaeche NIRGENDS mehr auftauchen — auch nicht als Fallback.
  it("V7 · in der englischen Oberflaeche steht der deutsche Text nirgends auf der Seite", async () => {
    await i18n.changeLanguage("en");
    await mount();
    expect(container.textContent ?? "").not.toContain("Read-only Vergleich");
  });
});
