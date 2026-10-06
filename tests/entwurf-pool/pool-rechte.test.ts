// ==================================================================================================
// AUFNAHME entwurf-in-gemeinsamen-pool-geben (R-2099, SOLL:FR-CAP-06, R-0036, SOLL:FR-STR-06) —
// DER GEMEINSAME ENTWURFS-POOL AM ECHTEN SERVER.
// ==================================================================================================
//
// Pedi `debbb8e8` („Beides"): ein Entwurf ist standardmäßig privat; der Autor kann einen einzelnen
// Entwurf BEWUSST in den gemeinsamen Pool geben. Pedi `297afc57`: andere Schreibberechtigte dürfen
// einen Pool-Entwurf nur sehen und fortsetzen — Einreichen und Löschen bleiben beim Autor.
//
// Die Regel steht an EINER Stelle (`entwurfSichtbarFuer`, services/app/src/sichtbarkeit.ts) und
// wird hier an JEDEM Leseweg von aussen gemessen, mit echten Konten am echten Server:
//
//   · Anna (Expertin) ist die Autorin.
//   · Otto (Experte) ist ein anderer Schreibberechtigter.
//   · Ada (Administratorin) ist ebenfalls schreibberechtigt — und ohne Pool trotzdem draussen.
//   · Vera (Betrachterin, kein `ko.create`) ist NICHT schreibberechtigt.
//
// Je Leseweg steht die Gegenprobe daneben: derselbe Weg auf einen PRIVATEN Entwurf bleibt zu.
// Gegenproben am Code (lokal nicht ausgeführt, s. Rückgabe): ohne die Pool-Bedingung in
// `entwurfSichtbarFuer` sind P2–P6 rot; mit `canSeeDraft` statt `canManageDraft` an Löschen/Einreichen
// sind R1–R3 rot.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MELDUNGEN } from "../../services/auth/src/meldungen";

type Services = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

// Vollständig genug zum Einreichen (Stufe ist Pflicht, JOB 3082).
const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  confidentiality: "intern",
};

async function anmelden(app: App, email: string): Promise<{ kopf: Kopf; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(res.statusCode).toBe(200);
  return { kopf: { authorization: `Bearer ${res.json().token}` }, id: res.json().user.id };
}

async function buehne() {
  const services: Services = buildServices();
  const app = buildApp(services);
  // Die erste Registrierung ist die Administratorin.
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: "ada@x.de", password: "secret123" },
  });
  const ada = await anmelden(app, "ada@x.de");
  for (const [name, email, role] of [
    ["Anna", "anna@x.de", "experte"],
    ["Otto", "otto@x.de", "experte"],
    ["Vera", "vera@x.de", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: ada.kopf,
      payload: { name, email, password: "secret123", role },
    });
    expect(res.statusCode, res.body).toBeLessThan(300);
  }
  const anna = await anmelden(app, "anna@x.de");
  const otto = await anmelden(app, "otto@x.de");
  const vera = await anmelden(app, "vera@x.de");

  // Ein Bild, das Anna hochlädt und in BEIDEN Entwürfen trägt — jeder Entwurf mit eigenem Bild,
  // damit der Anhang-Leseweg je Entwurf getrennt messbar ist.
  const bild = async (): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: anna.kopf,
      payload: {
        name: "typenschild.png",
        mime: "image/png",
        data: PNG_DATA_URL,
        kind: "image",
        purpose: "attachment",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  };
  const poolBild = await bild();
  const privatBild = await bild();
  const anlegen = async (titel: string, objectId: string): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: anna.kopf,
      payload: {
        ...INHALT,
        title: titel,
        bodyHtml: `<p>Zwischenstand Linie 4.</p><p><img src="/api/objects/${objectId}/raw"></p>`,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  };
  const poolId = await anlegen("Annas geteilter Entwurf", poolBild);
  const privatId = await anlegen("Annas privater Entwurf", privatBild);
  return { app, services, ada, anna, otto, vera, poolId, privatId, poolBild, privatBild };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

function inPool(b: Buehne, kopf: Kopf, id: string, imPool: boolean) {
  return b.app.inject({
    method: "PUT",
    url: `/api/drafts/${id}/pool`,
    headers: kopf,
    payload: { imPool },
  });
}

async function listenIds(b: Buehne, kopf: Kopf, url = "/api/drafts"): Promise<string[] | number> {
  const res = await b.app.inject({ method: "GET", url, headers: kopf });
  if (res.statusCode !== 200) {
    return res.statusCode;
  }
  return (res.json() as { id: string }[]).map((d) => d.id);
}

// ================================================================================================
// K1 — OHNE BEWUSSTE HANDLUNG BLEIBT JEDER ENTWURF PRIVAT.
// ================================================================================================
describe("K1 · ohne die bewusste Handlung ist kein Entwurf im Pool", () => {
  it("P0 · frisch angelegt, gespeichert, fortgesetzt: kein Entwurf trägt `imPool`, niemand sonst sieht ihn", async () => {
    const b = await buehne();
    // Auch ein Speichern mit einem eingeschmuggelten `imPool` in der Nutzlast teilt nichts: das
    // Feld steht am Entwurf, nicht in der Nutzlast, und kein Speicherweg setzt es.
    const geschmuggelt = await b.app.inject({
      method: "PUT",
      url: `/api/drafts/${b.privatId}`,
      headers: b.anna.kopf,
      payload: { statement: "Weiter.", imPool: true },
    });
    expect(geschmuggelt.statusCode).toBe(200);
    expect((await b.services.capture.getDraft(b.privatId))?.imPool).toBeUndefined();
    expect((await b.services.capture.getDraft(b.poolId))?.imPool).toBeUndefined();

    for (const wer of [b.otto, b.ada]) {
      const ids = await listenIds(b, wer.kopf);
      expect(ids).toEqual([]);
      for (const id of [b.poolId, b.privatId]) {
        const einzel = await b.app.inject({
          method: "GET",
          url: `/api/drafts/${id}`,
          headers: wer.kopf,
        });
        expect(einzel.statusCode).toBe(403);
        expect(einzel.body).not.toContain("Linie 4");
      }
    }
    // Anhänge: weder die Administratorin noch ein Kollege bekommt die Bytes.
    for (const wer of [b.otto, b.ada, b.vera]) {
      const roh = await b.app.inject({
        method: "GET",
        url: `/api/objects/${b.poolBild}/raw`,
        headers: wer.kopf,
      });
      expect(roh.statusCode).toBe(404);
    }
  });

  it("P1 · eine frühere Bearbeitung (lastEditor) öffnet auch mit Pool-Funktion nichts", async () => {
    const b = await buehne();
    await b.services.capture.continueDraft(b.privatId, {}, b.ada.id);
    expect((await b.services.capture.getDraft(b.privatId))?.lastEditor).toBe(b.ada.id);
    const einzel = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.privatId}`,
      headers: b.ada.kopf,
    });
    const roh = await b.app.inject({
      method: "GET",
      url: `/api/objects/${b.privatBild}/raw`,
      headers: b.ada.kopf,
    });
    expect({ einzel: einzel.statusCode, roh: roh.statusCode }).toEqual({ einzel: 403, roh: 404 });
  });
});

// ================================================================================================
// K2 — DIE BEWUSSTE HANDLUNG: NUR DER AUTOR, NUR FÜR DIESEN EINEN ENTWURF.
// ================================================================================================
describe("K2 · der Autor gibt einen eigenen Entwurf in den Pool — und nur er", () => {
  it("A1 · Anna gibt ihren Entwurf in den Pool und nimmt ihn zurück; der andere bleibt privat", async () => {
    const b = await buehne();
    const geben = await inPool(b, b.anna.kopf, b.poolId, true);
    expect(geben.statusCode, geben.body).toBe(200);
    expect(geben.json().imPool).toBe(true);
    expect((await b.services.capture.getDraft(b.poolId))?.imPool).toBe(true);
    expect((await b.services.capture.getDraft(b.privatId))?.imPool).toBeUndefined();
    // Die Nutzlast ist unberührt.
    expect(geben.json().payload.title).toBe("Annas geteilter Entwurf");

    const nehmen = await inPool(b, b.anna.kopf, b.poolId, false);
    expect(nehmen.statusCode).toBe(200);
    expect("imPool" in nehmen.json()).toBe(false);
    expect(await listenIds(b, b.otto.kopf)).toEqual([]);
  });

  it("A2 · ein anderer Schreibberechtigter kann einen fremden Entwurf weder teilen noch zurücknehmen", async () => {
    const b = await buehne();
    // Privat: der Entwurf ist für ihn nicht da (403 wie jeder andere Entwurfsweg).
    expect((await inPool(b, b.otto.kopf, b.privatId, true)).statusCode).toBe(403);
    expect((await inPool(b, b.ada.kopf, b.privatId, true)).statusCode).toBe(403);
    // Im Pool: sichtbar, aber nicht seiner — zurücknehmen darf er ihn nicht.
    expect((await inPool(b, b.anna.kopf, b.poolId, true)).statusCode).toBe(200);
    const fremd = await inPool(b, b.otto.kopf, b.poolId, false);
    expect(fremd.statusCode).toBe(403);
    expect(fremd.json().error).toBe("FORBIDDEN");
    expect((await b.services.capture.getDraft(b.poolId))?.imPool).toBe(true);
    expect((await b.services.capture.getDraft(b.privatId))?.imPool).toBeUndefined();
  });

  it("A3 · ohne Wahrheitswert ist es ein Eingabefehler, und es ändert sich nichts", async () => {
    const b = await buehne();
    for (const payload of [{}, { imPool: "ja" }, { imPool: 1 }]) {
      const res = await b.app.inject({
        method: "PUT",
        url: `/api/drafts/${b.poolId}/pool`,
        headers: b.anna.kopf,
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
    expect((await b.services.capture.getDraft(b.poolId))?.imPool).toBeUndefined();
  });

  // Nacharbeit 1 (Q9): der Satz des Eingabefehlers kommt aus dem Katalog (`DRAFT_POOL_INVALID`)
  // und spricht die Sprache der Sitzung — wörtlich und über den Katalog gehalten.
  const ohneWahrheitswert = async (sprache: string) => {
    const b = await buehne();
    const res = await b.app.inject({
      method: "PUT",
      url: `/api/drafts/${b.poolId}/pool`,
      headers: { ...b.anna.kopf, "accept-language": sprache },
      payload: { imPool: "ja" },
    });
    expect((await b.services.capture.getDraft(b.poolId))?.imPool).toBeUndefined();
    return { status: res.statusCode, koerper: res.json() as { error?: string; message?: string } };
  };

  it("A3b EN · Pool-Schalter ohne Wahrheitswert: 400 BAD_REQUEST mit englischem Satz", async () => {
    const antwort = await ohneWahrheitswert("en");
    expect(antwort.status).toBe(400);
    expect(antwort.koerper.error).toBe("BAD_REQUEST");
    expect(antwort.koerper.message).toBe(
      "Whether the draft is in the shared pool needs imPool: true or false. Nothing was changed.",
    );
    expect(antwort.koerper.message).toBe(MELDUNGEN.DRAFT_POOL_INVALID.en);
  });

  it("A3c NL · Pool-Schalter ohne Wahrheitswert: 400 BAD_REQUEST mit niederländischem Satz", async () => {
    const antwort = await ohneWahrheitswert("nl");
    expect(antwort.status).toBe(400);
    expect(antwort.koerper.error).toBe("BAD_REQUEST");
    expect(antwort.koerper.message).toBe(
      "Of het concept in de gedeelde pool staat, vraagt imPool: true of false. Er is niets gewijzigd.",
    );
    expect(antwort.koerper.message).toBe(MELDUNGEN.DRAFT_POOL_INVALID.nl);
  });

  it("A4 ·eine Betrachterin ohne Schreibrecht kommt an den Weg nicht heran", async () => {
    const b = await buehne();
    expect((await inPool(b, b.vera.kopf, b.poolId, true)).statusCode).toBe(403);
  });
});

// ================================================================================================
// K3 — POOL-ENTWURF: FÜR ALLE SCHREIBBERECHTIGTEN SICHTBAR UND FORTSETZBAR, JE LESEWEG MIT GEGENPROBE.
// ================================================================================================
describe("K3 · ein Pool-Entwurf ist für alle Schreibberechtigten da — ein privater bleibt es nicht", () => {
  it("P2 · Liste: Otto und Ada sehen den Pool-Entwurf mit Autorangabe, den privaten nicht; Vera keinen", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    for (const wer of [b.otto, b.ada]) {
      const res = await b.app.inject({ method: "GET", url: "/api/drafts", headers: wer.kopf });
      expect(res.statusCode).toBe(200);
      const liste = res.json() as { id: string; originalAuthor: string; imPool?: true }[];
      expect(liste.map((d) => d.id)).toEqual([b.poolId]);
      // Autorangabe: der Ersteller reist mit (die Oberfläche löst ihn über das Verzeichnis auf).
      expect(liste[0]?.originalAuthor).toBe(b.anna.id);
      expect(liste[0]?.imPool).toBe(true);
    }
    // Die Autorin sieht weiterhin beide.
    expect(new Set((await listenIds(b, b.anna.kopf)) as string[])).toEqual(
      new Set([b.poolId, b.privatId]),
    );
    // Ohne Schreibrecht kein Entwurfsweg.
    expect(await listenIds(b, b.vera.kopf)).toBe(403);
  });

  it("P3 · Einzelabruf: Pool-Entwurf 200 mit Inhalt, privater 403 ohne Inhalt", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    const pool = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.poolId}`,
      headers: b.otto.kopf,
    });
    expect(pool.statusCode).toBe(200);
    expect(pool.json().payload.bodyHtml).toContain("Linie 4");
    expect(pool.json().originalAuthor).toBe(b.anna.id);
    const privat = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.privatId}`,
      headers: b.otto.kopf,
    });
    expect(privat.statusCode).toBe(403);
    expect(privat.body).not.toContain("Annas privater Entwurf");
  });

  it("P4 · nächster Schritt: Pool-Entwurf 200, privater 403", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    const schritt = (id: string) =>
      b.app.inject({
        method: "GET",
        url: `/api/drafts/${id}/naechster-schritt`,
        headers: b.otto.kopf,
      });
    expect((await schritt(b.poolId)).statusCode).toBe(200);
    expect((await schritt(b.privatId)).statusCode).toBe(403);
  });

  it("P5 · Anhang: die Bytes des Pool-Entwurfs ja, die des privaten nein — ohne Schreibrecht keine", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    const roh = (kopf: Kopf, id: string) =>
      b.app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers: kopf });
    expect({
      ottoPool: (await roh(b.otto.kopf, b.poolBild)).statusCode,
      adaPool: (await roh(b.ada.kopf, b.poolBild)).statusCode,
      ottoPrivat: (await roh(b.otto.kopf, b.privatBild)).statusCode,
      adaPrivat: (await roh(b.ada.kopf, b.privatBild)).statusCode,
      veraPool: (await roh(b.vera.kopf, b.poolBild)).statusCode,
      annaPrivat: (await roh(b.anna.kopf, b.privatBild)).statusCode,
    }).toEqual({
      ottoPool: 200,
      adaPool: 200,
      ottoPrivat: 404,
      adaPrivat: 404,
      veraPool: 404,
      annaPrivat: 200,
    });
  });

  it("P6 · Fortsetzen: Otto schreibt im Pool-Entwurf weiter — derselbe Entwurf, Autorin bleibt Anna; privat 403", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    const vorher = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.poolId}`,
      headers: b.otto.kopf,
    });
    const weiter = await b.app.inject({
      method: "PUT",
      url: `/api/drafts/${b.poolId}`,
      headers: b.otto.kopf,
      payload: {
        statement: "Ergänzt von Otto: Drehmoment 40 Nm.",
        expectedUpdatedAt: vorher.json().updatedAt,
      },
    });
    expect(weiter.statusCode, weiter.body).toBe(200);
    expect(weiter.json().originalAuthor).toBe(b.anna.id);
    expect(weiter.json().lastEditor).toBe(b.otto.id);
    expect(weiter.json().imPool).toBe(true);
    // Kein zweiter Entwurfsspeicher: Anna liest Ottos Stand an DERSELBEN Kennung.
    const beiAnna = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.poolId}`,
      headers: b.anna.kopf,
    });
    expect(beiAnna.json().payload.statement).toBe("Ergänzt von Otto: Drehmoment 40 Nm.");
    expect((await b.services.capture.listDrafts()).length).toBe(2);

    const privat = await b.app.inject({
      method: "PUT",
      url: `/api/drafts/${b.privatId}`,
      headers: b.otto.kopf,
      payload: { statement: "Übernommen." },
    });
    expect(privat.statusCode).toBe(403);
  });

  it("P7 · zurückgenommen: derselbe Entwurf ist sofort wieder auf allen Lesewegen zu", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    await inPool(b, b.anna.kopf, b.poolId, false);
    expect(await listenIds(b, b.otto.kopf)).toEqual([]);
    expect(
      (await b.app.inject({ method: "GET", url: `/api/drafts/${b.poolId}`, headers: b.otto.kopf }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await b.app.inject({
          method: "GET",
          url: `/api/objects/${b.poolBild}/raw`,
          headers: b.otto.kopf,
        })
      ).statusCode,
    ).toBe(404);
  });
});

// ================================================================================================
// K5 — EINGEREICHT: KEIN GEISTER-ENTWURF IM POOL.
// ================================================================================================
describe("K5 · wird ein Pool-Entwurf eingereicht, ist er aus dem Pool verschwunden", () => {
  it("G1 · Anna reicht ihren Pool-Entwurf ein (nach Ottos Ergänzung): genau ein Objekt, kein Entwurf mehr — für niemanden", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    await b.services.capture.continueDraft(b.poolId, { statement: "Ergänzt von Otto." }, b.otto.id);

    const einreichen = await b.app.inject({
      method: "POST",
      url: `/api/drafts/${b.poolId}/promote`,
      headers: b.anna.kopf,
      payload: { operationId: "pool-einreichen-0001" },
    });
    expect(einreichen.statusCode, einreichen.body).toBe(201);
    // Der Autor des Objekts ist die Autorin des Entwurfs (FR-CAP-07), nicht der letzte Bearbeiter.
    expect(einreichen.json().author).toBe(b.anna.id);

    expect(await listenIds(b, b.otto.kopf)).toEqual([]);
    expect(await listenIds(b, b.ada.kopf)).toEqual([]);
    expect(await listenIds(b, b.anna.kopf)).toEqual([b.privatId]);
    for (const wer of [b.otto, b.anna]) {
      const einzel = await b.app.inject({
        method: "GET",
        url: `/api/drafts/${b.poolId}`,
        headers: wer.kopf,
      });
      expect(einzel.statusCode).toBe(404);
    }
    // Auch nicht im Papierkorb und nicht in der Ablage — verbraucht, nicht gelöscht.
    expect(await listenIds(b, b.anna.kopf, "/api/drafts/trash")).toEqual([]);
    expect(await listenIds(b, b.otto.kopf, "/api/drafts/trash")).toEqual([]);
    expect((await b.services.capture.listDrafts()).map((d) => d.id)).toEqual([b.privatId]);

    // Die Wiederholung desselben Vorgangs legt nichts nach und holt keinen Entwurf zurück.
    const nochmal = await b.app.inject({
      method: "POST",
      url: `/api/drafts/${b.poolId}/promote`,
      headers: b.anna.kopf,
      payload: { operationId: "pool-einreichen-0001" },
    });
    expect(nochmal.statusCode).toBe(200);
    const kos = await b.app.inject({ method: "GET", url: "/api/kos", headers: b.anna.kopf });
    expect((kos.json() as unknown[]).length).toBe(1);
    expect(await listenIds(b, b.otto.kopf)).toEqual([]);
  });
});

// ================================================================================================
// K6 — SEHEN UND FORTSETZEN JA, EINREICHEN UND LÖSCHEN NEIN (297afc57) — DIE SERVERHÄLFTE.
// ================================================================================================
describe("K6 · Einreichen und Löschen eines Pool-Entwurfs bleiben beim Autor", () => {
  it("R1 · Otto und Ada: Löschen 403, der Entwurf bleibt im Pool und nicht im Papierkorb", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    for (const wer of [b.otto, b.ada]) {
      const res = await b.app.inject({
        method: "DELETE",
        url: `/api/drafts/${b.poolId}`,
        headers: wer.kopf,
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    }
    expect(await listenIds(b, b.otto.kopf)).toEqual([b.poolId]);
    expect(await listenIds(b, b.anna.kopf, "/api/drafts/trash")).toEqual([]);
  });

  it("R2 · Otto und Ada: Einreichen 403 — es entsteht kein Objekt, und der Entwurf bleibt unverändert", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    for (const [wer, schluessel] of [
      [b.otto, "fremd-pool-einreichen-1"],
      [b.ada, "fremd-pool-einreichen-2"],
    ] as const) {
      const res = await b.app.inject({
        method: "POST",
        url: `/api/drafts/${b.poolId}/promote`,
        headers: wer.kopf,
        // Mit mitgeschicktem Stand: auch er darf nicht vorher geschrieben werden.
        payload: { operationId: schluessel, draftPayload: { title: "Von Otto eingereicht" } },
      });
      expect(res.statusCode).toBe(403);
    }
    const kos = await b.app.inject({ method: "GET", url: "/api/kos", headers: b.anna.kopf });
    expect((kos.json() as unknown[]).length).toBe(0);
    expect((await b.services.capture.getDraft(b.poolId))?.payload.title).toBe(
      "Annas geteilter Entwurf",
    );
  });

  it("R3 · Otto: auch der Dokumentweg (`POST /api/kos/from-document` mit draftId) reicht den Pool-Entwurf nicht ein", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    const obj = await b.app.inject({
      method: "POST",
      url: "/api/objects",
      headers: b.otto.kopf,
      payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
    });
    expect(obj.statusCode).toBeLessThan(300);
    const objectId = obj.json().id as string;
    const gesehen = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.poolId}`,
      headers: b.otto.kopf,
    });
    const res = await b.app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers: b.otto.kopf,
      payload: {
        operationId: "fremd-pool-dokument-1",
        draftId: b.poolId,
        draftPayload: {},
        expectedUpdatedAt: gesehen.json().updatedAt,
        documents: [
          {
            anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
            points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung vor jedem Anlauf prüfen." }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(403);
    const kos = await b.app.inject({ method: "GET", url: "/api/kos", headers: b.anna.kopf });
    expect((kos.json() as unknown[]).length).toBe(0);
    expect(await listenIds(b, b.otto.kopf)).toEqual([b.poolId]);
  });

  it("R4 · Gegenrichtung: die Autorin kann ihren Pool-Entwurf weiterhin löschen und wiederherstellen — der Papierkorb gehört ihr allein", async () => {
    const b = await buehne();
    await inPool(b, b.anna.kopf, b.poolId, true);
    const loeschen = await b.app.inject({
      method: "DELETE",
      url: `/api/drafts/${b.poolId}`,
      headers: b.anna.kopf,
    });
    expect(loeschen.statusCode).toBe(204);
    expect(await listenIds(b, b.otto.kopf)).toEqual([]);
    expect(await listenIds(b, b.anna.kopf, "/api/drafts/trash")).toEqual([b.poolId]);
    expect(await listenIds(b, b.otto.kopf, "/api/drafts/trash")).toEqual([]);
    // Im Papierkorb öffnet der Pool auch die Anhänge nicht mehr.
    expect(
      (
        await b.app.inject({
          method: "GET",
          url: `/api/objects/${b.poolBild}/raw`,
          headers: b.otto.kopf,
        })
      ).statusCode,
    ).toBe(404);
    // Otto kann ihn weder zurückholen noch endgültig löschen.
    expect(
      (
        await b.app.inject({
          method: "POST",
          url: `/api/drafts/${b.poolId}/restore`,
          headers: b.otto.kopf,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await b.app.inject({
          method: "DELETE",
          url: `/api/drafts/trash/${b.poolId}`,
          headers: b.otto.kopf,
        })
      ).statusCode,
    ).toBe(404);
    // Anna holt ihn zurück — er ist wieder im Pool.
    const zurueck = await b.app.inject({
      method: "POST",
      url: `/api/drafts/${b.poolId}/restore`,
      headers: b.anna.kopf,
    });
    expect(zurueck.statusCode).toBe(200);
    expect(await listenIds(b, b.otto.kopf)).toEqual([b.poolId]);
  });
});
