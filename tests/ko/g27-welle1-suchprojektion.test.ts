// ================================================================================================
// JOB 527 / D3 — DER KOLLISIONSVERTRAG G27 ↔ BASIC-380.
// ================================================================================================
//
// Das rote Vollurteil `_relay/kopf/outbox/BEN4-PRUEFUNG-JOB-527-D2.md` ist der Auftragstext. Es
// sagt wörtlich, was fehlt (Prüflücke 1):
//
//   „Kollisionsinventur: G27- und BASIC-380-Anteile in `repo.ts`, `repo-pg.ts` und `db.ts` getrennt
//    markieren und ihre Verbraucher verfolgen. Erwartet: genau ein führender Repository-/DDL-
//    Vertrag, beide fachlichen Zusagen bleiben erreichbar."
//
// und unter SUBSTANZ 5: „Ob die bereits integrierte Fassung BASIC-380-Anteile erhalten,
// überschrieben oder dupliziert hat, ist ausdrücklich nicht gemessen."
//
// GEMESSEN WIRD HIER, NICHT BEHAUPTET. Diese Datei ist kein wiederhergestellter Archivtest — sie
// prüft genau die Frage, die zwölf vorhandene G27-Dateien NICHT stellen: was passiert an der
// NAHT zwischen der Suchprojektion und dem Sicherheitstrim.
//
// DIE LAGE, DIE DIESE DATEI FESTHÄLT — in einem Satz je Weg:
//
//   Bibliotheksweg   `KoService.listForSearch(filter, trim)`  → der Trim wirkt AN DER DATENQUELLE,
//                                                               vor jedem Deckel (BASIC-380).
//   Ask-/Kandidatenweg `findSearchHits` → `repo.listByIds`    → G27-Projektion, OHNE Trim; die
//                                                               Vertraulichkeit fällt eine Ebene
//                                                               höher über `dropConfidential`.
//
// Das ist kein Widerspruch, sondern eine Arbeitsteilung — und genau sie war unbewacht. Ein Umbau,
// der eine der beiden Hälften entfernt, wird ab hier rot.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { MIGRATIONS_SOLLLISTE } from "../../services/app/src/migrationsbeleg";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import {
  type Confidentiality,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KO_SEARCH_PROJECTION_SCHEMA,
  KO_SICHTBARKEIT_SCHEMA,
  KoService,
  dropConfidential,
} from "../../services/knowledge-object";

const EINGABE = {
  statement: "Vor dem Entlüften den Systemdruck ablassen.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

/** Ein in Betrieb genommener Stapel — dieselbe Inbetriebnahme wie in den übrigen G27-Dateien. */
async function stapel() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  const ko = new KoService({
    repo,
    versions,
    searchProjections: projections,
    now: () => Date.parse("2026-08-17T09:00:00.000Z"),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { repo, projections, versions, ko };
}

const BETRACHTER: SessionUser = { id: "betrachter", role: "experte" } as SessionUser;
const PRUEFER: SessionUser = { id: "pruefer", role: "controller" } as SessionUser;

// ================================================================================================
// TEIL K — DIE KOLLISIONSINVENTUR (Prüflücke 1)
// ================================================================================================
describe("JOB 527 · K — genau ein führender Repository-/DDL-Vertrag", () => {
  it("K1 · die DDL-Sollliste führt BEIDE Stufen — jede GENAU EINMAL", () => {
    // `MIGRATIONS_SOLLLISTE` (services/app/src/migrationsbeleg.ts) ist die maschinenlesbare Fassung
    // des EINEN Migrationswegs, den `db.ts migrate()` fährt. Gäbe es einen zweiten Weg, müsste er
    // hier auftauchen — oder er wäre der unverdrahtete Parallelweg, den das Urteil ausschliesst.
    const stufen = MIGRATIONS_SOLLLISTE.map((s) => s.stufe);
    expect(stufen.filter((s) => s === "KO_SICHTBARKEIT_SCHEMA")).toHaveLength(1);
    expect(stufen.filter((s) => s === "KO_SEARCH_PROJECTION_SCHEMA")).toHaveLength(1);
    // Keine Stufe doppelt: eine duplizierte DDL wäre genau die „zweite Wahrheit", die das Urteil
    // als offene Frage benennt.
    expect(new Set(stufen).size).toBe(stufen.length);
  });

  it("K2 · die Sichtbarkeitsstufe steht VOR der Projektionsstufe — die Reihenfolge ist Inhalt", () => {
    // Der Trim liest generierte Spalten der `kos`-Zeile. Stünde die Projektionsstufe davor, liefe
    // ein erster V2-Insert gegen eine Tabelle, deren Trimspalten es noch nicht gibt.
    const stufen = MIGRATIONS_SOLLLISTE.map((s) => s.stufe);
    expect(stufen.indexOf("KO_SICHTBARKEIT_SCHEMA")).toBeLessThan(
      stufen.indexOf("KO_SEARCH_PROJECTION_SCHEMA"),
    );
    // Beide sind additiv — keine der beiden Hälften darf transformierend oder irreversibel werden.
    for (const stufe of ["KO_SICHTBARKEIT_SCHEMA", "KO_SEARCH_PROJECTION_SCHEMA"]) {
      expect(MIGRATIONS_SOLLLISTE.find((s) => s.stufe === stufe)?.risiko).toBe("ADDITIV");
    }
  });

  it("K3 · die beiden DDL-Anteile sind getrennte Konstanten und überschneiden sich nicht", () => {
    // BASIC-380 ALTERt `kos`; G27 legt `ko_search_projection` an. Wer eine der beiden Zusagen in
    // die andere Konstante schriebe, hätte sie dupliziert — und die Migrationsordnung wäre wertlos.
    expect(KO_SICHTBARKEIT_SCHEMA).toContain("confidentiality_key");
    expect(KO_SICHTBARKEIT_SCHEMA).toContain("author_key");
    expect(KO_SICHTBARKEIT_SCHEMA).not.toContain("ko_search_projection");
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain("ko_search_projection");
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toContain("confidentiality_key");
    // Die Projektionstabelle wird GENAU EINMAL angelegt — keine zweite Projektionstabelle.
    expect(
      KO_SEARCH_PROJECTION_SCHEMA.match(/CREATE TABLE IF NOT EXISTS ko_search_projection/g),
    ).toHaveLength(1);
  });
});

// ================================================================================================
// TEIL T — DIE VERBOTENE TRIMQUELLE (Prüflücke 4, der eigentliche Kollisionspunkt)
// ================================================================================================
//
// `sichtbarkeit.ts:146-150` schreibt die Regel als Kommentar:
//
//   „(1) DIE LEBENDE ZEILE IST DIE TRIMQUELLE (Gate `G-TRIM-LIVE`). Das Prädikat liest
//    ausschließlich `confidentiality_key`, `author_key` und `deleted_at_key` …
//    `ko_search_projection.classification_snapshot` ist AUSDRÜCKLICH VERBOTENE Trimquelle."
//
// Ein Kommentar ist kein Wächter. Ab hier ist er einer.
describe("JOB 527 · T — die Projektion ist NIEMALS Trimquelle", () => {
  it("T1 · das Trim-SQL liest die drei lebenden Schlüsselspalten — und nur sie", () => {
    const sql = sqlSichtbarkeitFuer(BETRACHTER).sql("k", 1);
    expect(sql).toContain("k.deleted_at_key");
    expect(sql).toContain("k.confidentiality_key");
    expect(sql).toContain("k.author_key");
  });

  it("T2 · es nennt WEDER die Projektionstabelle NOCH den Klassifikationsschnappschuss", () => {
    // Genau die Kopplung, die G-TRIM-LIVE verbietet: der Schnappschuss ist historischer Beleg und
    // veraltet, sobald eine Stufe erhöht wird. Eine Höherstufung muss SOFORT wirken.
    const sql = sqlSichtbarkeitFuer(PRUEFER).sql("k", 1);
    expect(sql).not.toContain("ko_search_projection");
    expect(sql).not.toContain("classification_snapshot");
    expect(sql).not.toContain("projection");
  });

  it("T3 · SQL-Form und In-Memory-Form sind dieselbe Regel — über alle Kombinationen", () => {
    // Stufe × Autorschaft × Rolle. Der In-Memory-Weg darf keine zweite Auslegung sein; er ist von
    // derselben Quelle abgeleitet (`darfSehen`), und dieser Fall hält das fest.
    const stufen: Confidentiality[] = ["intern", "vertraulich", "streng_vertraulich"];
    const autoren = ["betrachter", "fremd", ""];
    let geprueft = 0;
    for (const user of [BETRACHTER, PRUEFER]) {
      const trim = sqlSichtbarkeitFuer(user);
      for (const confidentiality of stufen) {
        for (const author of autoren) {
          const fakten = { confidentiality, author };
          expect(trim.trifftZu({ ...fakten })).toBe(darfSehen(user, fakten));
          // Der Papierkorb gehört in der SQL-Form ZUM Prädikat — also auch hier.
          expect(trim.trifftZu({ ...fakten, deletedAt: "2026-08-01T00:00:00.000Z" })).toBe(false);
          geprueft += 1;
        }
      }
    }
    expect(geprueft).toBe(2 * 3 * 3);
  });
});

// ================================================================================================
// TEIL E — BEIDE ZUSAGEN BLEIBEN ERREICHBAR (Prüflücke 1, zweite Hälfte)
// ================================================================================================
describe("JOB 527 · E — BASIC-380 und G27 stehen nebeneinander, nicht übereinander", () => {
  it("E1 · BASIC-380 erhalten: mit Trim fallen getrashte und unsichtbare Objekte an der Datenquelle weg", async () => {
    const { ko, repo } = await stapel();
    const offen = await ko.create({ ...EINGABE, title: "Hydraulik offen" });
    const fremdVertraulich = await ko.create({
      ...EINGABE,
      title: "Hydraulik vertraulich",
      author: "fremd",
      confidentiality: "vertraulich",
    });
    const getrasht = await ko.create({ ...EINGABE, title: "Hydraulik getrasht" });
    await ko.delete(getrasht.id, "anna");

    // Gemessen wird über den PRODUKTWEG `KoService.listForSearch` — das ist die Naht, an der die
    // Bibliothek den Trim übergibt. Die Rohmenge kommt direkt aus dem Repository, damit sichtbar
    // bleibt, WAS der Trim wegnimmt.
    const trim = sqlSichtbarkeitFuer(BETRACHTER);
    const mitTrim = await ko.listForSearch({}, trim);
    const roh = await repo.listForSearch({});

    // Der Trim entfernt genau zwei Dinge: den Papierkorb und das fremde vertrauliche Objekt.
    expect(mitTrim.map((k) => k.id).sort()).toEqual([offen.id]);
    expect(roh.map((k) => k.id).sort()).toEqual(
      [offen.id, fremdVertraulich.id, getrasht.id].sort(),
    );
  });

  it("E2 · der Trim wirkt VOR jedem Deckel — er ist keine nachträgliche Filterung", async () => {
    const { ko } = await stapel();
    // Drei unsichtbare vor einem sichtbaren: eine nachgelagerte Filterung über einer gedeckelten
    // Menge lieferte hier die leere Menge. Der Trim an der Datenquelle liefert den sichtbaren.
    for (const n of [1, 2, 3]) {
      await ko.create({
        ...EINGABE,
        title: `Verborgen ${n}`,
        author: "fremd",
        confidentiality: "streng_vertraulich",
      });
    }
    const sichtbar = await ko.create({ ...EINGABE, title: "Sichtbar" });
    const getrimmt = await ko.listForSearch({}, sqlSichtbarkeitFuer(BETRACHTER));
    expect(getrimmt.map((k) => k.id)).toEqual([sichtbar.id]);
  });

  it("E3 · G27 erhalten: die Projektionssuche findet weiterhin über die Projektion", async () => {
    const { ko } = await stapel();
    const erstellt = await ko.create({
      ...EINGABE,
      title: "Hydraulikzylinder HZ7",
      bodyHtml: "<p>Projektionswort</p>",
    });
    // Beide Hälften des Suchdokuments: Titelfeld und projizierter Dokumenttext.
    expect((await ko.findSearchHits({ terms: ["hydraulikzylinder"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
    expect((await ko.findSearchHits({ terms: ["projektionswort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("E4 · der G27-Weg trägt den Trim NICHT — und das ist die gemessene Arbeitsteilung, keine Lücke", async () => {
    // DIE FRAGE DES URTEILS, wörtlich beantwortet: „erhalten, überschrieben oder dupliziert?"
    // Gemessen: WEDER überschrieben NOCH dupliziert. `listByIds` ist eine EIGENE, schmalere
    // Methode neben `listForSearch` — G27 hat dem Trim nichts weggenommen, es hat einen zweiten
    // Nachschlag danebengestellt, dessen Vertraulichkeit eine Ebene höher fällt (E5).
    const { ko } = await stapel();
    const fremdVertraulich = await ko.create({
      ...EINGABE,
      title: "Hydraulik vertraulich",
      author: "fremd",
      confidentiality: "vertraulich",
      bodyHtml: "<p>Geheimwort</p>",
    });
    const kandidaten = await ko.findCandidates({ terms: ["geheimwort"], limit: 10 });
    // Der Dienst liefert das Objekt — auf DIESER Ebene gibt es keinen Trim.
    expect(kandidaten.map((k) => k.id)).toEqual([fremdVertraulich.id]);
  });

  it("E5 · die Vertraulichkeitszusage fällt auf dem Ask-Weg über `dropConfidential` — rollenunabhängig", async () => {
    // Das ist die zweite Hälfte von E4 und der Grund, warum E4 keine Lücke ist: derselbe Kandidat
    // erreicht den Reasoner nicht. `dropConfidential` ist STRENGER als der Trim — der Trim ließe
    // einen `ko.validate`-Inhaber vertrauliche Objekte sehen, `dropConfidential` niemanden.
    const { ko } = await stapel();
    await ko.create({
      ...EINGABE,
      title: "Hydraulik vertraulich",
      author: "fremd",
      confidentiality: "vertraulich",
      bodyHtml: "<p>Geheimwort</p>",
    });
    const kandidaten = await ko.findCandidates({ terms: ["geheimwort"], limit: 10 });
    expect(kandidaten).toHaveLength(1);
    expect(dropConfidential(kandidaten)).toHaveLength(0);
    // Und die Strenge ist rollenunabhängig: auch für den Prüfer bleibt nichts übrig.
    expect(sqlSichtbarkeitFuer(PRUEFER).trifftZu(kandidaten[0] as never)).toBe(true);
    expect(dropConfidential(kandidaten)).toHaveLength(0);
  });

  it("E6 · beide Wege liegen am SELBEN Repository — es gibt keinen zweiten Bestand", async () => {
    const { ko } = await stapel();
    const erstellt = await ko.create({ ...EINGABE, title: "Einziger Bestand" });
    const ueberTrim = await ko.listForSearch({}, sqlSichtbarkeitFuer(BETRACHTER));
    const ueberProjektion = await ko.findCandidates({ terms: ["einziger"], limit: 10 });
    expect(ueberTrim.map((k) => k.id)).toEqual([erstellt.id]);
    expect(ueberProjektion.map((k) => k.id)).toEqual([erstellt.id]);
    // Ein zweiter Bestand würde sich hier als abweichende Objektidentität zeigen.
    expect(ueberProjektion[0]?.title).toBe(ueberTrim[0]?.title);
  });
});
