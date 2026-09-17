// ================================================================================================
// JOB 4156 · A1 — DIE GEBAUTE APP HAT DIE TÜR WIRKLICH.
// ================================================================================================
//
// DIE FRAGE DIESES FALLS IST NICHT „lässt sich das Plugin registrieren?". Die hat JOB 4154 schon
// beantwortet (`tests/wiki-gesamtanweisung/f8-plugin-registrierung.test.ts`, frische Fastify-
// Instanz). Sie lautet: antwortet DIE APP, die der Server fährt — `buildApp`, alle Routengruppen,
// echte Anmeldung, echtes Rechtetor —, auf diesen Adressen? Genau dazwischen lag die Lücke: ein
// registrierbares Plugin, das nirgends registriert war, ist in der App ein 404.
//
// DESHALB LÄUFT DIESER FALL AUF DER BÜHNE DER ROLLENABNAHME (`tests/beta-rollenabnahme/buehne.ts`)
// und baut sich keine eigene App. Eine zweite Art, die App zu bauen, wäre eine zweite Wahrheit
// darüber, wie das Produkt aussieht — und ausgerechnet dieser Auftrag darf sich die nicht leisten:
// er behauptet „in der App erreichbar".
//
// GEGENPROBE (gefahren, siehe RUECKGABE): in `services/app/src/build-app.ts` die Zeile
// `app.register(gesamtanweisungRoutes, …)` auskommentieren. Dann antwortet die App auf JEDER der
// zehn Adressen mit 404, und alle Fälle dieser Datei werden namentlich rot.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type FrischeBuehne,
  type Rolle,
  baueFrischeBuehne,
  kopfFuer,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

let buehne: FrischeBuehne;

// EINE Bühne für alle Fälle dieser Datei. Das ist hier ungefährlich und gewollt: nur ein Fall legt
// überhaupt etwas an, und keiner misst gegen eine Bestandsmenge — die übrigen fahren erfundene
// Kennungen. Eine frische Bühne je Fall kostete fünf volle App-Bauten für dieselbe Aussage.
beforeAll(async () => {
  buehne = await baueFrischeBuehne();
});

// Ohne dieses Schliessen bleiben die Schalter der Bühne gesetzt, und die nächste Prüfdatei misst
// gegen eine fremde Schalterlage (`buehne.ts`, Kopf).
afterAll(schliesseBuehnen);

async function ruf(
  methode: "GET" | "POST",
  url: string,
  rolle: Rolle,
  payload?: Record<string, unknown>,
) {
  return buehne.app.inject({
    method: methode,
    url,
    headers: kopfFuer(buehne, rolle),
    ...(payload === undefined ? {} : { payload }),
  });
}

describe("A1 · die Gesamtanweisung ist eine Tür der gebauten App", () => {
  it("die Route ist REGISTRIERT — kein 404 auf den eigenen Pfaden", async () => {
    // Der schärfste Beleg gegen „nicht registriert": eine erfundene Kennung. Gäbe es die Gruppe
    // nicht, käme hier ebenfalls 404 — aber aus dem Router und nicht aus dem Dienst. Deshalb steht
    // darunter der 201-Fall: er kann nur aus einem WIRKLICH registrierten Plugin kommen.
    const fehlt = await ruf("GET", "/api/gesamtanweisungen/gibt-es-nicht", "controller");
    expect(fehlt.statusCode).toBe(404);
    expect((fehlt.json() as { error: string }).error).toBe("NOT_FOUND");
  });

  it("die berechtigte Rolle bekommt 200 — angelegt, gelesen, mit Lückenvermerk", async () => {
    const angelegt = await ruf("POST", "/api/gesamtanweisungen", "controller", {
      titel: "Anlage anfahren",
      geltungsbereich: "Werk 1",
    });
    expect(angelegt.statusCode).toBe(201);
    const id = (angelegt.json() as { id: string }).id;
    expect(id.length).toBeGreaterThan(0);

    const gelesen = await ruf("GET", `/api/gesamtanweisungen/${id}`, "controller");
    expect(gelesen.statusCode).toBe(200);
    const stand = gelesen.json() as {
      titel: string;
      version: number;
      bausteine: unknown[];
      pruefanbindung: string;
    };
    expect(stand.titel).toBe("Anlage anfahren");
    expect(stand.version).toBe(1);
    expect(stand.bausteine).toEqual([]);
    // A6 am Draht: der Anschluss legt den Lückenvermerk nicht still.
    expect(stand.pruefanbindung).toBe("nicht_angebunden");
  });

  it("die gesperrte Rolle bekommt 403 — und der Gast kommt gar nicht erst zum Anlegen", async () => {
    // `POST /api/gesamtanweisungen` fordert `ko.create`; ein viewer trägt es nicht.
    const gast = await ruf("POST", "/api/gesamtanweisungen", "viewer", { titel: "Nicht erlaubt" });
    expect(gast.statusCode).toBe(403);
    expect((gast.json() as { error: string }).error).toBe("FORBIDDEN");
  });

  it("ENTSCHEIDEN ist eine andere Tür als EINREICHEN — der Experte wird abgewiesen", async () => {
    // Der Startvertrag wörtlich: „direkte Freigabe durch Berechtigte, Einreichen ohne
    // Freigaberecht". Ein Experte, der entscheiden dürfte, wäre dessen Bruch — und das Rechtetor
    // fällt VOR jeder Existenzprüfung, deshalb genügt hier eine erfundene Kennung.
    const experte = await ruf(
      "POST",
      "/api/gesamtanweisungen/gibt-es-nicht/entscheiden",
      "experte",
      { version: 1, entscheidung: "angenommen" },
    );
    expect(experte.statusCode).toBe(403);

    const controller = await ruf(
      "POST",
      "/api/gesamtanweisungen/gibt-es-nicht/entscheiden",
      "controller",
      { version: 1, entscheidung: "angenommen" },
    );
    // Durchgelassen — und erst dahinter scheitert es an der erfundenen Kennung. Genau dieser
    // Unterschied (403 gegen 404) belegt, dass das Rechtetor und nicht der Zufall entschieden hat.
    expect(controller.statusCode).toBe(404);
  });

  it("ohne Anmeldung ist jede dieser Türen 401", async () => {
    const ohne = await buehne.app.inject({
      method: "GET",
      url: "/api/gesamtanweisungen/gibt-es-nicht",
    });
    expect(ohne.statusCode).toBe(401);
  });
});
