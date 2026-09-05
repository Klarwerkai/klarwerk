// ================================================================================================
// JOB 3082 · Q3 (a) — OHNE STUFE ENTSTEHT KEIN WISSENSOBJEKT, AUCH NICHT AM CLIENT VORBEI.
// ================================================================================================
//
// WARUM DIE SPERRE NICHT NUR AUF DER FLAECHE STEHEN DARF: Der Promote-Weg ist auch ohne das Blatt
// erreichbar (POST /api/drafts/:id/promote auf eine beliebige Entwurfskennung), das Word-Add-in
// legt Entwuerfe an, und im Bestand liegen Entwuerfe aus der Zeit, in der niemand gefragt wurde.
// Eine Pflicht, die nur die Oberflaeche kennt, ist keine Pflicht — sie ist eine Bitte.
//
// GEMESSEN WIRD DER ECHTE WEG (`capture.toKoInput` → `ko.create` → `ko.get`), nicht eine
// Nachbildung: derselbe Rundlauf wie in `services/capture/src/origin-durchreiche.test.ts`. Ein Test
// allein auf die Abbildung belegte, dass ein Feld gepruft WIRD — nicht, dass am Ende kein Objekt
// im Bestand steht.
//
// ANGENOMMENE FOLGE, ausdruecklich und nicht versehentlich: Entwuerfe OHNE Stufe sind ab hier
// nicht mehr promotebar, bis ein Mensch die Stufe waehlt. Genau das ist die Pflicht; der Weg
// dorthin steht auf der Flaeche (fortgesetzter Entwurf ohne Stufe fragt wieder nach).
import { describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { DraftPayload } from "../../services/capture/src/types";
// Ueber die OEFFENTLICHE index.ts des Zielmoduls (Architekturregel `module-boundaries`).
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";

/** Die vier bisherigen KO-Pflichtfelder — die Stufe wird je Fall daneben gesetzt oder weggelassen. */
const RUMPF: DraftPayload = {
  title: "Ventil X schliesst bei Ueberdruck",
  statement: "Bei Ueberdruck Ventil X manuell schliessen.",
  type: "best_practice",
  category: "Anlage 1",
};

interface Rundlauf {
  fehler: { code?: string } | null;
  bestand: number;
  input: Record<string, unknown> | null;
  /**
   * Das GESPEICHERTE Wissensobjekt, aus dem Bestand zurueckgelesen — nicht die Eingabe.
   *
   * NACHZUG (JOB 3082, nach dem Einbau von JOB 3076): Bis hierher endete dieser Rundlauf an der
   * KO-EINGABE. Das war damals ehrlich, denn der Speicherweg verwarf ein ausdrueckliches „intern"
   * noch (`services/knowledge-object/src/service.ts`, fuer JOB 3082 gesperrt) — eine Zusicherung
   * auf den Endzustand waere rot gewesen, ohne dass an DIESEM Auftrag etwas falsch gewesen waere.
   * JOB 3076 (Q1) hat die Zeile abgeloest (`service.ts:1726-1727`: speichern, sobald der Aufrufer
   * die Stufe mitbringt). Damit ist genau der Satz messbar, den Codex im Befund R-1560 geschrieben
   * hat — „POST promote … GET KO confidentiality null" — und der Test liest jetzt dort nach, wo
   * Codex nachgesehen hat: im Bestand.
   */
  gespeichert: { confidentiality?: string | null } | null;
}

/** Entwurf anlegen, einreichen, Bestand zaehlen. Wirft `toKoInput`, entsteht KEIN Objekt. */
async function rundlauf(payload: DraftPayload): Promise<Rundlauf> {
  const capture = new CaptureService({ repo: new InMemoryDraftRepo() });
  const kos = new KoService({ repo: new InMemoryKoRepo() });
  const draft = await capture.createDraft(payload, "anna");
  try {
    const input = await capture.toKoInput(draft.id);
    const erzeugt = await kos.create(input);
    const liste = await kos.list();
    return {
      fehler: null,
      bestand: liste.length,
      input: input as unknown as Record<string, unknown>,
      // Ueber `get`, nicht ueber den Rueckgabewert von `create`: gemessen wird, was WIRKLICH im
      // Bestand liegt, nicht was die Anlage zurueckgereicht hat.
      gespeichert: (await kos.get(erzeugt.id)) ?? null,
    };
  } catch (e) {
    return {
      fehler: e as { code?: string },
      bestand: (await kos.list()).length,
      input: null,
      gespeichert: null,
    };
  }
}

describe("JOB 3082 · das Promote verlangt die Vertraulichkeitsstufe", () => {
  it("F8 — OHNE Stufe: INCOMPLETE, und im Bestand steht nichts", async () => {
    const { fehler, bestand } = await rundlauf(RUMPF);

    expect(
      fehler?.code,
      "ein Entwurf, bei dem niemand die Vertraulichkeit gewaehlt hat, wird zum Wissensobjekt",
    ).toBe("INCOMPLETE");
    expect(bestand, "es ist trotz Abbruch ein Wissensobjekt entstanden").toBe(0);
  });

  it("F9 — MIT ausdruecklichem „intern“: das Objekt entsteht und traegt die Stufe", async () => {
    const { fehler, bestand, input, gespeichert } = await rundlauf({
      ...RUMPF,
      confidentiality: "intern",
    });

    expect(fehler, `die ausdrueckliche Wahl wurde abgewiesen: ${fehler?.code ?? ""}`).toBeNull();
    expect(bestand).toBe(1);
    expect(input?.confidentiality, "die gewaehlte Stufe erreicht die KO-Eingabe nicht").toBe(
      "intern",
    );
    // NACHZUG (s. `Rundlauf.gespeichert`): und sie ueberlebt den Speicherweg. Das ist der Satz aus
    // R-1560 in sein Gegenteil verkehrt — dort stand „GET KO confidentiality null".
    expect(
      gespeichert?.confidentiality ?? null,
      "die gewaehlte Stufe steht nicht am gespeicherten Wissensobjekt",
    ).toBe("intern");
  });

  it("F9b — MIT „vertraulich“: unveraendert durchgereicht (Regression)", async () => {
    const { fehler, input, gespeichert } = await rundlauf({
      ...RUMPF,
      confidentiality: "vertraulich",
    });
    expect(fehler).toBeNull();
    expect(input?.confidentiality).toBe("vertraulich");
    expect(gespeichert?.confidentiality ?? null).toBe("vertraulich");
  });

  it("F10 — unvollstaendig an einem ANDEREN Pflichtfeld: weiterhin INCOMPLETE", async () => {
    // Regression auf die bestehende Vollstaendigkeitspruefung: die neue Bedingung tritt NEBEN die
    // vier alten und ersetzt keine davon.
    const { category: _weg, ...ohneKategorie } = RUMPF;
    const { fehler, bestand } = await rundlauf({
      ...ohneKategorie,
      confidentiality: "intern",
    });

    expect(fehler?.code).toBe("INCOMPLETE");
    expect(bestand).toBe(0);
  });

  it("F10b — eine UNGUELTIGE Stufe zaehlt nicht als Wahl", async () => {
    // Ein beliebiger String im Feld ist keine Einstufung. Wuerde er durchgelassen, waere die
    // Pflicht mit einem Tippfehler zu umgehen — und `ko.create` wiese ihn ohnehin ab
    // (INVALID_CONFIDENTIALITY), nur eben mit einer Meldung, die vom falschen Ding spricht.
    const { fehler, bestand } = await rundlauf({
      ...RUMPF,
      // `exactOptionalPropertyTypes` ist an: der Typ des Feldes schliesst `undefined` aus, deshalb
      // die Behauptung ueber NonNullable — hier wird bewusst ein Wert eingesetzt, den der Vertrag
      // nicht kennt (genau das, was ein fremder Client schicken koennte).
      confidentiality: "geheimniskraemerei" as unknown as NonNullable<
        DraftPayload["confidentiality"]
      >,
    });

    expect(fehler?.code).toBe("INCOMPLETE");
    expect(bestand).toBe(0);
  });
});
