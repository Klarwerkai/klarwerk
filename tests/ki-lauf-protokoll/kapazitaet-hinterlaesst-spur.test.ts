// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll · R-1572 / R-1621 — EIN LAUF, DER AN DER AUSLASTUNG ENDET.
// ================================================================================================
//
// DER REST: JOB 3074 (Tokenverbrauch) ließ `ModelCapacityError` ausdrücklich offen. `runTask`
// reichte die Auslastung als 503 durch und schrieb NICHTS — auch dann nicht, wenn ein früheres
// Glied der Kette schon ein Modell befragt und Verbrauch gemeldet hatte. Dieser bezahlte Verbrauch
// stand nirgends.
//
// WAS HIER GEMESSEN WIRD: genau ein Fehlerdatensatz je Lauf, mit dem Glied, an dem er stand, dem
// bisher gesammelten Verbrauch und der Auslastungsmeldung — und die Auslastung bleibt der Fehler,
// den der Aufrufer sieht (503-Vertrag unverändert), auch wenn das Protokoll nicht schreiben kann.
//
// DIE AUSLASTUNG SITZT AM ROHEN CLIENT: der gecappte Wrapper wirft sie, BEVOR er den Aufruf
// vermerkt (Slot nie erteilt). Ein roher Client, der sie wirft, bildet genau das ab — es entsteht
// keine Aufrufspur, also auch kein `model` aus diesem Glied.
import { describe, expect, it } from "vitest";
import {
  InMemoryModelRunRepo,
  type ModelRunRecord,
  type ModelRunRepo,
} from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import {
  ModelCapacityError,
  cappedModelClient,
  meldeModellVerbrauch,
} from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const SATZ = "Roher Satz, der geglättet werden soll.";
const AUSLASTUNG = "Modell ausgelastet: kein Slot innerhalb 5 ms frei.";

function ausgelasteterClient(name: string, model: string): ModelClient {
  return {
    name,
    model,
    complete: async () => {
      throw new ModelCapacityError(AUSLASTUNG);
    },
  };
}

// Ein Cloud-Glied, das die Modell-API wirklich erreicht, Verbrauch gemeldet bekommt und dann
// scheitert (der teure Fall). Gecappt wie im Produkt, damit `gerufen` und `verbrauch` entstehen.
function bezahltGescheitert(): ModelClient {
  return cappedModelClient(
    {
      name: "anthropic:cloud-modell",
      model: "cloud-modell",
      complete: async () => {
        meldeModellVerbrauch(3000, 12);
        throw new Error("Modell-API antwortete mit 500");
      },
    },
    { rejectsConfidential: true },
  );
}

async function laufBisZurAuslastung(
  reasoner: Reasoner,
  repo: InMemoryModelRunRepo,
): Promise<{ fehler: unknown; laeufe: ModelRunRecord[] }> {
  await erteileKiFreigabe(reasoner);
  const fehler = await reasoner.assistText(SATZ, "de").then(
    () => undefined,
    (err: unknown) => err,
  );
  return { fehler, laeufe: await repo.recent(10) };
}

describe("Aufnahme ki-laufprotokoll: Auslastung hinterlässt genau einen Laufdatensatz", () => {
  it("K1 · erstes Glied ausgelastet: 503-Fehler bleibt, ein error-Datensatz ohne model/verbrauch", async () => {
    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(
      new ModelProvider(ausgelasteterClient("anthropic:cloud-modell", "cloud-modell")),
      new DeterministicProvider(),
      repo,
    );

    const { fehler, laeufe } = await laufBisZurAuslastung(reasoner, repo);

    expect(fehler).toBeInstanceOf(ModelCapacityError);
    expect(laeufe).toHaveLength(1);
    const lauf = laeufe[0] as ModelRunRecord;
    expect(lauf.task).toBe("assist");
    expect(lauf.status).toBe("error");
    expect(lauf.locale).toBe("de");
    expect(lauf.provider).toBe("anthropic:cloud-modell");
    expect(lauf.demo).toBe(false);
    expect(lauf.fallback).toBe(false);
    // Kein Slot erteilt → kein Modell hat gearbeitet → das Feld fehlt, kein Ersatzwert.
    expect(Object.hasOwn(lauf, "model")).toBe(false);
    expect(Object.hasOwn(lauf, "verbrauch")).toBe(false);
    expect(lauf.error).toContain(AUSLASTUNG);
    // Nur Metadaten: der Eingabetext erreicht das Protokoll nicht.
    expect(JSON.stringify(lauf)).not.toContain("Roher Satz");
  });

  it("K2 · bezahlter Fehlversuch, dann Auslastung: Verbrauch und Modell des ersten Glieds bleiben", async () => {
    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(
      new ModelProvider(bezahltGescheitert()),
      new DeterministicProvider(),
      repo,
      undefined,
      new ModelProvider(ausgelasteterClient("lokal:lokal-modell", "lokal-modell")),
    );

    const { fehler, laeufe } = await laufBisZurAuslastung(reasoner, repo);

    expect(fehler).toBeInstanceOf(ModelCapacityError);
    expect(laeufe).toHaveLength(1);
    const lauf = laeufe[0] as ModelRunRecord;
    expect(lauf.status).toBe("error");
    expect(lauf.provider).toBe("lokal:lokal-modell");
    expect(lauf.fallback).toBe(true);
    // Das zuletzt WIRKLICH gerufene Modell ist das der Cloud — das lokale bekam keinen Slot.
    expect(lauf.model).toBe("cloud-modell");
    expect(lauf.verbrauch).toEqual({ eingabeToken: 3000, ausgabeToken: 12, gemeldeteAufrufe: 1 });
    expect(lauf.error).toContain(
      "anthropic:cloud-modell (cloud-modell): Modell-API antwortete mit 500",
    );
    expect(lauf.error).toContain(`lokal:lokal-modell: ${AUSLASTUNG}`);
  });

  it("K3 · das Protokoll kann nicht schreiben: der Aufrufer sieht trotzdem die Auslastung", async () => {
    const kaputt: ModelRunRepo = {
      append: async () => {
        throw new Error("Protokollablage nicht erreichbar");
      },
      recent: async () => [],
    };
    const reasoner = new Reasoner(
      new ModelProvider(ausgelasteterClient("anthropic:cloud-modell", "cloud-modell")),
      new DeterministicProvider(),
      kaputt,
    );
    await erteileKiFreigabe(reasoner);

    await expect(reasoner.assistText(SATZ, "de")).rejects.toBeInstanceOf(ModelCapacityError);
  });
});
