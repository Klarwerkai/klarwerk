// ================================================================================================
// JOB 1553 · D1 (H3 / SCRUM-550+551) — DER QUALITAETSBLICK AUFS NETZ.
// ================================================================================================
//
// WAS „QUALITAET" HIER HEISST, IST NICHT ERFUNDEN, SONDERN AUS DEM HAUS BELEGT. Es gibt genau
// einen Praezedenzfall fuer eine Kennzahl in diesem Modul: `KoService.aiCheckCoverageSummary`
// (`service.ts:2730`). Er traegt vier Entscheidungen, die hier uebernommen werden:
//
//  1. `sichtbar` ist PFLICHT, nicht optional (`:2730-2732`). Begruendung im Quelltext (`:2726-2729`):
//     die Zaehler haengen algebraisch zusammen, "jedes vertrauliche Nicht-Demo-KO erhoehte `total`
//     und genau einen Zustandszaehler. Bei `total: 1` war die Existenz unmittelbar belegt (ben,
//     sammel72). Gefiltert wird die GRUNDMENGE."
//  2. Demo-Bestand faellt aus der Grundmenge (`:2733` `!ko.demoSeed`).
//  3. "BEWUSST SO SCHMAL WIE MOEGLICH … drei Zaehler, keine Objektdaten, keine Titel, keine IDs."
//  4. Verschiedene Aussagen bekommen VERSCHIEDENE Zaehler und werden nicht verschmolzen (`:2723`).
//
// WAS DAS NETZ HEUTE UEBER SICH SELBST SAGT: genau eine Zahl, `KantenRepo.anzahl()`
// (`kanten-repo.ts:93`) — und die ist UNGETRIMMT ("fuer Pruefstaende und Zaehler"). Fuer einen
// Qualitaetsblick ist sie damit unbrauchbar: sie zaehlt Beziehungen, die die Rolle nicht sehen darf.
//
// WAS HIER NICHT ENTSTEHT — und warum nicht: "Kanten auf geloeschte Objekte" laesst sich NICHT
// bauen. `alsAnsicht` (`kanten-service.ts:180-189`) macht widerrufen, unaufloesbar und unsichtbar
// AUSDRUECKLICH ununterscheidbar; eine Zahl darueber waere genau die Auskunft, die diese
// Ununterscheidbarkeit verhindert.
import { describe, expect, it } from "vitest";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import type { Confidentiality } from "../../services/knowledge-object";
import { DeduplizierenderKantenBestand } from "../../services/knowledge-object/src/kanten-repo";
import { netzQualitaet } from "../../services/knowledge-object/src/kanten-service";
import type { KuratierteKante } from "../../services/knowledge-object/src/kanten-types";

const EXPERTIN = sichtbarkeitsfilterFuer({ id: "expertin-1", role: "experte" });
const CONTROLLERIN = sichtbarkeitsfilterFuer({ id: "controllerin-1", role: "controller" });

async function bestand() {
  const ko = new KoService({ repo: new InMemoryKoRepo() });
  const repo = new DeduplizierenderKantenBestand();
  const neuesKo = async (title: string, confidentiality: Confidentiality = "intern") =>
    (
      await ko.create({
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        tags: [],
        confidentiality,
      })
    ).id;
  const alle = { alle: async () => ko.list({}) };
  return { ko, repo, neuesKo, alle };
}

function kante(
  p: Partial<KuratierteKante> & { quelleId: string; zielId: string },
): KuratierteKante {
  return {
    id: `k-${p.quelleId}-${p.zielId}`,
    art: "ergaenzt",
    richtung: "ungerichtet",
    urheber: "u-mensch",
    gesetztAm: "2026-08-21T06:00:00.000Z",
    geaendertAm: "2026-08-21T06:00:00.000Z",
    status: "aktiv",
    version: 1,
    ...p,
  };
}

describe("JOB 1553 · SCRUM-550+551 · der Qualitaetsblick zaehlt ueber die getrimmte Grundmenge", () => {
  it("DER KERNFALL: vernetzt, verwaist und Kanten — jede Kante genau einmal", async () => {
    const { ko, repo, neuesKo, alle } = await bestand();
    const a = await neuesKo("Kaltstart");
    const b = await neuesKo("Vorwaermung");
    await neuesKo("Alleinstehend");
    await repo.setze(kante({ quelleId: a, zielId: b }));

    const q = await netzQualitaet({ repo, kos: ko, bestand: alle }, { sichtbar: CONTROLLERIN });

    expect(q.total).toBe(3);
    expect(q.vernetzt, "a und b").toBe(2);
    expect(q.verwaist, "der Alleinstehende").toBe(1);
    // Die Kante haengt an beiden Enden — gezaehlt wird sie EINMAL.
    expect(q.kanten).toBe(1);
    // Die algebraische Zusage aus dem Praezedenzfall: beide Zaehler ueber DERSELBEN Grundmenge.
    expect(q.vernetzt + q.verwaist).toBe(q.total);
  });

  it("N=1: die Grundmenge wird VOR dem Zaehlen getrimmt — keine Zahl ueber fremden Bestand", async () => {
    const { ko, repo, neuesKo, alle } = await bestand();
    const offen = await neuesKo("Offen");
    const geheim = await neuesKo("Geheim", "vertraulich");
    await repo.setze(kante({ quelleId: offen, zielId: geheim }));

    const fuerExpertin = await netzQualitaet(
      { repo, kos: ko, bestand: alle },
      { sichtbar: EXPERTIN },
    );
    const fuerControllerin = await netzQualitaet(
      { repo, kos: ko, bestand: alle },
      { sichtbar: CONTROLLERIN },
    );

    // Fuer die Expertin existiert das vertrauliche Objekt in KEINER Zahl — auch nicht in `total`.
    expect(fuerExpertin.total).toBe(1);
    expect(fuerExpertin.vernetzt + fuerExpertin.verwaist).toBe(1);

    // Und die Kante dorthin macht sie NICHT vernetzt: ihr einziger Nachbar ist unsichtbar.
    expect(fuerExpertin.verwaist).toBe(1);
    expect(fuerExpertin.vernetzt).toBe(0);
    expect(fuerExpertin.kanten).toBe(0);

    // KALIBRIERUNG: fuer die Controllerin ist beides da — sonst waere der Fall auch mit einer
    // Erhebung gruen, die schlicht nie etwas zaehlt.
    expect(fuerControllerin.total).toBe(2);
    expect(fuerControllerin.vernetzt).toBe(2);
    expect(fuerControllerin.kanten).toBe(1);
  });

  it("DEMO-BESTAND faellt aus der Grundmenge — und macht auch niemanden vernetzt", async () => {
    const { ko, repo, neuesKo } = await bestand();
    const echt = await neuesKo("Echt");
    const demo = await neuesKo("Demo");
    await repo.setze(kante({ quelleId: echt, zielId: demo }));

    // Derselbe Bestand, nur ist ein Objekt als Demo-Saat gekennzeichnet.
    const mitDemo = {
      alle: async () =>
        (await ko.list({})).map((k) => (k.id === demo ? { ...k, demoSeed: true } : k)),
    };

    const q = await netzQualitaet({ repo, kos: ko, bestand: mitDemo }, { sichtbar: CONTROLLERIN });

    expect(q.total, "nur das echte Objekt").toBe(1);
    // Der einzige Nachbar ist Demo — also ist das echte Objekt unvernetzt, nicht vernetzt.
    expect(q.vernetzt).toBe(0);
    expect(q.verwaist).toBe(1);
    expect(q.kanten).toBe(0);
  });

  it("DIE FLAECHE IST SCHMAL: vier Zahlen, keine Objektdaten, keine Kennung, kein Titel", async () => {
    const { ko, repo, neuesKo, alle } = await bestand();
    const a = await neuesKo("Kaltstart");
    const b = await neuesKo("Geheim", "vertraulich");
    await repo.setze(kante({ quelleId: a, zielId: b }));

    const q = await netzQualitaet({ repo, kos: ko, bestand: alle }, { sichtbar: CONTROLLERIN });
    const text = JSON.stringify(q);

    expect(Object.keys(q).sort()).toEqual(["kanten", "total", "vernetzt", "verwaist"]);
    // Weder Kennungen noch Titel reisen mit — dieselbe Zusage wie im Praezedenzfall.
    expect(text).not.toContain(a);
    expect(text).not.toContain(b);
    expect(text).not.toContain("Kaltstart");
    expect(text).not.toContain("Geheim");
  });

  it("EIN OBJEKT MIT MEHREREN KANTEN ist EINMAL vernetzt, seine Kanten zaehlen einzeln", async () => {
    const { ko, repo, neuesKo, alle } = await bestand();
    const mitte = await neuesKo("Mitte");
    const links = await neuesKo("Links");
    const rechts = await neuesKo("Rechts");
    await repo.setze(kante({ quelleId: mitte, zielId: links, id: "k-l" }));
    await repo.setze(kante({ quelleId: mitte, zielId: rechts, id: "k-r" }));

    const q = await netzQualitaet({ repo, kos: ko, bestand: alle }, { sichtbar: CONTROLLERIN });

    expect(q.total).toBe(3);
    expect(q.vernetzt, "alle drei haengen am Netz").toBe(3);
    expect(q.verwaist).toBe(0);
    expect(q.kanten, "zwei verschiedene Beziehungen").toBe(2);
  });

  it("WIDERRUFEN zaehlt nicht mit — und wird auch nicht gesondert ausgewiesen", async () => {
    const { ko, repo, neuesKo, alle } = await bestand();
    const a = await neuesKo("A");
    const b = await neuesKo("B");
    await repo.setze(kante({ quelleId: a, zielId: b, status: "widerrufen" }));

    const q = await netzQualitaet({ repo, kos: ko, bestand: alle }, { sichtbar: CONTROLLERIN });

    // Eine widerrufene Beziehung ist keine Beziehung — beide Objekte sind verwaist.
    expect(q.verwaist).toBe(2);
    expect(q.kanten).toBe(0);
    // Und es gibt KEINEN Zaehler dafuer: `alsAnsicht` macht widerrufen, unaufloesbar und
    // unsichtbar ununterscheidbar. Eine eigene Zahl waere genau die verbotene Auskunft.
    expect(Object.keys(q)).not.toContain("widerrufen");
  });
});
