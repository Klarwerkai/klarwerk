// ================================================================================================
// Auftrag gesamt-ki-freigaberegeln · BEN NACHARBEIT 2 — DIE ZWEITE FREIGABE WIRKT BIS ZUM ANBIETER.
// ================================================================================================
//
// BENS BEFUND: „Die zentrale Freigabe vertraulicher Inhalte bleibt wirkungslos: Cloudclients werden
// weiterhin unbedingt mit rejectsConfidential: true gekapselt … Kerntests verwenden ungekapselte
// Clients und belegen diesen Betriebsweg nicht."
//
// DESHALB MISST DIESE DATEI MIT DEM GEKAPSELTEN CLIENT, wie ihn der Betrieb baut
// (`cappedModelClient(…, { rejectsConfidential: true })`), und zählt die Aufrufe HINTER dem Wächter.
// Getrennt gemessen wird, was getrennt bleiben muss:
//   V1  beide zentralen Freigaben → der vertrauliche Text erreicht den Anbieter (Aufgabe UND Urteil);
//   V2  nur die Grundfreigabe → null Aufrufe, Ursache `confidential`;
//   V3  beide Freigaben, aber die Anfrage ist an KEINEN Anbieter gebunden (Klara-Tor hat abgelehnt)
//       → null Aufrufe: eine fehlende Dokumentzustimmung hebt keine Adminfreigabe auf;
//   V4  der Wächter selbst: ohne vom Reasoner gesetzten Merker weist er Vertrauliches ab — auch bei
//       erteilten Freigaben (kein Bypass am Lauf vorbei);
//   V5  der Word-Dokumenttext: die zweite Freigabe hebt NUR die Vertraulichkeitsstufe der eigenen
//       Deckungsprüfung auf; die Zustimmung je Dokument bleibt Pflicht;
//   V6  die Kopfzeilenauskunft (`publicStatus().extern`) folgt derselben Entscheidung.
//
// Diese Datei liegt in `tests/admin-ki-freigabe/`, weil sie die Freigabefelder schreiben muss
// (Freigabe-Wächter F2 in `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`).
import { describe, expect, it } from "vitest";
import { pruefeDokumenttextDeckung } from "../../services/app/src/services/klara-session-service";
import { bindeAnbieter, imBindungsrahmen } from "../../services/reasoner/src/anbieterbindung";
import {
  ConfidentialEgressError,
  cappedModelClient,
} from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import { InMemoryReasonerPolicyRepo } from "../../services/reasoner/src/reasoner-policy";
import { Reasoner } from "../../services/reasoner/src/service";
import type { ReasonerTaskConfigEingabe } from "../../services/reasoner/src/types";

const VERTRAULICH = true;

/** Der Betriebsweg: ein roher Client HINTER dem Wächter; gezählt wird, was durchkommt. */
function gekapselterAnbieter() {
  const gesehen: string[] = [];
  const roh: ModelClient = {
    name: "anthropic:test-modell",
    complete: async (_system: string, user: string) => {
      gesehen.push(user);
      return "{}";
    },
  };
  const client = cappedModelClient(roh, { rejectsConfidential: true });
  const reasoner = new Reasoner(
    new ModelProvider(client),
    undefined,
    undefined,
    undefined,
    undefined,
    new InMemoryReasonerPolicyRepo(),
  );
  return { reasoner, client, rufe: () => gesehen.length, gesehen };
}

async function setze(reasoner: Reasoner, kiFreigabe: unknown): Promise<void> {
  await reasoner.setTaskConfig({
    global: "auto",
    perTask: {},
    kiFreigabe,
  } as ReasonerTaskConfigEingabe);
}

const BEIDE = { oeffentlicheKi: true, vertraulicheInhalte: true };

describe("gesamt-ki-freigaberegeln · die zweite Freigabe bis zum Anbieter (gekapselter Client)", () => {
  it("V1 · beide Freigaben: der vertrauliche Text geht durch den Wächter hinaus", async () => {
    const a = gekapselterAnbieter();
    await setze(a.reasoner, BEIDE);
    const res = await a.reasoner.structure("Vertrauliche Rezeptur: 3 %.", "de", VERTRAULICH);
    expect(a.rufe()).toBe(1);
    expect(a.gesehen[0]).toContain("Vertrauliche Rezeptur");
    expect(res.demo).toBe(false);
  });

  it("V1b · auch das Urteil (Laufbuch-Weg) erreicht den Anbieter mit beiden Freigaben", async () => {
    const a = gekapselterAnbieter();
    await setze(a.reasoner, BEIDE);
    await a.reasoner.judgeConflictOutcome("Rezeptur 3 %", "Rezeptur 4 %", "de", VERTRAULICH);
    expect(a.rufe()).toBe(1);
  });

  it("V2 · nur die Grundfreigabe: null Aufrufe, Ursache confidential", async () => {
    const a = gekapselterAnbieter();
    await setze(a.reasoner, { oeffentlicheKi: true });
    const res = await a.reasoner.structure("Vertrauliche Rezeptur.", "de", VERTRAULICH);
    expect(a.rufe()).toBe(0);
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("confidential");
    // Gegenprobe im selben Aufbau: nicht vertraulich geht hinaus.
    await a.reasoner.structure("Normaler Rohtext.", "de", false);
    expect(a.rufe()).toBe(1);
  });

  it("V3 · beide Freigaben, aber das Klara-Tor hat abgelehnt: null Aufrufe", async () => {
    const a = gekapselterAnbieter();
    await setze(a.reasoner, BEIDE);
    await imBindungsrahmen(async () => {
      expect(bindeAnbieter(null)).toBe(true);
      await a.reasoner.structure("Vertrauliche Rezeptur.", "de", VERTRAULICH);
      await a.reasoner.structure("Normaler Rohtext.", "de", false);
    });
    expect(a.rufe()).toBe(0);
    // Gegenprobe: ohne die Absage geht derselbe vertrauliche Text hinaus.
    await a.reasoner.structure("Vertrauliche Rezeptur.", "de", VERTRAULICH);
    expect(a.rufe()).toBe(1);
  });

  it("V4 · der Wächter ohne Merker des Laufs weist Vertrauliches ab — auch bei erteilten Freigaben", async () => {
    const a = gekapselterAnbieter();
    await setze(a.reasoner, BEIDE);
    await expect(a.client.complete("system", "Vertrauliches", VERTRAULICH)).rejects.toBeInstanceOf(
      ConfidentialEgressError,
    );
    expect(a.rufe()).toBe(0);
    // Nicht vertraulich ist der direkte Aufruf unverändert möglich.
    await a.client.complete("system", "Normal", false);
    expect(a.rufe()).toBe(1);
  });

  it("V5 · Word-Dokumenttext: die zweite Freigabe hebt nur die Stufe auf, die Zustimmung bleibt Pflicht", () => {
    const lage = {
      consent: undefined,
      gedeckteConsentId: null,
      documentContextId: "dok-1",
      vertraulich: true,
      riegelOffen: true,
    };
    expect(pruefeDokumenttextDeckung(lage)).toEqual({ gedeckt: false, grund: "vertraulich" });
    expect(pruefeDokumenttextDeckung({ ...lage, vertraulichFreigegeben: false })).toEqual({
      gedeckt: false,
      grund: "vertraulich",
    });
    // Mit Freigabe greift die nächste Stufe: ohne Zustimmung bleibt der Text draussen.
    expect(pruefeDokumenttextDeckung({ ...lage, vertraulichFreigegeben: true })).toEqual({
      gedeckt: false,
      grund: "kein_consent",
    });
  });

  it("V6 · die Kopfzeilenauskunft folgt derselben Entscheidung", async () => {
    const a = gekapselterAnbieter();
    expect(a.reasoner.publicStatus().extern).toBe("blockiert");
    expect(a.reasoner.vertraulicheAusleitungFreigegeben()).toBe(false);
    await setze(a.reasoner, { vertraulicheInhalte: true });
    expect(a.reasoner.publicStatus().extern).toBe("blockiert");
    await setze(a.reasoner, { oeffentlicheKi: true });
    expect(a.reasoner.publicStatus().extern).toBe("frei");
    expect(a.reasoner.vertraulicheAusleitungFreigegeben()).toBe(false);
    await setze(a.reasoner, BEIDE);
    expect(a.reasoner.publicStatus().extern).toBe("frei_vertraulich");
    expect(a.reasoner.vertraulicheAusleitungFreigegeben()).toBe(true);
  });
});
