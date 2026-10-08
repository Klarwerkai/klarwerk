import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  REPO_WURZEL,
  ohneKommentare,
  produktCodeDateien,
} from "../../../tests/support/onsendGrundmenge";

// WP-E2 (ben-Auflage 1b) · AUFTRAG-mega71 Block B: Architektur-Pin auf QUELLTEXT-Ebene. Die
// WP-E-Regel "onSend-Hooks IMMER synchron (Callback-Stil)" ist im Typsystem nicht erzwingbar —
// dieser Test macht einen Rückbau (async onSend) rot, BEVOR er das wrap-thenable-Doppel-Send-
// Fenster (ERR_HTTP_HEADERS_SENT → Prozess-Crash) wieder öffnet. Quelltext-Pins statt Laufzeit-
// Introspektion: Fastify exponiert die Hook-Definitionsform (async vs. Callback) zur Laufzeit nicht.
//
// ER IST SEIT mega71 EIN SAMMLER, KEINE LISTE. Bis mega71 stand hier eine von Hand gepflegte
// Liste aus vier Dateinamen — und der asynchrone onSend-Hook, den mega69 in web-static.ts
// registrierte, stand nicht darin. Der Wächter prüfte richtig, sah aber nur dorthin, wo man ihn
// hingeschickt hatte, und schwieg (bens Ship-Blocker, BERICHT-ben-sammel67-mega69). Jetzt erhebt
// er die Registrierungen selbst. Eine Registrierung in unbekannter Form ist rot und wird wörtlich
// zitiert, statt still aus der Erhebung zu fallen; eine LEERE Erhebung ist ein Fehler und kein
// Erfolg — ein Sammler, der nichts findet, prüft nichts.
//
// GRUNDMENGE (Auftrag gesamt-sendehook-sammler, R-1397/I32): der ganze Quellbaum des Repos, alle
// JS/TS-Endungen, ohne Testbäume — festgelegt EINMAL in tests/support/onsendGrundmenge.ts, die
// auch der ergänzende B44-Wächter liest. Zwei Wächter mit zwei Grundmengen hätten wieder eine
// Stelle, an die keiner hinsieht.
//
// ROHZÄHLER STATT MUSTERLISTE (bens Befunde zum Kandidaten 8e554855): eine Erhebung, die nur
// die Registrierungswege sieht, die jemand vorher aufgeschrieben hat, ist wieder eine Liste — nur
// eine Ebene tiefer. Ein Routenmodul ohne eigenen Fastify-Import (`export default (app) =>
// app.get(url, { async onSend(…) {…} }, h)`) und ein indirekter Hookname (`const hook = "onSend";
// app.addHook(hook, async …)`) fielen genau so heraus. Deshalb gilt jetzt:
//   1. JEDES Vorkommen des Bezeichners `onSend` im Code (außerhalb von Kommentaren) muss von
//      einer erkannten Registrierung erklärt werden — `.addHook("onSend", …)`, Routenoption
//      `{ onSend: … }` oder Methoden-Kurzform `{ onSend(…) {…} }`. Ein unerklärtes Vorkommen
//      (Zeichenkette in einer Konstante, Kurzschreibweise `{ onSend }`, Zuweisung `o.onSend = …`,
//      Aufruf …) ist rot als `unbekannt`. Keine Wortsuche nach „fastify" als Ausschluss mehr.
//   2. JEDES `addHook`, dessen erstes Argument kein schlichtes Literal ist (Variable, Template mit
//      Platzhalter, Verkettung, `app["addHook"]`, `.bind` …), ist rot als `unbekannt`: ob es
//      onSend registriert, lässt sich am Text nicht entscheiden — also nicht still durchwinken.
//
// GELTUNGSBEREICH, bewusst breiter als "app-global": erhoben wird jede onSend-Registrierung im
// Produktbaum, auch eine plugin-gekapselte oder eine Routenoption. Begründung: das Doppel-Send-
// Fenster hängt an den async-Hops der SEND-Pipeline einer Route — ein gekapselter async-Hook öffnet
// es für seine Routen genauso (Mechanik in routes/addin-static-routes.ts:130 ff.). Heute sind alle
// vier Fundstellen app-global und liegen unter services/app/src; schlägt der Sammler je auf eine
// Stelle an, für die die Regel nachweislich nicht gilt (etwa ein Frontend-Objekt mit einem
// Schlüssel `onSend`), wird er nach bewusster Entscheidung ENGER gebaut statt abgeschaltet
// (mega71-Grenzregel).
const SRC = dirname(fileURLToPath(import.meta.url));

interface OnSendRegistrierung {
  fundort: string; // "<datei>:<zeile>"
  form: "callback" | "async" | "unbekannt";
  zitat: string;
}

// Die Form der Registrierung, gelesen am Text direkt hinter `"onSend",` bzw. `onSend:`:
//  callback  = 4-Parameter-Pfeilfunktion mit `done` als viertem Parameter (die einzige Bauform,
//              die die Send-Pipeline atomar hält — Vorbild noindex-hook.ts:10);
//  async     = genau der Rückbau, den dieser Wächter rot machen soll;
//  unbekannt = alles andere — fail-closed rot, wörtlich zitiert (benannte Funktion, 3-Parameter-
//              Promise-Stil, Hook-Array o. Ä. wären eine NEUE Bauform und gehören erst nach einer
//              bewussten Entscheidung hierher, nicht still durchgewinkt).
function formVon(rest: string): OnSendRegistrierung["form"] {
  if (/^async\b/.test(rest)) {
    return "async";
  }
  if (/^(?:function\s*)?\(\s*_?[A-Za-z]\w*\s*,\s*\w+\s*,\s*\w+\s*,\s*done\s*\)/.test(rest)) {
    return "callback";
  }
  return "unbekannt";
}

// Die erkannten Registrierungswege:
//  ADDHOOK  = jedes `addHook`; ein schlichtes Literal als erstes Argument wird gelesen, alles
//             andere ist ein indirekter Hookname;
//  OPTION   = Routenoption `{ onSend: … }` (auch `"onSend": …`, `["onSend"]: …`);
//  METHODE  = Methoden-Kurzform `{ onSend(req, reply, payload, done) {…} }` / `{ async onSend(…) }`.
// ROH zählt jedes Vorkommen des Bezeichners — was keiner der drei Wege erklärt, ist `unbekannt`.
const ADDHOOK = /\baddHook\b/g;
const ADDHOOK_LITERAL = /^\(\s*(["'`])(\w+)\1\s*,\s*/;
const OPTION = /(?<=^|[\s{,(])\[?\s*["'`]?onSend["'`]?\s*\]?\s*:\s*/gm;
const METHODE = /(?<=^|[\s{,(])(async\s+)?onSend\s*(?=\()/gm;
const ROH = /\bonSend\b/g;

function registrierungenIn(src: string, datei: string): OnSendRegistrierung[] {
  const text = ohneKommentare(src);
  const funde: OnSendRegistrierung[] = [];
  const erklaert = new Set<number>();
  const zeileVon = (index: number) => text.slice(0, index).split("\n").length;
  const merke = (index: number, form: OnSendRegistrierung["form"], rest: string) => {
    funde.push({
      fundort: `${datei}:${zeileVon(index)}`,
      form,
      zitat: rest.split("\n", 1)[0]?.trim() ?? "",
    });
  };
  for (const m of text.matchAll(ADDHOOK)) {
    const index = m.index ?? 0;
    const rest = text.slice(index + m[0].length);
    const literal = ADDHOOK_LITERAL.exec(rest);
    if (!literal) {
      // Indirekter Hookname: am Text nicht entscheidbar, ob onSend gemeint ist.
      merke(index, "unbekannt", `addHook${rest}`);
    } else if (literal[2] === "onSend") {
      erklaert.add(index + m[0].length + literal[0].indexOf("onSend"));
      merke(index, formVon(rest.slice(literal[0].length)), rest.slice(literal[0].length));
    }
  }
  for (const m of text.matchAll(OPTION)) {
    const index = m.index ?? 0;
    erklaert.add(index + m[0].indexOf("onSend"));
    const rest = text.slice(index + m[0].length);
    merke(index, formVon(rest), rest);
  }
  for (const m of text.matchAll(METHODE)) {
    const index = m.index ?? 0;
    erklaert.add(index + m[0].indexOf("onSend"));
    // `async onSend(…)` → "async (…)", `onSend(…)` → "(…)": derselbe Form-Leser wie oben.
    const rest = `${m[1] ?? ""}${text.slice(index + m[0].length)}`;
    merke(index, formVon(rest), rest);
  }
  for (const m of text.matchAll(ROH)) {
    const index = m.index ?? 0;
    if (!erklaert.has(index)) {
      const zeile = text.slice(text.lastIndexOf("\n", index) + 1);
      merke(index, "unbekannt", zeile);
    }
  }
  return funde;
}

function erhebeOnSendRegistrierungen(): OnSendRegistrierung[] {
  return produktCodeDateien().flatMap((datei) =>
    registrierungenIn(readFileSync(datei, "utf8"), relative(REPO_WURZEL, datei)),
  );
}

describe("WP-E2/mega71 B: onSend-Hooks im Produktbaum bleiben synchron (Sammler, keine Liste)", () => {
  const funde = erhebeOnSendRegistrierungen();

  it("die Erhebung läuft nicht leer — ein Sammler, der nichts findet, prüft nichts", () => {
    expect(funde.length).toBeGreaterThan(0);
  });

  it("JEDE gefundene onSend-Registrierung trägt den 4-Parameter-Callback-Stil (done)", () => {
    const verstoesse = funde
      .filter((f) => f.form !== "callback")
      .map((f) => `${f.fundort} [${f.form}]  ${f.zitat}`);
    expect(
      verstoesse,
      "async onSend ist verboten (WP-E) — Mechanik s. addin-static-routes.ts:130 ff.",
    ).toEqual([]);
  });

  it("KALIBRIERUNG: der Form-Leser erkennt beide Verbotsformen und das Vorbild", () => {
    // Ohne diese Zusicherung wäre der Sammler bei einem stillen Regex-Bruch trivial grün.
    expect(formVon("async (request, reply) => {")).toBe("async");
    expect(formVon("async function stempel(request, reply, payload) {")).toBe("async");
    expect(formVon("(_request, reply, payload, done) => {")).toBe("callback");
    expect(formVon("(request, reply, payload, done) => {")).toBe("callback");
    expect(formVon("(request, reply, payload) => {")).toBe("unbekannt");
    expect(formVon("meinBenannterHook)")).toBe("unbekannt");
  });

  it("KALIBRIERUNG: die Erhebung sieht jeden Registrierungsweg — auch die bis dahin blinden", () => {
    // Bewusst OHNE Fastify-Import: ein eingebundenes Routenmodul trägt oft keinen (ben zu 8e554855).
    const faelle: Array<[string, OnSendRegistrierung["form"][]]> = [
      ['app.addHook("onSend", async (req, reply) => {})', ["async"]],
      ["app.addHook(`onSend`, async (req, reply) => {})", ["async"]],
      ['app\n  .addHook(\n    "onSend",\n    async (req, reply) => {})', ["async"]],
      ['app.addHook("onSend", (r, s, p, done) => done(null, p))', ["callback"]],
      // Routenmodul ohne eigenen Fastify-Import — wörtlich bens Gegenbeispiel.
      [
        "export default app => { app.get('/x', { async onSend(r,s,p) { return p; } }, handler); }",
        ["async"],
      ],
      ['app.get("/a", { onSend: async (r, s, p) => p }, h)', ["async"]],
      ['app.get("/a", { ["onSend"]: async (r, s, p) => p }, h)', ["async"]],
      ['app.get("/a", { onSend: [stempel] }, h)', ["unbekannt"]],
      ['app.get("/a", { onSend(r, s, p, done) { done() } }, h)', ["callback"]],
      // Indirekte Hooknamen — wörtlich bens Gegenbeispiel und seine Verwandten.
      ["const hook = 'onSend'; app.addHook(hook, async (r, s) => {})", ["unbekannt", "unbekannt"]],
      ["app.addHook(`on${art}`, async (r, s) => {})", ["unbekannt"]],
      ['app["addHook"]("onSend", async (r, s) => {})', ["unbekannt", "unbekannt"]],
      // Nicht erklärte Vorkommen: Kurzschreibweise und Zuweisung.
      [
        'const onSend = async (r, s) => {}; app.get("/a", { onSend }, h)',
        ["unbekannt", "unbekannt"],
      ],
      ["opts.onSend = async (r, s) => {}", ["unbekannt"]],
      // Keine Registrierung: bloße Erwähnung im Kommentar, anderer Hook, anderer Bezeichner.
      ['// app.addHook("onSend", async () => {})', []],
      ['app.addHook("onRequest", async (r) => {})', []],
      ["const onSendError = 1;", []],
    ];
    for (const [src, erwartet] of faelle) {
      expect(
        registrierungenIn(src, "x.mts").map((f) => f.form),
        src,
      ).toEqual(erwartet);
    }
  });

  it("KALIBRIERUNG: die Grundmenge reicht bis zu der Datei, die die alte Liste nie gesehen hätte", () => {
    // web-static.ts trug den async-Hook aus mega69 (bens Ship-Blocker) und stand nicht in der Liste.
    // Das ist KEINE neue Liste: geprüft wird nur, dass die selbst erhobene Grundmenge sie erreicht.
    const ziel = `${join("services", "app", "src", "web-static.ts")}:`;
    expect(funde.some((f) => f.fundort.startsWith(ziel))).toBe(true);
  });

  it("KALIBRIERUNG: die gemeinsame Grundmenge trägt jede Code-Endung, nicht nur .ts", () => {
    // Prüft die Endungsregel der gemeinsamen Grundmenge, ohne eine Datei zu benennen: es gibt im
    // Repo Produktdateien mit anderen Endungen (z. B. tools/*.mjs) — sie müssen erhoben werden.
    expect(produktCodeDateien().some((d) => /\.(?:mjs|cjs|tsx|js)$/.test(d))).toBe(true);
  });

  it("server.ts verdrahtet Noindex- und Security-Header-Hooks über die exportierten Produktionsfunktionen", () => {
    const server = readFileSync(join(SRC, "server.ts"), "utf8");
    expect(server).toMatch(/registerNoindexHook\(app\)/);
    // WP-KLARA-1b: der Header-Matrix-Test läuft gegen registerSecurityHeaders — server.ts muss exakt
    // dieselbe Funktion verdrahten, sonst testet die Matrix eine Kopie.
    expect(server).toMatch(/registerSecurityHeaders\(app\)/);
  });
});
