// ================================================================================================
// JOB 4154 · F5 — EINE GESAMTFREIGABE ENTSTEHT NIE AUS GRÜNEN BAUSTEINMARKIERUNGEN.
// ================================================================================================
//
// Startvertrag, fünfter entscheidender Fall:
//   „Gesamtfreigabe entsteht nicht aus gruenen Bausteinmarkierungen."
// Und im Abschnitt „Entscheidung":
//   „Die Entscheidung ueber die Gesamtfassung ist getrennt von Freigaben einzelner Bausteine."
//
// Die Versuchung ist gross und die Rechnung falsch: Alle fünf eingebundenen Einträge sind
// `validiert` — also ist die Anweisung doch geprüft? Nein. Geprüft sind fünf Einzelteile. Ob sie in
// DIESER Reihenfolge, mit DIESEN Voraussetzungen, in DIESEM Geltungsbereich zusammen richtig sind,
// hat damit niemand beurteilt. Genau das ist die Entscheidung über die Gesamtfassung.
//
// GEGENPROBE: In `lesestand` (`gesamtanweisung-service.ts`) den Stand ableiten, etwa
// `stand: bausteine.every(b => b.herkunft?.status === "validiert") ? "entschieden" : anweisung.stand`.
// Dann werden die ersten beiden Fälle unten rot.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

const WER = sichtbarAls({ id: "anna", darfPruefen: true });

/** Fünf Einträge, jeder für sich freigegeben — „alles grün". */
const ALLES_GRUEN = ["ko-1", "ko-2", "ko-3", "ko-4", "ko-5"].map((id) =>
  eintrag({ id, title: `Freigegebener Schritt ${id}`, status: "validiert", version: 1 }, [
    { version: 1, status: "validiert" },
  ]),
);

async function anweisungAusLauterGruenen() {
  const { dienst, repo } = bauDienst(ALLES_GRUEN);
  let anweisung = await dienst.anlegen({ titel: "Inbetriebnahme" }, "anna");
  for (const e of ALLES_GRUEN) {
    anweisung = await dienst.bausteinAufnehmen(
      anweisung.id,
      anweisung.version,
      { koId: e.id, koVersion: 1, nachweisHash: `h-${e.id}` },
      WER,
    );
  }
  return { dienst, repo, anweisung };
}

describe("F5 · keine Gesamtfreigabe aus Bausteinmarkierungen", () => {
  it("alle fünf Bausteine sind wirklich `validiert` — sonst prüfte der Fall nichts", async () => {
    const { dienst, anweisung } = await anweisungAusLauterGruenen();
    const stand = await dienst.lesen(anweisung.id, WER);
    expect(stand.bausteine).toHaveLength(5);
    expect(stand.bausteine.every((b) => b.herkunft?.status === "validiert")).toBe(true);
  });

  it("die Anweisung bleibt trotzdem `entwurf`", async () => {
    const { dienst, anweisung } = await anweisungAusLauterGruenen();
    const stand = await dienst.lesen(anweisung.id, WER);
    expect(stand.stand).toBe("entwurf");
    expect(stand.stand).not.toBe("entschieden");
  });

  it("die Antwort enthält kein Wort, das eine Prüfung oder Freigabe behauptet", async () => {
    const { dienst, anweisung } = await anweisungAusLauterGruenen();
    const draht = JSON.stringify(await dienst.lesen(anweisung.id, WER));
    // `validiert` steht in der Herkunft je Baustein und gehört dorthin — das ist eine Tatsache über
    // den EINTRAG. Verboten ist eine Aussage über die ANWEISUNG. Deshalb wird der Gesamtstand
    // geprüft und zusätzlich das Fehlen der Freigabevokabeln auf der Gesamtebene.
    expect(draht).not.toContain("freigegeben");
    expect(draht).not.toContain("vollständig geprüft");
    expect(draht).not.toContain("geprueft");
  });

  it("der Lückenvermerk zur Prüfanbindung steht ausdrücklich in der Antwort", async () => {
    // Startvertrag: „Aktuelle Luecken der Pruefanbindung deutlich nennen."
    const { dienst, anweisung } = await anweisungAusLauterGruenen();
    const stand = await dienst.lesen(anweisung.id, WER);
    expect(stand.pruefanbindung).toBe("nicht_angebunden");
  });

  it("der Dienst kennt das Wort `validiert` überhaupt nicht", async () => {
    // Der strukturelle Nachweis zum Verhaltensnachweis darüber: es gibt im Regelwerk keine Zeile,
    // die einen Eintragsstatus liest, um daraus etwas über die Anweisung zu schliessen. Damit kann
    // die Ableitung auch nicht in einem Sonderfall wieder auftauchen.
    const quelle = readFileSync("services/knowledge-object/src/gesamtanweisung-service.ts", "utf8");
    // Der Status reist durch (`status: satz.snapshot.status`), aber kein Wert wird verglichen.
    expect(quelle).not.toMatch(/===\s*"validiert"/);
    expect(quelle).not.toMatch(/status\s*===/);
  });

  it("nur die menschliche Entscheidung ändert den Stand — und sie braucht das Vorlegen", async () => {
    const { dienst, anweisung } = await anweisungAusLauterGruenen();
    // Ohne Vorlegen gibt es nichts zu entscheiden, egal wie grün die Bausteine sind.
    await expect(
      dienst.entscheiden(anweisung.id, anweisung.version, "angenommen", WER),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const vorgelegt = await dienst.vorlegen(anweisung.id, anweisung.version, WER);
    const entschieden = await dienst.entscheiden(
      anweisung.id,
      vorgelegt.version,
      "angenommen",
      WER,
    );
    expect(entschieden.stand).toBe("entschieden");
  });
});
