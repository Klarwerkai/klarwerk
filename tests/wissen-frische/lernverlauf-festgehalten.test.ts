// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische · Nacharbeit 5 — DER LERNSTAND IST FESTGEHALTEN.
// ================================================================================================
//
// Bens Befund (R-0248): der vergangene Lernstand wurde aus dem HEUTIGEN Bestand rekonstruiert.
// Legte jemand das lernende Objekt in den Papierkorb, fiel ein seit 60 Tagen unverändertes,
// längst abgelaufenes Objekt auf die 365-Tage-Vorgabe zurück und galt wieder als gesichert.
//
// Gemessen mit echten Diensten im Speicher und EINER gestellten Uhr: das abgelaufene Objekt bleibt
// nach Papierkorb, endgültigem Löschen und Umkategorisieren des lernenden Objekts abgelaufen — in
// der Auskunft UND im Antwortpfad. Die Gegenprobe zeigt, dass genau die festgehaltene Ablage den
// Unterschied macht: aus dem heutigen Bestand rekonstruiert, wäre es wieder gesichert.
import { describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService, haltbarkeitAbgelaufen } from "../../services/knowledge-object";
import {
  beobachtungenAus,
  halbwertszeitenAusVerlauf,
} from "../../services/knowledge-object/src/frische";
import { InMemoryHalbwertszeitVerlauf } from "../../services/knowledge-object/src/halbwertszeit-verlauf";
import { Reasoner } from "../../services/reasoner";

const TAG = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-01-05T08:00:00.000Z");
const FRAGE = "Was tun bei Überdruck am Ventil?";

async function aufbau() {
  const uhr = { jetzt: START };
  const koRepo = new InMemoryKoRepo();
  const verlauf = new InMemoryHalbwertszeitVerlauf();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ko = new KoService({
    repo: koRepo,
    audit,
    now: () => uhr.jetzt,
    halbwertszeitVerlauf: verlauf,
  });
  await ko.activateSearchProjectionV2();
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService: ko,
    gaps: new InMemoryGapRepo(),
    audit,
    now: () => uhr.jetzt,
    halbwertszeiten: () => ko.gelernteHalbwertszeiten(),
  });

  // Das lernende Objekt: drei Fassungsabstände von 40 Tagen in der Kategorie „Anlage 7".
  const lernend = await ko.create({
    title: "Hydraulikdruck der Presse",
    statement: "Der Hydraulikdruck liegt bei 180 bar.",
    type: "technik",
    category: "Anlage 7",
    author: "bert",
  });
  for (const druck of [181, 182, 183]) {
    uhr.jetzt += 40 * TAG;
    const statement = `Der Hydraulikdruck liegt bei ${druck} bar.`;
    await ko.revise(lernend.id, { statement }, "bert");
  }
  // START+125: das Lernen hält die drei Beobachtungen fest (40 Tage).
  uhr.jetzt = START + 125 * TAG;
  expect((await ko.gelernteHalbwertszeiten()).get("anlage 7")).toEqual({
    tage: 40,
    beobachtungen: 3,
  });

  // START+130: der Stand des geprüften Zielobjekts beginnt — mit dem Lernstand 40 Tage.
  uhr.jetzt = START + 130 * TAG;
  const ziel = await ko.create({
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 7",
    author: "anna",
  });
  const gespeichert = await koRepo.findById(ziel.id);
  if (!gespeichert) {
    throw new Error("Aufbau: das Zielobjekt fehlt in der Ablage.");
  }
  await koRepo.update({ ...gespeichert, status: "validiert", trust: 90 });

  // START+190: 60 Tage unverändert — nach 40 Tagen abgelaufen.
  uhr.jetzt = START + 190 * TAG;
  return { uhr, ko, koRepo, ask, lernendId: lernend.id, zielId: ziel.id };
}

type Aufbau = Awaited<ReturnType<typeof aufbau>>;

async function abgelaufen({ ko, uhr, zielId }: Aufbau): Promise<boolean> {
  const ziel = await ko.get(zielId);
  if (!ziel) {
    throw new Error("Zielobjekt fehlt.");
  }
  return haltbarkeitAbgelaufen(ziel, uhr.jetzt, await ko.gelernteHalbwertszeiten());
}

async function antwortKlasse({ ask, zielId }: Aufbau): Promise<string> {
  const { result } = await ask.ask(FRAGE);
  expect(result.answered).toBe(true);
  expect(result.citedSources).toContain(zielId);
  return result.knowledgeClass;
}

describe("Nacharbeit 5 · Löschen oder Umkategorisieren eines anderen Objekts verlängert keine Frist", () => {
  it("VORBEDINGUNG: das Zielobjekt ist abgelaufen und gilt in Antworten nicht als gesichert", async () => {
    const w = await aufbau();
    expect(await abgelaufen(w)).toBe(true);
    expect(await antwortKlasse(w)).toBe("ungeprueft");
  });

  it("Papierkorb: das lernende Objekt wird gelöscht — das Ziel bleibt abgelaufen", async () => {
    const w = await aufbau();
    await w.ko.delete(w.lernendId, "admin");
    w.uhr.jetzt += TAG; // der Zwischenspeicher des Lernstands ist abgelaufen
    expect((await w.koRepo.findById(w.lernendId))?.deletedAt).toBeTruthy();
    expect(await abgelaufen(w)).toBe(true);
    expect(await antwortKlasse(w)).toBe("ungeprueft");
  });

  it("endgültiges Löschen: auch dann bleibt das Ziel abgelaufen", async () => {
    const w = await aufbau();
    await w.ko.delete(w.lernendId, "admin", { hard: true });
    w.uhr.jetzt += TAG;
    expect(await w.koRepo.findById(w.lernendId)).toBeUndefined();
    expect(await abgelaufen(w)).toBe(true);
    expect(await antwortKlasse(w)).toBe("ungeprueft");
  });

  it("Umkategorisieren: das lernende Objekt wandert in eine andere Kategorie — das Ziel bleibt abgelaufen", async () => {
    const w = await aufbau();
    await w.ko.updateCategory(w.lernendId, "Anderswo", "admin");
    w.uhr.jetzt += TAG;
    expect(await abgelaufen(w)).toBe(true);
    expect(await antwortKlasse(w)).toBe("ungeprueft");
  });

  it("GEGENPROBE: aus dem heutigen Bestand rekonstruiert, wäre das Ziel nach dem Löschen wieder gesichert", async () => {
    const w = await aufbau();
    await w.ko.delete(w.lernendId, "admin");
    const heute = await w.koRepo.list({});
    const rekonstruiert = halbwertszeitenAusVerlauf(
      beobachtungenAus(heute).map((b) => ({ ...b, erfasst: b.ende })),
    );
    const ziel = await w.ko.get(w.zielId);
    if (!ziel) {
      throw new Error("Zielobjekt fehlt.");
    }
    // Ohne festgehaltenen Verlauf: Vorgabe 365 Tage → nicht abgelaufen. Genau Bens Befund.
    expect(haltbarkeitAbgelaufen(ziel, w.uhr.jetzt, rekonstruiert)).toBe(false);
    // Mit festgehaltenem Verlauf: abgelaufen.
    expect(await abgelaufen(w)).toBe(true);
  });

  it("Nacharbeit 7 · das abgelaufene Ziel SELBST wird umkategorisiert — es bleibt abgelaufen", async () => {
    const w = await aufbau();
    // „Ohne Lernstand" hat keine Beobachtungen — dort gälte die 365-Tage-Vorgabe.
    await w.ko.updateCategory(w.zielId, "Ohne Lernstand", "admin");
    w.uhr.jetzt += TAG;
    const ziel = await w.ko.get(w.zielId);
    expect(ziel?.category).toBe("Ohne Lernstand");
    expect(ziel?.fristGrundlage?.kategorie).toBe("Anlage 7");
    expect(await abgelaufen(w)).toBe(true);
    expect(await antwortKlasse(w)).toBe("ungeprueft");

    // Ein zweiter Wechsel im selben Stand ändert die festgehaltene Grundlage nicht.
    await w.ko.updateCategory(w.zielId, "Noch woanders", "admin");
    expect((await w.ko.get(w.zielId))?.fristGrundlage?.kategorie).toBe("Anlage 7");
    expect(await abgelaufen(w)).toBe(true);

    // Erst die Bestätigung des Verantwortlichen beginnt einen neuen Stand — mit der neuen Kategorie.
    await w.ko.bestaetigeFrische(w.zielId, "anna");
    expect(await abgelaufen(w)).toBe(false);
    expect(await antwortKlasse(w)).toBe("gesichert");
  });

  it("die Wiederfreigabe hängt an der Bestätigung des Verantwortlichen", async () => {
    const w = await aufbau();
    await w.ko.delete(w.lernendId, "admin");
    w.uhr.jetzt += TAG;
    await w.ko.bestaetigeFrische(w.zielId, "anna");
    expect(await abgelaufen(w)).toBe(false);
    expect(await antwortKlasse(w)).toBe("gesichert");
  });
});
