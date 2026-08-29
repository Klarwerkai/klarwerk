// ================================================================================================
// JOB 2685 D1 (Review R2-30) — DIE VORSORTIERTE TRÄGERSUCHE URTEILT IN JEDEM FALL WIE DIE SCHLEIFE.
// ================================================================================================
//
// §3 des Auftrags: „Wenn deine SQL-Fassung auch nur einen Fall anders beurteilt als die heutige
// Schleife, ist der Fix falsch — belege die Gleichheit an den Fällen, die sichtbarkeit.ts heute
// unterscheidet."
//
// WAS HIER VERGLICHEN WIRD. `beurteileAnhang` läuft zweimal über DENSELBEN Bestand:
//   · VORHER — `kos()` liefert den ganzen Bestand (so war es bis 71d3c2b verdrahtet);
//   · NACHHER — `kos(objectId)` liefert nur, was die vier SQL-Arme liefern würden (die Arme sind
//     hier Zeichen für Zeichen in Node übersetzt: Anhangseintrag, Fließtext, Belegkette, Fassungen).
// Beide Urteile MÜSSEN gleich sein — für jede Fundart, jede Stufe, jeden Autor, jeden Betrachter,
// jede eigene Einstufung des Anhangs, Papierkorb hin oder her.
//
// DIE FUNDARTEN sind die Zweige von sichtbarkeit.ts (Stand 71d3c2b, Z. 717–1001):
//   F1  keine Nennung
//   F2  Anhangseintrag, Urheber = Hochladender                (zuordnungAmObjekt → nachgewiesen)
//   F3  Anhangseintrag, Urheber = Fremder                     (→ behauptet)
//   F4  nur Fließtext im aktuellen Stand                       (→ behauptet; teure Stufe entscheidet)
//   F5  nur in Fassung 1, Verfasser = Hochladender             (zuordnungInFassung → nachgewiesen)
//   F6  nur in Fassung 1, Verfasser = Fremder                  (→ behauptet)
//   F7  Fassung 2 bringt die Kennung NEU ein, Verfasser = Hochladender (→ nachgewiesen)
//   F8  Fassung 2 ERBT die Kennung von Fassung 1              (mega80 B → behauptet)
//   F9  nur Beleg, createdBy = Hochladender                    (→ nachgewiesen)
//   F10 nur Beleg, createdBy = Fremder                         (→ behauptet)
//   F11 Fassung nennt den Anhang als EINTRAG eines Fremden, Verfasser = Hochladender
//       (zuordnungInFassung Zweig (a) → behauptet)
// Jede Fundart × {intern, vertraulich, streng_vertraulich, ohne Stufe} × {Autor = Hochladender,
// Fremder} × {lebend, Papierkorb} = 176 Träger, jeder mit EIGENER Anhang-Kennung; dazu Entwürfe
// (F12: Entwurf gehört dem Hochladenden / einem Dritten) und fünf Rausch-Objekte mit fremden
// Kennungen. Betrachter: Hochladender (viewer), Fremder (viewer), experte, controller, admin.
// Eigene Einstufung des Anhangs: {ohne, intern, vertraulich, streng_vertraulich} × Hochladender
// {gesetzt, leer, fehlend}.
//
// UND DAMIT DER VERGLEICH ZÄHNE HAT: dieselbe Rechnung mit einer ZU ENGEN Vorsortierung (ohne den
// Fassungs-Arm, ohne den Beleg-Arm, nur Anhangseinträge) MUSS Unterschiede zeigen. Ein Vergleich,
// der auch bei einem kaputten Prädikat gleich bliebe, wäre kein Beleg.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import {
  type AnhangEntwurf,
  type AnhangFassung,
  type AnhangQuellen,
  type AnhangTraeger,
  type AnhangUrteil,
  KandidatenSpeicher,
  type SichtbarkeitsFakten,
  beurteileAnhang,
} from "../../services/app/src/sichtbarkeit";
import type { Confidentiality } from "../../services/knowledge-object";

const HOCHLADENDER = "u-anna";
const FREMDER = "u-bert";

interface Traeger extends AnhangTraeger {
  deletedAt?: string;
}

interface Beleg {
  objectId?: string | null;
  createdBy?: string | null;
}

interface Bestand {
  kos: Traeger[];
  versionen: Map<string, AnhangFassung[]>;
  belege: Map<string, Beleg[]>;
  entwuerfe: AnhangEntwurf[];
}

const STUFEN: readonly (Confidentiality | undefined)[] = [
  undefined,
  "intern",
  "vertraulich",
  "streng_vertraulich",
];

type Fundart = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
const FUNDARTEN: readonly Fundart[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function stand(
  id: string,
  stufe: Confidentiality | undefined,
  autor: string,
  extra: Partial<Traeger> = {},
): Traeger {
  return {
    id,
    author: autor,
    ...(stufe ? { confidentiality: stufe } : { confidentiality: null }),
    attachments: [],
    bodyHtml: "<p>Anlage freischalten.</p>",
    ...extra,
  };
}

function text(objectId: string): string {
  return `<p>Siehe <img src="/api/objects/${objectId}/raw"></p>`;
}

/** Baut den ganzen Kreuzbestand — und die Liste der Kennungen, die je einen Fall bezeichnen. */
function kreuzbestand(): { bestand: Bestand; kennungen: string[] } {
  const bestand: Bestand = { kos: [], versionen: new Map(), belege: new Map(), entwuerfe: [] };
  const kennungen: string[] = [];
  let n = 0;
  for (const fundart of FUNDARTEN) {
    for (const stufe of STUFEN) {
      for (const autor of [HOCHLADENDER, FREMDER]) {
        for (const getrasht of [false, true]) {
          n += 1;
          // Gleich lange Kennungen: keine ist Teilzeichenfolge einer anderen (obj-001 vs obj-010) —
          // echte Kennungen sind UUIDs, dort gibt es diesen Fall nicht.
          const objectId = `obj-${String(n).padStart(3, "0")}`;
          const koId = `ko-${n}`;
          kennungen.push(objectId);
          const trash = getrasht ? { deletedAt: "2026-08-01T00:00:00.000Z" } : {};
          let ko: Traeger;
          const fassungen: AnhangFassung[] = [];
          const belege: Beleg[] = [];
          switch (fundart) {
            case 1:
              ko = stand(koId, stufe, autor, trash);
              break;
            case 2:
              ko = stand(koId, stufe, autor, {
                attachments: [{ objectId, author: HOCHLADENDER }],
                ...trash,
              });
              break;
            case 3:
              ko = stand(koId, stufe, autor, {
                attachments: [{ objectId, author: FREMDER }],
                ...trash,
              });
              break;
            case 4:
              ko = stand(koId, stufe, autor, { bodyHtml: text(objectId), ...trash });
              break;
            case 5:
            case 6: {
              ko = stand(koId, stufe, autor, trash);
              fassungen.push({
                author: fundart === 5 ? HOCHLADENDER : FREMDER,
                stand: stand(koId, stufe, autor, { bodyHtml: text(objectId) }),
              });
              break;
            }
            case 7:
              ko = stand(koId, stufe, autor, trash);
              fassungen.push(
                { author: FREMDER, stand: stand(koId, stufe, autor) },
                {
                  author: HOCHLADENDER,
                  stand: stand(koId, stufe, autor, { bodyHtml: text(objectId) }),
                },
              );
              break;
            case 8:
              ko = stand(koId, stufe, autor, trash);
              fassungen.push(
                { author: FREMDER, stand: stand(koId, stufe, autor, { bodyHtml: text(objectId) }) },
                {
                  author: HOCHLADENDER,
                  stand: stand(koId, stufe, autor, { bodyHtml: text(objectId) }),
                },
              );
              break;
            case 9:
            case 10:
              ko = stand(koId, stufe, autor, trash);
              belege.push({ objectId, createdBy: fundart === 9 ? HOCHLADENDER : FREMDER });
              break;
            case 11:
              ko = stand(koId, stufe, autor, trash);
              fassungen.push({
                author: HOCHLADENDER,
                stand: stand(koId, stufe, autor, { attachments: [{ objectId, author: FREMDER }] }),
              });
              break;
          }
          bestand.kos.push(ko);
          bestand.versionen.set(koId, fassungen);
          bestand.belege.set(koId, belege);
        }
      }
    }
  }
  // Rauschen: Objekte, die ANDERE Kennungen nennen — sie dürfen nie in ein fremdes Urteil geraten.
  for (let r = 0; r < 5; r++) {
    const koId = `ko-rausch-${r}`;
    bestand.kos.push(
      stand(koId, "intern", HOCHLADENDER, {
        attachments: [{ objectId: `obj-rausch-${r}`, author: HOCHLADENDER }],
        bodyHtml: text(`obj-rausch-${r}`),
      }),
    );
    bestand.versionen.set(koId, [
      {
        author: HOCHLADENDER,
        stand: stand(koId, "intern", HOCHLADENDER, { bodyHtml: text(`obj-rausch-${r}`) }),
      },
    ]);
    bestand.belege.set(koId, [{ objectId: `obj-rausch-${r}`, createdBy: HOCHLADENDER }]);
  }
  // F12: Entwürfe — nicht vorsortiert, aber Teil des Urteils. Ein Drittel der Kennungen gehört
  // einem Entwurf des Hochladenden, ein Drittel einem Entwurf eines Dritten (per Fließtext).
  bestand.entwuerfe.push(
    {
      originalAuthor: HOCHLADENDER,
      lastEditor: HOCHLADENDER,
      bodyHtml: "",
      objectIds: kennungen.filter((_, i) => i % 3 === 0),
    },
    {
      originalAuthor: FREMDER,
      lastEditor: "u-carl",
      bodyHtml: kennungen
        .filter((_, i) => i % 3 === 1)
        .map((id) => text(id))
        .join(""),
      objectIds: [],
    },
  );
  return { bestand, kennungen };
}

// ------------------------------------------------------------------------------------------------
// Die vier SQL-Arme aus KO_ANHANG_TRAEGER_SQL, Zeichen für Zeichen nach Node übersetzt.
// ------------------------------------------------------------------------------------------------
function armAnhang(s: AnhangTraeger, objectId: string): boolean {
  // `data->'attachments' @> '[{"objectId": "…"}]'` — ein Array-Element mit genau diesem Feld/Wert.
  return Array.isArray(s.attachments) && s.attachments.some((a) => a.objectId === objectId);
}
function armText(s: AnhangTraeger, objectId: string): boolean {
  // `data->>'bodyHtml' LIKE '%…%'`.
  return typeof s.bodyHtml === "string" && s.bodyHtml.includes(objectId);
}

interface Arme {
  anhang: boolean;
  text: boolean;
  belege: boolean;
  fassungen: boolean;
}
const ALLE_ARME: Arme = { anhang: true, text: true, belege: true, fassungen: true };

function vorsortiert(b: Bestand, objectId: string, arme: Arme): Traeger[] {
  return b.kos.filter(
    (k) =>
      (arme.anhang && armAnhang(k, objectId)) ||
      (arme.text && armText(k, objectId)) ||
      (arme.belege && (b.belege.get(k.id) ?? []).some((e) => e.objectId === objectId)) ||
      (arme.fassungen &&
        (b.versionen.get(k.id) ?? []).some(
          (v) => armAnhang(v.stand, objectId) || armText(v.stand, objectId),
        )),
  );
}

function quellenVorher(b: Bestand): AnhangQuellen {
  return {
    kos: async () => b.kos.filter((k) => !k.deletedAt), // wie `KoService.list`
    versionen: async (koId) => b.versionen.get(koId) ?? [],
    belege: async (koId) => b.belege.get(koId) ?? [],
    entwuerfe: async () => b.entwuerfe,
  };
}

function quellenNachher(b: Bestand, arme: Arme = ALLE_ARME): AnhangQuellen {
  return {
    // wie build-app.ts: Trägersuche an der Quelle, dann derselbe Papierkorb-Trim.
    kos: async (objectId) => vorsortiert(b, objectId, arme).filter((k) => !k.deletedAt),
    versionen: async (koId) => b.versionen.get(koId) ?? [],
    belege: async (koId) => b.belege.get(koId) ?? [],
    entwuerfe: async () => b.entwuerfe,
  };
}

/** D2: die Quellen, wie build-app.ts sie mit Datenquellen-Suche verdrahtet — plus Mehrfachsuche und
 * Einzelzugriff. D3: plus Schreibstand (`schreibstand.wert` erhöht der Test, wenn er den Bestand ändert). */
function quellenMitSpeicher(
  b: Bestand,
  schreibstand: { wert: number } = { wert: 0 },
): AnhangQuellen {
  const basis = quellenNachher(b);
  return {
    ...basis,
    kosFuer: async (objectIds) =>
      b.kos
        .filter((k) => objectIds.some((id) => vorsortiert(b, id, ALLE_ARME).includes(k)))
        .filter((k) => !k.deletedAt),
    ko: async (koId) => {
      const k = b.kos.find((x) => x.id === koId);
      return k && !k.deletedAt ? k : undefined;
    },
    stand: async () => String(schreibstand.wert),
  };
}

const BETRACHTER: readonly SessionUser[] = [
  { id: HOCHLADENDER, role: "viewer" },
  { id: FREMDER, role: "viewer" },
  { id: "u-carl", role: "experte" },
  { id: "u-dora", role: "controller" },
  { id: "u-erik", role: "admin" },
];

const EIGENE: readonly SichtbarkeitsFakten[] = (() => {
  const out: SichtbarkeitsFakten[] = [];
  for (const stufe of STUFEN) {
    for (const author of [HOCHLADENDER, "", null]) {
      out.push({ confidentiality: stufe ?? null, author });
    }
  }
  return out;
})();

interface Vergleich {
  faelle: number;
  abweichungen: string[];
  sichtbar: number;
  unsichtbar: number;
  vertraulich: number;
  unvertraulich: number;
}

async function vergleiche(arme: Arme): Promise<Vergleich> {
  const { bestand, kennungen } = kreuzbestand();
  const vorher = quellenVorher(bestand);
  const nachher = quellenNachher(bestand, arme);
  const v: Vergleich = {
    faelle: 0,
    abweichungen: [],
    sichtbar: 0,
    unsichtbar: 0,
    vertraulich: 0,
    unvertraulich: 0,
  };
  for (const objectId of kennungen) {
    for (const user of BETRACHTER) {
      for (const eigen of EIGENE) {
        const a: AnhangUrteil = await beurteileAnhang(user, objectId, eigen, vorher);
        const b: AnhangUrteil = await beurteileAnhang(user, objectId, eigen, nachher);
        v.faelle += 1;
        if (a.sichtbar !== b.sichtbar || a.vertraulich !== b.vertraulich) {
          v.abweichungen.push(
            `${objectId} · ${user.id}/${user.role} · eigen ${eigen.confidentiality}/${eigen.author} · vorher ${JSON.stringify(a)} nachher ${JSON.stringify(b)}`,
          );
        }
        if (a.sichtbar) v.sichtbar += 1;
        else v.unsichtbar += 1;
        if (a.vertraulich) v.vertraulich += 1;
        else v.unvertraulich += 1;
      }
    }
  }
  return v;
}

/** Aus einer Abweichungszeile die Fundart ihrer Kennung (16 Träger je Fundart, s. kreuzbestand). */
function fundartVon(zeile: string): Fundart | undefined {
  const m = /obj-(\d{3})/.exec(zeile);
  return m ? FUNDARTEN[Math.floor((Number(m[1]) - 1) / 16)] : undefined;
}

describe("JOB 2685 D1 · vorsortierte Trägersuche ≡ Schleife über den ganzen Bestand", () => {
  it("der Kreuzbestand hat die angekündigte Form: 176 Fallträger + 5 Rausch-Objekte + 2 Entwürfe", () => {
    const { bestand, kennungen } = kreuzbestand();
    expect(kennungen).toHaveLength(11 * 4 * 2 * 2);
    expect(bestand.kos).toHaveLength(176 + 5);
    expect(bestand.entwuerfe).toHaveLength(2);
    // Jede Fundart außer F1 nennt ihre Kennung irgendwo — sonst wäre sie kein Fall.
    for (const [i, objectId] of kennungen.entries()) {
      const fundart = FUNDARTEN[Math.floor(i / 16)];
      const treffer = vorsortiert(bestand, objectId, ALLE_ARME);
      expect(treffer.length, `${objectId} (F${fundart})`).toBe(fundart === 1 ? 0 : 1);
    }
  });

  it("über ALLE 176 Fälle × 5 Betrachter × 12 eigene Einstufungen ist das Urteil identisch", async () => {
    const v = await vergleiche(ALLE_ARME);
    expect(v.faelle).toBe(176 * 5 * 12);
    expect(v.abweichungen, v.abweichungen.slice(0, 10).join("\n")).toEqual([]);
    // Der Vergleich ist nicht leer: beide Ausgänge kommen in nennenswerter Zahl vor.
    expect(v.sichtbar).toBeGreaterThan(500);
    expect(v.unsichtbar).toBeGreaterThan(500);
    expect(v.vertraulich).toBeGreaterThan(500);
    expect(v.unvertraulich).toBeGreaterThan(500);
  });

  it("ZÄHNE: ohne den Fassungs-Arm weicht das Urteil ab (F5/F7 verlieren ihren Nachweis)", async () => {
    const v = await vergleiche({ ...ALLE_ARME, fassungen: false });
    expect(v.abweichungen.length).toBeGreaterThan(0);
    const fundarten = new Set(v.abweichungen.map(fundartVon));
    expect(fundarten.has(5)).toBe(true);
    expect(fundarten.has(7)).toBe(true);
  });

  it("ZÄHNE: ohne den Beleg-Arm weicht das Urteil ab (F9 verliert seinen Nachweis)", async () => {
    const v = await vergleiche({ ...ALLE_ARME, belege: false });
    expect(v.abweichungen.length).toBeGreaterThan(0);
    expect(new Set(v.abweichungen.map(fundartVon)).has(9)).toBe(true);
  });

  it("ZÄHNE: nur Anhangseinträge (die Skizze aus R2-30 ohne die anderen Arme) reicht NICHT", async () => {
    const v = await vergleiche({ anhang: true, text: false, belege: false, fassungen: false });
    expect(v.abweichungen.length).toBeGreaterThan(0);
  });

  it("D2 · über den KANDIDATEN-SPEICHER (gemerkte Kennungen, frisch gelesen) ist das Urteil an allen 10.560 Fällen identisch — auch beim zweiten Durchgang aus dem Speicher", async () => {
    const { bestand, kennungen } = kreuzbestand();
    const vorher = quellenVorher(bestand);
    const mit = quellenMitSpeicher(bestand);
    const speicher = new KandidatenSpeicher({ fristMs: 60_000, jetzt: () => 0 });
    const abweichungen: string[] = [];
    let faelle = 0;
    for (const durchgang of [1, 2]) {
      for (const objectId of kennungen) {
        for (const user of BETRACHTER) {
          for (const eigen of EIGENE) {
            const a = await beurteileAnhang(user, objectId, eigen, vorher);
            const b = await beurteileAnhang(user, objectId, eigen, mit, speicher);
            faelle += 1;
            if (a.sichtbar !== b.sichtbar || a.vertraulich !== b.vertraulich) {
              abweichungen.push(
                `Durchgang ${durchgang} · ${objectId} · ${user.id}/${user.role} · eigen ${eigen.confidentiality}/${eigen.author} · vorher ${JSON.stringify(a)} speicher ${JSON.stringify(b)}`,
              );
            }
          }
        }
      }
    }
    expect(faelle).toBe(2 * 176 * 5 * 12);
    expect(abweichungen, abweichungen.slice(0, 10).join("\n")).toEqual([]);
    // Und der Speicher hat gearbeitet — mit der einen benannten Ausnahme: eine LEERE Kandidatenmenge
    // (kein lebender Träger; im Kreuzbestand jede Papierkorb-Kennung und F1) wird nie gemerkt, damit
    // ein gerade erst angehängter Anhang ohne Verzögerung gefunden wird. Kennungen MIT lebendem
    // Träger wurden genau einmal gesucht (beide Runden, alle Betrachter); die anderen bei jedem Urteil.
    const mitTraeger = kennungen.filter(
      (id) => vorsortiert(bestand, id, ALLE_ARME).filter((k) => !k.deletedAt).length > 0,
    ).length;
    const ohneTraeger = kennungen.length - mitTraeger;
    expect(mitTraeger).toBeGreaterThan(0);
    expect(speicher.traegersuchen).toBe(
      mitTraeger + ohneTraeger * 2 * BETRACHTER.length * EIGENE.length,
    );
  });

  it("D3 · EIN NEUES BILD WÄHREND DER FRIST (BEN): nach dem Anhängen an ein weiteres Objekt ist das Urteil über den Speicher sofort dasselbe wie ohne — und OHNE Schreibstand wäre es das nicht", async () => {
    const { bestand, kennungen } = kreuzbestand();
    const vorher = quellenVorher(bestand);
    const schreibstand = { wert: 0 };
    const mit = quellenMitSpeicher(bestand, schreibstand);
    const speicher = new KandidatenSpeicher({ fristMs: 60_000, jetzt: () => 0 });
    const vergleiche = async (): Promise<string[]> => {
      const abweichungen: string[] = [];
      for (const objectId of kennungen) {
        for (const user of BETRACHTER) {
          for (const eigen of EIGENE) {
            const a = await beurteileAnhang(user, objectId, eigen, vorher);
            const b = await beurteileAnhang(user, objectId, eigen, mit, speicher);
            if (a.sichtbar !== b.sichtbar || a.vertraulich !== b.vertraulich) {
              abweichungen.push(
                `${objectId} · ${user.id} · ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
              );
            }
          }
        }
      }
      return abweichungen;
    };
    // Runde 1: der Speicher wird warm — identisch (D2).
    expect(await vergleiche()).toEqual([]);
    const suchenWarm = speicher.traegersuchen;

    // DIE MUTATION, innerhalb der Frist: jede zweite Kennung wird ZUSÄTZLICH an ein neues, internes
    // Objekt des Fremden gehängt — mit einem Anhangseintrag des HOCHLADENDEN (ein Nachweis, F2) und
    // im Fließtext. Für Fremde und Dritte ändert das die Sichtbarkeit vertraulich getragener
    // Anhänge — genau der Fall, den ein gemerkter Kandidatensatz verpasst.
    const angehaengt: string[] = [];
    for (const [i, objectId] of kennungen.entries()) {
      if (i % 2 !== 0) {
        continue;
      }
      const koId = `ko-neu-${i}`;
      bestand.kos.push(
        stand(koId, "intern", FREMDER, {
          attachments: [{ objectId, author: HOCHLADENDER }],
          bodyHtml: text(objectId),
        }),
      );
      bestand.versionen.set(koId, []);
      bestand.belege.set(koId, []);
      angehaengt.push(objectId);
    }

    // GEGENPROBE ZUERST — ohne erhöhten Schreibstand bleibt der Speicher beim alten Kandidatensatz:
    // das ist BENs Befund an D2, hier reproduziert. Jede Abweichung betrifft eine angehängte Kennung.
    const veraltet = await vergleiche();
    expect(veraltet.length).toBeGreaterThan(0);
    for (const zeile of veraltet) {
      expect(
        angehaengt.some((id) => zeile.startsWith(`${id} ·`)),
        zeile,
      ).toBe(true);
    }

    // DAS MASS: das Anhängen ist ein Schreiben — der Schreibstand steigt, die gemerkten Einträge
    // sind wertlos, die Suche läuft neu, das Urteil ist wieder identisch. Sofort, nicht nach Ablauf.
    schreibstand.wert += 1;
    expect(await vergleiche()).toEqual([]);
    expect(speicher.verworfen).toBeGreaterThan(0);
    expect(speicher.traegersuchen).toBeGreaterThan(suchenWarm);
  });

  it("Rausch-Objekte erreichen kein fremdes Urteil, und eine Rausch-Kennung findet nur ihr Objekt", () => {
    const { bestand } = kreuzbestand();
    const treffer = vorsortiert(bestand, "obj-rausch-3", ALLE_ARME);
    expect(treffer.map((k) => k.id)).toEqual(["ko-rausch-3"]);
  });
});
