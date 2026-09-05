// ================================================================================================
// JOB 3097 / N12b — DER CHATGPT-SCHLÜSSEL STEHT IN JEDER BETRIEBSANLEITUNG, DIE DIE APP STARTET.
// ================================================================================================
//
// DER BEFUND (JOB 3090, `RUECKGABE.md:54`, dort selbst als REST gemeldet): der OpenAI-Cloud-Client
// liest `OPENAI_API_KEY`, `REASONER_MODEL` und `OPENAI_BASE_URL` aus der Prozessumgebung — aber
// KEINE der drei Betriebsanleitungen dieses Repos nennt die beiden OpenAI-Namen. Wer die App
// hochfährt, muss sie aus dem Quelltext erraten.
//
// WAS DIESER WÄCHTER PRÜFT — UND WAS ER AUSDRÜCKLICH NICHT KANN.
//
// ER PRÜFT eine Aussage über den getrackten Baum: dass die drei Namen an der Stelle stehen, an der
// sie WIRKEN — im `environment:`-Block des Dienstes `app` der Compose-Datei, als Zuweisung in
// `.env.example`, als Zeile der Environment-Tabelle des Coolify-Runbooks. Ein blosses Vorkommen der
// Zeichenkette irgendwo in der Datei zählt NICHT; ein Name in einem Kommentar oder im Fliesstext
// reicht niemanden etwas durch (Kalibrierung K1/K2, Mutationsprobe M1/M2).
//
// ER KANN NICHT prüfen, ob im Container tatsächlich etwas ankommt. Das ist Laufzeitzustand
// ausserhalb des Repos. Insbesondere gilt die belegte Lage aus dem Kopf der Compose-Datei
// (`docker-compose.prod.yml:4-9`, gehütet von `tests/app/coolify-compose-quellwahrheit.test.ts`):
// Coolify deployt über das Dockerfile, NICHT über diese Datei. Der Compose-Teil dieses Wächters
// sichert deshalb den EIN-BEFEHL-Weg (`docker compose -f docker-compose.prod.yml up -d --build`),
// nicht den Coolify-Betrieb; für den trägt die Runbook-Tabelle.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Vitest läuft mit der Repo-Wurzel als Arbeitsverzeichnis (`vitest.config.ts`).
const COMPOSE = "docker-compose.prod.yml";
const ENV_BEISPIEL = ".env.example";
const RUNBOOK = "docs/operations/deploy-hetzner.md";

/** Die beiden Namen, die JOB 3090 eingeführt hat und die bisher in keiner Anleitung stehen. */
const OPENAI_NAMEN = ["OPENAI_API_KEY", "OPENAI_BASE_URL"] as const;
/** Der Modellname gehört zu beiden Anbietern — er stand schon vorher überall und muss bleiben. */
const MODELL_NAME = "REASONER_MODEL";

// ================================================================================================
// REGEL 1 — DER `environment:`-BLOCK EINES DIENSTES, STRUKTURIERT GELESEN.
// ================================================================================================
//
// Bewusst KEIN `inhalt.includes("OPENAI_API_KEY")`. Diese Abkürzung wäre auch dann grün, wenn der
// Name nur in einem Kommentar oder im Block eines anderen Dienstes stünde — also genau dann, wenn
// er nichts durchreicht. Gelesen wird deshalb über den Einzug: `services:` → `<dienst>:` →
// `environment:` → dessen Einträge. Kommentar- und Leerzeilen fallen vorher heraus; sie beenden in
// YAML keinen Block, tragen aber auch keinen Wert.
interface Zeile {
  text: string;
  einzug: number;
}

function inhaltsZeilen(yaml: string): Zeile[] {
  return yaml
    .split("\n")
    .map((text) => ({ text, einzug: text.length - text.trimStart().length }))
    .filter((z) => z.text.trim().length > 0 && !z.text.trim().startsWith("#"));
}

/** Alles, was tiefer eingerückt ist als die Zeile an `start` — bis zur ersten Zeile, die es nicht ist. */
function unterblock(zeilen: Zeile[], start: number): Zeile[] {
  const kopf = zeilen[start];
  if (!kopf) {
    return [];
  }
  const raus: Zeile[] = [];
  for (const zeile of zeilen.slice(start + 1)) {
    if (zeile.einzug <= kopf.einzug) {
      break;
    }
    raus.push(zeile);
  }
  return raus;
}

/** Der Schlüssel `name:` auf der OBERSTEN Ebene dieses Blocks — nicht irgendwo darin verschachtelt. */
function eintragIndex(block: Zeile[], name: string): number {
  if (block.length === 0) {
    return -1;
  }
  const oberste = Math.min(...block.map((z) => z.einzug));
  return block.findIndex((z) => z.einzug === oberste && z.text.trim() === `${name}:`);
}

/** Die Einträge des `environment:`-Blocks genau dieses Dienstes, oder `undefined` wenn es ihn nicht gibt. */
function environmentBlock(compose: string, dienst: string): string[] | undefined {
  const alle = inhaltsZeilen(compose);
  const iServices = alle.findIndex((z) => z.einzug === 0 && z.text.trim() === "services:");
  if (iServices < 0) {
    return undefined;
  }
  const dienste = unterblock(alle, iServices);
  const iDienst = eintragIndex(dienste, dienst);
  if (iDienst < 0) {
    return undefined;
  }
  const dienstBlock = unterblock(dienste, iDienst);
  const iEnv = eintragIndex(dienstBlock, "environment");
  if (iEnv < 0) {
    return undefined;
  }
  return unterblock(dienstBlock, iEnv).map((z) => z.text.trim());
}

/** Die Variablennamen, die dieser Dienst durchreicht. Abbildungsform UND Listenform. */
function durchgereichteNamen(compose: string, dienst: string): string[] {
  const block = environmentBlock(compose, dienst);
  if (!block) {
    return [];
  }
  const namen: string[] = [];
  for (const eintrag of block) {
    const abbildung = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(eintrag)?.[1];
    if (abbildung) {
      namen.push(abbildung);
      continue;
    }
    const liste = /^-\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|$)/.exec(eintrag)?.[1];
    if (liste) {
      namen.push(liste);
    }
  }
  return namen;
}

// ================================================================================================
// REGEL 2 — EINE ZUWEISUNG IN `.env.example`, NICHT BLOSS EINE ERWÄHNUNG.
// ================================================================================================
//
// Eine Kommentarzeile „siehe auch OPENAI_API_KEY" hilft niemandem beim Kopieren nach `.env`. Nur
// `NAME=` auf einer eigenen, nicht auskommentierten Zeile zählt.
function envZuweisungen(inhalt: string): Record<string, string> {
  const raus: Record<string, string> = {};
  for (const zeile of inhalt.split("\n")) {
    const t = zeile.trim();
    if (t.length === 0 || t.startsWith("#")) {
      continue;
    }
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
    const name = m?.[1];
    if (name) {
      raus[name] = m?.[2] ?? "";
    }
  }
  return raus;
}

// ================================================================================================
// REGEL 3 — EINE ZEILE IN DER ENVIRONMENT-TABELLE DES RUNBOOKS.
// ================================================================================================
//
// Pedi trägt die Werte nach dieser Tabelle in Coolify ein. Steht der Name nur im Fliesstext
// darunter, hat er beim Eintragen keine Zeile, keinen Wert und keine Pflichtangabe — deshalb wird
// die Tabelle als Tabelle gelesen (Kopfzeile, Trennzeile, Datenzeilen) und nur die erste Spalte
// ausgewertet.
interface Tabelle {
  kopf: string[];
  zeilen: string[][];
}

function zellen(zeile: string): string[] {
  return zeile
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((z) => z.trim());
}

function tabellen(md: string): Tabelle[] {
  const zeilenListe = md.split("\n");
  const raus: Tabelle[] = [];
  let lauf: string[] = [];
  const abschliessen = (): void => {
    const kopfzeile = lauf[0];
    const trennzeile = lauf[1];
    if (
      kopfzeile !== undefined &&
      trennzeile !== undefined &&
      lauf.length >= 3 &&
      /^[|\s:-]+$/.test(trennzeile) &&
      trennzeile.includes("-")
    ) {
      raus.push({ kopf: zellen(kopfzeile), zeilen: lauf.slice(2).map(zellen) });
    }
    lauf = [];
  };
  for (const zeile of zeilenListe) {
    if (zeile.trim().startsWith("|")) {
      lauf.push(zeile);
    } else {
      abschliessen();
    }
  }
  abschliessen();
  return raus;
}

/** Die Variablennamen aus jeder Tabelle, deren Kopf eine Spalte „Variable" trägt. */
function tabellenVariablen(md: string): string[] {
  return tabellen(md)
    .filter((t) => t.kopf.some((k) => k.toLowerCase().includes("variable")))
    .flatMap((t) => t.zeilen.map((r) => (r[0] ?? "").replace(/[`*]/g, "").trim()));
}

// ================================================================================================
// REGEL 4 — KEIN SCHLÜSSEL IM BAUM, NUR NAMEN UND PLATZHALTER.
// ================================================================================================
//
// Die Regel des Runbooks („Schlüssel niemals ins Repo/Compose — nur Coolify-Secrets") wird durch
// diesen Auftrag nicht verletzt: in den drei Dateien steht nur der Variablenname, nie ein Wert.
const SCHLUESSEL_MUSTER = /sk-[A-Za-z0-9_-]{8,}/;

function enthaeltSchluesselwert(inhalt: string): boolean {
  return SCHLUESSEL_MUSTER.test(inhalt);
}

const composeInhalt = readFileSync(COMPOSE, "utf8");
const envInhalt = readFileSync(ENV_BEISPIEL, "utf8");
const runbookInhalt = readFileSync(RUNBOOK, "utf8");

// ================================================================================================
// DIE FÄLLE AM ECHTEN REPO.
// ================================================================================================
describe("JOB 3097 N12b · die drei Betriebsanleitungen nennen die OpenAI-Namen", () => {
  it("R1 · der `environment:`-Block des Dienstes `app` reicht OPENAI_API_KEY und OPENAI_BASE_URL durch", () => {
    const namen = durchgereichteNamen(composeInhalt, "app");
    expect(
      namen.length,
      "Der `environment:`-Block des Dienstes `app` wurde gar nicht gefunden — die Regel misst dann nichts.",
    ).toBeGreaterThan(0);
    for (const name of OPENAI_NAMEN) {
      expect(
        namen,
        `${name} wird vom Dienst \`app\` nicht durchgereicht. Beim Ein-Befehl-Start (\`docker compose -f docker-compose.prod.yml up -d --build\`) kommt ein gesetzter OpenAI-Schlüssel dann nicht im Container an.`,
      ).toContain(name);
    }
  });

  it("der Modellname bleibt durchgereicht — er gehört zu beiden Anbietern", () => {
    expect(durchgereichteNamen(composeInhalt, "app")).toContain(MODELL_NAME);
  });

  it("R2 · `.env.example` führt beide OpenAI-Namen als Zuweisung, nicht bloss als Erwähnung", () => {
    const zuweisungen = envZuweisungen(envInhalt);
    for (const name of OPENAI_NAMEN) {
      expect(
        Object.keys(zuweisungen),
        `${name} steht in .env.example nicht als eigene Zuweisung \`${name}=\`. Wer die Datei nach .env kopiert, hat den Namen dann nicht.`,
      ).toContain(name);
    }
    expect(Object.keys(zuweisungen)).toContain(MODELL_NAME);
  });

  it("R3 · die Environment-Tabelle des Coolify-Runbooks trägt Zeilen für beide OpenAI-Namen", () => {
    const variablen = tabellenVariablen(runbookInhalt);
    expect(
      variablen,
      "Im Runbook wurde keine Tabelle mit einer Spalte „Variable“ gefunden.",
    ).toContain("DATABASE_URL");
    for (const name of OPENAI_NAMEN) {
      expect(
        variablen,
        `Die Environment-Tabelle in ${RUNBOOK} hat keine Zeile für ${name}. Genau nach dieser Tabelle trägt Pedi die Werte in Coolify ein.`,
      ).toContain(name);
    }
    expect(variablen).toContain(MODELL_NAME);
  });

  it("die drei Anleitungen bleiben aneinander — kein Name nur an einer Stelle", () => {
    // Ohne diesen Fall könnte eine der drei Dateien später einen Namen verlieren, ohne dass der
    // Zusammenhang auffällt.
    const durchgereicht = durchgereichteNamen(composeInhalt, "app");
    const zugewiesen = Object.keys(envZuweisungen(envInhalt));
    const tabelliert = tabellenVariablen(runbookInhalt);
    for (const name of [...OPENAI_NAMEN, MODELL_NAME]) {
      expect([name, durchgereicht.includes(name)]).toEqual([name, true]);
      expect([name, zugewiesen.includes(name)]).toEqual([name, true]);
      expect([name, tabelliert.includes(name)]).toEqual([name, true]);
    }
  });

  it("R6 · in keiner der drei Dateien steht ein Wert, der wie ein OpenAI-Schlüssel aussieht", () => {
    for (const [pfad, inhalt] of [
      [COMPOSE, composeInhalt],
      [ENV_BEISPIEL, envInhalt],
      [RUNBOOK, runbookInhalt],
    ] as const) {
      expect(
        enthaeltSchluesselwert(inhalt),
        `${pfad} enthält etwas, das wie ein Schlüsselwert aussieht. In diese Dateien gehören nur Variablennamen und Platzhalter — Werte gehören in den Secret-Store.`,
      ).toBe(false);
    }
  });
});

// ================================================================================================
// DIE KALIBRIERUNG — ohne sie wäre nicht zu unterscheiden, ob die Regeln den Block lesen oder die
// Datei durchsuchen. Jeder Fall führt die Regel auf SYNTHETISCHEN Eingaben aus; das Produkt wird
// dabei nicht angefasst.
// ================================================================================================
describe("JOB 3097 N12b · die Regeln schlagen an — kalibriert an synthetischen Eingaben", () => {
  const geruest = [
    "# Kopfkommentar",
    "services:",
    "  db:",
    "    image: postgres:16-alpine",
    "    environment:",
    "      POSTGRES_DB: klarwerk_prod",
    "  app:",
    "    build: .",
    "    environment:",
    "      PORT: 3000",
    "      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}",
    "    ports:",
    '      - "3000:3000"',
    "volumes:",
    "  pgdata:",
    "",
  ];

  it("R4 · ein Name, der NUR in einem Kommentar steht, gilt als nicht durchgereicht", () => {
    const nurKommentar = [...geruest];
    nurKommentar.splice(11, 0, "      # OPENAI_API_KEY: hier absichtlich nur als Kommentar");
    const inhalt = nurKommentar.join("\n");
    expect(inhalt).toContain("OPENAI_API_KEY"); // die naive Suche wäre grün …
    expect(durchgereichteNamen(inhalt, "app")).not.toContain("OPENAI_API_KEY"); // … die Regel nicht
  });

  it("R5 · ein Name im `environment:`-Block eines ANDEREN Dienstes gilt als nicht durchgereicht", () => {
    const beimFalschenDienst = [...geruest];
    beimFalschenDienst.splice(6, 0, "      OPENAI_API_KEY: ${OPENAI_API_KEY:-}");
    const inhalt = beimFalschenDienst.join("\n");
    expect(durchgereichteNamen(inhalt, "db")).toContain("OPENAI_API_KEY");
    expect(durchgereichteNamen(inhalt, "app")).not.toContain("OPENAI_API_KEY");
  });

  it("ein Name im `environment:`-Block des Dienstes `app` gilt als durchgereicht — die Regel ist erfüllbar", () => {
    const richtig = [...geruest];
    richtig.splice(11, 0, "      OPENAI_API_KEY: ${OPENAI_API_KEY:-}");
    expect(durchgereichteNamen(richtig.join("\n"), "app")).toContain("OPENAI_API_KEY");
  });

  it("die Listenform des `environment:`-Blocks wird ebenfalls gelesen", () => {
    // Compose erlaubt beide Schreibweisen; ein späterer Umbau darf den Wächter nicht blind machen.
    const liste = [
      "services:",
      "  app:",
      "    environment:",
      "      - OPENAI_API_KEY=${OPENAI_API_KEY:-}",
      "      - OPENAI_BASE_URL",
      "",
    ].join("\n");
    expect(durchgereichteNamen(liste, "app")).toEqual(["OPENAI_API_KEY", "OPENAI_BASE_URL"]);
  });

  it("fehlt der Dienst oder sein `environment:`-Block, liefert die Regel nichts — statt still grün zu sein", () => {
    expect(environmentBlock("services:\n  app:\n    build: .\n", "app")).toBeUndefined();
    expect(environmentBlock(geruest.join("\n"), "worker")).toBeUndefined();
    expect(durchgereichteNamen(geruest.join("\n"), "worker")).toEqual([]);
  });

  it("eine auskommentierte Zuweisung in einer Env-Datei zählt nicht als Zuweisung", () => {
    const datei = ["# OPENAI_API_KEY=", "ANTHROPIC_API_KEY=", "# nur Text: OPENAI_BASE_URL"].join(
      "\n",
    );
    expect(Object.keys(envZuweisungen(datei))).toEqual(["ANTHROPIC_API_KEY"]);
  });

  it("ein Name nur im Fliesstext unter der Tabelle zählt nicht als Tabellenzeile", () => {
    const md = [
      "| Variable | Wert | Pflicht |",
      "|---|---|---|",
      "| `DATABASE_URL` | aus Coolify | JA |",
      "",
      "Setze ausserdem `OPENAI_API_KEY`, wenn ChatGPT antworten soll.",
      "",
    ].join("\n");
    expect(md).toContain("OPENAI_API_KEY"); // die naive Suche wäre grün …
    expect(tabellenVariablen(md)).toEqual(["DATABASE_URL"]); // … die Regel nicht
  });

  it("eine Tabelle ohne Spalte „Variable“ wird nicht mitgezählt", () => {
    const md = [
      "| Datei | Zweck |",
      "|---|---|",
      "| `OPENAI_API_KEY` | keine Env-Tabelle, nur gleich benannte Zelle |",
      "",
    ].join("\n");
    expect(tabellenVariablen(md)).toEqual([]);
  });

  it("die Schlüsselregel erkennt einen echten Schlüsselwert und lässt Namen und Platzhalter durch", () => {
    // Bewusst zusammengesetzt statt als Literal geschrieben: in dieser Datei soll auch kein
    // schlüsselförmiger String STEHEN.
    const wieEinSchluessel = `OPENAI_API_KEY=${"sk-"}proj${"-"}${"A1b2C3d4E5f6G7h8"}`;
    expect(enthaeltSchluesselwert(wieEinSchluessel)).toBe(true);
    expect(enthaeltSchluesselwert("OPENAI_API_KEY=")).toBe(false);
    expect(enthaeltSchluesselwert("| `OPENAI_API_KEY` | als Coolify-Secret | nein |")).toBe(false);
    expect(enthaeltSchluesselwert("OPENAI_API_KEY: ${OPENAI_API_KEY:-}")).toBe(false);
  });
});
