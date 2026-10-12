// ================================================================================================
// R-1136 (aufnahme:20260922:gesamt-rechte-inventar) — WELCHE RECHTE UND FUNKTIONSSCHALTER DER
// SERVER ÜBERHAUPT KENNT, ALS PRÜFBARES VERZEICHNIS.
// ================================================================================================
//
// Bis hierher stand das Wissen darüber an fünf Stellen, und keine sagte, ob sie vollständig ist:
// die Rechtematrix (`services/rbac/src/policy.ts`), eine ABGESCHRIEBENE Rechteliste im Routen-Audit
// (`KNOWN_PERMISSIONS`, an nichts gebunden), die Schlüsselrechte der angebundenen Systeme
// (`dienst-schluessel.ts`, `addon-principal.ts`), das Schalter-Registry (`feature-flags.ts`) — und
// zahlreiche Ein/Aus-Schalter, die ihr Modul SELBST liest (`addonApiEnabled`, `slidesEnabled`,
// `selfRegistrationEnabled`, …) und die in keinem Verzeichnis als Schalter stehen.
//
// DIESE DATEI IST DAS VERZEICHNIS — und ein Sammler, der es gegen den Server hält. Die Einträge unten
// sind die Aussage; jede Richtung ist rot, in der Server und Verzeichnis auseinanderlaufen:
//
//   V1 — ein Recht, das der Server kennt (Typ `Permission`, Matrix, ein Aufruf von
//        `requirePermission`/`can`), fehlt hier — oder hier steht eines, das er nicht kennt.
//   V2 — ein Schlüsselrecht (`DIENST_RECHTE`, Typ `AddonCapability`) fehlt oder öffnet andere Routen.
//   V3 — ein Funktionsschalter fehlt. Erhoben wird aus DREI Quellen: das Registry, die
//        Ausnahmeschalter des Startvertrags und — selbst, über den Syntaxbaum von `services/**` —
//        jede Stelle, die eine Umgebungsvariable mit einem Ja/Nein-Wert vergleicht. Eine Lesung,
//        deren Variablenname sich nicht auflösen lässt, ist rot mit Datei und Zeile.
//
// BENANNTE GRENZEN:
//   · Ein SCHALTER ist hier ein ausdrücklicher Ja/Nein-Vergleich (`"1"`, `"true"`, `"aus"`, `"off"`,
//     …). Ein Wert, dessen bloße ANWESENHEIT eine Fähigkeit freischaltet (`OIDC_ISSUER`,
//     `SMTP_HOST`, Schlüssel), ist Konfiguration und steht im Startvertrag mit seinem „ohne ihn".
//   · Erkannt werden Vergleiche auf `process.env.X`, `env.X`, `env[KONSTANTE]` und auf lokale
//     Konstanten, die daraus entstehen (auch über `?.trim()`/`.toLowerCase()`). Ein Wert, der über
//     ein Optionsobjekt weitergereicht und dort verglichen wird, ist nicht erfassbar — der eine Fall
//     im Bestand (`KLARWERK_ALLOW_INMEMORY_PROD` → `storage-guard.ts`) kommt über den Startvertrag.
//   · Rollen-Sonderwege ausserhalb der Matrix (z. B. „nur der Autor") sind Zeilenrechte und stehen
//     im Lesewege-Register (`mega74-lesewege-sammler.test.ts`), nicht hier.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ADDON_CAPABILITIES } from "../../services/app/src/addon-principal";
import { DIENST_RECHTE, DIENST_ROUTEN } from "../../services/app/src/dienst-schluessel";
import {
  SCHALTER_REGISTRY,
  schalterZustand,
  schalterZustandVorAnmeldung,
  vorgabeAn,
} from "../../services/app/src/feature-flags";
import { STARTVERTRAG } from "../../services/app/src/start-vertrag";
import { ROLE_PERMISSIONS } from "../../services/rbac/src/policy";
import { REPO_WURZEL } from "../support/repoPfad";
import { KNOWN_PERMISSIONS, ROUTE_GUARD_MATRIX, routeKey } from "./routeGuardAudit";
import { zeichenkettenKonstanten } from "./schnittstellenErhebung";

type Rolle = keyof typeof ROLE_PERMISSIONS;

// ================================================================================================
// DAS VERZEICHNIS
// ================================================================================================

/** Teil 1 — die Rollenrechte (RBAC): Recht → die Rollen, die es tragen, und wofür es steht. */
const ROLLENRECHTE: Record<string, { rollen: readonly Rolle[]; wofuer: string }> = {
  "ko.read": {
    rollen: ["viewer", "experte", "controller", "admin"],
    wofuer: "Wissen lesen, suchen, fragen; die Grundtür fast jedes Lesewegs.",
  },
  "ko.create": {
    rollen: ["experte", "controller", "admin"],
    wofuer: "Beiträge, Entwürfe und Importkandidaten einreichen.",
  },
  "ko.validate": {
    rollen: ["controller", "admin"],
    wofuer: "Über fremde Beiträge urteilen, kuratieren; sieht Vertrauliches (sichtbarkeit.ts).",
  },
  "ko.assign": {
    rollen: ["controller", "admin"],
    wofuer: "Prüfungen, Lücken und Kenntnisnahmen zuweisen.",
  },
  "ko.relate": {
    rollen: ["controller", "admin"],
    wofuer: "Zwei Einträge fachlich verbinden und die Verbindung widerrufen (JOB 4151).",
  },
  "conflict.resolve": {
    rollen: ["controller", "admin"],
    wofuer: "Konflikte eskalieren und verwerfen.",
  },
  "users.manage": {
    rollen: ["admin"],
    wofuer: "Konten, Einstellungen, Importe, Demodaten und Betrieb verwalten.",
  },
};

/** Teil 2 — die Schlüsselrechte angebundener Systeme (kein Konto, eigener Schlüssel). */
const SCHLUESSELRECHTE: Record<string, { klaraSchluessel: boolean; routen: readonly string[] }> = {
  "ask.validated": { klaraSchluessel: true, routen: ["POST /api/ask"] },
  "checktext.validated": { klaraSchluessel: true, routen: ["POST /api/check-text"] },
  "export.validated": { klaraSchluessel: false, routen: ["GET /api/library/export"] },
  "import.kandidaten": { klaraSchluessel: false, routen: ["POST /api/library/import/candidates"] },
  "status.read": { klaraSchluessel: false, routen: ["GET /health", "GET /api/reasoner/status"] },
  // R-0713 (integrierter Hauptstand): der MCP-Zugang für fremde KI-Programme (mcp-routes.ts).
  "mcp.werkzeug": { klaraSchluessel: false, routen: ["GET /mcp", "POST /mcp"] },
};

/** Teil 3a — das Schalter-Registry: Fachname → Variable, Vorgabe, Auskunft vor der Anmeldung. */
const REGISTRY_SCHALTER: Record<
  string,
  { variable: string; vorgabeAn: boolean; vorAnmeldung: boolean }
> = {
  herkunft: { variable: "KLARWERK_PROVENANCE_ENABLED", vorgabeAn: false, vorAnmeldung: false },
  confluenceImport: {
    variable: "KLARWERK_CONFLUENCE_IMPORT",
    vorgabeAn: false,
    vorAnmeldung: false,
  },
  sharepointImport: {
    variable: "KLARWERK_SHAREPOINT_IMPORT",
    vorgabeAn: false,
    vorAnmeldung: false,
  },
  jiraImport: { variable: "KLARWERK_JIRA_IMPORT", vorgabeAn: false, vorAnmeldung: false },
  expertMatching: { variable: "KLARWERK_EXPERT_MATCHING", vorgabeAn: false, vorAnmeldung: false },
  rechtsseiten: { variable: "KLARWERK_RECHTSSEITEN", vorgabeAn: true, vorAnmeldung: true },
  hinweisbanner: { variable: "KLARWERK_HINWEISBANNER", vorgabeAn: true, vorAnmeldung: true },
  demodaten: { variable: "KLARWERK_DEMO_SEED", vorgabeAn: false, vorAnmeldung: false },
};

type Schalterquelle = "registry" | "startvertrag" | "direkt";

/**
 * Teil 3b — JEDER Funktionsschalter, den der Server liest: Variable → aus welchen Quellen er
 * erhoben wird und was er schaltet. `direkt` heisst: das Modul vergleicht ihn selbst mit Ja/Nein.
 */
const SCHALTER: Record<
  string,
  { quellen: readonly Schalterquelle[]; wofuer: string; nurTest?: true }
> = {
  KLARWERK_PROVENANCE_ENABLED: { quellen: ["registry"], wofuer: "Herkunftskette (Route, Fläche)." },
  KLARWERK_CONFLUENCE_IMPORT: {
    quellen: ["registry", "direkt"],
    wofuer: "Confluence-Import; der Adapter liest ihn zusätzlich selbst (adapter.ts).",
  },
  KLARWERK_SHAREPOINT_IMPORT: { quellen: ["registry"], wofuer: "SharePoint-/OneDrive-Import." },
  KLARWERK_JIRA_IMPORT: { quellen: ["registry"], wofuer: "Jira-Import (drei Routen)." },
  KLARWERK_EXPERT_MATCHING: { quellen: ["registry"], wofuer: "Thema-zu-Personen-Zuordnung." },
  KLARWERK_RECHTSSEITEN: { quellen: ["registry"], wofuer: "Notausschalter der Rechtsseiten." },
  KLARWERK_HINWEISBANNER: { quellen: ["registry"], wofuer: "Notausschalter des Hinweises." },
  KLARWERK_DEMO_SEED: { quellen: ["registry"], wofuer: "Laden der Demodaten (legt Konten an)." },
  KLARWERK_ALLOW_INMEMORY_PROD: {
    quellen: ["startvertrag"],
    wofuer: "Bewusster Produktionsstart ohne Datenbank (Ausnahme der DATABASE_URL-Pflicht).",
  },
  KLARWERK_ADDON_API: { quellen: ["direkt"], wofuer: "Add-on-API und Add-in-Auslieferung." },
  KLARWERK_SLIDES_ENABLED: { quellen: ["direkt"], wofuer: "Folien-Konvertierung (sonst 503)." },
  KLARWERK_SELF_REGISTRATION: { quellen: ["direkt"], wofuer: "Selbstregistrierung von Konten." },
  KLARWERK_DUP_PREFILTER: { quellen: ["direkt"], wofuer: "Semantischer Dubletten-Vorfilter." },
  KLARWERK_AUSGANGSPRUEFUNG: { quellen: ["direkt"], wofuer: "Ausgangsprüfung vor externer KI." },
  KLARWERK_KI_ANFRAGEN_MAX: {
    quellen: ["direkt"],
    wofuer: "Grenze der KI-Anfragen; „aus“ schaltet die Bremse ab (ki-anfragebremse.ts).",
  },
  KLARWERK_DEV_PERSIST: { quellen: ["direkt"], wofuer: "Dev-Journal ohne Datenbank." },
  KLARWERK_TRUST_PROXY: {
    quellen: ["direkt"],
    wofuer: "Vertraute Proxys; die Ja/Nein-Werte werden ausdrücklich ABGEWIESEN (spoofbar).",
  },
  EXTERNAL_SEARCH: { quellen: ["direkt"], wofuer: "„off“ schaltet die externe Suche ab (501)." },
  OIDC_AUTOPROVISION: { quellen: ["direkt"], wofuer: "SSO legt unbekannte Konten selbst an." },
  // Nacharbeit 12 (Integration Hauptstand): R-0560 SAML und R-0541 Firmenanmeldung aus main.
  SAML_AUTOPROVISION: {
    quellen: ["direkt"],
    wofuer: "SAML-Anmeldung legt unbekannte Konten selbst an (saml.ts).",
  },
  KLARWERK_SSO_ONLY: {
    quellen: ["direkt"],
    wofuer: "Sperrt die Passwortanmeldung; nur der Firmen-Login gilt (auth/routes.ts).",
  },
  OIDC_REQUIRE_EMAIL_VERIFIED: {
    quellen: ["direkt"],
    wofuer: "SSO verlangt eine bestätigte E-Mail (nur „false“ schaltet ab).",
  },
  SMTP_SECURE: { quellen: ["direkt"], wofuer: "TLS für den Mailversand." },
  COOKIE_SECURE: { quellen: ["direkt"], wofuer: "Secure-Attribut des Sitzungscookies." },
  SEED_ALLOW_PROD: { quellen: ["direkt"], wofuer: "Seed-Skript auch in Produktion." },
  KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE: {
    quellen: ["direkt"],
    wofuer: "Nur Testläufe: zerstörender Zugriff auf die Wegwerf-Datenbank.",
    nurTest: true,
  },
};

/**
 * Der eine Schalter, den der Startvertrag noch führt, obwohl ihn KEINE Zeile mehr liest — benannt
 * in `start-vertrag.ts` (Abschnitt „JOB 4365 · ABGELÖST") samt Grund, warum er noch dort steht.
 */
const ABGELOESTE_SCHALTER = ["KLARWERK_DEMO_INSTANZ"] as const;

/**
 * Unlesbare Schalterlesungen, die ANDERSWO vollständig erhoben sind — nur mit Grund. Der
 * Registry-Leser greift `process.env[SCHALTER_REGISTRY[name]]` zu; das Registry selbst ist Quelle
 * `registry` und wird oben Eintrag für Eintrag gegen den Server gehalten.
 */
const UNLESBAR_GEDECKT: Record<string, string> = {
  "services/app/src/feature-flags.ts":
    "Registry-Leser `schalterAn`: der Variablenname kommt aus SCHALTER_REGISTRY (Teil 3a).",
};

/**
 * BEFUND, NICHT BEHOBEN: Schalter, die der Server liest, die der Startvertrag aber nicht führt.
 * Der Startvertrag gehört JOB 3655 und ist an `env.demo.beispiel` gebunden; sein eigener Sammler
 * (`tests/demo-zugang-start/vertrag-vollstaendig.test.ts`, D1) erhebt `env.KLARWERK_KI_ANFRAGEN_MAX`
 * aus `ki-anfragebremse.ts` und verlangt den Eintrag dort. Dieser Eintrag hier hält die Lücke
 * sichtbar — und wird rot, sobald sie geschlossen ist (dann streichen).
 */
const OHNE_STARTVERTRAG: Record<string, string> = {
  KLARWERK_KI_ANFRAGEN_MAX:
    "ki-anfragebremse.ts:48/51 liest ihn; kein Startvertragseintrag (Quelleninspektion 41ba0b7f).",
};

// ================================================================================================
// DIE ERHEBUNG
// ================================================================================================

function produktquellen(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name === "dist") {
      continue;
    }
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...produktquellen(pfad));
    } else if (
      eintrag.name.endsWith(".ts") &&
      !eintrag.name.endsWith(".test.ts") &&
      !eintrag.name.endsWith(".d.ts")
    ) {
      gefunden.push(pfad);
    }
  }
  return gefunden;
}

const QUELLEN = produktquellen(join(REPO_WURZEL, "services")).map((pfad) => ({
  datei: relative(REPO_WURZEL, pfad),
  text: readFileSync(pfad, "utf8"),
}));

/** Die Mitglieder einer Union aus Zeichenkettenliteralen — auch `typeof KONSTANTE`. */
function zeichenkettenUnion(datei: string, typname: string): string[] {
  const sf = ts.createSourceFile(
    datei,
    readFileSync(join(REPO_WURZEL, datei), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const konstanten = zeichenkettenKonstanten(sf);
  for (const anweisung of sf.statements) {
    if (ts.isTypeAliasDeclaration(anweisung) && anweisung.name.text === typname) {
      const glieder: readonly ts.TypeNode[] = ts.isUnionTypeNode(anweisung.type)
        ? anweisung.type.types
        : [anweisung.type];
      return glieder.map((glied) => {
        if (ts.isLiteralTypeNode(glied) && ts.isStringLiteral(glied.literal)) {
          return glied.literal.text;
        }
        if (ts.isTypeQueryNode(glied) && ts.isIdentifier(glied.exprName)) {
          const wert = konstanten.get(glied.exprName.text);
          if (wert !== undefined) {
            return wert;
          }
        }
        throw new Error(`${datei}: ein Glied von \`${typname}\` ist nicht lesbar`);
      });
    }
  }
  throw new Error(`${datei}: \`type ${typname}\` nicht gefunden — die Erhebung greift nicht`);
}

/** Jedes Rechte-Literal, das an `requirePermission(…)` oder `can(…)` geht — mit Fundstelle. */
function erhebeRechteaufrufe(datei: string, text: string): { recht: string; ort: string }[] {
  if (!/\b(requirePermission|can)\(/.test(text)) {
    return [];
  }
  const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);
  const funde: { recht: string; ort: string }[] = [];
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const aufgerufen = ts.isIdentifier(n.expression)
        ? n.expression.text
        : ts.isPropertyAccessExpression(n.expression)
          ? n.expression.name.text
          : "";
      if (aufgerufen === "requirePermission" || aufgerufen === "can") {
        for (const arg of n.arguments) {
          if (ts.isStringLiteral(arg) && /^[a-z]+\.[a-z]+$/.test(arg.text)) {
            const zeile = sf.getLineAndCharacterOfPosition(arg.getStart(sf)).line + 1;
            funde.push({ recht: arg.text, ort: `${datei}:${zeile}` });
          }
        }
      }
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return funde;
}

/** Die Werte, mit denen ein Ja/Nein-Schalter verglichen wird. */
const SCHALTERWERTE = new Set([
  "1",
  "0",
  "true",
  "false",
  "an",
  "aus",
  "on",
  "off",
  "ja",
  "nein",
  "yes",
  "no",
]);
const VORPRUEFUNG =
  /(===|!==|==|!=)\s*["'`](1|0|true|false|an|aus|on|off|ja|nein|yes|no)["'`]|["'`](1|0|true|false|an|aus|on|off|ja|nein|yes|no)["'`]\s*(===|!==|==|!=)/;
const VARIABLENFORM = /^[A-Z][A-Z0-9_]{2,}$/;
const FORMER = new Set(["trim", "toLowerCase", "toUpperCase", "toLocaleLowerCase"]);
const VERGLEICHE = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** `process.env` oder ein Bezeichner `env` (der durchgereichte Umgebungssatz dieses Hauses). */
function istUmgebung(n: ts.Expression): boolean {
  if (ts.isIdentifier(n)) {
    return n.text === "env";
  }
  return (
    ts.isPropertyAccessExpression(n) &&
    ts.isIdentifier(n.expression) &&
    n.expression.text === "process" &&
    n.name.text === "env"
  );
}

/** Die nächste `const`/`let`-Deklaration dieses Namens in einem umschließenden Block. */
function deklaration(name: ts.Identifier): ts.Expression | undefined {
  for (let p: ts.Node | undefined = name.parent; p; p = p.parent) {
    if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isModuleBlock(p)) {
      for (const anweisung of p.statements) {
        if (!ts.isVariableStatement(anweisung)) {
          continue;
        }
        for (const d of anweisung.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === name.text && d.initializer) {
            return d.initializer;
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Ist dieser Ausdruck eine Umgebungslesung? Name der Variablen; `null` = Umgebungslesung, deren
 * Name sich nicht auflösen lässt; `undefined` = keine Umgebungslesung.
 */
function umgebungslesung(
  n: ts.Expression,
  konstanten: ReadonlyMap<string, string>,
  tiefe = 0,
): string | null | undefined {
  let x = n;
  for (;;) {
    if (ts.isParenthesizedExpression(x) || ts.isNonNullExpression(x) || ts.isAsExpression(x)) {
      x = x.expression;
    } else if (
      ts.isCallExpression(x) &&
      x.arguments.length === 0 &&
      ts.isPropertyAccessExpression(x.expression) &&
      FORMER.has(x.expression.name.text)
    ) {
      x = x.expression.expression;
    } else if (
      ts.isBinaryExpression(x) &&
      x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      x = x.left;
    } else {
      break;
    }
  }
  if (ts.isPropertyAccessExpression(x) && istUmgebung(x.expression)) {
    return VARIABLENFORM.test(x.name.text) ? x.name.text : undefined;
  }
  if (ts.isElementAccessExpression(x) && istUmgebung(x.expression)) {
    const schluessel = x.argumentExpression;
    if (ts.isStringLiteral(schluessel) || ts.isNoSubstitutionTemplateLiteral(schluessel)) {
      return schluessel.text;
    }
    return ts.isIdentifier(schluessel) ? (konstanten.get(schluessel.text) ?? null) : null;
  }
  if (ts.isIdentifier(x) && tiefe < 4) {
    const anfang = deklaration(x);
    return anfang ? umgebungslesung(anfang, konstanten, tiefe + 1) : undefined;
  }
  return undefined;
}

function istSchalterwert(n: ts.Expression): boolean {
  return (
    (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && SCHALTERWERTE.has(n.text)
  );
}

/** Jeder Ja/Nein-Vergleich auf einer Umgebungsvariablen in einer Datei. */
function erhebeSchalterlesungen(
  datei: string,
  text: string,
): { funde: { variable: string; ort: string }[]; unlesbar: string[] } {
  const funde: { variable: string; ort: string }[] = [];
  const unlesbar: string[] = [];
  if (!VORPRUEFUNG.test(text)) {
    return { funde, unlesbar };
  }
  const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);
  const konstanten = zeichenkettenKonstanten(sf);
  const besuche = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && VERGLEICHE.has(n.operatorToken.kind)) {
      const andere = istSchalterwert(n.right) ? n.left : istSchalterwert(n.left) ? n.right : null;
      if (andere) {
        const variable = umgebungslesung(andere, konstanten);
        const ort = `${datei}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
        if (typeof variable === "string") {
          funde.push({ variable, ort });
        } else if (variable === null) {
          unlesbar.push(
            `${ort} — Ja/Nein-Vergleich auf einer Umgebungsvariablen, deren Name sich nicht auflösen lässt.`,
          );
        }
      }
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return { funde, unlesbar };
}

const RECHTEAUFRUFE = QUELLEN.flatMap((q) => erhebeRechteaufrufe(q.datei, q.text));
const SCHALTERLESUNGEN = QUELLEN.map((q) => erhebeSchalterlesungen(q.datei, q.text));
const DIREKT_GELESEN = new Map<string, string[]>();
for (const { funde } of SCHALTERLESUNGEN) {
  for (const { variable, ort } of funde) {
    DIREKT_GELESEN.set(variable, [...(DIREKT_GELESEN.get(variable) ?? []), ort]);
  }
}

function startvertragsAusnahmen(): string[] {
  const namen: string[] = [];
  for (const wert of STARTVERTRAG) {
    if (wert.pflicht.art === "produktion" && wert.pflicht.ausnahme) {
      namen.push(wert.pflicht.ausnahme.name);
    }
  }
  return namen;
}

// ================================================================================================
// DIE PRÜFUNG
// ================================================================================================

describe("R-1136 · V1 · die Rollenrechte", () => {
  it("der Typ `Permission` führt genau die Rechte des Verzeichnisses", () => {
    expect(zeichenkettenUnion("services/rbac/src/policy.ts", "Permission").sort()).toEqual(
      Object.keys(ROLLENRECHTE).sort(),
    );
  });

  it("die Rechtematrix vergibt jedes Recht genau an die verzeichneten Rollen", () => {
    const gemessen: Record<string, Rolle[]> = {};
    const matrix = Object.entries(ROLE_PERMISSIONS) as [Rolle, readonly string[]][];
    for (const [rolle, rechte] of matrix) {
      for (const recht of rechte) {
        gemessen[recht] = [...(gemessen[recht] ?? []), rolle];
      }
    }
    const erwartet = Object.fromEntries(
      Object.entries(ROLLENRECHTE).map(([recht, e]) => [recht, [...e.rollen].sort()]),
    );
    const ist = Object.fromEntries(
      Object.entries(gemessen).map(([recht, rollen]) => [recht, [...rollen].sort()]),
    );
    expect(ist).toEqual(erwartet);
  });

  it("die Rechteliste des Routen-Audits ist an das Verzeichnis gebunden, nicht abgeschrieben", () => {
    expect([...KNOWN_PERMISSIONS].sort()).toEqual(Object.keys(ROLLENRECHTE).sort());
  });

  it("jeder Rechteaufruf im Server nennt ein verzeichnetes Recht — und jedes Recht wird gefordert", () => {
    expect(RECHTEAUFRUFE.length, "die Erhebung findet keine Rechteaufrufe").toBeGreaterThan(100);
    const unbekannt = RECHTEAUFRUFE.filter((f) => !(f.recht in ROLLENRECHTE));
    expect(
      unbekannt.map((f) => `${f.ort} — „${f.recht}“`),
      "Rechte, die der Server prüft, die das Verzeichnis aber nicht kennt",
    ).toEqual([]);
    const gefordert = new Set(RECHTEAUFRUFE.map((f) => f.recht));
    const tot = Object.keys(ROLLENRECHTE).filter((recht) => !gefordert.has(recht));
    expect(tot, "Rechte, die kein Aufruf im Server fordert").toEqual([]);
  });
});

describe("R-1136 · V2 · die Schlüsselrechte angebundener Systeme", () => {
  it("`DIENST_RECHTE` und der Typ `AddonCapability` führen genau die verzeichneten Rechte", () => {
    const verzeichnet = Object.keys(SCHLUESSELRECHTE).sort();
    expect([...DIENST_RECHTE].sort()).toEqual(verzeichnet);
    expect(
      zeichenkettenUnion("services/app/src/addon-principal.ts", "AddonCapability").sort(),
    ).toEqual(verzeichnet);
  });

  it("der Klara-Schlüssel trägt genau die verzeichneten Rechte", () => {
    const erwartet = Object.entries(SCHLUESSELRECHTE)
      .filter(([, e]) => e.klaraSchluessel)
      .map(([recht]) => recht)
      .sort();
    expect([...ADDON_CAPABILITIES].sort()).toEqual(erwartet);
  });

  it("jedes Schlüsselrecht öffnet genau seine Routen — und jede davon steht in der Routenmatrix", () => {
    for (const [recht, e] of Object.entries(SCHLUESSELRECHTE)) {
      const eigene = DIENST_ROUTEN.filter((r) => r.recht === recht);
      const geoeffnet = eigene.map((r) => routeKey(r.methode, r.pfad)).sort();
      expect(geoeffnet, `${recht} öffnet andere Routen als verzeichnet`).toEqual(
        [...e.routen].sort(),
      );
      for (const route of e.routen) {
        expect(ROUTE_GUARD_MATRIX[route], `${route} fehlt in ROUTE_GUARD_MATRIX`).toBeDefined();
      }
    }
  });
});

describe("R-1136 · V3 · die Funktionsschalter", () => {
  it("das Registry ist genau Teil 3a — Variable, Vorgabe und Auskunft vor der Anmeldung", () => {
    expect({ ...SCHALTER_REGISTRY }).toEqual(
      Object.fromEntries(Object.entries(REGISTRY_SCHALTER).map(([n, e]) => [n, e.variable])),
    );
    const vorAnmeldung = Object.keys(schalterZustandVorAnmeldung(undefined));
    for (const [name, e] of Object.entries(REGISTRY_SCHALTER)) {
      expect(vorgabeAn(name as keyof typeof SCHALTER_REGISTRY), `${name}: Vorgabe`).toBe(
        e.vorgabeAn,
      );
      expect(vorAnmeldung.includes(name), `${name}: vor der Anmeldung`).toBe(e.vorAnmeldung);
    }
    // Die Auskunft `/api/features` meldet die Registry-Schalter und daneben genau eine abgeleitete
    // Angabe: `demoInstanz` aus dem Host der Anfrage (JOB 4365), kein Umgebungsschalter.
    expect(Object.keys(schalterZustand(undefined)).sort()).toEqual(
      [...Object.keys(REGISTRY_SCHALTER), "demoInstanz"].sort(),
    );
  });

  it("KALIBRIERUNG: die Schaltererhebung erkennt die Bauformen des Hauses — und nur Schalter", () => {
    const probe = erhebeSchalterlesungen(
      "probe.ts",
      [
        'const NAME_ENV = "KLARWERK_PROBE_KONSTANTE";',
        'function a(env) { return env.KLARWERK_PROBE_A === "1"; }',
        "function b() { const flag = process.env.KLARWERK_PROBE_B;",
        '  return flag === "1" || flag === "true"; }',
        'function c(env) { const s = env[NAME_ENV]?.trim().toLowerCase(); return s !== "an"; }',
        'function d(env) { return env.KLARWERK_PROBE_WERT === "production"; }',
        'function e(opts) { return opts.allowX?.trim() === "1"; }',
        'function f(x) { return process.env[x] === "1"; }',
      ].join("\n"),
    );
    expect([...new Set(probe.funde.map((f) => f.variable))].sort()).toEqual([
      "KLARWERK_PROBE_A",
      "KLARWERK_PROBE_B",
      "KLARWERK_PROBE_KONSTANTE",
    ]);
    expect(probe.unlesbar.join("\n")).toContain("probe.ts:8");
    expect(probe.unlesbar).toHaveLength(1);
  });

  it("jeder Schalter, den der Server liest, steht im Verzeichnis — mit genau seinen Quellen", () => {
    const gemessen = new Map<string, Set<Schalterquelle>>();
    const merke = (variable: string, quelle: Schalterquelle): void => {
      gemessen.set(variable, new Set([...(gemessen.get(variable) ?? []), quelle]));
    };
    for (const variable of Object.values(SCHALTER_REGISTRY)) {
      merke(variable, "registry");
    }
    for (const variable of startvertragsAusnahmen()) {
      merke(variable, "startvertrag");
    }
    for (const variable of DIREKT_GELESEN.keys()) {
      merke(variable, "direkt");
    }
    const fehlend = [...gemessen.keys()]
      .filter((v) => !(v in SCHALTER))
      .map((v) => `${v} (${(DIREKT_GELESEN.get(v) ?? ["Registry/Startvertrag"]).join(", ")})`);
    expect(fehlend, "Schalter, die der Server liest, das Verzeichnis aber nicht führt").toEqual([]);
    const verwaist = Object.keys(SCHALTER).filter((v) => !gemessen.has(v));
    expect(verwaist, "Verzeichniseinträge, die keine Quelle mehr liest — streichen").toEqual([]);
    for (const [variable, e] of Object.entries(SCHALTER)) {
      expect(
        [...(gemessen.get(variable) ?? [])].sort(),
        `${variable}: verzeichnete Quellen weichen von den gemessenen ab`,
      ).toEqual([...e.quellen].sort());
      expect(e.wofuer.length, `${variable}: ohne Zweck`).toBeGreaterThan(10);
    }
  });

  it("nichts ist unlesbar — jede ungedeckte Schalterlesung steht mit Datei und Zeile da", () => {
    const alle = SCHALTERLESUNGEN.flatMap((s) => s.unlesbar);
    const gedeckt = (zeile: string): boolean =>
      Object.keys(UNLESBAR_GEDECKT).some((datei) => zeile.startsWith(`${datei}:`));
    expect(alle.filter((zeile) => !gedeckt(zeile))).toEqual([]);
    for (const datei of Object.keys(UNLESBAR_GEDECKT)) {
      expect(
        alle.some((zeile) => zeile.startsWith(`${datei}:`)),
        `${datei}: die Deckung wird nicht mehr gebraucht — streichen`,
      ).toBe(true);
    }
  });

  it("jeder Betriebsschalter steht im Startvertrag; der abgelöste ist benannt und wird nicht gelesen", () => {
    const imVertrag = new Set(STARTVERTRAG.map((w) => w.name));
    const ohneVertrag = Object.entries(SCHALTER)
      .filter(([variable, e]) => !e.nurTest && !imVertrag.has(variable))
      .map(([variable]) => variable)
      .sort();
    expect(ohneVertrag, "Schalter ohne Startvertragseintrag (benannte Befunde)").toEqual(
      Object.keys(OHNE_STARTVERTRAG).sort(),
    );
    const vertragsschalter = STARTVERTRAG.filter((w) => w.bereich.startsWith("Schalter"));
    const schalterImVertrag = vertragsschalter.map((w) => w.name).sort();
    expect(schalterImVertrag).toEqual(
      [...Object.values(SCHALTER_REGISTRY), ...ABGELOESTE_SCHALTER].sort(),
    );
    for (const variable of ABGELOESTE_SCHALTER) {
      expect(variable in SCHALTER, `${variable} ist abgelöst, steht aber als Schalter da`).toBe(
        false,
      );
      expect(DIREKT_GELESEN.has(variable), `${variable} wird wieder gelesen`).toBe(false);
    }
  });
});
