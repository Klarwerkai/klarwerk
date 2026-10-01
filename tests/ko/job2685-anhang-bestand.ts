// Der Kreuzbestand der JOB-2685-Integrationssuite (`job2685-anhang-traeger.integration.test.ts`)
// und seine Node-Übersetzung der vier Arme. Das Modul steht eigenständig, damit der schnelle Test
// `job2685-anhang-bestand.test.ts` die Treffersumme ohne Datenbank aus demselben Bestand ableiten
// kann (BEN Runde 2, B3). Die Integrationssuite vergleicht SQL gegen genau diese Funktionen.
import type { KnowledgeObject } from "../../services/knowledge-object";

const HOCHLADENDER = "u-anna";
const FREMDER = "u-bert";

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Lieferzeiten",
    statement: "Fuenf Werktage.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Logistik",
    tags: [],
    confidence: 50,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: HOCHLADENDER,
    author: HOCHLADENDER,
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    bodyHtml: "<p>Anlage freischalten.</p>",
    ...overrides,
  } as KnowledgeObject;
}

function text(objectId: string): string {
  return `<p>Siehe <img src="/api/objects/${objectId}/raw"></p>`;
}

export interface Fall {
  objectId: string;
  ko: KnowledgeObject;
  fassungen: { author: string; snapshot: KnowledgeObject }[];
  belege: { objectId: string; createdBy: string }[];
}

// Elf Fundarten (wie im schnellen Test), je einmal lebend und einmal im Papierkorb; dazu zwei
// Sonderfälle für die LIKE-Entwertung: eine Kennung MIT `%`/`_`, und ein Objekt, dessen Text einer
// nicht entwerteten Fassung dieser Kennung entspräche.
//
// BEN Runde 2, B3: Die Kennungen sind ZWEISTELLIG (`obj-01` … `obj-22`). Mit `obj-1` … `obj-22`
// war `obj-1` ein Teilstring von `obj-10` … `obj-16`. Der Text-Arm (`includes` bzw. `LIKE`) fand
// deshalb über `obj-1` sieben fremde Fassungstexte, und die Fundarten waren nicht mehr unabhängig:
// Die Summe war 28 statt der erwarteten 22. Jetzt ist keine Kennung Teilstring einer anderen, und
// jeder Fall findet höchstens sein eigenes Objekt.
export function faelle(): Fall[] {
  const out: Fall[] = [];
  let n = 0;
  for (const fundart of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    for (const getrasht of [false, true]) {
      n += 1;
      const objectId = `obj-${String(n).padStart(2, "0")}`;
      const koId = `ko-${n}`;
      const trash = getrasht ? { deletedAt: "2026-08-01T00:00:00.000Z" } : {};
      const basis = ko({ id: koId, ...trash });
      const fall: Fall = { objectId, ko: basis, fassungen: [], belege: [] };
      const att = (author: string) => [
        { id: `att-${n}`, name: "b.png", mime: "image/png", objectId, author },
      ];
      switch (fundart) {
        case 2:
          fall.ko = ko({ id: koId, attachments: att(HOCHLADENDER) as never, ...trash });
          break;
        case 3:
          fall.ko = ko({ id: koId, attachments: att(FREMDER) as never, ...trash });
          break;
        case 4:
          fall.ko = ko({ id: koId, bodyHtml: text(objectId), ...trash });
          break;
        case 5:
        case 6:
          fall.fassungen.push({
            author: fundart === 5 ? HOCHLADENDER : FREMDER,
            snapshot: ko({ id: koId, bodyHtml: text(objectId) }),
          });
          break;
        case 7:
          fall.fassungen.push(
            { author: FREMDER, snapshot: ko({ id: koId }) },
            { author: HOCHLADENDER, snapshot: ko({ id: koId, bodyHtml: text(objectId) }) },
          );
          break;
        case 8:
          fall.fassungen.push(
            { author: FREMDER, snapshot: ko({ id: koId, bodyHtml: text(objectId) }) },
            { author: HOCHLADENDER, snapshot: ko({ id: koId, bodyHtml: text(objectId) }) },
          );
          break;
        case 9:
        case 10:
          fall.belege.push({ objectId, createdBy: fundart === 9 ? HOCHLADENDER : FREMDER });
          break;
        case 11:
          fall.fassungen.push({
            author: HOCHLADENDER,
            snapshot: ko({ id: koId, attachments: att(FREMDER) as never }),
          });
          break;
        default:
          break;
      }
      out.push(fall);
    }
  }
  // LIKE-Entwertung: die Kennung `obj%son_der` darf NUR ihr eigenes Objekt finden — nicht das
  // Nachbarobjekt, dessen Text `objXsonYder` einem nicht entwerteten Muster entspräche.
  out.push({
    objectId: "obj%son_der",
    ko: ko({ id: "ko-sonder", bodyHtml: text("obj%son_der") }),
    fassungen: [],
    belege: [],
  });
  out.push({
    objectId: "obj-nachbar",
    ko: ko({ id: "ko-nachbar", bodyHtml: text("objXsonYder") }),
    fassungen: [],
    belege: [],
  });
  return out;
}

// Die vier Arme, nach Node übersetzt — dieselbe Übersetzung wie im schnellen Test.
function armAnhang(s: KnowledgeObject, objectId: string): boolean {
  return Array.isArray(s.attachments) && s.attachments.some((a) => a.objectId === objectId);
}
function armText(s: KnowledgeObject, objectId: string): boolean {
  return typeof s.bodyHtml === "string" && s.bodyHtml.includes(objectId);
}
export function erwartet(alle: Fall[], objectId: string): string[] {
  return alle
    .filter(
      (f) =>
        armAnhang(f.ko, objectId) ||
        armText(f.ko, objectId) ||
        f.belege.some((b) => b.objectId === objectId) ||
        f.fassungen.some((v) => armAnhang(v.snapshot, objectId) || armText(v.snapshot, objectId)),
    )
    .map((f) => f.ko.id)
    .sort();
}
