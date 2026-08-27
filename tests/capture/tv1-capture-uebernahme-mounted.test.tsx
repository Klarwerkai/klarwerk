// @vitest-environment jsdom
// ================================================================================================
// JOB 2419 · D1 — TV1: DIE ÜBERNAHME IN DEN ENTWURF VON `Capture.tsx`.
// ================================================================================================
//
// WAS DIESER TEST BELEGT UND WAS NICHT — vorweg, damit niemand mehr hineinliest, als drinsteht:
//
//   BELEGT     Der Ausdruck, mit dem `Capture.tsx` den Titelvorschlag uebernimmt, schreibt ihn in
//              das Titelfeld des Entwurfs UND laesst den Rest des Entwurfs unangetastet.
//   NICHT      Dass `Capture.tsx` diesen Ausdruck wirklich uebergibt. Das prueft
//              `tests/app/tv1-reichweite-einbindungen.test.tsx` (Teil C, fail-closed) — dort ist
//              es eine Namenspruefung, und dort steht auch, warum sie das sein muss.
//
// WARUM DIE ZWEITE ZUSICHERUNG DIE WICHTIGERE IST: Der Entwurf in `Capture.tsx` ist ein
// `StructureResult` — Titel, Kernaussage, Bedingungen, Massnahmen, Schlagwoerter. Ein Uebernehmen,
// das `setDraft({ title })` statt `setDraft({ ...draft, title })` schriebe, sähe im Titelfeld
// richtig aus und haette alles andere geloescht. Das ist kein erfundener Fall: beide Titelfelder
// von `Capture.tsx` (`:5323` und `:5637`) schreiben genau so, und der Uebernahme-Weg musste
// wortgleich dazu gebaut werden — eine Uebernahme muss sich verhalten wie eine Eingabe.
//
// DER AUSDRUCK IST WORTGLEICH DER AUS `Capture.tsx`. Steht er dort eines Tages anders da, faellt
// das nicht hier auf, sondern beim Lesen — deshalb nennt der Kopf dieser Datei die Fundstellen.
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

/** Der Entwurf, so schmal wie noetig — aber mit mehr als nur dem Titel. */
interface Entwurf {
  title: string;
  statement: string;
  tags: string[];
}

const ENTWURF_VORHER: Entwurf = {
  title: "Entwurf",
  statement: "Die Pumpe faellt bei Frost aus.",
  tags: ["wartung", "frost"],
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let zuletzt: Entwurf = ENTWURF_VORHER;

function Host(): JSX.Element {
  const [value, setValue] = useState(EINE_FIGUR);
  const [draft, setDraft] = useState<Entwurf>(ENTWURF_VORHER);
  zuletzt = draft;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      onChange: setValue,
      documentTitle: draft.title,
      // WORTGLEICH mit `apps/web/src/pages/Capture.tsx:5422` und `:5653`.
      onTitelVorschlag: (titel: string) => setDraft({ ...draft, title: titel }),
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
  zuletzt = ENTWURF_VORHER;
});

describe("JOB 2419 · TV1 — die Uebernahme in den Entwurf von Capture", () => {
  it("VOR dem Klick bleibt der Entwurf unberuehrt — ein Vorschlag setzt nichts von allein", async () => {
    mount();

    await vorschlagAnfordern();

    expect(marke("caption-form-title-suggestion")).not.toBeNull();
    expect(zuletzt).toEqual(ENTWURF_VORHER);
  });

  it("AUF KLICK steht der Titel im Entwurf — und der REST des Entwurfs ist unveraendert", async () => {
    mount();
    await vorschlagAnfordern();

    const knopf = marke("caption-form-title-adopt");
    expect(knopf, "ohne Knopf gaebe es keinen Weg, den Vorschlag zu nehmen").not.toBeNull();
    await act(async () => {
      (knopf as HTMLButtonElement).click();
    });

    expect(zuletzt.title).toBe("Ein Kegelradgetriebe");
    // DAS ist der Fall, den ein blosser Titelvergleich uebersehen wuerde: `setDraft({ title })`
    // statt `setDraft({ ...draft, title })` saehe oben richtig aus und haette hier alles geloescht.
    expect(zuletzt.statement, "die Kernaussage darf die Uebernahme nicht kosten").toBe(
      ENTWURF_VORHER.statement,
    );
    expect(zuletzt.tags, "und die Schlagwoerter auch nicht").toEqual(ENTWURF_VORHER.tags);
  });

  it("der uebernommene Titel ist auch der, mit dem der Editor weiterarbeitet", async () => {
    // `documentTitle` speist den Dokumentkontext des naechsten Bildbeschreibungs-Vorschlags
    // (`collectImageContext`). Bliebe er auf dem alten Wert stehen, waere die Uebernahme nur
    // halb angekommen — sichtbar im Feld, unsichtbar fuer die naechste Ableitung.
    mount();
    await vorschlagAnfordern();
    await act(async () => {
      (marke("caption-form-title-adopt") as HTMLButtonElement).click();
    });

    expect(zuletzt.title).toBe("Ein Kegelradgetriebe");
    expect(zuletzt.title).not.toBe(ENTWURF_VORHER.title);
  });
});
