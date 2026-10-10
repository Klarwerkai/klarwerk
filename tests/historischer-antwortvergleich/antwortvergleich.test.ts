// ================================================================================================
// R-1630 / R-2176 — „DIESE FRAGE HÄTTE VOR EINEM JAHR EINE ANDERE ANTWORT GEHABT."
// ================================================================================================
//
// Gemessen am echten Weg: KoService mit Versionsablage, Prüfprotokoll, ValidationService
// (Admin-Freigabe schreibt `ko.admin-validated` mit der Fassung), AskService mit dem
// deterministischen Reasoner. Die Uhr ist steuerbar, damit Anlage, Überarbeitung und Freigabe
// wirklich VOR oder NACH dem Stichtag liegen — nichts davon wird am Objekt vorgetäuscht.
import { describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo, stichtagAus } from "../../services/ask";
import {
  fassungZumStichtag,
  freigabeZumStichtagBelegt,
} from "../../services/ask/src/wissensstand-vergleich";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  type CreateKoInput,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import { Reasoner, queryTokens } from "../../services/reasoner";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  InMemoryValidationSettingsRepo,
  ValidationService,
} from "../../services/validation";

const FRAGE = "Was tun bei Überdruck am Ventil?";
const HEUTE = Date.parse("2026-10-08T10:00:00.000Z");
const STICHTAG = stichtagAus(undefined, HEUTE) ?? Number.NaN;

function ventil(over: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
    ...over,
  };
}

async function aufbau() {
  const uhr = { jetzt: Date.parse("2025-03-01T09:00:00.000Z") };
  const now = (): number => uhr.jetzt;
  const auditRepo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo: auditRepo, now });
  const versions = new InMemoryKoVersionRepo();
  const koService = new KoService({ repo: new InMemoryKoRepo(), versions, audit, now });
  await koService.activateSearchProjectionV2();
  const validation = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    settings: new InMemoryValidationSettingsRepo(),
    audit,
    now,
  });
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps: new InMemoryGapRepo(),
    audit,
    now,
  });
  const am = (iso: string): void => {
    uhr.jetzt = Date.parse(iso);
  };
  const vergleiche = async (sichtbar: (ko: { author: string }) => boolean = () => true) => {
    am("2026-10-08T10:00:00.000Z");
    return ask.vergleicheWissensstand(FRAGE, "anna", "de", STICHTAG, sichtbar);
  };
  return { koService, validation, ask, audit, versions, am, vergleiche };
}

describe("R-1630 / R-2176 · Antwort mit dem Wissensstand vor einem Jahr vergleichen", () => {
  it("Stichtag: ohne Angabe ein Jahr zurück; ein Tag ist sein Ende; heute oder Unsinn gilt nicht", () => {
    expect(new Date(STICHTAG).toISOString()).toBe("2025-10-08T10:00:00.000Z");
    expect(new Date(stichtagAus("2025-10-01", HEUTE) ?? 0).toISOString()).toBe(
      "2025-10-01T23:59:59.999Z",
    );
    expect(stichtagAus("2026-10-08", HEUTE)).toBeNull();
    expect(stichtagAus("2025-02-30", HEUTE)).toBeNull();
    expect(stichtagAus("vor einem Jahr", HEUTE)).toBeNull();
  });

  it("überarbeitet seit dem Stichtag: alte Antwort aus Fassung 1, neue aus Fassung 2, Grund genannt", async () => {
    const b = await aufbau();
    const ko = await b.koService.create(ventil());
    b.am("2025-03-02T09:00:00.000Z");
    await b.validation.adminValidate(ko.id, "admin");
    b.am("2026-02-01T09:00:00.000Z");
    await b.koService.revise(
      ko.id,
      { statement: "Bei Überdruck Ventil Y automatisch schließen lassen." },
      "anna",
    );
    b.am("2026-02-02T09:00:00.000Z");
    await b.validation.adminValidate(ko.id, "admin");

    const v = await b.vergleiche();
    expect(v.damals.answered).toBe(true);
    expect(v.damals.answer).toContain("Ventil X manuell");
    expect(v.heute.answered).toBe(true);
    expect(v.heute.answer).toContain("Ventil Y automatisch");
    expect(v.antwortGeaendert).toBe(true);
    expect(v.quellen).toHaveLength(1);
    const quelle = v.quellen[0];
    expect(quelle?.versionDamals).toBe(1);
    expect(quelle?.versionHeute).toBe(2);
    expect(quelle?.gruende).toEqual(["ueberarbeitet"]);
    expect(quelle?.inAntwortDamals).toBe(true);
    expect(quelle?.inAntwortHeute).toBe(true);
    expect(quelle?.aussageDamals).toBe("Bei Überdruck Ventil X manuell schließen.");
    expect(quelle?.aussageHeute).toBe("Bei Überdruck Ventil Y automatisch schließen lassen.");
    expect(quelle?.aenderungen.map((a) => a.version)).toEqual([2]);
  });

  it("BEN Nacharbeit 4: Fragebegriffe seither entfernt — die damals passende Fassung trägt trotzdem", async () => {
    const b = await aufbau();
    const ko = await b.koService.create(ventil());
    b.am("2025-03-02T09:00:00.000Z");
    await b.validation.adminValidate(ko.id, "admin");
    b.am("2026-02-01T09:00:00.000Z");
    await b.koService.revise(
      ko.id,
      {
        title: "Absperrorgan bei Drucküberschreitung schließen",
        statement: "Absperrorgan Y automatisch schließen lassen.",
      },
      "anna",
    );
    b.am("2026-02-02T09:00:00.000Z");
    await b.validation.adminValidate(ko.id, "admin");

    // Kalibrierung: die HEUTIGE Suche findet das Objekt mit dieser Frage nicht mehr.
    const heuteGesucht = await b.koService.findCandidates({ terms: queryTokens(FRAGE), limit: 50 });
    expect(heuteGesucht.map((k) => k.id)).not.toContain(ko.id);

    const v = await b.vergleiche();
    expect(v.damals.answered).toBe(true);
    expect(v.damals.answer).toContain("Ventil X manuell");
    expect(v.heute.answered).toBe(false);
    expect(v.antwortGeaendert).toBe(true);
    const quelle = v.quellen.find((q) => q.id === ko.id);
    expect(quelle?.gruende).toEqual(["ueberarbeitet"]);
    expect(quelle?.inAntwortDamals).toBe(true);
    expect(quelle?.inAntwortHeute).toBe(false);
    expect(quelle?.versionDamals).toBe(1);
    expect(quelle?.titelDamals).toBe("Ventil bei Überdruck schließen");
  });

  it("BEN Nacharbeit 4: die Nachsuche über Fassungen hält Sichtbarkeit und Vertraulichkeit ein", async () => {
    const b = await aufbau();
    const fremd = await b.koService.create(ventil({ author: "bert" }));
    const vertraulich = await b.koService.create(
      ventil({ title: "Ventil bei Überdruck — Werk Nord", confidentiality: "vertraulich" }),
    );
    b.am("2025-03-02T09:00:00.000Z");
    await b.validation.adminValidate(fremd.id, "admin");
    await b.validation.adminValidate(vertraulich.id, "admin");
    b.am("2026-02-01T09:00:00.000Z");
    for (const ko of [fremd, vertraulich]) {
      await b.koService.revise(
        ko.id,
        { title: "Absperrorgan", statement: "Ohne Begriff." },
        "bert",
      );
    }

    const v = await b.vergleiche((ko) => ko.author !== "bert");
    const ids = [...v.damals.sources, ...v.heute.sources, ...v.quellen.map((q) => q.id)];
    expect(ids).not.toContain(fremd.id);
    expect(ids).not.toContain(vertraulich.id);
    expect(v.damals.answered).toBe(false);
  });

  it("Freigabe erst nach dem Stichtag: damals keine Grundlage, Grund ist die fehlende Freigabe", async () => {
    const b = await aufbau();
    const ko = await b.koService.create(ventil());
    b.am("2026-01-15T09:00:00.000Z");
    await b.validation.adminValidate(ko.id, "admin");

    const v = await b.vergleiche();
    expect(v.damals.answered).toBe(false);
    expect(v.heute.answered).toBe(true);
    expect(v.antwortGeaendert).toBe(true);
    expect(v.quellen.map((q) => q.gruende)).toEqual([["freigabe_damals_unbelegt"]]);
    // Ungeprüfter Inhalt erscheint nie als Kernaussage: damals war die Fassung nicht Grundlage.
    expect(v.quellen[0]?.aussageDamals).toBeNull();
  });

  it("erst nach dem Stichtag erfasst: als neu benannt", async () => {
    const b = await aufbau();
    b.am("2026-01-10T09:00:00.000Z");
    const ko = await b.koService.create(ventil());
    await b.validation.adminValidate(ko.id, "admin");

    const v = await b.vergleiche();
    expect(v.damals.answered).toBe(false);
    expect(v.quellen.map((q) => q.gruende)).toEqual([["neu_seit_stichtag"]]);
    expect(v.quellen[0]?.versionDamals).toBeNull();
  });

  it("unverändert und damals schon freigegeben: dieselbe Antwort, kein erfundener Unterschied", async () => {
    const b = await aufbau();
    const ko = await b.koService.create(ventil());
    b.am("2025-03-02T09:00:00.000Z");
    await b.validation.adminValidate(ko.id, "admin");

    const v = await b.vergleiche();
    expect(v.damals.answer).toBe(v.heute.answer);
    expect(v.antwortGeaendert).toBe(false);
    expect(v.quellen.map((q) => q.gruende)).toEqual([["unveraendert"]]);
    expect(v.quellen[0]?.aussageDamals).toBeNull();
  });

  it("Grenzen des Konsolenwegs gelten auch für damals: Vertrauliches und Unsichtbares bleiben draussen", async () => {
    const b = await aufbau();
    const vertraulich = await b.koService.create(
      ventil({ title: "Ventil bei Überdruck — Werk Nord", confidentiality: "vertraulich" }),
    );
    const fremd = await b.koService.create(
      ventil({ title: "Ventil bei Überdruck — Werk Süd", author: "bert" }),
    );
    b.am("2025-03-02T09:00:00.000Z");
    await b.validation.adminValidate(vertraulich.id, "admin");
    await b.validation.adminValidate(fremd.id, "admin");

    const v = await b.vergleiche((ko) => ko.author !== "bert");
    const ids = [...v.damals.sources, ...v.heute.sources, ...v.quellen.map((q) => q.id)];
    expect(ids).not.toContain(vertraulich.id);
    expect(ids).not.toContain(fremd.id);
  });

  it("keine Nebenwirkung wie eine Frage: keine Wissenslücke, nur ein Protokolleintrag ohne Fragetext", async () => {
    const b = await aufbau();
    await b.vergleiche();
    expect(await b.ask.listGaps()).toEqual([]);
    const eintraege = await b.audit.list({ action: "ask.vergleich" });
    expect(eintraege).toHaveLength(1);
    expect(JSON.stringify(eintraege[0]?.payload)).not.toContain("Überdruck");
  });

  it("fehlt das Versionsabbild der damaligen Fassung, gilt sie als nicht belegt — nichts wird ersetzt", async () => {
    const b = await aufbau();
    const ko = await b.koService.create(ventil());
    b.am("2026-02-01T09:00:00.000Z");
    const heute = await b.koService.revise(ko.id, { statement: "Neu." }, "anna");
    expect(fassungZumStichtag(heute, [], STICHTAG)).toEqual({ art: "fassung_unbelegt" });
    const mitAbbild = fassungZumStichtag(heute, await b.versions.listByKo(ko.id), STICHTAG);
    expect(mitAbbild.art === "fassung" ? mitAbbild.version : null).toBe(1);
  });

  it("eine Freigabe zählt nur für ihre Fassung und nur vor dem Stichtag", async () => {
    const b = await aufbau();
    const ko = await b.koService.create(ventil());
    b.am("2025-03-02T09:00:00.000Z");
    await b.validation.adminValidate(ko.id, "admin");
    const protokoll = await b.audit.list({ target: ko.id });
    const jetzt = await b.koService.get(ko.id);
    if (!jetzt) {
      throw new Error("KO fehlt");
    }
    expect(freigabeZumStichtagBelegt(jetzt, 1, protokoll, STICHTAG)).toBe(true);
    expect(freigabeZumStichtagBelegt(jetzt, 2, protokoll, STICHTAG)).toBe(false);
    expect(
      freigabeZumStichtagBelegt(jetzt, 1, protokoll, Date.parse("2025-03-01T12:00:00.000Z")),
    ).toBe(false);
  });
});
