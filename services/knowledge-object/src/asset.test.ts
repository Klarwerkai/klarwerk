// JOB 593 · Option A: `KnowledgeObject.asset` ist die KANONISCHE Anlagenkennung.
//
// WARUM DIESE DATEI ÜBERHAUPT EXISTIERT. `selectCandidates` vergleicht die Kennung
// ZEICHENGENAU (`c.asset === subject.asset`, services/conflicts/src/detect.ts:126). Eine
// kanonische Quelle, die denselben Betriebsbegriff in mehreren Schreibweisen ablegt, ist keine:
// „Presse 3" und „Presse  3" wären zwei Anlagen, und die Konflikterkennung fände die
// Doppelpflege nie, die sie finden soll.
//
// RED-FIRST — WELCHE FÄLLE AUF DER BASE ROT WAREN, und das ist nachprüfbar
// (`/private/tmp/kw-basic3-job593-d9-arbeit/redfirst-vorher.txt`, Base 79930092):
//   · A1–A6 rot am rohen Ablegen beim Anlegen (`asset: input.asset ?? null`, service.ts:1501).
//   · B1–B5 rot, weil `ReviseKoInput` die Kennung nicht führt — sie war nach der Anlage über
//     KEINEN Weg mehr änderbar. Genau die Auflage 1 des D8-Urteils.
//   · C1–C4 rot, weil der Altbestand seine Schreibweise behielt. Auflage 2.
//   · A7/A8 waren GRÜN und sollten es sein: sie sind der Bestandsschutz — die Normalform darf
//     eine bereits saubere Kennung nicht anfassen.
//   · N1–N4 (unten, letzter Block) prüfen den Helfer direkt. Sie waren NIE rot, weil es die
//     Datei vorher nicht gab; sie sind Abnahme, KEIN Red-first-Beleg. Das steht hier, damit
//     niemand sie dafür hält.
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeAsset } from "./asset";
import { InMemoryKoRepo, InMemoryKoVersionRepo } from "./repo";
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

describe("JOB 593 · A · Die Normalform entsteht beim Anlegen", () => {
  let repo: InMemoryKoRepo;
  let service: KoService;

  beforeEach(() => {
    repo = new InMemoryKoRepo();
    service = new KoService({ repo });
  });

  it("A1: Außenleerraum gehört nicht zur Kennung", async () => {
    const ko = await service.create(base({ asset: "  Presse 3  " }));
    expect(ko.asset).toBe("Presse 3");
  });

  it("A2: mehrfacher Innenleerraum wird EIN Leerzeichen", async () => {
    const ko = await service.create(base({ asset: "Presse   3" }));
    expect(ko.asset).toBe("Presse 3");
  });

  it("A3: eine Kennung, die nur aus Leerraum besteht, ist KEINE Kennung", async () => {
    const ko = await service.create(base({ asset: "   " }));
    // Es gibt genau zwei Zustände — eine Kennung oder keine. Nie einen leeren String, der
    // sich wie eine Kennung anfühlt und in `Boolean(subject.asset)` (detect.ts:126) doch
    // als „keine" zählt.
    expect(ko.asset).toBeNull();
  });

  it("A4: zwei Schreibweisen derselben Anlage ergeben DIESELBE Kennung", async () => {
    const a = await service.create(base({ asset: "Presse 3" }));
    const b = await service.create(base({ asset: " Presse   3 " }));
    // Das ist der Zweck, für den Option A gebunden wurde: `sameAsset` vergleicht zeichengenau.
    expect(b.asset).toBe(a.asset);
  });

  it("A5: das geschuetzte Leerzeichen aus Word/Excel wird ein normales", async () => {
    // Der Einfuegeweg aus Office liefert U+00A0 statt U+0020. Ohne diesen Fall truege dieselbe
    // Anlage je nach Herkunft des Textes zwei verschiedene Kennungen — und keine Oberflaeche
    // zeigt den Unterschied an. Das Escape steht hier bewusst: als rohes Zeichen waere der
    // Fall im Quelltext nicht von einem normalen Leerzeichen zu unterscheiden.
    const ko = await service.create(base({ asset: "Presse\u00a03" }));
    expect(ko.asset).toBe("Presse 3");
  });

  it("A6: zerlegte und zusammengesetzte Umlautform sind DIESELBE Kennung (NFC)", async () => {
    // „Fraese" gibt es in zwei Zeichenfolgen: ae als ein Zeichen (U+00E4) oder als a + Trema
    // (U+0061 U+0308). Beide sehen auf dem Schirm identisch aus. Ohne NFC waeren es zwei
    // Anlagen — und niemand koennte den Unterschied sehen. Das ist die schlimmste Sorte
    // Doppelpflege: eine, die man nicht bemerken kann.
    const zusammen = await service.create(base({ asset: "Fr\u00e4se 2" }));
    const zerlegt = await service.create(base({ asset: "Fra\u0308se 2" }));
    expect(zerlegt.asset).toBe(zusammen.asset);
    expect(zerlegt.asset).toBe("Fr\u00e4se 2");
  });

  it("A7 · Bestandsschutz: eine bereits saubere Kennung bleibt ZEICHENGLEICH", async () => {
    // Keine Kleinschreibung, keine Zeichenersetzung, kein Formatzwang: „Linie L4 / DP-4"
    // bleibt genau das. Entfernt wird ausschließlich Leerraum, der keine Bedeutung tragen kann.
    const ko = await service.create(base({ asset: "Linie L4 / Dosierstation DP-4" }));
    expect(ko.asset).toBe("Linie L4 / Dosierstation DP-4");
  });

  it("A8 · Bestandsschutz: ohne Feld bleibt die Kennung null", async () => {
    const ko = await service.create(base());
    expect(ko.asset).toBeNull();
  });
});

describe("JOB 593 · B · Der Korrekturweg — Auflage 1 des D8-Urteils", () => {
  let repo: InMemoryKoRepo;
  let service: KoService;

  beforeEach(() => {
    repo = new InMemoryKoRepo();
    service = new KoService({ repo });
  });

  it("B1: die Kennung ist nach der Anlage überhaupt änderbar", async () => {
    const ko = await service.create(base({ asset: "Presse 3" }));
    const revidiert = await service.revise(ko.id, { asset: "Presse 4" }, "carla");
    // Ohne diesen Weg ist die kanonische Kennung ein Einwegfeld: einmal falsch, immer falsch.
    expect(revidiert.asset).toBe("Presse 4");
  });

  it("B2: der Korrekturweg normalisiert mit DERSELBEN Regel wie die Anlage", async () => {
    const ko = await service.create(base({ asset: "Presse 3" }));
    const revidiert = await service.revise(ko.id, { asset: "  Presse   4  " }, "carla");
    // Eine zweite Normalform am zweiten Schreibrand wäre genau die zweite Wahrheit zurück,
    // die Option A beseitigt.
    expect(revidiert.asset).toBe("Presse 4");
  });

  it("B3: die Kennung kann bewusst ENTFERNT werden (null ist ein Wert, kein Versehen)", async () => {
    const ko = await service.create(base({ asset: "Presse 3" }));
    const revidiert = await service.revise(ko.id, { asset: null }, "carla");
    expect(revidiert.asset).toBeNull();
  });

  it("B4: eine Revision OHNE Kennungsfeld lässt die Kennung unangetastet", async () => {
    const ko = await service.create(base({ asset: "Presse 3" }));
    const revidiert = await service.revise(ko.id, { title: "Neuer Titel" }, "carla");
    // Kein stiller Verlust: wer den Titel ändert, verliert nicht die Anlagenzuordnung.
    expect(revidiert.asset).toBe("Presse 3");
    expect(revidiert.title).toBe("Neuer Titel");
  });

  it("B5 · der Zweckfall: ein Tippfehler in der Kennung ist heilbar", async () => {
    const richtig = await service.create(base({ asset: "Presse 3" }));
    const vertippt = await service.create(base({ asset: "Presse 33" }));
    expect(vertippt.asset).not.toBe(richtig.asset);

    const korrigiert = await service.revise(vertippt.id, { asset: "Presse 3" }, "carla");
    // Danach findet `selectCandidates` die beiden wieder als dieselbe Anlage.
    expect(korrigiert.asset).toBe(richtig.asset);
  });
});

describe("JOB 593 · C · Der Altbestand — Auflage 2 des D8-Urteils", () => {
  let repo: InMemoryKoRepo;
  let versions: InMemoryKoVersionRepo;
  let service: KoService;

  beforeEach(() => {
    repo = new InMemoryKoRepo();
    versions = new InMemoryKoVersionRepo();
    service = new KoService({ repo, versions });
  });

  // Ein Altbestandsobjekt: angelegt VOR der Normalform, also mit roher Schreibweise im Speicher.
  // Genau so sähe es nach einem Import oder einem Seed von vor dieser Änderung aus.
  //
  // Die Nachbildung setzt BEIDE Speicher zurück, und das ist keine Umständlichkeit: der
  // Versions-Snapshot der Version 1 entsteht bereits beim ANLEGEN (`service.ts:1660`), nicht
  // erst bei der Revision. Ein echtes Altobjekt trägt seinen rohen Wert deshalb auch in seiner
  // eigenen Vorversion. Wer nur den Objektspeicher patcht, baut ein Objekt nach, das es nie
  // gegeben hat — und prüft danach eine Zusicherung, die niemanden schützt.
  async function altbestand(rohwert: string | null): Promise<string> {
    const ko = await service.create(base({ asset: "Platzhalter" }));
    const roh = { ...ko, asset: rohwert };
    await repo.insert(roh);
    await versions.remove(ko.id, 1);
    await versions.append({
      koId: ko.id,
      version: 1,
      at: ko.createdAt,
      author: ko.author,
      note: "erstellt",
      snapshot: roh,
    });
    return ko.id;
  }

  it("C1: die nächste Revision bringt eine alte Kennung auf die Normalform", async () => {
    const id = await altbestand("  Presse   3 ");
    // Die Revision ändert den Titel — von der Kennung ist keine Rede. Sie wird trotzdem
    // geheilt: dasselbe Hausmuster wie `sanitizeSources` (service.ts:3000-3001, „säubert
    // auch Altbestand beim nächsten Revise"). Kein Massenlauf über den Bestand, keine
    // Datenberührung ohne Anlass.
    const revidiert = await service.revise(id, { title: "Neuer Titel" }, "carla");
    expect(revidiert.asset).toBe("Presse 3");
  });

  it("C2 · Verlustschutz: die Heilung schreibt die Historie NICHT um", async () => {
    const id = await altbestand("  Presse   3 ");
    const revidiert = await service.revise(id, { title: "Neuer Titel" }, "carla");

    const gespeichert = await versions.listByKo(id);
    expect(gespeichert.map((v) => v.version)).toEqual([1, 2]);
    // Die Vorversion hält den rohen Wert fest, wie er geschrieben wurde. Die Heilung wirkt
    // nur auf den LEBENDEN Stand; wer je wissen muss, wie die Kennung ursprünglich lautete,
    // kann es nachlesen. Das ist die Zusicherung, die einen Massenlauf über den Bestand
    // ersetzbar macht: nichts geht verloren, es wird nur nichts mehr falsch fortgeschrieben.
    expect(gespeichert[0]?.snapshot.asset).toBe("  Presse   3 ");
    expect(gespeichert[1]?.snapshot.asset).toBe("Presse 3");
    expect(revidiert.asset).toBe("Presse 3");
  });

  it("C3: die Heilung erfindet keine Kennung, wo keine war", async () => {
    const id = await altbestand(null);
    const revidiert = await service.revise(id, { title: "Neuer Titel" }, "carla");
    expect(revidiert.asset).toBeNull();
  });

  it("C4: die Heilung ist wiederholbar und ändert beim zweiten Mal nichts mehr", async () => {
    const id = await altbestand("  Presse   3 ");
    const einmal = await service.revise(id, { title: "T1" }, "carla");
    const zweimal = await service.revise(id, { title: "T2" }, "carla");
    expect(zweimal.asset).toBe(einmal.asset);
    expect(zweimal.asset).toBe("Presse 3");
  });
});

describe("JOB 593 · N · Der Helfer selbst — Abnahme, NICHT Red-first", () => {
  // Diese vier Fälle konnten nie rot sein: `./asset` gab es vor dieser Änderung nicht.
  // Sie pinnen die Regel an ihrer Quelle, damit eine spätere Änderung am Helfer auffällt,
  // auch wenn kein Dienstfall sie zufällig trifft.
  it("N1: Nichtzeichenketten sind keine Kennung", () => {
    expect(normalizeAsset(undefined)).toBeNull();
    expect(normalizeAsset(null)).toBeNull();
    expect(normalizeAsset(42)).toBeNull();
    expect(normalizeAsset({})).toBeNull();
  });

  it("N2: Leerraum außen weg, innen auf ein Zeichen", () => {
    expect(normalizeAsset("\t Presse \n 3 \r\n")).toBe("Presse 3");
  });

  it("N3: NFC — gleiche Erscheinung, gleiche Kennung", () => {
    expect(normalizeAsset("Fra\u0308se 2")).toBe(normalizeAsset("Fr\u00e4se 2"));
  });

  it("N4: die Normalform ist idempotent (zweimal anwenden ändert nichts)", () => {
    const einmal = normalizeAsset("  Presse   3  ");
    expect(normalizeAsset(einmal)).toBe(einmal);
    expect(einmal).toBe("Presse 3");
  });
});
