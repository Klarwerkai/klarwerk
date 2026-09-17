// ================================================================================================
// JOB 4299 · DIE KALIBRIERUNG — DIESELBEN ERWARTUNGEN, GEGEN DEN SPEICHERBESTAND.
// ================================================================================================
//
// WAS DIESE DATEI IST UND WAS SIE NICHT IST. Sie ist KEINE zweite Abnahme und ersetzt die Messung
// gegen echtes PostgreSQL nicht — sie ist deren Massstab. Rechte und Konfliktverhalten des
// Word-Rückwegs werden hier gegen `InMemoryKoRepo` gefahren, mit GENAU DEN Erwartungen, die auch
// `rueckweg-pg.integration.test.ts` (Q4/Q5) liest: beide Dateien holen Rollen, Ausgangsstand,
// Fassungsnummern und Endzustand aus `rueckweg-erwartung.ts`. Wer dort eine Zahl verstellt, färbt
// beide rot. Das ist das Muster aus
// `services/knowledge-object/src/repo-pg-kandidaten.integration.test.ts:22-24` — derselbe Massstab,
// zwei Adapter.
//
// WARUM SIE NICHT `*.integration.test.ts` HEISST. Sie braucht keine Datenbank und gehört deshalb in
// den regulären Torlauf (`vitest.config.ts:32` schliesst nur Integrationsnamen aus). Sie ist damit
// das Red-first dieses Auftrags: geschrieben, bevor Q4 und Q5 existierten, und gegen die echte
// Route gefahren — nicht gegen einen Dienstaufruf mit erfundener Kennung.
//
// DER WEG IST DER ECHTE: `buildApp(assembleServices(inMemoryRepos()))`, echtes Register, echtes
// Login, echtes `PUT /api/kos/:id`. Nur die ABLAGE ist eine andere. Eine Rechteprüfung, die man am
// Dienst vorbei misst, belegt über Rechte nichts — sie sitzt in `requirePermission`, also an der
// Route.
import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KoRepo } from "../../services/knowledge-object/src/repo";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import {
  BESTAND_RUMPF,
  BESTAND_SATZ,
  EINREICHER,
  ENTSCHEIDER,
  Q4,
  Q5,
  ZWEITER_EINREICHER,
  anmeldung,
  bestandsObjekt,
  entscheide,
  reicheVorschlagEin,
  richteKontenEin,
  vorschlagAus,
} from "./rueckweg-erwartung";

describe("JOB 4299 · Kalibrierung: Rechte und Konflikt des Word-Rückwegs im Speicherbestand", () => {
  let app: FastifyInstance;
  let koRepo: KoRepo;

  beforeEach(async () => {
    const repos = inMemoryRepos();
    koRepo = repos.koRepo;
    app = buildApp(assembleServices(repos));
    await richteKontenEin(app);
  });

  /** Das Gegenstück zu `nachNeuerVerbindung`: gelesen wird, was die ABLAGE hält. */
  async function ausDerAblage(id: string): Promise<KnowledgeObject | undefined> {
    return koRepo.findById(id);
  }

  it("Q4-Kalibrierung · ohne das Entscheidungsrecht ändert sich nichts — erst das berechtigte Konto schreibt die Fassung", async () => {
    await koRepo.insert(bestandsObjekt(Q4.kennung, BESTAND_RUMPF));
    const einreicher = await anmeldung(app, EINREICHER);
    const vorschlagId = await reicheVorschlagEin(app, einreicher, Q4.kennung, {
      statement: Q4.vorschlagStatement,
      bodyHtml: Q4.kalibrierungRumpf,
      baseVersion: Q4.ausgangsVersion,
      origin: Q4.herkunft,
    });

    // DREI KONTEN OHNE DAS RECHT — der Einreicher selbst, ein fremder Experte und ein Prüfer mit
    // `ko.validate`. Jeder einzeln, damit die Abweisung nicht an einem Sonderfall hängt.
    for (const konto of Q4.ohneEntscheidungsrecht) {
      const kopf = await anmeldung(app, konto);
      const versuch = await entscheide(app, kopf, Q4.kennung, vorschlagId, Q4.ausgangsVersion);
      expect(versuch.statusCode, `${konto.email} (${konto.rolle}): ${versuch.body}`).toBe(
        Q4.abweisungHttp,
      );
      expect((versuch.json() as { error?: string }).error).toBe(Q4.abweisungCode);

      // NACH JEDEM Versuch zurückgelesen: die Ablage hat sich nicht bewegt.
      const zwischenstand = await ausDerAblage(Q4.kennung);
      expect(zwischenstand?.version).toBe(Q4.versionNachAbweisung);
      expect(zwischenstand?.bodyHtml).toBe(BESTAND_RUMPF);
      expect(vorschlagAus(zwischenstand, vorschlagId)?.status).toBe(Q4.statusNachAbweisung);
    }

    // DAS KONTO MIT DEM RECHT — erst jetzt entsteht die Fassung.
    const entscheider = await anmeldung(app, ENTSCHEIDER);
    const uebernahme = await entscheide(
      app,
      entscheider,
      Q4.kennung,
      vorschlagId,
      Q4.ausgangsVersion,
    );
    expect(uebernahme.statusCode, uebernahme.body).toBe(Q4.uebernahmeHttp);

    const nachher = await ausDerAblage(Q4.kennung);
    expect(nachher?.version).toBe(Q4.versionNachUebernahme);
    expect(nachher?.statement).toBe(Q4.vorschlagStatement);
    // POSITIV, nicht nur negativ: der eingereichte Rumpf steht jetzt wirklich da. Die frühere Zeile
    // prüfte allein „enthält den alten Satz nicht" — das hätte auch ein LEERER Rumpf erfüllt
    // (BENs Korrekturpflicht 3, Runde 1). Erst danach die Ablösung: ersetzt, nicht danebengestellt.
    expect(nachher?.bodyHtml).toBe(Q4.kalibrierungRumpf);
    expect(nachher?.bodyHtml ?? "").not.toContain(BESTAND_SATZ);
    expect(vorschlagAus(nachher, vorschlagId)?.status).toBe(Q4.statusNachUebernahme);
  });

  it("Q5-Kalibrierung · zwei Entscheidungen auf denselben Stand erzeugen keine zweite Wahrheit", async () => {
    await koRepo.insert(bestandsObjekt(Q5.kennung, BESTAND_RUMPF));
    const einreicherA = await anmeldung(app, EINREICHER);
    const einreicherB = await anmeldung(app, ZWEITER_EINREICHER);
    const vorschlagA = await reicheVorschlagEin(app, einreicherA, Q5.kennung, {
      statement: Q5.statementA,
      bodyHtml: Q5.rumpfA,
      baseVersion: Q5.basisVersion,
      origin: Q4.herkunft,
    });
    const vorschlagB = await reicheVorschlagEin(app, einreicherB, Q5.kennung, {
      statement: Q5.statementB,
      bodyHtml: Q5.rumpfB,
      baseVersion: Q5.basisVersion,
      origin: Q4.herkunft,
    });

    const entscheider = await anmeldung(app, ENTSCHEIDER);
    const a = await entscheide(app, entscheider, Q5.kennung, vorschlagA, Q5.basisVersion);
    expect(a.statusCode, a.body).toBe(Q5.uebernahmeHttp);
    const nachA = await ausDerAblage(Q5.kennung);
    expect(nachA?.version).toBe(Q5.versionNachA);
    // Der FLIESSTEXT von A, nicht nur sein `statement` — sonst überlebt ein Fließtextverlust
    // die Abnahme (BENs Korrekturpflicht 1, Runde 1).
    expect(nachA?.bodyHtml).toBe(Q5.erwarteterRumpfNachKonflikt);

    // DERSELBE erwartete Stand, ein zweites Mal — der Stand hat sich aber bewegt.
    const b = await entscheide(app, entscheider, Q5.kennung, vorschlagB, Q5.basisVersion);
    expect(b.statusCode, b.body).toBe(Q5.konfliktHttp);
    const fehler = b.json() as { error?: string; currentVersion?: number };
    expect(fehler.error).toBe(Q5.konfliktCode);
    // Ohne die jetzt gespeicherte Fassung kann die Fläche nur „hat nicht geklappt" sagen.
    expect(fehler.currentVersion).toBe(Q5.konfliktNenntVersion);

    const nachher = await ausDerAblage(Q5.kennung);
    expect(nachher?.version).toBe(Q5.erwarteteEndfassung);
    expect(nachher?.statement).toBe(Q5.statementA);
    // DER FLIESSTEXT NACH DER ABWEISUNG: unverändert der von A. Drei Fehlerbilder, drei Zeilen —
    // verloren (`toBe` trifft nicht), von B überschrieben (`merkmalB` stünde da), oder A ist weg.
    expect(nachher?.bodyHtml).toBe(Q5.erwarteterRumpfNachKonflikt);
    expect(nachher?.bodyHtml ?? "").toContain(Q5.merkmalA);
    expect(
      nachher?.bodyHtml ?? "",
      "der abgewiesene Vorschlag B hat trotzdem in den Fließtext geschrieben",
    ).not.toContain(Q5.merkmalB);
    expect(vorschlagAus(nachher, vorschlagA)?.status).toBe(Q5.statusA);
    // B ist nicht stumm verschwunden und nicht heimlich übernommen.
    expect(vorschlagAus(nachher, vorschlagB)).toBeDefined();
    expect(vorschlagAus(nachher, vorschlagB)?.status).toBe(Q5.statusB);
  });
});
