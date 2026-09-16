// ================================================================================================
// JOB 4151 · TEST 7 (BEN R3) — DER WIEDERHOLSCHLÜSSEL BINDET AUCH DANN, WENN ZWEI GLEICHZEITIG DA SIND.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND, nicht der vermutete. BEN hat in Runde 3 zwei Gegenbeispiele gegen
// den echten Schreibdienst gefahren (`ben.md` R3, „EIGENE MESSUNG": `Tests 2 failed (2)`, jeweils
// `expected 2 to be 1`):
//
//   · zwei parallele IDENTISCHE Beiträge ergaben `angelegt / Version 1` UND
//     `fortgeschrieben / Version 2` — eine Zusage, die genau dann brach, wenn sie gebraucht wird;
//   · zwei VERSCHIEDENE Beziehungen mit DEMSELBEN Schlüssel wurden BEIDE gespeichert.
//
// Beide Anfragen lasen zuerst „Schlüssel fehlt"; danach schrieb die erste, anschliessend die
// zweite. Die Prüfung im Schreibdienst schützte diesen Ablauf nicht, weil sie VOR dem Schreiben
// stand und nicht MIT ihm.
//
// ------------------------------------------------------------------------------------------------
// WARUM `Promise.all` ALLEIN KEIN NACHWEIS IST — und was dieser Test stattdessen tut.
// ------------------------------------------------------------------------------------------------
// BENs Promptverbesserung, wörtlich: „Erzwinge im Test: Beide Anfragen lesen einen fehlenden
// Wiederholschlüssel; erst danach schreibt Anfrage A vollständig, anschliessend Anfrage B. … Ein
// zufällig grünes `Promise.all` genügt nicht als Parallelitätsnachweis."
//
// Genau das macht `mitTorwaerter`: ein Bestand-Doppelgänger, der den Nachschlag des
// Wiederholschlüssels ANHÄLT, bis BEIDE Anfragen dort angekommen sind. Erst dann laufen beide
// weiter. Die Verschränkung ist damit nicht dem Zufall überlassen, sondern hergestellt — der Test
// ist deterministisch und wäre gegen den Stand von R3 in jedem Lauf rot.
//
// WAS ER NICHT VORTÄUSCHT: Der Torwärter verstellt NICHTS am Verhalten des Bestands. Er reicht
// jeden Aufruf unverändert durch und hält nur EINEN davon an — er erfindet keine Antwort und
// überschreibt keine. Wer ihn entfernt, misst denselben Fall ohne die Verschränkung.
//
// DIE POSTGRES-HÄLFTE DIESES FALLSATZES steht in `bestand-postgres.integration.test.ts` (P5–P9):
// dort laufen dieselben drei Fragen gegen echte, wirklich nebeneinander laufende Verbindungen.
// Hier läuft der Speicherbestand, der im Tor ohne Datenbank fährt.
import { describe, expect, it } from "vitest";
import {
  DeduplizierenderKantenBestand,
  type KanteSetzenEingabe,
  type KantenKoLeser,
  KantenSchreibService,
  type KnowledgeObject,
} from "../../services/knowledge-object";
import { mitTorwaerter } from "./torwaerter";

/** Zwei Objekte mit genau den Feldern, die der Schreibdienst wirklich liest. */
const KOS = [
  { id: "ko-links", version: 1, history: [] },
  { id: "ko-rechts", version: 1, history: [] },
  { id: "ko-drittes", version: 1, history: [] },
] as unknown as readonly KnowledgeObject[];

const LESER: KantenKoLeser = { get: async (id) => KOS.find((k) => k.id === id) };

const SICHTBAR = { sichtbar: () => true };

function eingabe(over: Partial<KanteSetzenEingabe> & { id: string }): KanteSetzenEingabe {
  return {
    quelleId: "ko-links",
    zielId: "ko-rechts",
    art: "ergaenzt",
    richtung: "ungerichtet",
    urheber: "controllerin-1",
    jetzt: "2026-09-16T08:00:00.000Z",
    beitragSchluessel: "s-eins",
    gesehen: { quelleVersion: 1, zielVersion: 1 },
    ...over,
  };
}

describe("JOB 4151 · Schlüsselbindung unter Parallelität (Speicherbestand)", () => {
  it("S1: zwei IDENTISCHE Beiträge gleichzeitig — GENAU EINE Änderung, Version bleibt 1", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    const dienst = new KantenSchreibService({ repo: mitTorwaerter(bestand, 2), kos: LESER });

    const [a, b] = await Promise.all([
      dienst.setze(eingabe({ id: "k-s1-a" }), SICHTBAR),
      dienst.setze(eingabe({ id: "k-s1-b" }), SICHTBAR),
    ]);

    // Der Bestand hat sich GENAU EINMAL bewegt. Das ist die Aussage, nicht der Statuscode:
    // gegen den Stand von R3 stand hier Version 2 (BEN: `expected 2 to be 1`).
    expect(await bestand.anzahl()).toBe(1);
    const [gespeichert] = await bestand.fuerKo("ko-links");
    expect(gespeichert?.version).toBe(1);
    expect(a.kante.id).toBe(b.kante.id);
    expect([a.ergebnis, b.ergebnis].sort()).toEqual(["angelegt", "wiederholt"]);
  });

  it("S2: derselbe Schlüssel, ANDERE Beziehung, gleichzeitig — eine Speicherung, die andere abgewiesen", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    const dienst = new KantenSchreibService({ repo: mitTorwaerter(bestand, 2), kos: LESER });

    const ergebnisse = await Promise.allSettled([
      dienst.setze(eingabe({ id: "k-s2-a", beitragSchluessel: "s-geteilt" }), SICHTBAR),
      dienst.setze(
        eingabe({ id: "k-s2-b", zielId: "ko-drittes", beitragSchluessel: "s-geteilt" }),
        SICHTBAR,
      ),
    ]);

    // GENAU EINE Beziehung im Bestand — vorher waren es zwei (BEN R3, Substanzurteil 1).
    expect(await bestand.anzahl()).toBe(1);
    const abgewiesen = ergebnisse.filter((e) => e.status === "rejected");
    expect(abgewiesen).toHaveLength(1);
    expect((abgewiesen[0] as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });
    // Und die Abweisung sagt NICHTS über die fremde Beziehung — kein Titel, keine Kennung, keine Zahl.
    const meldung = String((abgewiesen[0] as PromiseRejectedResult).reason.message);
    expect(meldung).not.toMatch(/ko-links|ko-rechts|ko-drittes|k-s2/);
    expect(meldung).not.toMatch(/\d/);
  });

  it("S3: VERSCHIEDENE Schlüssel, dieselbe Beziehung, gleichzeitig — fortgeschrieben auf Version 2", async () => {
    // Die Gegenrichtung zu S1 und S2, und ohne sie wären beide auch mit einem Bestand grün, der
    // beim zweiten Schreiber grundsätzlich nichts tut — dann könnte ein Zweiter eine Beziehung nie
    // mitbeurteilen, und die Dedup-Zusage wäre eine Sperre.
    const bestand = new DeduplizierenderKantenBestand();
    const dienst = new KantenSchreibService({ repo: mitTorwaerter(bestand, 2), kos: LESER });

    const ergebnisse = await Promise.all([
      dienst.setze(eingabe({ id: "k-s3-a", beitragSchluessel: "s-eins" }), SICHTBAR),
      dienst.setze(eingabe({ id: "k-s3-b", beitragSchluessel: "s-zwei" }), SICHTBAR),
    ]);

    expect(await bestand.anzahl()).toBe(1);
    expect(ergebnisse.map((e) => e.ergebnis).sort()).toEqual(["angelegt", "fortgeschrieben"]);
    const [gespeichert] = await bestand.fuerKo("ko-links");
    expect(gespeichert?.version).toBe(2);
    // Beide Schlüssel führen weiterhin zu DERSELBEN Beziehung — kein Beitrag verliert seine Zusage.
    expect((await bestand.holeNachBeitrag("s-eins"))?.id).toBe(gespeichert?.id);
    expect((await bestand.holeNachBeitrag("s-zwei"))?.id).toBe(gespeichert?.id);
  });

  it("S4: der Schlüssel bleibt gebunden, auch NACHDEM die Beziehung widerrufen wurde", async () => {
    // Die Bindung ist keine Frage des Status: ein widerrufener Beitrag ist gesendet worden, und
    // sein Schlüssel darf nicht für eine andere Beziehung frei werden. Sonst liesse sich die
    // Abweisung aus S2 umgehen, indem man vorher widerruft.
    const bestand = new DeduplizierenderKantenBestand();
    const dienst = new KantenSchreibService({ repo: bestand, kos: LESER });

    const { kante } = await dienst.setze(
      eingabe({ id: "k-s4", beitragSchluessel: "s-gebunden" }),
      SICHTBAR,
    );
    await dienst.widerrufe(
      kante.id,
      { urheber: "admin-1", jetzt: "2026-09-16T09:00:00.000Z", erwarteteVersion: 1 },
      SICHTBAR,
    );

    await expect(
      dienst.setze(
        eingabe({ id: "k-s4-fremd", zielId: "ko-drittes", beitragSchluessel: "s-gebunden" }),
        SICHTBAR,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await bestand.anzahl()).toBe(1);
  });
});
