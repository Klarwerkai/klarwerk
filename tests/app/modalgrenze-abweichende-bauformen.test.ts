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

  it("Nacharbeit 3: ein zwischengespeichertes Props-Objekt wird bis zum Spread verfolgt", () => {
    const datei = "apps/web/src/components/A17bPropsVariable.tsx";
    const variable = synth(datei, [
      'import { rolleVonAussen } from "../lib/rollen";',
      "export function F(): JSX.Element {",
      "  const p = { role: rolleVonAussen };",
      "  return <div {...p} />;",
      "}",
    ]);
    const rot = modalAbgleich(variable);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain(`${datei}:3`);
    expect(rot[0]).toContain("statisch nicht bestimmbar");

    // Über einen Objekt-Spread in ein zweites Objekt und weiter an createElement.
    const kette = synth("apps/web/src/lib/a17bPropsKette.ts", [
      'import { createElement } from "react";',
      'import { rolleVonAussen } from "./rollen";',
      "export function f(): unknown {",
      "  const p = { role: rolleVonAussen };",
      '  const q = { ...p, id: "x" };',
      '  return createElement("div", q);',
      "}",
    ]);
    expect(modalAbgleich(kette)[0]).toContain("a17bPropsKette.ts:4");

    // Ein bestimmter Dialogwert über dieselbe Kette ist ein Kandidat.
    const bestimmt = synth("apps/web/src/components/A17bPropsDialog.tsx", [
      "export function F(): JSX.Element {",
      "  const p = { role: 'dia' + 'log' };",
      "  return <div {...p} />;",
      "}",
    ]);
    expect(arten(bestimmt)).toEqual(["role-dialog"]);
  });

  it("Nacharbeit 3 GEGENPROBE: eine Benutzerrolle, die in keinen Spread fliesst, bleibt ohne Befund", () => {
    const e = synth("apps/web/src/components/A17bBenutzerVariable.tsx", [
      'import { rolleVonAussen, speichere } from "../lib/rollen";',
      "export function a(): void {",
      "  const p = { role: rolleVonAussen };",
      "  speichere(p);",
      "}",
      "export function B(): JSX.Element {",
      '  const p = { id: "x" };',
      "  return <div {...p} />;",
      "}",
    ]);
    expect(e.kandidaten).toEqual([]);
    expect(modalAbgleich(e), "gleichnamiges p in anderem Block zählt nicht").toEqual([]);
  });

  it("Nacharbeit 3: Textattribute an DOM-Elementen sind Oberflächentext und sperren das Tor nicht", () => {
    const text = synth("apps/web/src/components/A17bTextattribut.tsx", [
      "export function F({ offen }: { offen: boolean }): JSX.Element {",
      "  return (",
      '    <p aria-label={"alertdialog"}>',
      '      <span title="dialog" />',
      '      <img alt={offen ? "dialog" : "bild"} src="x.png" />',
      "    </p>",
      "  );",
      "}",
    ]);
    expect(text.kandidaten).toEqual([]);
    expect(modalAbgleich(text)).toEqual([]);

    // Gegenproben: an einem BAUTEIL kann die Prop ein Element bauen — sie bleibt unbekannt und rot;
    // `role` an einem DOM-Element bleibt ein Kandidat.
    const bauteil = synth("apps/web/src/components/A17bBauteilProp.tsx", [
      'import { Huelle } from "./Huelle";',
      "export function F(): JSX.Element {",
      '  return <Huelle as="dialog" />;',
      "}",
    ]);
    expect(modalAbgleich(bauteil)).toHaveLength(1);
    expect(modalAbgleich(bauteil)[0]).toContain("A17bBauteilProp.tsx:3");

    const rolle = synth("apps/web/src/components/A17bSpanRolle.tsx", [
      "export function F(): JSX.Element {",
      '  return <span role="dialog" title="dialog" />;',
      "}",
    ]);
    expect(arten(rolle)).toEqual(["role-dialog"]);
    expect(modalAbgleich(rolle)).toEqual([]);
  });

  it("Nacharbeit 4: gespreizte Props mit lokal typisierter Rolle werden am Spread ausgewertet", () => {
    // bens Fall wörtlich: die Rolle steht nur im Parametertyp, nirgends ein Objektliteral.
    const datei = "apps/web/src/components/A17bPropsParameter.tsx";
    const parameter = synth(datei, [
      "export function F(props: { role: 'dialog' }): JSX.Element {",
      "  return <div {...props} />;",
      "}",
    ]);
    expect(parameter.kandidaten).toEqual([{ datei, zeile: 2, art: "role-dialog" }]);
    expect(modalAbgleich(parameter), "zugeflossen ⇒ keine unbekannte Bauform").toEqual([]);
    expect(beurteile([parameter]).rot[0]).toContain(`${datei}:2`);

    // Rest-Bindung über ein lokales Interface; an createElement über einen lokalen Alias.
    const rest = synth("apps/web/src/components/A17bPropsRest.tsx", [
      'interface Props { id: string; role: "alertdialog" | "region"; }',
      "export function F({ id, ...rest }: Props): JSX.Element {",
      "  return <section id={id} {...rest} />;",
      "}",
    ]);
    expect(rest.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["3:role-dialog"]);

    const erzeugt = synth("apps/web/src/lib/a17bPropsCreate.ts", [
      'import { createElement } from "react";',
      'type Props = { role: "dialog" };',
      "export function f(props: Props): unknown {",
      '  return createElement("div", props);',
      "}",
    ]);
    expect(erzeugt.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["4:role-dialog"]);
  });

  it("Nacharbeit 4: eine vorhandene, aber unbestimmbare Rolle gespreizter Props ist rot", () => {
    const datei = "apps/web/src/components/A17bPropsOffen.tsx";
    const e = synth(datei, [
      "export function F(props: { id: string; role?: string }): JSX.Element {",
      "  return <div {...props} />;",
      "}",
    ]);
    expect(e.kandidaten).toEqual([]);
    const rot = modalAbgleich(e);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain(`${datei}:2`);
    expect(rot[0]).toContain("statisch nicht bestimmbar");
  });

  it("Nacharbeit 4 GEGENPROBE: ohne Rolle im Typ, mit herausgelöster Rolle und als reiner Typ kein Befund", () => {
    const ohneRolle = synth("apps/web/src/components/A17bPropsOhneRolle.tsx", [
      "type Props = { id: string; titel?: string };",
      "export function F(props: Props): JSX.Element {",
      "  return <div {...props} />;",
      "}",
    ]);
    expect(ohneRolle.kandidaten).toEqual([]);
    expect(modalAbgleich(ohneRolle)).toEqual([]);

    // `role` ist neben dem Rest herausgelöst — der Rest trägt keine Rolle mehr.
    const herausgeloest = synth("apps/web/src/components/A17bPropsHerausgeloest.tsx", [
      'interface Props { id: string; role: "dialog" | "region"; }',
      "export function F({ role, ...rest }: Props): JSX.Element {",
      "  return <section {...rest} data-rolle={role} />;",
      "}",
    ]);
    expect(herausgeloest.kandidaten).toEqual([]);
    expect(modalAbgleich(herausgeloest)).toEqual([]);

    // Ein reiner Typ ohne Verwendung bleibt ausgenommen.
    const unbenutzt = synth("apps/web/src/lib/a17bPropsTyp.ts", [
      'export type DialogProps = { role: "dialog" };',
    ]);
    expect(unbenutzt.kandidaten).toEqual([]);
    expect(modalAbgleich(unbenutzt)).toEqual([]);
  });

  it("Nacharbeit 5: die Rolle gespreizter Props wird über lokale Bindungsketten verfolgt", () => {
    // bens Fall wörtlich: der Parameter wird erst über `q` gespreizt.
    const datei = "apps/web/src/components/A17bPropsKette.tsx";
    const kette = synth(datei, [
      "export function F(props: { role: 'dialog' }): JSX.Element {",
      "  const q = props;",
      "  return <div {...q} />;",
      "}",
    ]);
    expect(kette.kandidaten).toEqual([{ datei, zeile: 3, art: "role-dialog" }]);
    expect(modalAbgleich(kette)).toEqual([]);
    expect(beurteile([kette]).rot[0]).toContain(`${datei}:3`);

    // Länger: Bindung → Rest aus einer untypisierten Destrukturierung → Objekt-Spread.
    const lang = synth("apps/web/src/components/A17bPropsLang.tsx", [
      "export function F(props: { id: string; role: 'alertdialog' }): JSX.Element {",
      "  const q = props;",
      "  const { id, ...rest } = q;",
      "  const r = { ...rest, title: id };",
      "  return <section {...r} />;",
      "}",
    ]);
    expect(lang.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["5:role-dialog"]);
    expect(modalAbgleich(lang)).toEqual([]);

    // Reisst die Herkunft ab, trägt eine eigene Typangabe die Rolle.
    const typisiert = synth("apps/web/src/components/A17bPropsTypErsatz.tsx", [
      'import { machProps } from "./props";',
      "export function F(): JSX.Element {",
      "  const q: { role: 'dialog' } = machProps();",
      "  return <div {...q} />;",
      "}",
    ]);
    expect(typisiert.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["4:role-dialog"]);
    expect(modalAbgleich(typisiert)).toEqual([]);
  });

  it("Nacharbeit 5: nachweislich keine Rolle bleibt still, eine abgerissene Kette am DOM ist rot", () => {
    const keine = synth("apps/web/src/components/A17bPropsKeine.tsx", [
      "export function F(props: { id: string; role: 'dialog' }): JSX.Element {",
      "  const { role, ...rest } = props;",
      "  const q = rest;",
      "  return <div {...q} data-rolle={role} />;",
      "}",
      "export function G(props: { id: string }): JSX.Element {",
      "  const q = props;",
      "  return <div {...q} />;",
      "}",
    ]);
    expect(keine.kandidaten).toEqual([]);
    expect(modalAbgleich(keine), "herausgelöst oder ohne role: keine Rolle").toEqual([]);

    const datei = "apps/web/src/components/A17bPropsAbbruch.tsx";
    const abbruch = synth(datei, [
      'import { machProps } from "./props";',
      "export function F(props: { role: 'dialog' }): JSX.Element {",
      "  const q = machProps();",
      "  let r = props;",
      "  return <div {...q}><span {...r} /><b {...machProps()} /></div>;",
      "}",
    ]);
    expect(abbruch.kandidaten).toEqual([]);
    const rot = modalAbgleich(abbruch);
    expect(rot, "Aufruf, let und Aufruf direkt — drei abgerissene Ketten").toHaveLength(3);
    for (const zeile of rot) {
      expect(zeile).toContain(`${datei}:5`);
      expect(zeile).toContain("ihr Typ ist nicht auflösbar");
    }

    // An einem BAUTEIL beurteilt dessen eigene Datei den Spread — hier kein Befund.
    const bauteil = synth("apps/web/src/components/A17bPropsBauteil.tsx", [
      'import { machProps } from "./props";',
      'import { Rahmen } from "./Rahmen";',
      "export function F(): JSX.Element {",
      "  return <Rahmen {...machProps()} />;",
      "}",
    ]);
    expect(modalAbgleich(bauteil)).toEqual([]);
  });

  it("Nacharbeit 6: ein gespreizter Aufruf wird über den deklarierten Rückgabetyp beurteilt", () => {
    const datei = "apps/web/src/components/A17bAufruf.tsx";
    const e = synth(datei, [
      "function anker(): { id: string } { return { id: 'x' }; }",
      "function dialogAnker(): { role: 'alertdialog' } { return JSON.parse('{}'); }",
      "export function F(): JSX.Element {",
      "  return <div {...anker()}><span {...dialogAnker()} /></div>;",
      "}",
    ]);
    expect(e.kandidaten).toEqual([{ datei, zeile: 4, art: "role-dialog" }]);
    expect(modalAbgleich(e), "anker(): nachweislich keine Rolle").toEqual([]);
  });

  it("Nacharbeit 7: Unionen, Vererbung und Hilfstypen werden aufgelöst statt übergangen", () => {
    // bens Fall wörtlich: eine Union von Objekttypen.
    const datei = "apps/web/src/components/A17bUnion.tsx";
    const union = synth(datei, [
      "type P = { role: 'dialog' } | { role: 'region' };",
      "export function F(p: P): JSX.Element {",
      "  return <div {...p} />;",
      "}",
    ]);
    expect(union.kandidaten).toEqual([{ datei, zeile: 3, art: "role-dialog" }]);
    expect(modalAbgleich(union)).toEqual([]);

    const geerbt = synth("apps/web/src/components/A17bErbe.tsx", [
      "interface Basis { role: 'alertdialog'; }",
      "interface P extends Basis { id: string; }",
      "export function F(p: P): JSX.Element {",
      "  return <div {...p} />;",
      "}",
    ]);
    expect(geerbt.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["4:role-dialog"]);

    const hilfstypen = synth("apps/web/src/components/A17bHilfstypen.tsx", [
      "interface Basis { id: string; role: 'dialog'; }",
      "export function Ohne(p: Omit<Basis, 'role'>): JSX.Element {",
      "  return <div {...p} />;",
      "}",
      "export function Mit(p: Partial<Pick<Basis, 'role' | 'id'>>): JSX.Element {",
      "  return <div {...p} />;",
      "}",
      "type Anker = { [K in `data-${string}`]?: string };",
      "export function Daten(p: Anker): JSX.Element {",
      "  return <div {...p} />;",
      "}",
    ]);
    expect(hilfstypen.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["6:role-dialog"]);
    expect(modalAbgleich(hilfstypen), "Omit und data-*: nachweislich keine Rolle").toEqual([]);
    expect(hilfstypen.weiterreicher).toEqual([]);
  });

  it("Nacharbeit 9: Mapped Types mit Schlüsselumbenennung (`as`) zählen die neuen Schlüssel", () => {
    const e = synth("apps/web/src/components/A17bUmbenannt.tsx", [
      "type Umbenannt = { [K in 'x' as 'role']: 'dialog' };",
      "type Weg = { [K in 'role' as 'x']: 'dialog' };",
      "type Gross = { [K in 'a' | 'b' as Uppercase<K>]: string };",
      "export function A(p: Umbenannt): JSX.Element { return <div {...p} />; }",
      "export function B(p: Weg): JSX.Element { return <div {...p} />; }",
      "export function C(p: Gross): JSX.Element { return <div {...p} />; }",
    ]);
    // bens Fall wörtlich: aus 'x' wird 'role' — die Dialogrolle ist da.
    expect(e.kandidaten.map((k) => `${k.zeile}:${k.art}`)).toEqual(["4:role-dialog"]);
    // aus 'role' wird 'x' — nachweislich keine Rolle; `Uppercase<K>` ist nicht auswertbar.
    expect(modalAbgleich(e)).toEqual([]);
    expect(e.weiterreicher, "nicht ausgewertete Umbenennung ist nicht „keine Rolle“").toEqual([
      "C",
    ]);
  });

  it("Nacharbeit 7: ein nicht auflösbarer Typ ergibt nie „keine Rolle“", () => {
    const datei = "apps/web/src/components/A17bUnaufloesbar.tsx";
    const e = synth(datei, [
      'import type { ButtonHTMLAttributes } from "react";',
      'import { mach } from "./mach";',
      "type Fremd = ButtonHTMLAttributes<HTMLButtonElement>;",
      "export function Knopf(p: Fremd): JSX.Element {",
      "  return <button {...p} />;",
      "}",
      "export function Liste({ teile }: { teile: Fremd[] }): JSX.Element {",
      "  const q: Fremd = mach();",
      "  return <ul {...q}>{teile.map((t: Fremd) => <li {...t} />)}</ul>;",
      "}",
    ]);
    // Parameter einer benannten Funktion: die Rolle setzen die Aufrufer — das Tor prüft sie dort.
    expect(e.weiterreicher).toEqual(["Knopf"]);
    // Typangabe ohne lesbaren Typ und Parameter einer namenlosen Funktion: rot am DOM-Element.
    const rot = modalAbgleich(e);
    expect(rot, "<ul {...q}> und <li {...t}>").toHaveLength(2);
    expect(rot.every((z) => z.includes(`${datei}:9`))).toBe(true);
    expect(rot.some((z) => z.includes("ihr Typ ist nicht auflösbar"))).toBe(true);
    expect(rot.some((z) => z.includes("namenlosen Funktion"))).toBe(true);
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

  it("Nacharbeit 3: zwischengespeicherte Props machen das TOR rot; ein title-Text nicht", () => {
    const props = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Props.tsx": [
          'import { rolleVonAussen } from "../lib/rollen";',
          "export function Props(): JSX.Element {",
          "  const p = { role: rolleVonAussen };",
          "  return <div {...p} />;",
          "}",
        ],
      }),
    );
    expect(props.rot).toHaveLength(1);
    expect(props.rot[0]).toContain("apps/web/src/components/Props.tsx:3");

    const titel = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Titel.tsx": [
          "export function Titel(): JSX.Element {",
          '  return <span title="dialog" />;',
          "}",
        ],
      }),
    );
    expect(titel.rot).toEqual([]);
  });

  it("Nacharbeit 4: bens Parameter-Spread in einem sonst grünen Baum macht das TOR rot", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Gespreizt.tsx": [
          "export function Gespreizt(props: { role: 'dialog' }): JSX.Element {",
          "  return <div {...props} />;",
          "}",
        ],
      }),
    );
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/components/Gespreizt.tsx:2 — role-dialog");
  });

  it("Nacharbeit 5: bens Parameter-Spread über `const q = props` macht das TOR rot", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Weitergereicht.tsx": [
          "export function Weitergereicht(props: { role: 'dialog' }): JSX.Element {",
          "  const q = props;",
          "  return <div {...q} />;",
          "}",
        ],
      }),
    );
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/components/Weitergereicht.tsx:3 — role-dialog");
  });

  it("Nacharbeit 6: importierte Funktionen werden über ihren Rückgabetyp im Zielmodul beurteilt", () => {
    // Die Bauform aus BibliothekFlaeche/BibliothekLesen/Mobile: `{...anzeigestatusAnker(x)}` mit
    // einem Rückgabetyp ohne `role` — nachweislich keine Rolle, kein Befund.
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/lib/anker.ts": [
          'export interface Anker { "data-x": string; }',
          "export function anker(x: string): Anker {",
          '  return { "data-x": x };',
          "}",
          "export function dialogAnker(): { role: 'dialog' } {",
          "  return JSON.parse('{}');",
          "}",
          "export function ohneTyp() {",
          "  return {};",
          "}",
        ],
        "apps/web/src/components/Gruen.tsx": [
          'import { anker } from "../lib/anker";',
          "export function Gruen(): JSX.Element {",
          '  return <div {...anker("1")} />;',
          "}",
        ],
        "apps/web/src/components/Dialog.tsx": [
          'import { dialogAnker as d } from "../lib/anker";',
          "export function Dialog(): JSX.Element {",
          "  return <div {...d()} />;",
          "}",
        ],
        "apps/web/src/components/Offen.tsx": [
          'import { ohneTyp } from "../lib/anker";',
          "export function Offen(): JSX.Element {",
          "  return <div {...ohneTyp()} />;",
          "}",
        ],
      }),
    );
    const imDialog = (z: string): boolean => z.includes("components/Dialog.tsx:3 — role-dialog");
    const imOffen = (z: string): boolean => z.includes("components/Offen.tsx:3");
    expect(
      rot.some((z) => z.includes("Gruen.tsx")),
      "ohne role: kein Befund",
    ).toBe(false);
    expect(rot.filter(imDialog)).toHaveLength(1);
    expect(rot.filter(imOffen)).toHaveLength(1);
    expect(rot).toHaveLength(2);
  });

  it("Nacharbeit 7: das Tor prüft die Aufrufstellen weiterreichender Komponenten über Dateien", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Knopf.tsx": [
          'import type { ButtonHTMLAttributes } from "react";',
          "export function Knopf(props: ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {",
          "  return <button {...props} />;",
          "}",
        ],
        "apps/web/src/components/Stumm.tsx": [
          "export function Stumm(p: { id: string }): JSX.Element {",
          "  return <span>{p.id}</span>;",
          "}",
        ],
        "apps/web/src/components/Nutzer.tsx": [
          'import { Knopf } from "./Knopf";',
          'import { Stumm } from "./Stumm";',
          'import { mach } from "./mach";',
          "export function Nutzer(): JSX.Element {",
          "  return (",
          "    <div>",
          '      <Knopf role="dialog" />',
          "      <Knopf {...mach()} />",
          "      <Stumm {...mach()} />",
          "    </div>",
          "  );",
          "}",
        ],
        "apps/web/src/lib/typen.ts": ['export interface Basis { role: "dialog"; }'],
        "apps/web/src/components/Rel.tsx": [
          'import type { Basis } from "../lib/typen";',
          "export function Rel(p: Basis): JSX.Element {",
          "  return <div {...p} />;",
          "}",
        ],
      }),
    );
    const enthaelt = (teil: string): number => rot.filter((z) => z.includes(teil)).length;
    // Knopf reicht weiter: die Rolle der Aufrufer zählt — `role="dialog"` und der offene Spread.
    expect(enthaelt("components/Nutzer.tsx:7 — role-dialog")).toBe(1);
    expect(enthaelt("components/Nutzer.tsx:8 — gespreizte Props")).toBe(1);
    // Stumm reicht nichts weiter: derselbe offene Spread ist dort kein Befund.
    expect(enthaelt("components/Nutzer.tsx:9")).toBe(0);
    // Der relativ importierte Typ wird im Zielmodul gelesen.
    expect(enthaelt("components/Rel.tsx:3 — role-dialog")).toBe(1);
    expect(enthaelt("Knopf.tsx:"), "Knopf selbst ist kein Befund").toBe(0);
    expect(rot).toHaveLength(3);
  });

  it("Nacharbeit 8: Sammeldateien werden bis zur Deklaration verfolgt (MyTasks → trust/index.ts)", () => {
    // Die Bauform aus `pages/MyTasks.tsx`: `<KoAuthorLine {...it.author} />` mit KoAuthorLine aus
    // `components/trust` (index.ts: `export { KoAuthorLine } from "./KoAuthorLine"`). Die
    // Komponente reicht nichts weiter — der offene Spread ist dort kein Befund.
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Knopf.tsx": [
          'import type { ButtonHTMLAttributes } from "react";',
          "export function Knopf(props: ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {",
          "  return <button {...props} />;",
          "}",
        ],
        "apps/web/src/components/Stumm.tsx": [
          "export function Stumm(p: { id: string }): JSX.Element {",
          "  return <span>{p.id}</span>;",
          "}",
        ],
        "apps/web/src/components/index.ts": [
          'export { Stumm as Leise } from "./Stumm";',
          'export * from "./Knopf";',
        ],
        "apps/web/src/pages/Seite.tsx": [
          'import { Knopf, Leise } from "../components";',
          'import { mach } from "./mach";',
          "export function Seite(): JSX.Element {",
          "  return (",
          "    <div>",
          "      <Leise {...mach()} />",
          "      <Knopf {...mach()} />",
          "    </div>",
          "  );",
          "}",
        ],
      }),
    );
    const ziel = "<Knopf> (apps/web/src/components/Knopf.tsx)";
    expect(
      rot.filter((z) => z.includes("pages/Seite.tsx:6")),
      "Alias über Re-Export",
    ).toEqual([]);
    expect(rot.filter((z) => z.includes("pages/Seite.tsx:7 — gespreizte Props"))).toHaveLength(1);
    expect(
      rot.filter((z) => z.includes(ziel)),
      "export * bis Knopf.tsx",
    ).toHaveLength(1);
    expect(rot).toHaveLength(1);
  });

  it("Nacharbeit 9: direkte Aufrufe und Wertverwendungen eines Weiterreichers werden abgerechnet", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        // bens Fall wörtlich: F reicht weiter und wird nur direkt aufgerufen.
        "apps/web/src/components/Ben.tsx": [
          "function F(p: any): JSX.Element {",
          "  return <div {...p} />;",
          "}",
          "export const element = F(JSON.parse('{}'));",
        ],
        "apps/web/src/components/Weiter.tsx": [
          "export function Weiter(p: any): JSX.Element { return <div {...p} />; }",
        ],
        "apps/web/src/components/Aufrufe.tsx": [
          'import { memo } from "react";',
          'import { Weiter } from "./Weiter";',
          "export const a = Weiter(JSON.parse('{}'));",
          "export const b = Weiter({ id: 'x' });",
          "export const c = Weiter({ role: holeRolle() });",
          "export const d = memo(Weiter);",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    expect(an("components/Ben.tsx:4"), "direkter Aufruf, Herkunft offen").toHaveLength(1);
    expect(an("components/Aufrufe.tsx:3")[0]).toContain("in <Weiter>");
    expect(an("components/Aufrufe.tsx:4"), "{ id } trägt nachweislich keine Rolle").toEqual([]);
    expect(an("components/Aufrufe.tsx:5")[0]).toContain("im direkten Aufruf Weiter(…)");
    expect(an("components/Aufrufe.tsx:6")[0]).toContain("als Wert verwendet");
    expect(an("components/Weiter.tsx:"), "der Weiterreicher selbst ist kein Befund").toEqual([]);
    expect(rot).toHaveLength(4);
  });

  it("Nacharbeit 10: Import-Aliasse und eigene Rollen hinter Zwischenvariablen werden abgerechnet", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Weiter.tsx": [
          "export function Weiter(p: any): JSX.Element { return <div {...p} />; }",
        ],
        "apps/web/src/components/index.ts": ['export { Weiter as Weitergabe } from "./Weiter";'],
        "apps/web/src/components/Alias.tsx": [
          'import { Weiter as W } from "./Weiter";',
          'import { Weitergabe } from "./index";',
          "export const a = W(JSON.parse('{}'));",
          "export const b = Weitergabe(JSON.parse('{}'));",
          "const p = { role: holeRolle() };",
          "const q = { ...p, id: 'x' };",
          "export const c = W(p);",
          "export const d = W(q);",
          "const r = { id: 'x' };",
          "export const e = W(r);",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // bens Fall 1 wörtlich: der Import-Alias W — und derselbe Weg über einen Re-Export-Alias.
    expect(an("components/Alias.tsx:3")[0]).toContain("in <Weiter>");
    expect(an("components/Alias.tsx:4")[0]).toContain("in <Weiter>");
    // bens Fall 2 wörtlich: die unbestimmte Rolle hinter `p` — und hinter dem Spread in `q`.
    expect(an("components/Alias.tsx:7")[0]).toContain("im direkten Aufruf W(…)");
    expect(an("components/Alias.tsx:8")[0]).toContain("im direkten Aufruf W(…)");
    expect(an("components/Alias.tsx:10"), "{ id } trägt nachweislich keine Rolle").toEqual([]);
    expect(rot).toHaveLength(4);
  });

  it("Nacharbeit 11: Standard- und Namensraumimporte werden bis zum Weiterreicher aufgelöst", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Weiter.tsx": [
          "export function Weiter(p: any): JSX.Element { return <div {...p} />; }",
        ],
        "apps/web/src/components/Standard.tsx": [
          "export default function Standard(p: any): JSX.Element { return <div {...p} />; }",
        ],
        "apps/web/src/components/Zwei.tsx": [
          "function Zwei(p: any): JSX.Element { return <div {...p} />; }",
          "export default Zwei;",
        ],
        "apps/web/src/components/Nutzer.tsx": [
          'import * as M from "./Weiter";',
          'import S from "./Standard";',
          'import Z from "./Zwei";',
          "export const a = M.Weiter(JSON.parse('{}'));",
          "export const b = S(JSON.parse('{}'));",
          "export const c = Z(JSON.parse('{}'));",
          'export const d = M["Weiter"]({ id: "x" });',
          "export const e = [M];",
          'export const f = <M.Weiter id="x" />;',
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // bens Fälle wörtlich: Namensraumzugriff und Standardimport einer benannten Default-Funktion.
    expect(an("components/Nutzer.tsx:4")[0]).toContain("in <Weiter>");
    expect(an("components/Nutzer.tsx:5")[0]).toContain("in <Standard>");
    // `export default Zwei;` ist ein Export, der Standardimport `Z` trägt Zwei.
    expect(an("components/Nutzer.tsx:6")[0]).toContain("in <Zwei>");
    expect(an("components/Zwei.tsx:"), "export default ist keine Wertverwendung").toEqual([]);
    expect(an("components/Nutzer.tsx:7"), "M['Weiter'] mit { id }: keine Rolle").toEqual([]);
    expect(an("components/Nutzer.tsx:8")[0]).toContain("Namensraum M");
    expect(an("components/Nutzer.tsx:9"), "JSX über den Namensraum ohne Spread").toEqual([]);
    expect(rot).toHaveLength(4);
  });

  it("Nacharbeit 12: Namensräume über Alias-Export und export * werden vollständig erhoben", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Weiter.tsx": [
          "export function Weiter(p: any): JSX.Element { return <div {...p} />; }",
        ],
        // bens Fall wörtlich: a.ts exportiert Weiter als W, index.ts exportiert * aus a.ts.
        "apps/web/src/components/a.ts": [
          'import { Weiter } from "./Weiter";',
          "export { Weiter as W };",
        ],
        "apps/web/src/components/index.ts": ['export * from "./a";'],
        "apps/web/src/components/Nutzer.tsx": [
          'import * as M from "./index";',
          "const { W } = M;",
          "export const a = W(JSON.parse('{}'));",
          "export const b = M.W(JSON.parse('{}'));",
        ],
        // Nicht abschliessend: `export *` aus einem Paket, das der Leser nicht kennt.
        "apps/web/src/components/offen.ts": ['export * from "fremdes-paket";'],
        "apps/web/src/components/Offen.tsx": [
          'import * as N from "./offen";',
          "export const n = [N];",
        ],
        // Gegenfall: abschliessend erhoben und ohne Weiterreicher.
        "apps/web/src/components/Stumm.tsx": [
          "export function Stumm(p: { id: string }): JSX.Element { return <span>{p.id}</span>; }",
        ],
        "apps/web/src/components/still.ts": ['export * from "./Stumm";'],
        "apps/web/src/components/Still.tsx": [
          'import * as S from "./still";',
          "export const s = [S];",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // Die Entnahme `const { W } = M` ist eine Wertverwendung: W ist über export * erhoben.
    expect(an("components/Nutzer.tsx:2")[0]).toContain("enthält den Weiterreicher W");
    // Der Aufruf über den Namensraum folgt export * und dem lokalen Alias bis zu Weiter.
    expect(an("components/Nutzer.tsx:4")[0]).toContain("in <Weiter>");
    expect(an("components/Offen.tsx:2")[0]).toContain("nicht vollständig auflösbar");
    expect(an("components/Still.tsx:"), "abschliessend ohne Weiterreicher").toEqual([]);
    expect(rot).toHaveLength(3);
  });

  it("Nacharbeit 13: verschachtelte Namensräume (export * as ns) werden Glied für Glied verfolgt", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Weiter.tsx": [
          "export function Weiter(p: any): JSX.Element { return <div {...p} />; }",
        ],
        "apps/web/src/components/ns.ts": ['export * as ns from "./Weiter";'],
        // bens Fall wörtlich: der Zugriff über den Unter-Namensraum und M als Wert.
        "apps/web/src/components/Kette.tsx": [
          'import * as M from "./ns";',
          "export const a = M.ns.Weiter(JSON.parse('{}'));",
          "export const b = [M];",
          "export const c = [M.ns];",
        ],
        // Derselbe Unter-Namensraum, benannt importiert.
        "apps/web/src/components/Benannt.tsx": [
          'import { ns } from "./ns";',
          "export const d = ns.Weiter(JSON.parse('{}'));",
        ],
        // Ein Unter-Namensraum aus einem nicht lesbaren Paket ist nicht frei, sondern rot.
        "apps/web/src/components/paket.ts": ['export * as fremd from "fremdes-paket";'],
        "apps/web/src/components/Fremd.tsx": [
          'import * as P from "./paket";',
          "export const e = P.fremd.Irgendwas(1);",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    expect(an("components/Kette.tsx:2")[0]).toContain("in <Weiter>");
    expect(an("components/Kette.tsx:3")[0]).toContain("enthält den Weiterreicher ns.Weiter");
    expect(an("components/Kette.tsx:4")[0]).toContain("der Namensraum M.ns enthält");
    expect(an("components/Benannt.tsx:2")[0]).toContain("in <Weiter>");
    expect(an("components/Fremd.tsx:2")[0]).toContain("im Namensraum nicht auflösbar");
    expect(rot).toHaveLength(5);
  });

  it("Nacharbeit 14: ein als Standardexport weitergegebener Namensraum wird aufgelöst", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Weiter.tsx": [
          "export function Weiter(p: any): JSX.Element { return <div {...p} />; }",
        ],
        // bens Fall wörtlich: `export { M as default }` — und dasselbe als `export default N;`.
        "apps/web/src/components/index.ts": [
          'import * as M from "./Weiter";',
          "export { M as default };",
        ],
        "apps/web/src/components/standard.ts": [
          'import * as N from "./Weiter";',
          "export default N;",
        ],
        "apps/web/src/components/Nutzer.tsx": [
          'import M from "./index";',
          'import N from "./standard";',
          "export const a = M.Weiter(JSON.parse('{}'));",
          "export const b = [N];",
          "export const c = N.Weiter({ id: 'x' });",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    expect(an("components/Nutzer.tsx:3")[0]).toContain("in <Weiter>");
    expect(an("components/Nutzer.tsx:4")[0]).toContain("der Namensraum N enthält");
    expect(an("components/Nutzer.tsx:5"), "{ id } trägt nachweislich keine Rolle").toEqual([]);
    expect(an("components/index.ts:"), "die Weitergabe selbst ist ein Export").toEqual([]);
    expect(an("components/standard.ts:"), "export default N ist ein Export").toEqual([]);
    expect(rot).toHaveLength(2);
  });

  it("Nacharbeit 15: berechnete Schlüssel in Props werden ausgewertet, unbestimmte sind rot", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/lib/marke.ts": ['export const MARKE = "data-marke";'],
        "apps/web/src/components/Berechnet.tsx": [
          'import { MARKE } from "../lib/marke";',
          "type Marke = `data-${string}`;",
          "export function F({ k, frei }: { k: Marke; frei: string }): JSX.Element {",
          "  const zaehler = { [frei]: 1 };",
          "  return (",
          "    <div data-n={zaehler[frei]}>",
          "      <div {...{ ['ro' + 'le']: 'dia' + 'log' }} />",
          "      <div {...{ [MARKE]: true }} />",
          "      <div {...{ [k]: '' }} />",
          "      <div {...{ [frei]: 'x' }} />",
          "    </div>",
          "  );",
          "}",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // bens Fall wörtlich: der berechnete Schlüssel ist `role`, der Wert `dialog`.
    expect(an("components/Berechnet.tsx:7")[0]).toContain("role-dialog");
    // Importierte Konstante (Form aus KnowledgeInputStudio) und `data-${string}` (Form aus Modal).
    expect(an("components/Berechnet.tsx:8"), "MARKE = data-marke").toEqual([]);
    expect(an("components/Berechnet.tsx:9"), "k: data-${string}").toEqual([]);
    // Ein freier String als Schlüssel in Props könnte `role` sein — nicht rollenfrei.
    expect(an("components/Berechnet.tsx:10")[0]).toContain("berechneter Schlüssel");
    // Derselbe freie Schlüssel in einem gewöhnlichen Objekt baut nichts.
    expect(an("components/Berechnet.tsx:4"), "kein Props-Objekt").toEqual([]);
    expect(rot).toHaveLength(2);
  });

  it("Nacharbeit 16: berechnete Schlüssel werden auf aria-modal und ariaModal geprüft", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Markiert.tsx": [
          "type Marke = `data-${string}`;",
          "export function F({ k, frei }: { k: Marke; frei: string }): JSX.Element {",
          "  const p = { ['aria-' + 'modal']: true };",
          "  return (",
          "    <div>",
          "      <div {...{ ['aria-' + 'modal']: 'true' }} />",
          "      <div {...p} />",
          "      <div {...{ ['aria' + 'Modal']: true }} />",
          "      <div {...{ [k]: true }} />",
          "      <div {...{ [frei]: true }} />",
          "    </div>",
          "  );",
          "}",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // bens Fall wörtlich: der zusammengesetzte Schlüssel ist aria-modal — ein Kandidat ohne Grenze.
    expect(an("components/Markiert.tsx:6 — aria-modal-eigenschaft")).toHaveLength(1);
    // Dasselbe hinter einer Zwischenvariable — am Objekt erfasst.
    expect(an("components/Markiert.tsx:3 — aria-modal-eigenschaft")).toHaveLength(1);
    expect(an("components/Markiert.tsx:8 — aria-modal-reflexion")).toHaveLength(1);
    expect(an("components/Markiert.tsx:9"), "data-${string} trifft keinen Modalmarker").toEqual([]);
    expect(an("components/Markiert.tsx:10")[0]).toContain("ob er role oder aria-modal setzt");
    expect(rot).toHaveLength(4);
  });

  it("Nacharbeit 17: Getter und Methoden in gespreizten Props werden auf Modalmarker geprüft", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Getter.tsx": [
          "export function F({ frei }: { frei: string }): JSX.Element {",
          "  return (",
          "    <div>",
          "      <div {...{ get role() { return 'dia' + 'log'; } }} />",
          "      <div {...{ get role() { const r = holeRolle(); return r; } }} />",
          "      <div {...{ get ariaModal() { return true; } }} />",
          "      <div {...{ get [frei]() { return 'x'; } }} />",
          "      <div {...{ get title() { return 'Hallo'; }, onClick() {} }} />",
          "    </div>",
          "  );",
          "}",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // bens Fall wörtlich: der Getter liefert beim Spread role="dialog".
    expect(an("components/Getter.tsx:4 — role-dialog")).toHaveLength(1);
    // Ein Rumpf, der nicht genau `return <Ausdruck>;` ist, ist nicht bestimmbar — rot.
    expect(an("components/Getter.tsx:5")[0]).toContain("setzt role mit einem Wert");
    expect(an("components/Getter.tsx:6 — aria-modal-reflexion")).toHaveLength(1);
    expect(an("components/Getter.tsx:7")[0]).toContain("Name ist statisch nicht bestimmbar");
    expect(an("components/Getter.tsx:8"), "title und onClick sind keine Modalmarker").toEqual([]);
    expect(rot).toHaveLength(4);
  });

  it("Nacharbeit 18: Schreibzugriffe auf Objekte im Props-Fluss werden ausgewertet", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Schreib.tsx": [
          "export function F(): JSX.Element {",
          "  const p: { role?: string } = {};",
          "  p.role = holeRolle();",
          "  const q: Record<string, string> = {};",
          "  q['ro' + 'le'] = 'dia' + 'log';",
          "  const r: Record<string, unknown> = {};",
          "  Object.assign(r, { role: holeRolle() });",
          "  const s = { id: 'x' };",
          "  veraendere(s);",
          "  const t: Record<string, string> = {};",
          "  t[holeSchluessel()] = 'x';",
          "  const u = { id: 'y' };",
          "  u.id = 'z';",
          "  const nutzer = { role: 'x' };",
          "  nutzer.role = holeRolle();",
          "  return <div {...p}><i {...q} /><b {...r} /><s {...s} /><em {...t} /><u {...u} /></div>;",
          "}",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // bens Fall wörtlich: die nachträglich gesetzte, unbestimmte Rolle an gespreizten Props.
    expect(an("components/Schreib.tsx:3")[0]).toContain("statisch nicht bestimmbar");
    expect(an("components/Schreib.tsx:5 — role-dialog")).toHaveLength(1);
    expect(an("components/Schreib.tsx:7")[0]).toContain("Object.assign");
    expect(an("components/Schreib.tsx:9")[0]).toContain("kann dort verändert werden");
    expect(an("components/Schreib.tsx:11")[0]).toContain("Schlüssel ist statisch nicht bestimmbar");
    expect(an("components/Schreib.tsx:13"), "u.id ist kein Modalmarker").toEqual([]);
    expect(an("components/Schreib.tsx:15"), "nutzer fliesst in keinen Spread").toEqual([]);
    expect(rot).toHaveLength(5);
  });

  it("Nacharbeit 19: eine Bedingung im Spread ist kein Props-Objekt, ihr Zweig schon", () => {
    // Die Bestandsformen aus FileTypePicker.tsx:172 und MehrAbschnitte.tsx:480: die Variable steht
    // nur in der BEDINGUNG (`hinweis ? { title: t(hinweis) } : {}`) und wird an Funktionen gereicht.
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Bedingung.tsx": [
          "export function F({ id }: { id: string }): JSX.Element {",
          "  const hinweis = holeHinweis();",
          "  const gate = holeGate();",
          "  const p = { id };",
          "  pruefe(gate);",
          "  veraendere(p);",
          "  return (",
          "    <div>",
          "      <a {...(hinweis ? { title: t(hinweis) } : {})} />",
          "      <b {...(gate ? { 'aria-describedby': id } : {})} />",
          "      <i {...(gate === 'x' ? p : {})} />",
          "    </div>",
          "  );",
          "}",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    expect(an("components/Bedingung.tsx:5"), "gate steht nur in Bedingungen").toEqual([]);
    expect(an("components/Bedingung.tsx:9"), "t(hinweis): hinweis ist die Bedingung").toEqual([]);
    // `p` ist ein ZWEIG der Bedingung und damit Props — seine Weitergabe bleibt rot.
    expect(an("components/Bedingung.tsx:6")[0]).toContain("kann dort verändert werden");
    expect(rot).toHaveLength(1);
  });

  it("Nacharbeit 20: Schreibzugriffe über einen Alias treffen dasselbe Props-Objekt", () => {
    const { rot } = pruefeModalgrenze(
      legeBaum({
        ...ABGEGRENZT,
        "apps/web/src/components/Alias.tsx": [
          "export function F(): JSX.Element {",
          "  const p: { role?: string } = {};",
          "  const q = p;",
          "  q.role = holeRolle();",
          "  let r: Record<string, string> = {};",
          "  r = p;",
          "  r.role = holeRolle();",
          "  const s = Math.random() > 0.5 ? p : {};",
          "  veraendere(s);",
          "  const nutzer = { role: 'x' };",
          "  const n2 = nutzer;",
          "  n2.role = holeRolle();",
          "  return <div {...p} />;",
          "}",
        ],
      }),
    );
    const an = (stelle: string): string[] => rot.filter((z) => z.includes(stelle));
    // bens Fall wörtlich: `q` ist ein Alias von `p`, der Schreibzugriff trifft die Props.
    expect(an("components/Alias.tsx:4")[0]).toContain("statisch nicht bestimmbar");
    // Ein Alias über eine spätere Zuweisung und über einen Bedingungszweig.
    expect(an("components/Alias.tsx:7")[0]).toContain("statisch nicht bestimmbar");
    expect(an("components/Alias.tsx:9")[0]).toContain("kann dort verändert werden");
    // Ein Alias eines Objekts, das in keinen Spread fliesst, bleibt die Benutzerrolle.
    expect(an("components/Alias.tsx:12"), "nutzer/n2 fliessen in keinen Spread").toEqual([]);
    expect(rot).toHaveLength(3);
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
