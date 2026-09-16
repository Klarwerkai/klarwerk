// ================================================================================================
// JOB 4154 · F4 — EINE ÄNDERUNG WÄHREND DER ENTSCHEIDUNG SETZT KEINE FREIGABE AUF DEN FALSCHEN STAND.
// ================================================================================================
//
// Startvertrag, vierter entscheidender Fall und Abschnitt „Entscheidung", wörtlich:
//   „Server bestaetigt nur genau den vorgelegten unveraenderten Pruefstand. Aenderungen waehrend
//    Review/Entscheidung fuehren zu nachvollziehbarer Ablehnung mit neuem Stand."
//
// Der Ablauf, der hier scheitern MUSS: Jemand legt vor. Während die Entscheiderin liest, ändert
// jemand die Reihenfolge. Die Entscheiderin klickt „annehmen" — mit der Version, die sie gelesen
// hat. Würde der Server das annehmen, wäre eine Anweisung freigegeben, die niemand so gesehen hat.
//
// NACHVOLLZIEHBAR heisst: die Ablehnung nennt den NEUEN Stand. Ohne ihn probiert die Entscheiderin
// blind weiter; mit ihm kann sie neu lesen und entscheiden.
//
// GEGENPROBE: In `entscheiden` (`gesamtanweisung-service.ts`) den Aufruf `pruefeVersion` entfernen.
// Dann geht die Entscheidung auf der veralteten Version durch, und die ersten beiden Fälle unten
// werden rot.
import { describe, expect, it } from "vitest";
import type { AnweisungFehler } from "../../services/knowledge-object/src/gesamtanweisung-types";
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

const WER = sichtbarAls({ id: "anna", darfPruefen: true });

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Schritt A", version: 1 }, [{ version: 1 }]),
  eintrag({ id: "ko-b", title: "Schritt B", version: 1 }, [{ version: 1 }]),
];

async function vorgelegteAnweisung() {
  const { dienst, repo } = bauDienst(EINTRAEGE);
  const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
  const b1 = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-a", koVersion: 1, nachweisHash: "ha" },
    WER,
  );
  const b2 = await dienst.bausteinAufnehmen(
    a.id,
    b1.version,
    { koId: "ko-b", koVersion: 1, nachweisHash: "hb" },
    WER,
  );
  const vorgelegt = await dienst.vorlegen(a.id, b2.version, WER);
  return { dienst, repo, vorgelegt };
}

describe("F4 · Änderung zwischen Vorlegen und Entscheiden", () => {
  it("das Vorlegen selbst funktioniert — sonst prüfte alles darunter nichts", async () => {
    const { vorgelegt } = await vorgelegteAnweisung();
    expect(vorgelegt.stand).toBe("vorgelegt");
  });

  it("die Entscheidung auf dem VERALTETEN Stand wird abgelehnt und nennt den neuen", async () => {
    const { dienst, vorgelegt } = await vorgelegteAnweisung();
    const geleseneVersion = vorgelegt.version;

    // Jemand anders ordnet um, während die Entscheiderin liest.
    const dazwischen = await dienst.reihenfolgeSetzen(
      vorgelegt.id,
      vorgelegt.version,
      vorgelegt.bausteine.map((b) => b.id).reverse(),
      WER,
    );
    expect(dazwischen.version).toBe(geleseneVersion + 1);

    const fehler = await dienst
      .entscheiden(vorgelegt.id, geleseneVersion, "angenommen", WER)
      .then(() => null)
      .catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(Error);
    expect((fehler as AnweisungFehler).code).toBe("CONFLICT");
    // DER NEUE STAND STEHT DABEI — sonst wäre die Ablehnung nicht nachvollziehbar.
    expect((fehler as AnweisungFehler).aktuell).toEqual({
      stand: "vorgelegt",
      version: geleseneVersion + 1,
    });
  });

  it("der Stand bleibt `vorgelegt` — nichts ist auf die falsche Fassung freigegeben", async () => {
    const { dienst, vorgelegt } = await vorgelegteAnweisung();
    const geleseneVersion = vorgelegt.version;
    await dienst.reihenfolgeSetzen(
      vorgelegt.id,
      vorgelegt.version,
      vorgelegt.bausteine.map((b) => b.id).reverse(),
      WER,
    );
    await dienst
      .entscheiden(vorgelegt.id, geleseneVersion, "angenommen", WER)
      .catch(() => undefined);

    const stand = await dienst.lesen(vorgelegt.id, WER);
    expect(stand.stand).toBe("vorgelegt");
    expect(stand.stand).not.toBe("entschieden");
  });

  it("der Bestand ist durch den abgelehnten Versuch NICHT zusätzlich geschrieben worden", async () => {
    const { dienst, repo, vorgelegt } = await vorgelegteAnweisung();
    const geleseneVersion = vorgelegt.version;
    await dienst.reihenfolgeSetzen(
      vorgelegt.id,
      vorgelegt.version,
      vorgelegt.bausteine.map((b) => b.id).reverse(),
      WER,
    );
    const vorher = repo.abdruck();
    const schreibvorgaenge = repo.schreibvorgaenge;

    await dienst
      .entscheiden(vorgelegt.id, geleseneVersion, "angenommen", WER)
      .catch(() => undefined);

    expect(repo.abdruck()).toBe(vorher);
    expect(repo.schreibvorgaenge).toBe(schreibvorgaenge);
  });

  it("auf dem AKTUELLEN Stand geht die Entscheidung durch — die Sperre ist keine Blockade", async () => {
    const { dienst, vorgelegt } = await vorgelegteAnweisung();
    const geaendert = await dienst.reihenfolgeSetzen(
      vorgelegt.id,
      vorgelegt.version,
      vorgelegt.bausteine.map((b) => b.id).reverse(),
      WER,
    );
    const entschieden = await dienst.entscheiden(
      vorgelegt.id,
      geaendert.version,
      "angenommen",
      WER,
    );
    expect(entschieden.stand).toBe("entschieden");
  });

  it("eine entschiedene Anweisung wird nicht mehr geändert", async () => {
    const { dienst, vorgelegt } = await vorgelegteAnweisung();
    const entschieden = await dienst.entscheiden(
      vorgelegt.id,
      vorgelegt.version,
      "angenommen",
      WER,
    );
    await expect(
      dienst.kopfAendern(vorgelegt.id, entschieden.version, { titel: "Anders" }, WER),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
