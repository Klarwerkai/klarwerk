import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo } from "./repo";
import { type CreateKoInput, KoService } from "./service";

function base(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Ventil X schließt bei Überdruck",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "pedi",
    ...overrides,
  };
}

describe("KoService", () => {
  let service: KoService;

  beforeEach(() => {
    service = new KoService({ repo: new InMemoryKoRepo() });
  });

  it("FR-KO-01: erzeugt KO mit allen Pflichtfeldern", async () => {
    const ko = await service.create(base());
    expect(ko.version).toBe(1);
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    expect(ko.originalAuthor).toBe("pedi");
    expect(ko.neededValidations).toBe(3);
    expect(ko.assignments).toEqual([]);
    expect(ko.asset).toBeNull();
    expect(ko.history).toHaveLength(1);
    expect(ko.history[0]?.note).toBe("erstellt");
    expect(ko.comments).toEqual([]);
  });

  it("FR-KO-06: fügt Kommentare an und bewahrt sie über revise", async () => {
    const ko = await service.create(base());
    const c1 = await service.addComment(ko.id, "controller", "Bitte Quelle ergänzen.");
    expect(c1.comments).toHaveLength(1);
    expect(c1.comments[0]?.author).toBe("controller");
    expect(c1.comments[0]?.text).toBe("Bitte Quelle ergänzen.");
    const revised = await service.revise(ko.id, { statement: "neu" }, "controller");
    expect(revised.comments).toHaveLength(1);
  });

  it("SCRUM-129 / FR-KO-07: externe Quelle anfügen — nie peer-validiert, über revise erhalten", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const svc = new KoService({ repo: new InMemoryKoRepo(), audit });
    const ko = await svc.create(base());
    expect(ko.sources).toEqual([]);

    const withSource = await svc.addSource(ko.id, "experte", {
      label: "Wartungshandbuch P2",
      url: "https://wiki/p2",
      excerpt: "Kapitel 4.2",
    });
    expect(withSource.sources).toHaveLength(1);
    const src = withSource.sources[0];
    expect(src?.kind).toBe("external");
    expect(src?.peerValidated).toBe(false); // externe Quelle ist NIE peer-validiert
    expect(src?.label).toBe("Wartungshandbuch P2");
    expect(src?.url).toBe("https://wiki/p2");

    // Quelle bleibt über eine Überarbeitung erhalten.
    const revised = await svc.revise(ko.id, { statement: "neu" }, "experte");
    expect(revised.sources).toHaveLength(1);

    // Audit-Eintrag entstanden.
    const entries = await audit.list({ action: "ko.source-added" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.target).toBe(ko.id);
  });

  it("SCRUM-129: leeres Label wird abgelehnt; Quelle entfernbar", async () => {
    const ko = await service.create(base());
    await expect(service.addSource(ko.id, "experte", { label: "   " })).rejects.toMatchObject({
      code: "INVALID_SOURCE",
    });
    const withSource = await service.addSource(ko.id, "experte", { label: "Norm DIN 1234" });
    const sid = withSource.sources[0]?.id ?? "";
    expect(withSource.sources[0]?.url).toBeNull();
    const removed = await service.removeSource(ko.id, sid, "experte");
    expect(removed.sources).toHaveLength(0);
  });

  it("FR-CAP-05: Anhänge anfügen und entfernen", async () => {
    const ko = await service.create(base());
    expect(ko.attachments).toEqual([]);
    const withAtt = await service.addAttachment(ko.id, "pedi", {
      name: "foto.jpg",
      mime: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,AAAA",
    });
    expect(withAtt.attachments).toHaveLength(1);
    const attId = withAtt.attachments[0]?.id ?? "";
    const removed = await service.removeAttachment(ko.id, attId, "pedi");
    expect(removed.attachments).toHaveLength(0);
  });

  it("SCRUM-121: neuer Anhang speichert Objekt-Referenz + Vorschau, KEIN großes dataUrl", async () => {
    const ko = await service.create(base());
    const withRef = await service.addAttachment(ko.id, "pedi", {
      name: "foto.jpg",
      mime: "image/jpeg",
      objectId: "obj-123",
      thumbnail: "data:image/jpeg;base64,THUMB",
      size: 2_000_000,
    });
    const a = withRef.attachments[0];
    expect(a?.objectId).toBe("obj-123");
    expect(a?.thumbnail).toBe("data:image/jpeg;base64,THUMB");
    expect(a?.size).toBe(2_000_000);
    expect(a?.dataUrl).toBeUndefined(); // kein Inline-Original im KO-Modell
  });

  it("FR-KO-02: Wissensart setzbar und filterbar", async () => {
    await service.create(base({ type: "best_practice" }));
    await service.create(base({ type: "negativwissen" }));
    const negativ = await service.list({ type: "negativwissen" });
    expect(negativ).toHaveLength(1);
    expect(negativ[0]?.type).toBe("negativwissen");
  });

  it("FR-KO-02: unbekannte Wissensart wird abgewiesen", async () => {
    await expect(service.create(base({ type: "quatsch" as never }))).rejects.toMatchObject({
      code: "INVALID_TYPE",
    });
  });

  it("FR-KO-03: Kategorie und Tags nachträglich änderbar und filterbar", async () => {
    const ko = await service.create(base({ category: "Anlage 1", tags: ["druck"] }));
    await service.updateCategory(ko.id, "Anlage 2");
    await service.updateTags(ko.id, ["druck", "ventil"]);

    const byCategory = await service.list({ category: "Anlage 2" });
    expect(byCategory).toHaveLength(1);
    const byTag = await service.list({ tag: "ventil" });
    expect(byTag).toHaveLength(1);
    const byOldCategory = await service.list({ category: "Anlage 1" });
    expect(byOldCategory).toHaveLength(0);
  });

  it("FR-KO-04: Überarbeiten erhöht Version, setzt Bewertungen zurück, erzeugt History", async () => {
    const ko = await service.create(base());
    // Simuliere vorhandenes Vertrauen aus Validierung.
    const stored = await service.get(ko.id);
    if (!stored) {
      throw new Error("KO fehlt.");
    }
    stored.trust = 7;
    stored.status = "validiert";

    const revised = await service.revise(
      ko.id,
      { statement: "Korrigierte Maßnahme." },
      "controller",
    );
    expect(revised.version).toBe(2);
    expect(revised.trust).toBe(0);
    expect(revised.status).toBe("offen");
    expect(revised.statement).toBe("Korrigierte Maßnahme.");
    expect(revised.history).toHaveLength(2);
    expect(revised.history[1]?.author).toBe("controller");
  });

  it("weist ungültige Validierungsanzahl ab (1–5)", async () => {
    await expect(service.create(base({ neededValidations: 9 }))).rejects.toMatchObject({
      code: "INVALID_NEEDED",
    });
  });
});

describe("KoService — Audit-Verdrahtung (FR-AUD-01)", () => {
  it("protokolliert Anlegen und Überarbeiten", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const service = new KoService({ repo: new InMemoryKoRepo(), audit });
    const ko = await service.create(base());
    await service.revise(ko.id, { statement: "neu" }, "controller");
    await service.updateCategory(ko.id, "Anlage 9", "admin");
    await service.setAuthor(ko.id, "bob", "admin");

    const entries = await audit.list();
    expect(entries.map((e) => e.action)).toEqual([
      "ko.created",
      "ko.revised",
      "ko.category-changed",
      "ko.author-transferred",
    ]);
    expect(await audit.verify()).toBe(true);
  });
});
