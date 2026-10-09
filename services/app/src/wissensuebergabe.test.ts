// ================================================================================================
// R-0554 / R-2128 — DIE WISSENSÜBERGABE AM MODUL, MIT DEN ECHTEN SPEICHERABLAGEN.
// ================================================================================================
//
// „Verlässt jemand das Haus, wandern seine Wissensobjekte, Entwürfe, Lücken und Prüfaufgaben in
// einem Zug an einen Nachfolger, mit Vorschau und Protokoll." Geprüft wird an denselben Diensten
// und Ablagen, die die Kompositionswurzel verdrahtet (KoService, LifecycleService, DraftRepo,
// GapRepo, AssignmentRepo, AuditService) — nicht an Attrappen.
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { type Draft, InMemoryDraftRepo } from "../../capture";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../knowledge-object";
import { InMemoryLifecycleRepo, LifecycleService } from "../../lifecycle";
import { InMemoryAssignmentRepo } from "../../validation";
import { Wissensuebergabe, type WissensuebergabeQuellen } from "./wissensuebergabe";

const ANNA = "anna-geht";
const BERT = "bert-nachfolger";
const CLARA = "clara-bleibt";
const ADMIN = "admin-1";

interface Luecke {
  id: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
}

function entwurf(id: string, autor: string): Draft {
  return {
    id,
    payload: { title: `Entwurf ${id}` },
    originalAuthor: autor,
    lastEditor: autor,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
  };
}

async function aufbau() {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ko = new KoService({ repo: new InMemoryKoRepo(), audit });
  const lifecycle = new LifecycleService({ koService: ko, repo: new InMemoryLifecycleRepo() });
  const drafts = new InMemoryDraftRepo();
  const assignments = new InMemoryAssignmentRepo();
  const luecken: Luecke[] = [
    { id: "gap-anna-offen", status: "offen", assignee: ANNA },
    { id: "gap-anna-zu", status: "geschlossen", assignee: ANNA },
    { id: "gap-clara", status: "offen", assignee: CLARA },
  ];
  const konten = new Set([ANNA, BERT, CLARA, ADMIN]);

  const neu = (titel: string, autor: string): Promise<KnowledgeObject> =>
    ko.create({
      title: titel,
      statement: `${titel}.`,
      type: "best_practice",
      category: "Anlage 1",
      author: autor,
    });
  const vonAnna = await neu("Von Anna verfasst", ANNA);
  const annaVerantwortet = await neu("Clara verfasst, Anna verantwortet", CLARA);
  await ko.setOwnership(
    annaVerantwortet.id,
    { owner: ANNA, reviewers: ["paula"], validators: ["victor"] },
    ADMIN,
  );
  const vonClara = await neu("Nur Clara", CLARA);

  await drafts.insert(entwurf("d-anna", ANNA));
  await drafts.insert(entwurf("d-clara", CLARA));
  // Ein gelöschter Entwurf ist keine laufende Arbeit — er bleibt im Papierkorb, wo er ist.
  await drafts.insert(entwurf("d-anna-papierkorb", ANNA));
  await drafts.delete("d-anna-papierkorb", ANNA, "2026-10-02T08:00:00.000Z");

  await assignments.create({ koId: vonClara.id, userId: ANNA, status: "open" });
  await assignments.create({ koId: vonAnna.id, userId: ANNA, status: "done" });
  // Bert hat dieselbe Prüfaufgabe schon — es darf keine zweite entstehen.
  await assignments.create({ koId: annaVerantwortet.id, userId: ANNA, status: "open" });
  await assignments.create({ koId: annaVerantwortet.id, userId: BERT, status: "open" });

  const quellen: WissensuebergabeQuellen = {
    kos: () => ko.list(),
    kosEinschliesslichPapierkorb: () => ko.listEinschliesslichPapierkorb(),
    uebertrageVerantwortung: (koId, erwartet, nachfolger, actor) =>
      ko.uebertrageVerantwortung(koId, erwartet, nachfolger, actor),
    setAuthor: (koId, to, actor) => lifecycle.transferAuthor(koId, to, actor),
    setOwnership: (koId, value, actor) => ko.setOwnership(koId, value, actor),
    drafts,
    gaps: async () => luecken.map((l) => ({ ...l })),
    assignGap: async (gapId, to) => {
      const l = luecken.find((x) => x.id === gapId);
      if (!l) {
        throw new Error("Lücke fehlt");
      }
      l.assignee = to;
    },
    assignments: {
      all: () => assignments.all(),
      find: (k, u) => assignments.find(k, u),
      create: (z) => assignments.create(z),
      remove: (k, u) => assignments.remove(k, u),
    },
    audit,
    nachfolgerBekannt: async (id) => konten.has(id),
    now: () => new Date("2026-10-08T10:00:00.000Z"),
  };
  return {
    audit,
    ko,
    drafts,
    assignments,
    luecken,
    quellen,
    uebergabe: new Wissensuebergabe(quellen),
    ids: { vonAnna: vonAnna.id, annaVerantwortet: annaVerantwortet.id, vonClara: vonClara.id },
  };
}

describe("R-0554 · Wissensübergabe beim Ausscheiden", () => {
  let w: Awaited<ReturnType<typeof aufbau>>;

  beforeEach(async () => {
    w = await aufbau();
  });

  it("U1 · die Vorschau nennt genau, was wandert — und schreibt nichts", async () => {
    const v = await w.uebergabe.vorschau(ANNA, BERT);
    expect(v.wissensobjekte).toEqual([{ id: w.ids.vonAnna, title: "Von Anna verfasst" }]);
    expect(v.eigentum).toEqual([
      { id: w.ids.annaVerantwortet, title: "Clara verfasst, Anna verantwortet" },
    ]);
    expect(v.entwuerfe).toEqual([{ id: "d-anna" }]);
    expect(v.luecken).toEqual([{ id: "gap-anna-offen" }]);
    expect(v.pruefaufgaben.map((z) => z.koId).sort()).toEqual(
      [w.ids.vonClara, w.ids.annaVerantwortet].sort(),
    );
    // Datensparsam: Entwürfe und Lücken nur als Kennung, ohne Inhalt.
    expect(JSON.stringify(v)).not.toContain("Entwurf d-anna");
    // Nichts geschrieben: Autor, Entwurf und Protokoll unverändert.
    expect((await w.ko.get(w.ids.vonAnna))?.author).toBe(ANNA);
    expect((await w.drafts.findById("d-anna"))?.originalAuthor).toBe(ANNA);
    expect((await w.audit.list()).some((e) => e.action === "lifecycle.handover")).toBe(false);
  });

  it("U2 · in einem Zug: Verantwortung wandert, ursprüngliche Urheberschaft bleibt", async () => {
    const e = await w.uebergabe.uebergeben(ANNA, BERT, ADMIN);
    expect(e.fehlgeschlagen).toEqual([]);
    expect(e.uebergeben).toEqual({
      wissensobjekt: 1,
      eigentum: 1,
      papierkorb: 0,
      entwurf: 1,
      luecke: 1,
      pruefaufgabe: 2,
    });

    // Wissensobjekt: Autor → Bert, Urheberin bleibt Anna (FR-LIF-02-Weg).
    const ko = await w.ko.get(w.ids.vonAnna);
    expect(ko?.author).toBe(BERT);
    expect(ko?.originalAuthor).toBe(ANNA);

    // Eigentum: Bert verantwortet, Prüf- und Freigabespur unverändert; Autor bleibt Clara.
    const verantwortet = await w.ko.get(w.ids.annaVerantwortet);
    expect(verantwortet?.ownership).toEqual({
      owner: BERT,
      reviewers: ["paula"],
      validators: ["victor"],
    });
    expect(verantwortet?.author).toBe(CLARA);

    // Entwurf: gehört jetzt Bert, die Urheberin steht in `urheber`.
    const d = await w.drafts.findById("d-anna");
    expect(d?.originalAuthor).toBe(BERT);
    expect(d?.urheber).toBe(ANNA);
    expect((await w.drafts.findById("d-clara"))?.originalAuthor).toBe(CLARA);

    // Lücken: nur die offene wandert; die geschlossene ist Geschichte.
    expect(w.luecken.find((l) => l.id === "gap-anna-offen")?.assignee).toBe(BERT);
    expect(w.luecken.find((l) => l.id === "gap-anna-zu")?.assignee).toBe(ANNA);
    expect(w.luecken.find((l) => l.id === "gap-clara")?.assignee).toBe(CLARA);

    // Prüfaufgaben: offene wandern, keine doppelt, erledigte bleiben bei Anna.
    const alle = await w.assignments.all();
    expect(alle.filter((z) => z.userId === ANNA)).toEqual([
      { koId: w.ids.vonAnna, userId: ANNA, status: "done" },
    ]);
    expect(
      alle
        .filter((z) => z.userId === BERT)
        .map((z) => z.koId)
        .sort(),
    ).toEqual([w.ids.vonClara, w.ids.annaVerantwortet].sort());
  });

  it("U3 · das Protokoll: ein Vorgangsbeleg mit Mengen, dazu die Belege je Objekt", async () => {
    await w.uebergabe.uebergeben(ANNA, BERT, ADMIN);
    const eintraege = await w.audit.list();
    const vorgang = eintraege.filter((e) => e.action === "lifecycle.handover");
    expect(vorgang).toHaveLength(1);
    expect(vorgang[0]).toMatchObject({
      actor: ADMIN,
      target: ANNA,
      payload: {
        from: ANNA,
        to: BERT,
        transferred: { wissensobjekt: 1, eigentum: 1, entwurf: 1, luecke: 1, pruefaufgabe: 2 },
        failed: [],
      },
    });
    expect(
      eintraege.some(
        (e) =>
          e.action === "ko.author-transferred" && e.target === w.ids.vonAnna && e.actor === ADMIN,
      ),
    ).toBe(true);
    expect(
      eintraege.some((e) => e.action === "ko.ownership" && e.target === w.ids.annaVerantwortet),
    ).toBe(true);
    expect(await w.audit.verify()).toBe(true);
  });

  it("U4 · wiederholbar: ein zweiter Lauf findet nichts mehr", async () => {
    await w.uebergabe.uebergeben(ANNA, BERT, ADMIN);
    const v = await w.uebergabe.vorschau(ANNA, BERT);
    expect(
      v.wissensobjekte.length +
        v.eigentum.length +
        v.entwuerfe.length +
        v.luecken.length +
        v.pruefaufgaben.length,
    ).toBe(0);
    // Ein zweiter Durchgang überschreibt die Urheberin des Entwurfs NICHT mit Bert.
    await w.uebergabe.uebergeben(BERT, CLARA, ADMIN);
    expect((await w.drafts.findById("d-anna"))?.urheber).toBe(ANNA);
    expect((await w.ko.get(w.ids.vonAnna))?.originalAuthor).toBe(ANNA);
  });

  it("U5 · ein gescheiterter Schritt bricht den Zug nicht ab und wird benannt", async () => {
    const mitFehler = new Wissensuebergabe({
      ...w.quellen,
      assignGap: async () => {
        throw new Error("Ablage nicht erreichbar");
      },
    });
    const e = await mitFehler.uebergeben(ANNA, BERT, ADMIN);
    expect(e.fehlgeschlagen).toEqual([
      { art: "luecke", id: "gap-anna-offen", grund: "Ablage nicht erreichbar" },
    ]);
    expect(e.uebergeben.wissensobjekt).toBe(1);
    expect(e.uebergeben.pruefaufgabe).toBe(2);
    const vorgang = (await w.audit.list()).find((x) => x.action === "lifecycle.handover");
    expect(vorgang?.payload).toMatchObject({ failed: [{ art: "luecke", id: "gap-anna-offen" }] });
  });

  it("U7 · ein zwischenzeitlich gespeicherter Entwurf wird nicht überschrieben", async () => {
    const quellen: WissensuebergabeQuellen = {
      ...w.quellen,
      drafts: {
        listByAuthor: (autor) => w.drafts.listByAuthor(autor),
        // Zwischen Erhebung und Schreiben speichert Anna den Entwurf noch einmal.
        updateWennStand: async (neu, stand) => {
          const jetzt = await w.drafts.findById(neu.id);
          if (jetzt) {
            await w.drafts.update({ ...jetzt, updatedAt: "2026-10-08T09:59:59.000Z" });
          }
          return w.drafts.updateWennStand(neu, stand);
        },
      },
    };
    const e = await new Wissensuebergabe(quellen).uebergeben(ANNA, BERT, ADMIN);
    expect(e.fehlgeschlagen).toEqual([
      { art: "entwurf", id: "d-anna", grund: "Der Entwurf wurde zwischenzeitlich geändert." },
    ]);
    expect((await w.drafts.findById("d-anna"))?.originalAuthor).toBe(ANNA);
  });

  it("U8 · hat der Nachfolger dasselbe Objekt schon ERLEDIGT, bleibt die offene Aufgabe stehen", async () => {
    // Bert hat `vonClara` bereits geprüft (done); Anna hat dort eine offene Prüfaufgabe.
    await w.assignments.create({ koId: w.ids.vonClara, userId: BERT, status: "done" });
    const e = await w.uebergabe.uebergeben(ANNA, BERT, ADMIN);
    expect(e.fehlgeschlagen).toEqual([
      expect.objectContaining({ art: "pruefaufgabe", id: w.ids.vonClara }),
    ]);
    // Nur die auflösbare Aufgabe (annaVerantwortet, Bert offen) zählt als übergeben.
    expect(e.uebergeben.pruefaufgabe).toBe(1);
    // Annas offene Aufgabe besteht weiter, Berts erledigte bleibt erledigt — nichts ging verloren.
    expect(await w.assignments.find(w.ids.vonClara, ANNA)).toEqual({
      koId: w.ids.vonClara,
      userId: ANNA,
      status: "open",
    });
    expect((await w.assignments.find(w.ids.vonClara, BERT))?.status).toBe("done");
    const vorgang = (await w.audit.list()).find((x) => x.action === "lifecycle.handover");
    expect(vorgang?.payload).toMatchObject({
      failed: [{ art: "pruefaufgabe", id: w.ids.vonClara }],
    });
  });

  it("U9 · BEN (Nacharbeit 7): der Papierkorb steht in der Vorschau UND wird übergeben", async () => {
    // Ein von Anna verfasster Beitrag liegt im Papierkorb — sie ist dort hauptverantwortlich.
    const geloescht = await w.ko.create({
      title: "Alte Schmieranweisung",
      statement: "Veraltet.",
      type: "best_practice",
      category: "Anlage 1",
      author: ANNA,
    });
    await w.ko.delete(geloescht.id, ADMIN);
    expect((await w.ko.list()).some((k) => k.id === geloescht.id)).toBe(false);

    const v = await w.uebergabe.vorschau(ANNA, BERT);
    expect(v.papierkorb).toEqual([{ id: geloescht.id, title: "Alte Schmieranweisung" }]);
    // Lebende Mengen unberührt — der Papierkorb ist eine eigene Art, kein Autorwechsel.
    expect(v.wissensobjekte.map((k) => k.id)).toEqual([w.ids.vonAnna]);

    const e = await w.uebergabe.uebergeben(ANNA, BERT, ADMIN);
    expect(e.fehlgeschlagen).toEqual([]);
    // Vorschau und Ausführung decken sich: genau so viele wie angekündigt.
    expect(e.uebergeben.papierkorb).toBe(v.papierkorb.length);
    const nachher = (await w.ko.listEinschliesslichPapierkorb()).find((k) => k.id === geloescht.id);
    expect(nachher?.ownership?.owner).toBe(BERT);
    expect(nachher?.deletedAt).toBeTruthy();
    expect((await w.uebergabe.vorschau(ANNA, BERT)).papierkorb).toEqual([]);
  });

  it("U6 · ungültige Eingaben werden abgelehnt, bevor etwas gelesen wird", async () => {
    await expect(w.uebergabe.vorschau(ANNA, ANNA)).rejects.toMatchObject({ code: "INVALID" });
    await expect(w.uebergabe.vorschau("", BERT)).rejects.toMatchObject({ code: "INVALID" });
    await expect(w.uebergabe.uebergeben(ANNA, 42, ADMIN)).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(w.uebergabe.uebergeben(ANNA, "gibt-es-nicht", ADMIN)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await w.ko.get(w.ids.vonAnna))?.author).toBe(ANNA);
  });
});
