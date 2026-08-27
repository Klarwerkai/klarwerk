// @vitest-environment jsdom
// ================================================================================================
// JOB 2412 · D1 — TV1: ERREICHT DER TITELVORSCHLAG ALLE FLÄCHEN, DIE DEN EDITOR EINBINDEN?
// ================================================================================================
//
// WORAUS DIESER TEST ENTSTAND: JOB 2402 hat den Titelvorschlag sichtbar gemacht und ihn an EINER
// Fläche verdrahtet — der Vordertür. In derselben Rückgabe stand als Fund, dass es vier weitere
// Einbindungen desselben Editors gibt. Ein Vorschlag, der an einer von fünf Flächen erscheint, ist
// für den Menschen an den anderen vier nicht vorhanden.
//
// WARUM ES DIESEN TEST BRAUCHT, OBWOHL `mega84-bildbeschreibungsweg-sammler` SCHON JEDE EINBINDUNG
// ZÄHLT: Jener Sammler ist fail-closed gegen NEUE Einbindungen — jede braucht eine Disposition,
// sonst wird er rot. Er prüft aber NICHT, ob eine Einbindung den Titelvorschlag führt. Eine neue
// Fläche bekäme dort einen Satz Text und wäre grün, während der Vorschlag dort still fehlt. Genau
// diese Lücke — „gebaut, richtig, und an vier von fünf Stellen wirkungslos" — ist die Bauart, aus
// der TV1 überhaupt entstanden ist.
//
// DREI TEILE, UND NUR DER MITTLERE IST VERHALTEN:
//   A  ERHEBUNG   — welche Einbindungen gibt es, und welche führen den Übernahme-Weg? (Quelltext)
//   B  VERHALTEN  — was bekommt ein Mensch in beiden Fällen wirklich? (echter React-Mount)
//   C  WÄCHTER    — eine neue Einbindung ohne Übernahme-Weg und ohne Begründung wird rot.
//
// TEIL A UND C SIND NAMENSPRÜFUNGEN, UND ICH SAGE DAS. Ein Wächter kann keine Fläche montieren,
// die es noch nicht gibt; er kann nur verlangen, dass jede Einbindung ihre Haltung ERKLÄRT. Was
// diese Haltung praktisch bedeutet, misst Teil B — dort wird wirklich geklickt.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (Default-Sprache de).
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WEB_SRC = join(import.meta.dirname, "../../apps/web/src");

// ================================================================================================
// TEIL A — DIE ERHEBUNG
// ================================================================================================

interface Einbindung {
  datei: string;
  zeile: number;
  /** Fuehrt diese Einbindung den Uebernahme-Weg `onTitelVorschlag`? */
  traegtUebernahme: boolean;
}

function tsxDateien(wurzel: string): string[] {
  const treffer: string[] = [];
  for (const eintrag of readdirSync(wurzel)) {
    const pfad = join(wurzel, eintrag);
    if (statSync(pfad).isDirectory()) {
      treffer.push(...tsxDateien(pfad));
    } else if (eintrag.endsWith(".tsx") && !eintrag.includes(".test.")) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

/**
 * Der Propblock einer Einbindung.
 *
 * Die Grenze ist die EINRÜCKUNG des schliessenden `/>`: sie muss der des oeffnenden
 * `<RichTextEditor` gleichen. Ohne diese Bedingung endete der Block beim ersten `/>` einer
 * VERSCHACHTELTEN Komponente — `aiPanel={<AiAssistBox … />}` kommt in zwei der fuenf Einbindungen
 * vor, und der Block waere dort zu frueh zu Ende.
 */
function propblock(zeilen: string[], start: number): string {
  const einrueckung = (zeilen[start] ?? "").match(/^\s*/)?.[0] ?? "";
  const ende = `${einrueckung}/>`;
  for (let i = start + 1; i < zeilen.length; i += 1) {
    if ((zeilen[i] ?? "") === ende) {
      return zeilen.slice(start, i + 1).join("\n");
    }
  }
  throw new Error(`Einbindung ab Zeile ${start + 1} hat kein schliessendes /> auf gleicher Ebene`);
}

function erhebeEinbindungen(): Einbindung[] {
  const gefunden: Einbindung[] = [];
  for (const pfad of tsxDateien(WEB_SRC).sort()) {
    const zeilen = readFileSync(pfad, "utf-8").split("\n");
    zeilen.forEach((zeile, i) => {
      if (!zeile.trimStart().startsWith("<RichTextEditor")) {
        return;
      }
      const block = propblock(zeilen, i);
      gefunden.push({
        datei: pfad.slice(pfad.indexOf("apps/web/src")),
        zeile: i + 1,
        traegtUebernahme: /\bonTitelVorschlag\b/.test(block),
      });
    });
  }
  return gefunden;
}

// ================================================================================================
// TEIL C — DIE HALTUNG JEDER EINBINDUNG, DIE DEN UEBERNAHME-WEG NICHT FUEHRT.
//
// Ein Eintrag hier heisst NICHT „erledigt". Er heisst: jemand hat hingesehen und den Grund
// aufgeschrieben. Fehlt der Eintrag, wird der Waechter rot — und zwar bevor die Fläche in Betrieb
// geht, nicht vier Wochen spaeter.
// ================================================================================================

const OHNE_UEBERNAHME: Record<string, string> = {
  "apps/web/src/components/KnowledgeInputStudio.tsx":
    "BEGRUENDETE AUSNAHME, gemessen in JOB 2426 D1 — kein offener Rest. Das Studio hat KEIN eigenes Titelfeld: es bearbeitet ausschliesslich `bodyHtml` und gibt es ueber `onApply` zurueck; den Titel kennt es nur lesend als Pflicht-Prop `documentTitle` (mega84 Block C, fuer den Dokumentkontext). Dazu ist es eine ueberdeckende Flaeche (`fixed inset-0 z-50`, :161) — das Titelfeld der Elternflaeche ist unsichtbar, solange es offen steht. Ein Uebernehmen-Knopf schriebe also in ein Feld, das der Nutzer im Moment des Klicks nicht sieht: eine Aenderung ohne sichtbare Wirkung, genau die Scheinwahl, gegen die diese ganze Reihe gebaut ist. Der Vorschlag bleibt im Studio LESBAR und kann nach dem Schliessen an der Elternflaeche uebernommen werden, die den Weg seit JOB 2419/2426 fuehrt. Soll das Studio ein eigenes Titelfeld bekommen, ist das eine neue Flaeche und ein eigener Auftrag. BELEG fuer den Satz 'bleibt LESBAR', seit JOB 2440: tests/capture/tv1-ohne-uebernahmeweg-mounted.test.tsx mountet den Editor OHNE onTitelVorschlag — also in genau dieser Bauart — und sichert, dass Negativsatz und Vorschlagstext dieselben sind wie mit Ziel und nur der Knopf fehlt. Bis dahin ruhte diese Ausnahme auf Quelltextlesen.",
};

// ================================================================================================
// TEIL B — DAS VERHALTEN. Was bekommt ein Mensch in beiden Faellen wirklich?
// ================================================================================================

const EINE_FIGUR =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">A</figcaption></figure>';

const MIT_TITEL: DescribeImageResult = {
  text: "Ein Kegelradgetriebe. Daneben liegt ein Schlüssel.",
  demo: false,
  titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({ onTitelVorschlag }: { onTitelVorschlag?: (titel: string) => void }) {
  const [value, setValue] = useState(EINE_FIGUR);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      onChange: setValue,
      documentTitle: "Wartungsnotiz",
      ...(onTitelVorschlag ? { onTitelVorschlag } : {}),
    }),
    async () => MIT_TITEL,
  );
}

function mount(onTitelVorschlag?: (titel: string) => void): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, onTitelVorschlag ? { onTitelVorschlag } : {}));
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
  if (root) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }
});

// ================================================================================================

describe("JOB 2412 A · die Erhebung — wie viele Einbindungen gibt es, und welche fuehren den Weg", () => {
  it("findet alle Einbindungen und liest je Einbindung, ob sie den Uebernahme-Weg fuehrt", () => {
    const alle = erhebeEinbindungen();

    // KALIBRIERUNG: ohne sie koennte ein Gruen auch davon kommen, dass die Erhebung NICHTS findet.
    expect(
      alle.length,
      "die Erhebung muss die Einbindungen wirklich finden",
    ).toBeGreaterThanOrEqual(5);
    // Und sie muss BEIDE Zustaende sehen — sonst waere ihr Leseausdruck blind fuer einen davon.
    expect(
      alle.some((e) => e.traegtUebernahme),
      "mindestens eine Einbindung fuehrt den Weg (die Vordertuer, JOB 2402)",
    ).toBe(true);
    expect(
      alle.some((e) => !e.traegtUebernahme),
      "und mindestens eine fuehrt ihn nicht — sonst prueft Teil C nichts",
    ).toBe(true);
  });

  it("KALIBRIERUNG — der Propblock endet auf der EIGENEN Ebene, nicht am ersten verschachtelten />", () => {
    // Zwei der fuenf Einbindungen tragen `aiPanel={<AiAssistBox … />}`. Endete der Block dort,
    // liesse die Erhebung spaetere Props aus — und `onTitelVorschlag` steht in der Vordertuer NACH
    // `documentTitle`. Der Fall haelt genau das fest.
    const zeilen = [
      "                <RichTextEditor",
      "                  value={x}",
      "                  aiPanel={",
      "                    <AiAssistBox",
      "                      text={y}",
      "                    />",
      "                  }",
      "                  onTitelVorschlag={z}",
      "                />",
    ];

    expect(propblock(zeilen, 0)).toContain("onTitelVorschlag");
  });
});

describe("JOB 2412 B · das Verhalten — was ein Mensch in beiden Faellen wirklich bekommt", () => {
  it("MIT Uebernahme-Weg: der Vorschlag ist da UND auf Klick zu nehmen", async () => {
    const uebernommen = vi.fn();
    mount(uebernommen);

    await vorschlagAnfordern();

    expect(marke("caption-form-title-suggestion")).not.toBeNull();
    const knopf = marke("caption-form-title-adopt");
    expect(knopf).not.toBeNull();
    await act(async () => {
      (knopf as HTMLButtonElement).click();
    });
    expect(uebernommen).toHaveBeenCalledWith("Ein Kegelradgetriebe");
  });

  it("OHNE Uebernahme-Weg: der Vorschlag ist LESBAR, aber es gibt keinen Weg, ihn zu nehmen", async () => {
    // Das ist die gemessene Bedeutung von „kommt dort nicht an": nicht Schweigen, sondern ein
    // Vorschlag, den der Mensch abtippen muesste. Ein Knopf ohne Ziel waere schlimmer — er sieht
    // aus wie eine Wahl und tut nichts.
    mount();

    await vorschlagAnfordern();

    expect(
      marke("caption-form-title-suggestion"),
      "der Vorschlag bleibt sichtbar — die Ableitung ist ja gelaufen",
    ).not.toBeNull();
    expect(marke("caption-form-title-suggestion")?.textContent ?? "").toContain(
      "Ein Kegelradgetriebe",
    );
    expect(
      marke("caption-form-title-adopt"),
      "ohne Ziel darf kein Knopf erscheinen — eine Scheinwahl waere schlimmer als keine",
    ).toBeNull();
  });
});

describe("JOB 2412 C · der Waechter — eine neue Einbindung muss ihre Haltung erklaeren", () => {
  it("FAIL-CLOSED: jede Einbindung fuehrt den Uebernahme-Weg ODER steht mit Grund in OHNE_UEBERNAHME", () => {
    const unerklaert = erhebeEinbindungen()
      .filter((e) => !e.traegtUebernahme && !OHNE_UEBERNAHME[e.datei])
      .map((e) => `${e.datei}:${e.zeile}`);

    expect(
      unerklaert,
      "Diese Einbindungen fuehren den Titelvorschlag nicht, und niemand hat entschieden, warum. " +
        "Entweder `onTitelVorschlag` reichen oder die Datei mit Grund in OHNE_UEBERNAHME eintragen.",
    ).toEqual([]);
  });

  it("FAIL-CLOSED in der Gegenrichtung: ein Eintrag ohne Einbindung ist ein toter Eintrag", () => {
    // Ohne diesen Fall verrottet die Liste: eine geloeschte oder nachgeruestete Fläche bliebe als
    // Begruendung stehen und deckte spaeter etwas ganz anderes zu.
    const alle = erhebeEinbindungen();
    const tot = Object.keys(OHNE_UEBERNAHME).filter(
      (datei) => !alle.some((e) => e.datei === datei && !e.traegtUebernahme),
    );

    expect(
      tot,
      "Diese Dateien stehen in OHNE_UEBERNAHME, binden den Editor aber nicht (mehr) ohne " +
        "Uebernahme-Weg ein. Eintrag entfernen.",
    ).toEqual([]);
  });

  it("jede Begruendung ist ein Satz, kein Haken", () => {
    // Ein Eintrag „—" oder „ok" waere die Umgehung: die Liste soll das Nachdenken festhalten,
    // nicht seine Abwesenheit.
    for (const [datei, grund] of Object.entries(OHNE_UEBERNAHME)) {
      expect(grund.trim().length, `${datei} braucht einen echten Grund`).toBeGreaterThan(40);
    }
  });
});
