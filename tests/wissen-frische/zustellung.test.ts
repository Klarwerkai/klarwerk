// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische · Nacharbeit 2 — DIE ZUSTELLUNG AN DIE PERSON.
// ================================================================================================
//
// Bens Befunde: R-0248 (Erinnerung wird berechnet, aber nicht zugestellt), R-0266 (keine
// wiederkehrende Vorlage), R-1635 (keine Benachrichtigung von Autor bzw. Nachfolger), R-1636
// (Halbwertszeit nicht aus der Historie gelernt). Gemessen mit echten Diensten im Speicher und
// EINER gestellten Uhr für Bestand, Lebenszyklus und Zustellung. Jede Zusage mit Gegenprobe.
import { describe, expect, it } from "vitest";
import { frischeMeldungen } from "../../services/app/src/frische-meldungen";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryLifecycleRepo, LifecycleService } from "../../services/lifecycle";

const TAG = 24 * 60 * 60 * 1000;
// Ein Montag, damit die Wochengrenze im Fall unten eindeutig ist.
const START = Date.parse("2026-01-05T08:00:00.000Z");
// best_practice: 365 Tage Vorgabe (services/knowledge-object/src/frische.ts).
const H = 365;

async function aufbau() {
  const uhr = { jetzt: START };
  const koRepo = new InMemoryKoRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ko = new KoService({ repo: koRepo, audit, now: () => uhr.jetzt });
  const lifecycle = new LifecycleService({
    koService: ko,
    repo: new InMemoryLifecycleRepo(),
    audit,
  });
  const meldungen = frischeMeldungen({ ko, lifecycle, audit, uhr: () => uhr.jetzt });

  async function geprueft(titel: string, autor: string, kategorie = "Anlage 7"): Promise<string> {
    const angelegt = await ko.create({
      title: titel,
      statement: `${titel} — eine eigene Aussage.`,
      type: "best_practice",
      category: kategorie,
      author: autor,
    });
    const gespeichert = await koRepo.findById(angelegt.id);
    if (!gespeichert) {
      throw new Error("Aufbau: das angelegte Objekt fehlt in der Ablage.");
    }
    // Der Prüfweg selbst ist nicht Gegenstand dieses Falls.
    await koRepo.update({ ...gespeichert, status: "validiert", trust: 90 });
    return angelegt.id;
  }
  return { uhr, ko, lifecycle, meldungen, geprueft };
}

describe("R-0248 · die Fristerinnerung wird der verantwortlichen Person zugestellt", () => {
  it("vor dem Fenster nichts, im Fenster eine Erinnerung, nach Ablauf eine neue Mahnung", async () => {
    const { uhr, meldungen, geprueft } = await aufbau();
    const id = await geprueft("Ventil schließen", "anna");

    uhr.jetzt = START + (H - 30) * TAG;
    expect((await meldungen.meldungenFuer("anna")).filter((m) => m.art === "frist")).toEqual([]);

    uhr.jetzt = START + (H - 5) * TAG;
    const erinnerung = (await meldungen.meldungenFuer("anna")).filter((m) => m.art === "frist");
    expect(erinnerung).toHaveLength(1);
    expect(erinnerung[0]?.koId).toBe(id);
    expect(erinnerung[0]?.ueberfaellig).toBeUndefined();

    uhr.jetzt = START + (H + 5) * TAG;
    const mahnung = (await meldungen.meldungenFuer("anna")).filter((m) => m.art === "frist");
    expect(mahnung).toHaveLength(1);
    expect(mahnung[0]?.ueberfaellig).toBe(true);
    expect(mahnung[0]?.schluessel, "die Mahnung ist ein neuer, ungelesener Anlass").not.toBe(
      erinnerung[0]?.schluessel,
    );
  });

  it("GEGENPROBE: eine fremde Person bekommt keine Erinnerung", async () => {
    const { uhr, meldungen, geprueft } = await aufbau();
    await geprueft("Ventil schließen", "anna");
    uhr.jetzt = START + (H - 5) * TAG;
    expect((await meldungen.meldungenFuer("bert")).filter((m) => m.art === "frist")).toEqual([]);
  });
});

describe("R-0266 · die Vorlage der ältesten Beiträge kehrt wöchentlich wieder", () => {
  it("jede Woche ein neuer Anlass für dieselben ältesten Beiträge, ältester zuerst", async () => {
    const { uhr, meldungen, geprueft } = await aufbau();
    const alt = await geprueft("Alter Beitrag", "anna");
    uhr.jetzt = START + 20 * TAG;
    const neu = await geprueft("Neuer Beitrag", "anna");
    uhr.jetzt = START + 30 * TAG;

    const woche1 = (await meldungen.meldungenFuer("anna")).filter((m) => m.art === "vorlage");
    expect(woche1.map((m) => m.koId)).toEqual([alt, neu]);

    uhr.jetzt += 7 * TAG;
    const woche2 = (await meldungen.meldungenFuer("anna")).filter((m) => m.art === "vorlage");
    expect(woche2.map((m) => m.koId)).toEqual([alt, neu]);
    expect(woche2.map((m) => m.schluessel)).not.toEqual(woche1.map((m) => m.schluessel));
    expect(woche2[0]?.at).not.toBe(woche1[0]?.at);
  });

  it("GEGENPROBE: wer keine geprüften Beiträge verantwortet, bekommt keine Vorlage", async () => {
    const { meldungen, geprueft } = await aufbau();
    await geprueft("Alter Beitrag", "anna");
    expect((await meldungen.meldungenFuer("bert")).filter((m) => m.art === "vorlage")).toEqual([]);
  });
});

describe("R-1635 · Autor bzw. Nachfolger erfährt von der Anlagenänderung", () => {
  it("der Autor wird benachrichtigt, nicht der Meldende; nach Bestätigung ist es erledigt", async () => {
    const { lifecycle, meldungen, geprueft } = await aufbau();
    const id = await geprueft("Druck prüfen", "anna");
    await lifecycle.couple("anlage-7", id);
    await lifecycle.assetChanged("anlage-7", "carla");

    const fuerAnna = (await meldungen.meldungenFuer("anna")).filter((m) => m.art === "anlage");
    expect(fuerAnna.map((m) => m.koId)).toEqual([id]);
    expect((await meldungen.meldungenFuer("carla")).filter((m) => m.art === "anlage")).toEqual([]);

    await lifecycle.confirmStillValid(id, "anna");
    expect((await meldungen.meldungenFuer("anna")).filter((m) => m.art === "anlage")).toEqual([]);
  });

  it("nach einer Übergabe erfährt es der Nachfolger — und der Nachbarauslöser meldet ebenso", async () => {
    const { ko, lifecycle, meldungen, geprueft } = await aufbau();
    const a = await geprueft("Druck prüfen", "anna");
    const b = await geprueft("Pumpe entlüften", "anna");
    await lifecycle.couple("anlage-7", a);
    await lifecycle.couple("anlage-7", b);
    await ko.setAuthor(b, "bert", "admin");

    await lifecycle.neighborsChanged(a, "carla");
    const anna = (await meldungen.meldungenFuer("anna")).filter((m) => m.art === "anlage");
    const bert = (await meldungen.meldungenFuer("bert")).filter((m) => m.art === "anlage");
    expect(anna.map((m) => m.koId)).toEqual([a]);
    expect(
      bert.map((m) => m.koId),
      "der Nachfolger, nicht der Originalautor",
    ).toEqual([b]);
  });
});

describe("R-1636 · der Dienst lernt die Halbwertszeit aus der Fassungsfolge", () => {
  it("drei Bestätigungsabstände einer Kategorie ergeben ihre Halbwertszeit", async () => {
    const { uhr, ko } = await aufbau();
    const angelegt = await ko.create({
      title: "Hydraulikdruck",
      statement: "Der Druck liegt bei 180 bar.",
      type: "technik",
      category: "Hydraulik",
      author: "anna",
    });
    for (const druck of [181, 182, 183]) {
      uhr.jetzt += 40 * TAG;
      await ko.revise(angelegt.id, { statement: `Der Druck liegt bei ${druck} bar.` }, "anna");
    }
    const tabelle = await ko.gelernteHalbwertszeiten();
    expect(tabelle.get("hydraulik")).toEqual({ tage: 40, beobachtungen: 3 });
    // GEGENPROBE: eine Kategorie ohne Historie bleibt ungelernt (Vorgabe der Wissensart).
    expect(tabelle.has("anlage 7")).toBe(false);
  });
});
