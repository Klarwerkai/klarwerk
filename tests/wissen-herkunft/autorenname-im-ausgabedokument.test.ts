// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · R-0298 / SOLL:FR-LIF-04 — DER AUTORENNAME IM AUSGABEDOKUMENT.
// ================================================================================================
//
// Bens Befund (Nacharbeit 1): Output Factory und Bibliotheksexport schrieben in die Herkunftszeile
// die KONTOKENNUNG („Autor: 3f2a…"). R-0298 verlangt Autor und Originalautor „auch an jedem
// erzeugten Ausgabedokument", FR-LIF-04 den sichtbaren Autorennamen. Geprüft wird:
//   A1 · die Auflösung selbst: Name, gelöschtes Konto, unbekannte Kennung, Ausfall — nie ein Name,
//        den das Verzeichnis nicht herausgibt.
//   A2 · Output Factory über die echte Verdrahtung: Name statt Kennung, Originalautor nach einer
//        Übergabe, gelöschter Originalautor als „Gelöschtes Konto"; die Kennungen im Datensatz bleiben.
//   A3 · Bibliotheksexport Markdown, MediaWiki und HTML über dieselbe Verdrahtung.
//   A4 · ohne verdrahtete Auflösung bleibt es bei den Kennungen (Bestandsverhalten).
import { describe, expect, it } from "vitest";
import { autorKurzRef, autorenNamenAus } from "../../services/app/src/autorennamen";
import { buildServices } from "../../services/app/src/build-app";
import { OutputService } from "../../services/output";

const KENNWORT = "secret123";

async function bestand() {
  const services = buildServices();
  const admin = await services.auth.register({
    name: "Pia Admin",
    email: "pia@x.de",
    password: KENNWORT,
  });
  const anna = await services.auth.register({
    name: "Anna Alt",
    email: "anna@x.de",
    password: KENNWORT,
  });
  const bea = await services.auth.register({
    name: "Bea Neu",
    email: "bea@x.de",
    password: KENNWORT,
  });
  const ko = await services.ko.create({
    title: "Ventil entlüften",
    statement: "Vor dem Anfahren das Ventil entlüften.",
    type: "best_practice",
    category: "Betrieb",
    author: anna.id,
    confidentiality: "intern",
  });
  // Übergabe: Bea ist jetzt verantwortliche Autorin, Anna bleibt Originalautorin (FR-LIF-02).
  await services.ko.setAuthor(ko.id, bea.id, admin.id);
  await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });
  return { services, admin, anna, bea, ko };
}

describe("A1 · die Auflösung folgt der Leseregel des Verzeichnisses", () => {
  const konten = [{ id: "u-anna", name: "Anna Alt" }];
  const dienst = {
    listUsers: async () => konten as never,
    listDeletedUserIds: async () => ["u-weg-123"],
  };

  it("Name, gelöschtes Konto und unbekannte Kennung sind drei verschiedene Texte", async () => {
    const namen = await autorenNamenAus(dienst)(["u-anna", "u-weg-123", "fremd-9"]);
    expect(namen.get("u-anna")).toBe("Anna Alt");
    expect(namen.get("u-weg-123")).toBe(`Gelöschtes Konto (${autorKurzRef("u-weg-123")})`);
    expect(namen.get("fremd-9")).toBe(`Unbekannte Person (${autorKurzRef("fremd-9")})`);
  });

  it("ein Ausfall des Verzeichnisses wird nicht zur Aussage über die Person", async () => {
    const kaputt = {
      listUsers: async () => {
        throw new Error("Verzeichnis weg");
      },
      listDeletedUserIds: async () => [],
    };
    const namen = await autorenNamenAus(kaputt)(["u-anna"]);
    expect(namen.get("u-anna")).toBe("Autorenname nicht abrufbar");
  });

  it("leere Kennungen werden nicht abgefragt", async () => {
    let gefragt = false;
    const zaehler = {
      listUsers: async () => {
        gefragt = true;
        return [];
      },
      listDeletedUserIds: async () => [],
    };
    expect((await autorenNamenAus(zaehler)(["", "  "])).size).toBe(0);
    expect(gefragt).toBe(false);
  });
});

describe("A2 · Output Factory: sichtbarer Autorenname statt Kennung", () => {
  it("Autor und Originalautor stehen mit Namen im Dokument, die Kennungen im Datensatz", async () => {
    const { services, anna, bea, ko } = await bestand();
    const doc = await services.output.generate({ kind: "management_summary", koIds: [ko.id] });

    expect(doc.markdown).toContain("Autor: Bea Neu (urspr. Anna Alt)");
    // Kernpunkte der Management-Summary tragen dieselbe Zeile.
    expect(doc.markdown).toContain("Trust 80, Bea Neu (urspr. Anna Alt)");
    expect(doc.markdown).not.toContain(anna.id);
    expect(doc.markdown).not.toContain(bea.id);

    expect(doc.provenance[0]).toMatchObject({
      author: bea.id,
      originalAuthor: anna.id,
      authorName: "Bea Neu",
      originalAuthorName: "Anna Alt",
    });
  });

  it("ein gelöschter Originalautor heißt „Gelöschtes Konto“ — der Name von damals bleibt draußen", async () => {
    const { services, admin, anna, ko } = await bestand();
    await services.auth.deleteUser(anna.id, admin.id);

    const doc = await services.output.generate({ kind: "instruction", koIds: [ko.id] });
    expect(doc.markdown).toContain(
      `Autor: Bea Neu (urspr. Gelöschtes Konto (${autorKurzRef(anna.id)}))`,
    );
    expect(doc.markdown).not.toContain("Anna Alt");
  });
});

describe("A3 · Bibliotheksexport: Markdown, MediaWiki und HTML tragen den Namen", () => {
  it("alle drei Textformate nennen Autorin und Originalautorin mit Namen", async () => {
    const { services, anna, bea } = await bestand();
    const md = await services.library.exportMarkdown();
    const wiki = await services.library.exportMediaWiki();
    const html = await services.library.exportHtml();

    for (const [format, text] of [
      ["markdown", md],
      ["mediawiki", wiki],
      ["html", html],
    ] as const) {
      expect(text, format).toContain("Autor: Bea Neu (urspr. Anna Alt)");
      expect(text, format).not.toContain(anna.id);
      expect(text, format).not.toContain(bea.id);
    }
  });
});

describe("A4 · ohne verdrahtete Auflösung bleibt die Kennung (Bestandsverhalten)", () => {
  it("OutputService ohne autorenNamen schreibt die Kennungen wie vor diesem Auftrag", async () => {
    const { services, anna, bea, ko } = await bestand();
    const ohne = new OutputService({ koService: services.ko });
    const doc = await ohne.generate({ kind: "instruction", koIds: [ko.id] });
    expect(doc.markdown).toContain(`Autor: ${bea.id} (urspr. ${anna.id})`);
    expect(doc.provenance[0]?.authorName).toBeUndefined();
  });
});
