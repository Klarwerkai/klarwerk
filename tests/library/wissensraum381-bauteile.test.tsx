// @vitest-environment jsdom
// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 4 (Bauteile) · `R-6` bis `R-10` — DIE ZWEI NEUEN KOMPONENTEN.
// ==================================================================================================
//
// Gegenstand: `components/trust/KoHomeLine.tsx` (`P-2`) und `components/LibraryScopeBar.tsx`
// (`P-1` + `P-3`) aus PLAN PRO 378 §4.2. Beide sind PRÄSENTATIONAL: die Wahrheit kommt fertig
// herein, sie entscheiden nichts. Diese Datei ist deshalb DOM-nah und logikfrei — die Logik prüft
// `wissensraum381-ortsprojektion`, die Leckfreiheit `wissensraum381-sicherheit-leckfreiheit`.
//
// DIESE DATEI IST VOLLSTÄNDIG ROT: keines der beiden Bauteile existiert im Arbeitsbaum. Jeder Fall
// wird einzeln rot mit dem fehlenden Pfad in der Meldung.
//
// DIE PROP-NAMEN SIND MIT DIESER PRÜFFLÄCHE GESETZT (PLAN 378 §4.2 benennt die Bauteile, nicht ihre
// Schnittstelle):
//   KoHomeLine      · { home }
//   LibraryScopeBar · { available, path, spaces, scope, serverCount, onScopeChange }
//
// WAS HIER BEWUSST NICHT GEPRÜFT WIRD — und das ist eine Grenze, keine Auslassung: die WÖRTER.
// PLAN 378 §9 führt `B-1`, `B-2`, `B-3` und `B-6` als offene Sperren („ohne Produktsprache bleiben
// `P-1`/`P-2` unbenennbar"). Ein Test, der heute eine Beschriftung festnagelt, nähme dem Owner eine
// Entscheidung ab, die ihm gehört. Geprüft wird deshalb ausschliesslich STRUKTUR und VERHALTEN —
// und dort, wo Text nötig ist, der vom Server gelieferte NAME, nie eine Produktvokabel.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ladeOrtArtefakt, ortExport } from "./support/wissensraum-ort-vertrag";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const aufraeumen: Array<() => void> = [];

/** Montiert ein noch nicht existierendes Bauteil und gibt seinen Container zurück. */
async function mounte(
  artefakt: "homeLine" | "scopeBar",
  exportName: string,
  props: Record<string, unknown>,
  mitRouter: boolean,
): Promise<HTMLDivElement> {
  const modul = await ladeOrtArtefakt(artefakt);
  const Komp = ortExport(modul, exportName, artefakt);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    // `as never`: das Bauteil existiert zur Typprüfzeit noch nicht — die Wirklichkeit prüft der Test.
    const el = createElement(Komp as never, props);
    root.render(mitRouter ? createElement(MemoryRouter, null, el) : el);
  });
  aufraeumen.push(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });
  return container;
}

const heimatzeile = (props: Record<string, unknown>): Promise<HTMLDivElement> =>
  mounte("homeLine", "KoHomeLine", props, false);

const ortszeile = (props: Record<string, unknown>): Promise<HTMLDivElement> =>
  mounte("scopeBar", "LibraryScopeBar", props, true);

/** Die vollständige, sichtbare Kette, wie der Server sie liefert (Wurzel zuerst). */
const KETTE = [
  { id: "technik", name: "Technik" },
  { id: "instandhaltung", name: "Instandhaltung" },
];

/** Alles, was per Tastatur erreichbar ist — für `A-10`/`R-10`: es darf NICHTS übrig bleiben. */
function fokusziele(container: HTMLElement): Element[] {
  return [...container.querySelectorAll("a, button, input, select, textarea, [tabindex]")];
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  while (aufraeumen.length > 0) {
    aufraeumen.pop()?.();
  }
});

describe("PRO 381 · R-6 — `KoHomeLine` rendert bei fehlender Heimat GAR NICHTS", () => {
  it("R-6 (a): `null`, `undefined` und ein fehlendes Feld ergeben leeres Markup", async () => {
    // §5.2 Regel 4: kein „gesperrt“, kein Schloss, kein Gedankenstrich, kein ausgegrautes Feld und
    // kein Platzhalter, der Raum reserviert. „Wo nichts steht, steht nichts.“
    expect((await heimatzeile({ home: null })).innerHTML).toBe("");
    expect((await heimatzeile({ home: undefined })).innerHTML).toBe("");
    expect((await heimatzeile({})).innerHTML).toBe("");
  });

  it("R-6 (b): und kein Fokusziel — die Tabreihenfolge bekommt keinen leeren Halt", async () => {
    const container = await heimatzeile({ home: null });
    expect(fokusziele(container)).toHaveLength(0);
    expect(container.childNodes).toHaveLength(0);
  });

  it("R-6 (c): eine sichtbare Heimat erscheint — als Text mit vollem `title`, NICHT als Link", async () => {
    // `A-7`: die Heimatzeile ist kein Link und kein Fokusziel. Ein Link führte in einen Knoten,
    // dessen Sichtbarkeit eine eigene Frage ist — und erzeugte ein Tab-Ziel JE TREFFERZEILE.
    // Die Bauform ist die von `KoAuthorLine.tsx:17-19`: die Zeile kürzt, der volle Text steht im
    // `title` — kein mitten im Namen gekappter Ort ohne Auflösung.
    const container = await heimatzeile({ home: { chain: KETTE } });
    expect(container.innerHTML).not.toBe("");
    expect(fokusziele(container)).toHaveLength(0);
    expect(container.querySelector("a")).toBeNull();

    const mitTitle = container.querySelector("[title]");
    expect(mitTitle, "die Heimatzeile trägt keinen vollen Text im `title`").not.toBeNull();
    const title = mitTitle?.getAttribute("title") ?? "";
    for (const knoten of KETTE) {
      expect(title, `„${knoten.name}“ fehlt im vollen Text`).toContain(knoten.name);
    }
  });
});

describe("PRO 381 · R-7 — `LibraryScopeBar` erfindet weder Räume noch Zahlen", () => {
  it("R-7 (a): eine LEERE Raumliste ergibt keine Liste — und keinen Platzhalterraum", async () => {
    // Nutzerweg Sekunde 5–12: „nur die, die es wirklich gibt und die ich sehen darf. Ist keiner da,
    // steht dort nichts; kein Platzhalterraum, kein ‚Nicht zugeordnet'."
    const container = await ortszeile({
      available: true,
      path: null,
      spaces: [],
      scope: "",
      serverCount: null,
    });
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("R-7 (b): ohne Serverzahl erscheint KEINE Zahl — auch keine Null", async () => {
    // `P-3` / REF-0001 `:48`: eine clientseitig gerechnete Zahl wäre über `T-3` sofort eine
    // Existenzauskunft. Die Fixture trägt bewusst ziffernfreie Namen, damit dieser Wächter nicht
    // an einem Raumnamen hängenbleibt.
    const container = await ortszeile({
      available: true,
      path: null,
      spaces: [{ id: "technik", name: "Technik" }],
      scope: "",
      serverCount: null,
    });
    expect(container.textContent ?? "").not.toMatch(/\d/);
  });

  it("R-7 (c): mit Serverzahl erscheint GENAU diese Zahl", async () => {
    const container = await ortszeile({
      available: true,
      path: null,
      spaces: [{ id: "technik", name: "Technik" }],
      scope: "",
      serverCount: 128,
    });
    expect(container.textContent ?? "").toContain("128");
  });
});

describe("PRO 381 · R-8 — der Pfad ist barrierefrei gebaut", () => {
  it("R-8 (a): `nav[aria-label]` mit geordneter Liste, ein Glied je Kettenknoten", async () => {
    const container = await ortszeile({
      available: true,
      path: KETTE,
      spaces: [],
      scope: "instandhaltung",
      serverCount: null,
    });
    const nav = container.querySelector("nav");
    expect(nav, "der Pfad ist kein `nav`").not.toBeNull();
    expect(
      (nav?.getAttribute("aria-label") ?? "").length,
      "`nav` ohne `aria-label`",
    ).toBeGreaterThan(0);
    expect(nav?.querySelector("ol"), "der Pfad ist keine GEORDNETE Liste").not.toBeNull();
    expect(nav?.querySelectorAll("li")).toHaveLength(KETTE.length);
  });

  it('R-8 (b): das LETZTE Glied trägt `aria-current="page"` und ist KEIN Link', async () => {
    // `A-1`: man verlinkt nicht dorthin, wo man steht.
    const container = await ortszeile({
      available: true,
      path: KETTE,
      spaces: [],
      scope: "instandhaltung",
      serverCount: null,
    });
    const glieder = [...(container.querySelector("nav")?.querySelectorAll("li") ?? [])];
    const letztes = glieder[glieder.length - 1];
    expect(letztes?.textContent).toContain("Instandhaltung");
    const aktuell = letztes?.querySelector('[aria-current="page"]') ?? letztes;
    expect(aktuell?.getAttribute("aria-current")).toBe("page");
    expect(letztes?.querySelector("a"), "das letzte Glied ist ein Link").toBeNull();
    // Die davor liegenden Glieder sind sehr wohl anklickbar — sonst wäre der Pfad eine Sackgasse.
    expect(glieder[0]?.querySelector("a"), "das erste Glied ist kein Link").not.toBeNull();
  });

  it("R-8 (c): ohne Pfad gibt es keinen leeren `nav` — nie ein gekürzter, nie ein hohler", async () => {
    // §5.2 Regel 2: aus einer lückenhaften Kette entsteht KEIN Pfad. Das Bauteil bekommt dann
    // `path: null` und darf daraus nichts zeichnen — auch keinen leeren Rahmen.
    const container = await ortszeile({
      available: true,
      path: null,
      spaces: [{ id: "technik", name: "Technik" }],
      scope: "",
      serverCount: null,
    });
    expect(container.querySelectorAll("nav")).toHaveLength(0);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });
});

describe("PRO 381 · R-9 — der Umschalter zeigt seinen Zustand als Text", () => {
  it("R-9 (a): ZWEI Schaltflächen mit `aria-pressed` in einer benannten Gruppe", async () => {
    // `A-2`: Muster aus `Library.tsx:891-904` (Gruppierung) und `:724` (Reife-Pillen).
    // Ausdrücklich KEIN `<select>`: ein Auswahlmenü zeigt den aktuellen Zustand erst beim Öffnen —
    // bei einer Fläche, die den durchsuchten Bestand bestimmt, ist das keine Stilfrage (§6).
    const container = await ortszeile({
      available: true,
      path: KETTE,
      spaces: [],
      scope: "instandhaltung",
      serverCount: null,
    });
    const schalter = [...container.querySelectorAll("button[aria-pressed]")];
    expect(schalter, "der Umschalter hat nicht genau zwei Schaltflächen").toHaveLength(2);
    expect(container.querySelectorAll("select"), "der Umschalter ist ein Auswahlmenü").toHaveLength(
      0,
    );
    // KORRIGIERT IN PRO 390 — die ursprüngliche Fassung verlangte wörtlich `[role="group"]`.
    //
    // Das war ein zu enger Testvertrag: Er pinnte die MECHANIK statt der Wirkung, und zwar auf eine
    // Form, die dieses Haus zweimal ausdrücklich verworfen hat. `RichTextEditor.tsx:1529` hält es
    // wörtlich fest — „Ein echtes <fieldset> statt role=\"group\": die Gruppe … bekommt ihren Namen
    // aus dem Element, nicht aus einem ARIA-Nachbau" —, `Modal.tsx:61` entscheidet dasselbe für
    // `role="dialog"`. Beide Male erzwingt es `a11y/useSemanticElements`; ein `role="group"` am
    // `fieldset` fiele zusätzlich über `a11y/noRedundantRoles`. Die alte Fassung forderte damit
    // Markup, das der Lint-Gate des Repos zurückweist — sie war nicht erfüllbar, ohne den Gate zu
    // brechen.
    //
    // Zugesichert wird deshalb jetzt die WIRKUNG aus `A-2`: die beiden Schaltflächen stehen in einer
    // Gruppe, die im Zugänglichkeitsbaum EINEN NAMEN TRÄGT. Ob dieser Name aus einem `fieldset`
    // (implizite Rolle `group`) oder aus einem gesetzten `role` kommt, ist Bauform, nicht Vertrag.
    const gruppe = container.querySelector('fieldset, [role="group"]');
    expect(gruppe, "die beiden Schaltflächen stehen in keiner benannten Gruppe").not.toBeNull();
    expect((gruppe?.getAttribute("aria-label") ?? "").length).toBeGreaterThan(0);
  });

  it("R-9 (b): genau EINE ist gedrückt — und trägt sichtbaren Text, nicht nur Tönung", async () => {
    // `A-4`: „Zustand nie nur über Farbe.“ Ausdrücklicher Hausvertrag, `Library.tsx:163-164`.
    const container = await ortszeile({
      available: true,
      path: KETTE,
      spaces: [],
      scope: "instandhaltung",
      serverCount: null,
    });
    const schalter = [...container.querySelectorAll("button[aria-pressed]")];
    const gedrueckt = schalter.filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(gedrueckt).toHaveLength(1);
    expect((gedrueckt[0]?.textContent ?? "").trim().length).toBeGreaterThan(0);
    // Der gewählte Bereich steht als Text im Baum — hier der vom SERVER gelieferte Name, keine
    // Produktvokabel (die ist mit `B-1`/`B-2` noch offen).
    expect(container.textContent ?? "").toContain("Instandhaltung");
  });

  it("R-9 (c): im Bereich „gesamtes Unternehmen“ kippt die Markierung auf die andere Schaltfläche", async () => {
    const container = await ortszeile({
      available: true,
      path: null,
      spaces: [{ id: "technik", name: "Technik" }],
      scope: "",
      serverCount: null,
    });
    const gedrueckt = [...container.querySelectorAll("button[aria-pressed]")].filter(
      (b) => b.getAttribute("aria-pressed") === "true",
    );
    expect(gedrueckt).toHaveLength(1);
    expect((gedrueckt[0]?.textContent ?? "").trim().length).toBeGreaterThan(0);
  });
});

describe("PRO 381 · R-10 — bei fehlender Ortsprojektion bleibt kein Restknoten", () => {
  it("R-10 (a): `available: false` rendert NICHTS — kein Rahmen, kein Fokusziel", async () => {
    // `Z-4` + `A-10`: fällt die Projektion aus, verschwindet die GANZE Ortsschicht inklusive ihrer
    // Fokusziele. Die Bibliothek verhält sich dann exakt wie heute (das prüft `R-14`). Bliebe ein
    // leerer, fokussierbarer Rest stehen, liefe die Tastaturbedienung in ein Loch, das nichts tut.
    const container = await ortszeile({
      available: false,
      path: KETTE,
      spaces: [{ id: "technik", name: "Technik" }],
      scope: "instandhaltung",
      serverCount: 128,
    });
    expect(container.innerHTML).toBe("");
    expect(fokusziele(container)).toHaveLength(0);
  });

  it("R-10 (b): und zwar auch dann, wenn Pfad, Räume und Zahl vollständig anliegen", async () => {
    // Die Verschärfung: `available: false` gewinnt gegen JEDE andere Prop. Sonst hinge die
    // fail-closed-Zusage daran, dass der Aufrufer zusätzlich alles andere leerräumt — also an
    // Disziplin statt an Bauform (§5.2 Regel 3).
    const container = await ortszeile({
      available: false,
      path: KETTE,
      spaces: [
        { id: "a", name: "Technik" },
        { id: "b", name: "Instandhaltung" },
      ],
      scope: "a",
      serverCount: 7,
    });
    expect(container.textContent ?? "").toBe("");
    expect(container.querySelectorAll("*")).toHaveLength(0);
  });
});
