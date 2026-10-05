// ================================================================================================
// BELEGDATEI-NEULADEN · R-0146 „DAS ORIGINAL IST REINER SPEICHER" (Tor-Hälfte)
// ================================================================================================
//
// DER ZIELZUSTAND (R-0146): beim Import aus einer Datei wird das Original ZUSÄTZLICH gespeichert
// und mit dem Entwurf verknüpft; AUSGEWERTET wird es dabei nicht.
//
// WAS SCHON GELIEFERT IST und hier NICHT neu gebaut wird: das Speichern (WP-D2,
// `tests/app/capture-from-file.test.ts`), die Verknüpfung über `anchorDocuments` samt Prüfung beim
// Fortsetzen (mega20, `tests/capture/mega20-entwurf-referenz.test.ts`) und der Weg im Browser gegen
// PostgreSQL (JOB 4324, `tests/import-wiederoeffnen-nutzerweg/*`).
//
// WAS BIS HIERHER UNBELEGT WAR (README Lauf 1, Widerspruch 3): „ausgewertet wird das Original
// NICHT". Serverseitig lesen genau drei Stellen Bytes aus dem Objektspeicher
// (`tests/security/g8-medien-analyse-existenzorakel.test.ts`, Kopf): Metadaten, Rohbytes und
// `POST /api/media/analyze`. Nur die dritte wertet aus, und nur Video. Die Oberfläche lädt das
// Original eines Dateiimports IMMER mit `kind: "document"` und `purpose: "anchor"` hoch
// (`apps/web/src/lib/captureAttachments.ts`, `apps/web/src/pages/Capture.tsx`). Diese Datei fährt
// GENAU diesen Aufruf über die echten Routen und belegt am gespeicherten Stand:
//   · der Zweck „anchor" und die Entwurfsbindung stehen am Objekt,
//   · die einzige auswertende Route weist das Original ab (400 UNSUPPORTED_KIND),
//   · die Bytes kommen unverändert zurück,
//   · kein Wort aus dem Original landet im Entwurf — der Server hat nichts daraus gezogen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

// Ein Merkmal, das NUR im Original steht — taucht es irgendwo sonst auf, wurde ausgewertet.
const MERKMAL = "R0146-NUR-IM-ORIGINAL-7f3c";
const ORIGINAL = Buffer.concat([
  Buffer.from(`%PDF-1.4 Wartungsplan ${MERKMAL}\n`),
  Buffer.from([0, 255, 7]),
]);
const DATEI = "Wartungsplan-Presse-4.pdf";

async function aufbau(): Promise<{ app: App; kopf: Kopf }> {
  const app = buildApp(buildServices());
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "r0146@klarwerk.test", password: "geheim12345" },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const an = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "r0146@klarwerk.test", password: "geheim12345" },
  });
  expect(an.statusCode, an.body).toBe(200);
  return { app, kopf: { authorization: `Bearer ${an.json().token}` } };
}

describe("R-0146 · das Original eines Dateiimports wird gespeichert, verknüpft und nicht ausgewertet", () => {
  it("Upload wie die Oberfläche → Zweck und Entwurf am Objekt, Analyse abgewiesen, Bytes gleich, Entwurf ohne Originalinhalt", async () => {
    const { app, kopf } = await aufbau();
    const entwurf = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: kopf,
      payload: {
        title: "Wartung Presse 4",
        statement: "Wartung nach Plan.",
        type: "best_practice",
        category: "Instandhaltung",
        confidentiality: "intern",
        bodyHtml: "<p>Vom Menschen übernommener Text.</p>",
      },
    });
    expect(entwurf.statusCode, entwurf.body).toBeLessThan(300);
    const draftId = entwurf.json().id as string;

    // GENAU der Aufruf der Oberfläche (`Capture.tsx`, Original einer Datei-Warteschlange).
    const hoch = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: kopf,
      payload: {
        name: DATEI,
        mime: "application/pdf",
        data: `data:application/pdf;base64,${ORIGINAL.toString("base64")}`,
        kind: "document",
        purpose: "anchor",
        draftId,
      },
    });
    expect(hoch.statusCode, hoch.body).toBe(201);
    const objectId = hoch.json().id as string;

    // Gespeichert und mit dem Entwurf verknüpft — am erneut gelesenen Objekt.
    const meta = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}`,
      headers: kopf,
    });
    expect(meta.statusCode, meta.body).toBe(200);
    const ref = meta.json().ref as {
      name: string;
      kind: string;
      lifecycle?: { purpose: string; draftId?: string };
    };
    expect(ref.name).toBe(DATEI);
    expect(ref.kind).toBe("document");
    expect(ref.lifecycle?.purpose).toBe("anchor");
    expect(ref.lifecycle?.draftId).toBe(draftId);

    // Die einzige auswertende Route nimmt das Original nicht an.
    const analyse = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers: kopf,
      payload: { objectId, locale: "de" },
    });
    expect(analyse.statusCode, analyse.body).toBe(400);
    expect(analyse.json().error).toBe("UNSUPPORTED_KIND");

    // Reiner Speicher: dieselben Bytes zurück, jedes einzelne.
    const roh = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}/raw`,
      headers: kopf,
    });
    expect(roh.statusCode).toBe(200);
    expect(roh.rawPayload.equals(ORIGINAL), "die Bytes des Originals").toBe(true);

    // Nichts aus dem Original ist in den Entwurf gewandert.
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/drafts/${draftId}`,
      headers: kopf,
    });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    expect(gelesen.body).toContain("Vom Menschen übernommener Text.");
    expect(gelesen.body).not.toContain(MERKMAL);
    await app.close();
  });
});
