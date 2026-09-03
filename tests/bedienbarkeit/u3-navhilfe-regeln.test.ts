// ================================================================================================
// JOB 3028 · U3 — DIE VIER REGELN VON `navHilfeFor`, EINZELN.
// ================================================================================================
//
// `navHilfeFor` ist die reine Zuordnung „Menüpunkt-Pfad → vorhandenes Hilfekapitel". Sie leitet ab
// und schreibt nicht ab: die Kapitel kommen aus `HELP_TOPICS`, nicht aus einer zweiten Tabelle.
// Hier steht jede der vier Regeln als eigener Fall — drei davon gegen den ECHTEN Bestand, die
// vierte (Mehrdeutigkeit) gegen einen gesetzten Bestand in `u3-navhilfe-quelle.test.tsx`, weil sie
// im echten Bestand nicht vorkommt und auch nicht dafür erfunden werden darf.
//
// DOM-frei und ohne i18n: geprüft werden die SCHLÜSSEL, nicht die aufgelösten Texte. Dass der Text
// an der Fläche wirklich ankommt, misst der gemountete Nachbar `u3-menuepunkt-erklaert-sich`.
import { describe, expect, it } from "vitest";
import { ALL_ITEMS } from "../../apps/web/src/app/navigation";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { navHilfeFor } from "../../apps/web/src/lib/navHilfe";

describe("JOB 3028 U3 · navHilfeFor — Regel 1: genau ein Kapitel auf der Route", () => {
  it("„Meine Aufgaben“ bekommt die Schlüssel des Kapitels `tasks`", () => {
    expect(navHilfeFor("/aufgaben")).toEqual({
      titleKey: "help.tasks.title",
      bodyKey: "help.tasks.body",
    });
  });

  it("jeder Menüpunkt mit genau einem Kapitel bekommt GENAU DESSEN Schlüssel — keine Verwechslung", () => {
    const treffer = ALL_ITEMS.filter(
      (item) =>
        item.path !== "/admin" && HELP_TOPICS.filter((t) => t.to === item.path).length === 1,
    );
    // Ohne diese Untergrenze wäre der Fall auch dann grün, wenn die Zuordnung gar nichts fände.
    expect(treffer.length, "kein einziger Menüpunkt mit Kapitel — die Fläche fehlt").toBe(8);
    for (const item of treffer) {
      const kapitel = HELP_TOPICS.find((t) => t.to === item.path);
      expect(navHilfeFor(item.path), `falsches Kapitel an ${item.path}`).toEqual({
        titleKey: kapitel?.titleKey,
        bodyKey: kapitel?.bodyKey,
      });
    }
  });
});

describe("JOB 3028 U3 · navHilfeFor — Regel 2: kein Kapitel ⇒ null", () => {
  it("die elf Menüpunkte ohne Kapitel bekommen nichts — Fehlen ist die ehrliche Auskunft", () => {
    const ohne = ALL_ITEMS.filter(
      (item) => HELP_TOPICS.filter((t) => t.to === item.path).length === 0,
    ).map((item) => item.path);
    expect(ohne.length, "die Menge der kapitellosen Punkte ist nicht mehr elf").toBe(11);
    for (const pfad of ohne) {
      expect(navHilfeFor(pfad), `${pfad} bekommt einen Hinweis ohne Kapitel`).toBeNull();
    }
  });

  it("eine Route, die es gar nicht gibt, bekommt ebenfalls nichts", () => {
    expect(navHilfeFor("/gibt-es-nicht")).toBeNull();
  });
});

describe("JOB 3028 U3 · navHilfeFor — Regel 4: die eine ausgeschriebene Ausnahme", () => {
  it("/admin bekommt nichts, OBWOHL dort ein Kapitel liegt — es beantwortet eine andere Frage", () => {
    // Erst der Beleg, dass die Null wirklich aus der Ausnahme kommt und nicht aus einem Fehlen:
    const kapitel = HELP_TOPICS.filter((t) => t.to === "/admin");
    expect(
      kapitel.map((t) => t.id),
      "auf /admin liegt nicht mehr genau `firststart`",
    ).toEqual(["firststart"]);
    expect(navHilfeFor("/admin")).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// DIE AUFTEILUNG DER MENÜPUNKTE — VOLLSTÄNDIG, OHNE REST.
// ------------------------------------------------------------------------------------------------
//
// WARUM ES DIESEN FALL GIBT (JOB 3028 R1, Codex-Korrekturpflicht 1): Die Rückgabe der ersten Runde
// schrieb „acht tragen einen Hinweis, die übrigen ELF bleiben stumm" und rechnete damit falsch —
// stumm sind ZWÖLF: elf ohne Hilfekapitel PLUS `/admin` als begründete Ausnahme. Der Bau war
// richtig, die Aussage darüber nicht.
//
// Ein Satz, der sich verzählen kann, gehört nicht in eine Rückgabe, sondern in einen Fall. Dieser
// hier zerlegt die Menüpunkte in vier Töpfe und verlangt, dass ihre Summe die Gesamtzahl ERGIBT —
// nicht dass sie „ungefähr passt". Ein Punkt, der in keinen Topf fällt, wäre ein stiller Rest, und
// genau aus einem stillen Rest entsteht die nächste falsche Zahl.
describe("JOB 3028 U3 · die Aufteilung der Menüpunkte geht ohne Rest auf", () => {
  it("20 gesamt = 8 mit Hinweis + 11 ohne Kapitel + 0 mehrdeutig + 1 begründete Ausnahme", () => {
    const kapitelZu = (pfad: string): number =>
      HELP_TOPICS.filter((topic) => topic.to === pfad).length;

    const mitHinweis = ALL_ITEMS.filter((i) => navHilfeFor(i.path) !== null);
    const ohneKapitel = ALL_ITEMS.filter((i) => kapitelZu(i.path) === 0);
    const mehrdeutig = ALL_ITEMS.filter((i) => kapitelZu(i.path) > 1);
    // Die Ausnahme ist genau das, was ein Kapitel HÄTTE und trotzdem stumm bleibt.
    const ausnahme = ALL_ITEMS.filter(
      (i) => kapitelZu(i.path) === 1 && navHilfeFor(i.path) === null,
    );

    expect(ALL_ITEMS.length, "gesamt").toBe(20);
    expect(mitHinweis.length, "mit Hinweis").toBe(8);
    expect(ohneKapitel.length, "ohne Kapitel").toBe(11);
    expect(mehrdeutig.length, "mehrdeutig").toBe(0);
    expect(
      ausnahme.map((i) => i.path),
      "begründete Ausnahme",
    ).toEqual(["/admin"]);

    // Kein Rest: die vier Töpfe decken jeden Menüpunkt genau einmal ab.
    expect(
      mitHinweis.length + ohneKapitel.length + mehrdeutig.length + ausnahme.length,
      "die vier Töpfe ergeben nicht die Gesamtzahl — es gibt einen stillen Rest",
    ).toBe(ALL_ITEMS.length);

    // Und die Zahl, um die es in der Rückgabe ging: STUMM sind zwölf, nicht elf.
    const stumm = ALL_ITEMS.filter((i) => navHilfeFor(i.path) === null);
    expect(stumm.length, "stumme Menüpunkte").toBe(12);
  });
});
