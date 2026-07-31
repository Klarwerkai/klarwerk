// ================================================================================================
// AUFTRAG-mega80 BLOCK C — DIE FESTSTELLUNG IST GEPRÜFT, BEVOR SIE JEMAND AUSFÜHRT.
// ================================================================================================
//
// Das Werkzeug (tools/anhang-herkunft-feststellen.ts) läuft gegen eine ECHTE Instanz und wird von
// diesem Test bewusst NICHT dorthin gelassen: geprüft wird der reine Auswertungskern über
// vorgegebene Zeilen. Der Datenbankteil darunter tut nichts weiter, als SELECTs auszuführen —
// er hat keine Entscheidung, die man prüfen könnte.
//
// WAS HIER FESTGEHALTEN WIRD, und warum jede Zusicherung nötig ist:
//   - Ein Objekt MIT `lifecycle.owner` ist kein Fund. Sonst zählte das Werkzeug den Normalfall mit
//     und die Zahl wäre wertlos.
//   - Ein Objekt OHNE Hochladenden, das NIEMAND nennt, wird gezählt, aber nicht als Fund gemeldet.
//     Es ist für keinen Betrachter sichtbar — es zu „reparieren" wäre Arbeit ohne Wirkung.
//   - Gefunden wird über ALLE Wege, auf denen ein Anhang ausgeliefert werden kann.
//   - Kein Träger wird doppelt genannt.
//
// ================================================================================================
// AUFTRAG-mega82 BLOCK B — DIE GRUNDMENGE IST DIE PRODUKTIVE, NICHT EINE KLEINERE.
// ================================================================================================
//
// Bis mega82 kannte das Werkzeug drei Wege (Anhangsliste, Fließtext, Fassung). `beurteileAnhang`
// kennt VIER Trägerquellen und `findObjectReferences` sieben Wege. Ein Objekt, das nur noch an
// einem BELEG oder einem ENTWURF hing, wurde als „hängt an nichts" gemeldet — und „hängt an nichts"
// liest sich wie „nichts zu tun". Deshalb steht hier ab sofort für JEDEN der vier fehlenden Wege
// ein eigener Fall: der reine Beleg-Fall und die drei Entwurfs-Formen.
import { describe, expect, it } from "vitest";
import type { ObjectRef } from "../../services/object-store/src/types";
import {
  type Bestandszeilen,
  type KoZeile,
  alsBericht,
  stelleFest,
} from "../../tools/anhang-herkunft-feststellen";

function ref(id: string, owner?: string): ObjectRef {
  return {
    id,
    name: `${id}.png`,
    mime: "image/png",
    size: 10,
    kind: "image",
    createdAt: "2026-07-01T00:00:00.000Z",
    // Ohne `owner` steht KEIN `lifecycle` da — genau die Form des Altbestands (das Feld ist im
    // Typ optional, weil vor mega20 niemand es geschrieben hat).
    ...(owner
      ? {
          lifecycle: {
            owner,
            purpose: "attachment" as const,
            retainUntil: "2026-08-01T00:00:00.000Z",
          },
        }
      : {}),
  };
}

/** Der Aufruf mit benannten Zeilen — fehlende Quellen sind leer, nie undefined. */
function feststellung(teil: Partial<Bestandszeilen>) {
  return stelleFest({
    objekte: [],
    kos: [],
    fassungen: [],
    belege: [],
    entwuerfe: [],
    ...teil,
  });
}

describe("mega80 C · Feststellung Altbestand ohne Hochladenden", () => {
  it("zählt nur Objekte OHNE lifecycle.owner und meldet nur die referenzierten", () => {
    const objekte = [ref("obj-mit", "erik"), ref("obj-ohne-anhang"), ref("obj-ohne-verwaist")];
    const kos: KoZeile[] = [
      { id: "ko-1", title: "Träger", attachments: [{ objectId: "obj-ohne-anhang" }] },
      { id: "ko-2", title: "Ohne Bezug", bodyHtml: "<p>nichts</p>" },
    ];

    const f = feststellung({ objekte, kos });
    expect(f.objekteGesamt).toBe(3);
    expect(f.ohneHochladenden).toBe(2);
    // Das verwaiste Objekt zählt in der Gesamtzahl, ist aber kein Fund: es hängt an nichts.
    expect(f.ohneHochladendenUndReferenziert).toBe(1);
    expect(f.funde.map((x) => x.objectId)).toEqual(["obj-ohne-anhang"]);
    expect(f.funde[0]?.traeger).toEqual([
      { traegerId: "ko-1", bezeichnung: "Träger", wie: "anhang" },
    ]);
  });

  it("findet auch den Fließtext- und den Fassungs-Weg — nicht nur die Anhangsliste", () => {
    const objekte = [ref("obj-text"), ref("obj-fassung")];
    const kos: KoZeile[] = [
      { id: "ko-text", title: "Bild im Text", bodyHtml: '<img src="/api/objects/obj-text/raw" />' },
      { id: "ko-alt", title: "Heute ohne Bezug", bodyHtml: "<p>inzwischen entfernt</p>" },
    ];
    const fassungen = [
      {
        koId: "ko-alt",
        stand: { id: "ko-alt", bodyHtml: '<img src="/api/objects/obj-fassung/raw" />' } as KoZeile,
      },
    ];

    const f = feststellung({ objekte, kos, fassungen });
    expect(f.ohneHochladendenUndReferenziert).toBe(2);
    expect(f.funde.find((x) => x.objectId === "obj-text")?.traeger).toEqual([
      { traegerId: "ko-text", bezeichnung: "Bild im Text", wie: "fliesstext" },
    ]);
    expect(f.funde.find((x) => x.objectId === "obj-fassung")?.traeger).toEqual([
      { traegerId: "ko-alt", bezeichnung: "Heute ohne Bezug", wie: "fassung" },
    ]);
  });

  it("nennt denselben Träger nicht doppelt, wenn Stand UND Fassung das Objekt führen", () => {
    const kos: KoZeile[] = [{ id: "ko-1", title: "T", attachments: [{ objectId: "obj-x" }] }];
    const fassungen = [
      { koId: "ko-1", stand: { id: "ko-1", attachments: [{ objectId: "obj-x" }] } as KoZeile },
    ];
    const f = feststellung({ objekte: [ref("obj-x")], kos, fassungen });
    expect(f.funde[0]?.traeger).toHaveLength(1);
    expect(f.funde[0]?.traeger[0]?.wie).toBe("anhang");
  });

  it("sagt bei null Funden ehrlich, dass nichts zu tun ist", () => {
    const bericht = alsBericht(feststellung({ objekte: [ref("obj-a", "erik")] }));
    expect(bericht).toContain("davon OHNE lifecycle.owner:              0");
    expect(bericht).toContain("Nichts zu tun.");
  });

  it("unterscheidet im Bericht „gibt es nicht“ von „hängt an nichts“", () => {
    const bericht = alsBericht(feststellung({ objekte: [ref("obj-verwaist")] }));
    expect(bericht).toContain("davon OHNE lifecycle.owner:              1");
    expect(bericht).toContain("KEINES wird von einem Träger");
  });
});

describe("mega82 B · die Grundmenge ist die produktive", () => {
  // DER REINE BELEG-FALL. Das Wissensobjekt nennt das Objekt heute NICHT mehr — weder im Stand noch
  // in einer Fassung. Nur die append-only Belegkette weiß noch davon, und `beurteileAnhang` liefert
  // genau darüber aus (sichtbarkeit.ts, teure Stufe). Bis mega82 war dieser Fall unsichtbar.
  it("findet ein Objekt, das NUR noch an der Belegkette hängt", () => {
    const f = feststellung({
      objekte: [ref("obj-beleg")],
      kos: [{ id: "ko-1", title: "Ohne sichtbaren Bezug", bodyHtml: "<p>nichts mehr</p>" }],
      fassungen: [{ koId: "ko-1", stand: { id: "ko-1", bodyHtml: "<p>auch früher nicht</p>" } }],
      belege: [{ koId: "ko-1", objectId: "obj-beleg" }],
    });

    expect(
      f.ohneHochladendenUndReferenziert,
      "Ein Objekt, das nur die Belegkette kennt, wurde als „hängt an nichts“ gemeldet.",
    ).toBe(1);
    expect(f.funde[0]?.traeger).toEqual([
      { traegerId: "ko-1", bezeichnung: "Ohne sichtbaren Bezug", wie: "beleg" },
    ]);
  });

  // DIE DREI ENTWURFS-FORMEN, jede einzeln — `findObjectReferences` unterscheidet sie, und ein
  // Werkzeug, das nur eine davon kennt, meldete für die anderen beiden zu wenig.
  it.each([
    [
      "entwurf-rumpf",
      { id: "e-1", titel: "Im Rumpf", bodyHtml: '<img src="/api/objects/obj-e/raw" />' },
    ],
    [
      "entwurf-quelle",
      { id: "e-1", titel: "Als offene Quelle", pendingSources: [{ objectId: "obj-e" }] },
    ],
    [
      "entwurf-anker",
      { id: "e-1", titel: "Als Ankerdokument", anchorDocuments: [{ objectId: "obj-e" }] },
    ],
  ] as const)("findet die Entwurfs-Form %s", (wie, entwurf) => {
    const f = feststellung({ objekte: [ref("obj-e")], entwuerfe: [entwurf] });

    expect(f.ohneHochladendenUndReferenziert, `Entwurfs-Form ${wie} nicht gefunden.`).toBe(1);
    expect(f.funde[0]?.traeger).toEqual([{ traegerId: "e-1", bezeichnung: entwurf.titel, wie }]);
  });

  // Ein Entwurf ist KEIN Wissensobjekt. Trügen beide dasselbe Objekt, stünden sie als zwei Träger
  // in der Liste — der Entwurf mit seiner eigenen Kennung, nicht unter der des Wissensobjekts.
  it("hält Entwurf und Wissensobjekt als getrennte Träger auseinander", () => {
    const f = feststellung({
      objekte: [ref("obj-b")],
      kos: [{ id: "ko-1", title: "Das Objekt", attachments: [{ objectId: "obj-b" }] }],
      entwuerfe: [{ id: "e-9", titel: "Der Entwurf", pendingSources: [{ objectId: "obj-b" }] }],
    });
    expect(f.funde[0]?.traeger).toEqual([
      { traegerId: "ko-1", bezeichnung: "Das Objekt", wie: "anhang" },
      { traegerId: "e-9", bezeichnung: "Der Entwurf", wie: "entwurf-quelle" },
    ]);
  });

  // Auch über die neuen Wege gilt die alte Disziplin: EIN Eintrag je Träger, der erste Weg gewinnt.
  it("nennt ein Wissensobjekt einmal, auch wenn Stand, Fassung UND Beleg es führen", () => {
    const f = feststellung({
      objekte: [ref("obj-c")],
      kos: [{ id: "ko-1", title: "T", attachments: [{ objectId: "obj-c" }] }],
      fassungen: [{ koId: "ko-1", stand: { id: "ko-1", attachments: [{ objectId: "obj-c" }] } }],
      belege: [{ koId: "ko-1", objectId: "obj-c" }],
    });
    expect(f.funde[0]?.traeger).toEqual([{ traegerId: "ko-1", bezeichnung: "T", wie: "anhang" }]);
  });

  // DIE FRAGE GEHÖRT ZUR ZAHL. Ein Betrieb, der die Zahl liest, muss ohne Rückfrage wissen, was sie
  // einschließt — sonst beruhigt oder erschreckt sie an der falschen Stelle.
  it("sagt im Bericht, welche Frage die Zahl beantwortet und dass der Papierkorb dazugehört", () => {
    const bericht = alsBericht(feststellung({ objekte: [ref("obj-a", "erik")] }));
    expect(bericht).toContain("WAS DIE LETZTE ZAHL BEANTWORTET");
    expect(bericht).toContain("GETRASHTE Wissensobjekte sind EINGESCHLOSSEN");
    expect(bericht).toContain("Belegkette");
    expect(bericht).toContain("Entwurf");
    expect(bericht).toContain("Obergrenze");
  });
});
