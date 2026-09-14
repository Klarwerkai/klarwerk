// ================================================================================================
// JOB 3934 · DER PROMOTE NIMMT DEN INHALT MIT — UND SEINE HERKUNFT.
// ================================================================================================
//
// Diese Datei ist die UMKEHRUNG von `befund-promote-verliert-die-herkunft.test.ts`. Dort wurde
// gemessen und festgenagelt: ein Entwurf mit gesichertem Originaldokument wurde über
// `POST /api/drafts/:id/promote` zu einem Wissensobjekt mit dem Satz AUS der Datei und
// `sources: []` — Dokumentinhalt ohne Herkunft. Hier steht die Zusage, die an dieselbe Strecke
// tritt: die Belegstellen des Entwurfs (`pendingSources`) stehen danach AM Wissensobjekt.
//
// Die Strecke ist von der Befunddatei ÜBERNOMMEN, nicht neu erfunden: dieselbe echte `sample.docx`,
// dasselbe `POST /api/objects` mit `purpose: "anchor"`, dieselbe Kalibrierung des gespeicherten
// Entwurfs (der Anker ist WIRKLICH gespeichert — sonst läge der Fehler vor dem Promote), derselbe
// `QUELLSATZ` aus `./strecke`.
//
// ------------------------------------------------------------------------------------------------
// DREI GRENZEN, DIE HIER GEMESSEN UND NICHT BEHAUPTET WERDEN
// ------------------------------------------------------------------------------------------------
//
// (1) DIE BELEGSTELLE ZEIGT NICHT AUF DAS ORIGINAL. `KoSource`
//     (`services/knowledge-object/src/types.ts:151-169`) hat kein `objectId`- und kein
//     `anchorKey`-Feld; `CreateKoInput.sources` (`services/knowledge-object/src/service.ts:330`)
//     nimmt genau diesen Typ. Die stärkste WAHRE Aussage ist deshalb: das Original war im
//     Augenblick des Einreichens nachweislich vorhanden (`verifyDraftAnchors`,
//     `services/capture/src/service.ts:954-960`), und die Belegstelle trägt seinen NAMEN und den
//     Satz aus ihm. H1 prüft beides und zusätzlich, dass das gesicherte Original unter seiner
//     Kennung wirklich abrufbar ist. H4 hält die Gegenkante: fehlt das Original, entsteht kein
//     Objekt.
//
// (2) DIE STUFENREGEL GILT — UND SIE IST DIE KORREKTUR AUS RUNDE 3. Hier stand in Runde 2: „die
//     Adresse reist nicht mit, das ist fail-closed". Das war FALSCH, und BEN hat es gemessen: auf
//     `blocked` und auf der Werksvorgabe `search_on_click` weist `add-source` eine Quelle mit
//     öffentlicher Adresse UND eine adresslose Quelle ohne Hausbezug mit 403
//     `EXTERNAL_ATTACH_BLOCKED` ab (`decideExternalAttach`,
//     `services/external-search/src/attach-policy.ts:197-211`) — der Promote nahm beide an. Eine
//     Adresse zu entfernen macht eine Quelle also nicht erlaubt, nur unkenntlich.
//     Seit Runde 3 befragt der Promote dieselbe Stufe mit denselben serverseitigen Tatsachen
//     (verdrahtet in `services/app/src/build-app.ts`, `pruefeBelegstelle`). Folge: was die Stufe
//     verbietet, bricht den Weg ab (H5 — vier Fälle, je gegen `add-source` verglichen); was sie
//     erlaubt, reist VOLLSTÄNDIG mit, Adresse inbegriffen (H3).
//     EHRLICHE GRENZE: der Promote antwortet mit demselben Fehlernamen, aber mit 400 statt 403 —
//     `STATUS_BY_CODE` in `services/app/src/http.ts` kennt den Namen nicht, und diese Datei liegt
//     ausserhalb der Zielpfade. In H5 gepinnt und in der Rückgabe als ABWEICHUNG benannt.
//
// (3) DIE BELEGKETTE BLEIBT LEER. `ko.create` → `finishCreated`
//     (`services/knowledge-object/src/service.ts:1929-1947`) schreibt KEINEN `EvidenceRecord`; das
//     tut nur `createWithDocumentsLocked` (`:2166-2195`). H1 MISST das und pinnt es als Tatsache:
//     die append-only Belegkette dieses Weges ist damit noch NICHT geschlossen. Sie zu schliessen
//     bräuchte einen Schreibweg in `services/knowledge-object/**` und ist in JOB 3934
//     ausdrücklich nicht bestellt (Auftrag §10).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { QUELLSATZ } from "./strecke";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Die Pflichtfelder, ohne die `toKoInput` mit INCOMPLETE bzw. MISSING_CONFIDENTIALITY abbricht. */
const PFLICHT = {
  title: "Ventil bei Überdruck",
  statement: "Bei Überdruck wird das Ventil geschlossen.",
  type: "best_practice",
  category: "Wartung",
  confidentiality: "intern",
} as const;

type Belegstelle = {
  id: string;
  label: string;
  url: string | null;
  excerpt: string | null;
  kind: string;
  peerValidated: boolean;
  provider?: string | null;
  author: string;
  at: string;
};

type Wissensobjekt = {
  id: string;
  author: string;
  bodyHtml?: string | null;
  sources?: Belegstelle[];
};

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  const einrichten = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { name: "Demo", email: "herkunft@job3934.test", password: "vorfuehrung12345" },
  });
  expect(einrichten.statusCode, einrichten.body).toBe(201);
  const kopf = { cookie: String(einrichten.headers["set-cookie"] ?? "").split(";")[0] ?? "" };
  return { services, app, kopf };
}

/** Die echte Datei herein — derselbe Weg wie in der Strecke und in der Befunddatei. */
function bytes(): Buffer {
  return readFileSync(join(__dirname, "..", "fixtures", "sample.docx"));
}

async function entwurfAusDocx(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  kopf: Record<string, string>,
): Promise<string> {
  const entwurf = await app.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    headers: kopf,
    payload: { name: "sample.docx", data: bytes().toString("base64") },
  });
  expect(entwurf.statusCode, entwurf.body).toBe(201);
  return (entwurf.json() as { id: string }).id;
}

/** Das Original GESICHERT — es existiert also wirklich, die Ankerprüfung hat nichts zu beanstanden. */
async function originalSichern(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  kopf: Record<string, string>,
  entwurfId: string,
): Promise<string> {
  const daten = bytes().toString("base64");
  const objekt = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: kopf,
    payload: {
      name: "sample.docx",
      mime: DOCX_MIME,
      data: `data:${DOCX_MIME};base64,${daten}`,
      kind: "document",
      purpose: "anchor",
      draftId: entwurfId,
    },
  });
  expect(objekt.statusCode, objekt.body).toBe(201);
  return (objekt.json() as { id: string }).id;
}

/**
 * KALIBRIERUNG, wörtlich von der Befunddatei übernommen (`befund-…:119-132`): der gespeicherte
 * Entwurf trägt den Anker WIRKLICH. Ohne diese Zeilen könnte ein Ergebnis auch daran liegen, dass
 * die Persistenz ihn nie angenommen hat — das wäre ein anderer Mangel an einer anderen Stelle.
 */
async function speichernUndKalibrieren(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  kopf: Record<string, string>,
  entwurfId: string,
  stand: Record<string, unknown>,
  erwarteterAnker: string | null,
): Promise<void> {
  const gespeichert = await app.inject({
    method: "PUT",
    url: `/api/drafts/${entwurfId}`,
    headers: kopf,
    payload: stand,
  });
  expect(gespeichert.statusCode, gespeichert.body).toBe(200);
  const nachgelesen = await app.inject({
    method: "GET",
    url: `/api/drafts/${entwurfId}`,
    headers: kopf,
  });
  const gelesen = nachgelesen.json() as {
    payload?: {
      anchorDocuments?: { objectId?: string }[];
      pendingSources?: { label?: string }[];
    };
    anchorsMissing?: string[];
  };
  expect(gelesen.payload?.anchorDocuments?.[0]?.objectId ?? null).toBe(erwarteterAnker);
  expect(gelesen.anchorsMissing ?? []).toEqual([]);
  // Und die Belegstellen sind auch wirklich angekommen — in derselben Zahl wie geschickt.
  expect(gelesen.payload?.pendingSources ?? []).toHaveLength(
    (stand.pendingSources as unknown[] | undefined)?.length ?? 0,
  );
}

async function einreichen(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  kopf: Record<string, string>,
  entwurfId: string,
  stand: Record<string, unknown>,
  vorgang: string,
) {
  return app.inject({
    method: "POST",
    url: `/api/drafts/${entwurfId}/promote`,
    headers: kopf,
    payload: { operationId: vorgang, draftPayload: stand },
  });
}

// ================================================================================================
// JOB 3934 R4 — DIE ZWEITE BÜHNE: ZWEI MENSCHEN, DIE EINANDER NICHTS ZEIGEN DÜRFEN.
// ================================================================================================
//
// H8 braucht etwas, das die anderen Fälle nicht brauchen: ein Original, das dem Einreichenden NICHT
// gehört und das er NICHT lesen darf. Ein einziges Konto kann das nicht herstellen. Der Aufbau ist
// der von `tests/security/mega78-traeger-nachweis.test.ts:47-77` übernommen, nicht neu erfunden:
// ein Admin legt zwei `experte`-Konten an, beide dürfen anlegen und überarbeiten, und keines ist
// Admin — sonst sähe der Einreichende den fremden Bestand ohnehin.
type Anmeldung = { authorization: string };

async function anmelden(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  email: string,
): Promise<Anmeldung> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "vorfuehrung12345" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${(res.json() as { token: string }).token}` };
}

/** Admin (für die Stufe) · OPFER (lädt das Original) · EINREICHER (versucht den Promote). */
async function zweiKonten(marke: string) {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  const einrichten = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "vorfuehrung12345" },
  });
  expect(einrichten.statusCode, einrichten.body).toBe(201);
  const admin = await anmelden(app, `admin@${marke}.test`);
  for (const email of [`opfer@${marke}.test`, `einreicher@${marke}.test`]) {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "vorfuehrung12345", role: "experte" },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
  }
  return {
    app,
    admin,
    opfer: await anmelden(app, `opfer@${marke}.test`),
    einreicher: await anmelden(app, `einreicher@${marke}.test`),
  };
}

/** Ein Original hochladen — `purpose: "anchor"`, wie auf dem echten Weg. */
async function originalHochladen(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  wer: Record<string, string>,
): Promise<string> {
  const daten = bytes().toString("base64");
  const objekt = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    payload: {
      name: "sample.docx",
      mime: DOCX_MIME,
      data: `data:${DOCX_MIME};base64,${daten}`,
      kind: "document",
      purpose: "anchor",
    },
  });
  expect(objekt.statusCode, objekt.body).toBe(201);
  return (objekt.json() as { id: string }).id;
}

/**
 * JOB 3934 R3: die Admin-Stufe „externes Wissen" AUSDRÜCKLICH setzen, statt sich auf die
 * Werksvorgabe zu verlassen. Die Werksvorgabe ist `search_on_click` und damit RESTRIKTIV
 * (`services/external-search/src/policy.ts:21`) — wer das nicht hinschreibt, prüft die
 * Quellensperre versehentlich immer nur auf einer einzigen Stufe.
 */
async function stufeSetzen(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  kopf: Record<string, string>,
  stufe: "blocked" | "search_on_click" | "search_attach" | "open",
): Promise<void> {
  const gesetzt = await app.inject({
    method: "PUT",
    url: "/api/external/policy",
    headers: kopf,
    payload: { stage: stufe },
  });
  expect(gesetzt.statusCode, gesetzt.body).toBe(200);
}

describe("JOB 3934 · der Promote trägt die Herkunft des Entwurfs ans Wissensobjekt", () => {
  it("H1 · ein Entwurf mit gesichertem Original wird ein Objekt MIT genau einer Belegstelle", async () => {
    const { app, kopf } = await buehne();
    try {
      const entwurfId = await entwurfAusDocx(app, kopf);
      const objektId = await originalSichern(app, kopf, entwurfId);
      const stand = {
        ...PFLICHT,
        pendingSources: [
          { label: "sample.docx", excerpt: QUELLSATZ, anchorKey: "anker-1", objectId: objektId },
        ],
        anchorDocuments: [
          { key: "anker-1", objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfId, stand, objektId);

      const befoerdert = await einreichen(
        app,
        kopf,
        entwurfId,
        stand,
        "3934herk-0000-4000-8000-000000000001",
      );
      expect(befoerdert.statusCode, befoerdert.body).toBe(201);
      const ko = befoerdert.json() as Wissensobjekt;
      // Der Text aus der Datei ist da — wie im Befund.
      expect(ko.bodyHtml ?? "").toContain(QUELLSATZ);

      // ---- DIE ZUSAGE: GENAU EINE Belegstelle, mit KONKRETEN Werten -------------------------
      // Keine `toBeTruthy`-Zusage und kein `length > 0`: geprüft werden die Anzahl und jeder
      // einzelne Wert (Lehre JOB 3899 R1, 13.09. — „gegen konkrete erwartete Zielkennungen und
      // Anzahlen").
      const quellen = ko.sources ?? [];
      expect(
        quellen,
        "WENN DIESE ZEILE ROT IST, fällt die Herkunft beim Einreichen wieder weg.",
      ).toHaveLength(1);
      const quelle = quellen[0] as Belegstelle;
      expect(quelle.label).toBe("sample.docx");
      expect(quelle.excerpt).toBe(QUELLSATZ);
      expect(quelle.kind).toBe("external");
      expect(quelle.peerValidated).toBe(false);
      // Dieser Entwurf trug keine Adresse, und deshalb steht hier `null` — nicht, weil der Promote
      // Adressen wegnimmt (das tat Runde 2 und war falsch, s. Grenze 2 im Kopf). Dass eine
      // vorhandene Adresse mitreist, misst H3; dass eine verbotene den Weg abbricht, misst H5.
      expect(quelle.url).toBeNull();
      // Der Autor der Belegstelle ist derselbe wie der des Objekts: der Entwurfsautor. Kein
      // erfundener Name, kein leeres Feld.
      expect(quelle.author).toBe(ko.author);
      expect(quelle.author.length).toBeGreaterThan(0);
      // Eigene Kennung und lesbarer Zeitpunkt — die Belegstelle ist ein vollständiger Datensatz.
      expect(quelle.id.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(quelle.at))).toBe(false);

      // ---- DAS ORIGINAL EXISTIERT WIRKLICH, unter genau dieser Kennung ----------------------
      // Das ist die stärkste wahre Aussage über die Bindung (Grenze 1): `KoSource` trägt keine
      // `objectId`, aber das gesicherte Original ist abrufbar, und die Ankerprüfung hat es beim
      // Einreichen gesehen. Die Kennung steht NICHT aus dem Request zurückgespiegelt da, sondern
      // wird beim Objektspeicher nachgefragt.
      const original = await app.inject({
        method: "GET",
        url: `/api/objects/${objektId}`,
        headers: kopf,
      });
      expect(original.statusCode, original.body).toBe(200);
      // `GET /api/objects/:id` sendet den gespeicherten Datensatz; die Kennung liegt unter `ref`
      // (services/app/src/routes/object-routes.ts:305, `send(obj)`).
      expect((original.json() as { ref?: { id?: string } }).ref?.id).toBe(objektId);

      // ---- GEMESSEN, NICHT BEHAUPTET: die Belegkette (Auftrag §5 Lieferung 6) ---------------
      // Dieser Weg schreibt KEINEN Belegketten-Datensatz. Das ist hier als Tatsache gepinnt und
      // nicht als Versprechen: die append-only Belegkette des Promote-Weges ist NICHT geschlossen
      // (Grund in Grenze 3 im Kopf dieser Datei). Wird diese Zeile rot, hat jemand einen
      // Schreibweg ergänzt — dann gehört die neue Zahl hierher, mit ihren `kind`-Werten.
      const belege = await app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}/evidence`,
        headers: kopf,
      });
      expect(belege.statusCode).toBe(200);
      expect(
        belege.json(),
        "GEMESSEN: der Promote schreibt nichts in die Belegkette — die Kette dieses Weges ist noch offen.",
      ).toEqual([]);
    } finally {
      await app.close();
    }
  }, 120_000);

  it("H2 · ein Entwurf OHNE Belegstellen bekommt keine erfundene Herkunft", async () => {
    // Der Wächter gegen die naheliegende Halbheit: `sources` immer setzen. Dann trüge jedes
    // promotete Objekt eine Quellenliste, und „nie eine Quelle gehabt" wäre nicht mehr von
    // „Quelle verloren" zu unterscheiden.
    const { app, kopf } = await buehne();
    try {
      // `POST /api/drafts` nimmt den Entwurfs-Payload DIREKT als Rumpf (capture-routes.ts:899:
      // `const { operationId, ...nutzlast } = request.body`) — kein `{ payload: … }` darum herum.
      const angelegt = await app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: kopf,
        payload: { ...PFLICHT },
      });
      expect(angelegt.statusCode, angelegt.body).toBe(201);
      const entwurfId = (angelegt.json() as { id: string }).id;

      const befoerdert = await einreichen(
        app,
        kopf,
        entwurfId,
        { ...PFLICHT },
        "3934herk-0000-4000-8000-000000000002",
      );
      expect(befoerdert.statusCode, befoerdert.body).toBe(201);
      const ko = befoerdert.json() as Wissensobjekt;
      expect(ko.sources ?? []).toEqual([]);
    } finally {
      await app.close();
    }
  }, 120_000);

  it("H3 · auf einer freigebenden Stufe reisen beide Belegstellen — in derselben Reihenfolge, MIT Adresse", async () => {
    // Die zweite Halbheit, die hier ausgeschlossen wird: nur die Einträge mit `objectId`
    // mitnehmen. Eine Belegstelle ohne gesichertes Original ist eine gültige TEXTQUELLE (ein Buch,
    // eine Norm, ein Gespräch) — sie fallen zu lassen wäre derselbe Herkunftsverlust, nur kleiner.
    //
    // JOB 3934 R3: DIESER FALL BRAUCHT EINE FREIGEBENDE STUFE, und das ist keine Bequemlichkeit,
    // sondern der Inhalt der Regel. Die zweite Belegstelle trägt eine öffentliche Web-Adresse; auf
    // der Werksvorgabe `search_on_click` ist genau die verboten (H5 misst das). Auf
    // `search_attach` ist sie erlaubt — und dann reist auch ihre ADRESSE mit. In Runde 2 stand hier
    // `url: null` mit der Begründung, das sei eine Absicherung; das war falsch (s. Kopf von
    // `belegstellen` in services/capture/src/service.ts). Die Absicherung ist die Stufenprüfung,
    // und wo sie freigibt, bekommt der Nutzer dieselbe Quelle wie über `add-source` — nicht eine
    // beschnittene.
    const { app, kopf } = await buehne();
    try {
      await stufeSetzen(app, kopf, "search_attach");
      const entwurfId = await entwurfAusDocx(app, kopf);
      const objektId = await originalSichern(app, kopf, entwurfId);
      const stand = {
        ...PFLICHT,
        pendingSources: [
          { label: "sample.docx", excerpt: QUELLSATZ, anchorKey: "anker-1", objectId: objektId },
          {
            label: "Handbuch Kapitel 4",
            url: "https://example.org/handbuch#kapitel-4",
            excerpt: "Sicherheitsventile monatlich prüfen.",
          },
        ],
        anchorDocuments: [
          { key: "anker-1", objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfId, stand, objektId);

      const befoerdert = await einreichen(
        app,
        kopf,
        entwurfId,
        stand,
        "3934herk-0000-4000-8000-000000000003",
      );
      expect(befoerdert.statusCode, befoerdert.body).toBe(201);
      const quellen = (befoerdert.json() as Wissensobjekt).sources ?? [];
      expect(quellen).toHaveLength(2);
      // DIE REIHENFOLGE IST DIE DES ENTWURFS — nicht sortiert, nicht nach „hat ein Original"
      // gruppiert.
      expect(quellen.map((q) => q.label)).toEqual(["sample.docx", "Handbuch Kapitel 4"]);
      expect(quellen[0]?.excerpt).toBe(QUELLSATZ);
      expect(quellen[1]?.excerpt).toBe("Sicherheitsventile monatlich prüfen.");
      // DIE ADRESSE IST DA, wo die Stufe sie erlaubt — und die adresslose bleibt adresslos.
      // „Keine Adresse" ist `null` und nicht ein fehlendes Feld (unterscheidbar von „unbekannt").
      expect(quellen.map((q) => q.url)).toEqual([null, "https://example.org/handbuch#kapitel-4"]);
      // Zwei eigene Kennungen — kein geteilter Datensatz.
      expect(new Set(quellen.map((q) => q.id)).size).toBe(2);
    } finally {
      await app.close();
    }
  }, 120_000);

  it("H4 · fehlt das gesicherte Original beim Einreichen, entsteht weiterhin KEIN Objekt", async () => {
    // Die Fehlerkante bleibt, wie sie war: `verifyDraftAnchors` steht VOR der Übernahme der
    // Belegstellen. Ein halbes Ergebnis — Objekt ohne Beleg — gibt es nicht.
    const { app, kopf, services } = await buehne();
    try {
      const entwurfId = await entwurfAusDocx(app, kopf);
      const objektId = await originalSichern(app, kopf, entwurfId);
      const stand = {
        ...PFLICHT,
        pendingSources: [
          { label: "sample.docx", excerpt: QUELLSATZ, anchorKey: "anker-1", objectId: objektId },
        ],
        anchorDocuments: [
          { key: "anker-1", objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfId, stand, objektId);

      // ZWISCHEN Speichern und Einreichen verschwindet das Original.
      await services.objects.delete(objektId);

      const befoerdert = await einreichen(
        app,
        kopf,
        entwurfId,
        stand,
        "3934herk-0000-4000-8000-000000000004",
      );
      expect(befoerdert.statusCode, befoerdert.body).toBe(400);
      expect((befoerdert.json() as { error?: string }).error).toBe("MISSING_DRAFT_ANCHOR");
      // Und im Bestand steht nichts.
      const kos = await app.inject({ method: "GET", url: "/api/kos", headers: kopf });
      expect(kos.json()).toHaveLength(0);
    } finally {
      await app.close();
    }
  }, 120_000);

  // ==============================================================================================
  // H5 · DIE QUELLENSPERRE GILT AUCH FÜR DEN PROMOTE — bens Korrekturpflicht 1 aus Runde 2.
  // ==============================================================================================
  //
  // WAS HIER VORHER STAND, war falsch und ist ersetzt: Runde 2 hat gepinnt, dass eine Quelle mit
  // öffentlicher Web-Adresse mit 201 ans Objekt kommt und nur ihre Adresse verworfen wird — und das
  // als „Absicherung" ausgegeben. BEN hat dagegen gemessen (eigener Cloud-Lauf
  // `d551cdff9fb274025915fca3`): auf `blocked` UND auf der Werksvorgabe `search_on_click` weist
  // `add-source` dieselbe Quelle mit 403 `EXTERNAL_ATTACH_BLOCKED` ab, der Promote nahm sie an.
  // `url: null` war also kein Beleg für eine durchgesetzte Sperre, sondern nur eine unkenntlich
  // gemachte Quelle — die Regel verbietet die ADRESSLOSE Quelle ohne Hausbezug genauso
  // (`decideExternalAttach`, external-search/src/attach-policy.ts:207, `unanchored-source`).
  //
  // DIESE VIER FÄLLE SIND bens Gegenprobe, als DAUERHAFTER Test: zwei restriktive Stufen × zwei
  // gesperrte Quellenarten. Je Fall wird VERGLICHEN, nicht behauptet: derselbe Quellenrumpf geht
  // einmal an `add-source` und einmal über „speichern und einreichen" — beide müssen ablehnen, und
  // zwar unter demselben Namen.
  for (const stufe of ["blocked", "search_on_click"] as const) {
    for (const [was, quelle] of [
      [
        "öffentliche Web-Adresse",
        {
          label: "Externe Prüfquelle",
          url: "https://example.org/externe-quelle",
          excerpt: "Extern übernommener Satz.",
        },
      ],
      [
        "adresslos und ohne Hausbezug",
        { label: "Externe Prüfquelle", excerpt: "Extern übernommener Satz." },
      ],
    ] as const) {
      it(`H5 · ${stufe}, ${was}: der Promote weist ab wie add-source — kein Objekt, der Entwurf bleibt`, async () => {
        const { app, kopf } = await buehne();
        try {
          await stufeSetzen(app, kopf, stufe);

          // (1) DER VERGLEICHSMASSSTAB, im selben Lauf gemessen statt aus dem Gedächtnis zitiert:
          //     dieselbe Quelle an `add-source`.
          const ko = await app.inject({
            method: "POST",
            url: "/api/kos",
            headers: kopf,
            payload: PFLICHT,
          });
          expect(ko.statusCode, ko.body).toBe(201);
          const direkt = await app.inject({
            method: "PUT",
            url: `/api/kos/${(ko.json() as { id: string }).id}`,
            headers: kopf,
            payload: { action: "add-source", source: quelle },
          });
          expect(direkt.statusCode, direkt.body).toBe(403);
          expect((direkt.json() as { error?: string }).error).toBe("EXTERNAL_ATTACH_BLOCKED");

          // (2) DERSELBE RUMPF ÜBER DEN PROMOTE.
          const stand = { ...PFLICHT, pendingSources: [quelle] };
          const angelegt = await app.inject({
            method: "POST",
            url: "/api/drafts",
            headers: kopf,
            payload: stand,
          });
          expect(angelegt.statusCode, angelegt.body).toBe(201);
          const entwurfId = (angelegt.json() as { id: string }).id;

          const befoerdert = await einreichen(
            app,
            kopf,
            entwurfId,
            stand,
            `3934herk-0000-4000-8000-00000000000${stufe === "blocked" ? "5" : "6"}`,
          );
          // DERSELBE NAME wie an `add-source` — dasselbe Versäumnis heisst nicht zweimal
          // verschieden (die Lehre von JOB 3618).
          expect((befoerdert.json() as { error?: string }).error).toBe("EXTERNAL_ATTACH_BLOCKED");
          // DER STATUS IST 400 UND NICHT 403, und das ist GEMESSEN, nicht gewollt: `add-source`
          // setzt seinen 403 selbst (ko-routes.ts:2056), der Promote läuft über `sendError`, und
          // dort fehlt `EXTERNAL_ATTACH_BLOCKED` in `STATUS_BY_CODE` (app/src/http.ts:43-70) —
          // also `?? 400`. Die eine Zeile, die das gleichzieht, liegt in `services/app/src/http.ts`
          // und damit AUSSERHALB der Zielpfade dieses Auftrags; sie steht in der Rückgabe unter
          // ABWEICHUNGEN. Diese Zeile pinnt den heutigen Stand ehrlich; wird sie rot, weil jemand
          // den Eintrag ergänzt hat, gehört hier 403 hin.
          expect(befoerdert.statusCode, befoerdert.body).toBe(400);

          // (3) UND ES IST NICHTS ENTSTANDEN. Das ist der Kern der Auflage: kein Wissensobjekt aus
          //     diesem Entwurf, und der Entwurf ist auch nicht verbraucht worden.
          const bestand = await app.inject({ method: "GET", url: "/api/kos", headers: kopf });
          // Genau EINS: das aus Schritt (1), gegen das `add-source` lief — kein zweites aus dem
          // Promote.
          expect((bestand.json() as unknown[]).length).toBe(1);
          const entwuerfe = await app.inject({ method: "GET", url: "/api/drafts", headers: kopf });
          expect((entwuerfe.json() as { id: string }[]).map((e) => e.id)).toEqual([entwurfId]);
        } finally {
          await app.close();
        }
      }, 120_000);
    }
  }

  it("H7 · der Dokumentweg bleibt von der neuen Prüfung unberührt", async () => {
    // DIE REGRESSION, die dieser Fall verhindert. `toKoInput` beliefert ZWEI Türen. Die
    // Stufenprüfung gehört nur an die, die die Belegstellen des Entwurfs wirklich übernimmt. Liefe
    // sie auch am Dokumentweg, würde er Anfragen abweisen, die nichts Verbotenes tun: seine eigenen
    // Belegstellen kommen aus `documents[].points` und sind dort schon geprüft (ko-routes.ts:
    // 1395-1415), die `pendingSources` des Entwurfs verwendet er gar nicht.
    //
    // Gemessen wird genau das: restriktive Stufe, ein Entwurf, dessen `pendingSources` der Promote
    // abweisen WÜRDE (H5 zeigt es) — und der Dokumentweg läuft trotzdem durch und legt GENAU EINE
    // Belegstelle an, nämlich seine eigene.
    const { app, kopf } = await buehne();
    try {
      await stufeSetzen(app, kopf, "search_on_click");
      const entwurfId = await entwurfAusDocx(app, kopf);
      const objektId = await originalSichern(app, kopf, entwurfId);
      const stand = {
        ...PFLICHT,
        pendingSources: [
          // Adresslos und ohne `objectId` — über den Promote wäre das `EXTERNAL_ATTACH_BLOCKED`.
          { label: "Externe Prüfquelle", excerpt: "Extern übernommener Satz." },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfId, stand, null);
      const gelesen = await app.inject({
        method: "GET",
        url: `/api/drafts/${entwurfId}`,
        headers: kopf,
      });
      const stempel = (gelesen.json() as { updatedAt: string }).updatedAt;

      const erzeugt = await app.inject({
        method: "POST",
        url: "/api/kos/from-document",
        headers: kopf,
        payload: {
          operationId: "3934herk-0000-4000-8000-000000000007",
          draftId: entwurfId,
          expectedUpdatedAt: stempel,
          draftPayload: stand,
          documents: [
            {
              anchor: { objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
              points: [{ label: "sample.docx", excerpt: QUELLSATZ }],
            },
          ],
        },
      });
      expect(erzeugt.statusCode, erzeugt.body).toBe(201);
      const quellen = (erzeugt.json() as Wissensobjekt).sources ?? [];
      // GENAU EINE, und zwar die des Dokumentwegs — nicht die des Entwurfs, und nicht beide.
      expect(quellen.map((q) => q.label)).toEqual(["sample.docx"]);
      expect(quellen[0]?.excerpt).toBe(QUELLSATZ);
    } finally {
      await app.close();
    }
  }, 120_000);

  it("H6 · ohne Belegstellen setzt `toKoInput` das Feld GAR NICHT — kein Vorgabewert", async () => {
    // H2 misst die ANTWORT; dort sieht „nie eine Quelle gehabt" genauso aus wie eine unbedingt
    // gesetzte leere Liste (`buildCreatedKo` schreibt in beiden Fällen `sources: []`,
    // services/knowledge-object/src/service.ts:1823). Der Unterschied liegt EINE Ebene tiefer, am
    // Vertrag `CreateKoInput` — und genau dort wird er hier gemessen: derselbe Dienst, den beide
    // Türen benutzen, und dieselbe Bauform wie bei `confidentiality` und `origin`.
    //
    // JOB 3934 R3: auf `search_attach`, weil die zweite Hälfte dieses Falls eine ADRESSLOSE Quelle
    // ohne Hausbezug benutzt — auf der Werksvorgabe wäre sie gesperrt (H5), und dieser Fall fragt
    // nicht nach der Sperre, sondern nach der Bauform des Feldes.
    const { app, kopf, services } = await buehne();
    try {
      await stufeSetzen(app, kopf, "search_attach");
      const ohne = await app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: kopf,
        payload: { ...PFLICHT },
      });
      expect(ohne.statusCode, ohne.body).toBe(201);
      const eingabeOhne = await services.capture.toKoInput((ohne.json() as { id: string }).id);
      expect(Object.hasOwn(eingabeOhne, "sources")).toBe(false);

      // Und die Gegenrichtung im selben Zug: MIT Belegstelle ist das Feld da.
      const mit = await app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: kopf,
        payload: { ...PFLICHT, pendingSources: [{ label: "Werkstatthandbuch" }] },
      });
      expect(mit.statusCode, mit.body).toBe(201);
      const eingabeMit = await services.capture.toKoInput((mit.json() as { id: string }).id);
      expect(Object.hasOwn(eingabeMit, "sources")).toBe(true);
      expect(eingabeMit.sources ?? []).toHaveLength(1);
      expect(eingabeMit.sources?.[0]?.label).toBe("Werkstatthandbuch");
    } finally {
      await app.close();
    }
  }, 120_000);

  // ==============================================================================================
  // H8 · EINE FREMDE OBJEKTKENNUNG HEBT DIE QUELLENSPERRE NICHT AUF — bens Gegenprobe aus Runde 3.
  // ==============================================================================================
  //
  // WAS BEN GEMESSEN HAT (Urteil zu Runde 3, Abschnitt EIGENE MESSUNG, eigener Cloud-Lauf
  // `5fe381495c62762c947b56b7`), wörtlich: auf `blocked` UND auf `search_on_click` lieferte das
  // fremde Original per GET **404**, dieselbe Quelle an `add-source` **403** — „beim Promote **201**,
  // anschliessend zwei Wissensobjekte statt eines".
  //
  // WARUM DAS GING. Runde 3 setzte `anchoredToOwnAttachment` auf die blosse EXISTENZ des Objekts
  // (`objects.metadata(id) !== undefined`, eine Frage ohne Eigentümer). Wer die Kennung eines
  // fremden Originals kannte, schrieb sie in die `pendingSources` SEINES Entwurfs — und seine
  // selbstgeschriebene Behauptung wurde zum Anker, der die Sperre aufhob. bens Maßstab dagegen,
  // wörtlich aus `services/app/src/sichtbarkeit.ts:578`: „Exakte UUIDs sind kein
  // Berechtigungsnachweis; ihre Unerratbarkeit darf eine fehlende Autorisierung nicht ersetzen."
  //
  // DIESER FALL IST DIE MATRIX, die bens Korrekturpflicht 2 verlangt, auf BEIDEN restriktiven
  // Stufen und in EINEM Lauf je Stufe:
  //   (1) FREMDES, nicht lesbares Original → abgewiesen, kein Wissensobjekt, der Entwurf bleibt.
  //   (2) EIGENES Original                 → geht weiterhin durch, mit seiner Belegstelle.
  // Die dritte Zeile der Matrix — FEHLENDES Original — steht in H4 (`MISSING_DRAFT_ANCHOR`) und
  // wird hier nicht ein zweites Mal gebaut.
  //
  // (2) STEHT IM SELBEN FALL WIE (1) UND NICHT DANEBEN, und das ist der Kern seiner Prüfkraft: eine
  // Sperre, die alles abweist, wäre genauso „grün" wie eine richtige. Erst das Paar zeigt, dass hier
  // der EIGENTÜMER entscheidet und nicht die Anwesenheit einer Kennung.
  for (const stufe of ["blocked", "search_on_click"] as const) {
    it(`H8 · ${stufe}: die Kennung eines FREMDEN Originals hebt die Sperre nicht auf — das eigene trägt weiter`, async () => {
      const { app, admin, opfer, einreicher } = await zweiKonten(
        `h8${stufe === "blocked" ? "b" : "s"}`,
      );
      try {
        await stufeSetzen(app, admin, stufe);

        // ---- (1) DAS FREMDE ORIGINAL --------------------------------------------------------
        const fremdesOriginal = await originalHochladen(app, opfer);

        // KALIBRIERUNG, ohne die jedes spätere Nein nichtssagend wäre: der Einreichende darf dieses
        // Original WIRKLICH nicht lesen. Genau bens Messung — GET liefert 404, nicht 403: „nicht
        // sichtbar sieht aus wie nicht vorhanden" (object-routes.ts:290-296).
        const blick = await app.inject({
          method: "GET",
          url: `/api/objects/${fremdesOriginal}`,
          headers: einreicher,
        });
        expect(
          blick.statusCode,
          "KALIBRIERUNG: wäre das fremde Original lesbar, prüfte dieser Fall nichts.",
        ).toBe(404);

        const fremdeQuelle = {
          label: "sample.docx",
          excerpt: QUELLSATZ,
          anchorKey: "anker-fremd",
          objectId: fremdesOriginal,
        };

        // DER VERGLEICHSMASSSTAB, im selben Lauf gemessen: dieselbe Quelle an `add-source`. Sie ist
        // adresslos und ohne Hausbezug — auf beiden restriktiven Stufen `unanchored-source`.
        const eigenesKo = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers: einreicher,
          payload: PFLICHT,
        });
        expect(eigenesKo.statusCode, eigenesKo.body).toBe(201);
        const ueberAddSource = await app.inject({
          method: "PUT",
          url: `/api/kos/${(eigenesKo.json() as { id: string }).id}`,
          headers: einreicher,
          payload: { action: "add-source", source: fremdeQuelle },
        });
        expect(ueberAddSource.statusCode, ueberAddSource.body).toBe(403);
        expect((ueberAddSource.json() as { error?: string }).error).toBe("EXTERNAL_ATTACH_BLOCKED");

        // UND JETZT DERSELBE RUMPF ÜBER „SPEICHERN UND EINREICHEN" — der Weg, der in Runde 3 mit
        // 201 antwortete.
        const fremderStand = {
          ...PFLICHT,
          pendingSources: [fremdeQuelle],
          anchorDocuments: [
            {
              key: "anker-fremd",
              objectId: fremdesOriginal,
              name: "sample.docx",
              mime: DOCX_MIME,
            },
          ],
        };
        const fremderEntwurf = await app.inject({
          method: "POST",
          url: "/api/drafts",
          headers: einreicher,
          payload: fremderStand,
        });
        expect(fremderEntwurf.statusCode, fremderEntwurf.body).toBe(201);
        const fremdeEntwurfId = (fremderEntwurf.json() as { id: string }).id;

        const abgewiesen = await einreichen(
          app,
          einreicher,
          fremdeEntwurfId,
          fremderStand,
          `3934herk-0000-4000-8000-0000000000${stufe === "blocked" ? "08" : "09"}`,
        );
        // DERSELBE NAME wie an `add-source`. WENN DIESE ZEILE ROT IST, ist bens Loch wieder offen:
        // eine fremde Kennung wirkt als Berechtigungsnachweis.
        expect(
          (abgewiesen.json() as { error?: string }).error,
          "Die Kennung eines fremden Originals darf die Quellensperre NICHT aufheben.",
        ).toBe("EXTERNAL_ATTACH_BLOCKED");
        // Der Status ist 400 und nicht 403 — gemessen, nicht gewollt, aus demselben Grund wie in H5
        // (`STATUS_BY_CODE` in `services/app/src/http.ts` kennt den Namen nicht; die Datei liegt
        // ausserhalb der Zielpfade und steht in der Rückgabe unter ABWEICHUNGEN).
        expect(abgewiesen.statusCode, abgewiesen.body).toBe(400);

        // UND ES IST NICHTS ENTSTANDEN — bens Satz „anschliessend zwei Wissensobjekte statt eines"
        // ist genau diese Zeile. Sichtbar ist für den Einreichenden GENAU EINS: das aus dem
        // Vergleichsmassstab oben.
        const bestand = await app.inject({
          method: "GET",
          url: "/api/kos",
          headers: einreicher,
        });
        expect(
          (bestand.json() as unknown[]).length,
          "Aus dem abgewiesenen Promote darf KEIN zweites Wissensobjekt entstanden sein.",
        ).toBe(1);
        // Der Entwurf ist auch nicht verbraucht worden: die Abweisung ist folgenlos.
        const entwuerfe = await app.inject({
          method: "GET",
          url: "/api/drafts",
          headers: einreicher,
        });
        expect((entwuerfe.json() as { id: string }[]).map((e) => e.id)).toEqual([fremdeEntwurfId]);

        // ---- (2) DAS EIGENE ORIGINAL, auf DERSELBEN Stufe und im SELBEN Lauf ------------------
        // Die Gegenrichtung: die Sperre weist nicht einfach alles ab. Dasselbe Original, nur diesmal
        // vom Einreichenden selbst hochgeladen — und die Belegstelle reist mit.
        const eigenesOriginal = await originalHochladen(app, einreicher);
        const eigenerStand = {
          ...PFLICHT,
          pendingSources: [
            {
              label: "sample.docx",
              excerpt: QUELLSATZ,
              anchorKey: "anker-eigen",
              objectId: eigenesOriginal,
            },
          ],
          anchorDocuments: [
            {
              key: "anker-eigen",
              objectId: eigenesOriginal,
              name: "sample.docx",
              mime: DOCX_MIME,
            },
          ],
        };
        const eigenerEntwurf = await app.inject({
          method: "POST",
          url: "/api/drafts",
          headers: einreicher,
          payload: eigenerStand,
        });
        expect(eigenerEntwurf.statusCode, eigenerEntwurf.body).toBe(201);

        const durchgelassen = await einreichen(
          app,
          einreicher,
          (eigenerEntwurf.json() as { id: string }).id,
          eigenerStand,
          `3934herk-0000-4000-8000-0000000000${stufe === "blocked" ? "10" : "11"}`,
        );
        expect(
          durchgelassen.statusCode,
          "WENN DIESE ZEILE ROT IST, sperrt die Prüfung auch den eigenen, erlaubten Anker aus.",
        ).toBe(201);
        const quellen = (durchgelassen.json() as Wissensobjekt).sources ?? [];
        expect(quellen).toHaveLength(1);
        expect(quellen[0]?.label).toBe("sample.docx");
        expect(quellen[0]?.excerpt).toBe(QUELLSATZ);
      } finally {
        await app.close();
      }
    }, 120_000);
  }
});
