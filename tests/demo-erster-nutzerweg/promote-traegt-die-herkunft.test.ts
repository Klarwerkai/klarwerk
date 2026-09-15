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
//     JOB 4137: DIE EHRLICHE GRENZE VON RUNDE 3 IST WEG. Bis dahin stand hier „derselbe
//     Fehlername, aber 400 statt 403, weil `STATUS_BY_CODE` (services/app/src/http.ts) den Namen
//     nicht kennt — und die Datei liegt ausserhalb der Zielpfade". Sie liegt jetzt drin, der
//     Eintrag `EXTERNAL_ATTACH_BLOCKED: 403` ist ergänzt, und H5/H8 erwarten 403 — DENSELBEN
//     Status wie `add-source`. Dasselbe Versäumnis heisst nicht mehr zweimal verschieden.
//
// (3) JOB 4137: DIE BELEGKETTE IST GESCHLOSSEN. Bis dahin stand hier „sie bleibt LEER": `ko.create`
//     → `finishCreated` schrieb KEINEN `EvidenceRecord`, das tat nur `createWithDocumentsLocked`.
//     `finishCreated` schreibt jetzt je Anhang und je Belegstelle DES OBJEKTS eine Zeile, über
//     denselben Baustein wie der Dokumentweg (`erstanlageBelege`) — kein zweiter Schreibweg.
//     H1 misst die Kette dieses Weges Feld für Feld; H9 hält sie gegen den Dokumentweg.
//     WAS DABEI UNTERSCHIEDLICH BLEIBT, und zwar gemessen statt verschwiegen: der Promote bindet
//     kein Original als ANHANG ans Objekt (`CreateKoInput` hat kein `attachments`-Feld). Sein
//     Objekt trägt eine Belegstelle und keinen Anhang, seine Kette deshalb eine `source`-Zeile und
//     keine `attachment`-Zeile. Die REGEL ist auf beiden Wegen dieselbe — die Kette bildet ab, was
//     das Objekt trägt —, und genau diese Regel prüft H9 auf beiden Wegen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { QUELLSATZ } from "./strecke";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * JOB 4137 R3 — DIE ZWEITE BELEGSTELLE. Sie unterscheidet sich von `QUELLSATZ` in ihrem Auszug und
 * NUR darin: H11 und H13 binden dasselbe Original zweimal, und die beiden Belegstellen müssen
 * auseinanderzuhalten sein, ohne sich auf eine Reihenfolge in der Belegkette zu verlassen.
 */
const ZWEITER_AUSZUG = "Der Druck wird am Schauglas abgelesen.";

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
  version: number;
  bodyHtml?: string | null;
  sources?: Belegstelle[];
  attachments?: { id: string; name: string; mime: string; objectId?: string }[];
};

/** Eine Zeile der append-only Belegkette, so wie `GET /api/kos/:id/evidence` sie sendet. */
type Belegzeile = {
  id: string;
  koId: string;
  koVersion: number;
  kind: string;
  sourceId?: string;
  attachmentId?: string;
  objectId?: string;
  label: string;
  mime?: string;
  url?: string | null;
  excerpt?: string;
  createdBy: string;
  createdAt: string;
};

async function belegkette(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  kopf: Record<string, string>,
  koId: string,
): Promise<Belegzeile[]> {
  const belege = await app.inject({
    method: "GET",
    url: `/api/kos/${koId}/evidence`,
    headers: kopf,
  });
  expect(belege.statusCode, belege.body).toBe(200);
  return belege.json() as Belegzeile[];
}

/** Das erste Konto dieser Bühne — es darf anlegen, einreichen und lesen. */
async function erstesKonto(
  app: Awaited<ReturnType<typeof buildApp>>,
): Promise<Record<string, string>> {
  const einrichten = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { name: "Demo", email: "herkunft@job3934.test", password: "vorfuehrung12345" },
  });
  expect(einrichten.statusCode, einrichten.body).toBe(201);
  return { cookie: String(einrichten.headers["set-cookie"] ?? "").split(";")[0] ?? "" };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  return { services, app, kopf: await erstesKonto(app) };
}

// ================================================================================================
// JOB 4137 R3 — DIESELBE BÜHNE, MIT EINEM GRIFF AN DIE BELEGABLAGE.
// ================================================================================================
//
// H12 und H13 brauchen einen Zustand, den der gesunde Weg nicht herstellt: das Wissensobjekt steht
// im Bestand, und eine Zeile SEINER Belegkette fehlt. Genau den hinterlässt `finishCreated`, wenn
// nach dem Insert etwas wirft — der Ablauf ist dort bewusst untransaktional (WP-SHIP8-CLOSE-5), und
// genau dafür gibt es den idempotenten Nachzug `ensureCreatedSideEffects`. BEN hat diesen Fall in
// Runde 2 gemessen; hier steht er dauerhaft.
//
// HERGESTELLT AN DER STELLE, AN DER ER ECHT ENTSTEHT: der Belegablage. Verdrahtet wird über
// dieselben öffentlichen Repos wie in `buildServices` (`inMemoryRepos` + `assembleServices`) — kein
// Griff in Service-Interna, kein Nachbau des Dienstes.
//
// ZWEI ARTEN VON STÖRUNG, und beide braucht es wirklich:
//   · `werfen` — die Ablage bricht. Das ist der echte Teilpersistenz-Fall des EINREICHWEGS (H12):
//     das Objekt bleibt, der Vorgang scheitert.
//   · `verschlucken` — die Zeile kommt nicht an, ohne Wurf. Für den DOKUMENTWEG (H13) ist das der
//     einzig gangbare Weg: er nimmt bei JEDEM Fehler das ganze Objekt zurück (Rücknahmeklammer in
//     `createWithDocumentsLocked`), und dann gäbe es nichts mehr nachzuziehen. Was hier gemessen
//     wird, ist deshalb nicht der Wurf, sondern der ZUSTAND danach: Objekt da, Zeile fehlt.
type Belegstoerung = (record: Belegzeile) => "durchlassen" | "verschlucken" | "werfen";

async function buehneMitBelegstoerung(stoerung: Belegstoerung) {
  const repos = inMemoryRepos();
  const echtesAppend = repos.evidence.append.bind(repos.evidence);
  repos.evidence.append = async (record) => {
    const wahl = stoerung(record);
    if (wahl === "werfen") {
      throw new Error("Belegablage bricht (Testaufbau JOB 4137 R3)");
    }
    if (wahl === "verschlucken") {
      return;
    }
    await echtesAppend(record);
  };
  const services = assembleServices(repos);
  const app = buildApp(services);
  await app.ready();
  return { services, app, kopf: await erstesKonto(app) };
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

/**
 * JOB 4137 R3 — DER DOKUMENTWEG, mit beliebig vielen Bündeln. Wortgleich zu dem Aufruf, den H9
 * ausgeschrieben fährt; herausgezogen, weil H11 und H13 ZWEI Bündel brauchen und zwei Kopien dieser
 * Ladung zwei Gelegenheiten wären, sie auseinanderlaufen zu lassen.
 *
 * Der Zeitstempel wird frisch nachgelesen und nicht mitgereicht: `expectedUpdatedAt` ist die
 * Bedingung, unter der die Route den Entwurf abräumt — ein geratener Wert prüfte etwas anderes.
 */
async function ausDokumenten(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  kopf: Record<string, string>,
  entwurfId: string,
  stand: Record<string, unknown>,
  vorgang: string,
  buendel: { objectId: string; auszug: string }[],
) {
  const gelesen = await app.inject({
    method: "GET",
    url: `/api/drafts/${entwurfId}`,
    headers: kopf,
  });
  expect(gelesen.statusCode, gelesen.body).toBe(200);
  const stempel = (gelesen.json() as { updatedAt: string }).updatedAt;
  return app.inject({
    method: "POST",
    url: "/api/kos/from-document",
    headers: kopf,
    payload: {
      operationId: vorgang,
      draftId: entwurfId,
      expectedUpdatedAt: stempel,
      draftPayload: stand,
      documents: buendel.map((b) => ({
        anchor: { objectId: b.objectId, name: "sample.docx", mime: DOCX_MIME },
        points: [{ label: "sample.docx", excerpt: b.auszug }],
      })),
    },
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

      // ---- GEMESSEN, NICHT BEHAUPTET: die Belegkette (JOB 4137) -----------------------------
      // Bis JOB 4137 stand hier `toEqual([])` als gemessene Tatsache: dieser Weg schrieb keine
      // Zeile. Jetzt schreibt `finishCreated` je Anhang und je Belegstelle DES OBJEKTS eine — und
      // deshalb steht die Erwartung nicht als nackte Zahl da, sondern wird aus dem Objekt
      // abgeleitet: dieses trägt eine Belegstelle und keinen Anhang (Grenze 3 im Kopf).
      expect(
        ko.attachments ?? [],
        "GEMESSEN: der Promote bindet kein Original als ANHANG — deshalb keine attachment-Zeile.",
      ).toEqual([]);
      const kette = await belegkette(app, kopf, ko.id);
      expect(
        kette.map((zeile) => zeile.kind),
        "WENN DIESE ZEILE ROT IST, schreibt der Promote seine Belegkette nicht mehr — oder er schreibt mehr, als sein Objekt trägt.",
      ).toEqual(["source"]);
      expect(kette).toHaveLength((ko.attachments ?? []).length + quellen.length);
      const belegzeile = kette[0] as Belegzeile;
      expect(belegzeile.koId).toBe(ko.id);
      expect(belegzeile.koVersion).toBe(ko.version);
      expect(belegzeile.sourceId).toBe(quelle.id);
      expect(belegzeile.label).toBe("sample.docx");
      expect(belegzeile.excerpt).toBe(QUELLSATZ);
      expect(belegzeile.createdBy).toBe(ko.author);
      expect(belegzeile.id.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(belegzeile.createdAt))).toBe(false);
      // LEERE OPTIONALFELDER WERDEN WEGGELASSEN, nicht mit "" belegt — dieselbe Regel wie auf dem
      // Dokumentweg. Dieses Objekt hat keinen Anhang und diese Belegstelle keine Adresse.
      expect(Object.hasOwn(belegzeile, "attachmentId")).toBe(false);
      expect(Object.hasOwn(belegzeile, "url")).toBe(false);
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
          // UND SEIT JOB 4137 AUCH DERSELBE STATUS. Bis dahin stand hier 400: `add-source` setzt
          // seinen 403 selbst (ko-routes.ts), der Promote läuft über `sendError`, und dort fehlte
          // `EXTERNAL_ATTACH_BLOCKED` in `STATUS_BY_CODE` (app/src/http.ts) — also `?? 400`. Der
          // Eintrag ist ergänzt; die Ablehnung heisst jetzt überall 403. Dieselbe Zeile steht im
          // Vergleichsmassstab (1) elf Zeilen höher — die beiden Türen werden HIER verglichen,
          // nicht aus dem Gedächtnis zitiert.
          expect(befoerdert.statusCode, befoerdert.body).toBe(direkt.statusCode);
          expect(befoerdert.statusCode, befoerdert.body).toBe(403);

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
        // UND DERSELBE STATUS wie an `add-source` — seit JOB 4137 kennt `STATUS_BY_CODE`
        // (services/app/src/http.ts) den Namen, also 403 statt des früheren 400.
        expect(abgewiesen.statusCode, abgewiesen.body).toBe(ueberAddSource.statusCode);
        expect(abgewiesen.statusCode, abgewiesen.body).toBe(403);

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

  // ==============================================================================================
  // H9 · JOB 4137 — EINE FRAGE, EINE ANTWORT: BEIDE TÜREN FÜHREN DIESELBE BELEGKETTE.
  // ==============================================================================================
  //
  // DIE FRAGE, um die es geht, ist die eines Menschen vor der Belegsicht: „woher stammt dieser Satz,
  // und wann kam der Beleg dazu?" Bis JOB 4137 hing die Antwort davon ab, durch WELCHE Tür das
  // Objekt entstanden war: über `POST /api/kos/from-document` stand sie vollständig in der
  // append-only Belegkette, über „speichern und einreichen" war die Kette LEER. Derselbe Satz aus
  // derselben Datei, zwei verschiedene Antworten.
  //
  // DIESER FALL VERGLEICHT DIE BEIDEN TÜREN IM SELBEN LAUF, mit derselben `sample.docx` und
  // demselben Satz — nicht aus dem Gedächtnis, sondern gemessen. Geprüft wird DIE REGEL, die auf
  // beiden Wegen dieselbe sein muss:
  //
  //     Die Belegkette bildet ab, WAS DAS OBJEKT TRÄGT — je Anhang eine `attachment`-Zeile,
  //     je Belegstelle eine `source`-Zeile, nicht mehr und nicht weniger.
  //
  // Die Erwartung wird deshalb JE OBJEKT aus dem Objekt abgeleitet und nicht als Zahl hingeschrieben
  // (und als MENGE verglichen: die Kette ist nach `createdAt` sortiert, und beide Zeilen einer
  // Erstanlage tragen denselben Zeitpunkt — eine Reihenfolge zu behaupten wäre unbelegt).
  //
  // WAS DABEI UNTERSCHIEDLICH BLEIBT, ehrlich benannt statt weggelassen: der Dokumentweg bindet das
  // Original als ANHANG ans Objekt, der Promote nicht (`CreateKoInput` hat kein `attachments`-Feld).
  // Deshalb trägt der Dokumentweg eine `attachment`-Zeile mehr — und zwar nachweislich, WEIL sein
  // Objekt einen Anhang trägt und das andere nicht. Genau das steht unten als eigene Messung da:
  // die Differenz der beiden Ketten ist die Differenz der beiden Objekte, und nichts sonst.
  it("H9 · Einreichweg und Dokumentweg: die Belegkette bildet auf BEIDEN Wegen genau das Objekt ab", async () => {
    const { app, kopf } = await buehne();
    try {
      // ---- TÜR 1: „speichern und einreichen" ------------------------------------------------
      const entwurfA = await entwurfAusDocx(app, kopf);
      const objektA = await originalSichern(app, kopf, entwurfA);
      const standA = {
        ...PFLICHT,
        pendingSources: [
          { label: "sample.docx", excerpt: QUELLSATZ, anchorKey: "anker-1", objectId: objektA },
        ],
        anchorDocuments: [
          { key: "anker-1", objectId: objektA, name: "sample.docx", mime: DOCX_MIME },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfA, standA, objektA);
      const befoerdert = await einreichen(
        app,
        kopf,
        entwurfA,
        standA,
        "4137glch-0000-4000-8000-000000000001",
      );
      expect(befoerdert.statusCode, befoerdert.body).toBe(201);
      const einreichKo = befoerdert.json() as Wissensobjekt;

      // ---- TÜR 2: der Dokumentweg, mit DEMSELBEN Inhalt aus DERSELBEN Datei ------------------
      const entwurfB = await entwurfAusDocx(app, kopf);
      const objektB = await originalSichern(app, kopf, entwurfB);
      // DERSELBE ENTWURFSSTAND wie bei Tür 1, mit EINEM Unterschied: keine `pendingSources`. Der
      // Dokumentweg verwendet sie gar nicht (H7) — seine Belegstellen kommen aus `documents[].points`
      // und stehen zwei Dutzend Zeilen tiefer, mit demselben Label und demselben Auszug.
      const standB = {
        ...PFLICHT,
        anchorDocuments: [
          { key: "anker-1", objectId: objektB, name: "sample.docx", mime: DOCX_MIME },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfB, standB, objektB);
      const gelesen = await app.inject({
        method: "GET",
        url: `/api/drafts/${entwurfB}`,
        headers: kopf,
      });
      const stempel = (gelesen.json() as { updatedAt: string }).updatedAt;
      const erzeugt = await app.inject({
        method: "POST",
        url: "/api/kos/from-document",
        headers: kopf,
        payload: {
          operationId: "4137glch-0000-4000-8000-000000000002",
          draftId: entwurfB,
          expectedUpdatedAt: stempel,
          draftPayload: standB,
          documents: [
            {
              anchor: { objectId: objektB, name: "sample.docx", mime: DOCX_MIME },
              points: [{ label: "sample.docx", excerpt: QUELLSATZ }],
            },
          ],
        },
      });
      expect(erzeugt.statusCode, erzeugt.body).toBe(201);
      const dokumentKo = erzeugt.json() as Wissensobjekt;

      // ---- DIE REGEL, auf BEIDEN Wegen dieselbe ---------------------------------------------
      /** Was die Kette dieses Objekts tragen MUSS, abgeleitet aus dem Objekt selbst. */
      const erwartet = (ko: Wissensobjekt): string[] =>
        [
          ...(ko.attachments ?? []).map(() => "attachment"),
          ...(ko.sources ?? []).map(() => "source"),
        ].sort();
      const gemessen = (kette: Belegzeile[]): string[] => kette.map((z) => z.kind).sort();

      const einreichKette = await belegkette(app, kopf, einreichKo.id);
      const dokumentKette = await belegkette(app, kopf, dokumentKo.id);

      expect(
        gemessen(einreichKette),
        "WENN DIESE ZEILE ROT IST, läuft der Einreichweg wieder aus der Regel — seine Kette bildet sein Objekt nicht mehr ab (JOB 4137).",
      ).toEqual(erwartet(einreichKo));
      expect(
        gemessen(dokumentKette),
        "WENN DIESE ZEILE ROT IST, läuft der Dokumentweg aus der Regel — oder er schreibt seine Zeilen doppelt.",
      ).toEqual(erwartet(dokumentKo));

      // KALIBRIERUNG: eine Regel über zwei leere Ketten wäre trivial erfüllt. Beide tragen etwas.
      expect(einreichKette.length).toBeGreaterThan(0);
      expect(dokumentKette.length).toBeGreaterThan(0);

      // ---- DIESELBE ANTWORT AUF DIESELBE FRAGE ----------------------------------------------
      // Die `source`-Zeilen beider Türen sagen dasselbe über denselben Satz: derselbe Dateiname,
      // derselbe übernommene Auszug, dieselbe Anzahl. DAS ist „eine Frage, eine Antwort".
      const quellzeilen = (kette: Belegzeile[]) => kette.filter((z) => z.kind === "source");
      expect(quellzeilen(einreichKette)).toHaveLength(1);
      expect(quellzeilen(dokumentKette)).toHaveLength(1);
      const ausEinreichen = quellzeilen(einreichKette)[0] as Belegzeile;
      const ausDokument = quellzeilen(dokumentKette)[0] as Belegzeile;
      expect(ausEinreichen.label).toBe(ausDokument.label);
      expect(ausEinreichen.excerpt).toBe(ausDokument.excerpt);
      expect(ausEinreichen.label).toBe("sample.docx");
      expect(ausEinreichen.excerpt).toBe(QUELLSATZ);
      // Und beide zeigen auf die Belegstelle IHRES Objekts, nicht auf eine fremde.
      expect(ausEinreichen.sourceId).toBe((einreichKo.sources ?? [])[0]?.id);
      expect(ausDokument.sourceId).toBe((dokumentKo.sources ?? [])[0]?.id);

      // ---- DER VERBLIEBENE UNTERSCHIED, gemessen und benannt --------------------------------
      // Er liegt nicht an der Belegkette, sondern an den OBJEKTEN: nur der Dokumentweg bindet das
      // Original als Anhang. Die Kette folgt dem — sie erfindet keinen Anhang, den es nicht gibt,
      // und lässt keinen weg, den es gibt.
      expect(einreichKo.attachments ?? []).toEqual([]);
      expect(dokumentKo.attachments ?? []).toHaveLength(1);
      const anhangzeilen = (kette: Belegzeile[]) => kette.filter((z) => z.kind === "attachment");
      expect(anhangzeilen(einreichKette)).toHaveLength(0);
      expect(anhangzeilen(dokumentKette)).toHaveLength(1);
      expect((anhangzeilen(dokumentKette)[0] as Belegzeile).attachmentId).toBe(
        (dokumentKo.attachments ?? [])[0]?.id,
      );
      // Die Differenz der Ketten IST die Differenz der Objekte — keine zweite Ursache.
      expect(dokumentKette.length - einreichKette.length).toBe(
        (dokumentKo.attachments ?? []).length - (einreichKo.attachments ?? []).length,
      );
    } finally {
      await app.close();
    }
  }, 120_000);

  // ==============================================================================================
  // H10 · JOB 4137 — DER NACHZUG SCHREIBT KEINE ZWEITE ZEILE.
  // ==============================================================================================
  //
  // DAS RISIKO, das dieser Fall ausschliesst. `finishCreated` bleibt nach dem Insert bewusst
  // untransaktional (WP-SHIP8-CLOSE-5): wirft dort etwas, existiert das Wissensobjekt, aber ein
  // Beleg fehlt. Der Auffang ist `ensureCreatedSideEffects` — der idempotente Nachzug, den der
  // Import-Accept vor dem Abschliessen fährt. Seit JOB 4137 gehört die BELEGKETTE zu den Belegen,
  // die dort nachzuziehen sind, und damit entsteht genau die Gefahr, gegen die dieser Fall steht:
  // dieselbe Belegstelle zweimal in einer append-only Kette, die niemand mehr bereinigen kann.
  //
  // GEMESSEN WIRD AM ECHTEN OBJEKT, nicht an einem gebauten: dasselbe eingereichte Objekt wie in
  // H1, und danach der Nachzug — zweimal. Die Kette muss danach Zeile für Zeile dieselbe sein.
  it("H10 · der idempotente Nachzug ergänzt die Belegkette eines eingereichten Objekts nicht doppelt", async () => {
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
      const befoerdert = await einreichen(
        app,
        kopf,
        entwurfId,
        stand,
        "4137nach-0000-4000-8000-000000000001",
      );
      expect(befoerdert.statusCode, befoerdert.body).toBe(201);
      const ko = befoerdert.json() as Wissensobjekt;

      const vorher = await belegkette(app, kopf, ko.id);
      // KALIBRIERUNG: ein Nachzug über eine leere Kette wäre trivial doppelfrei.
      expect(vorher.map((z) => z.kind)).toEqual(["source"]);

      const gespeichertesKo = await services.ko.get(ko.id);
      if (!gespeichertesKo) {
        throw new Error("Testaufbau: das eingereichte Wissensobjekt fehlt im Bestand");
      }
      await services.ko.ensureCreatedSideEffects(gespeichertesKo);
      await services.ko.ensureCreatedSideEffects(gespeichertesKo);

      const nachher = await belegkette(app, kopf, ko.id);
      expect(
        nachher,
        "WENN DIESE ZEILE ROT IST, schreibt der Nachzug Zeilen, die es schon gibt — eine append-only Kette mit Dubletten bekommt niemand mehr sauber.",
      ).toEqual(vorher);
    } finally {
      await app.close();
    }
  }, 120_000);

  // ==============================================================================================
  // H11 · JOB 4137 R3 — DASSELBE ORIGINAL ZWEIMAL GEBUNDEN. BENS FALL AUS RUNDE 2, DAUERHAFT.
  // ==============================================================================================
  //
  // WAS BEN GEMESSEN HAT. Zwei Dokumentbündel mit DERSELBEN Originalkennung ergeben zwei Anhänge
  // mit gleichem `objectId` und verschiedener Id. Der Dokumentweg kennt die Zuordnung je Bündel
  // (`bySource`) und schreibt sie richtig: vier Records. Der Nachzug leitete sie dagegen aus dem
  // Anker ab und traf für BEIDE Belegstellen den ERSTEN Anhang — verschiedener Schlüssel, also
  // hielt er die zweite Zeile für fehlend und schrieb sie ein zweites Mal: fünf Records, mit zwei
  // verschiedenen Herkunftsbehauptungen über dieselbe Belegstelle, in einer append-only Kette.
  //
  // WAS DIESER FALL FESTHÄLT. Nicht „der Nachzug schreibt nichts", sondern: er lässt die Kette
  // Zeile für Zeile, wie sie ist — samt der Zuordnungen, die der schreibende Vorgang GEWUSST hat.
  // Deshalb wird vorher gemessen, dass die beiden Belegstellen wirklich auf VERSCHIEDENE Anhänge
  // zeigen; ohne diese Kalibrierung wäre die Zusage danach wertlos.
  it("H11 · zwei Bündel DESSELBEN Originals: der Nachzug lässt Zeilen und Zuordnungen, wie sie sind", async () => {
    const { app, kopf, services } = await buehne();
    try {
      const entwurfId = await entwurfAusDocx(app, kopf);
      const objektId = await originalSichern(app, kopf, entwurfId);
      const stand = {
        ...PFLICHT,
        anchorDocuments: [
          { key: "anker-1", objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfId, stand, objektId);
      const erzeugt = await ausDokumenten(
        app,
        kopf,
        entwurfId,
        stand,
        "4137zwei-0000-4000-8000-000000000001",
        [
          { objectId: objektId, auszug: QUELLSATZ },
          { objectId: objektId, auszug: ZWEITER_AUSZUG },
        ],
      );
      expect(erzeugt.statusCode, erzeugt.body).toBe(201);
      const ko = erzeugt.json() as Wissensobjekt;

      // ---- KALIBRIERUNG: der Fall ist wirklich hergestellt ----------------------------------
      const anhaenge = ko.attachments ?? [];
      const quellen = ko.sources ?? [];
      expect(anhaenge).toHaveLength(2);
      expect(quellen).toHaveLength(2);
      // DASSELBE Original, ZWEI Anhänge — genau die Mehrdeutigkeit, um die es geht.
      expect(anhaenge.map((a) => a.objectId)).toEqual([objektId, objektId]);
      expect(anhaenge[0]?.id).not.toBe(anhaenge[1]?.id);
      // Die Reihenfolge der Bündel steht am Objekt und wird nicht angenommen, sondern gelesen.
      expect(quellen[0]?.excerpt).toBe(QUELLSATZ);
      expect(quellen[1]?.excerpt).toBe(ZWEITER_AUSZUG);

      const vorher = await belegkette(app, kopf, ko.id);
      expect(vorher.map((z) => z.kind).sort()).toEqual([
        "attachment",
        "attachment",
        "source",
        "source",
      ]);
      const zuordnung = (sourceId?: string): string | undefined =>
        vorher.find((z) => z.kind === "source" && z.sourceId === sourceId)?.attachmentId;
      // JEDE Belegstelle zeigt auf den Anhang IHRES Bündels. Das weiß nur der schreibende Vorgang.
      expect(zuordnung(quellen[0]?.id)).toBe(anhaenge[0]?.id);
      expect(zuordnung(quellen[1]?.id)).toBe(anhaenge[1]?.id);

      // ---- DER NACHZUG, zweimal --------------------------------------------------------------
      const gespeichertesKo = await services.ko.get(ko.id);
      if (!gespeichertesKo) {
        throw new Error("Testaufbau: das erzeugte Wissensobjekt fehlt im Bestand");
      }
      await services.ko.ensureCreatedSideEffects(gespeichertesKo);
      await services.ko.ensureCreatedSideEffects(gespeichertesKo);

      const nachher = await belegkette(app, kopf, ko.id);
      expect(
        nachher,
        "WENN DIESE ZEILE ROT IST, erkennt der Nachzug eine belegte Quelle nicht mehr, sobald er ihre Herkunft anders ableitet als der Vorgang, der sie geschrieben hat (BEN, Runde 2: vier Records vorher, fünf danach).",
      ).toEqual(vorher);
    } finally {
      await app.close();
    }
  }, 120_000);

  // ==============================================================================================
  // H12 · JOB 4137 R3 — BRICHT DIE BELEGABLAGE BEIM EINREICHEN, SCHLIESST DER NACHZUG DIE LÜCKE.
  // ==============================================================================================
  //
  // H10 und H11 fahren den Nachzug über eine VOLLSTÄNDIGE Kette — sie zeigen, dass er nichts
  // doppelt. Hier steht die andere Hälfte derselben Zusage, und ohne sie wäre die erste wertlos:
  // ein Nachzug, der gar nichts schreibt, wäre trivial doppelfrei und nutzlos. Gemessen wird der
  // Zustand, für den es ihn gibt — das Objekt ist im Bestand, seine Belegzeile fehlt.
  it("H12 · bricht die Belegablage beim Einreichen, zieht der Nachzug GENAU die fehlende Zeile nach", async () => {
    let gestoerteKennung: string | null = null;
    const { app, kopf, services } = await buehneMitBelegstoerung((record) => {
      if (record.kind === "source" && gestoerteKennung === null) {
        gestoerteKennung = record.koId;
        return "werfen";
      }
      return "durchlassen";
    });
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
        "4137luck-0000-4000-8000-000000000001",
      );
      // DER BRUCH IST ECHT: der Vorgang scheitert, und zwar NICHT still.
      expect(befoerdert.statusCode, befoerdert.body).not.toBe(201);
      const kennung = gestoerteKennung;
      if (!kennung) {
        throw new Error("Testaufbau: die Belegablage wurde gar nicht erst gerufen");
      }

      // ---- WAS DER BRUCH HINTERLÄSST, gemessen statt behauptet -------------------------------
      const halbes = await services.ko.get(kennung);
      if (!halbes) {
        throw new Error("Testaufbau: das Wissensobjekt ist gar nicht erst entstanden");
      }
      expect(halbes.sources ?? []).toHaveLength(1);
      expect(
        await belegkette(app, kopf, kennung),
        "WENN DIESE ZEILE ROT IST, ist die Lücke gar nicht entstanden — dann misst der Rest dieses Falls nichts.",
      ).toEqual([]);

      // ---- DER NACHZUG schliesst sie, und zwar EINMAL ----------------------------------------
      await services.ko.ensureCreatedSideEffects(halbes);
      const geschlossen = await belegkette(app, kopf, kennung);
      expect(geschlossen.map((z) => z.kind)).toEqual(["source"]);
      expect(geschlossen[0]?.sourceId).toBe((halbes.sources ?? [])[0]?.id);
      expect(geschlossen[0]?.excerpt).toBe(QUELLSATZ);

      await services.ko.ensureCreatedSideEffects(halbes);
      expect(
        await belegkette(app, kopf, kennung),
        "WENN DIESE ZEILE ROT IST, schreibt der zweite Nachzug die eben nachgezogene Zeile noch einmal.",
      ).toEqual(geschlossen);
    } finally {
      await app.close();
    }
  }, 120_000);

  // ==============================================================================================
  // H13 · JOB 4137 R3 — DIE LÜCKE AM MEHRFACH GEBUNDENEN ORIGINAL: DIE SCHWÄCHERE, WAHRE AUSSAGE.
  // ==============================================================================================
  //
  // DER HÄRTESTE FALL, und BENS Prüflücke aus Runde 2: eine FEHLENDE `source`-Zeile an einem Objekt,
  // dessen Anker MEHRDEUTIG ist (zwei Anhänge, dasselbe Original). Der Nachzug muss diese eine Zeile
  // schreiben — aber er WEISS nicht, aus welchem der beiden Anhänge die Belegstelle stammt: das
  // wusste nur das Bündel, und das ist vorbei. Er darf deshalb nicht raten.
  //
  // WAS DABEI HERAUSKOMMT, ist eine Zeile OHNE `attachmentId`: „diese Belegstelle gehört zu diesem
  // Objekt" — wahr — statt „sie stammt aus genau diesem Anhang" — vielleicht falsch. Das ist
  // dieselbe Regel wie überall im Produkt: fehlt die Voraussetzung, steht die schwächere Aussage da.
  // Und die drei Zeilen, die schon dastehen, bleiben unangetastet.
  it("H13 · fehlt eine Zeile am mehrfach gebundenen Original, zieht der Nachzug sie OHNE geratene Herkunft nach", async () => {
    let verschluckt = 0;
    const { app, kopf, services } = await buehneMitBelegstoerung((record) => {
      // Die LETZTE der vier Zeilen kommt nicht an: zwei `attachment`, dann zwei `source`.
      if (record.kind === "source" && verschluckt === 0 && record.excerpt === ZWEITER_AUSZUG) {
        verschluckt += 1;
        return "verschlucken";
      }
      return "durchlassen";
    });
    try {
      const entwurfId = await entwurfAusDocx(app, kopf);
      const objektId = await originalSichern(app, kopf, entwurfId);
      const stand = {
        ...PFLICHT,
        anchorDocuments: [
          { key: "anker-1", objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
        ],
      };
      await speichernUndKalibrieren(app, kopf, entwurfId, stand, objektId);
      const erzeugt = await ausDokumenten(
        app,
        kopf,
        entwurfId,
        stand,
        "4137luck-0000-4000-8000-000000000002",
        [
          { objectId: objektId, auszug: QUELLSATZ },
          { objectId: objektId, auszug: ZWEITER_AUSZUG },
        ],
      );
      expect(erzeugt.statusCode, erzeugt.body).toBe(201);
      const ko = erzeugt.json() as Wissensobjekt;
      const anhaenge = ko.attachments ?? [];
      const quellen = ko.sources ?? [];
      expect(anhaenge).toHaveLength(2);
      expect(quellen).toHaveLength(2);

      // ---- KALIBRIERUNG: die Lücke ist da, und es ist die richtige ---------------------------
      const mitLuecke = await belegkette(app, kopf, ko.id);
      // Als MENGE, nicht als Reihenfolge: die Zeilen einer Erstanlage tragen denselben Zeitpunkt,
      // die Kette sortiert dann nach Kennung — eine Reihenfolge zu behaupten wäre unbelegt (H9).
      expect(
        mitLuecke.map((z) => z.kind).sort(),
        "WENN DIESE ZEILE ROT IST, ist die Lücke nicht entstanden — dann misst der Rest nichts.",
      ).toEqual(["attachment", "attachment", "source"]);
      expect(mitLuecke.some((z) => z.sourceId === quellen[1]?.id)).toBe(false);

      // ---- DER NACHZUG -----------------------------------------------------------------------
      const gespeichertesKo = await services.ko.get(ko.id);
      if (!gespeichertesKo) {
        throw new Error("Testaufbau: das erzeugte Wissensobjekt fehlt im Bestand");
      }
      await services.ko.ensureCreatedSideEffects(gespeichertesKo);
      const geschlossen = await belegkette(app, kopf, ko.id);
      expect(geschlossen).toHaveLength(4);
      // Die drei vorhandenen Zeilen sind unverändert — auch ihre Zuordnungen.
      expect(
        geschlossen.filter((z) => mitLuecke.some((alt) => alt.id === z.id)),
        "WENN DIESE ZEILE ROT IST, hat der Nachzug bestehende Zeilen angefasst — die Kette ist append-only.",
      ).toEqual(mitLuecke);
      const nachgezogen = geschlossen.find((z) => z.sourceId === quellen[1]?.id);
      expect(nachgezogen?.kind).toBe("source");
      expect(nachgezogen?.excerpt).toBe(ZWEITER_AUSZUG);
      expect(
        nachgezogen?.attachmentId,
        "WENN DIESE ZEILE ROT IST, hat der Nachzug bei mehrdeutigem Anker eine Herkunft GERATEN, statt sie wegzulassen.",
      ).toBeUndefined();

      // Und ein zweiter Nachzug lässt auch diese Zeile in Ruhe.
      await services.ko.ensureCreatedSideEffects(gespeichertesKo);
      expect(await belegkette(app, kopf, ko.id)).toEqual(geschlossen);
    } finally {
      await app.close();
    }
  }, 120_000);
});
