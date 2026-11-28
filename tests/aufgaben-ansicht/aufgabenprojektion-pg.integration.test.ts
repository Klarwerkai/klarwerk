import { Pool } from "pg";
import { expect, it } from "vitest";
import { sichtbareFuer, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import {
  InMemoryKoRepo,
  KO_SCHEMA,
  KO_SICHTBARKEIT_SCHEMA,
  type KnowledgeObject,
  PgKoRepo,
} from "../../services/knowledge-object";
import { oeffneIsoliertePg } from "../ko/pg-pruefplatz";

function ko(id: string, over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `T-${id}`,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "K",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
}

it("Aufgabenprojektion beider Adapter entspricht dem Vollbestand bei Altständen, Quellrechten, Spaces und Zusammenführung", async () => {
  const platz = await oeffneIsoliertePg("aufgabenprojektion");
  const pool = new Pool({ connectionString: platz.url });
  try {
    await pool.query(KO_SCHEMA);
    await pool.query(KO_SICHTBARKEIT_SCHEMA);
    const pg = new PgKoRepo(pool);
    const mem = new InMemoryKoRepo();
    const stand = [
      ko("z-zuerst", { author: "fehlend", confidentiality: "intern" }),
      ko("b-in-space", { author: "fehlend", spaceId: "geteilt", confidentiality: "intern" }),
      ko("c-eingeschraenkt", {
        author: "a",
        confidentiality: "intern",
        quellrechte: { stufe: "intern", leser: ["b"] },
      }),
      ko("d-altstufe", { author: "fehlend" }),
      ko("a-zuletzt", { confidentiality: "intern" }),
      Object.assign(ko("alt-nummer", { confidentiality: "intern" }), { author: 4359 }),
      Object.assign(ko("alt-unbekannt", { author: "fehlend" }), { confidentiality: "historisch" }),
      Object.assign(ko("alt-aktiv", { author: "fehlend", deletedAt: "" }), { mergedInto: null }),
      ko("e-geloescht", { confidentiality: "intern", deletedAt: "2026-10-02" }),
      ko("f-verschmolzen", {
        confidentiality: "intern",
        mergedInto: { koId: "a-zuletzt", version: 2, overlapId: "dup", at: "2026-10-02", by: "a" },
      }),
    ];
    for (const k of stand) {
      k.bodyHtml = "<p>Nur im Vollbestand</p>";
      await pg.insert(k);
      await mem.insert(k);
    }
    const nutzer = [
      { id: "a", role: "experte" },
      { id: "b", role: "admin", spaceLesbar: new Set(["geteilt"]) },
    ] as const;
    for (const user of nutzer) {
      const trim = sqlSichtbarkeitFuer(user);
      const alle = sichtbareFuer(
        user,
        (await pg.list({}, trim)).filter((k) => !k.deletedAt && !k.mergedInto),
      );
      for (const auswahl of [
        { objektIds: [] },
        {
          objektIds: ["a-zuletzt", "z-zuerst", "c-eingeschraenkt", "e-geloescht", "f-verschmolzen"],
        },
        { objektIds: ["a-zuletzt", "c-eingeschraenkt"], erreichbareAutoren: ["a", "b", "4359"] },
        { objektIds: [], erreichbareAutoren: [] },
      ]) {
        const erwartet = alle
          .filter(
            (k) =>
              auswahl.objektIds.includes(k.id) ||
              (auswahl.erreichbareAutoren && !auswahl.erreichbareAutoren.includes(k.author)),
          )
          .map((k) => k.id);
        const a = await pg.listAufgabenKandidaten(auswahl, trim);
        const b = await mem.listAufgabenKandidaten(auswahl, trim);
        expect(a.map((k) => k.id)).toEqual(erwartet);
        expect(a).toEqual(b);
        for (const k of a) {
          expect(
            Object.keys(k).every((key) =>
              ["id", "author", "category", "quellrechte", "spaceId", "confidentiality"].includes(
                key,
              ),
            ),
          ).toBe(true);
        }
      }
    }
  } finally {
    try {
      await pool.end();
    } finally {
      await platz.abraeumen();
    }
  }
}, 120_000);
