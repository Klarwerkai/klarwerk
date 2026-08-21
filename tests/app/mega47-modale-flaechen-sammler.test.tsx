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
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

// JOB 1181 D1: die Wurzel ist ein Parameter geworden. Grund steht in Block F unten — BENs dritte
// Prüflücke zu D3 verlangt einen Träger, den der BAUMSCANNER wirklich liest, nicht einen, der einer
// Funktion als Text übergeben wird. Ohne diesen Parameter liesse sich das nur belegen, indem eine
// Datei in `apps/web/src/` entsteht; der Lease dieses Durchgangs verbietet jeden Produktcode. Der
// Standardwert ist unverändert `WURZEL`, jeder bestehende Aufruf verhält sich zeichengleich.
function quelldateien(verzeichnis: string, wurzel: string = WURZEL): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(wurzel, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ, wurzel));
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

// ================================================================================================
// B52/E · GELB-1 (JOB 1660) — DIE NATIVE AUSNAHME HAENGT AM KANDIDATEN, NICHT AN DER DATEI.
// ================================================================================================
//
// DER BEFUND, aus der Erntekontrolle PRO2 (`1652 D1`, Befund 2) — Zitat aus fremder Rueckgabe:
//   „Der Schluessel ist an jeder der vier Stellen die Datei … nie der Kandidat. Damit gilt
//    weiterhin: eine ZWEITE, nicht native `aria-modal`-Flaeche in einer ausgenommenen Datei
//    rutscht durch, weil die Ausnahme die ganze Datei freistellt."
//
// NACHGEMESSEN, und das Bild ist genauer als der Befund: von den vier Stellen war EINE bereits
// kandidatengebunden — `beurteile` (mega76 BLOCK E) prueft `showModal-nutzung` bzw. den
// `dialog-jsx` mit nativer Ref. Die drei UEBRIGEN aber schlossen die Datei als GANZES aus den
// Erhebungen aus: `BAUTEIL_ERHEBUNGEN`, `unregistrierteVollflaechen`, `unregistrierteWirkflaechen`.
// Dort traf der Befund zu.
//
// DIE REGEL STEHT JETZT AN EINER STELLE. `nativGedeckt` ist woertlich die Bedingung, die
// `beurteile` schon benutzte — kein zweiter Begriff von „nativ" (ENTSCHEIDUNGEN/JOB-646.md).
// `nativAusnahmeDecktDatei` sagt, ob die Ausnahme ALLE modalen Funde einer Datei traegt; nur dann
// darf eine dateiweite Erhebung sie ueberspringen. Sobald in einer ausgenommenen Datei EIN Fund
// auftaucht, den `showModal()` nicht deckt, ist die Datei wieder in der Erhebung.
//
// DIE RICHTUNG IST EINSEITIG: die neue Regel ist STRENGER als die alte. Sie kann Funde nur
// hinzufuegen, nie entfernen — eine Datei ohne Ausnahme verhaelt sich unveraendert.

/** Deckt die native Ausnahme DIESEN Fund? Dieselbe Bedingung, die `beurteile` seit mega76 fuehrt. */
function nativGedeckt(e: DateiErhebung, k: Kandidat): boolean {
  return (
    k.art === "showModal-nutzung" || (k.art === "dialog-jsx" && !!k.ref && e.nativeRefs.has(k.ref))
  );
}

/**
 * Deckt die native Ausnahme ALLE Funde dieser Datei — darf eine dateiweite Erhebung sie also
 * ueberspringen?
 *
 * `every` ueber die Kandidaten ist der ganze Punkt: eine Datei faellt nur dann heraus, wenn es in
 * ihr NICHTS gibt, was die Ausnahme nicht begruendet. Ein zweites, rein React-gebautes Overlay in
 * derselben Datei holt sie zurueck in die Erhebung.
 */
function nativAusnahmeDecktDatei(e: DateiErhebung): boolean {
  if (!NATIV_MODAL_AUSNAHMEN.has(e.quelle.datei)) {
    return false;
  }
  return e.kandidaten.every((k) => nativGedeckt(e, k));
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
      } else if (ausnahme !== undefined && nativGedeckt(e, k)) {
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
    // B52/E GELB-1: nicht mehr „Datei ausgenommen", sondern „Ausnahme deckt ALLE Funde dieser
    // Datei". Ein zweites, nicht natives Overlay holt die Datei in die Bauteil-Erhebung zurueck.
    !nativAusnahmeDecktDatei(e) &&
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
  return (
    erhebungen
      .filter((e) => spanntVollflaecheAuf(e.quelle.gestrippt))
      // B52/E GELB-1: die Ausnahme ueberspringt die Datei nur, wenn sie ALLE ihre Funde deckt.
      .filter((e) => !nativAusnahmeDecktDatei(e))
      .map((e) => e.quelle.datei)
      .filter((d) => !mitMarker.has(d) && !markerlos.has(d) && !NICHT_MODALE_VOLLFLAECHEN.has(d))
  );
}

// ================================================================================================
// JOB 1093 D2 — DIE KALIBRIERUNG VON `MARKERLOSE_TRAEGER` GEGEN DEN ECHTEN BESTAND.
// ================================================================================================
//
// BENS ROTGRUND ZU D1: ein Inventar, das seine Grundgesamtheit aus den vorhandenen MARKERN und aus
// dem REGISTER ableitet, misst genau die Quellen, deren Vollständigkeit es belegen soll. Das
// Register oben stand deshalb ohne Gegenprobe da — es behauptete drei Träger und prüfte diese
// Behauptung an sich selbst. `unregistrierteVollflaechen` fragt zwar den Bestand, aber nur danach,
// ob eine Vollfläche IRGENDWO eingetragen ist; ob der Eintrag der richtige ist, prüfte niemand.
//
// Hier wird die Zugehörigkeit AUS DER FLÄCHE ABGELEITET, ohne das Register zu befragen. Zwei
// Merkmale trennen — gemessen am heutigen Bestand — die modale Fläche vom Popover, das dieselbe
// Vollfläche nur als Klickfänger benutzt:
//
//   (A) VERDECKUNG — die Fläche legt sich deckend über den Hintergrund (Tönung ab 30 % oder ein
//       Blur). Genau das IST die Modalität: der Rest der Anwendung verschwindet hinter ihr.
//       `Modal.tsx` bg-ink/40 · `CommandPalette.tsx` bg-ink/30 · `KnowledgeInputStudio.tsx`
//       bg-page/95 + backdrop-blur — gegen `HelpTip.tsx` und `AiModelInfo.tsx`, deren
//       `fixed inset-0` FARBLOS ist und deren Inhalt als Popover NEBEN dem Auslöser sitzt.
//   (B) TASTATUR-AUSGANG — `Escape` schliesst. Eine Fläche, die die Bedienung an sich zieht, muss
//       einen Ausgang ohne Zeiger haben; ein Popover braucht ihn nicht und hat ihn nicht.
//
// Markierte Flächen bleiben draussen: sie gehören in die abgeleitete Erhebung oben, nicht ins
// markerlose Register. Die Ableitung hängt damit NICHT an den Markern — sie benutzt sie erst nach
// dem Fund zur Abgrenzung, nie als Sucher.
function verdecktDenHintergrund(quelltext: string): boolean {
  if (/\bbackdrop-blur/.test(quelltext)) {
    return true;
  }
  for (const treffer of quelltext.matchAll(/\bbg-[a-z0-9-]+\/(\d{1,3})\b/g)) {
    if (Number(treffer[1] ?? "0") >= 30) {
      return true;
    }
  }
  return false;
}

function istMarkerloserTraegerAmBestand(e: DateiErhebung): boolean {
  if (e.kandidaten.length > 0) {
    return false;
  }
  const quelle = e.quelle.gestrippt;
  return (
    spanntVollflaecheAuf(quelle) &&
    verdecktDenHintergrund(quelle) &&
    /"Escape"|'Escape'/.test(quelle)
  );
}

// ================================================================================================
// JOB 1093 D3 — DIE ZWEITE SUCHRICHTUNG: ÜBER WIRKUNG STATT ÜBER BAUFORM.
// ================================================================================================
//
// BENS ROTGRUND ZU D2, und er trifft: Die erste Richtung nimmt eine Datei nur auf, wenn sie eine
// bestimmte BAUFORM zeigt — `fixed` plus vier gebundene Seiten, ein Portal, ein bekannter
// Zustandsname, ein bekannter Schliessweg. Damit entscheidet die Vorfilterung, was überhaupt
// geprüft wird. D2 hat das selbst benannt („DIE ENTDECKUNGSGRENZE STEHT OFFEN") und trotzdem
// „10 Überlagerungsflächen im gesamten Baum" behauptet. Die Zahl war nie belegt, nur ungeprüft.
//
// Diese Richtung fragt nicht, WIE eine Fläche gebaut ist, sondern WAS SIE TUT. Sieben Signale,
// keines davon abhängig von `fixed inset-0`, Portal oder einer Zustandsnamenliste:
//
//   B1 FOKUSFALLE      — Tab wird abgefangen oder der Fokus bewusst geführt
//   B2 INERT           — der Hintergrund wird ausgeschaltet
//   B3 SCROLLSPERRE    — der Körper darf nicht mehr scrollen
//   B4 NATIVER DIALOG  — `<dialog>` / `showModal()`
//   B5 ARIA-MODALITÄT  — `aria-modal`, `role="dialog"|"alertdialog"`
//   B6 VOLLBILDFORM    — der Bildschirm wird gefüllt OHNE `fixed`+vier Seiten:
//                        `w-screen`/`h-screen`/`min-h-screen`, `100vw`/`100vh`
//   B7 SHELL-GRENZE    — `useModalBoundary` / `useModalLocked`
//
// B1–B5 und B7 sind HARTE Signale: wer eines davon zeigt, greift in die Bedienung ein. B6 allein
// ist Layout (`max-w-[calc(100vw-1rem)]` ist keine Modalfläche) und zählt nur MIT Verdeckung.
const B6_VOLLBILDFORM = /\bw-screen\b|\bh-screen\b|\bmin-h-screen\b|\b100vw\b|\b100vh\b/;

const WIRKUNGSSIGNALE: ReadonlyArray<readonly [string, RegExp, boolean]> = [
  ["B1 Fokusfalle", /\bfocusablesIn\b|\bfocusFirstIn\b|\bfocusTrap\b|["']Tab["']/, true],
  ["B2 inert", /\binert\b/, true],
  ["B3 Scrollsperre", /(?:body|documentElement)\s*\.\s*style\s*\.\s*overflow/, true],
  ["B4 nativer Dialog", /\bshowModal\b|<dialog\b/, true],
  ["B5 aria-Modalitaet", /aria-modal|role\s*=\s*["'](?:alert)?dialog["']/, true],
  ["B6 Vollbildform", B6_VOLLBILDFORM, false],
  ["B7 Shell-Grenze", /\buseModalBoundary\b|\buseModalLocked\b/, true],
];

/** Die Namen der Signale, die dieser Quelltext zeigt — für die Meldung, nicht nur für das Urteil. */
function wirkungssignale(quelltext: string): string[] {
  return WIRKUNGSSIGNALE.filter(([, muster]) => muster.test(quelltext)).map(([name]) => name);
}

function wirktModalAmBestand(quelltext: string): boolean {
  const hart = WIRKUNGSSIGNALE.some(([, muster, istHart]) => istHart && muster.test(quelltext));
  if (hart) {
    return true;
  }
  return B6_VOLLBILDFORM.test(quelltext) && verdecktDenHintergrund(quelltext);
}

/**
 * Module, die modale Wirkung BEREITSTELLEN, aber selbst keine Fläche sind. Ohne diese Liste
 * meldete die zweite Richtung ihre eigene Infrastruktur — und der Grund stünde nirgends.
 *
 * Sie ist bewusst kurz und einzeln begründet: eine Ausnahme ohne Grund ist eine Lücke mit Namen.
 */
const WIRKUNG_OHNE_FLAECHE = new Map<string, string>([
  [
    "apps/web/src/lib/focusables.ts",
    "Fokus-Hilfsmodul: liefert Selektor und Fokusfunktionen, rendert selbst kein Element",
  ],
]);

/**
 * Die zweite Richtung als Wächter: jede Datei mit modaler WIRKUNG, die in keiner der bekannten
 * Klassen steht. Sie benutzt `spanntVollflaecheAuf` NICHT — genau darin liegt ihr Wert.
 */
function unregistrierteWirkflaechen(
  erhebungen: DateiErhebung[],
  markerTragende: Bauteil[],
): string[] {
  const mitMarker = new Set(markerTragende.map((b) => b.datei));
  const markerlos = new Set(MARKERLOSE_TRAEGER.map((b) => b.datei));
  return (
    erhebungen
      .filter((e) => wirktModalAmBestand(e.quelle.gestrippt))
      // B52/E GELB-1: dieselbe Bindung wie oben — Datei nur ueberspringen, wenn die Ausnahme sie
      // ganz traegt.
      .filter((e) => !nativAusnahmeDecktDatei(e))
      .map((e) => e.quelle.datei)
      .filter(
        (d) =>
          d !== GRENZE_MODUL &&
          !mitMarker.has(d) &&
          !markerlos.has(d) &&
          !NICHT_MODALE_VOLLFLAECHEN.has(d) &&
          !WIRKUNG_OHNE_FLAECHE.has(d),
      )
  );
}

/**
 * DER SUCHRAUM, IN DEN RICHTUNG A NIE GESEHEN HAT. Sie liest ausschliesslich `.ts`/`.tsx`
 * (`istQuelldatei`). Eine Vollbildfläche kann aber in einem Stylesheet stehen — dort wäre sie für
 * jede der bisherigen Erhebungen unsichtbar. Gemessen heute: drei Stylesheets, kein Treffer.
 * Der Fall hält das fest und wird rot, sobald dort eine Fläche entsteht.
 */
function stylesheetdateien(verzeichnis: string, wurzel: string = WURZEL): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(wurzel, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...stylesheetdateien(relativ, wurzel));
    } else if (relativ.endsWith(".css")) {
      gefunden.push(posix(relativ));
    }
  }
  return gefunden;
}

// JOB 1181 D1: BENs zweite Prüflücke zu D3 verlangt, dass die Stylesheet-Wache die REGEL UND den
// importierenden Träger nennt. Bis hierher nannte sie nur die Datei — wer sie las, wusste nicht, wo
// die Fläche im Baum hängt. Der Fund trägt jetzt beides.
interface StylesheetFund {
  datei: string;
  regel: string;
  zeile: number;
  /** Quelldateien, die genau dieses Stylesheet importieren. Leer heisst: die Fläche hängt an nichts. */
  traeger: string[];
}

function stylesheetVollbildregeln(
  wurzel: string = WURZEL,
  unter: string = join("apps", "web"),
  erhebungen: DateiErhebung[] = ALLE_ERHEBUNGEN,
): StylesheetFund[] {
  const funde: StylesheetFund[] = [];
  for (const datei of stylesheetdateien(unter, wurzel)) {
    const text = ohneKommentare(readFileSync(join(wurzel, datei), "utf8"));
    if (!/position\s*:\s*fixed/.test(text)) {
      continue;
    }
    const massMuster = /\b100vw\b|\b100vh\b|inset\s*:\s*0/;
    if (!massMuster.test(text)) {
      continue;
    }
    const zeilen = text.split("\n");
    const treffer = zeilen.findIndex((z) => massMuster.test(z));
    funde.push({
      datei,
      regel: `${datei} — Stylesheet-Regel mit position:fixed und Vollbildmass`,
      zeile: treffer + 1,
      traeger: importierendeTraeger(datei, erhebungen),
    });
  }
  return funde;
}

/**
 * Wer importiert dieses Stylesheet? Gemessen am AST über die Import-Spezifizierer, nicht über die
 * Zeichenfolge des Dateinamens — ein Kommentar, der die Datei erwähnt, ist kein Träger.
 */
function importierendeTraeger(stylesheet: string, erhebungen: DateiErhebung[]): string[] {
  const blatt = stylesheet.split("/").pop() ?? stylesheet;
  const traeger: string[] = [];
  for (const e of erhebungen) {
    const sf = e.quelle.ast;
    let trifft = false;
    const gehe = (n: ts.Node): void => {
      if (
        (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
        n.moduleSpecifier !== undefined &&
        ts.isStringLiteral(n.moduleSpecifier) &&
        n.moduleSpecifier.text.endsWith(blatt)
      ) {
        trifft = true;
      }
      ts.forEachChild(n, gehe);
    };
    gehe(sf);
    if (trifft) {
      traeger.push(e.quelle.datei);
    }
  }
  return traeger;
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
  // B52/E · GELB-1 (JOB 1660) — DIE AUSNAHME DECKT NUR, WAS SIE BEGRUENDET.
  // ==============================================================================================
  //
  // Die Faelle fuettern `nativAusnahmeDecktDatei` mit gebauten Erhebungen. Das ist Absicht: am
  // echten Bestand traegt die Ausnahme heute ALLE Funde ihrer einen Datei (beide Kandidaten sind
  // nativ) — die Luecke waere dort also unsichtbar. Genau deshalb wird sie hier hergestellt.
  const erhebungFuer = (kandidaten: Array<Partial<Kandidat>>, nativeRefs: string[] = []) =>
    ({
      quelle: {
        datei: "apps/web/src/components/BodyImageGallery.tsx",
        gestrippt: "",
        leseFehler: [],
      },
      kandidaten: kandidaten.map((k) => ({
        datei: "apps/web/src/components/BodyImageGallery.tsx",
        zeile: 1,
        art: "aria-modal-attribut" as KandidatArt,
        ...k,
      })),
      prosaSpannen: [],
      nutztGrenze: false,
      exportierte: ["BodyImageGallery"],
      nativeRefs: new Set(nativeRefs),
    }) as unknown as DateiErhebung;

  it("GELB-1 · eine Datei faellt nur heraus, wenn die Ausnahme ALLE ihre Funde deckt", () => {
    // (a) Nur native Funde — genau die Lage am echten Bestand: die Ausnahme traegt, Datei raus.
    expect(
      nativAusnahmeDecktDatei(
        erhebungFuer(
          [{ art: "showModal-nutzung" }, { art: "dialog-jsx", ref: "dialogRef" }],
          ["dialogRef"],
        ),
      ),
      "die begruendete native Ausnahme traegt nicht mehr — das waere eine Verschaerfung zu viel",
    ).toBe(true);

    // (b) DIE LUECKE AUS DEM BEFUND: ein zweites, rein React-gebautes Overlay in derselben Datei.
    // Vorher deckte die Ausnahme es mit ab, weil sie an der DATEI hing.
    expect(
      nativAusnahmeDecktDatei(
        erhebungFuer(
          [
            { art: "showModal-nutzung" },
            { art: "dialog-jsx", ref: "dialogRef" },
            { art: "aria-modal-attribut", zeile: 999 },
          ],
          ["dialogRef"],
        ),
      ),
      "ein nicht nativer Fund rutscht weiterhin unter der Dateiausnahme durch — GELB-1 ist offen",
    ).toBe(false);

    // (c) Ein `<dialog>` OHNE native Ref ist kein nativer Fund — die Ref ist das Bindeglied.
    expect(
      nativAusnahmeDecktDatei(
        erhebungFuer([{ art: "dialog-jsx", ref: "andererRef" }], ["dialogRef"]),
      ),
    ).toBe(false);

    // (d) Eine Datei ohne Ausnahme ist nie gedeckt — die Regel erfindet keine neue Ausnahme.
    const fremd = erhebungFuer([{ art: "showModal-nutzung" }]);
    (fremd.quelle as { datei: string }).datei = "apps/web/src/components/FacetFilter.tsx";
    expect(nativAusnahmeDecktDatei(fremd)).toBe(false);
  });

  it("GELB-1 · die eine ausgenommene Datei ist am ECHTEN Bestand weiterhin gedeckt", () => {
    // Kalibrierung gegen den Bestand: waere sie es nicht, haette dieser Durchgang eine bestehende
    // Zusage gekippt statt eine Luecke geschlossen.
    for (const [datei] of NATIV_MODAL_AUSNAHMEN) {
      const e = ALLE_ERHEBUNGEN.find((x) => x.quelle.datei === datei);
      expect(e, `${datei}: ausgenommen, aber gar nicht erhoben`).toBeDefined();
      expect(
        e ? nativAusnahmeDecktDatei(e) : false,
        `${datei}: die Ausnahme deckt heute NICHT mehr alle Funde — dann gehoert sie geprueft, nicht gesetzt`,
      ).toBe(true);
    }
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

  // ==============================================================================================
  // JOB 1093 D2 — DIE KALIBRIERUNG: EINE POSITIV- UND EINE NEGATIVDATEI AUS DEM ECHTEN BESTAND.
  //
  // Ohne beide misst die Liste nur sich selbst. Die Positivdatei belegt, dass die Ableitung
  // wirklich greift; die Negativdatei belegt, dass sie nicht einfach jede Vollfläche meldet.
  // Beide sind ECHTE Produktdateien — keine synthetische Quelle, weil eine synthetische Datei
  // genau die Frage offen liesse, um die es geht: trägt das Merkmal am heutigen Bestand?
  // ==============================================================================================

  it("KALIBRIERUNG POSITIV: Modal.tsx ist AM BESTAND als markerloser Träger belegt, nicht per Liste", () => {
    const e = ALLE_ERHEBUNGEN.find((x) => x.quelle.datei === "apps/web/src/components/Modal.tsx");
    expect(e, "Positivdatei der Kalibrierung fehlt im Bestand").toBeDefined();
    const quelle = e?.quelle.gestrippt ?? "";
    // Die vier Aussagen einzeln, damit im Rotfall dasteht, WELCHE davon nicht mehr gilt.
    expect(e?.kandidaten ?? [], "Modal.tsx trägt jetzt einen Marker").toEqual([]);
    expect(spanntVollflaecheAuf(quelle), "Modal.tsx spannt keine Vollfläche mehr auf").toBe(true);
    expect(verdecktDenHintergrund(quelle), "Modal.tsx verdeckt den Hintergrund nicht mehr").toBe(
      true,
    );
    expect(/"Escape"|'Escape'/.test(quelle), "Modal.tsx hat keinen Tastatur-Ausgang mehr").toBe(
      true,
    );
    expect(e !== undefined && istMarkerloserTraegerAmBestand(e)).toBe(true);
  });

  it("KALIBRIERUNG NEGATIV: HelpTip.tsx ist es NICHT — dieselbe Vollfläche, andere Sache", () => {
    const e = ALLE_ERHEBUNGEN.find((x) => x.quelle.datei === "apps/web/src/components/HelpTip.tsx");
    expect(e, "Negativdatei der Kalibrierung fehlt im Bestand").toBeDefined();
    const quelle = e?.quelle.gestrippt ?? "";
    // Sie liegt in DERSELBEN Bezugsmenge — genau das macht sie zur tauglichen Negativprobe.
    expect(spanntVollflaecheAuf(quelle), "HelpTip.tsx gehört nicht mehr zur Bezugsmenge").toBe(
      true,
    );
    expect(
      verdecktDenHintergrund(quelle),
      "der Klickfänger von HelpTip ist farblos — färbt ihn jemand ein, wird die Fläche modal und gehört ins Register",
    ).toBe(false);
    expect(e !== undefined && istMarkerloserTraegerAmBestand(e)).toBe(false);
    expect(MARKERLOSE_TRAEGER.map((b) => b.datei)).not.toContain(
      "apps/web/src/components/HelpTip.tsx",
    );
  });

  it("KALIBRIERUNG: das Register deckt sich mit dem, was der Bestand hergibt", () => {
    // DIE VOLLSTÄNDIGKEITSPRÜFUNG. Sie fragt NICHT, ob jede Vollfläche irgendwo eingetragen ist,
    // sondern ob GENAU DIE Flächen im Register stehen, die es nach ihrer eigenen Semantik
    // hineingehören. Wird ein Eintrag entfernt, wird sie rot — daran hängt der Red-first-Beleg.
    const abgeleitet = ALLE_ERHEBUNGEN.filter(istMarkerloserTraegerAmBestand)
      .map((e) => e.quelle.datei)
      .sort();
    const registriert = MARKERLOSE_TRAEGER.map((b) => b.datei).sort();
    expect(
      abgeleitet,
      "\nLinks steht, was der BESTAND hergibt, rechts das Register. Fehlt links ein Eintrag, gehört er aus dem Register gestrichen; fehlt rechts einer, ist eine markerlose Modalfläche UNREGISTRIERT.\n",
    ).toEqual(registriert);
  });

  // ==============================================================================================
  // JOB 1093 D3 — DIE ZWEITE SUCHRICHTUNG UND DER RESTLOSE ABGLEICH.
  //
  // BEN zu D2: die Aussage „10 Überlagerungsflächen im gesamten Baum" und „keine vierte" sind
  // UNBEWIESENE HYPOTHESEN, weil die erste Richtung nur Dateien mit bestimmten Bauformen aufnimmt.
  // Hier steht die Gegenrichtung, und hier steht der Abgleich, den BEN prüft: jeder Fund der einen
  // Richtung ist in der anderen enthalten ODER einzeln begründet abwesend. Zielzahl: NULL
  // unerklärte Restfälle.
  // ==============================================================================================

  /** Richtung A am heutigen Bestand: die Bauform-Menge (Vollfläche über `fixed` + vier Seiten). */
  const RICHTUNG_A = (): string[] =>
    ALLE_ERHEBUNGEN.filter((e) => spanntVollflaecheAuf(e.quelle.gestrippt))
      .map((e) => e.quelle.datei)
      .sort();

  /** Richtung B am heutigen Bestand: die Wirkungsmenge. Kennt `spanntVollflaecheAuf` nicht. */
  const RICHTUNG_B = (): string[] =>
    ALLE_ERHEBUNGEN.filter((e) => wirktModalAmBestand(e.quelle.gestrippt))
      .map((e) => e.quelle.datei)
      .sort();

  /**
   * Die begründeten Abwesenheiten. Jede Zeile ist eine Aussage über den heutigen Bestand, die rot
   * wird, sobald sie nicht mehr stimmt — und nicht eine Liste, die Restfälle wegdefiniert.
   */
  const NUR_A_BEGRUENDET = new Map<string, string>([
    [
      "apps/web/src/components/KnowledgeInputStudio.tsx",
      "Vollbild und verdeckend, aber OHNE modale Wirkung: keine Fokusfalle, keine Scrollsperre, kein inert, kein Marker. Ein Produktbefund, kein Erhebungsfehler.",
    ],
    [
      "apps/web/src/components/HelpTip.tsx",
      "Popover: die Vollfläche ist ein farbloser Klickfänger, der Inhalt sitzt daneben — keine Wirkung, die in die Bedienung eingreift",
    ],
    [
      "apps/web/src/components/AiModelInfo.tsx",
      "dieselbe Popover-Bauform wie HelpTip — reine Auskunft ohne Bedienfluss",
    ],
  ]);

  const NUR_B_BEGRUENDET = new Map<string, string>([
    [
      "apps/web/src/app/ModalBoundaryContext.tsx",
      "das Grenzmodul selbst: es IST die Wirkung (inert, Fokusführung), aber keine Fläche — der Sammler führt es als GRENZE_MODUL und schliesst es überall aus",
    ],
    [
      "apps/web/src/lib/focusables.ts",
      "Fokus-Hilfsmodul ohne eigenes Element — steht mit Grund in WIRKUNG_OHNE_FLAECHE",
    ],
  ]);

  it("ABGLEICH: beide Suchrichtungen sind restlos abgeglichen — null unerklärte Restfälle", () => {
    const a = RICHTUNG_A();
    const b = RICHTUNG_B();
    const nurA = a.filter((d) => !b.includes(d));
    const nurB = b.filter((d) => !a.includes(d));

    // Beide Richtungen müssen überhaupt etwas finden — sonst wäre der Abgleich zweier leerer
    // Mengen trivial grün.
    expect(a.length, "Richtung A (Bauform) findet nichts mehr").toBeGreaterThanOrEqual(8);
    expect(b.length, "Richtung B (Wirkung) findet nichts mehr").toBeGreaterThanOrEqual(7);

    const unerklaertA = nurA.filter((d) => !NUR_A_BEGRUENDET.has(d));
    const unerklaertB = nurB.filter((d) => !NUR_B_BEGRUENDET.has(d));
    expect(
      unerklaertA,
      "\nNur in Richtung A gefunden und NICHT begründet abwesend in B — das ist ein unerklärter Restfall:\n",
    ).toEqual([]);
    expect(
      unerklaertB,
      "\nNur in Richtung B gefunden und NICHT begründet abwesend in A — das ist ein unerklärter Restfall:\n",
    ).toEqual([]);

    // Die Gegenrichtung: eine Begründung, deren Fall es gar nicht mehr gibt, beschreibt gestern.
    for (const datei of NUR_A_BEGRUENDET.keys()) {
      expect(nurA, `Begründung ohne Restfall (nur-A): ${datei}`).toContain(datei);
    }
    for (const datei of NUR_B_BEGRUENDET.keys()) {
      expect(nurB, `Begründung ohne Restfall (nur-B): ${datei}`).toContain(datei);
    }
  });

  it("ZWEITE RICHTUNG: am heutigen Bestand steht jede Wirkungsfläche in einer bekannten Klasse", () => {
    expect(
      unregistrierteWirkflaechen(ALLE_ERHEBUNGEN, BAUTEILE),
      "\nModale WIRKUNG ohne Registereintrag — der eigentliche Fund dieser Richtung:\n",
    ).toEqual([]);
  });

  it("STYLESHEET-SUCHRAUM: keine Vollbildfläche in einem .css — dort hat Richtung A nie gesehen", () => {
    // Richtung A liest ausschliesslich `.ts`/`.tsx`. Gemessen: drei Stylesheets, kein Treffer.
    expect(stylesheetdateien(join("apps", "web")).length).toBeGreaterThan(0);
    expect(stylesheetVollbildregeln()).toEqual([]);
  });

  // ---- DIE BEIDEN GEGENFAELLE AUSSERHALB DER BISHERIGEN VORFILTERUNG (Lieferungen 3 und 4) ----

  it("GEGENFALL 1: ein markerloser Träger mit `w-screen h-screen` — A ist blind, B meldet ihn", () => {
    const traeger = synthetisch("apps/web/src/components/SynthSchirmflaeche.tsx", [
      'import { useEffect } from "react";',
      "export function SynthSchirmflaeche({ open, onClose }: { open: boolean; onClose: () => void }) {",
      "  useEffect(() => {",
      "    if (!open) return;",
      '    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };',
      '    document.addEventListener("keydown", onKey);',
      '    return () => document.removeEventListener("keydown", onKey);',
      "  }, [open, onClose]);",
      "  if (!open) return null;",
      '  return <div className="fixed w-screen h-screen z-50 bg-ink/70">Inhalt</div>;',
      "}",
    ]);

    // (1) DIE LÜCKE, GEMESSEN: die erste Richtung sieht diesen Träger nicht. Ohne diese Zeile wäre
    //     der Fall unten nicht von „war ohnehin schon abgedeckt" zu unterscheiden.
    expect(
      spanntVollflaecheAuf(traeger.quelle.gestrippt),
      "`w-screen h-screen` ist keine `fixed`+vier-Seiten-Fläche — genau das ist BENs Befund",
    ).toBe(false);
    expect(unregistrierteVollflaechen([traeger], BAUTEILE)).toEqual([]);

    // (2) UND DIE ZWEITE RICHTUNG FINDET IHN TROTZDEM.
    expect(traeger.kandidaten, "der Träger ist markerlos").toEqual([]);
    expect(wirkungssignale(traeger.quelle.gestrippt)).toContain("B6 Vollbildform");
    expect(unregistrierteWirkflaechen([traeger], BAUTEILE)).toEqual([
      "apps/web/src/components/SynthSchirmflaeche.tsx",
    ]);
  });

  it("GEGENFALL 2: ein fokusgesperrter Träger mit `openIndex` — A ist blind, B meldet ihn", () => {
    // BENs zweite Prüflücke wörtlich: ein nativer oder fokusgesperrter Modalträger mit nicht
    // erkanntem Zustandsnamen und OHNE die bisherige UE-Signatur.
    const traeger = synthetisch("apps/web/src/components/SynthFokusfalle.tsx", [
      'import { useRef, useState } from "react";',
      'import { focusablesIn } from "../lib/focusables";',
      "export function SynthFokusfalle() {",
      "  const [openIndex] = useState<number | null>(null);",
      "  const panelRef = useRef<HTMLDivElement | null>(null);",
      "  const onKeyDown = (e: KeyboardEvent) => {",
      '    if (e.key !== "Tab") return;',
      "    e.preventDefault();",
      "    focusablesIn(panelRef.current)[0]?.focus();",
      "  };",
      "  if (openIndex === null) return null;",
      '  return <div ref={panelRef} onKeyDown={onKeyDown} className="absolute h-full w-full bg-ink/60">x</div>;',
      "}",
    ]);

    expect(
      spanntVollflaecheAuf(traeger.quelle.gestrippt),
      "kein `fixed`, kein Portal — für die erste Richtung existiert dieser Träger nicht",
    ).toBe(false);
    expect(unregistrierteVollflaechen([traeger], BAUTEILE)).toEqual([]);

    expect(traeger.kandidaten, "der Träger ist markerlos").toEqual([]);
    expect(wirkungssignale(traeger.quelle.gestrippt)).toContain("B1 Fokusfalle");
    expect(unregistrierteWirkflaechen([traeger], BAUTEILE)).toEqual([
      "apps/web/src/components/SynthFokusfalle.tsx",
    ]);
  });

  it("ZWEITE RICHTUNG · KALIBRIERUNG: eine Fläche ohne Wirkung wird NICHT gemeldet", () => {
    // Ohne diesen Fall wäre die zweite Richtung von „meldet alles" nicht zu unterscheiden. Der
    // Prüfstein kommt aus dem ECHTEN Bestand: `HelpTip.tsx` und `ToastViewport.tsx` tragen beide
    // das Signal B6 (`100vw`), aber ohne Verdeckung — und bleiben deshalb draussen.
    for (const datei of [
      "apps/web/src/components/HelpTip.tsx",
      "apps/web/src/shell/ToastViewport.tsx",
    ]) {
      const e = ALLE_ERHEBUNGEN.find((x) => x.quelle.datei === datei);
      expect(e, `Kalibrierdatei fehlt im Bestand: ${datei}`).toBeDefined();
      const quelle = e?.quelle.gestrippt ?? "";
      expect(wirkungssignale(quelle), `${datei} sollte B6 tragen`).toContain("B6 Vollbildform");
      expect(
        wirktModalAmBestand(quelle),
        `${datei} ist Layout, keine Wirkfläche — meldet die zweite Richtung sie, ist sie zu grob`,
      ).toBe(false);
    }

    // Und ein synthetischer Balken ohne jedes Signal ebenfalls nicht.
    const balken = synthetisch("apps/web/src/components/SynthOhneWirkung.tsx", [
      "export function SynthOhneWirkung(): JSX.Element {",
      '  return <div className="fixed bottom-4 right-4 z-50">Hinweis</div>;',
      "}",
    ]);
    expect(unregistrierteWirkflaechen([balken], BAUTEILE)).toEqual([]);
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

// ================================================================================================
// JOB 1130 · D1 — DIE VIER A17-BAUFORMEN BEISSEN WIRKLICH, UND DIE IDENTITÄT TRÄGT DIE BINDUNG.
// ================================================================================================
//
// HERKUNFT. BEN7 hat zu JOB 966 vier Prüflücken benannt; alle vier liegen in genau dieser Datei:
//   1. Integrationstest B1 — gleichnamiges Fremdsymbol ersetzt echte Einbindung, erwartet rot.
//   2. Mutationsprobe für die vier A17-Wege — Entfernung der Erkennung macht den Fall rot.
//   3. Zähler-Test — wörtliche Erwähnung ohne erklärte Registrierung, erwartet rot mit Datei/Zeile.
//   4. Prop-Weitergabe — `<Rahmen komponente={FacetFilter} />`, erwartet fail-closed.
//
// WARUM DAS NÖTIG IST, obwohl die Bauform-Fixtures seit mega72 existieren: Die PRO-Rückgabe zu
// JOB 966 hat es selbst als offene Grenze benannt — *„Die Wirksamkeit der Fixtures ist nicht
// gegengeprüft. Ein Fixture kann existieren und trotzdem nichts fangen"* — und verweist auf bens
// Befund aus 905 D1, wonach *„vier der sechs Positivformen bereits VOR der Änderung grün waren"*.
// Ein grüner Positivfall allein beweist nur, dass etwas erhoben wurde; er beweist NICHT, dass die
// Erhebung an dem Merkmal hängt, das den Fall trägt.
//
// DIE BAUFORM DER PROBE ist deshalb der NEGATIV-ZWILLING: zu jedem Positivfall dieselbe Datei
// OHNE das erkennungstragende Merkmal. Bleibt der Fund aus, hängt die Erkennung nachweislich an
// genau diesem Merkmal — und der Positivfall beisst. Das ist ein DAUERHAFTER Wächter und keine
// einmalige Mutation am Sammlercode: er bleibt stehen und schlägt an, wenn jemand die Erkennung
// später aufweicht.
//
// GEMESSEN AM ECHTEN SAMMLER: jeder Fall geht durch `erhebeDatei`, `erhebeVerweise`, `beurteile`
// bzw. `modalAbgleich` — dieselben Funktionen, die den heutigen Quellbaum erheben.
describe("JOB 1130 · die vier A17-Bauformen beissen — Negativ-Zwillinge", () => {
  const BAUTEIL: Bauteil = {
    datei: "apps/web/src/components/FacetFilter.tsx",
    komponente: "FacetFilter",
  };
  const synth = (datei: string, zeilen: string[]): DateiErhebung =>
    erhebeDatei(quelleAus(datei, zeilen.join("\n")));
  const paareVon = (e: DateiErhebung): string[] =>
    erhebeVerweise([e], [BAUTEIL]).paare.map(schluessel);

  it("M-1: Bauform 1 (Alias) — OHNE die Alias-Zuweisung entsteht kein Aufrufer", () => {
    // Positivkontrolle: mit Alias ist es ein Aufrufer (dieselbe Zusage wie Bauform 1 oben).
    const mit = synth("apps/web/src/pages/M1Mit.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      "const Umbenannt = FacetFilter;",
      "export function Seite(): JSX.Element {",
      "  return <Umbenannt themes={[]} authors={[]} spaces={[]} />;",
      "}",
    ]);
    expect(paareVon(mit)).toContain("apps/web/src/pages/M1Mit.tsx → <FacetFilter>");

    // NEGATIV-ZWILLING: derselbe Import, dieselbe Nutzung eines lokalen Namens — aber der Name
    // stammt NICHT aus dem Bauteil. Fällt die Aliaskette weg, darf kein Paar entstehen.
    const ohne = synth("apps/web/src/pages/M1Ohne.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      "const Umbenannt = () => null;",
      "export function Seite(): JSX.Element {",
      "  return <Umbenannt />;",
      "}",
    ]);
    expect(
      paareVon(ohne),
      "ohne die Aliaskette hängt die Erkennung an nichts mehr — kein Aufrufer",
    ).toEqual([]);
  });

  it("M-2: Bauform 2 (createElement) — OHNE den createElement-Aufruf entsteht kein Aufrufer", () => {
    const mit = synth("apps/web/src/pages/M2Mit.tsx", [
      'import { createElement } from "react";',
      'import { FacetFilter } from "../components/FacetFilter";',
      "export function Seite(): unknown {",
      "  return createElement(FacetFilter, null);",
      "}",
    ]);
    expect(paareVon(mit)).toContain("apps/web/src/pages/M2Mit.tsx → <FacetFilter>");

    // NEGATIV-ZWILLING: der Import bleibt, der Aufruf verschwindet. Der Sammler darf daraus
    // KEINE Einbindung machen — und er meldet den toten Verweis, statt ihn zu verschweigen.
    const ohne = synth("apps/web/src/pages/M2Ohne.tsx", [
      'import { createElement } from "react";',
      'import { FacetFilter } from "../components/FacetFilter";',
      "export function Seite(): unknown {",
      "  return createElement('div', null);",
      "}",
    ]);
    expect(paareVon(ohne), "ohne den Aufruf ist es keine Einbindung").toEqual([]);
    expect(
      erhebeVerweise([ohne], [BAUTEIL]).rot.some((r) => r.includes("ohne erkennbare Einbindung")),
      "der tote Verweis wird gemeldet, nicht still übergangen",
    ).toBe(true);
  });

  it("M-3: Bauform 3 (Spread-aria-modal) — OHNE den Marker entsteht kein Kandidat", () => {
    const mit = synth("apps/web/src/components/M3Mit.tsx", [
      'const dialogProps = { "aria-modal": "true" };',
      "export function Fenster(): JSX.Element {",
      "  return <div {...dialogProps} />;",
      "}",
    ]);
    expect(mit.kandidaten.map((k) => k.art)).toEqual(["aria-modal-eigenschaft"]);
    expect(beurteile([mit]).rot).toHaveLength(1);

    // NEGATIV-ZWILLING: identische Bauform (Objekt + Spread), nur ohne das Merkmal.
    const ohne = synth("apps/web/src/components/M3Ohne.tsx", [
      'const dialogProps = { "data-rolle": "true" };',
      "export function Fenster(): JSX.Element {",
      "  return <div {...dialogProps} />;",
      "}",
    ]);
    expect(
      ohne.kandidaten,
      "ein Spread ohne aria-modal ist kein modaler Kandidat — sonst wäre jeder Spread einer",
    ).toEqual([]);
    expect(beurteile([ohne]).rot).toEqual([]);
  });

  it("M-4: Bauform 4 (setAttribute / role=dialog) — OHNE den Marker entsteht kein Kandidat", () => {
    const mitAttr = synth("apps/web/src/lib/m4MitAttr.ts", [
      "export function markiere(el: HTMLElement): void {",
      '  el.setAttribute("aria-modal", "true");',
      "}",
    ]);
    expect(mitAttr.kandidaten.map((k) => k.art)).toEqual(["aria-modal-zeichenkette"]);

    const ohneAttr = synth("apps/web/src/lib/m4OhneAttr.ts", [
      "export function markiere(el: HTMLElement): void {",
      '  el.setAttribute("data-rolle", "true");',
      "}",
    ]);
    expect(ohneAttr.kandidaten, "ein beliebiges setAttribute ist kein Kandidat").toEqual([]);
    expect(beurteile([ohneAttr]).rot).toEqual([]);

    const mitRolle = synth("apps/web/src/components/M4MitRolle.tsx", [
      "export function Fenster(): JSX.Element {",
      '  return <div role="dialog" />;',
      "}",
    ]);
    expect(mitRolle.kandidaten.map((k) => k.art)).toEqual(["role-dialog"]);

    const ohneRolle = synth("apps/web/src/components/M4OhneRolle.tsx", [
      "export function Fenster(): JSX.Element {",
      '  return <div role="region" />;',
      "}",
    ]);
    expect(ohneRolle.kandidaten, "role=region ist keine Modalität").toEqual([]);
    expect(beurteile([ohneRolle]).rot).toEqual([]);
  });
});

describe("JOB 1130 · Symbolidentität — ein Fremdtreffer ersetzt keine echte Einbindung", () => {
  const BAUTEIL: Bauteil = {
    datei: "apps/web/src/components/FacetFilter.tsx",
    komponente: "FacetFilter",
  };
  const synth = (datei: string, zeilen: string[]): DateiErhebung =>
    erhebeDatei(quelleAus(datei, zeilen.join("\n")));

  it("I-1: TÄUSCHUNGSKOMPENSATION — verschwindet die echte Einbindung, verdeckt der gleichnamige Fremdtreffer sie NICHT", () => {
    // DER FALL, den ben „Täuschungskompensation" nennt und den BEN7 als Prüflücke 1 verlangt:
    // In einer Datei, die als Aufrufer geführt wird, wird die echte Einbindung durch ein
    // gleichnamiges Fremdsymbol ERSETZT. Ein namensbasierter Sammler meldete hier weiter grün —
    // genau das „war doch grün", vor dem Register A17 warnt.
    const echt = synth("apps/web/src/pages/TaeuschungVorher.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      "export function Seite(): JSX.Element {",
      "  return <FacetFilter themes={[]} authors={[]} spaces={[]} />;",
      "}",
    ]);
    const vorher = erhebeVerweise([echt], [BAUTEIL]);
    expect(vorher.paare.map(schluessel), "Vorbedingung: die echte Einbindung IST ein Paar").toEqual(
      ["apps/web/src/pages/TaeuschungVorher.tsx → <FacetFilter>"],
    );

    // Dieselbe Datei, dieselbe JSX-Zeile, derselbe Namenstext — nur die Herkunft ist eine andere.
    const getauscht = synth("apps/web/src/pages/TaeuschungNachher.tsx", [
      'import { FacetFilter } from "../lib/facetRail";',
      "export function Seite(): JSX.Element {",
      "  return <FacetFilter themes={[]} authors={[]} spaces={[]} />;",
      "}",
    ]);
    const nachher = erhebeVerweise([getauscht], [BAUTEIL]);
    expect(
      nachher.paare,
      "der Fremdtreffer darf das Paar NICHT ersetzen — sonst bliebe der Wegfall unsichtbar",
    ).toEqual([]);
    expect(
      nachher.fremdbefunde.some((f) => f.includes("TaeuschungNachher.tsx")),
      "und er wird sichtbar gemacht statt stillschweigend verworfen",
    ).toBe(true);
  });

  it("I-2: die Ersetzung ist am ZÄHLER ablesbar — kein Paar, aber auch kein stiller Nullfund", () => {
    // Der Wert von I-1 hängt daran, dass der Wegfall NICHT als „nichts passiert" endet: Der
    // Sammler führt den Fremdbefund und lässt den Aufrufer aus den Paaren fallen. Genau diese
    // Kombination — leere Paare UND ein benannter Befund — unterscheidet „ersetzt" von „nie da".
    const fremd = synth("apps/web/src/pages/TaeuschungZaehler.tsx", [
      'import { FacetFilter } from "../lib/facetRail";',
      "export function Seite(): JSX.Element {",
      "  return <FacetFilter />;",
      "}",
    ]);
    const bild = erhebeVerweise([fremd], [BAUTEIL]);
    expect(bild.paare).toEqual([]);
    expect(bild.fremdbefunde).toHaveLength(1);
    expect(bild.fremdbefunde[0]).toContain(
      "ohne Bindung an apps/web/src/components/FacetFilter.tsx",
    );
  });
});

describe("JOB 1130 · der Zähler und die fail-closed Prop-Weitergabe", () => {
  const BAUTEIL: Bauteil = {
    datei: "apps/web/src/components/FacetFilter.tsx",
    komponente: "FacetFilter",
  };
  const synth = (datei: string, zeilen: string[]): DateiErhebung =>
    erhebeDatei(quelleAus(datei, zeilen.join("\n")));

  it("Z-1: GEMESSENE DECKUNG — vier Vorkommensformen sind ALLE abgerechnet, keine fällt still heraus", () => {
    // BEN7-Prüflücke 3 verlangt: „zusätzliche wörtliche Erwähnung ohne erklärte
    // Kandidatenregistrierung — erwartet rot mit Datei/Zeile."
    //
    // DIESER FALL HÄLT DAS GEMESSENE ERGEBNIS FEST, und das Ergebnis ist besser als erwartet:
    // Ich habe drei Formen gesucht, die durchrutschen — Zeichenkette, Element-Zugriff
    // (`d["showModal"]`) und Property-Zugriff über eine Zwischenvariable (`const o = d.showModal`).
    // KEINE davon fällt heraus: die Zeichenkette ist belegte Prosa („Alles Text-Artige, das kein
    // Kandidat wurde, ist belegte Prosa"), die beiden Zugriffsformen werden Kandidaten. Ein
    // erfundener Defekt wäre hier die falsche Antwort — der Sammler deckt diese Formen wirklich.
    //
    // Der Wert dieses Falls liegt in der Gegenrichtung: er pinnt die Deckung. Wer eine dieser
    // Formen später aus der Erkennung nimmt, macht ihn rot.
    const alsProsa = synth("apps/web/src/lib/z1Prosa.ts", [
      "export const VORLAGE: string[] = [",
      '  "<dialog>",',
      '  "aria-modal",',
      "];",
    ]);
    expect(modalAbgleich(alsProsa), "Zeichenkette: als belegte Prosa abgerechnet").toEqual([]);

    const alsElementZugriff = synth("apps/web/src/lib/z1Zugriff.ts", [
      "export function ruf(d: HTMLDialogElement): void {",
      '  d["showModal"]();',
      "}",
    ]);
    expect(alsElementZugriff.kandidaten.map((k) => k.art)).toEqual(["showModal-nutzung"]);
    expect(modalAbgleich(alsElementZugriff), "Element-Zugriff: als Kandidat erklärt").toEqual([]);

    const ueberZwischenvariable = synth("apps/web/src/lib/z1Zwischen.ts", [
      "export function oeffne(d: HTMLDialogElement): void {",
      "  const oeffner = d.showModal;",
      "  oeffner.call(d);",
      "}",
    ]);
    expect(
      ueberZwischenvariable.kandidaten.length,
      "Property-Zugriff ohne Aufruf: ebenfalls erkannt",
    ).toBeGreaterThan(0);
    expect(modalAbgleich(ueberZwischenvariable)).toEqual([]);

    const alsAttribut = synth("apps/web/src/components/Z1Attribut.tsx", [
      "export function Fenster(): JSX.Element {",
      '  return <div aria-modal="true" />;',
      "}",
    ]);
    expect(alsAttribut.kandidaten.map((k) => k.art)).toEqual(["aria-modal-attribut"]);
    expect(modalAbgleich(alsAttribut)).toEqual([]);
  });

  it("Z-2: der Zähler BEISST — eine nicht abrechenbare Form wird rot, mit Datei und Zeile", () => {
    // Die Wirksamkeitsprobe zum Fall darüber: gäbe es KEINE Form, die der Zähler meldet, wäre
    // „alles abgerechnet" auch bei einem blinden Zähler grün. Die destrukturierte Bindung ist
    // die belegte Lücke — `showModal` steht zweimal wörtlich im Code und wird kein Kandidat.
    const e = synth("apps/web/src/lib/z2Destrukturiert.ts", [
      "export function oeffne(d: HTMLDialogElement): void {",
      "  const { showModal } = d;",
      "  showModal.call(d);",
      "}",
    ]);
    expect(e.kandidaten, "kein Kandidat erklärt diese Form").toEqual([]);
    const rot = modalAbgleich(e);
    expect(rot, "und darum meldet der Zähler sie").toHaveLength(1);
    expect(rot[0], "mit Datei und Zeilen").toContain("apps/web/src/lib/z2Destrukturiert.ts:2,3");
  });

  it("Z-3: KALIBRIERUNG — eine erklärte Registrierung wird NICHT rot (der Zähler rechnet wirklich ab)", () => {
    // Ohne diesen Fall wäre jedes Rot oben auch dann grün, wenn der Zähler pauschal alles meldet.
    const erklaert = synth("apps/web/src/components/Z3Erklaert.tsx", [
      "export function Fenster(): JSX.Element {",
      '  return <div aria-modal="true" />;',
      "}",
    ]);
    expect(erklaert.kandidaten.map((k) => k.art)).toEqual(["aria-modal-attribut"]);
    expect(modalAbgleich(erklaert), "als Kandidat erklärt ⇒ abgerechnet ⇒ nicht rot").toEqual([]);
  });

  it("P-1: PROP-WEITERGABE bleibt fail-closed — <Rahmen komponente={FacetFilter} /> ist keine Einbindung", () => {
    // BEN7-Prüflücke 4. Ob der Empfänger das Bauteil je rendert, kann eine dateiweise Erhebung
    // nicht wissen. Der Sammler darf daraus deshalb WEDER eine Einbindung machen (das wäre eine
    // erfundene Zusage) NOCH stillschweigend nichts (das wäre die Lücke). Er meldet sie.
    const e = synth("apps/web/src/pages/P1Prop.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      'import { Rahmen } from "../components/Rahmen";',
      "export function Seite(): JSX.Element {",
      "  return <Rahmen komponente={FacetFilter} />;",
      "}",
    ]);
    const bild = erhebeVerweise([e], [BAUTEIL]);
    expect(bild.paare, "eine durchgereichte Referenz ist KEINE belegte Einbindung").toEqual([]);
    expect(
      bild.rot.length,
      "und sie verschwindet auch nicht still — der Sammler meldet den unbeurteilbaren Verweis",
    ).toBeGreaterThan(0);
    expect(bild.rot.join("\n")).toContain("apps/web/src/pages/P1Prop.tsx");
  });

  it("P-2: KALIBRIERUNG — dieselbe Datei MIT echter Einbindung ergibt sehr wohl ein Paar", () => {
    const e = synth("apps/web/src/pages/P2Direkt.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      'import { Rahmen } from "../components/Rahmen";',
      "export function Seite(): JSX.Element {",
      "  return <Rahmen><FacetFilter themes={[]} authors={[]} spaces={[]} /></Rahmen>;",
      "}",
    ]);
    expect(erhebeVerweise([e], [BAUTEIL]).paare.map(schluessel)).toContain(
      "apps/web/src/pages/P2Direkt.tsx → <FacetFilter>",
    );
  });
});

// ================================================================================================
// JOB 1020 · D13 — DIE BELEG-ASSERTIONSKETTE, HIER UND NUR HIER.
// ================================================================================================
//
// BENS BEFUND ZU D12, wörtlich: „Der technisch grüne Endstand kalibriert nur eine neue testlokale
// Assertionslogik; er schliesst weder den zentralen Wächter noch den konkreten D-044-Dialog an."
// Die Prüflogik lag ausschliesslich in `tests/app/d044-assertionskette.test.ts` und prüfte dort
// sich selbst — der Sammler, der tatsächlich über Freigaben entscheidet, kannte sie nicht
// (gemessen vor diesem Durchgang: `belegAssertionErfuellt` in dieser Datei = 0 Treffer).
//
// KORREKTURPFLICHT 1 lässt zwei Wege: „in den tatsächlich entscheidenden zentralen Wächter
// integrieren ODER aus einer gemeinsamen Implementierung importieren". D13 nimmt den ERSTEN,
// und zwar aus einem gemessenen Grund: Der Importweg verlangt einen `export` aus einer
// `.test.ts`-Datei, und den verbietet die Hausregel `lint/suspicious/noExportsInTest`. Der
// Bestand befolgt sie ausdrücklich statt sie zu unterdrücken (`tests/security/
// egress-encapsulation.test.ts:51`: „Kein Export (Biome: noExportsInTest)"). Ein `biome-ignore`
// hätte eine bewusste Hausregel für eine Bequemlichkeit ausgehebelt — und nebenbei alle zwölf
// Kalibrierfälle bei jedem Sammlerlauf ein zweites Mal ausgeführt (gemessen: 71 → 83 Fälle).
//
// DIE LOGIK EXISTIERT DAMIT GENAU EINMAL, hier. `d044-assertionskette.test.ts` führt sie nicht
// mehr, sondern wacht darüber, dass sie hier steht und nicht wieder zweimal entsteht.
//
// WAS SIE PRÜFT: dass EIN ausgeführter `it`/`test`-Rumpf die ganze Belegkette an DERSELBEN
// Variablen trägt —
//
//   Markerselektor  →  dialogVar
//   dialogVar       →  dessen `aria-labelledby` wird gelesen
//   dialogVar       →  Argument der Namensauflösung
//   deren Ergebnis  →  nameVar
//   nameVar         →  Nichtleerheitsaussage
//   nameVar         →  Vergleich mit der registrierten Erwartung
//
// Es gibt KEINEN SourceFile-Rückfall: Wer die Kette auf zwei Tests verteilt, bleibt abgelehnt.
// Genau das war der D11-Fehler, den BEN mit zwei synthetischen Formen belegt hat.

/** Der Registereintrag eines Belegs — vier Felder, so wie der Wächter ihn führt. */
interface Beleg {
  /** Der Selektor, mit dem der registrierte Dialog ausgewählt wird. */
  readonly marker: string;
  /** Die Beschriftungsbindung, die an ihm gelesen werden muss. */
  readonly bindung: string;
  /** Die Funktion, die den zugänglichen Namen ermittelt. */
  readonly namensaufloesung: string;
  /** Die Erwartung, gegen die der ermittelte Name stehen muss. */
  readonly inhaltserwartung: string;
}

const D044: Beleg = {
  marker: '[data-testid="editor-zoom"]',
  bindung: "aria-labelledby",
  namensaufloesung: "zugaenglicherName",
  inhaltserwartung: "editor.zoom.title",
};

function baum(quelltext: string): ts.SourceFile {
  return ts.createSourceFile(
    "beleg.test.tsx",
    quelltext,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function kinder(knoten: ts.Node): ts.Node[] {
  const raus: ts.Node[] = [];
  knoten.forEachChild((k) => {
    raus.push(k);
  });
  return raus;
}

function alleKnoten(knoten: ts.Node): ts.Node[] {
  const raus: ts.Node[] = [knoten];
  for (const k of kinder(knoten)) {
    raus.push(...alleKnoten(k));
  }
  return raus;
}

/** Enthält der Teilbaum ein Stringliteral, das `text` enthält? */
function literalEnthaelt(knoten: ts.Node, text: string): boolean {
  return alleKnoten(knoten).some(
    (k) =>
      (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) && k.text.includes(text),
  );
}

/** Die Rümpfe aller `it`/`test`-Aufrufe — und NUR die. Kein SourceFile-Rückfall. */
function testRuempfe(sf: ts.SourceFile): ts.Node[] {
  const raus: ts.Node[] = [];
  for (const k of alleKnoten(sf)) {
    if (!ts.isCallExpression(k)) {
      continue;
    }
    const name = ts.isIdentifier(k.expression)
      ? k.expression.text
      : ts.isPropertyAccessExpression(k.expression) && ts.isIdentifier(k.expression.expression)
        ? k.expression.expression.text
        : "";
    if (name !== "it" && name !== "test") {
      continue;
    }
    const rumpf = k.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
    if (rumpf && (ts.isArrowFunction(rumpf) || ts.isFunctionExpression(rumpf)) && rumpf.body) {
      raus.push(rumpf.body);
    }
  }
  return raus;
}

/** Der Name der Variablen, in die dieser Knoten deklariert oder zugewiesen wird — oder null. */
function zielVariable(knoten: ts.Node): string | null {
  let lauf: ts.Node | undefined = knoten;
  while (lauf) {
    if (ts.isVariableDeclaration(lauf) && ts.isIdentifier(lauf.name)) {
      return lauf.name.text;
    }
    if (
      ts.isBinaryExpression(lauf) &&
      lauf.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(lauf.left)
    ) {
      return lauf.left.text;
    }
    lauf = lauf.parent;
  }
  return null;
}

/** Steht dieser Ausdruck für die Variable `name` — direkt oder als deren Eigenschaftszugriff? */
function istVariable(ausdruck: ts.Node, name: string): boolean {
  if (ts.isIdentifier(ausdruck)) {
    return ausdruck.text === name;
  }
  if (ts.isPropertyAccessExpression(ausdruck) || ts.isElementAccessExpression(ausdruck)) {
    return istVariable(ausdruck.expression, name);
  }
  if (ts.isNonNullExpression(ausdruck) || ts.isParenthesizedExpression(ausdruck)) {
    return istVariable(ausdruck.expression, name);
  }
  return false;
}

interface Kettenbefund {
  readonly erfuellt: boolean;
  /** Welches Glied zuerst gerissen ist — für eine Fehlermeldung, die etwas sagt. */
  readonly bruchstelle: string;
}

function belegAssertionErfuellt(quelltext: string, beleg: Beleg): Kettenbefund {
  const sf = baum(quelltext);
  const ruempfe = testRuempfe(sf);
  if (ruempfe.length === 0) {
    return { erfuellt: false, bruchstelle: "kein ausgefuehrter it/test-Rumpf" };
  }

  let letzteBruchstelle = "kein Rumpf traegt die Kette";

  for (const rumpf of ruempfe) {
    const knoten = alleKnoten(rumpf);

    // (1) Markerselektion -> dialogVar
    const dialogVars = new Set<string>();
    for (const k of knoten) {
      if (!ts.isCallExpression(k)) {
        continue;
      }
      if (!k.arguments.some((a) => literalEnthaelt(a, beleg.marker))) {
        continue;
      }
      const v = zielVariable(k);
      if (v) {
        dialogVars.add(v);
      }
    }
    if (dialogVars.size === 0) {
      letzteBruchstelle = "Markerselektion ergibt keine Dialogvariable";
      continue;
    }

    for (const dialogVar of dialogVars) {
      // (2) `aria-labelledby` wird AN dialogVar gelesen
      const bindungGelesen = knoten.some(
        (k) =>
          ts.isCallExpression(k) &&
          ts.isPropertyAccessExpression(k.expression) &&
          istVariable(k.expression.expression, dialogVar) &&
          k.arguments.some((a) => literalEnthaelt(a, beleg.bindung)),
      );
      if (!bindungGelesen) {
        letzteBruchstelle = `\`${beleg.bindung}\` wird nicht an \`${dialogVar}\` gelesen`;
        continue;
      }

      // (3) Namensaufloesung MIT dialogVar als Argument -> nameVar (oder inline)
      const aufloesungen = knoten.filter(
        (k) =>
          ts.isCallExpression(k) &&
          ts.isIdentifier(k.expression) &&
          k.expression.text === beleg.namensaufloesung &&
          k.arguments.some((a) => istVariable(a, dialogVar)),
      ) as ts.CallExpression[];
      if (aufloesungen.length === 0) {
        letzteBruchstelle = `\`${beleg.namensaufloesung}(...)\` erhaelt nicht \`${dialogVar}\``;
        continue;
      }

      for (const aufloesung of aufloesungen) {
        const nameVar = zielVariable(aufloesung);

        /**
         * Steht dieser Ausdruck fuer das Ergebnis der Aufloesung AN DIESEM Dialog?
         *
         * Drei zulaessige Formen, und keine mehr:
         *   · derselbe Aufruf (direkt im `expect`),
         *   · die Variable, in die er geschrieben wurde (die echte Zwischenvariablenform),
         *   · ein WEITERER Aufruf derselben Aufloesung mit DERSELBEN Dialogvariablen.
         *
         * Die dritte Form ist noetig, weil `expect(zugaenglicherName(dialog)).toBeTruthy()`
         * und `expect(zugaenglicherName(dialog)).toBe(...)` zwei AST-Knoten sind, aber
         * denselben Wert bezeichnen. Knotenidentitaet zu verlangen waere nicht strenger,
         * sondern nur falsch — sie wuerde eine gueltige Belegform ablehnen. Die Bindung an
         * `dialogVar` bleibt dabei unangetastet: ein Aufruf mit einem fremden Element
         * erfuellt keine der drei Formen.
         */
        const istNamenswert = (a: ts.Node): boolean => {
          if (a === aufloesung || alleKnoten(a).includes(aufloesung)) {
            return true;
          }
          if (nameVar !== null && istVariable(a, nameVar)) {
            return true;
          }
          return alleKnoten(a).some(
            (k) =>
              ts.isCallExpression(k) &&
              ts.isIdentifier(k.expression) &&
              k.expression.text === beleg.namensaufloesung &&
              k.arguments.some((arg) => istVariable(arg, dialogVar)),
          );
        };

        // (4) Nichtleerheit, an DENSELBEN Namenswert gebunden
        const nichtleer = knoten.some((k) => {
          if (!ts.isCallExpression(k) || !ts.isIdentifier(k.expression)) {
            return false;
          }
          if (k.expression.text !== "expect") {
            return false;
          }
          if (!k.arguments.some((a) => istNamenswert(a))) {
            return false;
          }
          const kette = k.parent;
          if (!kette || !ts.isPropertyAccessExpression(kette)) {
            return false;
          }
          const matcher = kette.name.text;
          return (
            matcher.startsWith("toBeGreaterThan") ||
            matcher === "toBeTruthy" ||
            matcher === "toHaveLength" ||
            matcher === "not"
          );
        });
        if (!nichtleer) {
          letzteBruchstelle = "keine Nichtleerheitsaussage am selben Namenswert";
          continue;
        }

        // (5) Vergleich mit der registrierten Erwartung, am DEMSELBEN Namenswert
        const verglichen = knoten.some((k) => {
          if (!ts.isCallExpression(k) || !ts.isIdentifier(k.expression)) {
            return false;
          }
          if (k.expression.text !== "expect") {
            return false;
          }
          if (!k.arguments.some((a) => istNamenswert(a))) {
            return false;
          }
          const kette = k.parent;
          if (!kette || !ts.isPropertyAccessExpression(kette)) {
            return false;
          }
          const aufruf = kette.parent;
          if (!aufruf || !ts.isCallExpression(aufruf)) {
            return false;
          }
          return aufruf.arguments.some((a) => literalEnthaelt(a, beleg.inhaltserwartung));
        });
        if (!verglichen) {
          letzteBruchstelle = `der Namenswert wird nicht gegen \`${beleg.inhaltserwartung}\` verglichen`;
          continue;
        }

        return { erfuellt: true, bruchstelle: "" };
      }
    }
  }

  return { erfuellt: false, bruchstelle: letzteBruchstelle };
}

/**
 * Der D10-NACHBAU — nur zum Vergleich, und ausdrücklich ein Nachbau, nicht der Originalstand.
 *
 * Der echte D10-Wächter steckt nicht in dieser Base (in D12 nachgemessen). Was hier steht, ist die
 * von BEN wörtlich beschriebene D10-Semantik — vier freie `String.includes` über die ganze Datei —
 * damit der kausale Unterschied überhaupt messbar wird. Er belegt eine Aussage über den NACHBAU.
 */
function wortpruefungD10(quelltext: string, beleg: Beleg): boolean {
  return (
    quelltext.includes(beleg.marker) &&
    quelltext.includes(beleg.bindung) &&
    quelltext.includes(beleg.namensaufloesung) &&
    quelltext.includes(beleg.inhaltserwartung)
  );
}

// ================================================================================================
// JOB 1020 · D13 — DIE BELEG-ASSERTIONSKETTE LÄUFT IM ZENTRALEN WÄCHTER.
// ================================================================================================
//
// DIE FÄLLE UNTEN RUFEN DIE IMPLEMENTIERUNG DIREKT DARÜBER AUF — dieselbe und einzige. Das ist
// BENs Kernforderung: „die synthetischen Positiv-/Negativfälle müssen genau diesen ausgeführten
// Code prüfen." In D12 prüften sie eine Kopie in ihrer eigenen Datei, die der Sammler nie anfasste.
//
// ZWEI GRUPPEN:
//   · KALIBRIERUNG (P1-P2, N1-N6, D10-Vergleich): der vollständige D12-Bestand, hierher übernommen.
//     Er kalibriert jetzt die Implementierung, die der Sammler wirklich ausführt.
//   · BELEGKETTE: BENs Prüflücke 1, wörtlich — „Zwei Belegdateien durch den tatsächlich
//     entscheidenden Wächter laufen lassen — einmal auf zwei `it`-Rümpfe verteilt, einmal mit
//     Namensauflösung an einer fremden Elementvariable. Erwartet: Beide Kandidaten bleiben
//     abgelehnt; die echte Zwischenvariablenform wird angenommen."
//
// WAS SIE NICHT SIND: ein Beleg, dass der D-044-Dialog existiert. Er existiert nicht (gemessen in
// D13: `editor-zoom`, `editor.zoom.title`, `zugaenglicherName`, `zoom`, `d044` — je 0 Treffer in
// 433 Produktdateien). Die Prüfung ist damit die geschärfte ABNAHMEREGEL für einen künftigen
// Belegtest, nicht sein Ersatz.
describe("JOB 1020 D13: die Beleg-Assertionskette entscheidet IM zentralen Wächter", () => {
  // Die drei Belegformen als reine TESTDATEN — die Logik kommt aus der gemeinsamen Implementierung.
  const ECHTE_ZWISCHENVARIABLE = [
    'it("D-044: der Zoomdialog traegt einen lokalisierten Namen", async () => {',
    "  const dialog = container.querySelector('[data-testid=\"editor-zoom\"]');",
    '  const ziel = dialog.getAttribute("aria-labelledby");',
    "  const name = zugaenglicherName(dialog);",
    "  expect(name.length).toBeGreaterThan(2);",
    '  expect(name).toBe(i18n.t("editor.zoom.title"));',
    "});",
  ].join("\n");

  const AUF_ZWEI_TESTS_VERTEILT = [
    'it("erster Test: Marker und Bindung an derselben Variablen", async () => {',
    "  const dialog = container.querySelector('[data-testid=\"editor-zoom\"]');",
    '  dialog.getAttribute("aria-labelledby");',
    "});",
    'it("zweiter Test: Aufloesung und Vergleich an derselben Variablen", async () => {',
    "  const name = zugaenglicherName(dialog);",
    "  expect(name.length).toBeGreaterThan(2);",
    '  expect(name).toBe(i18n.t("editor.zoom.title"));',
    "});",
  ].join("\n");

  const NAMENSAUFLOESUNG_AM_FREMDEN_ELEMENT = [
    'it("Marker richtig, Namensvergleich am fremden Element", async () => {',
    "  const dialog = container.querySelector('[data-testid=\"editor-zoom\"]');",
    '  dialog.getAttribute("aria-labelledby");',
    '  const anderes = container.querySelector("h1");',
    "  const name = zugaenglicherName(anderes);",
    "  expect(name.length).toBeGreaterThan(2);",
    '  expect(name).toBe(i18n.t("editor.zoom.title"));',
    "});",
  ].join("\n");

  it("BELEGKETTE · die echte Zwischenvariablenform wird ANGENOMMEN", () => {
    const befund = belegAssertionErfuellt(ECHTE_ZWISCHENVARIABLE, D044);
    expect(befund.bruchstelle, "die echte Form darf an keinem Glied reissen").toBe("");
    expect(befund.erfuellt).toBe(true);
  });

  it("BELEGKETTE · auf zwei it-Rümpfe verteilt bleibt der Kandidat ABGELEHNT", () => {
    // Die Kette ist inhaltlich lückenlos und benutzt sogar dieselbe Variable `dialog` — sie steht
    // nur in ZWEI Rümpfen. Ein Prüfer, der auf die ganze Quelldatei zurückfiele (das war der
    // D11-Fehler), gäbe genau hier fälschlich frei.
    expect(belegAssertionErfuellt(AUF_ZWEI_TESTS_VERTEILT, D044).erfuellt).toBe(false);
  });

  it("BELEGKETTE · Namensauflösung am fremden Element bleibt ABGELEHNT", () => {
    const befund = belegAssertionErfuellt(NAMENSAUFLOESUNG_AM_FREMDEN_ELEMENT, D044);
    expect(befund.erfuellt).toBe(false);
    // Und die Bruchstelle benennt das Glied, das gerissen ist — eine Ablehnung ohne Grund wäre
    // von einem stillen Fehlschlag nicht zu unterscheiden.
    expect(befund.bruchstelle).toContain("zugaenglicherName");
  });

  it("BELEGKETTE · die Kettenprüfung steht GENAU EINMAL im Bestand", () => {
    // Die Zusage aus Pflicht 1: „Nach diesem Durchgang darf es die Logik nicht mehr zweimal geben."
    // Gezählt wird über den ganzen Testbaum, nicht nur über die zwei bekannten Dateien — sonst
    // entstünde eine dritte Kopie unbemerkt.
    const dateien: string[] = [];
    const sammle = (verzeichnis: string): void => {
      for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
        if (eintrag.name === "node_modules" || eintrag.name.startsWith(".")) {
          continue;
        }
        const relativ = join(verzeichnis, eintrag.name);
        if (eintrag.isDirectory()) {
          sammle(relativ);
        } else if (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) {
          dateien.push(relativ);
        }
      }
    };
    sammle("tests");

    const definitionen = dateien.filter((d) =>
      /function\s+belegAssertionErfuellt\s*\(/.test(readFileSync(join(WURZEL, d), "utf8")),
    );
    expect(
      definitionen.map(posix),
      "die Kettenprüfung ist mehr als einmal definiert — genau das schliesst Pflicht 1 aus",
    ).toEqual(["tests/app/mega47-modale-flaechen-sammler.test.tsx"]);
  });

  // ==============================================================================================
  // KALIBRIERUNG — der vollständige D12-Bestand, jetzt an der ausgeführten Implementierung.
  // ==============================================================================================
  // P1 ist textgleich mit `ECHTE_ZWISCHENVARIABLE` oben — die Form wird deshalb NICHT ein zweites
  // Mal hingeschrieben. Zwei Fassungen derselben Belegform könnten auseinanderlaufen, und dann
  // prüften Kalibrierung und BEN-Fall verschiedene Dinge unter demselben Namen.
  const P2_DIREKT = `
it("D-044: derselbe Beleg, ohne Zwischenvariable", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
  expect(zugaenglicherName(dialog)).toBeTruthy();
  expect(zugaenglicherName(dialog)).toBe(i18n.t("editor.zoom.title"));
});
`;

  const N1_ZWEI_TESTS = `
it("erster Test: Marker und Bindung", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
});
it("zweiter Test: Namensvergleich", async () => {
  const name = zugaenglicherName(irgendetwas);
  expect(name.length).toBeGreaterThan(2);
  expect(name).toBe(i18n.t("editor.zoom.title"));
});
`;

  const N3_OHNE_NICHTLEERHEIT = `
it("Kette ohne Nichtleerheitsaussage", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
  const name = zugaenglicherName(dialog);
  expect(name).toBe(i18n.t("editor.zoom.title"));
});
`;

  const N4_AUFGEBROCHENE_VARIABLE = `
it("Zwischenvariable aufgebrochen: verglichen wird ein anderer Wert", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
  const name = zugaenglicherName(dialog);
  const anderer = textVon(container.querySelector("h1"));
  expect(anderer.length).toBeGreaterThan(2);
  expect(anderer).toBe(i18n.t("editor.zoom.title"));
});
`;

  const N5_NUR_WOERTER = `
// Ein Kommentar mit [data-testid="editor-zoom"], aria-labelledby, zugaenglicherName
// und editor.zoom.title — alle vier Woerter, keine einzige Beziehung.
it("nur Woerter, keine Kette", async () => {
  expect(true).toBe(true);
});
`;

  it("P1 · die ECHTE Form mit Zwischenvariable wird als zusammenhängender Beleg erkannt", () => {
    const befund = belegAssertionErfuellt(ECHTE_ZWISCHENVARIABLE, D044);
    expect(befund.bruchstelle).toBe("");
    expect(befund.erfuellt).toBe(true);
  });

  it("P2 · die direkte Form ohne Zwischenvariable wird ebenfalls erkannt", () => {
    expect(belegAssertionErfuellt(P2_DIREKT, D044).erfuellt).toBe(true);
  });

  it("N1 · zwei getrennte Testfälle ergeben KEINEN Beleg, auch wenn ihre Summe alles enthält", () => {
    expect(belegAssertionErfuellt(N1_ZWEI_TESTS, D044).erfuellt).toBe(false);
  });

  it("N3 · fehlende Nichtleerheitsaussage am selben Namenswert ergibt KEINEN Beleg", () => {
    const befund = belegAssertionErfuellt(N3_OHNE_NICHTLEERHEIT, D044);
    expect(befund.erfuellt).toBe(false);
    expect(befund.bruchstelle).toContain("Nichtleerheitsaussage");
  });

  it("N4 · aufgebrochene Zwischenvariable ergibt KEINEN Beleg", () => {
    expect(belegAssertionErfuellt(N4_AUFGEBROCHENE_VARIABLE, D044).erfuellt).toBe(false);
  });

  it("N5 · vier Wörter ohne jede Beziehung ergeben KEINEN Beleg", () => {
    expect(belegAssertionErfuellt(N5_NUR_WOERTER, D044).erfuellt).toBe(false);
  });

  it("D10-Nachbau gibt N1, N4 und N5 fälschlich frei — die integrierte Prüfung nicht", () => {
    for (const [name, quelle] of [
      ["N1 zwei Tests", N1_ZWEI_TESTS],
      ["N2 fremdes Element", NAMENSAUFLOESUNG_AM_FREMDEN_ELEMENT],
      ["N4 aufgebrochene Variable", N4_AUFGEBROCHENE_VARIABLE],
      ["N5 nur Wörter", N5_NUR_WOERTER],
    ] as const) {
      expect(wortpruefungD10(quelle, D044), `${name}: D10-Nachbau muss freigeben`).toBe(true);
      expect(
        belegAssertionErfuellt(quelle, D044).erfuellt,
        `${name}: die integrierte Prüfung muss ablehnen`,
      ).toBe(false);
    }
  });

  it("und beide sind sich bei den echten Formen einig", () => {
    for (const quelle of [ECHTE_ZWISCHENVARIABLE, P2_DIREKT]) {
      expect(wortpruefungD10(quelle, D044)).toBe(true);
      expect(belegAssertionErfuellt(quelle, D044).erfuellt).toBe(true);
    }
  });

  it("N1 bleibt auch dann rot, wenn beide Tests in derselben Datei stehen", () => {
    // Genau das war der D11-Rückfall: `pruefeTestfall(sf)` auf die komplette Quelldatei.
    const zusammen = `${N1_ZWEI_TESTS}\n${N5_NUR_WOERTER}`;
    expect(belegAssertionErfuellt(zusammen, D044).erfuellt).toBe(false);
  });

  it("eine Datei ganz ohne it/test-Rumpf ist rot und sagt auch, warum", () => {
    const befund = belegAssertionErfuellt("const x = 1;", D044);
    expect(befund.erfuellt).toBe(false);
    expect(befund.bruchstelle).toBe("kein ausgefuehrter it/test-Rumpf");
  });
});

// ================================================================================================
// JOB 1181 · D1 — BLOCK F: DIE VIERTE A17-FORM. MODALITÄT, DEREN ZEICHENFOLGE NICHT IN DER DATEI
// STEHT — UND DER DRITTE ZUSTAND `UNAUFGELÖST`, DAMIT NICHTS MEHR STILL DURCHFÄLLT.
// ================================================================================================
//
// BEFUND ZUERST, WEIL ER DIE RICHTUNG DES AUFTRAGS ÄNDERT. Register A17 sagt, der Modal-Sammler sei
// „ein statischer Musterwächter, kein AST-Wächter". GEMESSEN am heutigen Stand dieser Datei ist das
// für DREI der vier genannten Formen überholt — mega72 hat die Erhebung auf den Syntaxbaum gestellt
// (`ts.createSourceFile` in `quelleAus`), und JOB 1130 hat jede Form mit einem Negativ-Zwilling
// unterlegt. Die Belegstellen stehen in Block G unten, damit sie mitlaufen statt in einer Rückgabe
// zu verwelken. Die VIERTE Form — „Modalität ohne die Zeichenfolge" — steht dagegen wirklich offen,
// und sie ist die einzige, die man nicht durch schärferes Hinsehen auf DIESE Datei erledigen kann:
// die tragende Zeichenfolge existiert in ihr gar nicht.
//
// DREI BAUWEGE, alle drei am echten Baum vermessen (397 Quelldateien, 257 `className`-Bindungen):
//
//   F-a  Die deckende Klasse steht in einem ANDEREN MODUL: `className={TONE[stufe]}`, wobei `TONE`
//        importiert ist. Der gestrippte Text dieser Datei enthält `fixed inset-0` nirgends —
//        `spanntVollflaecheAuf` liefert `false`, und zwar STILL.
//   F-b  Die Klasse steht in einem STYLESHEET (`.module.css`) und wird nur importiert. Gemessen:
//        heute NULL im Baum — der Fall wird deshalb an einem echten temporären Baum gefahren, den
//        derselbe Scanner liest (BENs zweite Prüflücke zu D3, wörtlich).
//   F-c  Die Klasse kommt von AUSSEN als Prop oder aus einem berechneten Zugriff. Sie ist
//        grundsätzlich nicht statisch auflösbar.
//
// DIE ANTWORT IST NICHT „schärfer raten". Für F-a wird MODULÜBERGREIFEND AUFGELÖST: der Sammler
// schlägt den importierten Bezeichner in der Erhebung des Zielmoduls nach und nimmt dessen
// Zeichenketten in den Flächentext auf. Was danach übrig bleibt — F-c und alles Berechnete —, wird
// als UNAUFGELÖST GEMELDET, mit Datei, Zeile und Ausdruck. Kein drittes, stilles Ergebnis.
//
// DIE ZWEITEILUNG IST DIE ZUSAGE (Bauform übernommen aus BASIC2 JOB 1173 D1, Fail-Closed-Sammler):
//     jede Klassenbindung  ==  aufgelöst  +  unaufgelöst
// Die Summe wird geprüft. Fiele eine Bindung aus BEIDEN Mengen, wäre der Sammler wieder grün, ohne
// etwas zu belegen — und genau das ist die Fehlerklasse, vor der A17 warnt.

/** Wo eine Klassenbindung steht und woraus sie sich speist. */
interface Klassenbindung {
  datei: string;
  zeile: number;
  /** Der Ausdruck, wie er im Code steht — gekürzt, damit die Meldung lesbar bleibt. */
  ausdruck: string;
  /** Zeichenketten, die der Sammler auflösen konnte: lokal literal ODER im Zielmodul nachgeschlagen. */
  aufgeloest: string[];
  /** Bestandteile, deren Wert statisch nicht feststeht — Props, Parameter, berechnete Zugriffe. */
  offen: string[];
  /** Woher die aufgelösten Teile kamen: leer, wenn alles literal in dieser Datei stand. */
  ausModulen: string[];
}

/** Modulindex: Dateipfad → Erhebung. Ohne ihn bliebe die Auflösung eine Behauptung. */
function baueModulindex(erhebungen: DateiErhebung[]): Map<string, DateiErhebung> {
  const index = new Map<string, DateiErhebung>();
  for (const e of erhebungen) {
    index.set(e.quelle.datei, e);
  }
  return index;
}

/** `../lib/x` von `apps/web/src/pages/A.tsx` aus → `apps/web/src/lib/x.ts` (oder `.tsx`, oder `/index.ts`). */
function loeseImportpfad(vonDatei: string, spezifizierer: string): string[] {
  if (!spezifizierer.startsWith(".")) {
    return [];
  }
  const teile = vonDatei.split("/").slice(0, -1);
  for (const stueck of spezifizierer.split("/")) {
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
  return [`${basis}.ts`, `${basis}.tsx`, `${basis}/index.ts`, `${basis}/index.tsx`, basis];
}

/** Alle Zeichenketten unter einem Knoten — die Rohmasse, aus der eine Klassenliste besteht. */
function zeichenkettenUnter(n: ts.Node): string[] {
  const gefunden: string[] = [];
  const gehe = (k: ts.Node): void => {
    if (ts.isStringLiteral(k) || k.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
      gefunden.push((k as ts.StringLiteral).text);
    } else if (
      k.kind === ts.SyntaxKind.TemplateHead ||
      k.kind === ts.SyntaxKind.TemplateMiddle ||
      k.kind === ts.SyntaxKind.TemplateTail
    ) {
      gefunden.push((k as ts.TemplateHead).text);
    }
    ts.forEachChild(k, gehe);
  };
  gehe(n);
  return gefunden;
}

/**
 * Der Wert eines Bezeichners im Zielmodul, als Zeichenkettenmenge. Eine Ebene tief und nicht
 * weiter: das ist belegbar und begrenzt. Reicht die eine Ebene nicht, bleibt der Bezeichner offen —
 * er verschwindet nicht.
 *
 * DIE FUNKTIONSDEKLARATION IST HIER NICHT OPTIONAL, sondern der eigentliche Fall. Gemessen am
 * heutigen Baum liegen ALLE NEUN modulfremden Klassenquellen in einer Funktion und in keiner
 * Konstanten: `priorityTone`, `evidenceKindTone`, `kiStateTone`, `modelRunStatusTone`,
 * `importCandidateStatusTone`, `evidenceFreshnessTone`, `isExpertMode`, `isRecommendedMode`,
 * `useReadiness`. Wer nur `const` nachschlägt, löst am echten Bestand exakt NICHTS auf und hält
 * das für einen Befund über den Baum — es wäre einer über den Sucher.
 *
 * RÜCKGABE-SEMANTIK, und sie trägt die Zweiteilung: `null` heisst „Deklaration nicht gefunden" und
 * führt in OFFEN. Ein LEERES Feld heisst „gefunden und ausgewertet, trägt nachweislich keine
 * Zeichenkette" — das ist ein Ergebnis, kein Zweifel, und zählt als aufgelöst.
 */
function werteImZielmodul(ziel: DateiErhebung, name: string): string[] | null {
  const sf = ziel.quelle.ast;
  let treffer: string[] | null = null;
  const gehe = (n: ts.Node): void => {
    if (treffer !== null) {
      return;
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
      treffer = n.initializer ? zeichenkettenUnter(n.initializer) : [];
      return;
    }
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) {
      treffer = n.body ? zeichenkettenUnter(n.body) : [];
      return;
    }
    if (ts.isEnumDeclaration(n) && n.name.text === name) {
      treffer = zeichenkettenUnter(n);
      return;
    }
    ts.forEachChild(n, gehe);
  };
  gehe(sf);
  return treffer;
}

/** Namen, die als AUFRUF eine Klassenliste zusammensetzen — sie tragen selbst keine Klasse. */
const KLASSENFUEGER = new Set(["cx", "cn", "clsx", "classNames", "twMerge", "join"]);

/**
 * Die Klassenbindungen einer Datei, jede in aufgelöst und offen zerlegt. AM SYNTAXBAUM: nur echte
 * `className`-Attribute und `createElement(…, { className })` — eine Erwähnung in Prosa ist keine
 * Bindung, und ein `data-className` ist keine.
 */
function klassenbindungen(e: DateiErhebung, index: Map<string, DateiErhebung>): Klassenbindung[] {
  const sf = e.quelle.ast;
  const funde: Klassenbindung[] = [];

  // Importierte Bezeichner dieser Datei: Name → Modulpfad.
  const herkunft = new Map<string, string>();
  const gehe0 = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const spez = n.moduleSpecifier.text;
      const c = n.importClause;
      if (c?.name) {
        herkunft.set(c.name.text, spez);
      }
      if (c?.namedBindings) {
        if (ts.isNamedImports(c.namedBindings)) {
          for (const s of c.namedBindings.elements) {
            herkunft.set(s.name.text, spez);
          }
        } else {
          herkunft.set(c.namedBindings.name.text, spez);
        }
      }
    }
    ts.forEachChild(n, gehe0);
  };
  gehe0(sf);

  // Lokal deklarierte Namen mit literalem Wert — sie sind in DIESER Datei auflösbar.
  const lokal = new Map<string, string[]>();
  const gehe1 = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      lokal.set(n.name.text, zeichenkettenUnter(n.initializer));
    }
    ts.forEachChild(n, gehe1);
  };
  gehe1(sf);

  const zerlege = (ausdruck: ts.Node, zeile: number): void => {
    const aufgeloest: string[] = [];
    const offen: string[] = [];
    const ausModulen: string[] = [];

    const gehe = (k: ts.Node): void => {
      if (ts.isStringLiteral(k) || k.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
        aufgeloest.push((k as ts.StringLiteral).text);
        return;
      }
      if (
        k.kind === ts.SyntaxKind.TemplateHead ||
        k.kind === ts.SyntaxKind.TemplateMiddle ||
        k.kind === ts.SyntaxKind.TemplateTail
      ) {
        aufgeloest.push((k as ts.TemplateHead).text);
        return;
      }
      if (ts.isIdentifier(k)) {
        const name = k.text;
        if (KLASSENFUEGER.has(name)) {
          return;
        }
        const lokalerWert = lokal.get(name);
        if (lokalerWert !== undefined && lokalerWert.length > 0) {
          aufgeloest.push(...lokalerWert);
          return;
        }
        const spez = herkunft.get(name);
        if (spez !== undefined) {
          for (const kandidat of loeseImportpfad(e.quelle.datei, spez)) {
            const ziel = index.get(kandidat);
            if (ziel === undefined) {
              continue;
            }
            const werte = werteImZielmodul(ziel, name);
            if (werte !== null) {
              aufgeloest.push(...werte);
              ausModulen.push(`${name} ← ${kandidat}`);
              return;
            }
          }
        }
        offen.push(name);
        return;
      }
      ts.forEachChild(k, gehe);
    };
    gehe(ausdruck);

    funde.push({
      datei: e.quelle.datei,
      zeile,
      ausdruck: ausdruck.getText(sf).replace(/\s+/g, " ").slice(0, 80),
      aufgeloest,
      offen,
      ausModulen,
    });
  };

  const gehe2 = (n: ts.Node): void => {
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name) && n.name.text === "className") {
      const init = n.initializer;
      if (init && ts.isJsxExpression(init) && init.expression) {
        zerlege(init.expression, zeileVon(sf, n));
      }
    }
    // `createElement(X, { className: … })` — dieselbe Bindung, andere Schreibweise.
    if (ts.isCallExpression(n) && aufrufName(n) === "createElement") {
      for (const arg of n.arguments) {
        if (!ts.isObjectLiteralExpression(arg)) {
          continue;
        }
        for (const eig of arg.properties) {
          if (
            ts.isPropertyAssignment(eig) &&
            (ts.isIdentifier(eig.name) || ts.isStringLiteral(eig.name)) &&
            eig.name.text === "className"
          ) {
            zerlege(eig.initializer, zeileVon(sf, eig));
          }
        }
      }
    }
    ts.forEachChild(n, gehe2);
  };
  gehe2(sf);
  return funde;
}

/**
 * DER FLÄCHENTEXT, GEGEN DEN GEPRÜFT WIRD — gestrippte Quelle PLUS alles, was modulübergreifend
 * aufgelöst wurde. Genau hier wird A17s vierte Form eingesammelt: eine Fläche, deren `fixed inset-0`
 * in einem anderen Modul steht, ist ab jetzt sichtbar.
 */
function flaechentext(e: DateiErhebung, index: Map<string, DateiErhebung>): string {
  const zusatz = klassenbindungen(e, index)
    .filter((b) => b.ausModulen.length > 0)
    .flatMap((b) => b.aufgeloest);
  return zusatz.length === 0 ? e.quelle.gestrippt : `${e.quelle.gestrippt}\n${zusatz.join(" ")}`;
}

const MODULINDEX = baueModulindex(ALLE_ERHEBUNGEN);
const ALLE_BINDUNGEN: Klassenbindung[] = ALLE_ERHEBUNGEN.flatMap((e) =>
  klassenbindungen(e, MODULINDEX),
);
const AUFGELOEST_VOLLSTAENDIG = ALLE_BINDUNGEN.filter((b) => b.offen.length === 0);
const UNAUFGELOEST = ALLE_BINDUNGEN.filter((b) => b.offen.length > 0);

// ------------------------------------------------------------------------------------------------
// BLOCK G — DER REGISTERBEFUND ZU A17, ALS LAUFENDER TEST STATT ALS SATZ IN EINER RÜCKGABE.
// ------------------------------------------------------------------------------------------------
//
// A17 nennt vier Formen. Drei davon sind seit mega72/JOB 1130 erfasst, und zwar mit Negativ-
// Zwilling — die Erkennung hängt nachweislich am tragenden Merkmal und nicht am Zufall. Diese
// Belege stehen hier NOCH EINMAL in einer Form, die A17 direkt beantwortet: eine Rückgabe verwelkt,
// ein Test läuft jeden Tag mit. Wer eine dieser Formen später aus der Erhebung nimmt, macht diesen
// Block rot — und dann stimmt A17 wieder, statt nur so auszusehen.
describe("JOB 1181 · Register A17: welche der vier Formen der Sammler HEUTE erfasst", () => {
  const BAUTEIL: Bauteil = {
    datei: "apps/web/src/components/FacetFilter.tsx",
    komponente: "FacetFilter",
  };
  const synth = (datei: string, zeilen: string[]): DateiErhebung =>
    erhebeDatei(quelleAus(datei, zeilen.join("\n")));

  it("die Erhebung läuft über den SYNTAXBAUM, nicht über Zeichenfolgen — belegt am Verhalten", () => {
    // Der Beleg ist nicht der Import von `typescript`, sondern eine Unterscheidung, die NUR ein
    // Baum treffen kann: derselbe Text, einmal als Code und einmal als Zeichenkette.
    const alsCode = synth("apps/web/src/components/G1Code.tsx", [
      "export function F(): JSX.Element {",
      '  return <div aria-modal="true" />;',
      "}",
    ]);
    const alsText = synth("apps/web/src/lib/g1Text.ts", [
      "export const HINWEIS = '<div aria-modal=\"true\" />';",
    ]);
    expect(alsCode.kandidaten.map((k) => k.art)).toEqual(["aria-modal-attribut"]);
    expect(
      alsText.kandidaten,
      "identische Zeichenfolge, aber als Zeichenkette — ein Musterwächter fände sie, ein Baum nicht",
    ).toEqual([]);
    // Und sie fällt trotzdem nicht still durch: der unabhängige Zähler rechnet sie als Prosa ab.
    expect(modalAbgleich(alsText)).toEqual([]);
  });

  it("A17-FORM 1 (Alias-Nutzung): ERFASST — mit Negativ-Zwilling", () => {
    const mit = synth("apps/web/src/pages/G2Alias.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      "const Anders = FacetFilter;",
      "export const S = <Anders />;",
    ]);
    expect(erhebeVerweise([mit], [BAUTEIL]).paare.map(schluessel)).toEqual([
      "apps/web/src/pages/G2Alias.tsx → <FacetFilter>",
    ]);
    const ohne = synth("apps/web/src/pages/G2OhneAlias.tsx", [
      'import { FacetFilter } from "../components/FacetFilter";',
      "const Anders = () => null;",
      "export const S = <Anders />;",
    ]);
    expect(
      erhebeVerweise([ohne], [BAUTEIL]).paare,
      "die Erkennung hängt an der Aliaskette",
    ).toEqual([]);
  });

  it("A17-FORM 2 (createElement): ERFASST — als Einbindung UND als Modalitätskandidat", () => {
    const einbindung = synth("apps/web/src/pages/G3Create.tsx", [
      'import { createElement } from "react";',
      'import { FacetFilter } from "../components/FacetFilter";',
      "export const S = createElement(FacetFilter, null);",
    ]);
    expect(erhebeVerweise([einbindung], [BAUTEIL]).paare.map(schluessel)).toEqual([
      "apps/web/src/pages/G3Create.tsx → <FacetFilter>",
    ]);
    const nativ = synth("apps/web/src/lib/g3Nativ.ts", [
      'import { createElement } from "react";',
      'export const D = createElement("dialog", null);',
    ]);
    expect(nativ.kandidaten.map((k) => k.art)).toContain("dialog-createElement");
  });

  it("A17-FORM 3 (Spread-gesetztes aria-modal): ERFASST — mit Negativ-Zwilling", () => {
    const mit = synth("apps/web/src/components/G4Spread.tsx", [
      'const p = { "aria-modal": "true" };',
      "export const F = <div {...p} />;",
    ]);
    expect(mit.kandidaten.map((k) => k.art)).toEqual(["aria-modal-eigenschaft"]);
    const ohne = synth("apps/web/src/components/G4OhneSpread.tsx", [
      'const p = { "data-x": "true" };',
      "export const F = <div {...p} />;",
    ]);
    expect(ohne.kandidaten, "ein Spread ohne den Marker ist kein Kandidat").toEqual([]);
  });

  it("A17-FORM 4 (Modalität ohne die Zeichenfolge): NICHT durch Marker erfassbar — sie ist der Bau", () => {
    // Der Beleg für die Lücke, und er ist das Gegenstück zu den drei Fällen darüber: KEIN Marker,
    // KEINE Vollflächenklasse im Text dieser Datei — und deshalb sieht die markergestützte Erhebung
    // hier nichts, völlig zu Recht. Was sie sehen MÜSSTE, steht in einem anderen Modul.
    const traeger = synth("apps/web/src/components/G5Fremdklasse.tsx", [
      'import { schirmklasse } from "../lib/g5schirm";',
      "export function Fenster(): JSX.Element {",
      "  return <div className={schirmklasse()} />;",
      "}",
    ]);
    expect(traeger.kandidaten, "kein Marker in dieser Datei").toEqual([]);
    expect(
      spanntVollflaecheAuf(traeger.quelle.gestrippt),
      "und keine Vollflächenklasse — der gestrippte Text dieser Datei enthält sie schlicht nicht",
    ).toBe(false);
    expect(wirkungssignale(traeger.quelle.gestrippt), "auch die zweite Richtung ist blind").toEqual(
      [],
    );
  });
});

// ------------------------------------------------------------------------------------------------
// BLOCK H — DIE ZWEITEILUNG: JEDE KLASSENBINDUNG IST AUFGELÖST ODER GEMELDET.
// ------------------------------------------------------------------------------------------------
describe("JOB 1181 · Klassenbindungen: aufgelöst oder gemeldet, kein dritter Zustand", () => {
  it("ERHALTUNGSZUSAGE: aufgelöst + unaufgelöst == alle Bindungen (keine fällt aus beiden)", () => {
    // Die Zusage aus BASIC2 JOB 1173 D1, hier auf Klassenbindungen angewandt. Ohne sie könnte eine
    // Bindung aus BEIDEN Mengen fallen — und der Sammler bliebe grün, ohne etwas zu belegen.
    expect(AUFGELOEST_VOLLSTAENDIG.length + UNAUFGELOEST.length).toBe(ALLE_BINDUNGEN.length);
    // Und die beiden Mengen überschneiden sich nicht: das Merkmal ist dasselbe, nur negiert.
    const schluesselVon = (b: Klassenbindung): string => `${b.datei}:${b.zeile}:${b.ausdruck}`;
    const inA = new Set(AUFGELOEST_VOLLSTAENDIG.map(schluesselVon));
    expect(UNAUFGELOEST.filter((b) => inA.has(schluesselVon(b)))).toEqual([]);
  });

  it("ein UNABHÄNGIGER Rohzähler anderer Bauart bestätigt die Grundmenge", () => {
    // Anderer Bau, nicht dieselbe Funktion zweimal: ein Zeichenscanner über den gestrippten Text,
    // der `className=` zählt, ohne den Baum zu befragen. Er darf MEHR finden (Zeichenketten,
    // durchgereichte Attribute ohne Ausdruck), aber niemals WENIGER als die Baumerhebung.
    let roh = 0;
    for (const e of ALLE_ERHEBUNGEN) {
      roh += (e.quelle.gestrippt.match(/className\s*=/g) ?? []).length;
    }
    expect(
      roh,
      `Der Zeichenscanner findet ${roh} Stellen, die Baumerhebung ${ALLE_BINDUNGEN.length}. Findet der Baum MEHR, liest einer von beiden falsch.`,
    ).toBeGreaterThanOrEqual(ALLE_BINDUNGEN.length);
  });

  it("die unaufgelösten Bindungen werden MIT DATEI, ZEILE UND AUSDRUCK gemeldet", () => {
    // Der Kern des Auftrags: „jede der vier Formen wird ERFASST oder als UNAUFGELÖST gemeldet —
    // kein stilles Durchfallen". Eine Meldung ohne Fundstelle wäre wieder ein stilles Durchfallen,
    // nur mit Zahl. Jede Meldung trägt deshalb den Ort.
    expect(UNAUFGELOEST.length, "es gibt heute unauflösbare Bindungen — das ist der Befund").toBe(
      207,
    );
    for (const b of UNAUFGELOEST) {
      expect(b.datei, "Meldung ohne Datei").toMatch(/^apps\/web\/src\/.+\.tsx?$/);
      expect(b.zeile, `${b.datei}: Meldung ohne Zeile`).toBeGreaterThan(0);
      expect(b.ausdruck.length, `${b.datei}:${b.zeile}: Meldung ohne Ausdruck`).toBeGreaterThan(0);
      expect(
        b.offen.length,
        `${b.datei}:${b.zeile}: als offen geführt, ohne offenen Teil`,
      ).toBeGreaterThan(0);
    }
  });

  it("KALIBRIERUNG: eine vollständig literale Bindung wird NICHT gemeldet (sonst meldete er alles)", () => {
    const index = baueModulindex([]);
    const literal = erhebeDatei(
      quelleAus(
        "apps/web/src/components/H1Literal.tsx",
        ['export const F = <div className={"fixed inset-0 bg-ink/50"} />;'].join("\n"),
      ),
    );
    const bindungen = klassenbindungen(literal, index);
    expect(bindungen).toHaveLength(1);
    expect(bindungen[0]?.offen, "alles literal ⇒ nichts offen").toEqual([]);
    expect(bindungen[0]?.aufgeloest).toContain("fixed inset-0 bg-ink/50");
  });

  it("KALIBRIERUNG: `cx(…)` selbst ist kein offener Teil — der Fügername trägt keine Klasse", () => {
    const index = baueModulindex([]);
    const e = erhebeDatei(
      quelleAus(
        "apps/web/src/components/H2Cx.tsx",
        ['export const F = <div className={cx("fixed", "inset-0")} />;'].join("\n"),
      ),
    );
    const b = klassenbindungen(e, index)[0];
    expect(b?.offen, "sonst wäre jede zusammengesetzte Klassenliste unauflösbar").toEqual([]);
    expect(b?.aufgeloest.sort()).toEqual(["fixed", "inset-0"]);
  });
});

// ------------------------------------------------------------------------------------------------
// BLOCK I — F-a: DIE KLASSE LIEGT IN EINEM ANDEREN MODUL. JETZT WIRD SIE GELESEN.
// ------------------------------------------------------------------------------------------------
describe("JOB 1181 · A17-Form 4a: modulübergreifende Auflösung der tragenden Klasse", () => {
  /** Zwei Module als Paar — der Träger und das Modul, in dem seine Klasse wirklich steht. */
  function paar(
    traegerZeilen: string[],
    zielZeilen: string[],
  ): {
    traeger: DateiErhebung;
    index: Map<string, DateiErhebung>;
  } {
    const ziel = erhebeDatei(quelleAus("apps/web/src/lib/i1schirm.ts", zielZeilen.join("\n")));
    const traeger = erhebeDatei(
      quelleAus("apps/web/src/components/I1Traeger.tsx", traegerZeilen.join("\n")),
    );
    return { traeger, index: baueModulindex([ziel, traeger]) };
  }

  const TRAEGER_MIT_IMPORT = [
    'import { SCHIRM } from "../lib/i1schirm";',
    "export function Fenster(): JSX.Element {",
    "  return <div className={SCHIRM} />;",
    "}",
  ];

  it("VORHER-BELEG: ohne Auflösung geht der Träger DURCH — die alte Sicht bleibt grün", () => {
    // §6 des Auftrags wörtlich: „Der Träger geht durch, der Sammler bleibt grün, obwohl er greifen
    // müsste." Genau das wird hier festgehalten, und zwar dauerhaft: `spanntVollflaecheAuf` auf dem
    // GESTRIPPTEN TEXT — die Sicht, die bis zu diesem Durchgang die einzige war — sieht nichts.
    const { traeger } = paar(TRAEGER_MIT_IMPORT, [
      'export const SCHIRM = "fixed inset-0 bg-ink/60";',
    ]);
    expect(
      spanntVollflaecheAuf(traeger.quelle.gestrippt),
      "die alte Sicht ist blind — und das ist der Grund für diesen Bau",
    ).toBe(false);
    expect(unregistrierteVollflaechen([traeger], BAUTEILE), "und meldet nichts").toEqual([]);
  });

  it("NACHHER: über den Modulindex wird dieselbe Fläche ERFASST", () => {
    const { traeger, index } = paar(TRAEGER_MIT_IMPORT, [
      'export const SCHIRM = "fixed inset-0 bg-ink/60";',
    ]);
    const text = flaechentext(traeger, index);
    expect(text, "der Flächentext trägt jetzt die Klasse aus dem Zielmodul").toContain(
      "fixed inset-0",
    );
    expect(spanntVollflaecheAuf(text), "und damit spannt sie eine Vollfläche auf").toBe(true);
    expect(verdecktDenHintergrund(text), "und verdeckt den Hintergrund").toBe(true);
  });

  it("NEGATIV-ZWILLING: dieselbe Bauform, das Zielmodul trägt KEINE Vollfläche — kein Fund", () => {
    // Ohne diesen Fall wäre der Fund oben auch dann grün, wenn die Auflösung pauschal alles
    // einsammelte. Die Erkennung muss am INHALT des Zielmoduls hängen, nicht an der Bauform.
    const { traeger, index } = paar(TRAEGER_MIT_IMPORT, [
      'export const SCHIRM = "rounded-card border px-3 py-2";',
    ]);
    const text = flaechentext(traeger, index);
    expect(text).toContain("rounded-card");
    expect(spanntVollflaecheAuf(text), "ein Kärtchen ist keine Vollfläche").toBe(false);
  });

  it("NEGATIV-ZWILLING 2: der Import fehlt — dann gibt es nichts aufzulösen, und es wird gemeldet", () => {
    const ziel = erhebeDatei(
      quelleAus("apps/web/src/lib/i1schirm.ts", 'export const SCHIRM = "fixed inset-0 bg-ink/60";'),
    );
    const ohneImport = erhebeDatei(
      quelleAus(
        "apps/web/src/components/I1Ohne.tsx",
        [
          "export function Fenster(): JSX.Element {",
          "  return <div className={SCHIRM} />;",
          "}",
        ].join("\n"),
      ),
    );
    const index = baueModulindex([ziel, ohneImport]);
    expect(spanntVollflaecheAuf(flaechentext(ohneImport, index)), "nichts aufgelöst").toBe(false);
    // ABER: er fällt nicht still durch. `SCHIRM` steht als offener Teil in der Meldung.
    const b = klassenbindungen(ohneImport, index)[0];
    expect(b?.offen, "der unauflösbare Bezeichner wird benannt").toEqual(["SCHIRM"]);
  });

  it("die Auflösung greift auch bei einer FUNKTION im Zielmodul (so liegt es im echten Baum)", () => {
    const ziel = erhebeDatei(
      quelleAus(
        "apps/web/src/lib/i1schirm.ts",
        [
          "export function schirmklasse(voll: boolean): string {",
          '  return voll ? "fixed inset-0 bg-ink/60" : "hidden";',
          "}",
        ].join("\n"),
      ),
    );
    const traeger = erhebeDatei(
      quelleAus(
        "apps/web/src/components/I2Traeger.tsx",
        [
          'import { schirmklasse } from "../lib/i1schirm";',
          "export const F = <div className={schirmklasse(true)} />;",
        ].join("\n"),
      ),
    );
    const index = baueModulindex([ziel, traeger]);
    expect(spanntVollflaecheAuf(flaechentext(traeger, index))).toBe(true);
  });

  it("AM ECHTEN BESTAND: die modulfremden Klassenquellen sind namentlich belegt", () => {
    const ausModulen = ALLE_BINDUNGEN.filter((b) => b.ausModulen.length > 0);
    const quellen = [...new Set(ausModulen.flatMap((b) => b.ausModulen))].sort();
    // GEMESSEN am heutigen Baum: neun. Alle neun liegen in einer FUNKTION, keine in einer
    // Konstanten — wer nur `const` nachschlägt, löst hier exakt nichts auf und merkt es nicht.
    expect(
      quellen.length,
      `Modulfremde Klassenquellen: ${quellen.join(" · ")}`,
    ).toBeGreaterThanOrEqual(9);
    expect(quellen).toContain("priorityTone ← apps/web/src/lib/gapPriority.ts");
    expect(quellen).toContain("evidenceKindTone ← apps/web/src/lib/evidenceIndex.ts");
    expect(quellen).toContain("kiStateTone ← apps/web/src/lib/adminFirstRun.ts");
  });
});

// ------------------------------------------------------------------------------------------------
// BLOCK J — BENS DREI PRÜFLÜCKEN AUS DER D3-ABNAHME, AN EINEM BAUM, DEN DER SCANNER WIRKLICH LIEST.
// ------------------------------------------------------------------------------------------------
//
// BEN hat JOB 1093 D3 GRÜN beurteilt und drei Prüflücken benannt. Zwei davon verlangen ausdrücklich
// mehr als eine Funktionseingabe: eine TEMPORÄRE QUELLDATEI, die der Baumscanner tatsächlich liest.
// Bis zu diesem Durchgang war das nicht möglich, ohne eine Datei in `apps/web/src/` anzulegen — und
// der Lease dieses Durchgangs verbietet jeden Produktcode. Deshalb hat `quelldateien` seit heute
// einen Wurzelparameter (Standardwert unverändert `WURZEL`): der Scanner läuft über einen echten,
// wegwerfbaren Baum in `os.tmpdir()`, mit demselben Code, der den Produktbaum liest.
describe("JOB 1181 · BENs Prüflücken zu D3 — am echten Scannerlauf", () => {
  let baum = "";

  function lege(pfad: string, inhalt: string): void {
    const voll = join(baum, pfad);
    mkdirSync(join(voll, ".."), { recursive: true });
    writeFileSync(voll, inhalt, "utf8");
  }

  /** Derselbe Weg wie `ALLE_ERHEBUNGEN`, nur mit anderer Wurzel. */
  function erhebeBaum(): DateiErhebung[] {
    return quelldateien(join("apps", "web", "src"), baum).map((d) =>
      erhebeDatei(quelleAus(posix(d), readFileSync(join(baum, d), "utf8"))),
    );
  }

  beforeEach(() => {
    baum = mkdtempSync(join(tmpdir(), "kw1181-"));
    mkdirSync(join(baum, "apps", "web", "src"), { recursive: true });
  });

  afterEach(() => {
    rmSync(baum, { recursive: true, force: true });
  });

  it("PRÜFLÜCKE 2: ein Stylesheet mit position:fixed;inset:0 wird rot — MIT Regel UND Träger", () => {
    // BENs Wortlaut: „ein temporäres `Screen.module.css` mit `position: fixed; inset: 0` plus einem
    // importierenden unregistrierten Träger → die Stylesheet-Wache wird rot und nennt Regel und
    // Träger; nach der Registrierung bzw. der byteexakten Rücknahme ist sie wieder grün."
    lege(
      "apps/web/src/Screen.module.css",
      ".schirm {\n  position: fixed;\n  inset: 0;\n  background: rgba(0,0,0,.6);\n}\n",
    );
    lege(
      "apps/web/src/components/SchirmTraeger.tsx",
      [
        'import styles from "../Screen.module.css";',
        "export function Schirm(): JSX.Element {",
        "  return <div className={styles.schirm} />;",
        "}",
        "",
      ].join("\n"),
    );

    const erhebungen = erhebeBaum();
    expect(
      erhebungen.map((e) => e.quelle.datei),
      "der Scanner hat den Träger wirklich gelesen",
    ).toContain("apps/web/src/components/SchirmTraeger.tsx");

    const funde = stylesheetVollbildregeln(baum, join("apps", "web"), erhebungen);
    expect(funde, "die Stylesheet-Wache ist rot").toHaveLength(1);
    const fund = funde[0];
    expect(fund?.regel, "sie nennt die REGEL").toContain("position:fixed und Vollbildmass");
    expect(fund?.datei).toBe("apps/web/src/Screen.module.css");
    expect(fund?.zeile, "mit Zeile").toBeGreaterThan(0);
    expect(fund?.traeger, "und sie nennt den TRÄGER — das war bis heute die Lücke").toEqual([
      "apps/web/src/components/SchirmTraeger.tsx",
    ]);

    // UND: keine der beiden bisherigen Richtungen sieht diesen Träger. Genau darum ist die
    // Stylesheet-Wache kein Beiwerk, sondern der einzige Sucher in diesem Suchraum.
    const traeger = erhebungen.find(
      (e) => e.quelle.datei === "apps/web/src/components/SchirmTraeger.tsx",
    );
    const text = traeger?.quelle.gestrippt ?? "";
    expect(spanntVollflaecheAuf(text), "Richtung A ist blind").toBe(false);
    expect(wirktModalAmBestand(text), "Richtung B ist blind").toBe(false);
  });

  it("PRÜFLÜCKE 2 · GEGENPROBE: dasselbe Stylesheet OHNE Vollbildmass bleibt grün", () => {
    // Ohne diesen Fall wäre die Wache von „meldet jedes Stylesheet" nicht zu unterscheiden.
    lege("apps/web/src/Screen.module.css", ".leiste {\n  position: fixed;\n  bottom: 8px;\n}\n");
    lege(
      "apps/web/src/components/SchirmTraeger.tsx",
      'import styles from "../Screen.module.css";\nexport const S = <div className={styles.leiste} />;\n',
    );
    expect(stylesheetVollbildregeln(baum, join("apps", "web"), erhebeBaum())).toEqual([]);
  });

  it("PRÜFLÜCKE 2 · KALIBRIERUNG: eine Vollbildregel OHNE Träger wird gemeldet, aber ohne Träger", () => {
    // Ein Stylesheet, das niemand importiert, ist eine Fläche, die an nichts hängt. Der Unterschied
    // muss ablesbar sein — sonst liest sich „kein Träger" wie „nicht geprüft".
    lege("apps/web/src/Screen.module.css", ".schirm {\n  position: fixed;\n  inset: 0;\n}\n");
    const funde = stylesheetVollbildregeln(baum, join("apps", "web"), erhebeBaum());
    expect(funde).toHaveLength(1);
    expect(funde[0]?.traeger, "die Regel steht, aber kein Modul bindet sie ein").toEqual([]);
  });

  it("PRÜFLÜCKE 3: ein unregistrierter Wirkträger als GELESENE Quelldatei — der Abgleich wird rot", () => {
    // BENs Wortlaut: „ein unregistrierter Effektträger als tatsächlich vom Baumscanner gelesene
    // temporäre Quelldatei (nicht nur als Funktionseingabe) → der Gesamtabgleich meldet exakt
    // diesen unerklärten Restfall und geht rot."
    lege(
      "apps/web/src/components/HeimlicheSperre.tsx",
      [
        'import { useEffect } from "react";',
        "export function HeimlicheSperre({ offen }: { offen: boolean }): null {",
        "  useEffect(() => {",
        '    document.body.style.overflow = offen ? "hidden" : "";',
        "  }, [offen]);",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    );
    // Eine zweite, harmlose Datei, damit der Lauf nicht auf einer Ein-Datei-Menge grün wird.
    lege(
      "apps/web/src/components/Harmlos.tsx",
      'export const H = <div className="rounded-card p-3" />;\n',
    );

    const erhebungen = erhebeBaum();
    expect(erhebungen, "beide Dateien wurden vom SCANNER gelesen").toHaveLength(2);

    const rest = unregistrierteWirkflaechen(erhebungen, BAUTEILE);
    expect(
      rest,
      "der Abgleich meldet exakt den einen unerklärten Restfall — nicht mehr und nicht weniger",
    ).toEqual(["apps/web/src/components/HeimlicheSperre.tsx"]);

    // Und der Grund steht dabei: B3 Scrollsperre. Eine Meldung ohne Grund wäre nur eine Zahl.
    const traeger = erhebungen.find((e) => e.quelle.datei === rest[0]);
    expect(wirkungssignale(traeger?.quelle.gestrippt ?? "")).toContain("B3 Scrollsperre");
    // Richtung A sieht ihn nicht — kein `fixed`, keine vier Seiten, gar keine Fläche.
    expect(unregistrierteVollflaechen(erhebungen, BAUTEILE), "Richtung A ist blind").toEqual([]);
  });

  it("PRÜFLÜCKE 3 · GEGENPROBE: derselbe Träger OHNE die Wirkung bleibt draussen", () => {
    lege(
      "apps/web/src/components/HeimlicheSperre.tsx",
      [
        'import { useEffect } from "react";',
        "export function HeimlicheSperre({ offen }: { offen: boolean }): null {",
        "  useEffect(() => {",
        "    void offen;",
        "  }, [offen]);",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    );
    expect(unregistrierteWirkflaechen(erhebeBaum(), BAUTEILE)).toEqual([]);
  });

  it("PRÜFLÜCKE 1: eine erst zur Laufzeit entstehende Deckklasse wird UNAUFGELÖST gemeldet", () => {
    // BENs Wortlaut: „ein Träger, dessen deckende Klasse erst zur Laufzeit aus einer importierten
    // oder berechneten Variablen entsteht → die AST-/Render-Gegenrichtung findet ihn, ODER der Test
    // markiert ihn ausdrücklich als ausserhalb der statischen Aussage — niemals still grün."
    //
    // GEMESSEN: der berechnete Zugriff ist statisch NICHT auflösbar, und genau das wird gesagt.
    lege(
      "apps/web/src/components/BerechneterSchirm.tsx",
      [
        "export function Schirm({ stufe }: { stufe: string }): JSX.Element {",
        "  const tabelle = fremdeTabelle();",
        "  return <div className={tabelle[stufe]} />;",
        "}",
        "",
      ].join("\n"),
    );
    const erhebungen = erhebeBaum();
    const index = baueModulindex(erhebungen);
    const bindungen = erhebungen.flatMap((e) => klassenbindungen(e, index));
    expect(bindungen, "die Bindung wird erhoben").toHaveLength(1);
    expect(
      bindungen[0]?.offen,
      "und ausdrücklich als unauflösbar geführt — nicht als eine Datei ohne Fläche verbucht",
    ).toContain("tabelle");
    expect(bindungen[0]?.aufgeloest, "es gibt nichts aufzulösen").toEqual([]);
    expect(`${bindungen[0]?.datei}:${bindungen[0]?.zeile}`).toBe(
      "apps/web/src/components/BerechneterSchirm.tsx:3",
    );
  });
});

// ------------------------------------------------------------------------------------------------
// BLOCK K — DIE D3-MENGE BLEIBT VOLLSTÄNDIG ERFASST. ZAHL VOR UND NACH.
// ------------------------------------------------------------------------------------------------
describe("JOB 1181 · Mengenerhalt: der schärfere Sucher verliert nichts", () => {
  it("die Grundgesamtheit ist nicht geschrumpft — dieselben 397 Quelldateien wie in D3", () => {
    // Ein Bau, der das Werkzeug schärft und dabei die Menge verkleinert, hat nichts gewonnen. Die
    // Zahl steht in Block E („gelesene Quelldateien", Untergrenze 382) und hier noch einmal als
    // ausdrückliche Erhaltungszusage dieses Durchgangs.
    expect(ALLE_ERHEBUNGEN.length, "D3 hat 397 gemessen").toBe(397);
    expect(KANDIDATEN.length, "und sechs Kandidaten").toBeGreaterThanOrEqual(6);
  });

  it("beide D3-Suchrichtungen stehen unverändert bei null unerklärten Restfällen", () => {
    expect(unregistrierteVollflaechen(ALLE_ERHEBUNGEN, BAUTEILE), "Richtung A").toEqual([]);
    expect(unregistrierteWirkflaechen(ALLE_ERHEBUNGEN, BAUTEILE), "Richtung B").toEqual([]);
  });

  it("der erweiterte Flächentext nimmt der Erhebung KEINE Datei weg (nur Zugewinn möglich)", () => {
    // Die schärfere Sicht darf ausschliesslich hinzufügen: `flaechentext` hängt an, es entfernt
    // nichts. Würde sie je etwas verlieren, wäre der Zugewinn mit einem stillen Verlust erkauft —
    // und genau das prüft dieser Fall Datei für Datei über den ganzen Bestand.
    const verloren = ALLE_ERHEBUNGEN.filter(
      (e) =>
        spanntVollflaecheAuf(e.quelle.gestrippt) &&
        !spanntVollflaecheAuf(flaechentext(e, MODULINDEX)),
    ).map((e) => e.quelle.datei);
    expect(verloren, "\nDurch die Modulauflösung aus der Erhebung gefallen:\n").toEqual([]);

    const gewonnen = ALLE_ERHEBUNGEN.filter(
      (e) =>
        !spanntVollflaecheAuf(e.quelle.gestrippt) &&
        spanntVollflaecheAuf(flaechentext(e, MODULINDEX)),
    ).map((e) => e.quelle.datei);
    // GEMESSEN heute: null. Keine der neun modulfremden Klassenquellen trägt eine Vollfläche —
    // der Suchraum ist gewachsen, die Fundmenge nicht. Das ist der Befund, nicht sein Fehlen.
    expect(gewonnen, `Neu erfasste Vollflächen: ${gewonnen.join(" · ")}`).toEqual([]);
  });
});
