// ================================================================================================
// JOB 3667 · WORD-RÜCKWEG — DIE ACCOUNTREGEL DES FENSTERS IST EIN SPIEGEL, KEINE ZWEITE WAHRHEIT.
// ================================================================================================
//
// DAS PROBLEM, das diese Datei löst. Das Aufgabenfenster muss VOR dem Schreiben wissen, welchen Weg
// der Griff geht: aktualisieren und freigeben (Fall 1) oder einen gebundenen Vorschlag einreichen
// (Fall 2). Dafür trägt das Fenster die Liste `KW_RW_FREIGABE_ROLLEN` — seit dem Schnitt (R8) in
// `apps/web/public/word-addin/rueckweg.js`, der zweiten Datei, die `taskpane.html` lädt. Eine im Client
// abgeschriebene Rechtematrix ist aber genau die zweite Wahrheit, die auseinanderläuft, sobald
// jemand `services/rbac/src/policy.ts` ändert — und zwar STILL: das Fenster böte dann einem Konto
// eine Freigabe an, die die Route ihm verweigert (oder umgekehrt verwiese es ein berechtigtes Konto
// auf den Einreichweg).
//
// DIE ANTWORT IST KEIN KOMMENTAR, SONDERN DIESER TEST: er LIEST die Matrix und die Liste und hält
// sie gegeneinander. Wer die Rechte ändert, wird hier rot und entscheidet bewusst.
//
// WARUM `users.manage` UND NICHT `ko.validate`: Pedis Satz lautet „die Freigabe gleich das als
// geprüft zu hinterlegen" (SICHTBARES-GESPRAECH.jsonl:693). GLEICH als geprüft ablegen kann im
// Bestand allein `admin-validate` (services/validation/src/service.ts:328, Status „validiert",
// Trust am Deckel) — und diese Aktion verlangt an der Route `users.manage`
// (services/app/src/routes/ko-routes.ts, `case "admin-validate"`). Eine Bewertung (`ko.validate`)
// ist dagegen EINE Stimme von `neededValidations` (Werksvorgabe 3) und macht die Änderung gerade
// NICHT sofort gültig. Beides ist unten gemessen, damit die Begründung nicht bloß dasteht.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "../../services/rbac/src/policy";

const WURZEL = join(__dirname, "..", "..");
// JOB 3667 R8 (14.09.2026): die Liste steht seit dem Schnitt in der ZWEITEN ausgelieferten
// Skriptdatei des Fensters. Dieselbe Auslieferung, dieselbe Regel — nur eine andere Datei; der
// Wächter liest sie dort, statt eine Kopie in `taskpane.html` zu verlangen, die es nicht gibt.
const RUECKWEG = join(WURZEL, "apps", "web", "public", "word-addin", "rueckweg.js");
const KO_ROUTES = join(WURZEL, "services", "app", "src", "routes", "ko-routes.ts");
// JOB 3667 R3: die Web-Fläche trifft dieselbe Vorentscheidung wie das Word-Fenster und braucht
// deshalb denselben Wächter. Zwei Flächen, zwei Listen — aber nur EINE Wahrheit dahinter.
const BIBLIOTHEK_LESEN = join(
  WURZEL,
  "apps",
  "web",
  "src",
  "components",
  "bibliothek",
  "BibliothekLesen.tsx",
);

/** Die Liste des Fensters, aus der ausgelieferten Datei gelesen — nicht hier abgeschrieben. */
function freigabeRollenDesFensters(quelle: string = readFileSync(RUECKWEG, "utf8")): string[] {
  const treffer = /var KW_RW_FREIGABE_ROLLEN = \[([^\]]*)\];/.exec(quelle);
  if (treffer === null) {
    throw new Error("KW_RW_FREIGABE_ROLLEN steht nicht (mehr) in rueckweg.js");
  }
  return [...(treffer[1] as string).matchAll(/"([a-z]+)"/g)].map((m) => m[1] as string);
}

/**
 * Dieselbe Lesung für die WEB-Fläche (`RW_FREIGABE_ROLLEN` in `BibliothekLesen.tsx`).
 *
 * GELESEN UND NICHT IMPORTIERT, aus zwei Gründen: die Konstante ist bewusst NICHT exportiert (der
 * Aufrufer-Wächter `tests/capture/aufrufer-waechter.test.ts` verlangt für jeden neuen Export einen
 * Aufrufer ausserhalb der Tests, und ein Export nur für diesen Wächter wäre genau der Fall, den er
 * verbietet), und die Quelle ist `.tsx` — ein Import zöge jsx und die DOM-Typen in eine Datei, die
 * der Node-reine Wurzel-Typecheck liest.
 */
function freigabeRollenDerWebFlaeche(
  quelle: string = readFileSync(BIBLIOTHEK_LESEN, "utf8"),
): string[] {
  const treffer = /const RW_FREIGABE_ROLLEN = \[([^\]]*)\];/.exec(quelle);
  if (treffer === null) {
    throw new Error("RW_FREIGABE_ROLLEN steht nicht (mehr) in BibliothekLesen.tsx");
  }
  return [...(treffer[1] as string).matchAll(/"([a-z]+)"/g)].map((m) => m[1] as string);
}

/** Die Rollen, die eine Berechtigung tragen — aus der Matrix, nicht aus einer Liste in diesem Test. */
function rollenMit(permission: string): string[] {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, rechte]) => (rechte as readonly string[]).includes(permission))
    .map(([rolle]) => rolle)
    .sort();
}

describe("JOB 3667 · die Accountregel des Rückwegs", () => {
  it("S1: das Fenster hält genau die Rollen für freigabeberechtigt, die `users.manage` tragen", () => {
    expect(freigabeRollenDesFensters().sort()).toEqual(rollenMit("users.manage"));
  });

  it("S2: die Aktion, auf die sich das stützt, verlangt an der Route wirklich `users.manage`", () => {
    const quelle = readFileSync(KO_ROUTES, "utf8");
    const ab = quelle.indexOf('case "admin-validate": {');
    expect(ab, 'die `case "admin-validate"` wurde in ko-routes.ts nicht gefunden').toBeGreaterThan(
      0,
    );
    // Der Rechteruf steht im Zweig selbst — die ersten Zeilen nach der Marke, vor dem nächsten case.
    const zweig = quelle.slice(ab, quelle.indexOf("case ", ab + 10));
    expect(zweig).toContain('guards.requirePermission("users.manage"');
  });

  it("S3: `ko.validate` wäre die falsche Grundlage — es tragen andere Rollen als `users.manage`", () => {
    // Ohne diesen Fall wäre S1 auch dann grün, wenn beide Berechtigungen zufällig deckungsgleich
    // wären — und die Begründung im Kopf dieser Datei unüberprüfbar.
    expect(rollenMit("ko.validate")).not.toEqual(rollenMit("users.manage"));
    expect(rollenMit("ko.validate").length).toBeGreaterThan(rollenMit("users.manage").length);
  });

  it("K1 (Kalibrierung): eine verfälschte Liste im Fenster wird rot", () => {
    const verfaelscht = readFileSync(RUECKWEG, "utf8").replace(
      /var KW_RW_FREIGABE_ROLLEN = \[[^\]]*\];/,
      'var KW_RW_FREIGABE_ROLLEN = ["admin", "experte"];',
    );
    expect(freigabeRollenDesFensters(verfaelscht).sort()).not.toEqual(rollenMit("users.manage"));
  });

  it("K2 (Kalibrierung): fehlt die Liste ganz, schweigt der Wächter nicht — er wirft", () => {
    const ohne = readFileSync(RUECKWEG, "utf8").replace(
      /var KW_RW_FREIGABE_ROLLEN = \[[^\]]*\];/,
      "",
    );
    expect(() => freigabeRollenDesFensters(ohne)).toThrow(/KW_RW_FREIGABE_ROLLEN/);
  });

  // ==============================================================================================
  // JOB 3667 R3 — DIE WEB-FLÄCHE STEHT UNTER DEMSELBEN WÄCHTER.
  // ==============================================================================================
  //
  // Seit Runde 3 entscheidet auch `BibliothekLesen.tsx` VOR dem Aufruf, welcher Weg gilt: direkt
  // ablegen (Fall 1) oder einen gebundenen Vorschlag einreichen (Fall 2/3). Damit gibt es eine ZWEITE
  // Liste im Client — und die Gefahr, dass die beiden Flächen auseinanderlaufen, ist ab jetzt eine
  // reale, nicht eine gedachte. S4 hält sie deshalb gegen die Matrix UND gegeneinander.

  it("S4: die Web-Fläche hält genau dieselben Rollen für freigabeberechtigt wie die Matrix", () => {
    expect(freigabeRollenDerWebFlaeche().sort()).toEqual(rollenMit("users.manage"));
  });

  it("S5: Word-Fenster und Web-Fläche sagen dasselbe — zwei Flächen, eine Regel", () => {
    // Ohne diesen Fall könnten beide einzeln gegen die Matrix grün sein und trotzdem verschieden
    // gelesen werden, sobald jemand eine der beiden Listen um einen Kommentar oder eine Schreibweise
    // verändert, die das jeweils andere Muster nicht trifft.
    expect(freigabeRollenDerWebFlaeche().sort()).toEqual(freigabeRollenDesFensters().sort());
  });

  it("K3 (Kalibrierung): eine verfälschte Liste der Web-Fläche wird rot", () => {
    const verfaelscht = readFileSync(BIBLIOTHEK_LESEN, "utf8").replace(
      /const RW_FREIGABE_ROLLEN = \[[^\]]*\];/,
      'const RW_FREIGABE_ROLLEN = ["admin", "controller"];',
    );
    expect(freigabeRollenDerWebFlaeche(verfaelscht).sort()).not.toEqual(rollenMit("users.manage"));
  });

  it("K4 (Kalibrierung): fehlt die Liste der Web-Fläche ganz, wirft der Wächter", () => {
    const ohne = readFileSync(BIBLIOTHEK_LESEN, "utf8").replace(
      /const RW_FREIGABE_ROLLEN = \[[^\]]*\];/,
      "",
    );
    expect(() => freigabeRollenDerWebFlaeche(ohne)).toThrow(/RW_FREIGABE_ROLLEN/);
  });
});
