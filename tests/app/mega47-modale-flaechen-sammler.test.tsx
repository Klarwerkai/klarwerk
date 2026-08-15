// @vitest-environment jsdom
// AUFTRAG-mega47 Block B → mega48 Block B → AUFTRAG-mega72 — DER SAMMLER FÜR MODALE FLÄCHEN.
//
// DIE GESCHICHTE DIESER DATEI, ehrlich, weil sie die Bauform erklärt:
//
//  · sammel44 (ben, ROT): das mobile Filterblatt lag in seinem EIGENEN inerten Hintergrund. `pageRef`
//    umfasste die komplette Seite EINSCHLIESSLICH des FacetFilter; beim Öffnen wurde genau dieser
//    Root inert — Dialog, Hintergrundfläche, Schließen-Knopf und alle Filter lagen im selben
//    Teilbaum. `position: fixed` ändert nur die Darstellung, nicht die DOM-Abstammung; `inert` gilt
//    für den GANZEN Teilbaum. Im echten Browser war das Blatt weder bedienbar noch schließbar.
//
//  · mega47 hat das repariert und diesen Sammler gebaut. Er erhob Flächen über die Zeichenfolge
//    `backgroundRef={`.
//
//  · sammel45 (ben, ROT): genau daran ist er gescheitert. `ImportSelect` bindet `FacetFilter` ein und
//    LÄSST DEN PROP WEG — eine produktiv erreichbare dritte Fläche, die in der Erhebung schlicht
//    nicht vorkam und deren `aria-modal="true"` reine Behauptung war. Ein Sammler, der nur findet,
//    was sich freiwillig meldet, ist kein Sammler. mega48 hat daraufhin die Modalgrenze zum Kontext
//    gemacht (`app/ModalBoundaryContext.tsx`), den eine modale Fläche HOLT, und die Erhebung auf
//    Aufrufer statt Freiwillige umgestellt — aber weiterhin über Zeichenkettenmuster.
//
//  · sammel46 (ben, Register A17): auch DIESE Erhebung war ein statischer Musterwächter. Alias-
//    Nutzung (`const C = FacetFilter`), `createElement(FacetFilter, …)`, ein per Spread gesetztes
//    `aria-modal` und Modalität ohne die Zeichenfolge gingen vorbei — und weil kein unabhängiger
//    Zähler existierte, UNSICHTBAR. Der dritte Wächter derselben kaputten Bauart in einer Woche.
//
// DESHALB (mega72) LÄUFT DIE ERHEBUNG JETZT ÜBER DEN ECHTEN SYNTAXBAUM — den TypeScript-Compiler,
// der ohnehin im Projekt liegt (keine neue Abhängigkeit) — und wird gegen einen UNABHÄNGIGEN ZÄHLER
// abgerechnet:
//
//   (1) KANDIDATEN: jede Stelle im Quellbaum, die modal sein KÖNNTE — `aria-modal` als JSX-Attribut,
//       als Objekt-Eigenschaft (die Spread-Bauform) oder als nackte Zeichenkette (`setAttribute`),
//       jedes `<dialog>`-Element (JSX oder `createElement("dialog")`), `role="dialog"` /
//       `"alertdialog"` und jede `showModal`-Nutzung. Jeder Kandidat trägt Datei und Zeile.
//   (2) URTEILE: jeder Kandidat bekommt GENAU EIN Urteil — an der Grenze (`useModalBoundary`), das
//       Grenzmodul selbst, oder eine BEGRÜNDETE native Ausnahme (heute nur `BodyImageGallery`:
//       `showModal()` bekommt Top-Layer und inerten Hintergrund vom Browser; die Ausnahme verliert
//       ihre Gültigkeit automatisch, wenn der `showModal()`-Beleg aus der Datei verschwindet).
//       Alles andere ist ROT mit Datei und Zeile. Die Summen werden exakt kalibriert: eine
//       Erhebung, die still auf null fällt, ist ein Fehler und kein Erfolg.
//   (3) DER UNABHÄNGIGE ZÄHLER: jede wörtliche Erwähnung von `aria-modal`, `showModal` und `<dialog`
//       im kommentarbereinigten Quelltext muss abgerechnet sein — als Kandidat oder als belegte
//       Prosa (Zeichenkette/Template/JsxText/Regex). Eine Erwähnung, die der Syntaxbaum nicht
//       erklären kann, heißt: der Sammler konnte eine Bauform nicht lesen — und das wird ROT mit
//       Datei und Zeile, statt still überganen zu werden. Dasselbe gilt auf der Aufrufer-Seite je
//       Bauteil-Name (`\bFacetFilter\b` usw. gegen die gefundenen Identifikatoren).
//   (4) AUFRUFER über Identifikatoren, nicht Zeichenketten: JSX (auch qualifiziert), `createElement`,
//       Alias (`const C = FacetFilter;`) und Import-Alias (`import { FacetFilter as FF }`) gelten
//       als Einbindung; Re-Exporte, HOC-Übergaben (`memo(FacetFilter)`) und jede unbekannte
//       Verwendungsform sind ROT statt unsichtbar. Eine Datei, die nicht parsebar ist, ist ROT mit
//       Datei und Zeile.
//
// Jedes Paar (Aufrufer × Bauteil) MUSS unten einen gemounteten Fall haben, und zwar an der ECHTEN
// Verdrahtung: die Seite in der echten AppShell. Ein weiterer Aufrufer, der morgen dazukommt, ist
// rot, bis er hier steht. Die Gegenrichtung gilt auch — ein Fall ohne Fundstelle ist ebenfalls rot.
//
// JE FALL WIRD BEIDES VERLANGT (mega48 B2):
//   a) der geöffnete Dialog hat KEINEN `[inert]`-Vorfahren, und
//   b) der GESAMTE übrige Bedienbereich der App ist gesperrt — Auslöser, Filterschiene, Topbar,
//      Klara, Toasts und Command Palette eingeschlossen. Der Seiteninhalt allein genügt nicht mehr;
//      genau daran ist mega47 gescheitert.
//
// BENANNTE BLINDHEIT DIESER ERHEBUNG (es gibt sie immer; verschwiegen wird sie zur Falle):
//   · Zur Laufzeit zusammengesetzte Namen: `setAttribute("aria-" + "modal", …)` oder ein
//     Attributname aus einer Variablen sieht weder der Syntaxbaum-Anker noch der Wortzähler.
//   · Markup in Zeichenketten (`innerHTML`, Template-Strings) gilt als Prosa — ein `<dialog>`, das
//     erst zur Laufzeit aus einer Zeichenkette entsteht, ist kein Kandidat.
//   · `role={variable}` bzw. eine `role` ohne wörtliches "dialog"/"alertdialog" fällt durch.
//   · Modalität GANZ OHNE Marker bleibt unsichtbar: `apps/web/src/components/Modal.tsx` und die
//     Command-Palette sind fixe Overlays ohne `<dialog>`, ohne `role`, ohne `aria-modal` — für
//     JEDE statische Erhebung unsichtbar und weiterhin NICHT gegen die Shell abgegrenzt. Sie sind
//     eine eigene Scheibe und hier ausdrücklich benannt, damit niemand die grüne Farbe dieser
//     Datei für „alle Dialoge sind abgegrenzt" hält.
//   · Der Wortzähler läuft über kommentarbereinigten Text; eine Zeichenkette, die selbst `//`
//     enthält, unterdrückt Treffer derselben Zeile (er zählt dann zu WENIG — der Syntaxbaum-Anker
//     bleibt davon unberührt, nur das Sicherheitsnetz wird an dieser Stelle dünner).
//   · jsdom setzt `inert` nicht nativ durch. Belegbar ist hier die STRUKTUR (DOM-Abstammung), nicht
//     die WIRKUNG. Dass ein gesperrter Bereich im echten Browser wirklich tot und ein nicht
//     gesperrter Dialog wirklich bedienbar ist, belegt `tests-smoke/ui-smoke.spec.ts`.
//   · Reine Zeiger-Bedienbarkeit (`pointer-events`, Überdeckung) ist nicht Gegenstand; sie hängt am
//     Browser-Verhalten von `inert`, nicht an der Struktur.
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // Bewusst NICHT „admin": die Topbar stellt für Admins zusätzlich die Reasoner-Konfiguration und
    // würde an der leeren Antwort der stillgelegten HTTP-Grenze scheitern. Die Rolle ist für die
    // Frage dieses Sammlers ohne Belang.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Die HTTP-Grenze vollständig stillgelegt: jeder Endpunkt liefert eine leere Liste — AUSSER den
// wenigen, die eine Fläche überhaupt erst entstehen lassen. `ImportSelect` zeigt seine Filterschiene
// erst nach einer Vorschau mit Treffern; ohne Antwort gäbe es dort nichts zu prüfen.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const ANTWORTEN: Record<string, unknown> = {
    "admin.import.select": {
      matched: 2,
      limited: false,
      truncated: false,
      criteria: { themes: ["Wartung"] },
      preview: [
        { id: "a", title: "Pumpe A", hasImage: false, themes: ["Wartung"] },
        { id: "b", title: "Ventil B", hasImage: false, themes: ["Instandhaltung"] },
      ],
    },
    "reasoner.status": { active: false, mode: "deterministic" },
  };
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => ANTWORTEN[pfad] ?? []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
import { ImportSelect } from "../../apps/web/src/components/ImportSelect";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";
import { Validation } from "../../apps/web/src/pages/Validation";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ---------------------------------------------------------------------------------------------
// (1) Die Erhebung: der echte Syntaxbaum plus ein unabhängiger Zähler (mega72, Register A17).
// ---------------------------------------------------------------------------------------------

const WURZEL = join(__dirname, "..", "..");
const WEB_SRC = join("apps", "web", "src");
const GRENZE_MODUL = "apps/web/src/app/ModalBoundaryContext.tsx";

// BEGRÜNDETE native Ausnahmen: Flächen, deren Modalität der BROWSER herstellt (Top-Layer + inerter
// Hintergrund über `showModal()`), nicht die Shell-Grenze. Die Ausnahme ist an ihren Beleg
// gebunden — verschwindet `showModal()` aus der Datei, wird sie rot statt still weitergeschleppt.
//
// AUFTRAG-mega76 BLOCK E: der Schlüssel ist weiterhin die Datei, die WIRKUNG aber nicht mehr.
// Ausgenommen wird nur noch der Kandidat der Art `showModal-nutzung` selbst (s. `beurteile`) —
// jeder andere Kandidat derselben Datei muss die Modalgrenze der Shell weiterhin vorweisen. Eine
// Ausnahme, die auf Dateiebene wirkt, deckt Funde ab, die sie nie begründet hat.
const NATIV_MODAL_AUSNAHMEN = new Map<string, string>([
  [
    "apps/web/src/components/BodyImageGallery.tsx",
    "Lightbox über natives showModal() — Top-Layer und inerter Hintergrund kommen vom Browser (WP-D9c)",
  ],
]);

// Derselbe Fokus-Selektor wie in `apps/web/src/lib/focusables.ts` — bewusst gespiegelt: weicht er im
// Produktcode still auf, fällt es hier auf.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

// Kommentare zählen nicht: dieser Sammler beschreibt seine eigene Bauform ausführlich in Prosa, und
// eine Erwähnung ist keine Verdrahtung. ZEILENTREU: Blockkommentare werden durch Leerraum ersetzt,
// nicht entfernt — die Zeilennummern des gestrippten Textes sind die der Datei.
function ohneKommentare(quelle: string): string {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, (kommentar) => kommentar.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

interface Quelle {
  datei: string;
  text: string;
  gestrippt: string;
  ast: ts.SourceFile;
  // Was der Sammler nicht lesen konnte, wird rot mit Datei und Zeile — nicht übergangen.
  leseFehler: string[];
}

function quelleAus(datei: string, text: string): Quelle {
  const art = datei.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, art);
  // `parseDiagnostics` ist die einzige Stelle, an der der Parser Syntaxfehler ablegt, ohne dass man
  // ein ganzes Program bauen muss — im öffentlichen Typ fehlt das Feld, im Objekt liegt es immer.
  const diagnosen =
    (ast as ts.SourceFile & { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ??
    [];
  const leseFehler = diagnosen.slice(0, 3).map((d) => {
    const zeile = ast.getLineAndCharacterOfPosition(d.start).line + 1;
    return `${datei}:${zeile} — ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
  });
  return { datei, text, gestrippt: ohneKommentare(text), ast, leseFehler };
}

function ladeQuelle(datei: string): Quelle {
  return quelleAus(posix(datei), readFileSync(join(WURZEL, datei), "utf8"));
}

function zeileVon(sf: ts.SourceFile, n: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
}

type KandidatArt =
  | "aria-modal-attribut"
  | "aria-modal-eigenschaft"
  | "aria-modal-zeichenkette"
  | "dialog-jsx"
  | "dialog-createElement"
  | "role-dialog"
  | "showModal-nutzung";

interface Kandidat {
  datei: string;
  zeile: number;
  art: KandidatArt;
  /**
   * AUFTRAG-mega76 BLOCK E: bei `dialog-jsx` der Bezeichner aus `ref={…}`.
   *
   * Er ist das Bindeglied, mit dem sich die native Ausnahme AM FUND belegen lässt statt an der
   * Datei: nur ein `<dialog>`, dessen genau dieses `ref` irgendwo `showModal()` empfängt, wird
   * vom Browser modal gemacht. Ein zweites `<dialog>` in derselben Datei bekommt nichts geschenkt.
   */
  ref?: string;
}

interface DateiErhebung {
  quelle: Quelle;
  kandidaten: Kandidat[];
  // Spannen aller Text-Tokens (Zeichenketten, Templates, JsxText, Regex), die KEIN Kandidat sind —
  // die belegte Prosa, gegen die der unabhängige Zähler abrechnet.
  prosaSpannen: Array<readonly [number, number]>;
  nutztGrenze: boolean;
  exportierte: string[];
  /**
   * AUFTRAG-mega76 BLOCK E: die Ref-Bezeichner, auf denen in DIESER Datei `showModal()` läuft —
   * `dialogRef.current.showModal()` ebenso wie `const d = dialogRef.current; d.showModal()`.
   */
  nativeRefs: Set<string>;
}

function istExportiert(n: ts.Declaration): boolean {
  const flags = ts.getCombinedModifierFlags(n);
  return (flags & (ts.ModifierFlags.Export | ts.ModifierFlags.Default)) !== 0;
}

function aufrufName(call: ts.CallExpression): string {
  const c = call.expression;
  if (ts.isIdentifier(c)) {
    return c.text;
  }
  if (ts.isPropertyAccessExpression(c)) {
    return c.name.text;
  }
  return "";
}

function istTextToken(n: ts.Node): boolean {
  return (
    ts.isStringLiteral(n) ||
    ts.isJsxText(n) ||
    n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
    n.kind === ts.SyntaxKind.TemplateHead ||
    n.kind === ts.SyntaxKind.TemplateMiddle ||
    n.kind === ts.SyntaxKind.TemplateTail ||
    n.kind === ts.SyntaxKind.RegularExpressionLiteral
  );
}

function erhebeDatei(quelle: Quelle): DateiErhebung {
  const sf = quelle.ast;
  const kandidaten: Kandidat[] = [];
  const prosaSpannen: Array<readonly [number, number]> = [];
  const exportierte: string[] = [];
  let nutztGrenze = false;
  // Text-Tokens, die bereits als Kandidat erfasst sind, dürfen nicht zusätzlich Prosa werden —
  // sonst wäre jede Erwähnung doppelt erklärt und der Zähler wertlos.
  const kandidatTokens = new Set<ts.Node>();

  const melde = (n: ts.Node, art: KandidatArt, ref?: string): void => {
    kandidaten.push({ datei: quelle.datei, zeile: zeileVon(sf, n), art, ...(ref ? { ref } : {}) });
  };

  // AUFTRAG-mega76 BLOCK E — die Kette `<dialog ref={R}>` … `R.current.showModal()` nachziehen.
  // `aliasse` fängt die Zwischenvariable ab (`const d = dialogRef.current`), `showModalZiele` die
  // Bezeichner, auf denen der Aufruf wirklich steht. Erst beides zusammen belegt, dass GENAU
  // dieses `<dialog>` vom Browser modal gemacht wird.
  const aliasse = new Map<string, string>();
  const showModalZiele = new Set<string>();

  // Der Bezeichner hinter `X`, `X.current` oder einem Alias darauf.
  const refBezeichner = (n: ts.Node): string | undefined => {
    if (ts.isIdentifier(n)) {
      return aliasse.get(n.text) ?? n.text;
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === "current") {
      return refBezeichner(n.expression);
    }
    return undefined;
  };

  const besuch = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useModalBoundary"
    ) {
      nutztGrenze = true;
    }
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) {
      if (istExportiert(node)) {
        exportierte.push(node.name.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      istExportiert(node)
    ) {
      exportierte.push(node.name.text);
    }

    // `aria-modal` als JSX-Attribut — die gerade Bauform.
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "aria-modal") {
      melde(node.name, "aria-modal-attribut");
    }
    // `aria-modal` als Objekt-Eigenschaft — die Spread-Bauform aus bens Befund.
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.name) &&
      node.name.text === "aria-modal"
    ) {
      melde(node.name, "aria-modal-eigenschaft");
      kandidatTokens.add(node.name);
    }
    // `aria-modal` als nackte Zeichenkette — `setAttribute` und Verwandte.
    if (
      (ts.isStringLiteral(node) || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) &&
      (node as ts.StringLiteralLike).text === "aria-modal" &&
      !kandidatTokens.has(node)
    ) {
      melde(node, "aria-modal-zeichenkette");
      kandidatTokens.add(node);
    }
    // `<dialog>` im JSX.
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sf) === "dialog"
    ) {
      const refAttr = node.attributes.properties.find(
        (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === "ref",
      );
      const refAusdruck =
        refAttr?.initializer && ts.isJsxExpression(refAttr.initializer)
          ? refAttr.initializer.expression
          : undefined;
      melde(node.tagName, "dialog-jsx", refAusdruck ? refBezeichner(refAusdruck) : undefined);
    }
    // `const d = dialogRef.current` — die Zwischenvariable, über die der Aufruf meist läuft.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isPropertyAccessExpression(node.initializer) &&
      node.initializer.name.text === "current" &&
      ts.isIdentifier(node.initializer.expression)
    ) {
      aliasse.set(node.name.text, node.initializer.expression.text);
    }
    // `createElement("dialog", …)` — React wie DOM.
    if (ts.isCallExpression(node) && aufrufName(node) === "createElement") {
      const erstes = node.arguments[0];
      if (erstes && ts.isStringLiteral(erstes) && erstes.text === "dialog") {
        melde(erstes, "dialog-createElement");
        kandidatTokens.add(erstes);
      }
    }
    // `role="dialog"` / `role="alertdialog"` als JSX-Attribut oder Objekt-Eigenschaft.
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sf) === "role" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      (node.initializer.text === "dialog" || node.initializer.text === "alertdialog")
    ) {
      melde(node.initializer, "role-dialog");
      kandidatTokens.add(node.initializer);
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(sf).replace(/["']/g, "") === "role" &&
      ts.isStringLiteral(node.initializer) &&
      (node.initializer.text === "dialog" || node.initializer.text === "alertdialog")
    ) {
      melde(node.initializer, "role-dialog");
      kandidatTokens.add(node.initializer);
    }
    // `showModal` — Punktzugriff oder Index-Zugriff.
    if (ts.isPropertyAccessExpression(node) && node.name.text === "showModal") {
      melde(node.name, "showModal-nutzung");
      const ziel = refBezeichner(node.expression);
      if (ziel) {
        showModalZiele.add(ziel);
      }
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === "showModal"
    ) {
      melde(node.argumentExpression, "showModal-nutzung");
      kandidatTokens.add(node.argumentExpression);
    }

    // Alles Text-Artige, das kein Kandidat wurde, ist belegte Prosa.
    if (istTextToken(node) && !kandidatTokens.has(node)) {
      prosaSpannen.push([node.getStart(sf), node.end] as const);
    }

    ts.forEachChild(node, besuch);
  };
  besuch(sf);

  // Die Aliasse sind erst nach dem vollständigen Lauf bekannt (`const d = …` kann NACH dem
  // `<dialog>` stehen). Deshalb werden beide Seiten hier abschliessend aufgelöst.
  const nativeRefs = new Set([...showModalZiele].map((z) => aliasse.get(z) ?? z));
  for (const k of kandidaten) {
    if (k.ref) {
      k.ref = aliasse.get(k.ref) ?? k.ref;
    }
  }
  return { quelle, kandidaten, prosaSpannen, nutztGrenze, exportierte, nativeRefs };
}

// --- Der unabhängige Zähler: Wort-Erwähnungen gegen die Erklärung des Syntaxbaums abrechnen. ---

function trefferZeilen(gestrippt: string, muster: RegExp): number[] {
  const zeilen: number[] = [];
  for (const m of gestrippt.matchAll(muster)) {
    zeilen.push(gestrippt.slice(0, m.index).split("\n").length);
  }
  return zeilen;
}

function prosaTreffer(e: DateiErhebung, muster: RegExp): number {
  let n = 0;
  for (const [start, ende] of e.prosaSpannen) {
    n += [...e.quelle.text.slice(start, ende).matchAll(muster)].length;
  }
  return n;
}

// Kern des Auftrags: eine Erwähnung, die weder Kandidat noch belegte Prosa ist, heißt „diese
// Bauform konnte ich nicht lesen" — und das ist ROT, kein stilles Loch.
function unabgerechnet(e: DateiErhebung, muster: RegExp, erklaerteKandidaten: number): string[] {
  const zeilen = trefferZeilen(e.quelle.gestrippt, muster);
  const erklaert = erklaerteKandidaten + prosaTreffer(e, muster);
  if (zeilen.length <= erklaert) {
    return [];
  }
  return [
    `${e.quelle.datei}:${zeilen.join(",")} — ${zeilen.length} Erwähnung(en) von ${muster.source}, nur ${erklaert} abgerechnet (Kandidat oder Prosa): eine Bauform, die dieser Sammler nicht beurteilen konnte`,
  ];
}

function modalAbgleich(e: DateiErhebung): string[] {
  const anzahl = (arten: readonly KandidatArt[]): number =>
    e.kandidaten.filter((k) => arten.includes(k.art)).length;
  return [
    ...unabgerechnet(
      e,
      /aria-modal/g,
      anzahl(["aria-modal-attribut", "aria-modal-eigenschaft", "aria-modal-zeichenkette"]),
    ),
    ...unabgerechnet(e, /showModal/g, anzahl(["showModal-nutzung"])),
    ...unabgerechnet(e, /<dialog\b/g, anzahl(["dialog-jsx"])),
  ];
}

// --- Die Urteile: jeder Kandidat bekommt genau eines; ohne Grenze ist rot. ---

type Urteil = "an-der-grenze" | "grenzmodul" | "nativ-modal-ausgenommen" | "OHNE GRENZE";

interface Beurteilung {
  kandidat: Kandidat;
  urteil: Urteil;
}

function beurteile(erhebungen: DateiErhebung[]): { beurteilt: Beurteilung[]; rot: string[] } {
  const beurteilt: Beurteilung[] = [];
  const rot: string[] = [];
  for (const e of erhebungen) {
    const ausnahme = NATIV_MODAL_AUSNAHMEN.get(e.quelle.datei);
    for (const k of e.kandidaten) {
      let urteil: Urteil;
      if (k.datei === GRENZE_MODUL) {
        urteil = "grenzmodul";
      } else if (e.nutztGrenze) {
        urteil = "an-der-grenze";
      } else if (
        ausnahme !== undefined &&
        (k.art === "showModal-nutzung" ||
          (k.art === "dialog-jsx" && !!k.ref && e.nativeRefs.has(k.ref)))
      ) {
        // AUFTRAG-mega76 BLOCK E: die Ausnahme hing bis hier an der DATEI. Damit deckte sie
        // ALLE Kandidaten dieser Datei — auch solche, die mit `showModal()` nichts zu tun haben
        // (etwa ein zweites, rein React-gebautes Overlay in derselben Datei). Sie deckte also
        // mehr ab, als sie sollte. Jetzt ist sie an DENSELBEN Fund gebunden, den sie begründet:
        // ausgenommen ist die `showModal`-Nutzung selbst, sonst nichts.
        urteil = "nativ-modal-ausgenommen";
      } else {
        urteil = "OHNE GRENZE";
        rot.push(
          `${k.datei}:${k.zeile} — ${k.art}: mögliche modale Fläche ohne die Modalgrenze der Shell (weder useModalBoundary noch begründete Ausnahme). Eine Modalität, die nur behauptet wird, ist genau der Fehler, den mega48 schließt.`,
        );
      }
      beurteilt.push({ kandidat: k, urteil });
    }
    // Eine Ausnahme, die ihren Beleg verloren hat, ist eine Zusage von gestern.
    if (ausnahme !== undefined && !e.kandidaten.some((k) => k.art === "showModal-nutzung")) {
      rot.push(
        `${e.quelle.datei} — als nativ-modal ausgenommen (${ausnahme}), aber ohne showModal() im Quelltext: die Ausnahme trägt nicht mehr`,
      );
    }
  }
  return { beurteilt, rot };
}

// --- Die Aufrufer: Identifikatoren statt Zeichenketten, unbekannte Formen rot statt unsichtbar. ---

interface Bauteil {
  datei: string;
  komponente: string;
}

interface Paar {
  einbinder: string;
  bauteil: string;
}

function schluessel(p: Paar): string {
  return `${p.einbinder} → <${p.bauteil}>`;
}

type VerweisArt =
  | "import"
  | "jsx"
  | "createElement"
  | "alias-anlage"
  | "typ"
  | "eigenschaftsname"
  | "deklaration"
  | "export-weitergabe"
  | "UNBEURTEILBAR";

function istJsxTagName(n: ts.Node): boolean {
  const p = n.parent;
  if (
    (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) &&
    p.tagName === n
  ) {
    return true;
  }
  // Qualifizierte Tags (<Ns.Komponente/>): der Namensteil hängt an einem PropertyAccess im Tag.
  if (ts.isPropertyAccessExpression(p) && p.name === n) {
    return istJsxTagName(p);
  }
  return false;
}

function klassifiziere(n: ts.Identifier): { art: VerweisArt; alias?: string } {
  const p = n.parent;
  if (ts.isImportSpecifier(p)) {
    const klausel = p.parent.parent;
    if (p.isTypeOnly || (ts.isImportClause(klausel) && klausel.isTypeOnly)) {
      return { art: "typ" };
    }
    if (p.propertyName === n && p.name.text !== n.text) {
      return { art: "alias-anlage", alias: p.name.text };
    }
    return { art: "import" };
  }
  if (ts.isImportClause(p) && p.name === n) {
    return { art: "import" };
  }
  if (ts.isExportSpecifier(p)) {
    return { art: "export-weitergabe" };
  }
  if (istJsxTagName(n)) {
    return { art: "jsx" };
  }
  if (ts.isCallExpression(p) && p.arguments[0] === n && aufrufName(p) === "createElement") {
    return { art: "createElement" };
  }
  if (ts.isVariableDeclaration(p) && p.initializer === n && ts.isIdentifier(p.name)) {
    return { art: "alias-anlage", alias: p.name.text };
  }
  if (ts.isTypeQueryNode(p) || ts.isTypeReferenceNode(p)) {
    return { art: "typ" };
  }
  if (ts.isPropertyAssignment(p) && p.name === n) {
    return { art: "eigenschaftsname" };
  }
  if (
    (ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isVariableDeclaration(p)) &&
    p.name === n
  ) {
    return { art: "deklaration" };
  }
  return { art: "UNBEURTEILBAR" };
}

// ================================================================================================
// JOB 917 D2 (bens Prüflücke 1+2) — HERKUNFT STATT NAMENSTEXT.
// ================================================================================================
//
// Bis hierher verglich die Aufruferermittlung ausschließlich GLEICHEN NAMENSTEXT
// (`sammleIdentifikatoren(sf, b.komponente)`). Das ist Syntaxwahrheit, nicht Symbolwahrheit: ein
// fremdes `Modal` aus einer anderen Datei, eine lokale Deklaration desselben Namens oder eine
// Namenskollision zählten als produktiver Aufrufer — und ein Namensraum-Zugriff (`Ns.Modal`) fiel
// umgekehrt heraus. bens Urteil dazu: der Wächter bekäme eine „scheinbar semantische, tatsächlich
// kollisionsanfällige Aussage".
//
// Ab jetzt entscheidet die BINDUNG: welcher Modulpfad und welcher Exportname steht hinter dem
// Namen, den diese Datei benutzt. Aufgelöst wird ohne TypeScript-Program (das würde den gesamten
// Baum typprüfen); die Importdeklarationen der Datei reichen dafür aus und sind deterministisch.
interface Bindung {
  /** Repo-relative Datei des Moduls — leer, wenn nicht auf eine Projektdatei auflösbar. */
  modul: string;
  /** Exportname; `*` für einen Namensraumimport, `default` für den Vorgabeexport. */
  export: string;
}

let QUELLDATEIEN_INDEX: Set<string> | null = null;
function quelldateienIndex(): Set<string> {
  if (QUELLDATEIEN_INDEX === null) {
    QUELLDATEIEN_INDEX = new Set(quelldateien(WEB_SRC));
  }
  return QUELLDATEIEN_INDEX;
}

/**
 * Ein relativer Spezifizierer wird zur Projektdatei. Paketimporte (`react`, `@x/y`) sind bewusst
 * `null`: sie können kein hier registriertes Bauteil sein.
 */
function moduldatei(vonDatei: string, spez: string): string | null {
  if (!spez.startsWith(".")) {
    return null;
  }
  const teile = vonDatei.split("/");
  teile.pop();
  for (const stueck of spez.split("/")) {
    if (stueck === "." || stueck === "") {
      continue;
    }
    if (stueck === "..") {
      teile.pop();
    } else {
      teile.push(stueck);
    }
  }
  const basis = teile.join("/");
  const index = quelldateienIndex();
  for (const kandidat of [
    basis,
    `${basis}.tsx`,
    `${basis}.ts`,
    `${basis}/index.tsx`,
    `${basis}/index.ts`,
  ]) {
    if (index.has(kandidat)) {
      return kandidat;
    }
  }
  return null;
}

const BINDUNGS_CACHE = new WeakMap<ts.SourceFile, Map<string, Bindung>>();

/** Lokaler Name → Herkunft. Typ-only-Importe sind keine Flächen und bleiben draußen. */
function bindungenVon(quelle: { datei: string; ast: ts.SourceFile }): Map<string, Bindung> {
  const zwischen = BINDUNGS_CACHE.get(quelle.ast);
  if (zwischen !== undefined) {
    return zwischen;
  }
  const map = new Map<string, Bindung>();
  for (const st of quelle.ast.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) {
      continue;
    }
    const klausel = st.importClause;
    if (!klausel || klausel.isTypeOnly) {
      continue;
    }
    const ziel = moduldatei(quelle.datei, st.moduleSpecifier.text) ?? "";
    if (klausel.name) {
      map.set(klausel.name.text, { modul: ziel, export: "default" });
    }
    const gebunden = klausel.namedBindings;
    if (gebunden && ts.isNamespaceImport(gebunden)) {
      map.set(gebunden.name.text, { modul: ziel, export: "*" });
    }
    if (gebunden && ts.isNamedImports(gebunden)) {
      for (const sp of gebunden.elements) {
        if (sp.isTypeOnly) {
          continue;
        }
        map.set(sp.name.text, { modul: ziel, export: (sp.propertyName ?? sp.name).text });
      }
    }
  }
  BINDUNGS_CACHE.set(quelle.ast, map);
  return map;
}

/**
 * Die lokalen Namen, unter denen DIESE Datei GENAU DIESES Bauteil führt — plus die Namen etwaiger
 * Namensraumimporte desselben Moduls. Trägt die Datei den gleichen Namenstext aus anderer Quelle
 * (oder deklariert ihn selbst), steht er hier NICHT: das ist bens Kollisionsfall.
 */
function lokaleNamenFuer(
  quelle: { datei: string; ast: ts.SourceFile },
  b: Bauteil,
): { namen: Set<string>; namensraeume: Set<string> } {
  const namen = new Set<string>();
  const namensraeume = new Set<string>();
  for (const [name, bindung] of bindungenVon(quelle)) {
    if (bindung.modul !== b.datei) {
      continue;
    }
    if (bindung.export === b.komponente) {
      namen.add(name);
    } else if (bindung.export === "*") {
      namensraeume.add(name);
    }
  }
  return { namen, namensraeume };
}

/**
 * Der Re-Export (`export { Modal } from "./Modal"`) ist KEINE Importbindung und stand deshalb nach
 * der Umstellung auf Herkunft plötzlich nicht mehr im Rot — obwohl er ein echter Weitergabeweg ist,
 * dem dieser Sammler nicht folgen kann. Er wird hier eigens erkannt und bleibt unbeurteilbar.
 */
function reexportZeilen(quelle: { datei: string; ast: ts.SourceFile }, b: Bauteil): number[] {
  const zeilen: number[] = [];
  for (const st of quelle.ast.statements) {
    if (
      !ts.isExportDeclaration(st) ||
      !st.moduleSpecifier ||
      !ts.isStringLiteral(st.moduleSpecifier)
    ) {
      continue;
    }
    if (moduldatei(quelle.datei, st.moduleSpecifier.text) !== b.datei) {
      continue;
    }
    const gebunden = st.exportClause;
    if (gebunden && ts.isNamedExports(gebunden)) {
      for (const sp of gebunden.elements) {
        if ((sp.propertyName ?? sp.name).text === b.komponente) {
          zeilen.push(zeileVon(quelle.ast, sp));
        }
      }
    } else if (!gebunden) {
      // `export * from "./Modal"` — trägt das Bauteil weiter, ohne es zu nennen.
      zeilen.push(zeileVon(quelle.ast, st));
    }
  }
  return zeilen;
}

/**
 * Namensraum-Zugriff auf das Bauteil: `<Ns.Modal/>` oder `createElement(Ns.Modal, …)`.
 * Gezählt wird nur, wenn `Ns` wirklich das Modul des Bauteils bezeichnet.
 */
function namensraumNutzungen(
  sf: ts.SourceFile,
  namensraeume: Set<string>,
  komponente: string,
): ts.PropertyAccessExpression[] {
  const funde: ts.PropertyAccessExpression[] = [];
  const besuch = (n: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      namensraeume.has(n.expression.text) &&
      n.name.text === komponente
    ) {
      const p = n.parent;
      const imTag =
        (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) &&
        p.tagName === n;
      const imCreateElement =
        ts.isCallExpression(p) && p.arguments[0] === n && aufrufName(p) === "createElement";
      if (imTag || imCreateElement) {
        funde.push(n);
      }
    }
    ts.forEachChild(n, besuch);
  };
  besuch(sf);
  return funde;
}

function sammleIdentifikatoren(sf: ts.SourceFile, name: string): ts.Identifier[] {
  const funde: ts.Identifier[] = [];
  const besuch = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && n.text === name) {
      funde.push(n);
    }
    ts.forEachChild(n, besuch);
  };
  besuch(sf);
  return funde;
}

interface VerweisBild {
  paare: Paar[];
  rot: string[];
  identifikatoren: number;
  /** Gleicher Namenstext, andere Herkunft — kein Paar, aber sichtbar statt stillschweigend. */
  fremdbefunde: string[];
}

function erhebeVerweise(erhebungen: DateiErhebung[], bauteile: Bauteil[]): VerweisBild {
  const paare: Paar[] = [];
  const rot: string[] = [];
  const fremdbefunde: string[] = [];
  let identifikatoren = 0;
  for (const e of erhebungen) {
    const sf = e.quelle.ast;
    for (const b of bauteile) {
      if (e.quelle.datei === b.datei) {
        continue;
      }
      // Weiterhin nach Namenstext gesammelt — aber NUR NOCH für den unabhängigen Zähler unten.
      const direkte = sammleIdentifikatoren(sf, b.komponente);
      // HERKUNFT ZUERST: unter welchen lokalen Namen führt DIESE Datei GENAU DIESES Bauteil?
      const { namen: lokale, namensraeume } = lokaleNamenFuer(e.quelle, b);
      for (const zeile of reexportZeilen(e.quelle, b)) {
        rot.push(
          `${e.quelle.datei}:${zeile} — Verweis auf <${b.komponente}> in nicht beurteilbarer Form (export-weitergabe): dieser Sammler kann nicht sagen, ob daraus eine modale Fläche wird`,
        );
      }
      if (lokale.size === 0 && namensraeume.size === 0) {
        // Gleicher Namenstext, andere oder gar keine Herkunft: KEIN Paar. Das ist bens
        // Kollisionsfall — und er ist kein Fehler, sondern ein zulässiger Zustand, den der Sammler
        // nur nicht mehr verwechseln darf.
        if (direkte.length > 0) {
          fremdbefunde.push(
            `${e.quelle.datei} — führt den Namenstext „${b.komponente}", aber ohne Bindung an ${b.datei}: kein Aufrufer`,
          );
        }
        rot.push(...unabgerechnet(e, new RegExp(`\\b${b.komponente}\\b`, "g"), direkte.length));
        continue;
      }
      const aliasNamen: string[] = [];
      // Namensraum-Zugriff (`<Ns.Modal/>`, `createElement(Ns.Modal, …)`) ist eine Einbindung —
      // aber nur, wenn `Ns` wirklich das Modul dieses Bauteils bezeichnet.
      let nutzung = namensraumNutzungen(sf, namensraeume, b.komponente).length > 0;
      let verwiesen = namensraeume.size > 0;
      let unklar = false;
      for (const name of lokale) {
        for (const id of sammleIdentifikatoren(sf, name)) {
          identifikatoren++;
          const urteil = klassifiziere(id);
          if (urteil.art === "jsx" || urteil.art === "createElement") {
            nutzung = true;
          } else if (urteil.art === "import" || urteil.art === "alias-anlage") {
            verwiesen = true;
            if (urteil.alias !== undefined) {
              aliasNamen.push(urteil.alias);
            }
          } else if (urteil.art === "export-weitergabe" || urteil.art === "UNBEURTEILBAR") {
            unklar = true;
            rot.push(
              `${e.quelle.datei}:${zeileVon(sf, id)} — Verweis auf <${b.komponente}> in nicht beurteilbarer Form (${urteil.art}): dieser Sammler kann nicht sagen, ob daraus eine modale Fläche wird`,
            );
          }
          // „typ", „eigenschaftsname" und „deklaration" sind neutrale Formen ohne Fläche.
        }
      }
      // Alias-Verwendungen, genau eine Stufe tief — die Bauform aus bens Befund.
      for (const alias of aliasNamen) {
        for (const id of sammleIdentifikatoren(sf, alias)) {
          identifikatoren++;
          const urteil = klassifiziere(id);
          if (urteil.art === "jsx" || urteil.art === "createElement") {
            nutzung = true;
          } else if (urteil.art === "alias-anlage") {
            unklar = true;
            rot.push(
              `${e.quelle.datei}:${zeileVon(sf, id)} — Alias eines Alias von <${b.komponente}> („${alias}“) — eine Stufe zu tief für diese Erhebung`,
            );
          } else if (urteil.art === "export-weitergabe" || urteil.art === "UNBEURTEILBAR") {
            unklar = true;
            rot.push(
              `${e.quelle.datei}:${zeileVon(sf, id)} — Alias „${alias}“ von <${b.komponente}> in nicht beurteilbarer Form (${urteil.art})`,
            );
          }
        }
      }
      if (nutzung) {
        paare.push({ einbinder: e.quelle.datei, bauteil: b.komponente });
      } else if (verwiesen && !unklar) {
        rot.push(
          `${e.quelle.datei} — verweist auf <${b.komponente}> (Import/Alias), aber ohne erkennbare Einbindung: entweder tot oder eine Bauform außerhalb der Sicht dieses Sammlers`,
        );
      }
      // Der unabhängige Zähler je Bauteil-Name: jede Wort-Erwähnung muss ein Identifikator oder
      // belegte Prosa sein (Alias-Namen sind eigene Wörter und zählen hier nicht mit).
      rot.push(...unabgerechnet(e, new RegExp(`\\b${b.komponente}\\b`, "g"), direkte.length));
    }
  }
  return { paare, rot, identifikatoren, fremdbefunde };
}

// --- Die eigentliche Erhebung über den heutigen Quellbaum. ---

const ALLE_ERHEBUNGEN: DateiErhebung[] = quelldateien(WEB_SRC).map((d) =>
  erhebeDatei(ladeQuelle(d)),
);
// KALIBRIERUNG (Bericht mega72): für die roten Läufe wurde hier von Hand je EINE synthetische
// Quelle in den Bestand geschoben (Bauformen Alias, createElement, Spread-aria-modal) und der Lauf
// einzeln rot gezeigt. Die dauerhafte Absicherung derselben Bauformen liegt unten als Tests auf
// denselben Funktionen.

const NICHT_LESBAR: string[] = ALLE_ERHEBUNGEN.flatMap((e) => e.quelle.leseFehler);
const KANDIDATEN: Kandidat[] = ALLE_ERHEBUNGEN.flatMap((e) => e.kandidaten);
const BEURTEILUNG = beurteile(ALLE_ERHEBUNGEN);
const UNABGERECHNET: string[] = ALLE_ERHEBUNGEN.flatMap(modalAbgleich);

// Ein modales BAUTEIL behauptet App-Modalität (aria-modal in irgendeiner Bauform) und ist weder das
// Grenzmodul noch nativ ausgenommen; seine exportierten Komponenten sind das, was Aufrufer einbinden.
const BAUTEIL_ERHEBUNGEN: DateiErhebung[] = ALLE_ERHEBUNGEN.filter(
  (e) =>
    e.quelle.datei !== GRENZE_MODUL &&
    !NATIV_MODAL_AUSNAHMEN.has(e.quelle.datei) &&
    e.kandidaten.some((k) => k.art.startsWith("aria-modal")),
);
const BAUTEILE: Bauteil[] = BAUTEIL_ERHEBUNGEN.flatMap((e) =>
  e.exportierte.map((komponente) => ({ datei: e.quelle.datei, komponente })),
);
const BAUTEIL_ROT: string[] = BAUTEIL_ERHEBUNGEN.filter((e) => e.exportierte.length === 0).map(
  (e) =>
    `${e.quelle.datei} — behauptet aria-modal, exportiert aber keine Komponente: Aufrufer sind so nicht erhebbar`,
);
const VERWEISE: VerweisBild = erhebeVerweise(ALLE_ERHEBUNGEN, BAUTEILE);
const ERWARTETE_PAARE: Paar[] = VERWEISE.paare;

// ================================================================================================
// JOB 917 D2 (bens Prüflücken 3, 5 und 6) — DAS AUSDRÜCKLICHE REGISTER DER MARKERLOSEN TRÄGER.
// ================================================================================================
//
// Die Erhebung oben findet ein Bauteil nur, wenn es MODALITÄT BEHAUPTET (aria-modal, showModal,
// <dialog>). Genau daran scheitert sie bei der Klasse, um die es hier geht: Flächen, die den
// ganzen Bildschirm einnehmen, den Hintergrund verdecken und über `open` gesteuert werden — aber
// keinen einzigen Marker tragen. Für den Sammler sind sie unsichtbar, und ihre Zahl ist aus dem
// Bestand nicht ableitbar.
//
// Deshalb ein AUSDRÜCKLICHES Register statt einer Heuristik. bens Einwand gegen eine unbeherrschte
// `fixed inset-0`-Suche bleibt gültig — sie wird hier auch nicht als Erkenner benutzt, sondern nur
// als BEZUGSMENGE: jede Datei, die so eine Fläche aufspannt, muss in GENAU EINER der drei Klassen
// unten stehen. Wer eine vierte hinzufügt, wird rot.
//
// DIE ENTDECKUNGSGRENZE STEHT OFFEN: über Flächen, die auf anderem Weg den Bildschirm füllen
// (eigene Klassennamen, berechnete Stile, Portale ohne diese Klasse), sagt dieses Register NICHTS.
// Es behauptet Vollständigkeit ausschließlich innerhalb seiner Bezugsmenge.
// JOB 917/D3 (BEN D2, Korrekturpflicht 2): Hier stand `/fixed inset-0/` — die WÖRTLICHE
// Klassenfolge. Dieselbe Tailwind-Fläche in anderer Reihenfolge (`inset-0 fixed`) oder in
// gleichwertiger Schreibweise (`fixed inset-x-0 inset-y-0`, vier Randklassen) ging daran vorbei und
// wäre als neuer markerloser Träger STILL geblieben — die Bezugsmenge hätte sie nie gesehen.
//
// Geprüft wird jetzt die AUSSAGE statt der Zeichenfolge: eine Fläche spannt den Bildschirm auf,
// wenn `fixed` gesetzt ist UND alle vier Seiten gebunden sind — gleich ob über `inset-0`, über die
// beiden Achsen oder über vier Randklassen. Die Reihenfolge ist dabei bedeutungslos, weil eine
// Klassenliste eine MENGE ist und keine Folge.
const VOLLFLAECHE_ALLE_SEITEN = [
  /\binset-0\b/,
  /\binset-x-0\b[\s\S]*\binset-y-0\b|\binset-y-0\b[\s\S]*\binset-x-0\b/,
  /\btop-0\b[\s\S]*\bright-0\b[\s\S]*\bbottom-0\b[\s\S]*\bleft-0\b/,
];

function spanntVollflaecheAuf(quelltext: string): boolean {
  if (!/\bfixed\b/.test(quelltext)) {
    return false;
  }
  return VOLLFLAECHE_ALLE_SEITEN.some((muster) => muster.test(quelltext));
}

/**
 * Markerlose Modalträger: Vollbild, verdeckend, über `open` gesteuert — ohne `aria-modal`, ohne
 * `showModal`, ohne `<dialog>`. Schlüssel ist Modulpfad PLUS Exportname, nicht der Namenstext.
 *
 * KEINE dieser drei Flächen trägt heute die Modalgrenze der Shell (gemessen: `Modal.tsx` und
 * `KnowledgeInputStudio.tsx` kennen `ModalBoundaryContext` gar nicht, `CommandPalette.tsx` liest
 * ihn nur über `useModalLocked`). Das ist der Befund, nicht sein Fehlen — und er wird hier
 * festgehalten, nicht repariert: Dialogsemantik ist ausdrücklich nicht Gegenstand dieses Baus.
 */
const MARKERLOSE_TRAEGER: Bauteil[] = [
  { datei: "apps/web/src/components/Modal.tsx", komponente: "Modal" },
  { datei: "apps/web/src/shell/CommandPalette.tsx", komponente: "CommandPalette" },
  { datei: "apps/web/src/components/KnowledgeInputStudio.tsx", komponente: "KnowledgeInputStudio" },
];

/**
 * Vollbildflächen, die AUSDRÜCKLICH nicht modal sind — bens Negativgrenze. Sie dürfen nicht allein
 * wegen ihrer Layoutklassen zu Kandidaten werden, und ihr Grund steht dabei.
 */
const NICHT_MODALE_VOLLFLAECHEN = new Map<string, string>([
  [
    "apps/web/src/components/HelpTip.tsx",
    "Hilfe-Sprechblase: die Vollfläche ist der Klickfänger zum Schließen, der Inhalt bleibt ein Popover neben dem Auslöser",
  ],
  [
    "apps/web/src/components/AiModelInfo.tsx",
    "Modellauskunft als Popover: dieselbe Bauform, reine Auskunft ohne Bedienfluss",
  ],
]);

/**
 * Jede Datei der Bezugsmenge, die in KEINER der drei Klassen steht. Genau das ist die Gegenprobe
 * gegen einen still hinzugefügten markerlosen Träger.
 */
// GEMESSEN beim ersten Lauf dieser Probe: die Bezugsmenge kennt VIER Klassen, nicht drei.
// `BodyImageGallery.tsx` spannt eine Vollfläche auf, trägt aber echte native Modalität
// (`showModal()`), und genau deshalb steht sie in `NATIV_MODAL_AUSNAHMEN` und NICHT in `BAUTEILE`.
// Sie hier zu vergessen hätte den Wächter gegen den Bestand rot gemacht — an einer Fläche, die die
// STÄRKSTE Form von Modalität hat. Die native Ausnahme ist deshalb die vierte zulässige Klasse.
function unregistrierteVollflaechen(
  erhebungen: DateiErhebung[],
  markerTragende: Bauteil[],
): string[] {
  const mitMarker = new Set(markerTragende.map((b) => b.datei));
  const markerlos = new Set(MARKERLOSE_TRAEGER.map((b) => b.datei));
  return erhebungen
    .filter((e) => spanntVollflaecheAuf(e.quelle.gestrippt))
    .map((e) => e.quelle.datei)
    .filter(
      (d) =>
        !mitMarker.has(d) &&
        !markerlos.has(d) &&
        !NICHT_MODALE_VOLLFLAECHEN.has(d) &&
        !NATIV_MODAL_AUSNAHMEN.has(d),
    );
}

const MARKERLOSE_VERWEISE: VerweisBild = erhebeVerweise(ALLE_ERHEBUNGEN, MARKERLOSE_TRAEGER);

// ---------------------------------------------------------------------------------------------
// (2) Die gemounteten Fälle — einer je Paar, an der ECHTEN Verdrahtung (Seite IN der echten Shell).
// ---------------------------------------------------------------------------------------------

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let toastZapfhahn: ((kind: "info", text: string) => void) | null = null;

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

// Schmale Darstellung (≤899px, NARROW_QUERY): erst darunter gibt es überhaupt ein Filterblatt bzw.
// einen Navigations-Drawer.
function schmal(): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: true,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Ein Zapfhahn für echte Toasts: er hängt im echten ToastProvider, und was er auslöst, rendert der
// echte ToastViewport an seinem echten Platz in der Shell. Kein Nachbau der Toast-Fläche.
function ToastZapfhahn(): null {
  const { push } = useToast();
  useEffect(() => {
    toastZapfhahn = push;
    return () => {
      toastZapfhahn = null;
    };
  }, [push]);
  return null;
}

// Die ECHTE Shell mit der echten Provider-Kette — dieselbe Reihenfolge wie in App.tsx.
async function render(inhalt: unknown): Promise<void> {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/"] },
                  createElement(AppShell, null, inhalt as never, createElement(ToastZapfhahn)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

function knopfMitText(teil: string): HTMLElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(teil),
  );
  if (!(btn instanceof HTMLElement)) {
    throw new Error(`Knopf mit Text „${teil}“ nicht gefunden`);
  }
  return btn;
}

function knopfMitAria(label: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!el) {
    throw new Error(`Element mit aria-label „${label}“ nicht gefunden`);
  }
  return el;
}

function dialog(): HTMLElement | null {
  return container.querySelector<HTMLElement>("dialog[aria-modal='true']");
}

interface Fall extends Paar {
  name: string;
  mounten: () => Promise<void>;
  ausloeser: () => HTMLElement;
}

const FAELLE: Fall[] = [
  {
    einbinder: "apps/web/src/pages/Library.tsx",
    bauteil: "FacetFilter",
    name: "Bibliothek · Filterblatt",
    mounten: () => render(createElement(Library)),
    ausloeser: () => knopfMitText(i18n.t("facet.openFilters")),
  },
  {
    einbinder: "apps/web/src/pages/Validation.tsx",
    bauteil: "FacetFilter",
    name: "Validierung · Filterblatt",
    mounten: () => render(createElement(Validation)),
    ausloeser: () => knopfMitText(i18n.t("facet.openFilters")),
  },
  {
    // bens Ship-Blocker 2: DIESE Fläche existierte bereits produktiv und hatte gar keine Grenze.
    // Sie wird durch die zentrale Modalgrenze mitgeheilt — in `ImportSelect` steht dafür keine
    // einzige Zeile; deshalb steht sie hier auch nur als FALL, nicht als Verdrahtung.
    einbinder: "apps/web/src/components/ImportSelect.tsx",
    bauteil: "FacetFilter",
    name: "Import-Auswahl · Filterblatt",
    mounten: async () => {
      await render(createElement(ImportSelect, { chip: { themes: [], authors: [], spaces: [] } }));
      // Die Filterschiene entsteht erst nach einer Vorschau mit Treffern — das ist der produktive
      // Weg in diese Fläche.
      await klick(knopfMitText(i18n.t("imp.select.previewCta")));
    },
    ausloeser: () => knopfMitText(i18n.t("facet.openFilters")),
  },
  {
    einbinder: "apps/web/src/shell/AppShell.tsx",
    bauteil: "MobileNavDrawer",
    name: "Shell · Navigations-Drawer",
    mounten: () => render(createElement("div", null, "INHALT")),
    ausloeser: () => knopfMitAria(i18n.t("topbar.openMenu")),
  },
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  schmal();
});

afterEach(() => {
  // Die reinen Erhebungs-Tests mounten nichts — nur abbauen, was wirklich steht.
  if (root) {
    act(() => root.unmount());
    container.remove();
  }
  root = undefined as unknown as ReturnType<typeof createRoot>;
  toastZapfhahn = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("mega72 Block A: der unabhängige Zähler — die Erhebung merkt, was sie nicht lesen konnte", () => {
  it("jede Quelldatei ist gelesen; was nicht parsebar ist, wäre rot mit Datei und Zeile", () => {
    expect(ALLE_ERHEBUNGEN.length).toBeGreaterThan(100);
    expect(
      NICHT_LESBAR,
      "\nDiese Dateien konnte der Sammler nicht lesen — sie sind damit UNBEURTEILT, nicht unbedenklich:\n",
    ).toEqual([]);
  });

  it("jede Erwähnung einer modalen Bauform ist abgerechnet — nichts fällt still heraus", () => {
    expect(
      UNABGERECHNET,
      "\nErwähnungen, die weder Kandidat noch belegte Prosa sind — Bauformen außerhalb der Sicht dieses Sammlers:\n",
    ).toEqual([]);
  });

  it("die Erhebung fällt nicht still auf null: die sechs heute bekannten Fundstellen stehen im Fund", () => {
    const probe = (datei: string, art: KandidatArt): boolean =>
      KANDIDATEN.some((k) => k.datei === datei && k.art === art);
    expect(probe("apps/web/src/components/FacetFilter.tsx", "aria-modal-attribut")).toBe(true);
    expect(probe("apps/web/src/components/FacetFilter.tsx", "dialog-jsx")).toBe(true);
    expect(probe("apps/web/src/shell/MobileNavDrawer.tsx", "aria-modal-attribut")).toBe(true);
    expect(probe("apps/web/src/shell/MobileNavDrawer.tsx", "dialog-jsx")).toBe(true);
    expect(probe("apps/web/src/components/BodyImageGallery.tsx", "dialog-jsx")).toBe(true);
    expect(probe("apps/web/src/components/BodyImageGallery.tsx", "showModal-nutzung")).toBe(true);
    expect(KANDIDATEN.length).toBeGreaterThanOrEqual(6);
  });

  // ==============================================================================================
  // AUFTRAG-mega76 BLOCK E — DAS SCHRUMPFEN DER GRUNDMENGE, VOLLSTÄNDIG.
  // ==============================================================================================
  //
  // BENS BEFUND: „der Sammler erkennt nicht jedes Schrumpfen seiner Grundmenge." Er hatte recht,
  // und die Zahlen zeigen wie deutlich. Die einzige Untergrenze war `ALLE_ERHEBUNGEN.length > 100`
  // — GEMESSEN sind es 382. Es hätten also 281 Quelldateien lautlos aus der Erhebung fallen
  // können, und der Sammler wäre grün geblieben. `VERWEISE.identifikatoren > 0` war ebenso lose
  // (gemessen: 8), und für die Verweispaare und die Bauteilliste gab es GAR KEINE Untergrenze.
  //
  // Jede Zahl hier ist der HEUTE GEMESSENE Wert, kein gerundeter Puffer. Sie darf steigen; fällt
  // sie, findet der Sammler etwas nicht mehr — und das ist ein Fehler, kein Erfolg. Wer eine
  // Fläche absichtlich entfernt, senkt die Zahl bewusst und begründet es hier.
  it("die Grundmenge ist an KEINER Stelle still geschrumpft", () => {
    const untergrenzen: Array<[string, number, number]> = [
      ["gelesene Quelldateien", ALLE_ERHEBUNGEN.length, 382],
      ["Kandidaten (mögliche modale Flächen)", KANDIDATEN.length, 6],
      ["Dateien mit mindestens einem Kandidaten", new Set(KANDIDATEN.map((k) => k.datei)).size, 3],
      ["beurteilte Verweispaare", VERWEISE.paare.length, 4],
      ["untersuchte Identifikatoren", VERWEISE.identifikatoren, 8],
      ["erhobene modale Bauteile", BAUTEILE.length, 2],
    ];
    for (const [was, ist, mindestens] of untergrenzen) {
      expect(
        ist,
        `${was}: ${ist} < ${mindestens}. Eine geschrumpfte Erhebung ist von einer grünen nicht zu unterscheiden — genau darum steht hier die GEMESSENE Zahl und kein Puffer.`,
      ).toBeGreaterThanOrEqual(mindestens);
    }
  });

  it("KALIBRIERUNG — die native Ausnahme deckt NUR den belegten Fund, nicht die ganze Datei", () => {
    // AUFTRAG-mega76 BLOCK E: bis mega76 hing die Ausnahme an der DATEI. Ein zweites, rein
    // React-gebautes `<dialog>` in derselben Datei wäre damit stillschweigend mitgedeckt gewesen,
    // obwohl der Browser es NICHT modal macht. Ohne diesen Fall wäre die Bindung eine Behauptung.
    const quelle = (zeilen: string[]): DateiErhebung =>
      erhebeDatei(quelleAus("apps/web/src/components/BodyImageGallery.tsx", zeilen.join("\n")));

    // Das ECHTE Muster der Datei: ref → Alias → showModal.
    const belegt = quelle([
      "const dialogRef = useRef(null);",
      "function oeffne() { const d = dialogRef.current; d.showModal(); }",
      "const A = <dialog ref={dialogRef} />;",
    ]);
    expect(
      beurteile([belegt]).rot,
      "das `<dialog>`, dessen ref wirklich showModal() empfängt, ist begründet ausgenommen",
    ).toEqual([]);

    // Dieselbe Datei, ZWEI Dialoge — nur einer wird nativ modal gemacht.
    const zweiter = quelle([
      "const dialogRef = useRef(null);",
      "const andererRef = useRef(null);",
      "function oeffne() { const d = dialogRef.current; d.showModal(); }",
      "const A = <dialog ref={dialogRef} />;",
      "const B = <dialog ref={andererRef} />;",
    ]);
    const rot = beurteile([zweiter]).rot;
    expect(
      rot.length,
      `Das zweite <dialog> bekommt vom Browser NICHTS — es muss die Modalgrenze der Shell vorweisen. Gemeldet wurde: ${JSON.stringify(rot)}`,
    ).toBe(1);
    expect(rot[0]).toContain("dialog-jsx");

    // Und ein `<dialog>` ganz ohne ref ist erst recht nicht gedeckt.
    const ohneRef = quelle([
      "const dialogRef = useRef(null);",
      "function oeffne() { dialogRef.current.showModal(); }",
      "const A = <dialog />;",
    ]);
    expect(
      beurteile([ohneRef]).rot.length,
      "ein `<dialog>` ohne ref kann von showModal() gar nicht gemeint sein",
    ).toBe(1);
  });

  it("jeder Kandidat trägt genau ein Urteil, und keines lautet OHNE GRENZE", () => {
    // Exakte Kalibrierung: Kandidaten und Urteile decken sich Stück für Stück.
    expect(BEURTEILUNG.beurteilt.length).toBe(KANDIDATEN.length);
    const urteile: Urteil[] = [
      "an-der-grenze",
      "grenzmodul",
      "nativ-modal-ausgenommen",
      "OHNE GRENZE",
    ];
    const summe = urteile
      .map((u) => BEURTEILUNG.beurteilt.filter((b) => b.urteil === u).length)
      .reduce((a, b) => a + b, 0);
    expect(summe).toBe(KANDIDATEN.length);
    expect(BEURTEILUNG.rot, "\nKandidaten ohne tragfähiges Urteil:\n").toEqual([]);
    // Und die Ausnahmen zeigen auf Dateien, die es noch gibt — sonst beschreibt die Liste gestern.
    for (const [datei] of NATIV_MODAL_AUSNAHMEN) {
      expect(
        ALLE_ERHEBUNGEN.map((e) => e.quelle.datei),
        `Ausnahme ohne Datei: ${datei}`,
      ).toContain(datei);
    }
  });

  it("jeder Verweis auf ein modales Bauteil ist beurteilt — unbeurteilbare Formen wären rot", () => {
    expect(BAUTEIL_ROT).toEqual([]);
    expect(VERWEISE.identifikatoren).toBeGreaterThan(0);
    expect(
      VERWEISE.rot,
      "\nVerweise, die dieser Sammler nicht beurteilen konnte (oder Erwähnungen ohne Abrechnung):\n",
    ).toEqual([]);
  });
});

describe("mega72 Block A: die Bauformen aus bens Befund (Register A17) sieht die Erhebung jetzt", () => {
  const BAUTEIL_FACET: Bauteil = {
    datei: "apps/web/src/components/FacetFilter.tsx",
    komponente: "FacetFilter",
  };
  const synthetisch = (datei: string, zeilen: string[]): DateiErhebung =>
    erhebeDatei(quelleAus(datei, zeilen.join("\n")));

  it("Bauform 1 — Alias-Einbindung (const C = FacetFilter) wird als Aufrufer erhoben", () => {
    const e = synthetisch("apps/web/src/pages/SynthAlias.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      "const Umbenannt = FacetFilter;",
      "export function Seite(): JSX.Element {",
      "  return <Umbenannt themes={[]} authors={[]} spaces={[]} />;",
      "}",
    ]);
    const v = erhebeVerweise([e], [BAUTEIL_FACET]);
    expect(v.rot).toEqual([]);
    expect(v.paare.map(schluessel)).toContain("apps/web/src/pages/SynthAlias.tsx → <FacetFilter>");
  });

  it("Bauform 2 — createElement(FacetFilter, …) wird als Aufrufer erhoben", () => {
    const e = synthetisch("apps/web/src/pages/SynthCreate.tsx", [
      'import { createElement } from "react";',
      'import { FacetFilter } from "../components/FacetFilter";',
      "export function Seite(): unknown {",
      "  return createElement(FacetFilter, null);",
      "}",
    ]);
    const v = erhebeVerweise([e], [BAUTEIL_FACET]);
    expect(v.rot).toEqual([]);
    expect(v.paare.map(schluessel)).toContain("apps/web/src/pages/SynthCreate.tsx → <FacetFilter>");
  });

  it("Bauform 2b — Import-Alias (import { FacetFilter as FF }) wird als Aufrufer erhoben", () => {
    const e = synthetisch("apps/web/src/pages/SynthImportAlias.tsx", [
      'import { FacetFilter as FF } from "../components/FacetFilter";',
      "export function Seite(): JSX.Element {",
      "  return <FF themes={[]} authors={[]} spaces={[]} />;",
      "}",
    ]);
    const v = erhebeVerweise([e], [BAUTEIL_FACET]);
    expect(v.rot).toEqual([]);
    expect(v.paare.map(schluessel)).toContain(
      "apps/web/src/pages/SynthImportAlias.tsx → <FacetFilter>",
    );
  });

  it("Bauform 3 — per Spread gesetztes aria-modal ist ein Kandidat und ohne Grenze rot, mit Datei und Zeile", () => {
    const e = synthetisch("apps/web/src/components/SynthSpread.tsx", [
      'const dialogProps = { "aria-modal": "true" };',
      "export function Fenster(): JSX.Element {",
      "  return <div {...dialogProps} />;",
      "}",
    ]);
    expect(e.kandidaten).toEqual([
      { datei: "apps/web/src/components/SynthSpread.tsx", zeile: 1, art: "aria-modal-eigenschaft" },
    ]);
    // Und der Zähler geht auf: die Erwähnung ist als Kandidat abgerechnet.
    expect(modalAbgleich(e)).toEqual([]);
    const { rot } = beurteile([e]);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/components/SynthSpread.tsx:1");
  });

  it("Bauform 4 — setAttribute(„aria-modal“) und role=„dialog“ sind Kandidaten, ohne Grenze rot", () => {
    const setAttr = synthetisch("apps/web/src/lib/synthSetAttr.ts", [
      "export function markiere(el: HTMLElement): void {",
      '  el.setAttribute("aria-modal", "true");',
      "}",
    ]);
    expect(setAttr.kandidaten.map((k) => k.art)).toEqual(["aria-modal-zeichenkette"]);
    expect(beurteile([setAttr]).rot).toHaveLength(1);

    const rolle = synthetisch("apps/web/src/components/SynthRole.tsx", [
      "export function Fenster(): JSX.Element {",
      '  return <div role="dialog" />;',
      "}",
    ]);
    expect(rolle.kandidaten.map((k) => k.art)).toEqual(["role-dialog"]);
    expect(beurteile([rolle]).rot).toHaveLength(1);
  });

  it("was der Sammler nicht abrechnen kann, wird rot statt still übergangen (destrukturiertes showModal)", () => {
    const e = synthetisch("apps/web/src/lib/synthDestrukturiert.ts", [
      "export function oeffne(d: HTMLDialogElement): void {",
      "  const { showModal } = d;",
      "  showModal.call(d);",
      "}",
    ]);
    // Kein Kandidat — aber der unabhängige Zähler sieht zwei Erwähnungen und schlägt an.
    expect(e.kandidaten).toEqual([]);
    const rot = modalAbgleich(e);
    expect(rot).toHaveLength(1);
    expect(rot[0]).toContain("apps/web/src/lib/synthDestrukturiert.ts:2,3");
  });

  it("eine nicht parsebare Datei wird rot mit Datei und Zeile, nicht still übersprungen", () => {
    const kaputt = quelleAus("apps/web/src/lib/synthKaputt.ts", "const = ;\n");
    expect(kaputt.leseFehler.length).toBeGreaterThan(0);
    expect(kaputt.leseFehler[0]).toContain("apps/web/src/lib/synthKaputt.ts:1");
  });

  it("HOC-Übergabe und Re-Export sind rot statt unsichtbar", () => {
    const hoc = synthetisch("apps/web/src/pages/SynthHoc.tsx", [
      'import { memo } from "react";',
      'import { FacetFilter } from "../components/FacetFilter";',
      "export const Verpackt = memo(FacetFilter);",
    ]);
    const vHoc = erhebeVerweise([hoc], [BAUTEIL_FACET]);
    expect(vHoc.paare).toEqual([]);
    expect(vHoc.rot.some((r) => r.includes("SynthHoc.tsx:3") && r.includes("UNBEURTEILBAR"))).toBe(
      true,
    );

    const barrel = synthetisch("apps/web/src/components/synthBarrel.ts", [
      'export { FacetFilter } from "./FacetFilter";',
    ]);
    const vBarrel = erhebeVerweise([barrel], [BAUTEIL_FACET]);
    expect(vBarrel.rot.some((r) => r.includes("export-weitergabe"))).toBe(true);
  });

  // ==============================================================================================
  // JOB 917 D2 — HERKUNFT STATT NAMENSTEXT (bens Prüflücken 1 und 2).
  // ==============================================================================================

  it("KOLLISION: gleicher Namenstext aus ANDERER Quelle ist KEIN Aufrufer", () => {
    const e = synthetisch("apps/web/src/pages/SynthFremd.tsx", [
      // Ein fremdes FacetFilter — gleicher Name, anderes Modul.
      'import { FacetFilter } from "../lib/facetRail";',
      "export function Seite(): JSX.Element {",
      "  return <FacetFilter themes={[]} authors={[]} spaces={[]} />;",
      "}",
    ]);
    const v = erhebeVerweise([e], [BAUTEIL_FACET]);
    expect(v.paare).toEqual([]);
    // Nicht rot — ein fremdes gleichnamiges Bauteil ist zulässig. Aber sichtbar:
    expect(v.fremdbefunde.some((f) => f.includes("SynthFremd.tsx"))).toBe(true);
  });

  it("KOLLISION: eine LOKAL deklarierte gleichnamige Komponente ist KEIN Aufrufer", () => {
    const e = synthetisch("apps/web/src/pages/SynthLokal.tsx", [
      "function FacetFilter(): JSX.Element {",
      '  return <div className="fixed inset-0" />;',
      "}",
      "export function Seite(): JSX.Element {",
      "  return <FacetFilter />;",
      "}",
    ]);
    const v = erhebeVerweise([e], [BAUTEIL_FACET]);
    expect(v.paare).toEqual([]);
    expect(v.fremdbefunde.some((f) => f.includes("SynthLokal.tsx"))).toBe(true);
  });

  it("HERKUNFT: Namensraum-Zugriff (<Ns.FacetFilter/>) wird herkunftstreu als Aufrufer erhoben", () => {
    const e = synthetisch("apps/web/src/pages/SynthNs.tsx", [
      'import * as FF from "../components/FacetFilter";',
      "export function Seite(): JSX.Element {",
      "  return <FF.FacetFilter themes={[]} authors={[]} spaces={[]} />;",
      "}",
    ]);
    const v = erhebeVerweise([e], [BAUTEIL_FACET]);
    expect(v.rot).toEqual([]);
    expect(v.paare.map(schluessel)).toContain("apps/web/src/pages/SynthNs.tsx → <FacetFilter>");
  });

  it("HERKUNFT: createElement(Ns.FacetFilter, …) ebenso — und ein FREMDER Namensraum nicht", () => {
    const treffer = synthetisch("apps/web/src/pages/SynthNsCreate.tsx", [
      'import { createElement } from "react";',
      'import * as FF from "../components/FacetFilter";',
      "export function Seite(): unknown {",
      "  return createElement(FF.FacetFilter, null);",
      "}",
    ]);
    expect(erhebeVerweise([treffer], [BAUTEIL_FACET]).paare.map(schluessel)).toContain(
      "apps/web/src/pages/SynthNsCreate.tsx → <FacetFilter>",
    );
    const fremd = synthetisch("apps/web/src/pages/SynthNsFremd.tsx", [
      'import { createElement } from "react";',
      'import * as FF from "../lib/facetRail";',
      "export function Seite(): unknown {",
      "  return createElement(FF.FacetFilter, null);",
      "}",
    ]);
    expect(erhebeVerweise([fremd], [BAUTEIL_FACET]).paare).toEqual([]);
  });

  // ==============================================================================================
  // JOB 917 D2 — DAS REGISTER DER MARKERLOSEN TRÄGER (bens Prüflücken 3, 5 und 6).
  // ==============================================================================================

  it("REGISTER: jede Vollbildfläche des Bestands steht in GENAU EINER der drei Klassen", () => {
    expect(unregistrierteVollflaechen(ALLE_ERHEBUNGEN, BAUTEILE)).toEqual([]);
  });

  it("REGISTER: ein NEUER markerloser Vollbildträger außerhalb des Registers wird rot", () => {
    const neu = synthetisch("apps/web/src/components/SynthNeuerTraeger.tsx", [
      "export function SynthNeuerTraeger({ open }: { open: boolean }): JSX.Element | null {",
      "  if (!open) return null;",
      '  return <div className="fixed inset-0 z-50 bg-black/50">Inhalt</div>;',
      "}",
    ]);
    expect(unregistrierteVollflaechen([neu], BAUTEILE)).toEqual([
      "apps/web/src/components/SynthNeuerTraeger.tsx",
    ]);
  });

  // ==============================================================================================
  // JOB 917/D3 (BEN D2, Korrekturpflicht 2) — DIE BEZUGSMENGE HING AN EINER ZEICHENFOLGE.
  //
  // `/fixed inset-0/` sah nur diese eine Schreibweise. Drei gleichwertige Formen gingen vorbei und
  // wären als neuer markerloser Träger NIE aufgefallen — die gefährlichste Art Lücke, weil der
  // Wächter dabei grün bleibt. Jede Form bekommt hier ihre eigene Gegenprobe.
  // ==============================================================================================
  const AEQUIVALENTE_VOLLFLAECHEN: { name: string; klassen: string }[] = [
    { name: "SynthUmgekehrt", klassen: "inset-0 fixed z-50 bg-black/50" },
    { name: "SynthAchsen", klassen: "fixed inset-x-0 inset-y-0 z-50 bg-black/50" },
    { name: "SynthRaender", klassen: "fixed top-0 right-0 bottom-0 left-0 z-50 bg-black/50" },
  ];

  it.each(AEQUIVALENTE_VOLLFLAECHEN)(
    "REGISTER: die äquivalente Vollfläche $name wird unregistriert ebenfalls rot",
    ({ name, klassen }) => {
      const datei = `apps/web/src/components/${name}.tsx`;
      const neu = synthetisch(datei, [
        `export function ${name}({ open }: { open: boolean }): JSX.Element | null {`,
        "  if (!open) return null;",
        `  return <div className="${klassen}">Inhalt</div>;`,
        "}",
      ]);
      expect(
        unregistrierteVollflaechen([neu], BAUTEILE),
        `„${klassen}" spannt denselben Bildschirm auf und muss dieselbe Meldung erzeugen`,
      ).toEqual([datei]);
    },
  );

  it("REGISTER: eine NICHT-Vollfläche bleibt außerhalb der Bezugsmenge (Positivkontrolle)", () => {
    // Ohne diesen Fall wäre die Verallgemeinerung oben nicht von „meldet einfach alles" zu
    // unterscheiden. `fixed` allein — ohne gebundene Seiten — ist keine Vollfläche.
    const klein = synthetisch("apps/web/src/components/SynthKleinerBalken.tsx", [
      "export function SynthKleinerBalken(): JSX.Element {",
      '  return <div className="fixed bottom-4 right-4 z-50">Hinweis</div>;',
      "}",
    ]);
    expect(unregistrierteVollflaechen([klein], BAUTEILE)).toEqual([]);
  });

  // ==============================================================================================
  // JOB 917/D3 (BEN D2, Korrekturpflicht 1) — DIE SHELL-GRENZE, GEMESSEN STATT BEHAUPTET.
  //
  // BEN verlangt je Einbinder einen gemounteten Fall mit NACHGEWIESENER Shell-Grenze — und sagt im
  // selben Atemzug: „falls das Produkt die Grenze tatsächlich nicht besitzt, den Stand nicht als
  // baubereit ausgeben." Genau das ist die Lage. Gemessen am gebundenen Stand:
  //
  //   Modal.tsx, KnowledgeInputStudio.tsx, HelpTip.tsx, AiModelInfo.tsx → useModalBoundary: 0
  //   CommandPalette.tsx                                               → nur useModalLocked (liest)
  //   FacetFilter.tsx                                                  → useModalBoundary (hält)
  //
  // Ein gemounteter Fall könnte hier keine Grenze belegen, weil keine da ist; er würde nur die
  // Abwesenheit umständlich wiederholen. Was dieser Wächter stattdessen leistet: er hält den
  // GEMESSENEN Zustand fest, in BEIDE Richtungen. Baut jemand die Grenze ein, ohne das Register zu
  // pflegen, wird es rot — und die Behauptung „markerlos, aber abgegrenzt" kann nicht still
  // entstehen.
  // ==============================================================================================
  const GRENZE_IST: { datei: string; stand: "keine" | "liest" | "haelt" }[] = [
    { datei: "apps/web/src/components/Modal.tsx", stand: "keine" },
    { datei: "apps/web/src/components/KnowledgeInputStudio.tsx", stand: "keine" },
    { datei: "apps/web/src/components/HelpTip.tsx", stand: "keine" },
    { datei: "apps/web/src/components/AiModelInfo.tsx", stand: "keine" },
    { datei: "apps/web/src/shell/CommandPalette.tsx", stand: "liest" },
    { datei: "apps/web/src/components/FacetFilter.tsx", stand: "haelt" },
  ];

  it.each(GRENZE_IST)(
    "SHELL-GRENZE: $datei steht auf $stand — und tut es nachweislich",
    ({ datei, stand }) => {
      const e = ALLE_ERHEBUNGEN.find((x) => x.quelle.datei === datei);
      expect(e, `Registereintrag ohne Datei: ${datei}`).toBeDefined();
      const quelle = e?.quelle.gestrippt ?? "";
      const haelt = /\buseModalBoundary\b/.test(quelle);
      const liest = /\buseModalLocked\b/.test(quelle);
      const gemessen = haelt ? "haelt" : liest ? "liest" : "keine";
      expect(
        gemessen,
        `Das Register sagt „${stand}", gemessen ist „${gemessen}". Wer die Grenze ändert, ändert hier mit — sonst behauptet der Wächter eine Modalwahrheit, die das Produkt nicht hat.`,
      ).toBe(stand);
    },
  );

  it("REGISTER: jeder Eintrag existiert, exportiert seinen Namen und ist wirklich markerlos", () => {
    for (const b of MARKERLOSE_TRAEGER) {
      const e = ALLE_ERHEBUNGEN.find((x) => x.quelle.datei === b.datei);
      expect(e, `Registereintrag ohne Datei: ${b.datei}`).toBeDefined();
      expect(e?.exportierte, `${b.datei} exportiert <${b.komponente}> nicht (mehr)`).toContain(
        b.komponente,
      );
      // Trüge die Fläche einen Marker, gehörte sie in die abgeleitete Erhebung — nicht hierher.
      expect(
        e?.kandidaten.filter((k) => k.art.startsWith("aria-modal")) ?? [],
        `${b.datei} trägt jetzt aria-modal: der Eintrag gehört aus dem markerlosen Register heraus`,
      ).toEqual([]);
    }
  });

  it("REGISTER: die Einbinder der markerlosen Träger sind herkunftstreu erhoben und vollständig", () => {
    expect(MARKERLOSE_VERWEISE.rot).toEqual([]);
    // Die Akte, die ben verlangt: Modulpfad + Exportname + produktive Einbinder, herkunftstreu
    // erhoben. Wächst oder schrumpft sie, ist das eine sichtbare Entscheidung, keine Verschiebung.
    expect(MARKERLOSE_VERWEISE.paare.map(schluessel).sort()).toEqual([
      "apps/web/src/app/NavGuardContext.tsx → <Modal>",
      "apps/web/src/components/AppendToArticleModal.tsx → <Modal>",
      "apps/web/src/components/ConflictTargetPicker.tsx → <Modal>",
      "apps/web/src/components/RichTextEditor.tsx → <Modal>",
      "apps/web/src/pages/Capture.tsx → <KnowledgeInputStudio>",
      "apps/web/src/pages/Capture.tsx → <Modal>",
      "apps/web/src/pages/Conflicts.tsx → <Modal>",
      "apps/web/src/pages/Duplicates.tsx → <Modal>",
      "apps/web/src/pages/KnowledgeDetail.tsx → <KnowledgeInputStudio>",
      "apps/web/src/shell/AppShell.tsx → <CommandPalette>",
    ]);
  });

  it("NEGATIVGRENZE: die nichtmodalen Vollflächen erzeugen keinen modalen Kandidaten", () => {
    for (const datei of NICHT_MODALE_VOLLFLAECHEN.keys()) {
      const e = ALLE_ERHEBUNGEN.find((x) => x.quelle.datei === datei);
      expect(e, `Negativeintrag ohne Datei: ${datei}`).toBeDefined();
      expect(e?.kandidaten ?? [], `${datei} behauptet jetzt Modalität`).toEqual([]);
    }
  });

  it("Prosa bleibt Prosa: Kommentare und Erwähnungen in Zeichenketten sind keine Kandidaten", () => {
    const e = synthetisch("apps/web/src/lib/synthProsa.ts", [
      "// aria-modal in einem Kommentar, dazu <dialog> und showModal in Prosa",
      'const hinweis = "ohne aria-modal keine behauptete Modalitaet";',
      "export const nichts = hinweis;",
    ]);
    expect(e.kandidaten).toEqual([]);
    // Der Zähler geht trotzdem auf: die String-Erwähnung ist als Prosa belegt, der Kommentar zählt nicht.
    expect(modalAbgleich(e)).toEqual([]);
  });

  it("Positivprobe: eine Fläche an der Grenze wird als solche beurteilt, ohne rot", () => {
    const e = synthetisch("apps/web/src/components/SynthBrav.tsx", [
      'import { useModalBoundary } from "../app/ModalBoundaryContext";',
      "export function Blatt(): JSX.Element {",
      "  const grenze = useModalBoundary();",
      '  return <dialog open aria-modal="true" aria-label={String(grenze !== null)} />;',
      "}",
    ]);
    expect(e.nutztGrenze).toBe(true);
    expect(e.kandidaten.map((k) => k.art).sort()).toEqual(["aria-modal-attribut", "dialog-jsx"]);
    const { beurteilt, rot } = beurteile([e]);
    expect(rot).toEqual([]);
    expect(beurteilt.every((b) => b.urteil === "an-der-grenze")).toBe(true);
  });
});

describe("mega48 Block B → mega72: die Erhebung am heutigen Bestand", () => {
  it("der Quellbaum wird wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    // Positiv-Sonde: die zwei heute bekannten modalen Bauteile müssen im Fund liegen …
    const komponenten = BAUTEILE.map((b) => b.komponente);
    expect(komponenten).toContain("FacetFilter");
    expect(komponenten).toContain("MobileNavDrawer");
    // … das Grenz-Modul selbst ist KEIN Bauteil (sonst fände sich der Sammler selbst) …
    expect(BAUTEILE.map((b) => b.datei)).not.toContain(GRENZE_MODUL);
    // … und Negativ-Sonde: eine beliebige unbeteiligte Datei darf nicht drin sein.
    expect(BAUTEILE.map((b) => b.datei)).not.toContain("apps/web/src/lib/facetRail.ts");
    // Die Aufrufer-Stufe findet ebenfalls etwas — und zwar mehr als eine Datei.
    expect(ERWARTETE_PAARE.length).toBeGreaterThan(2);
  });

  it("DER FUND, an dem mega47 gescheitert ist: ein Aufrufer OHNE Prop wird trotzdem erhoben", () => {
    // `ImportSelect` bindet FacetFilter ein und hat NIE einen Hintergrund hereingereicht. Die alte
    // Erhebung über die Zeichenfolge `backgroundRef={` sah ihn deshalb nicht — und genau daran ist
    // die Zusage „eine dritte Seite wird automatisch rot" am heutigen Baum gescheitert.
    const importSelect = ALLE_ERHEBUNGEN.find(
      (e) => e.quelle.datei === "apps/web/src/components/ImportSelect.tsx",
    );
    expect(importSelect, "ImportSelect.tsx nicht gefunden").toBeDefined();
    expect(importSelect?.quelle.gestrippt).not.toMatch(/backgroundRef=\{/);
    expect(ERWARTETE_PAARE.map(schluessel)).toContain(
      "apps/web/src/components/ImportSelect.tsx → <FacetFilter>",
    );
  });
});

describe("mega48 Block B1: jeder Aufrufer einer modalen Fläche ist erfasst", () => {
  it("kein Aufrufer ohne gemounteten Fall (ein weiterer Aufrufer wird automatisch rot)", () => {
    const registriert = new Set(FAELLE.map(schluessel));
    const fehlend = ERWARTETE_PAARE.map(schluessel).filter((k) => !registriert.has(k));
    expect(
      fehlend,
      `\nBindet ein modales Bauteil ein, hat aber keinen Fall in diesem Sammler:\n${fehlend.join(
        "\n",
      )}\nEinen Fall in FAELLE ergänzen — sonst bleibt genau bens Ship-Blocker unbewacht.\n`,
    ).toEqual([]);
  });

  it("kein Fall ohne Fundstelle (veraltete Fälle sind ebenso rot)", () => {
    const erwartet = new Set(ERWARTETE_PAARE.map(schluessel));
    const veraltet = FAELLE.map(schluessel).filter((k) => !erwartet.has(k));
    expect(
      veraltet,
      `\nFall registriert, aber dort wird das Bauteil nicht mehr eingebunden:\n${veraltet.join(
        "\n",
      )}\n`,
    ).toEqual([]);
  });
});

describe.each(FAELLE)("mega48 Block B2 · $name", (fall) => {
  it("der geöffnete Dialog hat KEINEN [inert]-Vorfahren", async () => {
    await fall.mounten();
    await klick(fall.ausloeser());

    const d = dialog();
    expect(d, `${schluessel(fall)}: kein modaler Dialog nach dem Öffnen`).not.toBeNull();
    const inerterVorfahre = d?.closest("[inert]") ?? null;
    const wo = `<${inerterVorfahre?.tagName.toLowerCase()} class="${inerterVorfahre?.className}">`;
    expect(
      inerterVorfahre === null,
      `${schluessel(fall)}: der Dialog liegt IM gesperrten Teilbaum (${wo}). Im echten Browser ist er damit weder fokussierbar noch mit Maus oder Tastatur bedienbar und nicht zu schließen — die Seite steht.`,
    ).toBe(true);
  });

  it("gleichzeitig ist der GESAMTE übrige Bedienbereich der App gesperrt", async () => {
    await fall.mounten();
    const ausloeser = fall.ausloeser();
    await klick(ausloeser);

    const d = dialog();
    expect(d).not.toBeNull();

    // Der Auslöse-Knopf selbst: er ist Teil des Hintergrunds und muss mit gesperrt sein. Läge er
    // draußen, wäre die Modalität nur behauptet (ein zweites Blatt wäre öffenbar).
    expect(
      ausloeser.closest("[inert]") !== null,
      `${schluessel(fall)}: der Auslöse-Knopf liegt AUSSERHALB des gesperrten Bereichs.`,
    ).toBe(true);

    // Kalibrierung: die Shell steht wirklich mit ihren eigenen Flächen da — sonst prüfte der Rest
    // dieses Falls eine leere Menge und wäre grün, ohne etwas zu belegen.
    const klara = container.querySelector<HTMLElement>('[data-klara="1"]');
    expect(klara, "Klara fehlt in der gemounteten Shell").not.toBeNull();
    expect(
      klara?.closest("[inert]") !== null,
      `${schluessel(fall)}: KLARA ist bei offener Modalfläche erreichbar (bens Ship-Blocker 1).`,
    ).toBe(true);

    // Und der Sammler-Teil: JEDES fokussierbare Element liegt entweder im Dialog oder im gesperrten
    // Bereich — nicht nur die namentlich bekannten. Das fängt das Aufweichen ab, den Hintergrund
    // kleiner zu schneiden, damit der Dialog herausfällt.
    const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    expect(focusables.length, "es muss fokussierbare Elemente geben").toBeGreaterThan(0);
    const draussen = focusables.filter(
      (el) => !(d?.contains(el) ?? false) && el.closest("[inert]") === null,
    );
    expect(
      draussen.map((el) => `<${el.tagName.toLowerCase()} class="${el.className}">`),
      `\n${schluessel(fall)}: fokussierbar außerhalb von Dialog UND gesperrtem Bereich\n`,
    ).toEqual([]);
  });

  it("nach dem Schließen lebt der Hintergrund wieder (kein hängendes inert)", async () => {
    await fall.mounten();
    await klick(fall.ausloeser());
    expect(container.querySelector("[inert]")).not.toBeNull();

    const schliessen = container.querySelector<HTMLElement>(
      `dialog[aria-modal='true'] [aria-label="${i18n.t("facet.closeFilters")}"], dialog[aria-modal='true'] [aria-label="${i18n.t("topbar.closeMenu")}"]`,
    );
    expect(schliessen, `${schluessel(fall)}: kein Schließen-Knopf im Dialog`).not.toBeNull();
    if (schliessen) {
      await klick(schliessen);
    }

    expect(dialog()).toBeNull();
    expect(container.querySelector("[inert]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// (3) Die drei Shell-Flächen, die ben namentlich benannt hat — und die Paarung zweier Flächen.
// ---------------------------------------------------------------------------------------------

describe("mega48 Block B2: die von ben benannten Shell-Flächen sind bei offenem Blatt gesperrt", () => {
  async function blattOeffnen(): Promise<void> {
    await render(createElement(Library));
    await klick(knopfMitText(i18n.t("facet.openFilters")));
    expect(dialog()).not.toBeNull();
  }

  it("Klara und die Topbar liegen im gesperrten Bereich", async () => {
    await blattOeffnen();
    const klara = container.querySelector<HTMLElement>('[data-klara="1"]');
    expect(klara, "Klara fehlt in der gemounteten Shell").not.toBeNull();
    expect(klara?.closest("[inert]"), "Klara ist erreichbar").not.toBeNull();
    expect(knopfMitAria(i18n.t("topbar.openMenu")).closest("[inert]")).not.toBeNull();
  });

  it("eine Toast-Aktion entsteht IM gesperrten Bereich (sie lag auf z-[60] darüber)", async () => {
    await blattOeffnen();
    expect(toastZapfhahn, "Zapfhahn nicht im echten ToastProvider angemeldet").not.toBeNull();
    await act(async () => {
      toastZapfhahn?.("info", "PROBE-TOAST");
      await flush();
    });
    const schliessen = knopfMitAria(i18n.t("toast.dismiss"));
    expect(container.textContent).toContain("PROBE-TOAST");
    expect(
      schliessen.closest("[inert]"),
      "die Toast-Aktion ist bei offener Modalfläche erreichbar",
    ).not.toBeNull();
  });

  it("Cmd/Ctrl+K öffnet die Command Palette nicht (das Kürzel hängt am Fenster, nicht am DOM)", async () => {
    await blattOeffnen();
    const vorher = container.querySelectorAll("input").length;
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }),
      );
      await flush();
    });
    expect(
      container.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`),
      "die Command Palette ist über ihr globales Kürzel durch die Modalgrenze hindurch aufgegangen",
    ).toBeNull();
    expect(container.querySelectorAll("input").length).toBe(vorher);

    // Gegenprobe, damit dieser Test nicht deshalb grün ist, weil das Kürzel gar nicht mehr wirkt:
    // Blatt zu, gleiches Kürzel, und die Palette geht auf.
    await klick(knopfMitAria(i18n.t("facet.closeFilters")));
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }),
      );
      await flush();
    });
    expect(container.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`)).not.toBeNull();
  });
});

describe("mega48 Block A2: zwei Flächen nehmen sich die Grenze nicht mehr gegenseitig weg", () => {
  it("Blatt → Drawer → Drawer zu: die Sperre steht, der Fokus kehrt INS Blatt zurück", async () => {
    await render(createElement(Library));
    await klick(knopfMitText(i18n.t("facet.openFilters")));
    const blatt = container.querySelector<HTMLElement>(
      `dialog[aria-label="${i18n.t("facet.sheetTitle")}"]`,
    );
    expect(blatt).not.toBeNull();

    // ANMERKUNG ZUR REICHWEITE: im echten Browser ist dieser Weg nach mega48 gar nicht mehr
    // begehbar — der Hamburger liegt im gesperrten Bereich und ist nicht klickbar (das belegt
    // ui-smoke). jsdom setzt `inert` nicht durch, und genau deshalb lässt sich HIER prüfen, was der
    // Zähler tut, wenn zwei Flächen doch gleichzeitig offen sind.
    await klick(knopfMitAria(i18n.t("topbar.openMenu")));
    const drawer = container.querySelector<HTMLElement>(
      `dialog[aria-label="${i18n.t("topbar.menuLabel")}"]`,
    );
    expect(drawer, "der Drawer ist nicht aufgegangen").not.toBeNull();
    // Solange der Drawer oben liegt, ist auch das Blatt darunter gesperrt.
    expect(blatt?.hasAttribute("inert")).toBe(true);

    await klick(knopfMitAria(i18n.t("topbar.closeMenu")));

    // Der Drawer ist weg, das Blatt steht — und ist wieder bedienbar.
    expect(
      container.querySelector(`dialog[aria-label="${i18n.t("topbar.menuLabel")}"]`),
    ).toBeNull();
    expect(container.contains(blatt)).toBe(true);
    expect(blatt?.hasAttribute("inert")).toBe(false);
    expect(blatt?.closest("[inert]")).toBeNull();
    // Die Sperre BLEIBT — vor mega48 hätte der Drawer sie hier für das offene Blatt aufgehoben.
    expect(
      knopfMitText(i18n.t("facet.openFilters")).closest("[inert]"),
      "der Drawer hat dem noch offenen Blatt die Modalgrenze weggenommen",
    ).not.toBeNull();
    // Und der Fokus liegt im Blatt, nicht auf dem (gesperrten) Hamburger.
    expect(
      blatt?.contains(document.activeElement),
      `Fokus steht auf <${document.activeElement?.tagName.toLowerCase()}> statt im Filterblatt`,
    ).toBe(true);
  });
});
