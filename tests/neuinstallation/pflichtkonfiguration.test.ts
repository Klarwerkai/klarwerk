// ================================================================================================
// JOB 4201 · DER DOCKERFREIE DAUERBELEG DER NEUINSTALLATION.
// ================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD, ist die des Betreibers, der eine LEERE Kundeninstanz
// aufsetzt: *Wenn ich eine Pflichtangabe vergesse — erfahre ich es, bevor Menschen davorstehen?*
//
// DER BEFUND, DER DIESE DATEI AUSGELOEST HAT (gemessen am Stand 8f015c4, jede Stelle aufgeschlagen):
//
//   Seite A — `services/app/src/start-vertrag.ts:23-27`: „Nur zwei Werte lassen den Start
//             scheitern … `APP_BASE_URL` (ohne sie verschickt der Kennwort-Zuruecksetzen-Weg eine
//             Mail OHNE Link …) — ein Fehler, den man erst beim Klicken merkt."
//   Seite B — `docker-compose.prod.yml:52`: `APP_BASE_URL: ${APP_BASE_URL:-https://app.klarwerk.ai}`
//
// Der Vorgabewert setzt die Pflicht AUSSER KRAFT: auf dem Ein-Befehl-Weg ist die Variable nie leer,
// der Startvertrag kann nie greifen, und die neue Kundeninstanz zeigt still auf die oeffentliche
// Vorfuehr-Domain. Der Start GELINGT — und ist trotzdem falsch. Das ist der teuerste Fehlertyp
// dieses Hauses: ein falscher Erfolg.
//
// ZWEITER BEFUND, gleiche Bauart: `docker-compose.prod.yml:49/89-90` nennt Port 3000, waehrend der
// Container selbst 3001 fuehrt (`Dockerfile` ENV/EXPOSE, `server.ts` Vorgabewert) und
// `docs/operations/deploy-hetzner.md:13-14,37,44` dem Betreiber dreimal 3001 sagt. Wer beide Seiten
// liest, bekommt zwei Wahrheiten.
//
// ================================================================================================
// WAS DIESE DATEI PRUEFT — UND WAS SIE AUSDRUECKLICH NICHT KANN.
// ================================================================================================
//
// SIE PRUEFT die Uebereinstimmung von Konfiguration, Code und Anleitung im getrackten Baum, ohne
// Docker und ohne Netz — sie laeuft deshalb im Tor IMMER. Dieselbe Rolle, die
// `tests/backup-drill/prozesszuordnung.test.ts` fuer den Wiederherstellungsdrill spielt
// (`echter-wiederanlauf.integration.test.ts:36`).
//
// SIE KANN NICHT pruefen, was `docker compose` auf einer echten Maschine tut. Das misst
// `erstinstallation.integration.test.ts` daneben — und meldet SICHTBAR, wenn es nicht messen kann.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTVERTRAG, fehlendePflichtwerte } from "../../services/app/src/start-vertrag";
import { assertCookieSecurityConfig, selfRegistrationEnabled } from "../../services/auth";

const WURZEL = join(__dirname, "..", "..");

const COMPOSE = "docker-compose.prod.yml";
const DOCKERFILE = "Dockerfile";
const SERVER = "services/app/src/server.ts";
const RUNBOOK = "docs/operations/deploy-hetzner.md";
const ANLEITUNG = "docs/operations/kundeninstanz-neuinstallation.md";

function lies(relativ: string): string {
  return readFileSync(join(WURZEL, relativ), "utf8");
}

// ------------------------------------------------------------------------------------------------
// DIE COMPOSE-DATEI, STRUKTURIERT GELESEN — nicht per Textsuche.
// ------------------------------------------------------------------------------------------------
//
// Eine Textsuche waere hier die naheliegende Halbheit: `APP_BASE_URL` kommt im Kopfkommentar, in
// einem Erklaertext und in der Zuweisung vor, und nur die Zuweisung wirkt. Gelesen wird deshalb der
// `environment:`-Block EINES Dienstes, Kommentarzeilen ausgenommen — dieselbe Bauart wie
// `tests/openai-durchreichung/openai-in-den-betriebsanleitungen.test.ts`.

/** Eine Zuweisung im `environment:`-Block: der Name und der rohe Wert dahinter. */
interface Zuweisung {
  name: string;
  roh: string;
}

function umgebung(inhalt: string, dienst: string): Zuweisung[] {
  const zeilen = inhalt.split("\n");
  const treffer: Zuweisung[] = [];
  let imDienst = false;
  let imBlock = false;
  for (const zeile of zeilen) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(zeile)) {
      imDienst = zeile.trim() === `${dienst}:`;
      imBlock = false;
      continue;
    }
    if (!imDienst) {
      continue;
    }
    if (/^ {4}[A-Za-z0-9_-]+:\s*$/.test(zeile)) {
      imBlock = zeile.trim() === "environment:";
      continue;
    }
    if (!imBlock) {
      continue;
    }
    const passt = /^ {6}([A-Z][A-Z0-9_]*):\s*(.*)$/.exec(zeile);
    const name = passt?.[1];
    if (passt && name !== undefined) {
      treffer.push({ name, roh: (passt[2] ?? "").trim() });
    }
  }
  return treffer;
}

/**
 * Die Interpolationsform eines Wertes — das ist der eigentliche Gegenstand dieses Auftrags.
 *
 *   `pflicht`  — `${NAME:?…}`: fehlt der Wert, bricht `docker compose` ab und NENNT den Namen.
 *   `vorgabe`  — `${NAME:-x}`: fehlt der Wert, gilt still `x`. Genau das hebt eine Pflicht auf.
 *   `fest`     — ein ausgeschriebener Wert ohne Interpolation.
 */
type Form =
  | { art: "pflicht" }
  | { art: "vorgabe"; wert: string }
  | { art: "fest"; wert: string }
  | { art: "durchgereicht" };

function form(roh: string): Form {
  const ohneAnfuehrung = roh.replace(/^"(.*)"$/, "$1");
  const pflicht = /^\$\{([A-Z][A-Z0-9_]*):\?/.exec(ohneAnfuehrung);
  if (pflicht) {
    return { art: "pflicht" };
  }
  const vorgabe = /^\$\{([A-Z][A-Z0-9_]*):-(.*)\}$/.exec(ohneAnfuehrung);
  if (vorgabe) {
    return { art: "vorgabe", wert: vorgabe[2] ?? "" };
  }
  if (/^\$\{([A-Z][A-Z0-9_]*)\}$/.test(ohneAnfuehrung)) {
    return { art: "durchgereicht" };
  }
  return { art: "fest", wert: ohneAnfuehrung };
}

const composeInhalt = lies(COMPOSE);
const appUmgebung = umgebung(composeInhalt, "app");

function appWert(name: string): Zuweisung | undefined {
  return appUmgebung.find((z) => z.name === name);
}

// ------------------------------------------------------------------------------------------------
// DER EINE PORT — AUS DEM CODE ERHOBEN, NICHT HIER HINGESCHRIEBEN.
// ------------------------------------------------------------------------------------------------
//
// Stuende die Zahl als Literal in dieser Datei, waere sie eine DRITTE Wahrheit. Sie wird deshalb
// aus `server.ts` gelesen — das ist die Stelle, die zur Laufzeit wirklich entscheidet.
function portAusServer(): string {
  const treffer = /process\.env\.PORT\s*\?\?\s*"(\d+)"/.exec(lies(SERVER));
  return treffer?.[1] ?? "";
}

function portAusDockerfile(): string {
  const treffer = /^ENV PORT=(\d+)$/m.exec(lies(DOCKERFILE));
  return treffer?.[1] ?? "";
}

/** Der Wirtsname, den `server.ts` einsetzt, wenn CANONICAL_HOST fehlt. */
function kanonikAusServer(): string {
  const treffer = /process\.env\.CANONICAL_HOST\s*\?\?\s*"([^"]+)"/.exec(lies(SERVER));
  return treffer?.[1] ?? "";
}

// ------------------------------------------------------------------------------------------------
// RUNDE 2 · DIE KANONIK-UMLEITUNG, AM ECHTEN CODE AUSGEFUEHRT — NICHT NACHGEBAUT.
// ------------------------------------------------------------------------------------------------
//
// BENs BEFUND ZU RUNDE 1 (Korrekturpflicht 1), und er ist gemessen: Die Betreiberanleitung nannte
// die falsche Ursache. Sie schrieb, eine Instanz unter `app.<eigene-domain>` lande bei
// UNVERAENDERTER Vorgabe „auf der fremden Website" — tatsaechlich passiert dort GAR NICHTS, weil
// der Wirtsname nie `app.klarwerk.ai` ist. Die Umleitung entsteht erst, wenn man CANONICAL_HOST auf
// die uebergeordnete Domain SETZT. Die alte Empfehlung war also nicht ungenau, sondern verkehrt:
// sie riet zu genau dem Schritt, der den Schaden anrichtet.
//
// WARUM DER CODE HIER AUSGEFUEHRT UND NICHT NACHGEBAUT WIRD: Ein zweiter Ausdruck derselben Regel
// waere eine zweite Wahrheit — und die auseinanderlaufende waere immer die im Test. `server.ts`
// liegt NICHT in den Zielpfaden dieses Auftrags; der Hook kann dort also nicht exportiert werden.
// Also wird er WOERTLICH aus der Datei gelesen und ausgefuehrt. Aendert jemand die Umleitung, misst
// dieser Test ab der naechsten Sekunde die neue — und die Anleitung wird rot, wenn sie nicht folgt.

/** Die beiden Stellen in `server.ts`, aus denen die Umleitung besteht — woertlich. */
function kanonikCode(): { konstante: string; rumpf: string; marke: number } {
  const zeilen = lies(SERVER).split("\n");
  const konstante = zeilen.find((z) => /^const CANONICAL_HOST\s*=/.test(z)) ?? "";
  const marke = zeilen.findIndex((z) => z.includes("Kanonik: app."));
  const start = zeilen.findIndex((z, i) => i > marke && z.includes('app.addHook("onRequest"'));
  const ende = zeilen.findIndex((z, i) => i > start && z.trim() === "});");
  const rumpf =
    marke >= 0 && start > marke && ende > start ? zeilen.slice(start + 1, ende).join("\n") : "";
  return { konstante, rumpf, marke };
}

/** Was die Umleitung tut — `undefined` heisst: keine Umleitung. */
interface Umleitung {
  ziel: string;
  code: number;
}

function kanonikLauf(
  kanonischerWirt: string | undefined,
  wirtsname: string,
  pfad = "/start",
): Umleitung | undefined {
  const { konstante, rumpf } = kanonikCode();
  const ausgefuehrt = new Function(
    "process",
    "request",
    "reply",
    `${konstante}\n${rumpf}\nreturn undefined;`,
  );
  const umleitungen: Umleitung[] = [];
  ausgefuehrt(
    { env: kanonischerWirt === undefined ? {} : { CANONICAL_HOST: kanonischerWirt } },
    { hostname: wirtsname, url: pfad },
    { redirect: (ziel: string, code: number) => umleitungen.push({ ziel, code }) },
  );
  return umleitungen[0];
}

/** Die Portzahlen, die ein Betreiber in einem Dokument lesen kann. */
function portnennungen(text: string): string[] {
  return [...new Set([...text.matchAll(/\b(30\d\d)\b/g)].map((m) => m[1] as string))];
}

/**
 * Jeder Bezeichner, den ein Dokument als solchen nennt: der VOLLSTAENDIGE Inhalt eines
 * Ruecktaktpaares, der wie ein Umgebungs- oder Fehlercodename aussieht.
 *
 * WARUM DER GANZE INHALT UND NICHT EIN TEILTREFFER: `POST /api/auth/setup` enthaelt `POST`, ist
 * aber kein Bezeichner. Ein Teiltreffer machte D3 zu einer Regel ueber Grossbuchstaben statt ueber
 * Namen — und sie waere fuer jede ehrliche Anleitung unerfuellbar.
 */
function genannteNamen(text: string): Set<string> {
  return new Set(
    [...text.matchAll(/`([^`\n]+)`/g)]
      .map((m) => (m[1] as string).trim())
      .filter((inhalt) => /^[A-Z][A-Z0-9_]{2,}$/.test(inhalt)),
  );
}

/**
 * Die Namen aus dem ausgewiesenen `.env`-Beispielblock der Betreiberanleitung — aktive
 * (`NAME=`) wie auskommentierte (`# NAME=`) Zeilen. Der Block ist mit `<!-- env-beispiel -->`
 * markiert, damit ein beliebiger anderer Codeblock der Anleitung nicht mitgelesen wird.
 */
function envBeispielNamen(text: string): string[] {
  const marke = text.indexOf("<!-- env-beispiel -->");
  if (marke < 0) {
    return [];
  }
  const start = text.indexOf("```", marke);
  const ende = text.indexOf("```", start + 3);
  if (start < 0 || ende < 0) {
    return [];
  }
  const block = text.slice(start, ende);
  return [...new Set([...block.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1] as string))];
}

/** Liest die Compose-Datei diesen Namen aus der Umgebung? (`${NAME…}`, gleich in welcher Form) */
function liestAusUmgebung(compose: string, name: string): boolean {
  return new RegExp(`\\$\\{${name}[:}]`).test(compose);
}

/**
 * Die ausgewiesene Kanonik-Messtabelle der Anleitung (`<!-- kanonik-messung -->`), Zeile fuer
 * Zeile. `erwartet === null` heisst „keine Umleitung".
 */
function kanonikTabelle(
  text: string,
): { wirt: string; kanonisch: string | undefined; erwartet: string | null }[] {
  const marke = text.indexOf("<!-- kanonik-messung -->");
  if (marke < 0) {
    return [];
  }
  const zeilen: { wirt: string; kanonisch: string | undefined; erwartet: string | null }[] = [];
  for (const zeile of text.slice(marke).split("\n").slice(1)) {
    if (!zeile.trim().startsWith("|")) {
      if (zeilen.length > 0) {
        break;
      }
      continue;
    }
    const felder = zeile
      .split("|")
      .slice(1, -1)
      .map((f) => f.trim());
    const [wirtFeld, kanonischFeld, wirkungFeld] = felder;
    if (!wirtFeld || !kanonischFeld || !wirkungFeld) {
      continue;
    }
    const wirt = /^`([^`]+)`$/.exec(wirtFeld)?.[1];
    if (!wirt) {
      continue; // Kopf- und Trennzeile
    }
    const kanonisch = /^`([^`]*)`$/.exec(kanonischFeld)?.[1];
    const umleitung = /^301 → (\S+)$/.exec(wirkungFeld)?.[1];
    zeilen.push({ wirt, kanonisch, erwartet: umleitung ?? null });
  }
  return zeilen;
}

/**
 * Der gesamte Produktionsquelltext unter `services/` als EIN Text — die Gegenprobe zu jedem
 * Bezeichner, den die Betreiberanleitung nennt (Fall D3). Testdateien bleiben draussen: ein Code,
 * den nur ein Test kennt, hilft dem Betreiber nicht.
 */
function produktionsquelltext(): string {
  const teile: string[] = [];
  const sammle = (verzeichnis: string): void => {
    for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
      if (eintrag.name === "node_modules" || eintrag.name === "dist") {
        continue;
      }
      const relativ = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) {
        sammle(relativ);
      } else if (eintrag.name.endsWith(".ts") && !eintrag.name.includes(".test.")) {
        teile.push(readFileSync(join(WURZEL, relativ), "utf8"));
      }
    }
  };
  sammle("services");
  return teile.join("\n");
}

// ================================================================================================
// A · DIE ERHEBUNG GREIFT UEBERHAUPT
// ================================================================================================
describe("JOB 4201 A · die Erhebung misst wirklich etwas", () => {
  it("A0 · der environment:-Block des Dienstes app wird strukturiert gelesen", () => {
    expect(appUmgebung.length).toBeGreaterThan(10);
    const namen = appUmgebung.map((z) => z.name);
    for (const pflicht of ["DATABASE_URL", "APP_BASE_URL", "PORT"]) {
      expect(namen, `${pflicht} nicht erhoben`).toContain(pflicht);
    }
    // Und der Leser trennt die Dienste: `POSTGRES_DB` gehoert zu `db`, nicht zu `app`.
    expect(namen).not.toContain("POSTGRES_DB");
    expect(umgebung(composeInhalt, "db").map((z) => z.name)).toContain("POSTGRES_DB");
  });

  it("A0b · Code und Bauplan geben ihren Port und ihren Wirt wirklich her", () => {
    expect(portAusServer(), `${SERVER} nennt keinen Vorgabeport`).toMatch(/^\d+$/);
    expect(portAusDockerfile(), `${DOCKERFILE} nennt kein ENV PORT`).toMatch(/^\d+$/);
    expect(kanonikAusServer(), `${SERVER} nennt keinen Vorgabewirt`).not.toBe("");
  });
});

// ================================================================================================
// B · DIE PFLICHT GILT AUCH AUF DEM EIN-BEFEHL-WEG (Lieferung 1)
// ================================================================================================
describe("JOB 4201 B · eine fehlende Pflichtangabe bricht ab, statt still zu gelingen", () => {
  it("B1 · jeder Pflichtwert des Startvertrags steht in der Compose-Datei OHNE Vorgabewert", () => {
    // DER KERN DIESES AUFTRAGS. Ein `:-` an einem Pflichtwert ist keine Bequemlichkeit, sondern
    // die Aufhebung der Pflicht: der Wert ist dann NIE leer, und `pruefeStartvertrag` laeuft ins
    // Leere. Erlaubt ist die Pflichtform `${NAME:?…}` (dieselbe, die `POSTGRES_PASSWORD` in
    // Zeile 17 derselben Datei schon benutzt) oder ein ausgeschriebener Wert, der nachweislich
    // aus der Datei selbst stammt (DATABASE_URL wird aus dem Dienst `db` zusammengesetzt).
    const pflichtnamen = STARTVERTRAG.filter((w) => w.pflicht.art === "produktion").map(
      (w) => w.name,
    );
    expect(pflichtnamen.length).toBeGreaterThan(1);
    const mitVorgabe = pflichtnamen
      .map((name) => ({ name, zuweisung: appWert(name) }))
      .filter(({ zuweisung }) => zuweisung !== undefined && form(zuweisung.roh).art === "vorgabe")
      .map(({ name, zuweisung }) => `${name}: ${zuweisung?.roh}`);
    expect(
      mitVorgabe,
      "Ein Pflichtwert des Startvertrags traegt in der Compose-Datei einen Vorgabewert. Damit ist er auf dem Ein-Befehl-Weg NIE leer, der Startvertrag kann nie greifen — und der Start gelingt falsch.",
    ).toEqual([]);
  });

  it("B2 · APP_BASE_URL bricht namentlich ab, wenn er fehlt", () => {
    const zuweisung = appWert("APP_BASE_URL");
    expect(zuweisung, "APP_BASE_URL fehlt im environment:-Block des Dienstes app").toBeDefined();
    expect(
      form(zuweisung?.roh ?? "").art,
      `APP_BASE_URL steht als \`${zuweisung?.roh}\` da. Der Betreiber muss den NAMEN des fehlenden Wertes VOR dem Start lesen — nicht erst beim Klicken auf einen Link in einer Mail.`,
    ).toBe("pflicht");
  });

  it("B3 · kein Vorgabewert der Compose-Datei macht eine fremde Instanz zur eigenen Adresse", () => {
    // WAS DIESE REGEL MEINT — und warum sie nicht einfach „klarwerk.ai kommt nicht vor" lautet.
    //
    // Der Fehler, den dieser Auftrag abloest, ist eng: ein Vorgabewert, der die ADRESSE EINER
    // FREMDEN INSTANZ zur Adresse DIESER Instanz macht (`https://app.klarwerk.ai` als
    // APP_BASE_URL). Daran haengt der falsche Erfolg — die Instanz laeuft und verweist Menschen
    // woandershin.
    //
    // ZWEI WERTE NENNEN DENSELBEN DOMAENENNAMEN UND SIND TROTZDEM ETWAS ANDERES; sie sind hier
    // nicht ausgenommen, sie erfuellen die Regel schlicht:
    //   · `SMTP_FROM` (`noreply@klarwerk.ai`) ist eine ABSENDERadresse, keine Instanzadresse. Sie
    //     richtet keinen falschen Erfolg an; der Startvertrag fuehrt sie als Kannwert, und die
    //     Betreiberanleitung sagt ausdruecklich, dass sie fuer eine eigene Domain meist falsch ist.
    //   · `CANONICAL_HOST` (`klarwerk.ai`) ist ein WIRTSname und steuert nur, ob `app.<wirt>`
    //     umgeleitet wird — unter einer Kundendomain greift das nie. Er darf ausserdem gar nicht
    //     abweichen: Fall C4 verlangt WOERTLICHE Gleichheit mit dem Vorgabewert in `server.ts`, und
    //     das ist die schaerfere Bindung, nicht die schwaechere.
    // Geprueft wird jeder Dienst, nicht nur `app`: ein Vorgabewert wirkt still, egal wo er steht.
    const zeigtAufFremdeInstanz = (wert: string): boolean =>
      /^https?:\/\/\S*klarwerk\.(ai|de)/.test(wert);
    const verdaechtig = [...umgebung(composeInhalt, "app"), ...umgebung(composeInhalt, "db")]
      .map((z) => ({ name: z.name, f: form(z.roh) }))
      .filter(
        ({ f }) => (f.art === "vorgabe" || f.art === "fest") && zeigtAufFremdeInstanz(f.wert ?? ""),
      )
      .map(({ name }) => name);
    expect(
      verdaechtig,
      "Ein Vorgabewert setzt die Adresse einer FREMDEN Instanz als Startwert dieser Instanz. Der Start gelingt dann und ist trotzdem falsch.",
    ).toEqual([]);

    // DIE GEGENPROBE IM SELBEN FALL — ohne sie waere nicht zu unterscheiden, ob die Regel etwas
    // verlangt oder nur nichts findet. Woertlich die abgeloeste Zeile (Stand 8f015c4, `:52`):
    expect(zeigtAufFremdeInstanz("https://app.klarwerk.ai")).toBe(true);
    // … und die beiden Werte, die denselben Namen nennen und trotzdem etwas anderes sind:
    expect(zeigtAufFremdeInstanz("noreply@klarwerk.ai")).toBe(false);
    expect(zeigtAufFremdeInstanz("klarwerk.ai")).toBe(false);
  });
});

// ================================================================================================
// C · PORT, WIRT UND TLS SAGEN UEBERALL DASSELBE (Lieferung 2)
// ================================================================================================
describe("JOB 4201 C · eine Wahrheit ueber Port, Wirt und TLS", () => {
  it("C1 · der Port der Compose-Datei ist der Port, den der Container selbst fuehrt", () => {
    const wahr = portAusServer();
    expect(portAusDockerfile(), "Dockerfile und server.ts nennen verschiedene Ports").toBe(wahr);
    expect(
      form(appWert("PORT")?.roh ?? "").art === "fest"
        ? (form(appWert("PORT")?.roh ?? "") as { wert: string }).wert
        : appWert("PORT")?.roh,
      `Die Compose-Datei setzt PORT anders als der Container ihn fuehrt (${DOCKERFILE}, ${SERVER}). Der EXPOSE-Eintrag des Bauplans zeigt dann auf einen Port, auf dem nichts horcht.`,
    ).toBe(wahr);
  });

  it("C2 · die veroeffentlichte Portabbildung trifft genau diesen Port", () => {
    const wahr = portAusServer();
    const abbildungen = [...composeInhalt.matchAll(/^\s*-\s*"(\d+):(\d+)"\s*$/gm)].map((m) => ({
      wirt: m[1] as string,
      container: m[2] as string,
    }));
    expect(abbildungen.length, "Die Compose-Datei veroeffentlicht keinen Port").toBeGreaterThan(0);
    for (const { container } of abbildungen) {
      expect(container, "Die Portabbildung zeigt auf einen Port, auf dem nichts horcht").toBe(wahr);
    }
  });

  it("C3 · die Betriebsanleitungen nennen denselben Port und keinen zweiten", () => {
    const wahr = portAusServer();
    for (const datei of [RUNBOOK, ANLEITUNG]) {
      const genannt = portnennungen(lies(datei));
      expect(genannt, `${datei} nennt den Port des Containers nicht`).toContain(wahr);
      expect(
        genannt.filter((p) => p !== wahr),
        `${datei} nennt neben ${wahr} noch einen anderen Port. Wer beide Seiten liest, bekommt zwei Wahrheiten — genau der Befund, den dieser Auftrag abloest.`,
      ).toEqual([]);
    }
  });

  it("C4 · CANONICAL_HOST wird gefuehrt und faellt auf denselben Wirt zurueck wie der Code", () => {
    // WARUM NICHT EINFACH `${CANONICAL_HOST:-}`: Ein LEERER Wert ist nicht dasselbe wie ein nicht
    // gesetzter. `server.ts:20` liest `process.env.CANONICAL_HOST ?? "klarwerk.ai"` — `??` greift
    // bei `""` NICHT. Ein leerer Vorgabewert schaltete die Kanonik-Umleitung also still ab, statt
    // sie unveraendert zu lassen. Diese Probe haelt genau diese Falle zu.
    const zuweisung = appWert("CANONICAL_HOST");
    expect(
      zuweisung,
      `CANONICAL_HOST kommt in der Compose-Datei nicht vor, steht aber in ${RUNBOOK} als Pflicht. Der Ein-Befehl-Weg kann ihn so gar nicht setzen.`,
    ).toBeDefined();
    const f = form(zuweisung?.roh ?? "");
    expect(f.art, "CANONICAL_HOST muss ueberschreibbar bleiben").toBe("vorgabe");
    expect(
      (f as { wert: string }).wert,
      `Der Vorgabewert der Compose-Datei weicht vom Vorgabewert in ${SERVER} ab — ein leerer oder abweichender Wert aendert das Umleitungsverhalten still.`,
    ).toBe(kanonikAusServer());
  });

  it("C5 · die Aussage der Anleitung ueber TLS ist am Code gemessen, nicht behauptet", () => {
    // Die Anleitung sagt dem Betreiber: ohne TLS davor bekommt er das Anmeldeplaetzchen nicht, und
    // abschalten kann er es in Produktion NICHT. Beides wird hier am echten Waechter ausgefuehrt.
    expect(() =>
      assertCookieSecurityConfig({ NODE_ENV: "production", COOKIE_SECURE: "false" }),
    ).toThrow();
    expect(() =>
      assertCookieSecurityConfig({ NODE_ENV: "production", COOKIE_SECURE: "true" }),
    ).not.toThrow();
    // Ohne NODE_ENV=production ist es ein Opt-in — das darf die Anleitung nicht verwechseln.
    expect(() => assertCookieSecurityConfig({ COOKIE_SECURE: "false" })).not.toThrow();
  });
});

// ================================================================================================
// D · DIE ANLEITUNG UND DER KATALOG LAUFEN NICHT AUSEINANDER (Lieferungen 3 und 5)
// ================================================================================================
describe("JOB 4201 D · die Betreiberanleitung nennt genau die Werte, die es gibt", () => {
  const anleitung = () => lies(ANLEITUNG);

  it("D1 · jeder Pflichtwert des Startvertrags steht in der Anleitung", () => {
    const genannt = genannteNamen(anleitung());
    const pflicht = STARTVERTRAG.filter((w) => w.pflicht.art === "produktion").map((w) => w.name);
    expect(pflicht.filter((name) => !genannt.has(name))).toEqual([]);
  });

  it("D2 · jeder Wert, der den Ein-Befehl-Start abbricht, steht in der Anleitung", () => {
    // Die Gegenrichtung zu D1, und sie faengt etwas anderes: `POSTGRES_PASSWORD` ist KEIN Wert des
    // Startvertrags (die Anwendung liest ihn nie — nur `docker compose` tut es), bricht den Start
    // aber genauso ab. Wer nur den Katalog abschriebe, liesse ihn weg.
    const genannt = genannteNamen(anleitung());
    const abbrechend = [...umgebung(composeInhalt, "app"), ...umgebung(composeInhalt, "db")]
      .filter((z) => form(z.roh).art === "pflicht")
      .map((z) => z.name);
    expect(
      abbrechend.length,
      "Die Compose-Datei kennt gar keinen abbrechenden Wert",
    ).toBeGreaterThan(1);
    expect(abbrechend.filter((name) => !genannt.has(name))).toEqual([]);
  });

  it("D3 · die Anleitung erfindet nichts — jeder genannte Bezeichner existiert im Code", () => {
    // DIE GEFAEHRLICHSTE HALBHEIT EINER BETRIEBSANLEITUNG ist ein plausibler Name, den niemand
    // liest: eine Umgebungsvariable, die es nicht gibt, oder ein Fehlercode, den die Anwendung nie
    // sendet. Der Betreiber sucht dann nach etwas, das nicht existiert.
    //
    // KEINE AUSNAHMELISTE, SONDERN EINE MESSUNG: Erlaubt ist, was im Startvertrag steht, was die
    // Compose-Datei fuehrt — oder was als Zeichenkette WIRKLICH im Produktionsquelltext vorkommt
    // (die Fehlercodes `ALREADY_SETUP` und `REGISTRATION_DISABLED` sind genau dieser Fall). Eine
    // von Hand gepflegte Freiliste waere am Tag ihrer Entstehung richtig und danach nie wieder.
    const imKatalog = new Set(STARTVERTRAG.map((w) => w.name));
    const inCompose = new Set(
      [...umgebung(composeInhalt, "app"), ...umgebung(composeInhalt, "db")].map((z) => z.name),
    );
    const quelltext = produktionsquelltext();
    const erfunden = [...genannteNamen(anleitung())].filter(
      (name) => !imKatalog.has(name) && !inCompose.has(name) && !quelltext.includes(`"${name}"`),
    );
    expect(erfunden).toEqual([]);
  });

  it("D4 · die Anleitung grenzt sich gegen die beiden Nachbarwege ab", () => {
    // Ohne diese Abgrenzung entstuende eine dritte Wahrheit neben dem Coolify-Runbook und dem
    // Mac-Studio-Weg — und der Betreiber wuesste nicht, welche fuer ihn gilt.
    const text = anleitung();
    expect(text).toContain("scripts/insel/README.md");
    expect(text).toContain(RUNBOOK);
  });

  it("D5 · das Coolify-Runbook verweist auf die Anleitung, statt sie zu wiederholen", () => {
    expect(lies(RUNBOOK)).toContain(ANLEITUNG);
  });

  // ==============================================================================================
  // D6 · RUNDE 2 — WAS DIE ANLEITUNG IN DIE `.env` SCHREIBEN LAESST, MUSS AUCH WIRKEN.
  // ==============================================================================================
  //
  // BENs BEFUND ZU RUNDE 1 (Korrekturpflicht 2): Die Anleitung riet, `DATABASE_URL` in die `.env`
  // zu setzen, um eine externe Datenbank zu benutzen. `docker-compose.prod.yml` setzt diesen Wert
  // aber FEST zusammen und liest keine Umgebungsvariable dieses Namens — der Betreiber haette
  // weiterhin die interne Datenbank benutzt und es an nichts gemerkt. Eine wirkungslose Anweisung
  // ist schlimmer als keine: sie erzeugt Vertrauen in einen Zustand, den es nicht gibt.
  //
  // DIESELBE KRANKHEIT SASS EINE ZEILE WEITER: `COOKIE_SECURE` steht in der Compose-Datei ebenfalls
  // fest (`"true"`), und die Diagnoseabteilung riet trotzdem, „die Zeile aus `.env` zu entfernen".
  //
  // GEPRUEFT WIRD DESHALB GEGEN DIE BEISPIELDATEI DER ANLEITUNG, in beide Richtungen.
  it("D6 · jeder Wert der Beispiel-`.env` wird von der Compose-Datei wirklich gelesen", () => {
    const ausDerAnleitung = envBeispielNamen(anleitung());
    expect(
      ausDerAnleitung.length,
      "Die Anleitung enthaelt keinen ausgewiesenen `.env`-Block — dann ist nicht pruefbar, wozu sie raet.",
    ).toBeGreaterThan(2);

    const wirkungslos = ausDerAnleitung.filter((name) => !liestAusUmgebung(composeInhalt, name));
    expect(
      wirkungslos,
      "Die Anleitung laesst diese Werte in die `.env` schreiben, aber die Compose-Datei reicht sie gar nicht durch. Der Betreiber setzt sie und nichts passiert.",
    ).toEqual([]);
  });

  it("D6b · kein Wert, den die Compose-Datei FESTSCHREIBT, steht in der Beispiel-`.env`", () => {
    // Die Gegenrichtung, und sie faengt den gefaehrlicheren Fall: ein fest verdrahteter Wert sieht
    // in einer Beispieldatei aus wie eine Einstellung. `DATABASE_URL`, `PORT` und `COOKIE_SECURE`
    // sind genau das.
    const ausDerAnleitung = new Set(envBeispielNamen(anleitung()));
    const festVerdrahtet = [...umgebung(composeInhalt, "app"), ...umgebung(composeInhalt, "db")]
      .filter((z) => form(z.roh).art === "fest" && !liestAusUmgebung(composeInhalt, z.name))
      .map((z) => z.name);
    expect(
      festVerdrahtet.length,
      "Die Compose-Datei schreibt gar nichts fest — dann misst diese Probe nichts.",
    ).toBeGreaterThan(1);
    expect(
      festVerdrahtet.filter((name) => ausDerAnleitung.has(name)),
      "Die Beispiel-`.env` fuehrt einen Wert, den die Compose-Datei festschreibt. Wer ihn dort setzt, aendert nichts — und glaubt, er haette.",
    ).toEqual([]);
  });
});

// ================================================================================================
// H · RUNDE 2 — DIE KANONIK-UMLEITUNG: WAS DIE ANLEITUNG SAGT, IST AUSGEFUEHRT
// ================================================================================================
describe("JOB 4201 H · die Kanonik-Angaben der Anleitung sind am echten Code gemessen", () => {
  it("H0 · der Umleitungscode wird wirklich aus server.ts gelesen", () => {
    const { konstante, rumpf, marke } = kanonikCode();
    expect(marke, "Die Marke der Kanonik steht nicht mehr in server.ts").toBeGreaterThanOrEqual(0);
    expect(konstante, "Die Konstante CANONICAL_HOST wurde nicht gefunden").toContain(
      "CANONICAL_HOST",
    );
    expect(rumpf, "Der Rumpf des Umleitungs-Hooks wurde nicht gefunden").toContain("301");
    // Und er steht so wirklich in der Datei — keine zusammengebaute Fassung.
    expect(lies(SERVER)).toContain(rumpf);
    expect(lies(SERVER)).toContain(konstante);
  });

  it("H1 · der Befund, der die Anleitung aus Runde 1 widerlegt", () => {
    // Die alte Anleitung schrieb: unveraenderte Vorgabe → „schickt jeden Besucher zur fremden
    // Website". GEMESSEN am echten Code passiert genau NICHTS.
    expect(kanonikLauf(undefined, "app.kunde.test")).toBeUndefined();
    expect(kanonikLauf("klarwerk.ai", "app.kunde.test")).toBeUndefined();
    expect(kanonikLauf(undefined, "wissen.kunde.test")).toBeUndefined();
    // Und DAS ist der Schritt, der die Umleitung erzeugt — der, zu dem Runde 1 geraten hat.
    expect(kanonikLauf("kunde.test", "app.kunde.test")?.ziel).toBe("https://kunde.test/start");
  });

  it("H2 · jede Zeile der Messtabelle in der Anleitung trifft zu", () => {
    const zeilen = kanonikTabelle(lies(ANLEITUNG));
    expect(
      zeilen.length,
      "Die Anleitung fuehrt keine ausgewiesene Kanonik-Messtabelle — dann steht dort eine Behauptung ohne Messung.",
    ).toBeGreaterThan(3);
    for (const zeile of zeilen) {
      const gemessen = kanonikLauf(zeile.kanonisch, zeile.wirt);
      if (zeile.erwartet === null) {
        expect(
          gemessen,
          `Die Anleitung sagt fuer Wirt „${zeile.wirt}" (CANONICAL_HOST ${zeile.kanonisch ?? "nicht gesetzt"}) „keine Umleitung" — gemessen wird aber eine auf ${gemessen?.ziel}.`,
        ).toBeUndefined();
      } else {
        // Der angefragte Pfad war `/start`; die Umleitung ist pfaderhaltend, das Ziel lautet also
        // `<Tabellenwert>/start`. Geprueft wird beides — Ziel UND Pfaderhalt.
        expect(
          gemessen?.ziel,
          `Die Anleitung sagt fuer Wirt „${zeile.wirt}" (CANONICAL_HOST ${zeile.kanonisch ?? "nicht gesetzt"}) eine Umleitung auf ${zeile.erwartet} — gemessen: ${gemessen?.ziel ?? "keine"}.`,
        ).toBe(`${zeile.erwartet}/start`);
        expect(gemessen?.code).toBe(301);
      }
    }
  });

  it("H3 · die Messtabelle enthaelt beide Ausgaenge — sonst prueft sie nur eine Haelfte", () => {
    const zeilen = kanonikTabelle(lies(ANLEITUNG));
    expect(
      zeilen.some((z) => z.erwartet === null),
      "kein Fall ohne Umleitung",
    ).toBe(true);
    expect(
      zeilen.some((z) => z.erwartet !== null),
      "kein Fall MIT Umleitung",
    ).toBe(true);
  });

  it("H4 · die Leer-Falle ist echt: ein leerer Wert ist nicht der Vorgabewert", () => {
    // `??` greift bei `""` nicht — der Vergleichsname wird dann `app.`, und die Umleitung ist
    // faktisch aus. Deshalb traegt die Compose-Datei den Vorgabewert woertlich (Fall C4).
    expect(kanonikLauf("", "app.klarwerk.ai")).toBeUndefined();
    expect(kanonikLauf(undefined, "app.klarwerk.ai")?.ziel).toBe("https://klarwerk.ai/start");
  });
});

// ================================================================================================
// E · DIE ERSTE ADMIN-EINRICHTUNG — GEMESSEN, NICHT FORTGESCHRIEBEN (Lieferung 4)
// ================================================================================================
describe("JOB 4201 E · was ueber den ersten Administrator geschrieben steht, gilt auch", () => {
  it("E1 · die Selbstregistrierung ist ohne ausdruecklichen Schalter AUS", () => {
    // DER GEMESSENE BEFUND GEGEN `deploy-hetzner.md:18` (Stand 05.07.2026): „Bei leerer Instanz
    // wird der ERSTE registrierte Anwender Admin." Der Weg ueber `POST /api/auth/register` ist
    // heute per Vorgabe ZU (`services/auth/src/routes.ts:351` antwortet 403
    // REGISTRATION_DISABLED). Wer dem Satz folgt, kommt auf einer frischen Instanz nicht an.
    expect(selfRegistrationEnabled({})).toBe(false);
    expect(selfRegistrationEnabled({ KLARWERK_SELF_REGISTRATION: "1" })).toBe(true);
  });

  it("E2 · beide Anleitungen nennen den Weg, der wirklich offen ist", () => {
    for (const datei of [RUNBOOK, ANLEITUNG]) {
      expect(
        lies(datei),
        `${datei} nennt den kontrollierten Ersteinrichtungsweg nicht beim Namen.`,
      ).toContain("/api/auth/setup");
    }
  });

  it("E3 · das Runbook schreibt den ungemessenen Satz von 2026-07-05 nicht fort", () => {
    const text = lies(RUNBOOK);
    expect(
      /ERSTE registrierte Anwender \*\*Admin\*\*/.test(text),
      `${RUNBOOK} fuehrt den Satz unveraendert weiter, obwohl der Registrierweg per Vorgabe zu ist.`,
    ).toBe(false);
  });
});

// ================================================================================================
// F · DER STARTVERTRAG SELBST — die Aussage, auf der die ganze Anleitung steht
// ================================================================================================
describe("JOB 4201 F · der Startvertrag verweigert genau die Lage, die dieser Auftrag schliesst", () => {
  it("F1 · Produktion ohne APP_BASE_URL fehlt namentlich", () => {
    expect(
      fehlendePflichtwerte({ NODE_ENV: "production", DATABASE_URL: "postgresql://x@y:5432/z" }),
    ).toContain("APP_BASE_URL");
  });

  it("F2 · mit beiden Werten fehlt nichts — die Anleitung ist erfuellbar, nicht bloss streng", () => {
    expect(
      fehlendePflichtwerte({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x@y:5432/z",
        APP_BASE_URL: "https://wissen.kunde.test",
      }),
    ).toEqual([]);
  });

  it("F3 · der Katalog fuehrt die beiden Werte, die der Compose-Kundenweg zusaetzlich braucht", () => {
    const namen = STARTVERTRAG.map((w) => w.name);
    for (const name of ["CANONICAL_HOST", "COOKIE_SECURE"]) {
      expect(namen, `${name} fehlt im Startvertrag`).toContain(name);
      // Und sie bleiben Kannwerte: der Pflichtbegriff des Vertrags wird durch diesen Auftrag NICHT
      // erweitert (Auftrag §8.6c). Wer sie zu Pflichtwerten machte, braeche jede bestehende Instanz.
      expect(
        STARTVERTRAG.find((w) => w.name === name)?.pflicht.art,
        `${name} darf kein Pflichtwert werden — bestehende Instanzen starten sonst nicht mehr.`,
      ).toBe("nie");
    }
  });
});

// ================================================================================================
// DIE KALIBRIERUNG — ohne sie waere nicht zu unterscheiden, ob die Regeln etwas verlangen.
// ================================================================================================
//
// Jeder Fall fuehrt die Regel auf SYNTHETISCHEN Eingaben aus; die Produktdateien werden dabei nicht
// angefasst. Das ist die Antwort auf den Einwand, den der Auftrag selbst erhebt (§6): „Ohne diese
// Gegenprobe ist Fall 1 eine Textpruefung, die auch ein Kommentar erfuellen koennte."
describe("JOB 4201 · die Regeln schlagen an — kalibriert an synthetischen Eingaben", () => {
  const geruest = [
    "# Kopfkommentar",
    "services:",
    "  db:",
    "    environment:",
    "      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD setzen}",
    "  app:",
    "    environment:",
    "      PORT: 3001",
    "      APP_BASE_URL: ${APP_BASE_URL:?APP_BASE_URL setzen}",
    "    ports:",
    '      - "3001:3001"',
    "",
  ].join("\n");

  it("K1 · der ALTE Stand der Compose-Datei wird als Vorgabewert erkannt", () => {
    // Woertlich die Zeile, die dieser Auftrag abloest (`docker-compose.prod.yml:52`, Stand 8f015c4).
    const alt = form("${APP_BASE_URL:-https://app.klarwerk.ai}");
    expect(alt.art).toBe("vorgabe");
    expect((alt as { wert: string }).wert).toBe("https://app.klarwerk.ai");
  });

  it("K2 · die Pflichtform wird als Pflicht erkannt, ein Kommentar daneben nicht", () => {
    expect(form("${APP_BASE_URL:?APP_BASE_URL setzen}").art).toBe("pflicht");
    const nurKommentar = geruest.replace(
      "      APP_BASE_URL: ${APP_BASE_URL:?APP_BASE_URL setzen}",
      "      # APP_BASE_URL: ${APP_BASE_URL:?APP_BASE_URL setzen}",
    );
    expect(nurKommentar).toContain("APP_BASE_URL"); // die naive Suche waere gruen …
    expect(umgebung(nurKommentar, "app").map((z) => z.name)).not.toContain("APP_BASE_URL"); // … die Regel nicht
  });

  it("K3 · ein Wert im falschen Dienst gilt nicht als Wert des Dienstes app", () => {
    expect(umgebung(geruest, "db").map((z) => z.name)).toContain("POSTGRES_PASSWORD");
    expect(umgebung(geruest, "app").map((z) => z.name)).not.toContain("POSTGRES_PASSWORD");
  });

  it("K4 · die Portregel unterscheidet Wirts- und Containerseite", () => {
    const schief = geruest.replace('- "3001:3001"', '- "3001:3000"');
    const container = [...schief.matchAll(/^\s*-\s*"(\d+):(\d+)"\s*$/gm)].map((m) => m[2]);
    expect(container).toEqual(["3000"]);
    expect(container).not.toEqual(["3001"]);
  });

  it("K5 · die Portnennung eines Dokuments findet wirklich beide Zahlen", () => {
    expect(portnennungen("Container-Port **3001**, Compose nennt 3000.").sort()).toEqual([
      "3000",
      "3001",
    ]);
    // Und eine Jahreszahl ist keine Portnennung.
    expect(portnennungen("Stand: 05.07.2026")).toEqual([]);
  });

  it("K6 · der Namensleser nimmt den GANZEN Ruecktaktinhalt, nicht ein Wort daraus", () => {
    expect([...genannteNamen("Setzen Sie `APP_BASE_URL` in der `.env`.")]).toEqual([
      "APP_BASE_URL",
    ]);
    // Die Halbheit, gegen die D3 sonst unerfuellbar waere: ein HTTP-Verb in einem Pfad.
    expect([...genannteNamen("Rufen Sie `POST /api/auth/setup` auf.")]).toEqual([]);
    // Und ein Name in FLIESSTEXT ohne Ruecktakte zaehlt nicht — sonst waere jede Erzaehlung eine Zusage.
    expect([...genannteNamen("Der Wert APP_BASE_URL wird hier nur erwaehnt.")]).toEqual([]);
  });

  it("K6b · die Quelltexterhebung greift und trennt Produktion von Tests", () => {
    const quelltext = produktionsquelltext();
    expect(quelltext.length, "Die Erhebung liest gar keinen Quelltext").toBeGreaterThan(100_000);
    // Zwei Codes, die die Anleitung nennt und die es wirklich gibt …
    expect(quelltext).toContain('"ALREADY_SETUP"');
    expect(quelltext).toContain('"REGISTRATION_DISABLED"');
    // … und einer, den es nicht gibt: ohne diese Zeile waere D3 auch fuer eine Erfindung gruen.
    expect(quelltext).not.toContain('"KLARWERK_ERFUNDENER_CODE"');
  });

  it("K7 · der leere Wirt faellt NICHT auf den Vorgabewert zurueck — die Falle ist echt", () => {
    // Die Messung hinter dem Kommentar an C4: `??` greift bei `""` nicht.
    const leer: Record<string, string | undefined> = { CANONICAL_HOST: "" };
    expect(leer.CANONICAL_HOST ?? "klarwerk.ai").toBe("");
    const nichtGesetzt: Record<string, string | undefined> = {};
    expect(nichtGesetzt.CANONICAL_HOST ?? "klarwerk.ai").toBe("klarwerk.ai");
  });
});
