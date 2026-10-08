// AUFNAHME 20260922 · gesamt-pruefung-hintergrund — R-1125 / N-0073 / R-1111.
//
// Echter Prüf-Worker, echter Runner, echter Wissensobjekt-Dienst; nur der Modellanbieter ist eine
// steuerbare Attrappe (Ausfall an/aus, Ausfall einzelner Vergleiche). Gemessen wird der Prüfvermerk
// am Objekt und der Protokolleintrag — dort, wo Oberfläche und Prüfer ihn lesen.
import { describe, expect, it } from "vitest";
import { createAiCheckRunner, createAiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildServices } from "../../services/app/src/build-app";
import {
  HINTERGRUNDLAUF_AUDIT,
  createHintergrundpruefung,
  hintergrundArt,
} from "../../services/app/src/hintergrundpruefung";
import type { KnowledgeObject } from "../../services/knowledge-object";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { GOOD_CONFLICT, GOOD_DUPLICATE } from "../review26-teilpruefung-ursache/fixture";

const TAG_MS = 24 * 60 * 60_000;

async function buehne(budget: { tagesbudget?: number; laufbudget?: number } = {}) {
  const services = buildServices();
  const modell = {
    aufrufe: 0,
    // Liefert `fehler` für einen Aufruf einen Fehler, scheitert genau dieser Vergleich — am Inhalt
    // festgemacht, damit eine Wiederholung im Anbieter denselben Vergleich wieder trifft.
    fehler: (_system: string, _user: string): Error | undefined => undefined,
  };
  const client: ModelClient = {
    name: "test-provider",
    rejectsConfidential: true,
    async complete(system, user) {
      modell.aufrufe += 1;
      const fehler = modell.fehler(system, user);
      if (fehler) {
        throw fehler;
      }
      return system.includes('"relation"') ? GOOD_CONFLICT : GOOD_DUPLICATE;
    },
  };
  services.reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(services.reasoner);
  const worker = createAiCheckWorker({
    ko: services.ko,
    run: createAiCheckRunner(services),
    log: () => undefined,
  });
  const uhr = { jetzt: Date.now() };
  const lauf = createHintergrundpruefung({
    ko: services.ko,
    worker,
    modellAktiv: () => services.reasoner.status().active,
    audit: services.audit,
    now: () => uhr.jetzt,
    ...budget,
  });
  const lege = (titel: string, aussage: string) =>
    services.ko.create({
      title: titel,
      statement: aussage,
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
  // Derselbe Weg wie beim Einreichen (ko-routes): Vermerk setzen, einreihen — der Aufrufer wartet nicht.
  const reicheEin = async (titel: string, aussage: string): Promise<string> => {
    const ko = await lege(titel, aussage);
    await services.ko.markAiCheckPending(ko.id);
    worker.enqueue(ko.id, (await services.ko.get(ko.id))?.aiCheck?.koVersion);
    await worker.idle();
    return ko.id;
  };
  const vermerk = async (id: string) => (await services.ko.get(id))?.aiCheck;
  const protokoll = () => services.audit.list({ action: HINTERGRUNDLAUF_AUDIT });
  return { services, modell, uhr, lauf, lege, reicheEin, vermerk, protokoll };
}

const AUSFALL = () => new Error("ECONNREFUSED");

describe("R-1125 · Ausfall beim Einreichen wird nachgeholt, sobald das Modell erreichbar ist", () => {
  it("failed/unreachable → Lauf bei erreichbarem Modell → done, mit Protokolleintrag", async () => {
    const b = await buehne();
    await b.lege("Kandidat", "Pumpenleistung im Betrieb prüfen");
    b.modell.fehler = AUSFALL;
    const id = await b.reicheEin("Subjekt", "Das Ventil muss vor der Wartung geschlossen werden");
    expect(await b.vermerk(id)).toMatchObject({ status: "failed", fallbackReason: "unreachable" });

    b.modell.fehler = () => undefined;
    const bericht = await b.lauf();

    expect(bericht).toMatchObject({ nachgeholt: 1, fehlgeschlagen: 0, offen: 0 });
    const nachher = await b.vermerk(id);
    expect(nachher?.status).toBe("done");
    expect(nachher?.coverage).toMatchObject({ skipped: 0, aborted: false });
    const eintraege = await b.protokoll();
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]).toMatchObject({ actor: "system", target: "bestand" });
    expect(eintraege[0]?.payload).toMatchObject({ nachgeholt: 1, tagesbudget: 500 });
    // Nur Zähler im Protokoll — keine Kennung, kein Inhalt.
    expect(JSON.stringify(eintraege[0]?.payload)).not.toContain(id);
    expect(JSON.stringify(eintraege[0]?.payload)).not.toContain("Ventil");
  });

  it("Modell weiter nicht erreichbar → der Takt endet nach dem ersten Fehlschlag, Rest bleibt offen", async () => {
    const b = await buehne();
    await b.lege("Kandidat", "Pumpenleistung im Betrieb prüfen");
    b.modell.fehler = AUSFALL;
    const ids = [
      await b.reicheEin("Erstes", "Das Ventil muss vor der Wartung geschlossen werden"),
      await b.reicheEin("Zweites", "Der Filter wird monatlich gewechselt"),
    ];
    const vorher = await Promise.all(ids.map((id) => b.vermerk(id)));

    const bericht = await b.lauf();

    expect(bericht).toMatchObject({
      nachgeholt: 0,
      fehlgeschlagen: 1,
      offen: 1,
      abbruch: "modell-nicht-erreichbar",
    });
    const nachher = await Promise.all(ids.map((id) => b.vermerk(id)));
    expect(nachher.every((v) => v?.status === "failed")).toBe(true);
    // Genau ein Objekt wurde in diesem Takt erneut versucht, das andere nicht angefasst.
    expect(nachher.filter((v, i) => JSON.stringify(v) !== JSON.stringify(vorher[i]))).toHaveLength(
      1,
    );

    b.modell.fehler = () => undefined;
    expect(await b.lauf()).toMatchObject({ nachgeholt: 2, offen: 0 });
  });

  it("ohne aktives Modell läuft nichts nach; der Rückstand steht einmal je Tag im Protokoll", async () => {
    const b = await buehne();
    await b.lege("Kandidat", "Pumpenleistung im Betrieb prüfen");
    b.modell.fehler = AUSFALL;
    const id = await b.reicheEin("Subjekt", "Das Ventil muss vor der Wartung geschlossen werden");
    const vorher = await b.vermerk(id);
    b.services.reasoner = new Reasoner();
    expect(b.services.reasoner.status().active).toBe(false);

    expect(await b.lauf()).toMatchObject({ abbruch: "kein-modell", offen: 1 });
    expect(await b.lauf()).toMatchObject({ abbruch: "kein-modell", offen: 1 });
    expect(await b.vermerk(id)).toEqual(vorher);
    expect(await b.protokoll()).toHaveLength(1);
  });
});

describe("N-0073 · Teilprüfung: wiederholbar, Kennzeichnung bleibt", () => {
  it("ein ausgelassener Vergleich bleibt nach erneutem Teilausfall teilgeprüft und wird später vollständig", async () => {
    const b = await buehne();
    await b.lege("Kandidat eins", "Pumpenleistung im Betrieb prüfen");
    await b.lege("Kandidat zwei", "Pumpendruck im Betrieb messen");
    // Genau ein Vergleich scheitert (Widerspruch gegen „Kandidat eins") — wie „8 von 9 Nachbarn,
    // 1 wegen Fehlern ausgelassen".
    b.modell.fehler = (system, user) =>
      system.includes('"relation"') && user.includes("Pumpenleistung")
        ? new Error("unbekannter Ausfall")
        : undefined;
    const id = await b.reicheEin("Subjekt", "Das Ventil muss vor der Wartung geschlossen werden");
    const teil = await b.vermerk(id);
    expect(teil?.status).toBe("failed");
    expect(teil?.coverage?.skipped).toBe(1);
    expect(teil?.coverage?.completed).toBeGreaterThan(0);

    // Wiederholung mit demselben Einzelausfall: weiterhin ehrlich teilgeprüft, keine Entwarnung —
    // und kein Abbruch des Takts, denn die Ursache liegt bei diesem einen Vergleich.
    expect(await b.lauf()).toMatchObject({ fehlgeschlagen: 1 });
    const erneut = await b.vermerk(id);
    expect(erneut).toMatchObject({ status: "failed", fallbackReason: "model-error" });
    expect(erneut?.coverage?.skipped).toBe(1);

    b.modell.fehler = () => undefined;
    expect(await b.lauf()).toMatchObject({ nachgeholt: 1 });
    expect(await b.vermerk(id)).toMatchObject({ status: "done", coverage: { skipped: 0 } });
  });
});

describe("R-1111 · laufender Abgleich: später entstandene Nachbarn, Tagesbudget, Protokoll", () => {
  it("ein später hinzugekommener Nachbar macht den Nachweis überholt — der Lauf vergleicht neu", async () => {
    const b = await buehne();
    await b.lege("Kandidat", "Pumpenleistung im Betrieb prüfen");
    const id = await b.reicheEin("Subjekt", "Das Ventil muss vor der Wartung geschlossen werden");
    expect(await b.vermerk(id)).toMatchObject({ status: "done" });
    expect((await b.vermerk(id))?.ueberholt).toBeFalsy();

    const spaeter = await b.lege("Später", "Das Ventil bleibt während der Wartung offen");
    expect((await b.vermerk(id))?.ueberholt).toBe(true);
    const aufrufeVorher = b.modell.aufrufe;

    const bericht = await b.lauf();

    expect(bericht).toMatchObject({ abgeglichen: 1, nachgeholt: 0, fehlgeschlagen: 0 });
    expect(b.modell.aufrufe).toBeGreaterThan(aufrufeVorher);
    const nachher = await b.vermerk(id);
    expect(nachher?.status).toBe("done");
    expect(nachher?.ueberholt).toBeFalsy();
    // Der später hinzugekommene Nachbar ist jetzt Teil des geprüften Bestands.
    expect(nachher?.coverage?.available).toBe(2);
    // Ohne Prüfvermerk (Import ohne angeforderte Prüfung) startet der Lauf keinen Modellaufruf.
    expect((await b.services.ko.get(spaeter.id))?.aiCheck).toBeUndefined();
    expect((await b.protokoll())[0]?.payload).toMatchObject({ abgeglichen: 1 });
  });

  it("das Tagesbudget deckelt die Modellvergleiche; der Rest folgt am nächsten Tag", async () => {
    const b = await buehne({ tagesbudget: 1 });
    await b.lege("Kandidat", "Pumpenleistung im Betrieb prüfen");
    await b.reicheEin("Erstes", "Das Ventil muss vor der Wartung geschlossen werden");
    await b.reicheEin("Zweites", "Der Filter wird monatlich gewechselt");
    await b.lege("Später", "Das Ventil bleibt während der Wartung offen");

    const erster = await b.lauf();
    expect(erster).toMatchObject({ abgeglichen: 1, offen: 1, abbruch: "budget" });
    expect(erster?.vergleicheHeute).toBeGreaterThanOrEqual(1);

    // Derselbe Tag: nichts mehr, und kein weiterer Protokolleintrag.
    const aufrufe = b.modell.aufrufe;
    expect(await b.lauf()).toMatchObject({ abgeglichen: 0, offen: 1, abbruch: "budget" });
    expect(b.modell.aufrufe).toBe(aufrufe);
    expect(await b.protokoll()).toHaveLength(1);

    b.uhr.jetzt += TAG_MS;
    expect(await b.lauf()).toMatchObject({ abgeglichen: 1, offen: 0 });
    expect(await b.protokoll()).toHaveLength(2);
  });
});

describe("Auswahl der Arbeit (rein)", () => {
  it("Vorführdaten, Schutzdaten-Quarantäne, vertrauliche Sperre und Objekte ohne Vermerk bleiben unberührt", async () => {
    const b = await buehne();
    await b.lege("Kandidat", "Pumpenleistung im Betrieb prüfen");
    const id = await b.reicheEin("Subjekt", "Das Ventil muss vor der Wartung geschlossen werden");
    const ko = (await b.services.ko.get(id)) as KnowledgeObject;
    const jetzt = Date.now();
    const ueberholt = { ...ko, aiCheck: { ...ko.aiCheck!, ueberholt: true } };
    expect(hintergrundArt(ueberholt, jetzt)).toBe("abgleich");
    expect(hintergrundArt({ ...ueberholt, demoSeed: true }, jetzt)).toBeNull();
    expect(
      hintergrundArt(
        {
          ...ueberholt,
          schutzdatenQuarantaene: { arten: ["email"] },
        } as unknown as KnowledgeObject,
        jetzt,
      ),
    ).toBeNull();
    const gescheitert = (fallbackReason: string): KnowledgeObject => ({
      ...ko,
      aiCheck: { ...ko.aiCheck!, status: "failed", fallbackReason },
    });
    expect(hintergrundArt(gescheitert("unreachable"), jetzt)).toBe("nachholen");
    expect(hintergrundArt(gescheitert("model-error"), jetzt)).toBe("nachholen");
    expect(hintergrundArt(gescheitert("confidential"), jetzt)).toBeNull();
    expect(hintergrundArt({ ...ko, aiCheck: undefined }, jetzt)).toBeNull();
    // Ein frischer pending-Vermerk gehört dem laufenden Worker — erst nach der Stale-Frist nachholen.
    const frisch: KnowledgeObject = {
      ...ko,
      aiCheck: { ...ko.aiCheck!, status: "pending", requestedAt: new Date(jetzt).toISOString() },
    };
    expect(hintergrundArt(frisch, jetzt)).toBeNull();
    expect(hintergrundArt(frisch, jetzt + TAG_MS)).toBe("nachholen");
  });
});
