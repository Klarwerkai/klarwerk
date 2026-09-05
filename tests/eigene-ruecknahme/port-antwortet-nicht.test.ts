import { afterEach, describe, expect, it, vi } from "vitest";
import { befund, belege, koAnlegen, welt } from "./welt";

// ================================================================================================
// JOB 3071 R2 · bens KORREKTURPFLICHT 1 — „ANTWORTET NICHT" IST NICHT „WIRFT".
// ================================================================================================
//
// Runde 1 deckte den Fehlerfall des Rücknahme-Ports mit `Promise.reject(...)` ab. Das ist ein
// WERFENDER Port — er antwortet, nur eben mit einem Fehler. Der Zustand, den das Zustandsmodell des
// Auftrags (§9) ausdrücklich mitmeint, ist ein anderer: eine Zusage, die sich WEDER erfüllt NOCH
// verwirft. Genau das tut eine hängende Datenbankverbindung.
//
// WARUM DAS AN DIESER STELLE TEUER IST — bens Messung an R1, wörtlich:
//   `ergebnis=blockiert koSichtbar=false overlapStatus=offen`
// Der Nachlauf der Löschroute läuft NACH `ko.delete` (ko-routes.ts:1682 vor :1685-1687). Das weiche
// Löschen ist zu diesem Zeitpunkt schon geschrieben. Wartete der Dienst dort unbegrenzt, bekäme der
// Mensch NIE eine Antwort auf sein DELETE, und über einem Beitrag, der bereits im Papierkorb liegt,
// bliebe der Dublettenbefund OFFEN stehen — die Geisterwarnung, gegen die dieser ganze Weg gebaut
// ist.
//
// Der Fall läuft deshalb über die ECHTE HTTP-Route und misst drei Dinge zusammen: die Route
// antwortet (204), der Befund ist systemisch geschlossen, und der Ausfall steht GENAU EINMAL im
// Fehlerkanal. Eine Autorschaft wird nie behauptet, die nicht gelesen wurde.
describe("JOB 3071 R2: ein schweigender Port hält die Löschroute nicht an", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Port antwortet nie → DELETE endet mit 204, Befund systemisch zu, genau eine Meldung", async () => {
    const { services, app, autorin } = await welt();
    const a = await koAnlegen(
      app,
      autorin,
      "Ventil V3 zuerst",
      "Bei Überdruck Ventil V3 schließen.",
    );
    const b = await koAnlegen(
      app,
      autorin,
      "Pumpe entlüften",
      "Die Pumpe alle 200 Stunden entlüften.",
    );
    const eintrag = await befund(services, a, b);
    expect(eintrag.status).toBe("offen");

    // Der Port dieser Komposition ist `KoService.eigeneRuecknahmeVon` (build-app.ts, Funktions-Port).
    // Hier antwortet er nie — die Lage einer hängenden Verbindung, nicht die eines Fehlers.
    services.ko.eigeneRuecknahmeVon = () => new Promise<string | null>(() => undefined);
    // Ohne verdrahteten `onError` meldet der Dienst über `console.error` (overlap-service.ts,
    // Vorgabe im Konstruktor) — das ist der Kanal, den die gebaute App wirklich benutzt.
    const konsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    // Der Befund steht nicht mehr offen über einem Beitrag im Papierkorb …
    const stored = await services.overlaps.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    // … und er trägt den SCHWÄCHEREN, ehrlichen Grund: gelesen wurde nichts.
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();
    expect(await belege(services, "overlap.participant-removed", eintrag.id)).toHaveLength(1);
    expect(await belege(services, "overlap.withdrawn-own", eintrag.id)).toHaveLength(0);

    // GENAU EINE Meldung über diesen einen Ausfall — nicht keine (still verschluckt) und nicht zwei.
    const meldungen = konsole.mock.calls.filter((args) => String(args[0]).includes("Rücknahme"));
    expect(meldungen).toHaveLength(1);
    expect(String(meldungen[0]?.[0])).toContain(a);
  }, 30_000);

  it("der Beitrag ist danach wirklich im Papierkorb — die Route hat ihre Arbeit zu Ende gebracht", async () => {
    const { services, app, autorin } = await welt();
    const a = await koAnlegen(
      app,
      autorin,
      "Ventil V3 zuerst",
      "Bei Überdruck Ventil V3 schließen.",
    );
    const b = await koAnlegen(
      app,
      autorin,
      "Pumpe entlüften",
      "Die Pumpe alle 200 Stunden entlüften.",
    );
    await befund(services, a, b);

    services.ko.eigeneRuecknahmeVon = () => new Promise<string | null>(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    expect(await services.ko.get(a)).toBeUndefined();
    expect((await services.ko.trashed()).map((k) => k.id)).toContain(a);
    // Die Gegenseite bleibt, wie sie war — der schweigende Port hat nichts an fremdem Wissen bewegt.
    expect((await services.ko.get(b))?.id).toBe(b);
  }, 30_000);
});
