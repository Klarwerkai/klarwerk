// D5 · KI aus — DIE LESEFASSUNG IM FRAGEWEG (Lauf 3).
//
// Seit der Prüfbasis-Aktualität (AUFNAHME 20260922) liest `KoService.get`/`findCandidates` nach
// dem Objekt noch den Schreibstand der Ablage und — ist der gemerkte Stempel nicht mehr gültig —
// den GANZEN Bestand (`pruefbestandStempel`). Der Routentest (abschaltung-am-frageweg.test.ts) hält
// an `ko.anhangSchreibstand` an; den Bestandslesezugriff trifft er nicht zuverlässig, weil der
// Stempel dort schon gemerkt ist. Diese Datei belegt beide Zweige am Dienst selbst — und dass die
// Versions-Autorität der Befund-Dienste (`aktuelleFassungVon`) dieselbe Fassung wie `get` liefert,
// ohne die Lesefassung zu lesen.
import { describe, expect, it, vi } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";

function geprueftesKo(id: string): KnowledgeObject {
  return {
    id,
    title: `D5 ${id}`,
    statement: "Synthetische Aussage.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 3,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    history: [],
    // Abgeschlossener Nachweis: erst er braucht den Bestandsstempel (`brauchtPruefstand`).
    aiCheck: { status: "done", requestedAt: "2026-09-01T00:00:00Z" },
  } as unknown as KnowledgeObject;
}

async function aufbau() {
  const repo = new InMemoryKoRepo();
  await repo.insert(geprueftesKo("ko-a"));
  const service = new KoService({ repo });
  const list = vi.spyOn(repo, "list");
  const stand = vi.spyOn(repo, "anhangSchreibstand");
  return { repo, service, list, stand };
}

/** Eine Sperre, die ab dem `ab`-ten Aufruf wirft — wie `pruefeKiSperre` nach der Abschaltung. */
function sperreAb(ab: number) {
  let aufrufe = 0;
  return {
    pruefen: (): void => {
      aufrufe += 1;
      if (aufrufe >= ab) {
        throw new Error("KI_ABGESCHALTET");
      }
    },
    aufrufe: () => aufrufe,
  };
}

describe("D5 · KI aus — die Lesefassung liest nur unter der Sperre", () => {
  it("ohne gemerkten Stempel: Sperre vor Objekt, vor Schreibstand und vor dem Bestand", async () => {
    const { service, list, stand } = await aufbau();
    const s = sperreAb(Number.POSITIVE_INFINITY);
    const ko = await service.get("ko-a", s.pruefen);
    expect(ko?.id).toBe("ko-a");
    expect(s.aufrufe()).toBe(3);
    expect(stand).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("abgeschaltet nach dem Objekt: weder Schreibstand noch Bestand werden gelesen", async () => {
    const { service, list, stand } = await aufbau();
    const s = sperreAb(2);
    await expect(service.get("ko-a", s.pruefen)).rejects.toThrow("KI_ABGESCHALTET");
    expect(stand).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it("abgeschaltet nach dem Schreibstand: der Bestand wird nicht gelesen", async () => {
    const { service, list, stand } = await aufbau();
    const s = sperreAb(3);
    await expect(service.get("ko-a", s.pruefen)).rejects.toThrow("KI_ABGESCHALTET");
    expect(stand).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
  });

  it("Gegenprobe: ohne Sperre liest `get` wie bisher Schreibstand und Bestand", async () => {
    const { service, list, stand } = await aufbau();
    await service.get("ko-a");
    expect(stand).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("`aktuelleFassungVon` = `get(id)?.version`, ohne Lesefassung; getrasht und unbekannt → undefined", async () => {
    const { repo, service, list, stand } = await aufbau();
    expect(await service.aktuelleFassungVon("ko-a")).toBe((await service.get("ko-a"))?.version);
    list.mockClear();
    stand.mockClear();
    expect(await service.aktuelleFassungVon("ko-a")).toBe(3);
    expect(stand).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    await repo.update({ ...geprueftesKo("ko-a"), deletedAt: "2026-09-02T00:00:00Z" });
    expect(await service.aktuelleFassungVon("ko-a")).toBeUndefined();
    expect(await service.get("ko-a")).toBeUndefined();
    expect(await service.aktuelleFassungVon("ko-x")).toBeUndefined();
  });
});
