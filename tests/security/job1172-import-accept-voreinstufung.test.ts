// ================================================================================================
// JOB 1172 · D1 — DIE KONSERVATIVE VOREINSTUFUNG BEIM IMPORT-ACCEPT, GEPINNT.
// ================================================================================================
//
// WAS HIER GEPINNT WIRD, und warum es bis heute ungepinnt war:
//
// `services/library-analytics/src/service.ts:1099` setzt beim Accept eines Import-Kandidaten
//
//     confidentiality: item.confidentiality ?? "vertraulich"
//
// Der Code begruendet das selbst (`:1096-1098`): *„Import ist ein Bulk-/Programmatik-Pfad →
// konservativ. Fehlt das Governance-Signal, gilt ‚vertraulich' (NICHT still intern) — importierter
// Fremdinhalt bleibt bis zur bewussten Freigabe aus Cloud/Export heraus."*
//
// Das ist eine GETROFFENE Entscheidung — und sie hatte keinen Waechter. Faellt das `?? "vertraulich"`
// weg, entstuende aus fremdem Importmaterial still ein Objekt ohne Einstufung; ob es dann als
// „intern" behandelt wird, entscheidet der Normalisierungspfad und nicht mehr diese Regel. Der
// Wegfall waere in keinem Testlauf sichtbar geworden.
//
// WAS DIESE DATEI AUSDRUECKLICH NICHT PRUEFT — die Trennung ist der Kern des Auftrags:
//
//   · NICHT, welche Berechtigung die Review-Queue schuetzen soll. Das ist eine offene OWNERFRAGE
//     (JOB 1172, Rueckgabe Abschnitt „Ownerfrage"); an Guard, DTO-Allowlist und Typen wurde nichts
//     geaendert. Diese Datei trifft dazu keine Aussage — weder eine bestaetigende noch eine
//     verneinende.
//   · NICHT den Fall MIT Governance-Signal. Den faehrt `mega82-importeur-handelt.test.ts:322`
//     bereits (dort wird `confidentiality: "vertraulich"` ausdruecklich mitgegeben) — gepinnt ist
//     dort also der durchgereichte Wert, NICHT der `??`-Zweig. Hier geht es allein um das FEHLEN
//     des Signals.
//
// FUNDSTELLENNACHWEIS gegen die Nachbarn (im laufenden Durchgang gemessen): `confidentiality`
// kommt in `tests/security/mega74-lesewege-sammler.test.ts` und in
// `tests/security/import-guard-kausal-403.test.ts` **null Mal** vor. Diese Datei doppelt nichts.
//
// KEIN ROTER ERSTLAUF — und das ist hier richtig so: die Regel ist gebaut, der Waechter ist ab der
// ersten Sekunde gruen. Der Beweis, dass er wirklich SIE prueft und nicht nur mitlaeuft, ist die
// Gegenmutation (Entfernen des `?? "vertraulich"`), die in der Rueckgabe mit Hash vor und nach der
// bytegenauen Ruecknahme belegt ist.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADMIN = { name: "Pedi", email: "pedi1172w@example.com", password: "geheim-1234" };

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
  return { app, kopf: { authorization: `Bearer ${token}` } };
}

/** Legt genau EINEN Kandidaten an und gibt seine Id zurueck. */
async function kandidatAnlegen(
  app: Awaited<ReturnType<typeof appMitAdmin>>["app"],
  kopf: Record<string, string>,
  item: Record<string, unknown>,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: kopf,
    payload: { items: [item] },
  });
  expect(res.statusCode, res.body).toBe(201);
  const id = (res.json() as { id: string }[])[0]?.id;
  expect(id, "der Kandidat muss eine Id bekommen").toBeTruthy();
  return id as string;
}

describe("JOB 1172 · Import-Accept: fehlendes Governance-Signal ergibt „vertraulich“", () => {
  it("ein Kandidat OHNE confidentiality wird beim Accept zu einem vertraulichen Objekt", async () => {
    const { app, kopf } = await appMitAdmin();

    // Das Governance-Signal fehlt ABSICHTLICH — genau das ist der Zweig, um den es geht.
    const kandidatId = await kandidatAnlegen(app, kopf, {
      title: "Fremdimport ohne Einstufung",
      statement: "Aus einer Fremdquelle uebernommen, ohne Governance-Signal.",
      type: "technik",
      category: "Anlage 7",
    });

    const accept = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidatId}`,
      headers: kopf,
      payload: { action: "accept" },
    });
    expect(accept.statusCode, accept.body).toBe(200);

    const koId = (accept.json() as { koId: string | null }).koId;
    expect(koId, "der Accept muss ein Wissensobjekt anlegen").toBeTruthy();

    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: kopf });
    expect(ko.statusCode, ko.body).toBe(200);

    // DIE ZUSAGE: fehlt das Signal, gilt „vertraulich" — nicht „intern", nicht undefined.
    expect((ko.json() as { confidentiality?: string }).confidentiality).toBe("vertraulich");
  });

  it("die Voreinstufung ist ein RUECKFALL, kein Ueberschreiben: ein mitgegebenes „intern“ wird NICHT vertraulich", async () => {
    // Die Gegenrichtung gehoert dazu, sonst waere der Waechter auch dann gruen, wenn jemand die
    // Stufe hart auf „vertraulich" verdrahtete. Dann waere aus dem konservativen Rueckfall eine
    // Zwangseinstufung geworden — eine andere Regel, die niemand entschieden hat.
    //
    // GEMESSEN, NICHT ANGENOMMEN: ein mitgegebenes „intern" erscheint am Objekt NICHT als Wert,
    // sondern als FEHLENDES Feld. Das ist die dokumentierte Modellregel („fehlt = intern", s.
    // `KnowledgeObject.confidentiality?` und SCRUM-415) und kein Verlust — die erste Fassung dieses
    // Falls erwartete faelschlich den Wert „intern" und war deshalb rot. Gepinnt wird deshalb die
    // Zusage, die hier wirklich gilt: der Rueckfall greift NUR beim Fehlen des Signals.
    const { app, kopf } = await appMitAdmin();

    const kandidatId = await kandidatAnlegen(app, kopf, {
      title: "Fremdimport MIT Einstufung",
      statement: "Aus einer Fremdquelle uebernommen, Governance-Signal liegt vor.",
      type: "technik",
      category: "Anlage 7",
      confidentiality: "intern",
    });

    const accept = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidatId}`,
      headers: kopf,
      payload: { action: "accept" },
    });
    expect(accept.statusCode, accept.body).toBe(200);

    const koId = (accept.json() as { koId: string | null }).koId;
    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: kopf });
    expect(ko.statusCode, ko.body).toBe(200);
    expect((ko.json() as { confidentiality?: string }).confidentiality).not.toBe("vertraulich");
  });
});
