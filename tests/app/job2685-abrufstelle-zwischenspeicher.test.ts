// ================================================================================================
// JOB 2685 D2 (Review R2-30) — DIE ABRUFSTELLE: zehn Bilder, eine Trägersuche je Seite, Entzug sofort.
// ================================================================================================
//
// D1 hatte hier einen Zwischenspeicher für das URTEIL, und das volle Tor zeigte, warum er aus
// bleiben musste: JOB 579 D5 / JOB 605 D5 pinnen den Entzug BEIM NÄCHSTEN ABRUF. D2 merkt sich nur
// noch die KENNUNGEN der Träger (Kandidaten-Speicher, sichtbarkeit.ts) und liest jeden Kandidaten
// beim Urteil frisch. Hier läuft die ECHTE Route (objectRoutes) mit injizierter Uhr und zählenden
// Quellen: wie oft läuft die Trägersuche, und greift ein Entzug noch innerhalb der Frist?
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  type ObjectRoutesOptionen,
  objectRoutes,
} from "../../services/app/src/routes/object-routes";
import {
  type AnhangQuellen,
  type AnhangTraeger,
  KANDIDATEN_FRIST_MS,
} from "../../services/app/src/sichtbarkeit";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const ANNA: SessionUser = { id: "u-anna", role: "viewer" };
const BERT: SessionUser = { id: "u-bert", role: "viewer" };
const BILDER = Array.from({ length: 10 }, (_, i) => `obj-${i + 1}`);

interface Bestand {
  kos: Map<string, AnhangTraeger & { deletedAt?: string }>;
}

/** Ein Träger, der alle zehn Bilder nennt — die Wissensobjekt-Seite mit zehn Bildern. */
function seiteMitZehnBildern(): Bestand {
  const kos = new Map<string, AnhangTraeger & { deletedAt?: string }>();
  kos.set("ko-seite", {
    id: "ko-seite",
    confidentiality: "intern",
    author: "u-anna",
    attachments: BILDER.map((objectId) => ({ objectId, author: "u-anna" })),
    bodyHtml: BILDER.map((id) => `<img src="/api/objects/${id}/raw">`).join(""),
  });
  return { kos };
}

function harness(
  bestand: Bestand,
  optionen: ObjectRoutesOptionen,
  fehlerBeim = -1,
  beiSuche: () => void = () => {},
) {
  let aktuell: SessionUser = ANNA;
  // D3: der Schreibstand — der Test erhöht ihn, wenn er den Bestand ändert (wie die Ablage es tut).
  let schreibstand = 0;
  const guards: Guards = {
    requireUser: async () => aktuell,
    requirePermission: async () => aktuell,
  };
  const objekte = new Set(BILDER);
  const store = {
    read: async (id: string) =>
      objekte.has(id)
        ? {
            ref: { id, name: `${id}.png`, mime: "image/png", lifecycle: { owner: "u-anna" } },
            data: PNG,
          }
        : undefined,
  } as never;
  const suchen: string[][] = [];
  const einzelLesungen: string[] = [];
  const nenntAktuell = (k: AnhangTraeger, id: string) =>
    (k.attachments ?? []).some((a) => a.objectId === id) ||
    (typeof k.bodyHtml === "string" && k.bodyHtml.includes(id));
  const lebend = () => [...bestand.kos.values()].filter((k) => !k.deletedAt);
  const quellen: AnhangQuellen = {
    kos: async (objectId) => lebend().filter((k) => nenntAktuell(k, objectId)),
    kosFuer: async (ids) => {
      suchen.push([...ids]);
      if (suchen.length === fehlerBeim) {
        throw new Error("Datenbank kurz weg");
      }
      beiSuche();
      return lebend().filter((k) => ids.some((id) => nenntAktuell(k, id)));
    },
    ko: async (koId) => {
      einzelLesungen.push(koId);
      const k = bestand.kos.get(koId);
      return k && !k.deletedAt ? k : undefined;
    },
    // D4: der Stand kommt asynchron aus der Ablage — hier der Zähler dieses Bestands.
    stand: async () => String(schreibstand),
    versionen: async () => [],
    belege: async () => [],
    entwuerfe: async () => [],
  };
  const app = Fastify();
  app.register(objectRoutes(store, guards, quellen, optionen));
  return {
    app,
    suchen,
    einzelLesungen,
    als: (u: SessionUser) => {
      aktuell = u;
    },
    /** D3: „die Ablage hat geschrieben" — was jede Repo-Schreibmethode über `anhangSchreibstand` tut. */
    geaendert: () => {
      schreibstand += 1;
    },
    raw: (id: string) => app.inject({ method: "GET", url: `/api/objects/${id}/raw` }),
  };
}

describe("JOB 2685 D2 · Kandidaten-Speicher an der Abrufstelle", () => {
  it("die Frist ist wenige Sekunden und EINGESCHALTET — ein Wert, gepinnt", () => {
    expect(KANDIDATEN_FRIST_MS).toBe(5_000);
  });

  it("DIE ABNAHME: zehn Bilder einer Seite → zehn 200er, ZWEI Trägersuchen (Bild 1, dann seine Geschwister) — nicht zehn", async () => {
    let uhr = 0;
    const h = harness(seiteMitZehnBildern(), { jetzt: () => uhr });
    for (const [i, id] of BILDER.entries()) {
      uhr = i * 20;
      const res = await h.raw(id);
      expect(res.statusCode, `${id}: ${res.body}`).toBe(200);
    }
    expect(h.suchen).toHaveLength(2);
    expect(h.suchen[0]).toEqual(["obj-1"]);
    expect(new Set(h.suchen[1])).toEqual(new Set(BILDER));
    // Ein zweiter Durchgang über die Seite innerhalb der Frist kostet keine Suche mehr.
    for (const id of BILDER) {
      expect((await h.raw(id)).statusCode).toBe(200);
    }
    expect(h.suchen).toHaveLength(2);
    // Aber jedes Urteil hat seinen Träger FRISCH gelesen — zwanzig Einzellesungen für zwanzig Abrufe.
    expect(h.einzelLesungen).toHaveLength(20);
  });

  it("dasselbe Bild zehnmal: eine Trägersuche, und die Geschwister sind mit vorbefüllt", async () => {
    let uhr = 0;
    const h = harness(seiteMitZehnBildern(), { jetzt: () => uhr });
    for (let i = 0; i < 10; i++) {
      uhr = i * 50;
      expect((await h.raw("obj-3")).statusCode).toBe(200);
    }
    expect(h.suchen).toHaveLength(2); // Bild 3 + seine neun Geschwister, einmal
    expect((await h.raw("obj-7")).statusCode).toBe(200);
    expect(h.suchen).toHaveLength(2); // Geschwister: keine neue Suche
  });

  it("ENTZUG GREIFT SOFORT (JOB 579 D5 / 605 D5): Hochstufung innerhalb der Frist → nächster Abruf 404, ohne neue Suche", async () => {
    const bestand = seiteMitZehnBildern();
    const h = harness(bestand, { jetzt: () => 0 });
    h.als(BERT);
    expect((await h.raw("obj-1")).statusCode).toBe(200);
    // Der Träger wird vertraulich — Bert darf nicht mehr.
    const ko = bestand.kos.get("ko-seite");
    if (ko) {
      ko.confidentiality = "vertraulich";
    }
    const danach = await h.raw("obj-1");
    expect(danach.statusCode).toBe(404);
    expect(danach.headers["cache-control"]).toBe("no-store");
    expect(h.suchen).toHaveLength(2); // keine neue Suche nötig — der Kandidat wurde frisch gelesen
  });

  it("ENTZUG GREIFT SOFORT: Papierkorb innerhalb der Frist → 404", async () => {
    const bestand = seiteMitZehnBildern();
    const h = harness(bestand, { jetzt: () => 0 });
    h.als(BERT);
    expect((await h.raw("obj-2")).statusCode).toBe(200);
    const ko = bestand.kos.get("ko-seite");
    if (ko) {
      ko.deletedAt = "2026-08-29T04:00:00.000Z";
    }
    expect((await h.raw("obj-2")).statusCode).toBe(404);
  });

  it("ENTZUG GREIFT SOFORT: Anhang gelöst innerhalb der Frist → 404", async () => {
    const bestand = seiteMitZehnBildern();
    const h = harness(bestand, { jetzt: () => 0 });
    h.als(BERT);
    expect((await h.raw("obj-4")).statusCode).toBe(200);
    const ko = bestand.kos.get("ko-seite");
    if (ko) {
      ko.attachments = (ko.attachments ?? []).filter((a) => a.objectId !== "obj-4");
      ko.bodyHtml = (ko.bodyHtml ?? "").replace('<img src="/api/objects/obj-4/raw">', "");
    }
    expect((await h.raw("obj-4")).statusCode).toBe(404);
  });

  it("BENANNTE VERZÖGERUNG: ein Bild ohne Träger wird NICHT gemerkt — nach dem Anhängen ist es beim nächsten Abruf da", async () => {
    const bestand = seiteMitZehnBildern();
    const h = harness(bestand, { jetzt: () => 0 });
    // obj-1 ist gerade hochgeladen, an nichts gehängt: keine Kandidaten, kein Eintrag.
    const ko = bestand.kos.get("ko-seite");
    if (ko) {
      ko.attachments = [];
      ko.bodyHtml = "";
    }
    h.als(BERT);
    expect((await h.raw("obj-1")).statusCode).toBe(404);
    if (ko) {
      ko.attachments = [{ objectId: "obj-1", author: "u-anna" }];
    }
    expect((await h.raw("obj-1")).statusCode).toBe(200);
    expect(h.suchen.length).toBeGreaterThanOrEqual(2);
  });

  it("nach Ablauf der Frist sucht die Abrufstelle neu — genau ab dem Ablauf", async () => {
    let uhr = 1_000;
    const h = harness(seiteMitZehnBildern(), { jetzt: () => uhr });
    await h.raw("obj-1");
    const nachErstem = h.suchen.length;
    uhr = 1_000 + KANDIDATEN_FRIST_MS - 1;
    await h.raw("obj-1");
    expect(h.suchen).toHaveLength(nachErstem);
    uhr = 1_000 + KANDIDATEN_FRIST_MS;
    await h.raw("obj-1");
    expect(h.suchen.length).toBeGreaterThan(nachErstem);
  });

  it("ein Objekt, das es nicht gibt: 404 wie bisher, und keine Trägersuche", async () => {
    const h = harness(seiteMitZehnBildern(), { jetzt: () => 0 });
    expect((await h.raw("obj-gibt-es-nicht")).statusCode).toBe(404);
    expect(h.suchen).toEqual([]);
  });

  it("eine Suche, die mit einem Fehler endet, wird nicht gemerkt — der nächste Abruf sucht neu", async () => {
    const h = harness(seiteMitZehnBildern(), { jetzt: () => 0 }, 1);
    expect((await h.raw("obj-1")).statusCode).toBe(500);
    expect((await h.raw("obj-1")).statusCode).toBe(200);
  });

  it("KALIBRIERUNG: Frist 0 schaltet den Speicher aus — jeder Abruf sucht, und zwar über `kos` wie in D1", async () => {
    const h = harness(seiteMitZehnBildern(), { jetzt: () => 0, kandidatenFristMs: 0 });
    for (const id of BILDER) {
      expect((await h.raw(id)).statusCode).toBe(200);
    }
    // Ohne Speicher läuft `kos(objectId)` je Abruf; `kosFuer` bleibt still.
    expect(h.suchen).toEqual([]);
    expect(h.einzelLesungen).toEqual([]);
  });

  // ----------------------------------------------------------------------------------------------
  // D3 — EIN NEUES BILD WÄHREND DER FRIST (BEN an D2: „Ein während der Frist neu angehängter Träger
  // fehlt im gemerkten Kandidatensatz"). Der Speicher trägt jetzt den Schreibstand je Eintrag.
  // ----------------------------------------------------------------------------------------------
  it("D3 · BENs FALL: obj-1 ist gemerkt; der alte Träger wird vertraulich, ein NEUES internes Objekt hängt obj-1 an → Bert sieht es beim nächsten Abruf, innerhalb der Frist, über eine neue Suche", async () => {
    const bestand = seiteMitZehnBildern();
    const h = harness(bestand, { jetzt: () => 0 });
    h.als(BERT);
    expect((await h.raw("obj-1")).statusCode).toBe(200); // gemerkt: Kandidaten [ko-seite]
    const seite = bestand.kos.get("ko-seite");
    if (seite) {
      seite.confidentiality = "vertraulich";
    }
    expect((await h.raw("obj-1")).statusCode).toBe(404); // Entzug sofort (D2)
    // Anna hängt obj-1 zusätzlich an ein neues, internes Objekt — die Ablage schreibt.
    bestand.kos.set("ko-neu", {
      id: "ko-neu",
      confidentiality: "intern",
      author: "u-anna",
      attachments: [{ objectId: "obj-1", author: "u-anna" }],
      bodyHtml: "",
    });
    h.geaendert();
    const suchenVorher = h.suchen.length;
    const danach = await h.raw("obj-1");
    expect(danach.statusCode).toBe(200);
    // Der alte, vertrauliche Träger ist weiter ein Träger: `vertraulich` bleibt, also `no-store`
    // (Regel unverändert seit mega76: ein vertraulicher Mitträger macht den Anhang vertraulich).
    expect(danach.headers["cache-control"]).toBe("no-store");
    expect(h.suchen.length).toBeGreaterThan(suchenVorher);
    expect(h.suchen[h.suchen.length - 1]).toContain("obj-1");
  });

  it("D3 · GEGENPROBE: dasselbe Anhängen OHNE Schreibstand bliebe bis zum Ablauf der Frist unsichtbar — das Fenster, das BEN benannt hat", async () => {
    let uhr = 0;
    const bestand = seiteMitZehnBildern();
    const h = harness(bestand, { jetzt: () => uhr });
    h.als(BERT);
    expect((await h.raw("obj-1")).statusCode).toBe(200);
    const seite = bestand.kos.get("ko-seite");
    if (seite) {
      seite.confidentiality = "vertraulich";
    }
    bestand.kos.set("ko-neu", {
      id: "ko-neu",
      confidentiality: "intern",
      author: "u-anna",
      attachments: [{ objectId: "obj-1", author: "u-anna" }],
      bodyHtml: "",
    });
    // KEIN h.geaendert(): der Speicher kann die Änderung nicht sehen …
    expect((await h.raw("obj-1")).statusCode).toBe(404);
    // … bis die Frist abläuft.
    uhr = KANDIDATEN_FRIST_MS;
    expect((await h.raw("obj-1")).statusCode).toBe(200);
  });

  it("D3 · auch ein VORBEFÜLLTER Geschwister-Eintrag wird verworfen: obj-7 kam über obj-1 in den Speicher; nach dem Schreiben sucht der Abruf von obj-7 neu und findet den neuen Träger", async () => {
    const bestand = seiteMitZehnBildern();
    const h = harness(bestand, { jetzt: () => 0 });
    h.als(BERT);
    expect((await h.raw("obj-1")).statusCode).toBe(200); // Bild 1 + Geschwister, darunter obj-7
    expect(h.suchen).toHaveLength(2);
    const seite = bestand.kos.get("ko-seite");
    if (seite) {
      seite.confidentiality = "vertraulich";
    }
    expect((await h.raw("obj-7")).statusCode).toBe(404); // aus dem vorbefüllten Eintrag, frisch gelesen
    expect(h.suchen).toHaveLength(2);
    // Anhangseintrag der Hochladenden = Nachweis (ein Fließtext allein wäre ohne Fassung nur eine
    // Behauptung — dieselbe Regel wie ohne Speicher, mega78).
    bestand.kos.set("ko-neu", {
      id: "ko-neu",
      confidentiality: "intern",
      author: "u-anna",
      attachments: [{ objectId: "obj-7", author: "u-anna" }],
      bodyHtml: '<img src="/api/objects/obj-7/raw">',
    });
    h.geaendert();
    expect((await h.raw("obj-7")).statusCode).toBe(200);
    expect(h.suchen.length).toBeGreaterThan(2);
    expect(h.suchen[h.suchen.length - 1]).toContain("obj-7");
  });

  it("D3 · ein Schreiben WÄHREND der laufenden Suche entwertet den Eintrag ebenfalls — der Stand wird VOR der Suche gelesen", async () => {
    const bestand = seiteMitZehnBildern();
    let waehrendSuche = false;
    const h = harness(bestand, { jetzt: () => 0 }, -1, () => {
      if (waehrendSuche) {
        // Während die Suche läuft, hängt jemand obj-1 an ein neues Objekt.
        bestand.kos.set("ko-neu", {
          id: "ko-neu",
          confidentiality: "intern",
          author: "u-anna",
          attachments: [{ objectId: "obj-1", author: "u-anna" }],
          bodyHtml: "",
        });
        h.geaendert();
        waehrendSuche = false;
      }
    });
    h.als(BERT);
    waehrendSuche = true;
    expect((await h.raw("obj-1")).statusCode).toBe(200);
    const suchenVorher = h.suchen.length;
    const seite = bestand.kos.get("ko-seite");
    if (seite) {
      seite.confidentiality = "vertraulich";
    }
    // Der Eintrag entstand unter dem ALTEN Stand: der nächste Abruf sucht neu und findet ko-neu.
    expect((await h.raw("obj-1")).statusCode).toBe(200);
    expect(h.suchen.length).toBeGreaterThan(suchenVorher);
  });

  it("D3 · GLEICHZEITIG, wie ein Browser: zehn Anforderungen auf einmal → zwei Suchen, nicht zwanzig — die Suchen laufen nacheinander, die Wartenden finden ihre Geschwister vorbefüllt", async () => {
    const h = harness(seiteMitZehnBildern(), { jetzt: () => 0 });
    h.als(BERT);
    const antworten = await Promise.all(BILDER.map((id) => h.raw(id)));
    expect(antworten.map((r) => r.statusCode)).toEqual(Array(10).fill(200));
    expect(h.suchen).toHaveLength(2);
    expect(h.suchen[0]).toEqual(["obj-1"]);
    expect(new Set(h.suchen[1])).toEqual(new Set(BILDER));
    // Und jedes Urteil hat seinen Träger frisch gelesen — zehn Einzellesungen.
    expect(h.einzelLesungen).toHaveLength(10);
  });

  it("D3 · GLEICHZEITIG, und eine Suche scheitert: die Reihe reißt nicht ab — die übrigen Anforderungen werden bedient", async () => {
    const h = harness(seiteMitZehnBildern(), { jetzt: () => 0 }, 1);
    h.als(BERT);
    const antworten = await Promise.all(BILDER.map((id) => h.raw(id)));
    // Genau die erste Suche scheiterte (500 für ihre Anforderung); die zweite fand Bild 2 samt
    // Geschwistern — alle anderen 200.
    expect(antworten.filter((r) => r.statusCode === 500)).toHaveLength(1);
    expect(antworten.filter((r) => r.statusCode === 200)).toHaveLength(9);
    expect(h.suchen.length).toBeLessThanOrEqual(3);
  });

  it("D3 · ein Schreiben, das keinen Träger berührt, kostet nur eine Suche mehr — nie Sichtbarkeit: nach dem Schreiben ist jedes Urteil mit Speicher gleich dem ohne", async () => {
    const bestand = seiteMitZehnBildern();
    const mit = harness(bestand, { jetzt: () => 0 });
    const ohne = harness(bestand, { jetzt: () => 0, kandidatenFristMs: 0 });
    for (const id of BILDER) {
      mit.als(BERT);
      expect((await mit.raw(id)).statusCode).toBe(200);
    }
    // Ein fremdes Objekt entsteht (berührt keines der zehn Bilder) — die Ablage schreibt.
    bestand.kos.set("ko-fremd", {
      id: "ko-fremd",
      confidentiality: "intern",
      author: "u-anna",
      attachments: [],
      bodyHtml: "<p>ohne Bild</p>",
    });
    mit.geaendert();
    for (const wer of [ANNA, BERT]) {
      mit.als(wer);
      ohne.als(wer);
      for (const id of BILDER) {
        const a = await mit.raw(id);
        const b = await ohne.raw(id);
        expect([a.statusCode, a.headers["cache-control"]]).toEqual([
          b.statusCode,
          b.headers["cache-control"],
        ]);
      }
    }
    // Der Preis: die Seite wurde einmal neu gesucht (zwei Suchen), nicht zehnmal.
    expect(mit.suchen).toHaveLength(4);
  });

  it("die Sichtbarkeit je Betrachter ist mit Speicher dieselbe wie ohne: Hochladende sieht, Fremder sieht intern, nicht vertraulich", async () => {
    const bestand = seiteMitZehnBildern();
    const mit = harness(bestand, { jetzt: () => 0 });
    const ohne = harness(bestand, { jetzt: () => 0, kandidatenFristMs: 0 });
    for (const wer of [ANNA, BERT]) {
      mit.als(wer);
      ohne.als(wer);
      for (const id of BILDER) {
        const a = await mit.raw(id);
        const b = await ohne.raw(id);
        expect([a.statusCode, a.headers["cache-control"]]).toEqual([
          b.statusCode,
          b.headers["cache-control"],
        ]);
      }
    }
  });
});
