import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
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
// er die Registrierungen selbst: JEDES `.addHook("onSend", …)` im Produktbaum unter
// services/app/src (rekursiv, ohne *.test.ts) muss den 4-Parameter-Callback-Stil tragen. Eine
// Registrierung in unbekannter Form ist rot und wird wörtlich zitiert, statt still aus der
// Erhebung zu fallen; eine LEERE Erhebung ist ein Fehler und kein Erfolg — ein Sammler, der
// nichts findet, prüft nichts.
//
// GELTUNGSBEREICH, bewusst breiter als "app-global": erhoben wird jede onSend-Registrierung im
// Produktbaum, auch eine künftig plugin-gekapselte. Begründung: das Doppel-Send-Fenster hängt an
// den async-Hops der SEND-Pipeline einer Route — ein gekapselter async-Hook öffnet es für seine
// Routen genauso (Mechanik in routes/addin-static-routes.ts:130 ff.). Heute sind alle vier
// Fundstellen ohnehin app-global; schlägt der Sammler je auf eine Registrierung an, für die die
// Regel nachweislich nicht gilt, wird er ENGER gebaut statt abgeschaltet (mega71-Grenzregel).
const SRC = dirname(fileURLToPath(import.meta.url));

// Kommentare raus, Zeilennummern ERHALTEN (Muster aus tests/app/mega70-rohlink-sammler.test.ts):
// eine bloße Erwähnung („hier stand ein async onSend") zählt nicht als Registrierung, Fundstellen
// bleiben zitierfähig.
function ohneKommentare(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}

function produktDateien(dir: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    const pfad = join(dir, eintrag.name);
    if (eintrag.isDirectory()) {
      out.push(...produktDateien(pfad));
    } else if (eintrag.name.endsWith(".ts") && !eintrag.name.endsWith(".test.ts")) {
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

// Die Form der Registrierung, gelesen am Text direkt hinter `"onSend",`:
//  callback  = 4-Parameter-Pfeilfunktion mit `done` als viertem Parameter (die einzige Bauform,
//              die die Send-Pipeline atomar hält — Vorbild noindex-hook.ts:10);
//  async     = genau der Rückbau, den dieser Wächter rot machen soll;
//  unbekannt = alles andere — fail-closed rot, wörtlich zitiert (benannte Funktion, 3-Parameter-
//              Promise-Stil o. Ä. wären eine NEUE Bauform und gehören erst nach einer bewussten
//              Entscheidung hierher, nicht still durchgewinkt).
function formVon(rest: string): OnSendRegistrierung["form"] {
  if (/^async\b/.test(rest)) {
    return "async";
  }
  if (/^(?:function\s*)?\(\s*_?[A-Za-z]\w*\s*,\s*\w+\s*,\s*\w+\s*,\s*done\s*\)/.test(rest)) {
    return "callback";
  }
  return "unbekannt";
}

function erhebeOnSendRegistrierungen(wurzel: string): OnSendRegistrierung[] {
  const funde: OnSendRegistrierung[] = [];
  for (const datei of produktDateien(wurzel)) {
    const src = ohneKommentare(readFileSync(datei, "utf8"));
    for (const m of src.matchAll(/\.addHook\(\s*["']onSend["']\s*,\s*/g)) {
      const index = m.index ?? 0;
      const zeile = src.slice(0, index).split("\n").length;
      const rest = src.slice(index + m[0].length);
      funde.push({
        fundort: `${relative(wurzel, datei)}:${zeile}`,
        form: formVon(rest),
        zitat: rest.split("\n", 1)[0]?.trim() ?? "",
      });
    }
  }
  return funde;
}

describe("WP-E2/mega71 B: onSend-Hooks im Produktbaum bleiben synchron (Sammler, keine Liste)", () => {
  const funde = erhebeOnSendRegistrierungen(SRC);

  it("die Erhebung läuft nicht leer — ein Sammler, der nichts findet, prüft nichts", () => {
    expect(funde.length).toBeGreaterThan(0);
  });

  it("JEDE gefundene onSend-Registrierung trägt den 4-Parameter-Callback-Stil (done)", () => {
    const verstoesse = funde
      .filter((f) => f.form !== "callback")
      .map((f) => `${f.fundort} [${f.form}]  addHook("onSend", ${f.zitat}`);
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

  it("server.ts verdrahtet Noindex- und Security-Header-Hooks über die exportierten Produktionsfunktionen", () => {
    const server = readFileSync(join(SRC, "server.ts"), "utf8");
    expect(server).toMatch(/registerNoindexHook\(app\)/);
    // WP-KLARA-1b: der Header-Matrix-Test läuft gegen registerSecurityHeaders — server.ts muss exakt
    // dieselbe Funktion verdrahten, sonst testet die Matrix eine Kopie.
    expect(server).toMatch(/registerSecurityHeaders\(app\)/);
  });
});
