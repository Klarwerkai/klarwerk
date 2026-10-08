// ================================================================================================
// AUFNAHME gesamt-geheimnisse-betrieb · GEHEIMNISSE NUR IN DER BETRIEBSUMGEBUNG.
// ================================================================================================
//
// Pedi, 30.07. (OFFEN.md C2/E10): Zugangsdaten bleiben in der Umgebungsvariable. Was daran
// maschinell prüfbar ist, steht hier — und nur das, was die vorhandenen Wächter NICHT schon tragen:
//
//  · Das Feld-Verbot und die Zustandsanzeige belegen die montierten Flächentests
//    (tests/app/mega67-zugang-flaeche-mounted.test.tsx, tests/sharepoint-onedrive-import/…).
//  · Modell-Egress und Modellschlüssel nur im Chokepoint belegt tests/security/egress-chokepoint.test.ts
//    — dort aber nur für `.ts`. Die Web-Oberfläche besteht fast ganz aus `.tsx`; G4 schließt das.
//
// NEU hier:
//  G1 · Das Handbuch (docs/operations/secrets-management.md) führt JEDES Geheimnis des Startvertrags
//       mit Art und echter Wechselfrist — und keines, das es nicht gibt. Sonst läuft das Inventar still
//       auseinander, sobald eine Variable dazukommt.
//  G3 · Kein echtes Schlüsselmaterial im Produktbaum (NFR-SEC-05: „kein Secret im Repo/Build").
//  G4/G5 · Der Weg ins Client-Bundle ist für Geheimnisse zu (FR-RSN-06).
//  G6 · Das gebaute Bundle selbst, wenn es vorliegt.
//
// DIE PRÜFUNG GIBT NIE EINEN WERT AUS. Ein Treffer meldet Datei und Musterart, nicht die Fundstelle
// — eine Prüfzeile, die einen Schlüssel anfasst, darf ihn nicht ins Protokoll schreiben (OFFEN.md I56).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTVERTRAG } from "../../services/app/src/start-vertrag";
import { ANSWER_RECEIPT_TTL_MS } from "../../services/ask/src/receipt";

const REPO = join(__dirname, "..", "..");
const HANDBUCH = readFileSync(join(REPO, "docs", "operations", "secrets-management.md"), "utf8");
const GEHEIM = STARTVERTRAG.filter((w) => w.geheim).map((w) => w.name);

// ------------------------------------------------------------------------------------------------
// Muster echten Schlüsselmaterials. Bewusst auf volle Länge: ein Präfix in Erklärtext oder
// Platzhalter („…-DEIN-KEY“) ist kein Schlüssel und soll hier nicht rot werden.
// ------------------------------------------------------------------------------------------------
const SCHLUESSELMUSTER: { art: string; muster: RegExp }[] = [
  { art: "Anthropic-Schlüssel", muster: /sk-ant-[A-Za-z0-9_-]{40,}/ },
  { art: "OpenAI-Projektschlüssel", muster: /sk-proj-[A-Za-z0-9_-]{40,}/ },
  { art: "OpenAI-Schlüssel", muster: /\bsk-[A-Za-z0-9]{40,}/ },
  { art: "GitHub-Token", muster: /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36,}/ },
  { art: "GitHub-Feintoken", muster: /github_pat_[A-Za-z0-9_]{60,}/ },
  { art: "AWS-Zugangskennung", muster: /\bAKIA[0-9A-Z]{16}\b/ },
  { art: "Slack-Token", muster: /\bxox[baprs]-[A-Za-z0-9-]{20,}/ },
  { art: "Google-API-Schlüssel", muster: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { art: "PEM-Privatschlüssel", muster: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

// KI- und E-Mail-Aufrufe laufen über den Server: in der Web-Oberfläche kein Anbieter-Host, kein
// Anbieter-SDK, kein Mailer.
const ANBIETER_EGRESS: RegExp[] = [
  /api\.anthropic\.com/,
  /api\.openai\.com/,
  /generativelanguage\.googleapis/,
  /@anthropic-ai\/sdk/,
  /from\s+["']openai["']/,
  /nodemailer/,
];

function schluesselArten(inhalt: string): string[] {
  return SCHLUESSELMUSTER.filter(({ muster }) => muster.test(inhalt)).map(({ art }) => art);
}

// Was NICHT zum Produktbaum gehört: Abhängigkeiten, Build-Ausgaben (G6 prüft das Bundle eigens),
// Laufzeit- und Agentenreste — dieselben Orte, die `.gitignore` ausschließt. `.env`/`.env.local` sind
// die ERLAUBTEN lokalen Ablageorte (Handbuch §2) und werden deshalb nicht gelesen.
const NICHT_PRODUKTBAUM = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
  ".local",
  ".localdb",
  "_relay",
  "LOT",
  ".claude",
  ".codex",
]);
// `.run-state` ist der Laufzustand der Desktop-App, ebenfalls ignoriert und nie Quellstand.
const NICHT_GELESEN = new Set([".env", ".env.local", ".run-state"]);
const wirdGelesen = (name: string): boolean => !NICHT_GELESEN.has(name) && !name.endsWith(".log");
const GROESSTE_DATEI = 16 * 1024 * 1024;

function dateien(wurzel: string, ausschluss: ReadonlySet<string>, out: string[] = []): string[] {
  for (const eintrag of readdirSync(wurzel, { withFileTypes: true })) {
    // Symlinks (etwa ein geteiltes node_modules in Bahn-Klonen) gehören nicht zum Baum.
    if (eintrag.isSymbolicLink() || ausschluss.has(eintrag.name)) {
      continue;
    }
    const voll = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) {
      dateien(voll, ausschluss, out);
    } else if (eintrag.isFile() && wirdGelesen(eintrag.name)) {
      out.push(voll);
    }
  }
  return out;
}

/** Datei → gefundene Musterarten. Binärdateien (NUL-Byte) werden übersprungen. */
function funde(liste: string[]): { datei: string; arten: string[] }[] {
  const ergebnis: { datei: string; arten: string[] }[] = [];
  for (const datei of liste) {
    if (statSync(datei).size > GROESSTE_DATEI) {
      continue;
    }
    const roh = readFileSync(datei);
    if (roh.includes(0)) {
      continue;
    }
    const arten = schluesselArten(roh.toString("utf8"));
    if (arten.length > 0) {
      ergebnis.push({ datei: relative(REPO, datei).replaceAll("\\", "/"), arten });
    }
  }
  return ergebnis;
}

// ------------------------------------------------------------------------------------------------
// Handbuch §1 — die Inventartabelle der Umgebungsvariablen.
// ------------------------------------------------------------------------------------------------
function abschnitt(text: string, von: string, bis: string): string {
  const start = text.indexOf(von);
  const ende = text.indexOf(bis, start + von.length);
  return start < 0 ? "" : text.slice(start, ende < 0 ? undefined : ende);
}

/** Zeilen der Tabelle „Art | Geheimnis | Variable | Ohne Wert | Regulärer Wechsel | Folge“. */
function inventarZeilen(): { art: string; variable: string; wechsel: string; folge: string }[] {
  return abschnitt(HANDBUCH, "## 1. ", "## 1a. ")
    .split("\n")
    .filter((z) => z.startsWith("|"))
    .map((z) =>
      z
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    )
    .filter((zellen) => zellen.length === 6 && /^[0-4]$/.test(zellen[0] ?? ""))
    .map((zellen) => ({
      art: zellen[0] ?? "",
      // Die erste Variable der Zelle ist das Geheimnis; Klammerzusätze nennen Begleitwerte.
      variable: /`([A-Z][A-Z0-9_]*)`/.exec(zellen[2] ?? "")?.[1] ?? "",
      wechsel: zellen[4] ?? "",
      folge: zellen[5] ?? "",
    }))
    .filter((z) => z.variable !== "");
}

describe("Geheimnisse nur in der Betriebsumgebung", () => {
  it("G0 · die Erhebungen greifen überhaupt", () => {
    // Ein leerer Startvertrag oder eine nicht gefundene Tabelle darf nicht still grün sein.
    expect(GEHEIM.length).toBeGreaterThanOrEqual(10);
    expect(inventarZeilen().length).toBeGreaterThanOrEqual(10);
    // Die Muster erkennen echte Formen — zur Laufzeit zusammengesetzt, damit diese Datei selbst
    // keinen Treffer trägt.
    const attrappe = (kopf: string): string => `${kopf}${"Ab3".repeat(15)}`;
    expect(schluesselArten(attrappe("sk-ant-"))).toContain("Anthropic-Schlüssel");
    expect(schluesselArten(attrappe("sk-proj-"))).toContain("OpenAI-Projektschlüssel");
    const pem = ["-----BEGIN", "PRIVATE", "KEY-----"].join(" ");
    expect(schluesselArten(pem)).toContain("PEM-Privatschlüssel");
    // … und keine Platzhalter oder Präfixe in Erklärtext.
    expect(schluesselArten("ANTHROPIC_API_KEY=sk-ant-DEIN-KEY")).toEqual([]);
    expect(schluesselArten("beginnt mit sk-ant-…")).toEqual([]);
  });

  it("G1 · das Handbuch führt jedes Geheimnis des Startvertrags mit Art und Wechselfrist", () => {
    const zeilen = inventarZeilen();
    const imHandbuch = new Map(zeilen.map((z) => [z.variable, z]));
    expect(GEHEIM.filter((name) => !imHandbuch.has(name))).toEqual([]);
    // R-0858: JEDES Geheimnis wird regelmäßig gewechselt. Verlangt ist eine echte Frist — ein
    // reiner Anlass („nur bei Verdacht“) oder ein beliebiger Text genügt nicht.
    const FRIST = /(?:≤|spätestens)\s*\d+\s*Monate|\bjährlich\b/;
    expect(zeilen.filter((z) => !FRIST.test(z.wechsel)).map((z) => z.variable)).toEqual([]);
    expect(zeilen.filter((z) => /^nur bei\b/i.test(z.wechsel)).map((z) => z.variable)).toEqual([]);
    expect(zeilen.filter((z) => z.folge.length < 5).map((z) => z.variable)).toEqual([]);
    // Belegsignatur: Die Folge des Wechsels nennt die Gültigkeit, die der Code wirklich hat.
    const minuten = ANSWER_RECEIPT_TTL_MS / 60_000;
    const beleg = imHandbuch.get("KLARWERK_ASK_RECEIPT_SECRET");
    expect(beleg?.folge).toContain(`${minuten} Minuten`);
    // Und keine Zeile für ein Geheimnis, das der Code gar nicht liest.
    const imVertrag = new Set(GEHEIM);
    expect(zeilen.map((z) => z.variable).filter((name) => !imVertrag.has(name))).toEqual([]);
  });

  it("G2 · das Handbuch hält Grundentscheidung, Erhebung und Notfallwechsel fest", () => {
    expect(HANDBUCH).toContain("Kein Feld der Oberfläche nimmt je ein Geheimnis entgegen");
    expect(HANDBUCH).toContain("## 1a. Erhebungsprotokoll");
    const wechsel = abschnitt(HANDBUCH, "## 7. ", "## 7a. ");
    expect(wechsel).toContain("**Notfallwechsel**");
    // Der Notfallumfang folgt den tatsächlichen Zugriffswegen, nicht einer behaupteten Rangfolge;
    // die weitergehende Rotation ist als Betriebsregel gekennzeichnet.
    const ordnung = abschnitt(HANDBUCH, "## 1. ", "## 1a. ");
    expect(ordnung).toContain("**Tatsächliche Zugriffswege.**");
    expect(ordnung).toContain("**Vorsorgliche Betriebsregel");
    expect(wechsel).toContain("Zugriffswege");
    expect(HANDBUCH).not.toMatch(/alle Werte der tieferen Ebenen|kann die Werte der\s+tieferen/);
    expect(HANDBUCH).toContain("## 7a. Eigene Schlüssel der Kunden");
  });

  it("G3 · kein echtes Schlüsselmaterial im Produktbaum", () => {
    const liste = dateien(REPO, NICHT_PRODUKTBAUM);
    expect(liste.length).toBeGreaterThan(1000);
    expect(funde(liste)).toEqual([]);
    // Schlüsseldateien gehören nie in den Baum, egal was in ihnen steht.
    const schluesseldateien = liste
      .filter((d) => /\.(pem|key|p12|pfx|jks|keystore)$/i.test(d))
      .map((d) => relative(REPO, d));
    expect(schluesseldateien).toEqual([]);
  });

  it("G4 · die Web-Oberfläche liest keine Umgebung und spricht nur mit dem eigenen Server", () => {
    const quellen = dateien(join(REPO, "apps", "web", "src"), NICHT_PRODUKTBAUM).filter(
      (d) => /\.(ts|tsx)$/.test(d) && !/\.(test|spec)\.(ts|tsx)$/.test(d),
    );
    expect(quellen.length).toBeGreaterThan(100);
    const verstoesse: string[] = [];
    for (const datei of quellen) {
      const inhalt = readFileSync(datei, "utf8");
      const name = relative(REPO, datei).replaceAll("\\", "/");
      // Nur die Build-Flags, die Vite selbst setzt — nie ein Wert aus der Umgebung.
      for (const [, feld] of inhalt.matchAll(/import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (!["DEV", "PROD", "MODE", "BASE_URL", "SSR"].includes(feld ?? "")) {
          verstoesse.push(`${name}: import.meta.env.${feld}`);
        }
      }
      if (/\bprocess\.env\b/.test(inhalt)) {
        verstoesse.push(`${name}: process.env`);
      }
      if (ANBIETER_EGRESS.some((muster) => muster.test(inhalt))) {
        verstoesse.push(`${name}: Anbieter-Egress`);
      }
      // Der Browser spricht nur mit dem eigenen Server (`/api`), nie mit einer absoluten Adresse.
      if (/(?:fetch|EventSource|WebSocket)\(\s*["'`](?:https?|wss?):\/\//.test(inhalt)) {
        verstoesse.push(`${name}: Aufruf an absolute Adresse`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("G5 · der Bundle-Bau reicht kein Geheimnis durch", () => {
    // Vite bündelt nur `VITE_*`-Variablen (Vorgabe von envPrefix). Kein Geheimnis darf so heißen,
    // und die Konfiguration darf den Präfix nicht aufweiten oder Werte per `define` einsetzen.
    expect(GEHEIM.filter((name) => name.startsWith("VITE_"))).toEqual([]);
    const konfiguration = readFileSync(join(REPO, "apps", "web", "vite.config.ts"), "utf8");
    expect(konfiguration).not.toMatch(/\benvPrefix\b/);
    expect(konfiguration).not.toMatch(/\bdefine\s*:/);
    expect(konfiguration).not.toMatch(/\bloadEnv\b/);
  });

  it("G7 · kein Feld der Oberfläche nimmt ein Betriebsgeheimnis entgegen", () => {
    // Die beiden Zugangskarten zeigen nur Zustand und Variablennamen. Die montierte Prüfung der
    // Confluence-Karte steht in tests/app/mega67-zugang-flaeche-mounted.test.tsx; für die
    // SharePoint-Karte gab es keine — beide werden hier an der Quelle gehalten.
    const karten = [
      "apps/web/src/components/ImportAccessPanel.tsx",
      "apps/web/src/components/sharepoint-import/SharePointZugangKarte.tsx",
    ];
    for (const karte of karten) {
      // Kommentare erklären das Verbot und nennen dabei `<input>` — gezählt wird nur der Code.
      const code = readFileSync(join(REPO, karte), "utf8")
        .split("\n")
        .filter((zeile) => !/^\s*(\/\/|\/?\*|\{\/\*)/.test(zeile))
        .join("\n");
      expect(code, karte).not.toMatch(/<(input|form|textarea|select)\b|<TextInput\b|<Field\b/);
    }
    // Kennwortfelder gibt es nur für das EIGENE Anmeldekennwort von Personen (Anmelden, Zurücksetzen,
    // Profil, Konten, Rückbestätigung vor dem Werkszustand) — nie für einen Zugang der Installation.
    const kennwortFlaechen = dateien(join(REPO, "apps", "web", "src"), NICHT_PRODUKTBAUM)
      .filter((d) => /\.tsx$/.test(d) && !/\.test\.tsx$/.test(d))
      .filter((d) => /type=["']password["']/.test(readFileSync(d, "utf8")))
      .map((d) => relative(REPO, d).replaceAll("\\", "/"))
      .sort();
    expect(kennwortFlaechen).toEqual([
      "apps/web/src/auth/AuthScreens.tsx",
      "apps/web/src/auth/ResetScreen.tsx",
      "apps/web/src/pages/AdminDatenDetails.tsx",
      "apps/web/src/pages/AdminKontenDetails.tsx",
      "apps/web/src/pages/Profile.tsx",
    ]);
  });

  // Das gebaute Bundle liegt nur nach `tools/build` vor. Fehlt es, meldet Vitest den Fall als
  // übersprungen — er wird nicht als bestanden gezählt.
  const BUNDLE = join(REPO, "apps", "web", "dist");
  it.skipIf(!existsSync(BUNDLE))("G6 · das gebaute Bundle trägt keinen Schlüssel", () => {
    const liste = dateien(BUNDLE, new Set(["node_modules"]));
    expect(liste.length).toBeGreaterThan(0);
    expect(funde(liste)).toEqual([]);
  });
});
