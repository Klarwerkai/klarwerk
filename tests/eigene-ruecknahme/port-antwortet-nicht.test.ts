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

  // Auftrag gesamt-dubletten-rueckzug (R-1547): der weiche Weg fragt den Port NICHT mehr. Der
  // Dienst kennt Löscher und Autor vor dem Schreiben und reicht die Rücknahme in seinen
  // Transaktionshaken (KoService.delete → `setRuecknahmeTxCleanup`). Ein schweigender Port kann den
  // Rückzug deshalb weder anhalten noch zum systemischen Abschluss verfälschen — gemessen hier: 204,
  // `withdrawn_own` mit der Kennung der Autorin, kein Ruf am Port, keine Meldung. Den Port und seine
  // Frist braucht weiterhin die Endlöschung eines Altbestands (vorablesung-bricht-…test.ts).
  it("Port antwortet nie → DELETE endet mit 204, der Rückzug trägt die Autorin, der Port bleibt ungefragt", async () => {
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

    let portRufe = 0;
    services.ko.eigeneRuecknahmeVon = () => {
      portRufe++;
      return new Promise<string | null>(() => undefined);
    };
    const konsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    const stored = await services.overlaps.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("withdrawn_own");
    expect(stored?.resolution?.by).toBe(autorin.id);
    expect(await belege(services, "overlap.withdrawn-own", eintrag.id)).toHaveLength(1);
    expect(await belege(services, "overlap.participant-removed", eintrag.id)).toHaveLength(0);

    expect(portRufe).toBe(0);
    const meldungen = konsole.mock.calls.filter((args) => String(args[0]).includes("Rücknahme"));
    expect(meldungen).toHaveLength(0);
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
