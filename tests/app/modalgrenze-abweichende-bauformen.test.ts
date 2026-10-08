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

  // Nacharbeit (ben): bis hierher wurden diese beiden Formen nur als „unbekannt“ am Literal gemeldet.
  // Jetzt wird der Wert über seine Verwendung verfolgt — sie sind erkannte Kandidaten mit Urteil.
  it("ein Dialog-Name über eine Konstante wird bis zur Verwendung verfolgt — Tag, Rolle, createElement", () => {
    const datei = "apps/web/src/components/A17bHuelle.tsx";
    const tag = synth(datei, [
      'const Huelle = "dialog";',
      "export function Fenster(): JSX.Element {",
      "  return <Huelle open />;",
      "}",
    ]);
    expect(tag.kandidaten).toEqual([{ datei, zeile: 3, art: "dialog-jsx" }]);
    expect(modalAbgleich(tag), "zugeflossen ⇒ keine unbekannte Bauform").toEqual([]);
    expect(beurteile([tag]).rot[0]).toContain(`${datei}:3`);

    const rolle = synth("apps/web/src/components/A17bRolleVariable.tsx", [
      'const rolle = "alertdialog";',
      "export function Fenster(): JSX.Element {",
      "  return <div role={rolle} />;",
      "}",
    ]);
    expect(rolle.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["3:role-dialog"]);
    expect(modalAbgleich(rolle)).toEqual([]);

    const erzeugt = synth("apps/web/src/lib/a17bCreateKonstante.ts", [
      'import { createElement } from "react";',
      'const tag = "dialog";',
      "export const D = createElement(tag, null);",
    ]);
    expect(erzeugt.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual([
      "3:dialog-createElement",
    ]);
    expect(modalAbgleich(erzeugt)).toEqual([]);

    // Negativ-Zwillinge: ein anderer Name, das Wort nur als Teil eines Satzes, und ein Bauteil.
    const anders = synth("apps/web/src/components/A17bAnders.tsx", [
      'import { FacetFilter } from "./FacetFilter";',
      'const Huelle = "section";',
      'export const HINWEIS = "Der dialog öffnet sich";',
      "const Anders = FacetFilter;",
      "export function Fenster(): JSX.Element {",
      "  return <Huelle><Anders /></Huelle>;",
      "}",
    ]);
    expect(anders.kandidaten).toEqual([]);
    expect(modalAbgleich(anders)).toEqual([]);
  });

  it("ein Dialog-Literal, das in KEINE Bauform fliesst, bleibt eine unbekannte Bauform — rot", () => {
    const datei = "apps/web/src/lib/a17bLose.ts";
    const lose = synth(datei, ['export const ART = "dialog";']);
    expect(lose.kandidaten).toEqual([]);
    const rot = modalAbgleich(lose);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain(`${datei}:1`);
    expect(rot[0]).toContain("„dialog“");
  });

  it("bens Befund 2: Typdeklarationen und Vergleiche bauen nichts und sperren das Tor nicht", () => {
    const rein = synth("apps/web/src/lib/a17bTypen.ts", [
      'export type Rolle = "dialog" | "button";',
      "export interface Fenster { art: 'alertdialog' | 'region'; }",
      "export function istDialog(rolle: Rolle): boolean {",
      '  if (rolle === "dialog") { return true; }',
      "  switch (rolle) {",
      '    case "dialog":',
      "      return true;",
      "    default:",
      '      return "alertdialog" !== rolle;',
      "  }",
      "}",
    ]);
    expect(rein.kandidaten).toEqual([]);
    expect(modalAbgleich(rein), "Typ und Vergleich sind kein Bau").toEqual([]);

    // Gegenprobe: derselbe Typ, aber als ROLLE verwendet — das ist ein Bau und wird Kandidat.
    const verwendet = synth("apps/web/src/components/A17bTypVerwendet.tsx", [
      'type Rolle = "dialog" | "button";',
      "export function Fenster({ rolle }: { rolle: Rolle }): JSX.Element {",
      "  return <div role={rolle} />;",
      "}",
    ]);
    expect(verwendet.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["3:role-dialog"]);
    expect(modalAbgleich(verwendet)).toEqual([]);
  });
});

describe("Register A17b · Nacharbeit (ben Befund 1): Rollenwerte werden am Syntaxbaum ausgewertet", () => {
  it("eine konstante Zusammensetzung ('dia' + 'log') ist ein Kandidat, ohne Grenze rot", () => {
    const datei = "apps/web/src/components/A17bVerkettet.tsx";
    const e = synth(datei, [
      "export function Fenster(): JSX.Element {",
      "  return <div role={'dia' + 'log'} />;",
      "}",
    ]);
    expect(e.kandidaten).toEqual([{ datei, zeile: 2, art: "role-dialog" }]);
    expect(beurteile([e]).rot[0]).toContain(`${datei}:2`);

    const template = synth("apps/web/src/components/A17bTemplateKonstante.tsx", [
      'const VORSILBE = "alert";',
      "export function Fenster(): JSX.Element {",
      // Quelltext: <div role={`${VORSILBE}dia${'log'}`} /> — hier zerlegt, damit die Testdatei
      // selbst keinen Platzhalter in einer gewöhnlichen Zeichenkette trägt.
      ["  return <div role={`$", "{VORSILBE}dia$", "{'log'}`} />;"].join(""),
      "}",
    ]);
    expect(arten(template)).toEqual(["role-dialog"]);

    const ueberKonstanten = synth("apps/web/src/lib/a17bKonstanten.ts", [
      'const A = "dia";',
      "const B = A + 'log';",
      "export function markiere(el: HTMLElement): void {",
      "  el.setAttribute('role', B);",
      "}",
    ]);
    expect(ueberKonstanten.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["4:role-dialog"]);

    // Negativ-Zwilling: dieselbe Zusammensetzung, anderes Ergebnis.
    const ohne = synth("apps/web/src/components/A17bVerkettetOhne.tsx", [
      "export function Fenster(): JSX.Element {",
      "  return <div role={'reg' + 'ion'} />;",
      "}",
    ]);
    expect(ohne.kandidaten).toEqual([]);
    expect(modalAbgleich(ohne)).toEqual([]);
  });

  it("ein statisch NICHT bestimmbarer Rollenwert ist rot mit Datei und Zeile, statt ohne Ergebnis", () => {
    const datei = "apps/web/src/components/A17bRolleOffen.tsx";
    const e = synth(datei, [
      'import { ROLLE } from "../lib/rollen";',
      "export function Fenster(props: { rolle: string }): JSX.Element {",
      "  return <div role={props.rolle}><span role={ROLLE} /><i role={'dia' + props.rolle} /></div>;",
      "}",
    ]);
    expect(e.kandidaten).toEqual([]);
    const rot = modalAbgleich(e);
    expect(rot, "drei Rollenwerte, keiner bestimmbar").toHaveLength(3);
    for (const zeile of rot) {
      expect(zeile).toContain(`${datei}:3`);
      expect(zeile).toContain("statisch nicht bestimmbar");
    }

    const dom = synth("apps/web/src/lib/a17bRolleDomOffen.ts", [
      "export function markiere(el: HTMLElement, rolle: string): void {",
      "  el.setAttribute('role', rolle);",
      "}",
    ]);
    expect(modalAbgleich(dom)[0]).toContain("a17bRolleDomOffen.ts:2");

    const spread = synth("apps/web/src/components/A17bSpreadOffen.tsx", [
      'import { rolleVonAussen } from "../lib/rollen";',
      "export const F = <div {...{ role: rolleVonAussen }} />;",
    ]);
    expect(modalAbgleich(spread)[0]).toContain("A17bSpreadOffen.tsx:2");
  });

  it("GEGENPROBE: die Bauformen des Bestands bleiben ohne Befund (Parameter-Vorgabe mit Literal-Union, Bedingung)", () => {
    // Die Form aus `apps/web/src/shell/Menue.tsx`: destrukturierter Parameter, Vorgabe und
    // Literal-Union im Typ — vollständig bestimmbar, kein Dialog.
    const menue = synth("apps/web/src/shell/A17bMenue.tsx", [
      "export function MenueZeile({",
      '  rolle = "menuitem",',
      "}: {",
      '  rolle?: "menuitem" | "menuitemcheckbox" | "menuitemradio";',
      "}): JSX.Element {",
      '  return <button type="button" role={rolle} />;',
      "}",
    ]);
    expect(menue.kandidaten).toEqual([]);
    expect(modalAbgleich(menue)).toEqual([]);

    // Die Form aus `apps/web/src/pages/AblaufUebernahme.tsx`: die Bedingung selbst bleibt offen,
    // beide Zweige sind bestimmt.
    const bedingt = synth("apps/web/src/pages/A17bAblauf.tsx", [
      "export function Meldung({ meldung }: { meldung: { art: string } }): JSX.Element {",
      '  return <div role={meldung.art === "fehler" ? "alert" : "status"} />;',
      "}",
    ]);
    expect(modalAbgleich(bedingt)).toEqual([]);

    // Ausserhalb eines Props-Objekts ist `role` die Benutzerrolle — kein Befund.
    const benutzer = synth("apps/web/src/api/a17bBenutzer.ts", [
      "export function setze(u: { role: string }, neu: string): { role: string } {",
      "  u.role = neu;",
      "  return { role: neu };",
      "}",
    ]);
    expect(modalAbgleich(benutzer)).toEqual([]);
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
        "apps/web/src/lib/art.ts": ['export const ART = "dialog";'],
      }),
    );
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/lib/art.ts:1");
  });

  it("bens Fall: role={'dia' + 'log'} in einem sonst grünen Baum macht das TOR rot", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Verkettet.tsx": [
          "export function Verkettet(): JSX.Element {",
          "  return <div role={'dia' + 'log'} />;",
          "}",
        ],
      }),
    );
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/components/Verkettet.tsx:2 — role-dialog");
    expect(rot[0]).toContain("ohne die Modalgrenze der Shell");
  });

  it("ein nicht bestimmbarer Rollenwert macht das TOR rot; eine Typdeklaration nicht", () => {
    const offen = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Offen.tsx": [
          "export function Offen(props: { rolle: string }): JSX.Element {",
          "  return <div role={props.rolle} />;",
          "}",
        ],
      }),
    );
    expect(offen.rot).toHaveLength(1);
    expect(offen.rot[0]).toContain("apps/web/src/components/Offen.tsx:2");

    const typ = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/lib/rolle.ts": ['export type Rolle = "dialog" | "button";'],
      }),
    );
    expect(typ.rot).toEqual([]);
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
