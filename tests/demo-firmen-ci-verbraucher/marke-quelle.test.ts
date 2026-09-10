// ================================================================================================
// JOB 3512 · DIE EINE QUELLE — WAS WORD UND CHROME VON DER FIRMEN-CI WISSEN, WISSEN SIE VOM SERVER.
// ================================================================================================
//
// Diese Datei liest QUELLTEXT und Dateien, nicht Verhalten. Sie beantwortet die Fragen, die man an
// einem laufenden Fenster gar nicht stellen kann, weil sie über die BAUFORM gehen:
//
//   · Gibt es wirklich nur EINE Quelle (`GET /api/branding`) — oder ist irgendwo ein zweiter
//     Schalter, ein zweiter Speicher oder ein zweiter Farbsatz nachgewachsen? (Auftrag L1/L6)
//   · Ist die mitgelieferte Logodatei WIRKLICH die Originaldatei, Byte für Byte? (L3)
//   · Hat die Erweiterung dafür Rechte, CSP oder Fremdherkunft ausgeweitet? (L3/L4)
//   · Rechnen Word und Chrome die abgeleiteten Töne NACH DERSELBEN REGEL wie das Web? (L1)
//
// Das Verhalten am geladenen Fenster prüfen die beiden Nachbardateien (`word-marke.test.ts`,
// `panel-marke.test.ts`); diese hier ist der Drift-Wächter über die Bauform.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const lies = (rel: string) => readFileSync(join(WURZEL, rel), "utf8");

const TASKPANE = lies("apps/web/public/word-addin/taskpane.html");
const PANEL_JS = lies("extensions/klara-browser/panel.js");
const PANEL_CSS = lies("extensions/klara-browser/panel.css");
const PANEL_HTML = lies("extensions/klara-browser/panel.html");
const WORKER = lies("extensions/klara-browser/worker.js");
const MANIFEST = JSON.parse(lies("extensions/klara-browser/manifest.json"));
const MARKE_CSS = lies("apps/web/src/styles/marke.css");

/** Die Logodatei der Erweiterung — mitgeliefert, nicht nachgeladen. */
const EXT_LOGO = "extensions/klara-browser/marke/advisor/adv-logo.svg";
/** Dieselbe Datei im Web-Bündel, von JOB 3511 aus dem Original übernommen. */
const WEB_LOGO = "apps/web/public/marke/advisor/adv-logo.svg";
/**
 * Die ORIGINALQUELLE liegt im Steuerungsprojekt, NICHT im Produkt-Worktree
 * (`gespraech/ci-advisor/AUFTRAGSGRUNDLAGE.md`, Nachtrag 07:29: „Absolute Assetquelle im
 * Steuerungsprojekt verwenden"). Auf einem Rechner ohne dieses Projekt ist die Bindung nicht
 * PRÜFBAR — nicht falsch. Dieselbe Bauform wie `mockupFuehrt` im mega43-Palettensammler (der Pfad
 * dorthin steht hier bewusst NICHT ausgeschrieben: `tests/structure/testverweise-aufloesbar.test.ts`
 * hält fest, dass kein Verweis den Wortbestandteil „werkbank" trägt): fehlt die Datei, sagt der
 * Fall es und misst die zweite, im Repo liegende Bindung (Web-Bündel) trotzdem scharf.
 */
const ORIGINAL = "/Users/peterkohnert/klarwerk_steuerung/gespraech/ci-advisor/adv-logo.svg";

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

/** Der mit Markern geschnittene Block einer buildlosen Datei — nur er ist Gegenstand der Zusagen. */
function block(quelle: string, marke: string): string {
  const start = quelle.indexOf(`${marke}-START`);
  const ende = quelle.indexOf(`${marke}-END`);
  expect(start, `${marke}-START fehlt`).toBeGreaterThanOrEqual(0);
  expect(ende, `${marke}-END fehlt`).toBeGreaterThan(start);
  return quelle.slice(start, ende);
}

/** Alle `fetch(...)`-Ziele einer Datei als Rohtext, Kommentarzeilen ausgenommen. */
function abrufziele(quelle: string): string[] {
  const code = quelle
    .split("\n")
    .filter((z) => !/^\s*\/\//.test(z))
    .join("\n");
  return [...code.matchAll(/\bfetch\(\s*([^,)]+)/g)].map((m) => (m[1] ?? "").trim());
}

// ------------------------------------------------------------------------------------------------
// Die Ableitungsregel — dieselbe Rechnung wie in `apps/web/src/styles/marke.css`.
// ------------------------------------------------------------------------------------------------

function kanaele(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  expect(m, `${hex} ist kein 6-stelliger Hexwert`).not.toBeNull();
  const roh = (m?.[1] ?? "000000").toLowerCase();
  return [
    Number.parseInt(roh.slice(0, 2), 16),
    Number.parseInt(roh.slice(2, 4), 16),
    Number.parseInt(roh.slice(4, 6), 16),
  ];
}

function abgetont(hex: string, faktor: number): string {
  return `#${kanaele(hex)
    .map((k) =>
      Math.round(k * faktor)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG 2.1 Relativleuchtdichte + Kontrastverhältnis (Formel wie in mega40). */
function leuchtdichte(hex: string): number {
  const [r, g, b] = kanaele(hex).map((k) => {
    const s = k / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string): number {
  const la = leuchtdichte(a);
  const lb = leuchtdichte(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const ADVISOR_PRIMAER = "#0578b7";
const ADVISOR_SCHRIFT = "#161417";

describe("JOB 3512 Q1 · das Logo ist die Originaldatei, Byte für Byte", () => {
  it("die Erweiterung liefert es als DATEI mit, 5567 Bytes", () => {
    const pfad = join(WURZEL, EXT_LOGO);
    expect(existsSync(pfad), `${EXT_LOGO} fehlt — ohne die Datei gibt es in Chrome kein Logo`).toBe(
      true,
    );
    expect(statSync(pfad).size, "die Bytegröße der Originaldatei ist 5567").toBe(5567);
  });

  it("sie ist byte-identisch zu der Kopie, die das Web ausliefert", () => {
    // Beide Oberflächen zeigen DASSELBE Bild. Driftete eine der beiden Kopien, sähe Chrome ein
    // anderes Logo als KLARWERK — genau der Fall, den „eine Quelle" ausschliesst.
    expect(sha256(readFileSync(join(WURZEL, EXT_LOGO)))).toBe(
      sha256(readFileSync(join(WURZEL, WEB_LOGO))),
    );
  });

  it("sie ist byte-identisch zur Originalquelle im Steuerungsprojekt (soweit vorhanden)", () => {
    if (!existsSync(ORIGINAL)) {
      // Ehrlich statt still: auf diesem Rechner liegt die Quelle nicht, die Bindung wird hier
      // nicht behauptet. Der Fall darüber misst die Kopie im Repo trotzdem scharf.
      expect(existsSync(join(WURZEL, EXT_LOGO))).toBe(true);
      return;
    }
    expect(sha256(readFileSync(join(WURZEL, EXT_LOGO)))).toBe(sha256(readFileSync(ORIGINAL)));
  });

  it("KALIBRIERUNG: ein verändertes Byte macht den Vergleich wirklich rot", () => {
    const echt = readFileSync(join(WURZEL, EXT_LOGO));
    const verstellt = Buffer.from(echt);
    verstellt[10] = (verstellt[10] ?? 0) ^ 0x01;
    expect(sha256(verstellt)).not.toBe(sha256(echt));
  });
});

describe("JOB 3512 Q2 · EINE Quelle, kein zweiter Schalter, kein zweiter Farbsatz", () => {
  it("beide Oberflächen lesen genau `/api/branding` — und sonst nichts Neues", () => {
    expect(block(TASKPANE, "KW-MARKE")).toContain('"/api/branding"');
    // Der Worker setzt den Pfad an seine EINE Hostkonstante (`HOST`), deshalb hier ohne die
    // Anführungszeichen — der Host selbst wird im Fall darunter (Q3) auf app.klarwerk.ai gepinnt.
    expect(block(WORKER, "KW-MARKE")).toContain("/api/branding");
    expect(block(WORKER, "KW-MARKE")).toContain("${HOST}");
  });

  it("die Leiste selbst holt nichts aus dem Netz — der Worker tut es (Bestandsregel)", () => {
    // `tests/klara-browser/package.test.ts` verbietet `fetch(` in `panel.js`. Diese Zusage wird
    // hier WIEDERHOLT, weil die Firmen-CI der erste Anlass seit langem war, sie zu brechen.
    expect(PANEL_JS).not.toMatch(/fetch\(/);
    expect(abrufziele(WORKER).filter((z) => z.includes("branding"))).toHaveLength(1);
  });

  it("die Markenwahl wird NIRGENDS ein zweites Mal gespeichert", () => {
    // Der Stand kommt vom Server und lebt nur in der Sitzung der Fläche. Ein `storage.set`,
    // `localStorage` oder ein Formularelement im Markenblock wäre der zweite Schalter, den der
    // Auftrag (Lieferung 1) ausdrücklich ausschliesst.
    for (const [name, roh] of [
      ["taskpane.html", block(TASKPANE, "KW-MARKE")],
      ["panel.js", block(PANEL_JS, "KW-MARKE")],
      ["worker.js", block(WORKER, "KW-MARKE")],
    ] as const) {
      expect(roh, `${name}: schreibt einen eigenen Speicher`).not.toMatch(
        /localStorage|sessionStorage|storage\.(local|session|sync)\.set/,
      );
    }
    // Und keine Bedienung: kein Schalter, keine Auswahl, kein Knopf im Markenmarkup.
    expect(PANEL_HTML).not.toMatch(/id="marke-(schalter|wahl|profil)"/);
    expect(TASKPANE).not.toMatch(/id="kw-marke-(schalter|wahl|profil)"/);
  });

  it("die Advisor-Farben stehen in KEINER Stildatei der beiden Oberflächen", () => {
    // Sie kommen im Vertrag vom Server (`marke.farben`) und werden zur Laufzeit gesetzt. Stünden
    // sie hier als Literal, gäbe es einen zweiten, von Hand zu pflegenden Farbsatz — und die
    // Palettensammler (mega43, seitenleiste D3) würden sie zu Recht als zweite Wahrheit melden.
    for (const [name, quelle] of [
      ["panel.css", PANEL_CSS],
      ["taskpane.html <style>", TASKPANE.slice(0, TASKPANE.indexOf("</style>"))],
    ] as const) {
      expect(quelle.toLowerCase(), `${name} führt ein Advisor-Farbliteral`).not.toContain(
        ADVISOR_PRIMAER,
      );
      expect(quelle.toLowerCase(), `${name} führt ein Advisor-Farbliteral`).not.toContain(
        ADVISOR_SCHRIFT,
      );
    }
  });
});

describe("JOB 3512 Q3 · Chrome bleibt buildlos, CSP-treu und ohne neue Rechte", () => {
  it("keine web_accessible_resources, keine content_scripts, kein externally_connectable", () => {
    // Die Logodatei liegt auf einer ERWEITERUNGSSEITE (`panel.html`) und wird relativ geladen —
    // dafür braucht es keine web_accessible_resources. Die stünden nur, wenn eine FREMDE Seite
    // die Datei sehen dürfte, und genau das soll sie nicht (Lieferung 4).
    expect(MANIFEST.web_accessible_resources).toBeUndefined();
    expect(MANIFEST.content_scripts).toBeUndefined();
    expect(MANIFEST.externally_connectable).toBeUndefined();
  });

  it("CSP, Host und Rechte sind wörtlich die bisherigen", () => {
    expect(MANIFEST.content_security_policy.extension_pages).toBe(
      "script-src 'self'; object-src 'none'; connect-src https://app.klarwerk.ai; base-uri 'none'; form-action 'none'",
    );
    expect(MANIFEST.host_permissions).toEqual(["https://app.klarwerk.ai/*"]);
    expect([...MANIFEST.permissions].sort()).toEqual(
      ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"].sort(),
    );
    expect(MANIFEST.optional_permissions).toEqual(["clipboardRead"]);
  });

  it("das Logo wird LOKAL adressiert, nie über app.klarwerk.ai", () => {
    const roh = block(PANEL_JS, "KW-MARKE");
    expect(roh).toContain("marke/advisor/adv-logo.svg");
    // Der Serverpfad aus dem Vertrag (`marke.logo`) wird in der Erweiterung bewusst NICHT als
    // Adresse benutzt — er zeigte auf app.klarwerk.ai und wäre eine Laufzeitabhängigkeit.
    expect(roh).not.toMatch(/https?:\/\//);
    expect(PANEL_HTML).not.toMatch(/<img[^>]*src="https?:/);
  });

  it("kein Webfont, kein externes Stylesheet in der Leiste", () => {
    expect(PANEL_HTML).not.toMatch(/<link[^>]+href="https?:/);
    expect(PANEL_CSS).not.toMatch(/@import|@font-face/);
  });

  it("die Erweiterung färbt nur ihr eigenes Panel — kein CSS in fremde Seiten", () => {
    // `scripting.insertCSS` und `tabs.insertCSS` sind die beiden Wege, auf denen eine Erweiterung
    // eine FREMDE Seite einfärben könnte. Keiner davon steht im Paket, in keiner Datei.
    for (const [name, quelle] of [
      ["worker.js", WORKER],
      ["panel.js", PANEL_JS],
      ["selection.js", lies("extensions/klara-browser/selection.js")],
    ] as const) {
      expect(quelle, `${name} spritzt CSS in eine fremde Seite`).not.toMatch(/insertCSS/);
    }
    // Und der einzige Skripteinsatz in eine Seite bleibt der bestehende Auswahl-Leser.
    expect([...WORKER.matchAll(/files:\s*\[([^\]]*)\]/g)].map((m) => m[1]?.trim())).toEqual([
      '"selection.js"',
    ]);
  });
});

describe("JOB 3512 Q4 · dieselbe Ableitung wie im Web — keine dritte Farbwahrheit", () => {
  it("KALIBRIERUNG: die Rechnung dieser Datei ist die aus marke.css", () => {
    // marke.css leitet den Texton als „0,8 × #0578b7" her und schreibt das Ergebnis #046092
    // ausdrücklich hin. Rechnet diese Datei anders, ist ihre Messung unten wertlos.
    expect(abgetont(ADVISOR_PRIMAER, 0.8)).toBe("#046092");
    expect(MARKE_CSS).toContain("#046092");
    expect(MARKE_CSS).toContain("0,8 × #0578b7");
  });

  it("Word und Chrome rechnen mit demselben Faktor 0.8", () => {
    for (const [name, roh] of [
      ["taskpane.html", block(TASKPANE, "KW-MARKE")],
      ["panel.js", block(PANEL_JS, "KW-MARKE")],
    ] as const) {
      expect(roh, `${name}: der Abtönungsfaktor der Markenebene fehlt`).toContain("0.8");
      expect(roh, `${name}: die Deckung des Knopfscheins fehlt`).toContain("0.45");
    }
  });

  it("die abgeleiteten Töne tragen Text nach AA", () => {
    // #046092 ist der Ton, der als TEXT wirkt (`--brand-text`) und als Knopffläche (`--brand-deep`).
    const text = abgetont(ADVISOR_PRIMAER, 0.8);
    expect(kontrast(text, "#faf8f5"), "Markentext auf Papier").toBeGreaterThanOrEqual(4.5);
    expect(kontrast(text, "#ffffff"), "Markentext auf Karte").toBeGreaterThanOrEqual(4.5);
    expect(kontrast("#ffffff", text), "Weiß auf der Knopffläche").toBeGreaterThanOrEqual(4.5);
  });

  it("die zweite belegte Farbe trägt als Überschriftenton", () => {
    // #161417 ersetzt `--ink` (Überschriften). Beide Flächen der Klara-Oberflächen sind hell.
    expect(kontrast(ADVISOR_SCHRIFT, "#faf8f5"), "Schriftton auf Papier").toBeGreaterThanOrEqual(7);
    expect(kontrast(ADVISOR_SCHRIFT, "#ffffff"), "Schriftton auf Karte").toBeGreaterThanOrEqual(7);
  });
});
