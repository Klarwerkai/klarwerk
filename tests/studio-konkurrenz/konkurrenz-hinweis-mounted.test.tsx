// @vitest-environment jsdom
// ================================================================================================
// JOB 3123 · Q5c — DER STILLE VERLUST BEKOMMT EINEN EHRLICHEN SATZ
// ================================================================================================
//
// DIE ENTSCHEIDUNG BLEIBT, WIE SIE IST: hat die Autorin im Studio gearbeitet und hat sich der Rumpf
// draußen geändert, gewinnt IHRE Eingabe. Nachgezogen wird nichts, gemischt wird nichts. Neu ist
// allein, dass die Fläche es SAGT — vorher verschwand die fremde Fassung wortlos, und die Autorin
// konnte nicht wissen, dass ihr Klick auf „In den Entwurf übernehmen" etwas überschreibt.
//
// Der Ausgangszustand, an dem diese Datei rot war, ist eine einzige Zeile in
// `KnowledgeInputStudio.tsx`: `if (bodyHtml === herkunft || draft !== herkunft) { return; }` — der
// dritte Fall lief in einen stummen `return`. Gegenprobe 1 stellt genau ihn wieder her.
//
// GEMESSEN WIRD AM GEMOUNTETEN BAUTEIL, nicht am Zustandsobjekt (Lehre aus JOB 3118 R1 und
// 3113 R3): jeder Fall unten liest den gerenderten Text der Fläche und das, was der Verbraucher
// bekommt — nie eine Absicht, nie einen internen Merker.
//
// react/react-dom liegen nur in `apps/web/node_modules` — relativer Import wie in allen gemounteten
// Editor-Tests seit WP-D8b.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Profiler, act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { D44_EDITOR_MARKE } from "../../apps/web/src/components/D44Gliederung";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = "<p>Der gemeinsame Ausgangstext.</p>";
const IHR_STAND = "<p>Was die Autorin selbst geschrieben hat.</p>";
const FREMD = "<p>Eine Fassung, die draussen entstanden ist.</p>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** Der Zustand des Verbrauchers — das, was gespeichert würde. Kein Editor-DOM. */
let koerper = "";
/** Die Fremdquelle: „draußen ändert sich der Rumpf" (Revision, zweiter Editor, Vorlage, KI). */
let setzeRumpfVonAussen: ((next: string) => void) | null = null;
let studioOffen: ((offen: boolean) => void) | null = null;
/** Jede Übernahme, in Reihenfolge — `onApply` ist der einzige Weg aus dem Studio hinaus. */
let uebernommen: string[] = [];
/** Jeder abgeschlossene Renderdurchgang des Baums um das Studio (React `Profiler`, `onRender`). */
let studioCommits = 0;

function Host(): JSX.Element {
  const [body, setBody] = useState(START);
  const [offen, setOffen] = useState(false);
  koerper = body;
  setzeRumpfVonAussen = setBody;
  studioOffen = setOffen;
  return createElement(
    Profiler,
    {
      id: "studio",
      onRender: () => {
        studioCommits += 1;
      },
    },
    mitBildbeschreibung(
      createElement(KnowledgeInputStudio, {
        open: offen,
        onClose: () => setOffen(false),
        bodyHtml: body,
        onApply: (next: string) => {
          uebernommen.push(next);
          setBody(next);
        },
        runAssist: async () => "",
        documentTitle: "Wartungsnotiz",
      }),
    ),
  );
}

function mount(welcher: () => JSX.Element = Host): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
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
            createElement(MemoryRouter, { initialEntries: ["/wissen/1"] }, createElement(welcher)),
          ),
        ),
      ),
    ),
  );
}

beforeEach(async () => {
  uebernommen = [];
  koerper = "";
  studioCommits = 0;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setzeRumpfVonAussen = null;
  studioOffen = null;
});

/** Der contenteditable-Knoten IM Studio (hinter der D44-Marke). */
function studioEditor(): HTMLElement {
  const flaeche = document.querySelector(`[${D44_EDITOR_MARKE}]`);
  const el = flaeche?.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Der Studio-Editor ist nicht gerendert (Studio zu?)");
  }
  return el;
}

/** Die Autorin tippt im Studio: DOM ändern und `input` feuern — derselbe Weg wie ein Anschlag. */
function tippeImStudio(html: string): void {
  act(() => {
    const el = studioEditor();
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Der Hinweis, wie ihn die Autorin sieht — oder `null`, wenn er nicht dasteht. */
function konflikthinweis(): HTMLElement | null {
  const el = document.querySelector('[data-testid="studio-fremdfassung-konflikt"]');
  return el instanceof HTMLElement ? el : null;
}

function uebernehmenKnopf(): HTMLElement {
  const label = i18n.t("studio.apply");
  for (const b of document.querySelectorAll("button")) {
    if ((b.textContent ?? "").trim() === label) {
      return b as HTMLElement;
    }
  }
  throw new Error("Der Übernehmen-Knopf ist nicht da");
}

function oeffneStudio(): void {
  act(() => studioOffen?.(true));
}

describe("JOB 3123 · Q5c: der Konflikt im Studio wird gesagt, nicht verschwiegen", () => {
  it("K1: im Studio getippt UND der Rumpf ändert sich draußen → der Hinweis steht, der Entwurf bleibt ihrer", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    // Vor der fremden Änderung gibt es nichts zu sagen.
    expect(konflikthinweis()).toBeNull();

    act(() => setzeRumpfVonAussen?.(FREMD));

    // (a) Die Fläche sagt es — sichtbarer Satz, kein Schlüsselname, keine bloße Farbe.
    const hinweis = konflikthinweis();
    expect(hinweis).not.toBeNull();
    expect(hinweis?.textContent ?? "").toContain("neuere Fassung");
    // (b) Und die Entscheidung ist unverändert: ihr Entwurf steht, nachgezogen wurde nichts.
    expect(studioEditor().innerHTML).toContain("Was die Autorin selbst geschrieben hat");
    expect(studioEditor().innerHTML).not.toContain("draussen entstanden");
  });

  it("K2: im Studio getippt, aber draußen ändert sich nichts → kein Hinweis (und nirgends eine Entwarnung)", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    tippeImStudio("<p>Und noch ein Satz von ihr.</p>");

    expect(konflikthinweis()).toBeNull();
    // Die Abwesenheit ist gepinnt, NICHT eine Gegenaussage: „keine fremden Änderungen", „aktuell"
    // oder „auf dem neuesten Stand" darf nirgends stehen — die Fläche weiß nicht, was sie nie
    // bekommen hat (§9 des Auftrags).
    const sichtbar = document.body.textContent ?? "";
    expect(sichtbar).not.toContain("auf dem neuesten Stand");
    expect(sichtbar).not.toContain("Keine fremden Änderungen");
  });

  it("K2b: die Endstelle kostet nichts — ein Anschlag im Studio bleibt bei EINEM Renderdurchgang", () => {
    // RUNDE 2: die Endstelle läuft jetzt bei JEDEM Effektlauf statt nur im Konfliktzweig. Das ist
    // nur dann unbedenklich, wenn ihr `setKonflikt(false)` bei bereits falschem Wert wirklich
    // nichts auslöst. Gemessen, nicht behauptet — dasselbe Verfahren wie K7 am Editor.
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);

    const kosten: number[] = [];
    for (const satz of ["<p>Zweiter Satz.</p>", "<p>Dritter Satz.</p>", "<p>Vierter Satz.</p>"]) {
      const vorher = studioCommits;
      tippeImStudio(satz);
      kosten.push(studioCommits - vorher);
    }
    expect(kosten).toEqual([1, 1, 1]);
  });

  it("K3: NICHT getippt und der Rumpf ändert sich → das Studio zieht nach (JOB 3083) und meldet keinen Konflikt", () => {
    mount();
    oeffneStudio();
    expect(studioEditor().innerHTML).toContain("gemeinsame Ausgangstext");

    act(() => setzeRumpfVonAussen?.(FREMD));

    expect(studioEditor().innerHTML).toContain("draussen entstanden");
    expect(konflikthinweis()).toBeNull();
  });

  it("K4: der Hinweis bleibt stehen — ein weiterer Renderlauf ohne neue fremde Änderung nimmt ihn nicht weg", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    act(() => setzeRumpfVonAussen?.(FREMD));
    expect(konflikthinweis()).not.toBeNull();

    // Sie schreibt weiter. Der Effekt läuft dabei mehrfach OHNE neuen Befund — genau die Stelle,
    // an der ein Hinweis, den jeder Durchlauf löscht, verschwände, bevor sie ihn gelesen hat.
    tippeImStudio("<p>Sie schreibt einfach weiter, ohne hinzusehen.</p>");
    expect(konflikthinweis()).not.toBeNull();
    tippeImStudio("<p>Und noch einen Satz dazu.</p>");
    expect(konflikthinweis()).not.toBeNull();
    expect(studioEditor().innerHTML).not.toContain("draussen entstanden");
  });

  it("K5: übernehmen → `onApply` bekommt IHREN Stand, das Studio schließt, und beim nächsten Öffnen ist der Hinweis fort", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    act(() => setzeRumpfVonAussen?.(FREMD));
    expect(konflikthinweis()).not.toBeNull();

    act(() => uebernehmenKnopf().click());

    // Der informierte Klick tut genau das, was der Satz angekündigt hat — nicht mehr und nicht
    // weniger: ihr Stand geht hinaus, die fremde Fassung ist überschrieben.
    expect(uebernommen).toHaveLength(1);
    expect(uebernommen[0]).toContain("Was die Autorin selbst geschrieben hat");
    expect(koerper).toContain("Was die Autorin selbst geschrieben hat");
    expect(document.querySelector(`[${D44_EDITOR_MARKE}]`)).toBeNull();

    oeffneStudio();
    expect(konflikthinweis()).toBeNull();
    expect(studioEditor().innerHTML).toContain("Was die Autorin selbst geschrieben hat");
  });

  it("K9: der Hinweis endet auch ohne Schließen — schreibt sie ihren Entwurf auf den Stand des Rumpfes, gibt es nichts mehr zu überschreiben", () => {
    // Die zweite der drei Endstellen aus §5.3, und die einzige, die OHNE Schließen greift. Ohne
    // diesen Fall wäre `setKonflikt(draft !== bodyHtml)` eine ungemessene Behauptung.
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    act(() => setzeRumpfVonAussen?.(FREMD));
    expect(konflikthinweis()).not.toBeNull();

    // Sie entscheidet sich um und schreibt genau das, was draußen steht. Jetzt überschreibt ein
    // Klick auf „In den Entwurf übernehmen" nichts mehr — der Satz wäre ab hier falsch.
    tippeImStudio(FREMD);
    // Dass Entwurf und Rumpf jetzt wirklich zusammenfallen, liest der Test an der Fläche ab: der
    // vorhandene Dirty-Status meldet „keine unübernommenen Änderungen" (`studio.state.clean`).
    expect(document.body.textContent ?? "").toContain(i18n.t("studio.state.clean"));
    expect(konflikthinweis()).toBeNull();
  });

  // ── RUNDE 2 (bens Korrekturpflicht 1): DIE ZWEI WEGE ZURÜCK ZUR GLEICHHEIT ──────────────────
  //
  // K9 oben prüft NUR die direkte Angleichung an die Fremdfassung — den Weg, der durch den Zweig
  // „beide Seiten haben sich bewegt" läuft. Ben hat zwei weitere Wege gemessen, die zur selben
  // Gleichheit führen und den Satz trotzdem stehen ließen. Der Satz behauptet dann ein
  // bevorstehendes Überschreiben, obwohl beide Fassungen identisch sind — eine falsche
  // Tatsachenaussage, nicht bloß ein alter Befund. Beide Wege haben gemeinsam, dass sie NICHT durch
  // den Konfliktzweig laufen: der eine endet im Nachziehzweig, der andere im frühen Rücksprung
  // „nichts Fremdes beobachtet". Deshalb messen sie die Endstelle und nicht den Befund.
  it("K10: sie nimmt ihre eigene Änderung zurück → das Studio zieht nach (JOB 3083), und der Satz endet mit ihr", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    act(() => setzeRumpfVonAussen?.(FREMD));
    expect(konflikthinweis()).not.toBeNull();

    // Sie verwirft ihren eigenen Satz und stellt die Ausgangsfassung wieder her. Ihr Entwurf ist
    // damit wieder eine unveränderte Kopie der Herkunft — der Nachziehfall aus JOB 3083 greift und
    // holt die fremde Fassung. Ab dieser Zeile steht nichts mehr auf dem Spiel.
    tippeImStudio(START);

    expect(studioEditor().innerHTML).toContain("draussen entstanden");
    // Dass Entwurf und Rumpf zusammengefallen sind, liest der Test an der Fläche ab (wie K9).
    expect(document.body.textContent ?? "").toContain(i18n.t("studio.state.clean"));
    expect(konflikthinweis()).toBeNull();
  });

  it("K11: erst der Rumpf, dann sie kehren zur Ausgangsfassung zurück → solange sie abweicht steht der Satz, danach nicht mehr", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    act(() => setzeRumpfVonAussen?.(FREMD));
    expect(konflikthinweis()).not.toBeNull();

    // Draußen wird die fremde Änderung zurückgenommen. Ihr Entwurf weicht weiterhin ab, Übernehmen
    // überschreibt also weiterhin etwas: der Satz ist WAHR und darf nicht verschwinden.
    act(() => setzeRumpfVonAussen?.(START));
    expect(konflikthinweis()).not.toBeNull();

    // Jetzt nimmt auch sie ihre Änderung zurück. Beide Fassungen sind gleich — es gibt nichts mehr
    // zu überschreiben, und dieser Weg berührt den Konfliktzweig kein einziges Mal.
    tippeImStudio(START);
    expect(document.body.textContent ?? "").toContain(i18n.t("studio.state.clean"));
    expect(konflikthinweis()).toBeNull();
  });

  it("K8: der Satz erscheint in jeder geführten Sprache als echter Satz — nicht als Schlüsselname", async () => {
    // Je Sprache ein UNABHÄNGIGES Bedeutungsmerkmal, hier im Test ausgeschrieben und nicht aus
    // demselben `i18n`-Wert gelesen, aus dem der Text stammt (Lehre LEHREN.md:146/153): ein
    // vertauschter oder geleerter Katalogwert fiele sonst nicht auf.
    const merkmale: Array<[string, string]> = [
      ["de", "neuere Fassung"],
      ["en", "newer version"],
      ["nl", "nieuwere versie"],
    ];
    for (const [sprache, merkmal] of merkmale) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      mount();
      oeffneStudio();
      tippeImStudio(IHR_STAND);
      act(() => setzeRumpfVonAussen?.(FREMD));

      const text = konflikthinweis()?.textContent ?? "";
      expect(text, `Sprache ${sprache}`).toContain(merkmal);
      expect(text, `Sprache ${sprache}`).not.toContain("studio.fremdfassung");
      expect(text.length, `Sprache ${sprache}`).toBeGreaterThan(20);

      act(() => root.unmount());
      container.remove();
    }
    // Der letzte Durchgang hat schon abgebaut; `afterEach` braucht trotzdem einen Baum.
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    mount();
  });
});

// ── LIEFERUNG 4: DERSELBE STUMME VERLUST IM EDITOR ──────────────────────────────────────────────
//
// Seit JOB 3107 wartet eine von außen gekommene Fassung im Editor, solange die Einfügemarke liegt
// (`vertagteFremdfassungRef`). Tippt die Autorin weiter, stirbt diese Fassung in `emit()` — richtig
// entschieden, ihr Text gewinnt, aber bis heute ohne ein Wort.
//
// DIE BEDINGUNG IST DER KERN, nicht der Satz: `emit()` hängt an JEDEM Tastendruck. Ein
// bedingungsloser Zustandssetzer dort meldete den Verlust bei jedem Zeichen, ohne dass je etwas
// verloren gegangen wäre — genau das misst K7.
let editorContainer: HTMLDivElement;
let editorRoot: ReturnType<typeof createRoot>;
let editorSetValue: ((next: string) => void) | null = null;
/** Jeder abgeschlossene Renderdurchgang des Baums um den Editor (React `Profiler`, `onRender`). */
let commits = 0;

function EditorHost({ initial }: { initial: string }): JSX.Element {
  const [value, setValue] = useState(initial);
  editorSetValue = setValue;
  return createElement(
    Profiler,
    {
      id: "editor",
      onRender: () => {
        commits += 1;
      },
    },
    mitBildbeschreibung(
      createElement(RichTextEditor, {
        value,
        documentTitle: "Wartungsnotiz",
        onChange: (html: string) => setValue(html),
      }),
    ),
  );
}

function mountEditor(initial: string): void {
  editorContainer = document.createElement("div");
  document.body.appendChild(editorContainer);
  editorRoot = createRoot(editorContainer);
  act(() => editorRoot.render(createElement(EditorHost, { initial })));
}

function editorEl(): HTMLElement {
  const el = editorContainer.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Der Editor ist nicht gerendert");
  }
  return el;
}

function tippeImEditor(html: string): void {
  act(() => {
    const el = editorEl();
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function verworfenHinweis(): HTMLElement | null {
  const el = editorContainer.querySelector('[data-testid="editor-fremdfassung-verworfen"]');
  return el instanceof HTMLElement ? el : null;
}

describe("JOB 3123 · Q5c: die verworfene Fremdfassung im Editor", () => {
  beforeEach(async () => {
    commits = 0;
    await i18n.changeLanguage("de");
  });

  afterEach(() => {
    act(() => editorRoot.unmount());
    editorContainer.remove();
    editorSetValue = null;
  });

  it("K6: Fokus im Editor → Fassung von außen (wird vertagt) → sie tippt → der Satz steht da, und im Editor steht IHR Text", () => {
    mountEditor("<p>Alter Stand der Autorin</p>");
    const el = editorEl();
    act(() => el.focus());
    expect(document.activeElement).toBe(el);

    // Solange die Einfügemarke steht, wird nicht unter ihr geschrieben (WP-D8) — die Fassung ist
    // vertagt, nicht verworfen (JOB 3107).
    act(() => editorSetValue?.(FREMD));
    expect(el.innerHTML).toContain("Alter Stand");
    expect(verworfenHinweis()).toBeNull();

    // Jetzt tippt sie. Ab hier ist die vertagte Fassung fort — und das wird gesagt.
    tippeImEditor(IHR_STAND);

    const hinweis = verworfenHinweis();
    expect(hinweis).not.toBeNull();
    expect(hinweis?.textContent ?? "").toContain("neuere Fassung");
    expect(editorEl().innerHTML).toContain("Was die Autorin selbst geschrieben hat");
    expect(editorEl().innerHTML).not.toContain("draussen entstanden");
  });

  it("K6b: wird die Fremdfassung später wirklich geschrieben, endet der Satz — sonst behauptete er einen Verlust, den es nicht mehr gibt", () => {
    // Bens Prüflücke 6 aus Runde 1: die Rücksetzung in `schreibeFremdfassung` war gebaut, aber
    // ungemessen. Sie ist zwingend, weil der Satz „der eigene Text ist geblieben" ab dem Moment
    // falsch ist, in dem der Inhalt durch eine Fassung von außen ersetzt wurde.
    mountEditor("<p>Alter Stand der Autorin</p>");
    act(() => editorEl().focus());
    act(() => editorSetValue?.(FREMD));
    tippeImEditor(IHR_STAND);
    expect(verworfenHinweis()).not.toBeNull();

    // Die Einfügemarke verlässt den Editor; jetzt darf von außen wirklich geschrieben werden.
    act(() => editorEl().blur());
    act(() => editorSetValue?.("<p>Die Fassung von draussen, zweiter Anlauf.</p>"));

    expect(editorEl().innerHTML).toContain("zweiter Anlauf");
    expect(verworfenHinweis()).toBeNull();
  });

  it("K7: ohne vertagte Fassung meldet nichts — mehrere Anschläge, kein Hinweis, kein zusätzlicher Renderdurchgang je Anschlag", () => {
    mountEditor("<p>Alter Stand der Autorin</p>");
    act(() => editorEl().focus());

    const kosten: number[] = [];
    for (const satz of ["<p>Erster Satz.</p>", "<p>Zweiter Satz.</p>", "<p>Dritter Satz.</p>"]) {
      const vorher = commits;
      tippeImEditor(satz);
      kosten.push(commits - vorher);
    }

    // (a) Keine Falschmeldung: es ist nie eine Fassung verloren gegangen, also steht da nichts.
    expect(verworfenHinweis()).toBeNull();
    // (b) DAS RENDERBUDGET JE ANSCHLAG IST UNVERÄNDERT, und zwar für JEDEN — auch für den ERSTEN.
    //     Die Zahlen sind GEMESSEN, nicht gesetzt, und die Asymmetry gehört zur ehrlichen Auskunft:
    //     der erste Anschlag kostet einen Durchgang mehr als die folgenden — das ist der Weg vom
    //     Ausgangs-`value` zu seiner sanitisierten Form und liegt vor dieser Lieferung genauso
    //     (nachgemessen am Stand ohne sie). Danach kostet ein Anschlag genau einen Durchgang: die
    //     Emission nach oben. Ein Zustandssetzer, der bei JEDEM Anschlag liefe, käme hier oben
    //     drauf — bei dem Anschlag, an dem er den Wert wirklich verstellt.
    expect(kosten).toEqual([2, 1, 1]);
  });

  it("K7b: weggeklickt heisst 'diesen Befund kenne ich' — ein neuer Vorfall oeffnet den Hinweis wieder", () => {
    mountEditor("<p>Alter Stand der Autorin</p>");
    act(() => editorEl().focus());
    act(() => editorSetValue?.(FREMD));
    tippeImEditor(IHR_STAND);
    expect(verworfenHinweis()).not.toBeNull();

    const zu = verworfenHinweis()?.querySelector("button");
    if (!(zu instanceof HTMLElement)) {
      throw new Error("Der Schließen-Knopf des Hinweises fehlt");
    }
    act(() => zu.click());
    expect(verworfenHinweis()).toBeNull();

    // Zweiter Vorfall: wieder eine Fassung von außen bei liegender Einfügemarke, wieder getippt.
    act(() => editorSetValue?.("<p>Noch eine Fassung von draussen.</p>"));
    tippeImEditor("<p>Und sie schreibt trotzdem ihres.</p>");
    expect(verworfenHinweis()).not.toBeNull();
  });

  it("K8b: auch dieser Satz steht in jeder geführten Sprache als echter Satz", async () => {
    const merkmale: Array<[string, string]> = [
      ["de", "neuere Fassung"],
      ["en", "newer version"],
      ["nl", "nieuwere versie"],
    ];
    for (const [sprache, merkmal] of merkmale) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      mountEditor("<p>Alter Stand der Autorin</p>");
      act(() => editorEl().focus());
      act(() => editorSetValue?.(FREMD));
      tippeImEditor(IHR_STAND);

      const text = verworfenHinweis()?.textContent ?? "";
      expect(text, `Sprache ${sprache}`).toContain(merkmal);
      expect(text, `Sprache ${sprache}`).not.toContain("editor.fremdfassung");
      expect(text.length, `Sprache ${sprache}`).toBeGreaterThan(20);

      act(() => editorRoot.unmount());
      editorContainer.remove();
    }
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    mountEditor("<p>Alter Stand der Autorin</p>");
  });
});
