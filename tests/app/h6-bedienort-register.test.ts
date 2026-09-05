// ================================================================================================
// JOB 3065 H6 R9 · DAS BEDIENORT-REGISTER — „Ansicht als Rolle" und „Erweiterte Module".
// ================================================================================================
//
// BEN, Runde 8, Korrekturpflicht 1: „genau ein Rollen-Auswahlort und ein Stufe-2-Schalter … Das
// Register muss diesen Zielzustand prüfen." Und im Substanzurteil 2: „Der Registertest verlangt
// ausdrücklich die offene Doppelung." Das war bis Runde 8 so — dieser Wächter FÜHRTE die Doppelung
// als bekannten Zustand `doppelung-offen`, statt sie zu verbieten. Genau das ist jetzt weg.
//
// Der Wächter verlangt ab hier den ZIELZUSTAND, nicht seine Beschreibung:
//   R1  jeder Ort im Produkt, der `setRole(` oder `setStufe2(` aufruft, steht im Register …
//   R1  … und jeder Registereintrag steht im Produkt (kein Eintrag als Karteileiche)
//   R2  die Einstellungen sind der EINE Weg: die Zeile und die Karte hinter ihrem Chevron
//   R3  in der HÜLLE (`shell/**`) wird dieser Zustand nirgends umgeschaltet
//
// R3 ist bewusst über das ganze Verzeichnis formuliert und nicht über eine einzelne Datei. Bis
// JOB 3060 sass der zweite Ort in `shell/Sidebar.tsx`; seit 3060 sitzt er in
// `shell/RollenVorschau.tsx` (Rollenraster als `fieldset` mit vier `menuitemradio`-Knöpfen, dazu das
// Stufe-2-Häkchen), eingebunden über `shell/ZahnradMenue.tsx`. Ein Wächter auf den DATEINAMEN hätte
// diesen Umzug nicht bemerkt und wäre stumm grün geblieben — die Doppelung wäre nur umgezogen.
//
// WAS DER RÜCKWEG DARF, UND WARUM ER KEIN BEDIENORT IST: „Zur Admin-Ansicht" in
// `shell/RollenVorschau.tsx` ruft `setRole("admin")` und ist damit nach der Zählweise unten sehr
// wohl ein Bedienort — er MUSS in der Hülle bleiben, denn er ist genau der Ausweg, den BEN in
// Runde 6 vermisst hat (die Vorschau sperrt `/admin`, ein Rückweg auf der gesperrten Seite wäre
// keiner). Deshalb trennt R3 nicht nach Datei, sondern nach SACHE: die AUSWAHL einer Rolle und der
// Stufe-2-Schalter gehören in die Einstellungen; der Rückweg in die eigene Rolle gehört in die
// Hülle. Der Griff dafür ist unten `auswahlorte()` — er sucht das Rollenraster und das Häkchen,
// nicht jeden Aufruf von `setRole`.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = join(__dirname, "../../apps/web/src");

/** Der Zustand eines Bedienortes im Register. */
type Zustand =
  /** Der EINE Ort, den dieser Auftrag baut (Auftrag Lieferung 4). */
  | "einstellungen"
  /** Kein Auswahlort: der Rückweg in die eigene Rolle, der in der Hülle bleiben MUSS. */
  | "rueckweg"
  /** Kein Einstellungs-Bedienort: ein einmaliger Freischalt-Knopf an der gesperrten Stelle selbst. */
  | "tor";

interface Eintrag {
  zustand: Zustand;
  /** Was dort umgeschaltet wird. */
  was: "ansicht-als-rolle" | "stufe-2" | "beides" | "zurueck-zu-admin";
  grund: string;
}

const REGISTER: Record<string, Eintrag> = {
  "pages/Admin.tsx": {
    zustand: "einstellungen",
    was: "beides",
    grund:
      "Auftrag Lieferung 4: Konten → Zeile Ansicht als Rolle (Chevron) und Zeile " +
      "Erweiterte Module (Schalter). Der vorgesehene Ort.",
  },
  "pages/AdminKontenDetails.tsx": {
    zustand: "einstellungen",
    was: "ansicht-als-rolle",
    grund:
      "Kein zweiter Ort, sondern die zweite Hälfte desselben: die Detailkarte hinter der Zeile " +
      "Ansicht als Rolle. Erreichbar ausschliesslich ueber deren Chevron (Admin.tsx: setDetail " +
      "ansichtRolle) — ein Weg, zwei Dateien.",
  },
  "shell/RollenVorschau.tsx": {
    zustand: "rueckweg",
    was: "zurueck-zu-admin",
    grund:
      'JOB 3060. Der Knopf „Zur Admin-Ansicht" (setRole("admin")) im Zahnrad-Menü ist der ' +
      "Ausweg aus der Vorschau und gehoert in die Huelle: waehrend der Vorschau ist /admin " +
      "gesperrt, ein Rueckweg auf dieser Seite waere unerreichbar (BEN Runde 6). KEIN Auswahlort — " +
      "das Rollenraster und das Stufe-2-Haekchen gehoeren nicht hierher, siehe R3.",
  },
  "components/Stage2Notice.tsx": {
    zustand: "tor",
    was: "stufe-2",
    grund:
      "Kein zweiter Einstellungsort: die Sperrseite einer Stufe-2-Fläche bietet dem Admin den " +
      "einmaligen Weg (hier freischalten) an der Stelle, an der er ansteht. Kein Umschalter, " +
      "keine Anzeige eines Zustands.",
  },
};

/**
 * Der CODE einer Datei — ohne ihre Kommentare.
 *
 * WARUM: Wo ein Bedienort einmal stand, steht später die Begründung, warum er weg ist — und die
 * nennt `setRole`, `setStufe2` und die Beschriftungen. Ein Griff über den rohen Text würde diese
 * Erklärung als Bedienort zählen und die Bahn dazu erziehen, das Warum zu verschweigen. Gezählt
 * wird deshalb, was AUSGEFÜHRT wird.
 *
 * Bewusst nur Blockkommentare und Zeilen, die MIT `//` beginnen: ein `//` mitten in einer Zeile
 * könnte in einer Zeichenkette stehen (`"https://…"`), und der Rest der Zeile ginge verloren. Der
 * Griff ist damit in die sichere Richtung ungenau — er übersieht keinen Aufruf, er zählt höchstens
 * einen zu viel.
 */
function ohneKommentare(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((z) => !/^\s*\/\//.test(z))
    .join("\n");
}

/** Jede Produktdatei der Web-App (ohne die Tests, die neben dem Code liegen). */
function produktdateien(): string[] {
  return readdirSync(WEB, { recursive: true, encoding: "utf8" })
    .filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p))
    .map((p) => p.replaceAll("\\", "/"));
}

function code(rel: string): string {
  return ohneKommentare(readFileSync(join(WEB, rel), "utf8"));
}

/**
 * Der Aufruf des HAKENS, nicht der des Servers.
 *
 * `setRole(r)` schaltet die eigene ANSICHT um (RoleContext). `endpoints.users.setRole(id, rolle)`
 * ändert die Rolle EINES NUTZERS in der Datenbank — eine ganz andere Sache, die in der Detailkarte
 * eines Nutzers zu Recht steht. Ein Griff, der beides zusammenwirft, würde jede Seite, die Rollen
 * verwaltet, zum Bedienort der Vorschau erklären. Das führende `(?<![.\w])` schliesst deshalb
 * alles aus, was auf einem Punkt (Methodenaufruf) oder mitten in einem Bezeichner steht.
 */
const HAKEN_SET_ROLE = /(?<![.\w])setRole\(/;
const HAKEN_SET_STUFE2 = /(?<![.\w])setStufe2\(/;

/**
 * Ein Bedienort ist eine Stelle, die den Zustand wirklich UMSCHALTET — also `setStufe2(…)` oder
 * `setRole(…)` aufruft. Die Definition der Haken selbst (`RoleContext.tsx`) ist keiner.
 */
function bedienorte(): string[] {
  const gefunden: string[] = [];
  for (const rel of produktdateien()) {
    if (rel === "app/RoleContext.tsx") {
      continue;
    }
    const text = code(rel);
    if (HAKEN_SET_STUFE2.test(text) || HAKEN_SET_ROLE.test(text)) {
      gefunden.push(rel);
    }
  }
  return gefunden.sort();
}

/**
 * Ein AUSWAHLORT ist stärker als ein Bedienort: dort wird eine Rolle GEWÄHLT (eine Schleife über
 * `ROLES` mit `setRole` je Eintrag) oder Stufe 2 geschaltet. Der Rückweg `setRole("admin")` ist
 * keiner — er stellt die eigene Rolle wieder her und bietet keine Wahl an.
 */
function auswahlorte(): { datei: string; was: string }[] {
  const gefunden: { datei: string; was: string }[] = [];
  for (const rel of produktdateien()) {
    if (rel === "app/RoleContext.tsx") {
      continue;
    }
    const text = code(rel);
    // Rollenraster: eine Schleife über ROLES, in der der HAKEN mit der Laufvariablen gerufen wird
    // (`setRole(r)`), nicht mit der eigenen Rolle (`setRole("admin")` ist der Rückweg).
    if (/ROLES\.map\(/.test(text) && /(?<![.\w])setRole\((?!["']admin["'])/.test(text)) {
      gefunden.push({ datei: rel, was: "rollenraster" });
    }
    if (HAKEN_SET_STUFE2.test(text)) {
      gefunden.push({ datei: rel, was: "stufe-2" });
    }
  }
  return gefunden.sort((a, b) => (a.datei + a.was).localeCompare(b.datei + b.was));
}

describe("JOB 3065 H6 R9 · Bedienort-Register: Ansicht als Rolle und Erweiterte Module", () => {
  it("K · KALIBRIERUNG: der Griff liest wirklich die Web-App", () => {
    const dateien = produktdateien();
    expect(dateien.length, "keine Produktdatei gelesen").toBeGreaterThan(100);
    expect(dateien).toContain("pages/Admin.tsx");
  });

  it("K2 · KALIBRIERUNG: der Kommentarschnitt trifft die Erklärung, nicht den Aufruf", () => {
    expect(ohneKommentare("onChange={(e) => setStufe2(e.target.checked)}")).toContain("setStufe2(");
    expect(
      code("pages/Admin.tsx"),
      "der Griff findet den echten Aufruf in Admin.tsx nicht mehr — er schneidet zu viel",
    ).toMatch(/\bsetStufe2\(/);
    expect(ohneKommentare("// hier stand setRole( und setStufe2(\nconst a = 1;")).not.toMatch(
      /\bsetRole\(/,
    );
    expect(ohneKommentare("/** RoleSwitcher rief setRole( auf */\nconst b = 2;")).not.toMatch(
      /\bsetRole\(/,
    );
    // Und die zweite Trennung: der Server-Aufruf ist kein Bedienort der eigenen Vorschau.
    expect(HAKEN_SET_ROLE.test("endpoints.users.setRole(v.id, v.role)")).toBe(false);
    expect(HAKEN_SET_ROLE.test("onClick={() => setRole(r)}")).toBe(true);
    expect(
      HAKEN_SET_ROLE.test(code("pages/AdminKontenDetails.tsx")),
      "der Griff findet den echten Haken-Aufruf in AdminKontenDetails.tsx nicht mehr",
    ).toBe(true);
  });

  it("R1 · jeder Bedienort im Produkt steht im Register — und jeder Registereintrag im Produkt", () => {
    const gefunden = bedienorte();
    const gefuehrt = Object.keys(REGISTER).sort();

    const ohneEintrag = gefunden.filter((f) => REGISTER[f] === undefined);
    expect(
      ohneEintrag,
      `Bedienort ohne Registereintrag: ${ohneEintrag.join(" · ")} — begründen oder entfernen`,
    ).toEqual([]);

    // Und umgekehrt: ein Eintrag, den das Produkt nicht mehr trägt, ist eine Karteileiche.
    const karteileichen = gefuehrt.filter((f) => !gefunden.includes(f));
    expect(
      karteileichen,
      `Registereintrag ohne Bedienort im Produkt: ${karteileichen.join(" · ")} — Eintrag streichen`,
    ).toEqual([]);
  });

  it("R2 · EIN Weg in den Einstellungen: die Zeile und die Karte hinter ihrem Chevron", () => {
    const orte = Object.entries(REGISTER)
      .filter(([, e]) => e.zustand === "einstellungen")
      .map(([f]) => f)
      .sort();
    expect(orte).toEqual(["pages/Admin.tsx", "pages/AdminKontenDetails.tsx"]);

    // Beide Zeilen stehen wirklich auf der Fläche (Auftrag Lieferung 4) …
    const admin = readFileSync(join(WEB, "pages/Admin.tsx"), "utf8");
    expect(admin).toContain('testId="zeile-ansicht-rolle"');
    expect(admin).toContain('testId="zeile-stufe2"');
    // … und die zweite Datei ist wirklich nur die Karte HINTER der ersten Zeile: sie wird von
    // genau einer Stelle geöffnet und öffnet sich nicht selbst.
    expect(admin).toContain('setDetail("ansichtRolle")');
    expect(admin.match(/setDetail\("ansichtRolle"\)/g)?.length).toBe(1);
    expect(readFileSync(join(WEB, "pages/AdminKontenDetails.tsx"), "utf8")).toContain(
      'testId="detail-ansicht-rolle"',
    );
  });

  it("R3 · die Hülle wählt keine Rolle und schaltet kein Stufe 2 — sie trägt nur den Rückweg", () => {
    const inDerHuelle = auswahlorte().filter((o) => o.datei.startsWith("shell/"));
    expect(
      inDerHuelle.map((o) => `${o.datei} (${o.was})`),
      "Auswahlort in der Hülle — Rollenraster und Stufe-2-Schalter gehören in die Einstellungen " +
        '(Auftrag Lieferung 4); in der Hülle bleibt allein „Zur Admin-Ansicht"',
    ).toEqual([]);

    // Und die Gegenrichtung, damit R3 nicht durch Wegnehmen erfüllt werden kann: die Einstellungen
    // tragen beide Auswahlorte wirklich.
    const inDenEinstellungen = auswahlorte()
      .filter((o) => o.datei.startsWith("pages/"))
      .map((o) => `${o.datei} (${o.was})`)
      .sort();
    expect(inDenEinstellungen).toEqual([
      "pages/Admin.tsx (stufe-2)",
      "pages/AdminKontenDetails.tsx (rollenraster)",
    ]);
  });

  it("R4 · der Rückweg bleibt in der Hülle — er ist der Ausweg aus der gesperrten Seite", () => {
    const rueckweg = Object.entries(REGISTER).filter(([, e]) => e.zustand === "rueckweg");
    expect(rueckweg.map(([f]) => f)).toEqual(["shell/RollenVorschau.tsx"]);
    // Er ruft wirklich `setRole("admin")` — sonst wäre der Eintrag eine Behauptung.
    expect(code("shell/RollenVorschau.tsx")).toMatch(/setRole\(["']admin["']\)/);
  });
});
