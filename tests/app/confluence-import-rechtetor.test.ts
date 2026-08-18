import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ================================================================================================
// JOB 876 D2 — DAS RECHTETOR DER VIER CONFLUENCE-IMPORT-ROUTEN, AM DRAHT
// ================================================================================================
//
// D1 hat den Befund praezise gemacht: von fuenf Administrationsrouten des Confluence-Imports
// traegt heute nur **R1** (`POST /api/admin/import/confluence`) einen Testvertrag. **R2 bis R5
// haben keinen** — belegt durch drei unabhaengige Erhebungen (D1 §3.3).
//
// Was es fuer R2–R5 stattdessen gibt, ist kein Ersatz:
//   · `import-explore-wiring.test.ts:35` prueft den PFADNAMEN im Quelltext — eine Textpruefung,
//     kein Verhalten.
//   · `import-group-routes.test.ts` meldet sich MIT Adminrecht an (`:122`) und prueft den
//     Fachweg. `grep -nE "403|FORBIDDEN|users\.manage"` darin → **0 Treffer**.
//
// Der Auftrag nennt diese Datei deshalb ausdruecklich als GEGENBEISPIEL: ein Fachwegtest mit
// Adminrecht belegt nicht, dass ohne Recht gesperrt wird.
//
// DIESER VERTRAG PRUEFT DAS VERHALTEN, nicht den Quelltext: echte App, echte Anmeldung, echte
// Identitaet ohne `users.manage`, echte HTTP-Antwort.
//
// ------------------------------------------------------------------------------------------------
// DIE VIER ZUSAGEN, und warum jede einzeln zaehlt
// ------------------------------------------------------------------------------------------------
//
//   (1) STATUS EXAKT 403 — nicht 401, nicht 404.
//       `401` hiesse „melde dich an" und waere falsch: die Identitaet IST angemeldet. `404` waere
//       zwar sicher, verschluckt aber die Unterscheidung zwischen „darf nicht" und „gibt es nicht"
//       an einer Stelle, an der das Produkt sie treffen will.
//
//   (2) KOERPER EXAKT — `{"error":"FORBIDDEN","message":"Recht fehlt: users.manage"}`.
//       Woertlich, nicht „enthaelt". Eine Abschwaechung auf `toContain` wuerde jede Erweiterung
//       des Koerpers durchlassen — auch eine, die Fachinhalt mitschickt. Punkt 3 der verbindlichen
//       Reihenfolge verlangt den Beleg, dass genau diese Abschwaechung erkannt wird (s. unten).
//
//   (3) KEIN DATENLECK — weder die angefragte Kennung noch Fachinhalt im Verweigerungskoerper.
//       Eine Fehlermeldung, die die angefragte Id zurueckgibt, bestaetigt deren Existenz.
//
//   (4) RECHTETOR VOR OBJEKTAUFLOESUNG — existierende und nicht existierende Objekte sind fuer
//       den Unberechtigten ununterscheidbar. Laege das Tor dahinter, verriete die Antwortzeit
//       oder ein abweichender Status, ob es die Sache gibt.
//
//   (5) SEITENEFFEKTFREIHEIT — die abgewiesene Anfrage hinterlaesst nichts. ERGAENZT IN JOB 830 D2
//       auf die Auflage von BEN JOB 830 D1: „`explore`, `select`, `group`, `apply` benoetigen den
//       beschriebenen exakten 403-/SEITENEFFEKTvertrag." Die Punkte (1) bis (4) belegen, WAS die
//       Antwort sagt; keiner von ihnen belegt, was die Anfrage im Bestand ANRICHTET.
//
//       Warum das eine eigene Zusage ist: Die vier Routen legen auf ihrem Erfolgsweg Dinge an —
//       `confluence-import-routes.ts:155` `importRuns.insertIfAbsent(lauf)` und `:807`
//       `library.createImportCandidates(...)`. Ein Guard, der zwar 403 sendet, den Fachweg aber
//       vorher schon angestossen hat, waere an allen vier obigen Punkten gruen und trotzdem
//       falsch. Genau diese Luecke schliesst (5).
//
// AUSDRUECKLICH NICHT ENTSCHIEDEN: Die Rechtewahl **E1b** — ob `users.manage` das RICHTIGE Recht
// ist. Dieser Vertrag pinnt das heute im Produkt verlangte Recht, nichts weiter. BEN JOB 830 D1
// haelt ausdruecklich fest: „`users.manage` ist Iststand, nicht Freigabe."

const ADMIN = {
  name: "Admin 876",
  email: "admin876@example.com",
  password: "geheim-1234",
};

const OHNE_RECHT = {
  name: "Bea 876",
  email: "bea876@example.com",
  password: "geheim-1234",
};

// ------------------------------------------------------------------------------------------------
// DER SCHALTER — ohne ihn gibt es die vier Routen gar nicht
// ------------------------------------------------------------------------------------------------
//
// GEMESSEN im ersten Lauf dieses Vertrags: alle vier Routen antworteten
// `404 Route POST:/api/admin/import/confluence/... not found`.
//
// Ursache (`build-app.ts:1288`): die Routen werden **nur bei aktivem Import-Flag registriert**
// — der Kommentar dort sagt es woertlich: „Flag OFF → Route existiert nicht". Der Schalter heisst
// `KLARWERK_CONFLUENCE_IMPORT` (`feature-flags.ts:32`).
//
// WARUM DAS HIER STEHT UND NICHT IN EINER FUSSNOTE: Ein Rechtetor-Vertrag, der gegen eine nicht
// registrierte Route laeuft, misst die Fastify-404 statt der Berechtigung — und bestuende
// dauerhaft gruen, waehrend das Tor ungeprueft bliebe. Genau diese Klasse Scheinbeleg soll dieser
// Vertrag verhindern; sie waere ihm beinahe selbst unterlaufen.
process.env.KLARWERK_CONFLUENCE_IMPORT = "1";

/** Bootstrap-Admin ueber die echten Auth-Routen — dasselbe Muster wie `w2a-import-run-routes-148`. */
async function appMitAdmin() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token: string }).token;
  expect(token, "der Bootstrap-Admin muss ein Token bekommen").not.toBe("");
  return { app, headers: { authorization: `Bearer ${token}` } };
}

/**
 * Eine zweite, NACHWEISLICH angemeldete und freigegebene Identitaet OHNE `users.manage`.
 *
 * Der Nachweis ist nicht Beiwerk: Ein Test, dessen zweite Identitaet in Wahrheit gar nicht
 * angemeldet ist, bekommt sein `403` womoeglich von der Anmeldeschranke statt vom Rechtetor —
 * und belegt dann das Gegenteil dessen, was er behauptet. Deshalb prueft `bestaetigeAngemeldet`
 * VOR der Matrix, dass diese Identitaet eine geschuetzte Leseroute erfolgreich benutzen kann.
 */
async function ohneRecht(
  app: Awaited<ReturnType<typeof appMitAdmin>>["app"],
  adminHeaders: Record<string, string>,
) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: adminHeaders,
    payload: { ...OHNE_RECHT, role: "experte" },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: OHNE_RECHT.email, password: OHNE_RECHT.password },
  });
  const token = (login.json() as { token: string }).token;
  expect(token, "die Identitaet ohne Recht muss ein Token bekommen").not.toBe("");
  return { authorization: `Bearer ${token}` };
}

/** Die vier bislang unbewachten Routen — R2 bis R5 aus D1 §3.1. */
const ROUTEN = [
  { name: "R2 explore", url: "/api/admin/import/confluence/explore" },
  { name: "R3 select", url: "/api/admin/import/confluence/select" },
  { name: "R4 group", url: "/api/admin/import/confluence/group" },
  { name: "R5 apply", url: "/api/admin/import/confluence/apply" },
] as const;

const VERWEIGERT = { error: "FORBIDDEN", message: "Recht fehlt: users.manage" };

describe("JOB 876 D2 · Rechtetor R2–R5: die Identitaet ist wirklich angemeldet", () => {
  it("die Identitaet ohne users.manage kann eine geschuetzte Leseroute benutzen", async () => {
    // Die Kalibrierung des ganzen Vertrags: ohne sie koennte jedes 403 unten von der
    // Anmeldeschranke stammen statt vom Rechtetor.
    const { app, headers } = await appMitAdmin();
    const bea = await ohneRecht(app, headers);
    const res = await app.inject({ method: "GET", url: "/api/kos", headers: bea });
    expect(res.statusCode, res.body).toBe(200);
  });
});

describe("JOB 876 D2 · Rechtetor R2–R5: exakt 403 mit exaktem Koerper", () => {
  for (const route of ROUTEN) {
    it(`${route.name} — 403, nicht 401, nicht 404`, async () => {
      const { app, headers } = await appMitAdmin();
      const bea = await ohneRecht(app, headers);
      const res = await app.inject({ method: "POST", url: route.url, headers: bea, payload: {} });

      expect(res.statusCode, `${route.name}: ${res.body}`).toBe(403);
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(404);
    });

    it(`${route.name} — Koerper EXAKT, nicht nur enthalten`, async () => {
      const { app, headers } = await appMitAdmin();
      const bea = await ohneRecht(app, headers);
      const res = await app.inject({ method: "POST", url: route.url, headers: bea, payload: {} });

      // `toEqual` auf dem GANZEN Koerper: ein zusaetzliches Feld faellt auf. Genau das prueft
      // Punkt 3 der verbindlichen Reihenfolge.
      expect(res.json()).toEqual(VERWEIGERT);
    });
  }
});

describe("JOB 876 D2 · die Abschwaechung des Koerpervergleichs wird erkannt", () => {
  // Punkt 3 der verbindlichen Reihenfolge: „Belege zusaetzlich, dass eine Abschwaechung des
  // exakten Koerpervergleichs erkannt wird."
  //
  // DIE ABSCHWAECHUNG WIRD HIER AM MATCHER BELEGT, NICHT AM PRODUKT. Die Verweigerung entsteht in
  // `services/app/src/http.ts:169` — ein Pfad, den die Lease dieses Auftrags NICHT freigibt. Eine
  // Gegenmutation dort waere ein Scopeverstoss. Der Beleg ist trotzdem vollstaendig: er zeigt an
  // einem erweiterten Koerper, dass `toEqual` ihn zurueckweist und `toMatchObject` ihn durchliesse.
  const ERWEITERT = { ...VERWEIGERT, angefragt: "KWMARKE-ID-876" };

  it("toEqual weist einen um ein Feld erweiterten Koerper zurueck", () => {
    expect(() => expect(ERWEITERT).toEqual(VERWEIGERT)).toThrow();
  });

  it("toMatchObject wuerde ihn durchlassen — deshalb steht oben toEqual", () => {
    // Genau das ist der Grund fuer den strengen Matcher: mit `toMatchObject` bliebe der Vertrag
    // gruen, obwohl die Verweigerung die angefragte Kennung mitschickt — also ein Datenleck.
    expect(ERWEITERT).toMatchObject(VERWEIGERT);
  });
});

describe("JOB 876 D2 · Rechtetor R2–R5: kein Datenleck im Verweigerungskoerper", () => {
  for (const route of ROUTEN) {
    it(`${route.name} — weder angefragte Kennung noch Fachinhalt`, async () => {
      const { app, headers } = await appMitAdmin();
      const bea = await ohneRecht(app, headers);
      // Unverwechselbare Marken: waeren sie in der Antwort, kaeme der Wert aus der Anfrage.
      const res = await app.inject({
        method: "POST",
        url: route.url,
        headers: bea,
        payload: {
          spaceKey: "KWMARKE-SPACE-876",
          candidateId: "KWMARKE-ID-876",
          criteria: { thema: "KWMARKE-THEMA-876" },
        },
      });

      expect(res.statusCode).toBe(403);
      const roh = res.body;
      expect(roh, "die angefragte Kennung steht in der Verweigerung").not.toContain(
        "KWMARKE-ID-876",
      );
      expect(roh, "der angefragte Space steht in der Verweigerung").not.toContain(
        "KWMARKE-SPACE-876",
      );
      expect(roh, "Fachinhalt steht in der Verweigerung").not.toContain("KWMARKE-THEMA-876");
    });
  }
});

describe("JOB 876 D2 · Rechtetor R2–R5: das Tor liegt VOR der Objektaufloesung", () => {
  for (const route of ROUTEN) {
    it(`${route.name} — existierend und nicht existierend sind ununterscheidbar`, async () => {
      const { app, headers } = await appMitAdmin();
      const bea = await ohneRecht(app, headers);

      // Zwei Anfragen, die sich NUR in der Kennung unterscheiden: eine plausible, eine
      // offensichtlich erfundene. Laege das Rechtetor hinter der Aufloesung, muesste sich
      // mindestens eine der beiden Antworten unterscheiden.
      const a = await app.inject({
        method: "POST",
        url: route.url,
        headers: bea,
        payload: { candidateId: "vermutlich-vorhanden" },
      });
      const b = await app.inject({
        method: "POST",
        url: route.url,
        headers: bea,
        payload: { candidateId: "gibt-es-ganz-sicher-nicht-876" },
      });

      expect(a.statusCode).toBe(403);
      expect(b.statusCode, "die Antworten unterscheiden sich nach Existenz").toBe(a.statusCode);
      expect(b.body, "die Koerper unterscheiden sich nach Existenz").toBe(a.body);
    });
  }
});

// Der Weg, auf dem ein Seiteneffekt dieser vier Routen ueberhaupt sichtbar wuerde.
//
// NICHT `/api/kos`: Die Routen legen bei Erfolg **Review-Kandidaten** an, keine Wissensobjekte —
// `confluence-import-routes.ts:713` sagt es woertlich („createImportCandidates → Review-Queue")
// und `:807` ruft es auf. Eine Nullmessung an `/api/kos` waere gruen geblieben, egal wie viele
// Kandidaten entstehen; sie haette die Zusage nur vorgetaeuscht. Gemessen wird deshalb die
// Review-Queue selbst (`library-routes.ts:261`).
const KANDIDATEN = "/api/library/import/candidates";

describe("JOB 830 D2 · Rechtetor R2–R5: die abgewiesene Anfrage hinterlaesst nichts", () => {
  // Bauform aus `w2a-import-run-routes-148.test.ts:263-270`: Bestandszahl vorher == nachher,
  // gelesen MIT Adminrecht — der Unberechtigte darf den Bestand ja gar nicht sehen, sonst
  // pruefte der Fall erneut nur das Tor.
  for (const route of ROUTEN) {
    it(`${route.name} — kein Bestandszuwachs nach der Verweigerung`, async () => {
      const { app, headers } = await appMitAdmin();
      const bea = await ohneRecht(app, headers);

      const vorher = await app.inject({ method: "GET", url: KANDIDATEN, headers });
      expect(vorher.statusCode, vorher.body).toBe(200);
      const bestandVorher = (vorher.json() as unknown[]).length;

      const abgewiesen = await app.inject({
        method: "POST",
        url: route.url,
        headers: bea,
        payload: {
          spaceKey: "KWMARKE-SPACE-830",
          candidateId: "KWMARKE-ID-830",
          criteria: { thema: "KWMARKE-THEMA-830" },
          selectedCandidateIds: ["KWMARKE-ID-830"],
          includeIds: ["KWMARKE-ID-830"],
        },
      });
      expect(abgewiesen.statusCode, abgewiesen.body).toBe(403);

      const nachher = await app.inject({ method: "GET", url: KANDIDATEN, headers });
      expect(nachher.statusCode, nachher.body).toBe(200);
      expect(
        (nachher.json() as unknown[]).length,
        `${route.name}: die verweigerte Anfrage hat einen Kandidaten angelegt`,
      ).toBe(bestandVorher);
    });
  }

  it("die Messung ist nicht vakuoes: derselbe Leseweg sieht einen echten Zuwachs", async () => {
    // OHNE DIESEN FALL waere die Zusage oben wertlos. Bliebe die Review-Queue aus einem
    // beliebigen Grund immer leer — falsche Rolle, veraenderte Antwortform, anderer Speicher —,
    // dann waere „vorher == nachher" auch dann gruen, wenn die vier Routen munter Kandidaten
    // anlegten. Hier wird belegt, dass GENAU DIESER Leseweg einen Zuwachs ueberhaupt anzeigt.
    const { app, headers } = await appMitAdmin();

    const vorher = await app.inject({ method: "GET", url: KANDIDATEN, headers });
    expect(vorher.statusCode, vorher.body).toBe(200);
    const bestandVorher = (vorher.json() as unknown[]).length;

    const angelegt = await app.inject({
      method: "POST",
      url: KANDIDATEN,
      headers,
      payload: {
        items: [
          {
            title: "KWMARKE-KONTROLLE-830",
            statement: "Kontrolllauf fuer die Bestandsmessung",
            type: "best_practice",
          },
        ],
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);

    const nachher = await app.inject({ method: "GET", url: KANDIDATEN, headers });
    expect(
      (nachher.json() as unknown[]).length,
      "der Leseweg zeigt keinen Zuwachs — dann traegt die Nullmessung oben nicht",
    ).toBe(bestandVorher + 1);
  });
});
