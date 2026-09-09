// ================================================================================================
// JOB 3272 · UX-25 · LIEFERUNG 6 — DIE GRENZE ZUM SERVER WIRD GEMESSEN, NICHT ÜBERSCHRITTEN.
// ================================================================================================
//
// DIE FRAGE: Gibt der Server bei einer über UX-22 VERANKERTEN Quelle (`toSourcePayload` mit
// `objectId`, `koSource.ts:137-139`) einen Belegdatensatz mit gefülltem `objectId` zurück? Davon
// hängt ab, ob die Belegkarte einer QUELLE den Weg zum Original anbieten kann.
//
// GEMESSEN — über die echten Routen, in einer echten App (`buildApp`/`buildServices`, Bauform aus
// `tests/app/external-attach-gate-e2e.test.ts`), nicht behauptet:
//
//   NEIN. Der Anker wird auf der Route NUR für die Zulassungsentscheidung nachgeschlagen
//   (`services/app/src/routes/ko-routes.ts:1926-1931`) und danach FALLEN GELASSEN: der Aufruf
//   `ko.addSource(...)` (`:1945-1953`) reicht Label, Adresse, Auszug und den serverseitig
//   abgeleiteten Anbieter weiter — kein `objectId`. Die Signatur von `addSource`
//   (`services/knowledge-object/src/service.ts:2831-2839`) kennt das Feld gar nicht, und der dort
//   geschriebene Belegdatensatz (`:2863-2875`) trägt weder `objectId` noch `attachmentId`.
//   Auch `KoSource` selbst führt kein `objectId` (`apps/web/src/api/types.ts:46-56`) — nach einem
//   Neuladen ist der gewählte Anker nirgends mehr zu lesen.
//
// DIE FOLGE FÜR DIE FLÄCHE, ehrlich: ein Quellbeleg landet in `"keiner"`. Die Belegkarte behauptet
// nichts — weder einen Weg, der ins Leere führte, noch „Original nicht mehr an diesem Objekt", was
// eine negative Aussage ohne Grundlage wäre. Der Fall unten hält genau diesen Ist-Zustand fest.
//
// DIESER AUFTRAG FASST `services/**` NICHT AN (Auftrag §10). Wird die Lücke später geschlossen,
// wird dieser Fall ROT und ist mit der dann richtigen Erwartung nachzuführen — das ist der Zweck:
// die Grenze soll sichtbar bleiben, bis sie sich bewegt.
import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "../../apps/web/src/api/types";
import { belegOriginal, evidenceRows } from "../../apps/web/src/lib/koEvidence";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

async function aufbauen(): Promise<{
  app: App;
  headers: Record<string, string>;
  koId: string;
  objectId: string;
}> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  const koId = ko.json().id as string;
  // Das echte Original in den Object-Store und ans Objekt — DAS ist der Anker, den der Server
  // nachschlägt. Bewusst über die echten Routen.
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
  });
  const objectId = obj.json().id as string;
  const attached = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: {
      action: "attach",
      attachment: { name: "Pruefbericht.pdf", mime: "application/pdf", objectId },
    },
  });
  expect(attached.statusCode).toBe(200);
  return { app, headers, koId, objectId };
}

async function belegeVon(
  app: App,
  headers: Record<string, string>,
  koId: string,
): Promise<EvidenceRecord[]> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${koId}/evidence`, headers });
  expect(res.statusCode).toBe(200);
  return res.json() as EvidenceRecord[];
}

describe("JOB 3272 · UX-25 · Lieferung 6 — was der Server beim Belegdatensatz mitgibt", () => {
  it("KALIBRIERUNG: der ANHANGBELEG trägt seinen Bezug — die Kette trägt also grundsätzlich", async () => {
    const { app, headers, koId, objectId } = await aufbauen();
    const belege = await belegeVon(app, headers, koId);
    const anhangbeleg = belege.find((b) => b.kind === "attachment");
    expect(anhangbeleg, "kein Anhangbeleg angelegt").toBeDefined();
    expect(anhangbeleg?.objectId).toBe(objectId);
    expect(anhangbeleg?.attachmentId, "keine Anhangskennung").toBeTruthy();
  });

  it("GEMESSEN: der QUELLBELEG einer über UX-22 verankerten Quelle trägt KEINEN Bezug", async () => {
    const { app, headers, koId, objectId } = await aufbauen();
    // Genau der Weg der Fläche: adresslose Quelle MIT Anker, auf der restriktiven Vorgabestufe.
    const angehaengt = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "add-source",
        source: { label: "Pruefbericht.pdf", excerpt: "Abschnitt 3.2, Absatz 4", objectId },
      },
    });
    // Der Anker WIRKT — er lässt die Quelle überhaupt erst durch (ko-routes.ts:1926-1931).
    expect(angehaengt.statusCode, "die verankerte Quelle wurde abgewiesen").toBe(200);

    const quellbeleg = (await belegeVon(app, headers, koId)).find((b) => b.kind === "source");
    expect(quellbeleg, "kein Quellbeleg angelegt").toBeDefined();
    // UND ER IST DANACH WEG: das ist die gemessene Lücke, nicht eine Annahme.
    expect(quellbeleg?.objectId, "der Server gibt den Anker inzwischen zurück").toBeUndefined();
    expect(quellbeleg?.attachmentId).toBeUndefined();

    // Die Fläche behauptet daraufhin NICHTS: kein Weg, und kein „nicht mehr an diesem Objekt".
    const [zeile] = evidenceRows([quellbeleg as EvidenceRecord]);
    expect(zeile && belegOriginal(zeile, [{ id: "att-1", objectId }])).toEqual({ art: "keiner" });
  });
});
