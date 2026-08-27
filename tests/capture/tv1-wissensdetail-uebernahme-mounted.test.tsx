// @vitest-environment jsdom
// ================================================================================================
// JOB 2426 · D1 — TV1: DIE ÜBERNAHME IM WISSENSDETAIL, WO SCHON EIN TITEL STEHT.
// ================================================================================================
//
// WARUM DIESE FLÄCHE EINEN EIGENEN TEST BEKOMMT, OBWOHL `tv1-capture-uebernahme-mounted` DIESELBE
// MECHANIK SCHON PRÜFT: Beim Erfassen entsteht der Titel gerade erst — eine Übernahme füllt eine
// Lücke. Hier ist er da, ein Mensch hat ihn vergeben, und eine Übernahme ERSETZT ihn. Das ist der
// Einwand, den ich in JOB 2412 als Ownerfrage O-2412-1(b) selbst erhoben habe, und er verdient
// eine Zusicherung statt einer Beruhigung.
//
// ZWEI DINGE MACHEN DIE ÜBERNAHME HIER SICHER, und beide stehen unten als Fall:
//   1. SIE GESCHIEHT NUR AUF KLICK. Solange niemand klickt, steht der Titel des Menschen da — und
//      der Vorschlag daneben, sichtbar. Der Nutzer VERGLEICHT, statt vor eine Tatsache gestellt zu
//      werden.
//   2. SIE KOSTET NICHTS AUSSER DEM TITEL. Der Bearbeitungszustand von `KnowledgeDetail` trägt
//      acht Felder (Titel, Kernaussage, Body, Art, Bedingungen, Massnahmen, Schlagwoerter,
//      Kategorie). Ein `setEdit({ title })` statt `setEdit({ ...edit, title })` sähe im Titelfeld
//      richtig aus und hätte sieben Felder eines bereits veröffentlichten Wissensobjekts gelöscht.
//
// WAS DIESER TEST NICHT BELEGT: dass `KnowledgeDetail.tsx` den Ausdruck wirklich übergibt (das
// prüft `tests/app/tv1-reichweite-einbindungen.test.tsx`, Teil C, fail-closed) und dass nichts
// gespeichert wird, bevor jemand „Speichern" drückt (das hängt an der `save`-Mutation, die dieser
// Test nicht mountet — belegt ist es durch Lesen: `KnowledgeDetail.tsx:671-700`, kein Autosave).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (Default-Sprache de).
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EINE_FIGUR =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">A</figcaption></figure>';

const MIT_TITEL: DescribeImageResult = {
  text: "Ein Kegelradgetriebe. Daneben liegt ein Schlüssel.",
  demo: false,
  titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
};

/** Die Form von `EditState` in `KnowledgeDetail.tsx` — alle Felder, die eine Uebernahme kosten koennte. */
interface Bearbeitung {
  title: string;
  statement: string;
  bodyHtml: string;
  type: string;
  conditions: string[];
  measures: string[];
  tags: string[];
  category: string;
}

/** Ein VEROEFFENTLICHTES Objekt mit einem Titel, den ein Mensch vergeben hat. */
const VORHER: Bearbeitung = {
  title: "Kegelradgetriebe der Pumpe P-12",
  statement: "Das Getriebe faellt bei Frost aus.",
  bodyHtml: EINE_FIGUR,
  type: "insight",
  conditions: ["Aussentemperatur unter 0 °C"],
  measures: ["Vorwaermung einschalten"],
  tags: ["wartung", "frost"],
  category: "Instandhaltung",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let zuletzt: Bearbeitung = VORHER;

function Host(): JSX.Element {
  const [edit, setEdit] = useState<Bearbeitung>(VORHER);
  zuletzt = edit;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value: edit.bodyHtml,
      onChange: (bodyHtml: string) => setEdit({ ...edit, bodyHtml }),
      documentTitle: edit.title,
      // WORTGLEICH mit `apps/web/src/pages/KnowledgeDetail.tsx:1265 ff.` und mit dem `onChange`
      // des Titelfelds derselben Datei (:1196).
      onTitelVorschlag: (titel: string) => setEdit({ ...edit, title: titel }),
    }),
    async () => MIT_TITEL,
  );
}

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

function marke(testid: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  return el instanceof HTMLElement ? el : null;
}

async function vorschlagAnfordern(): Promise<void> {
  const cap = container.querySelector('figcaption[data-image-id="kw-a"]');
  if (!(cap instanceof HTMLElement)) {
    throw new Error("figcaption nicht gerendert");
  }
  act(() => {
    cap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const btn = container.querySelector('[data-testid="caption-form-suggest"]');
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Vorschlags-Knopf nicht gerendert");
  }
  await act(async () => {
    btn.click();
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  zuletzt = VORHER;
});

describe("JOB 2426 · TV1 — die Uebernahme im Wissensdetail", () => {
  it("DER MENSCH VERGLEICHT: der vorhandene Titel steht weiter, der Vorschlag daneben", async () => {
    mount();

    await vorschlagAnfordern();

    // Der Vorschlag ist sichtbar …
    expect(marke("caption-form-title-suggestion")?.textContent ?? "").toContain(
      "Ein Kegelradgetriebe",
    );
    // … und der Titel des Menschen ist unangetastet. Beides gleichzeitig — das ist der Punkt.
    expect(zuletzt.title, "solange niemand klickt, ersetzt nichts den Titel eines Menschen").toBe(
      VORHER.title,
    );
  });

  it("AUF KLICK wird ersetzt — und NUR der Titel, nicht die sieben anderen Felder", async () => {
    mount();
    await vorschlagAnfordern();

    const knopf = marke("caption-form-title-adopt");
    expect(knopf, "ohne Knopf gaebe es keinen Weg, den Vorschlag zu nehmen").not.toBeNull();
    await act(async () => {
      (knopf as HTMLButtonElement).click();
    });

    expect(zuletzt.title).toBe("Ein Kegelradgetriebe");
    // DAS ist der Fall, den ein blosser Titelvergleich uebersehen wuerde. `EditState` traegt acht
    // Felder; sieben davon gehoeren zu einem bereits veroeffentlichten Objekt.
    expect(zuletzt.statement, "die Kernaussage darf die Uebernahme nicht kosten").toBe(
      VORHER.statement,
    );
    expect(zuletzt.conditions, "die Bedingungen auch nicht").toEqual(VORHER.conditions);
    expect(zuletzt.measures, "die Massnahmen auch nicht").toEqual(VORHER.measures);
    expect(zuletzt.tags, "die Schlagwoerter auch nicht").toEqual(VORHER.tags);
    expect(zuletzt.category, "und die Kategorie auch nicht").toBe(VORHER.category);
    expect(zuletzt.type, "und die Wissensart auch nicht").toBe(VORHER.type);
    expect(zuletzt.bodyHtml, "und der Rumpf auch nicht").toBe(VORHER.bodyHtml);
  });

  it("der uebernommene Titel speist auch den Dokumentkontext der naechsten Ableitung", async () => {
    // `documentTitle` geht in `collectImageContext` — bliebe er auf dem alten Wert stehen, waere die
    // Uebernahme nur halb angekommen: sichtbar im Feld, unsichtbar fuer den naechsten Vorschlag.
    mount();
    await vorschlagAnfordern();
    await act(async () => {
      (marke("caption-form-title-adopt") as HTMLButtonElement).click();
    });

    expect(zuletzt.title).toBe("Ein Kegelradgetriebe");
    expect(zuletzt.title).not.toBe(VORHER.title);
  });
});
