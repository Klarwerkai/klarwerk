import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
// GRUNDMENGE (Auftrag gesamt-sendehook-sammler, R-1397/I32): bis dahin sah der Sammler nur sein
// eigenes Verzeichnis services/app/src, nur `.ts` und nur `.addHook("onSend"|'onSend', …)`.
// Drei Bauformen fielen damit weiterhin still heraus, ohne irgendeinen Wächter rot zu machen:
// ein Hookname als Template-Literal (`` addHook(`onSend`, async …) ``), ein onSend als
// Routenoption/Methoden-Kurzform außerhalb von services/ und jede Datei mit anderer Endung
// (.tsx/.mts/.cts/.js/.mjs/.cjs). Erhoben wird deshalb jetzt der GANZE Quellbaum des Repos:
//   · jede Codedatei (s. CODE) außer *.test.*/*.spec.*,
//   · ohne node_modules, Punkt-Verzeichnisse und Bauausgaben (s. NICHT_ERHOBEN),
//   · ohne die Testbäume tests/ und tests-smoke/ — dort hängen Prüfstände bewusst eigene async-
//     onSend-Hooks an Test-Apps (z. B. tests/app/mega71-onsend-synchron.test.ts Teil 2 als fremder
//     Hook); das ist Messaufbau, keine Produktverdrahtung.
//
// GELTUNGSBEREICH, bewusst breiter als "app-global": erhoben wird jede onSend-Registrierung im
// Produktbaum, auch eine plugin-gekapselte oder eine Routenoption. Begründung: das Doppel-Send-
// Fenster hängt an den async-Hops der SEND-Pipeline einer Route — ein gekapselter async-Hook öffnet
// es für seine Routen genauso (Mechanik in routes/addin-static-routes.ts:130 ff.). Heute sind alle
// vier Fundstellen app-global und liegen unter services/app/src; schlägt der Sammler je auf eine
// Registrierung an, für die die Regel nachweislich nicht gilt, wird er ENGER gebaut statt
// abgeschaltet (mega71-Grenzregel).
const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(SRC, "..", "..", "..");

const CODE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
// Abhängigkeiten, Bauausgaben und unversionierte Arbeitsordner (.gitignore) — überall im Baum.
const NICHT_ERHOBEN = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
  "_relay",
  "LOT",
]);
// Die Testbäume — nur auf oberster Ebene; ein `tests`-Ordner tief im Produktbaum bleibt erhoben.
const TESTBAEUME = new Set(["tests", "tests-smoke"]);

// Kommentare raus, Zeilennummern ERHALTEN (Muster aus tests/app/mega70-rohlink-sammler.test.ts):
// eine bloße Erwähnung („hier stand ein async onSend") zählt nicht als Registrierung, Fundstellen
// bleiben zitierfähig.
function ohneKommentare(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}

function produktDateien(dir: string, ebene = 0): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    const pfad = join(dir, eintrag.name);
    if (eintrag.isDirectory()) {
      const ausgenommen =
        eintrag.name.startsWith(".") ||
        NICHT_ERHOBEN.has(eintrag.name) ||
        (ebene === 0 && TESTBAEUME.has(eintrag.name));
      if (!ausgenommen) {
        out.push(...produktDateien(pfad, ebene + 1));
      }
    } else if (CODE.test(eintrag.name) && !/\.(?:test|spec)\.[^.]+$/.test(eintrag.name)) {
      out.push(pfad);
    }
  }
  return out;
}

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

// Die drei Registrierungswege, die Fastify für onSend kennt:
//  ADDHOOK   = `.addHook("onSend", …)` — Hookname in jeder Literalform, auch als Template-Literal;
//  OPTION    = Routenoption `{ onSend: … }` (auch `"onSend": …`);
//  METHODE   = Methoden-Kurzform in einem Optionsobjekt `{ onSend(req, reply, payload, done) {…} }`
//              bzw. `{ async onSend(…) {…} }`.
// OPTION und METHODE sind als Muster nicht Fastify-spezifisch (ein Frontend-Objekt darf einen
// Schlüssel `onSend` tragen) und werden deshalb nur in Dateien erhoben, die Fastify ansprechen.
// `.addHook(` ist Fastify-eigen und wird überall erhoben.
const ADDHOOK = /\baddHook\(\s*(["'`])onSend\1\s*,\s*/g;
const OPTION = /(?<=^|[\s{,(])["']?onSend["']?\s*:\s*/gm;
const METHODE = /(?<=^|[\s{,(])(async\s+)?onSend\s*(?=\()/gm;
const FASTIFY = /fastify/i;

function registrierungenIn(src: string, datei: string): OnSendRegistrierung[] {
  const text = ohneKommentare(src);
  const funde: OnSendRegistrierung[] = [];
  const merke = (index: number, rest: string) => {
    funde.push({
      fundort: `${datei}:${text.slice(0, index).split("\n").length}`,
      form: formVon(rest),
      zitat: rest.split("\n", 1)[0]?.trim() ?? "",
    });
  };
  for (const m of text.matchAll(ADDHOOK)) {
    merke(m.index ?? 0, text.slice((m.index ?? 0) + m[0].length));
  }
  if (FASTIFY.test(text)) {
    for (const m of text.matchAll(OPTION)) {
      merke(m.index ?? 0, text.slice((m.index ?? 0) + m[0].length));
    }
    for (const m of text.matchAll(METHODE)) {
      // `async onSend(…)` → "async (…)", `onSend(…)` → "(…)": derselbe Form-Leser wie oben.
      merke(m.index ?? 0, `${m[1] ?? ""}${text.slice((m.index ?? 0) + m[0].length)}`);
    }
  }
  return funde;
}

function erhebeOnSendRegistrierungen(wurzel: string): OnSendRegistrierung[] {
  return produktDateien(wurzel).flatMap((datei) =>
    registrierungenIn(readFileSync(datei, "utf8"), relative(wurzel, datei)),
  );
}

describe("WP-E2/mega71 B: onSend-Hooks im Produktbaum bleiben synchron (Sammler, keine Liste)", () => {
  const funde = erhebeOnSendRegistrierungen(REPO);

  it("die Erhebung läuft nicht leer — ein Sammler, der nichts findet, prüft nichts", () => {
    expect(funde.length).toBeGreaterThan(0);
  });

  it("JEDE gefundene onSend-Registrierung trägt den 4-Parameter-Callback-Stil (done)", () => {
    const verstoesse = funde
      .filter((f) => f.form !== "callback")
      .map((f) => `${f.fundort} [${f.form}]  onSend → ${f.zitat}`);
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
    const F = 'import type { FastifyInstance } from "fastify";\n';
    const faelle: Array<[string, OnSendRegistrierung["form"][]]> = [
      ['app.addHook("onSend", async (req, reply) => {})', ["async"]],
      ["app.addHook(`onSend`, async (req, reply) => {})", ["async"]],
      ['app\n  .addHook(\n    "onSend",\n    async (req, reply) => {})', ["async"]],
      [`${F}app.get("/a", { onSend: async (r, s, p) => p }, h)`, ["async"]],
      [`${F}app.get("/a", { async onSend(r, s, p) { return p } }, h)`, ["async"]],
      [`${F}app.get("/a", { onSend: [stempel] }, h)`, ["unbekannt"]],
      [`${F}app.get("/a", { onSend(r, s, p, done) { done() } }, h)`, ["callback"]],
      ['app.addHook("onSend", (r, s, p, done) => done(null, p))', ["callback"]],
      // Keine Registrierung: bloße Erwähnung im Kommentar, Frontend-Schlüssel ohne Fastify-Bezug.
      ['// app.addHook("onSend", async () => {})', []],
      ["const props = { onSend: async () => {} };", []],
    ];
    for (const [src, erwartet] of faelle) {
      expect(
        registrierungenIn(src, "x.ts").map((f) => f.form),
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

  it("server.ts verdrahtet Noindex- und Security-Header-Hooks über die exportierten Produktionsfunktionen", () => {
    const server = readFileSync(join(SRC, "server.ts"), "utf8");
    expect(server).toMatch(/registerNoindexHook\(app\)/);
    // WP-KLARA-1b: der Header-Matrix-Test läuft gegen registerSecurityHeaders — server.ts muss exakt
    // dieselbe Funktion verdrahten, sonst testet die Matrix eine Kopie.
    expect(server).toMatch(/registerSecurityHeaders\(app\)/);
  });
});
