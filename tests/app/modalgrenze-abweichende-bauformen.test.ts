// REGISTER A17b (R-1371 / R-1390 / R-1914) — ABWEICHEND BENANNTE BAUFORMEN UND DAS TOR SELBST.
//
// Stand vor diesem Durchgang, am Code nachgemessen: die Erhebung in `tools/modalgrenze.ts` lief
// über den Syntaxbaum und stand als Gate in `tools/check` vor den Tests. Offen waren drei Dinge:
//
//   (1) Abweichend benannte Bauformen fielen still durch — die DOM-Reflexion `el.ariaModal`, eine
//       Rolle im Ausdruck (`role={offen ? "dialog" : undefined}`), `setAttribute("role", "dialog")`,
//       `el.role = …`, `createElement(\`dialog\`)` und ein Dialog-Name über eine Variable
//       (`const Huelle = "dialog"; <Huelle />`). Keine davon trägt `aria-modal`, `showModal` oder
//       `<dialog`, also sah auch der unabhängige Zähler nichts.
//   (2) Der unabhängige Zähler (`modalAbgleich`) lief NUR im Test. Das Tor meldete eine Bauform,
//       die es nicht lesen konnte, gar nicht — „unbekannte Bauformen mit Datei und Zeile rot im
//       Prüftor" war eine Zusage der Testdatei, nicht des Tors.
//   (3) `pruefeModalgrenze(wurzel)` suchte unter `wurzel`, las aber unter `WURZEL`.
//
// Jeder Fall unten hat einen Negativ-Zwilling: die Erkennung hängt am tragenden Merkmal.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  WEB_SRC,
  WURZEL,
  beurteile,
  erhebeDatei,
  modalAbgleich,
  pruefeModalgrenze,
  quelldateien,
  quelleAus,
} from "../../tools/modalgrenze";
import type { DateiErhebung } from "../../tools/modalgrenze";

const synth = (datei: string, zeilen: string[]): DateiErhebung =>
  erhebeDatei(quelleAus(datei, zeilen.join("\n")));

const arten = (e: DateiErhebung): string[] => e.kandidaten.map((k) => k.art);

describe("Register A17b · abweichend benannte Bauformen werden Kandidat statt still übergangen", () => {
  it("ariaModal (DOM-Reflexion) ist ein Kandidat, ohne Grenze rot mit Datei und Zeile", () => {
    const datei = "apps/web/src/lib/a17bReflexion.ts";
    const mit = synth(datei, [
      "export function markiere(el: HTMLElement): void {",
      '  el.ariaModal = "true";',
      "}",
    ]);
    expect(mit.kandidaten).toEqual([{ datei, zeile: 2, art: "aria-modal-reflexion" }]);
    expect(modalAbgleich(mit), "als Kandidat abgerechnet").toEqual([]);
    const { rot } = beurteile([mit]);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain(`${datei}:2`);

    const alsObjekt = synth("apps/web/src/lib/a17bReflexionObjekt.ts", [
      'export const p = { ariaModal: "true" };',
    ]);
    expect(arten(alsObjekt)).toEqual(["aria-modal-reflexion"]);

    const ohne = synth("apps/web/src/lib/a17bOhneReflexion.ts", [
      "export function markiere(el: HTMLElement): void {",
      '  el.ariaLabel = "Menü";',
      "}",
    ]);
    expect(arten(ohne), "eine andere ARIA-Reflexion ist keine Modalität").toEqual([]);
    expect(beurteile([ohne]).rot).toEqual([]);
  });

  it("eine destrukturierte ariaModal-Bindung ist nicht beurteilbar und wird vom Zähler rot gemeldet", () => {
    const datei = "apps/web/src/lib/a17bDestrukturiert.ts";
    const e = synth(datei, [
      "export function lies(el: HTMLElement): string | null {",
      "  const { ariaModal } = el;",
      "  return ariaModal;",
      "}",
    ]);
    expect(e.kandidaten).toEqual([]);
    const rot = modalAbgleich(e);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain(`${datei}:2,3`);
  });

  it("role im Ausdruck (Bedingung, Template) ist ein Kandidat — mit Negativ-Zwilling", () => {
    const bedingt = synth("apps/web/src/components/A17bRolleBedingt.tsx", [
      "export function Fenster({ offen }: { offen: boolean }): JSX.Element {",
      '  return <div role={offen ? "dialog" : undefined} />;',
      "}",
    ]);
    expect(bedingt.kandidaten).toEqual([
      { datei: "apps/web/src/components/A17bRolleBedingt.tsx", zeile: 2, art: "role-dialog" },
    ]);
    expect(modalAbgleich(bedingt)).toEqual([]);
    expect(beurteile([bedingt]).rot).toHaveLength(1);

    const template = synth("apps/web/src/components/A17bRolleTemplate.tsx", [
      "export function Fenster(): JSX.Element {",
      "  return <div role={`alertdialog`} />;",
      "}",
    ]);
    expect(arten(template)).toEqual(["role-dialog"]);

    const ohne = synth("apps/web/src/components/A17bRolleOhne.tsx", [
      "export function Fenster({ offen }: { offen: boolean }): JSX.Element {",
      '  return <div role={offen ? "region" : undefined} />;',
      "}",
    ]);
    expect(arten(ohne), "role=region ist keine Modalität").toEqual([]);
    expect(modalAbgleich(ohne)).toEqual([]);
  });

  it("setAttribute(„role“, „dialog“) und el.role = „alertdialog“ sind Kandidaten — role=button nicht", () => {
    const mit = synth("apps/web/src/lib/a17bRolleDom.ts", [
      "export function markiere(el: HTMLElement): void {",
      '  el.setAttribute("role", "dialog");',
      '  el.role = "alertdialog";',
      "}",
    ]);
    expect(mit.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual([
      "2:role-dialog",
      "3:role-dialog",
    ]);
    expect(modalAbgleich(mit)).toEqual([]);
    expect(beurteile([mit]).rot).toHaveLength(2);

    // Die Form, die heute im Bestand steht (`lib/editorFigures.ts`), bleibt ohne Befund.
    const ohne = synth("apps/web/src/lib/a17bRolleKnopf.ts", [
      "export function markiere(caption: HTMLElement): void {",
      '  caption.setAttribute("role", "button");',
      "}",
    ]);
    expect(arten(ohne)).toEqual([]);
    expect(modalAbgleich(ohne)).toEqual([]);
  });

  it("createElement mit Template-Literal ist ein dialog-Kandidat", () => {
    const e = synth("apps/web/src/lib/a17bCreateTemplate.ts", [
      'import { createElement } from "react";',
      "export const D = createElement(`dialog`, null);",
    ]);
    expect(arten(e)).toEqual(["dialog-createElement"]);
    expect(modalAbgleich(e)).toEqual([]);
  });

  it("ein Dialog-Name über eine Variable ist eine UNBEKANNTE Bauform — rot mit Datei und Zeile", () => {
    const datei = "apps/web/src/components/A17bHuelle.tsx";
    const tag = synth(datei, [
      'const Huelle = "dialog";',
      "export function Fenster(): JSX.Element {",
      "  return <Huelle open />;",
      "}",
    ]);
    expect(tag.kandidaten, "kein Marker, den eine Bauform erklärt").toEqual([]);
    const rot = modalAbgleich(tag);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain(`${datei}:1`);
    expect(rot[0]).toContain("„dialog“");

    const rolle = synth("apps/web/src/components/A17bRolleVariable.tsx", [
      'const rolle = "alertdialog";',
      "export function Fenster(): JSX.Element {",
      "  return <div role={rolle} />;",
      "}",
    ]);
    expect(modalAbgleich(rolle)).toHaveLength(1);
    expect(modalAbgleich(rolle)[0]).toContain("A17bRolleVariable.tsx:1");

    // Negativ-Zwillinge: ein anderer Name, und das Wort nur als Teil eines Satzes.
    const anders = synth("apps/web/src/components/A17bAnders.tsx", [
      'const Huelle = "section";',
      'export const HINWEIS = "Der dialog öffnet sich";',
      "export function Fenster(): JSX.Element {",
      "  return <Huelle />;",
      "}",
    ]);
    expect(modalAbgleich(anders)).toEqual([]);
  });
});

describe("Register A17b · das Tor selbst meldet, was der Sammler nicht lesen kann", () => {
  const baeume: string[] = [];
  afterEach(() => {
    for (const b of baeume.splice(0)) {
      rmSync(b, { recursive: true, force: true });
    }
  });

  /** Ein echter Baum unter `apps/web/src`, den `pruefeModalgrenze` wie den Bestand liest. */
  const legeBaum = (dateien: Record<string, string[]>): string => {
    const wurzel = mkdtempSync(join(tmpdir(), "modalgrenze-a17b-"));
    baeume.push(wurzel);
    mkdirSync(join(wurzel, WEB_SRC), { recursive: true });
    for (const [pfad, zeilen] of Object.entries(dateien)) {
      mkdirSync(dirname(join(wurzel, pfad)), { recursive: true });
      writeFileSync(join(wurzel, pfad), zeilen.join("\n"));
    }
    return wurzel;
  };

  const ABGEGRENZT = {
    "apps/web/src/components/Fenster.tsx": [
      'import { useModalBoundary } from "../app/ModalBoundaryContext";',
      "export function Fenster(): JSX.Element {",
      "  useModalBoundary();",
      '  return <div aria-modal="true" />;',
      "}",
    ],
  };

  it("KALIBRIERUNG: ein abgegrenzter Baum ist grün — und gelesen wird unter der übergebenen Wurzel", () => {
    // Die Datei existiert nur im temporären Baum. Läse das Tor unter `WURZEL`, bräche es hier ab.
    const ergebnis = pruefeModalgrenze(legeBaum(ABGEGRENZT));
    expect(ergebnis).toEqual({ rot: [], gelesen: 1, kandidaten: 1 });
  });

  it("eine unbekannte Bauform macht das TOR rot, mit Datei und Zeile", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Huelle.tsx": [
          'const Huelle = "dialog";',
          "export function Leer(): JSX.Element {",
          "  return <Huelle />;",
          "}",
        ],
      }),
    );
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/components/Huelle.tsx:1");
  });

  it("eine nicht abrechenbare Erwähnung (destrukturiertes showModal) macht das TOR rot", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/lib/oeffne.ts": [
          "export function oeffne(d: HTMLDialogElement): void {",
          "  const { showModal } = d;",
          "  showModal.call(d);",
          "}",
        ],
      }),
    );
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/lib/oeffne.ts:2,3");
  });

  it("eine leere Erhebung ist rot, nicht grün", () => {
    expect(pruefeModalgrenze(legeBaum({})).rot[0]).toContain("Erhebung leer");
    const ohneKandidat = pruefeModalgrenze(
      legeBaum({ "apps/web/src/lib/nichts.ts": ["export const N = 1;"] }),
    );
    expect(ohneKandidat.gelesen).toBe(1);
    expect(ohneKandidat.rot[0]).toContain("Erhebung leer");
  });

  it("am ECHTEN Bestand: das Tor ist grün, liest jede Quelldatei und beurteilt mindestens sechs Kandidaten", () => {
    const { rot, gelesen, kandidaten } = pruefeModalgrenze();
    expect(rot, "\nDas Tor meldet am heutigen Bestand:\n").toEqual([]);
    expect(gelesen).toBe(quelldateien(WEB_SRC).length);
    expect(kandidaten).toBeGreaterThanOrEqual(6);
  });

  it("der Tor-Einstieg `tools/modalgrenze.sh` startet als Prozess und meldet grün", () => {
    // Genau der Aufruf aus `tools/check` — mit Ausführungsbit, Bash und Node-Typentfernung. Ein
    // Starter ohne Ausführungsrecht fiele hier mit „Permission denied" (Betriebshinweis R-1390).
    const lauf = spawnSync(join(WURZEL, "tools", "modalgrenze.sh"), [], {
      cwd: WURZEL,
      encoding: "utf8",
    });
    expect(lauf.error, "Starter nicht ausführbar").toBeUndefined();
    expect(lauf.status, `${lauf.stdout}\n${lauf.stderr}`).toBe(0);
    expect(lauf.stdout).toContain("✓ Modalgrenze:");
    expect(lauf.stdout).toContain("keine unbekannte Bauform");
  });
});
