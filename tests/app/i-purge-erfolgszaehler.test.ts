// ================================================================================================
// JOB 1052 D3 — DER PURGE ZÄHLT VERSUCHE, NICHT ERFOLGE. GENAU DAS SCHLIESST DIESER TEST.
// ================================================================================================
//
// DER BEFUND, den BEN4 im D2-Urteil als konkreten Vertragsfehler benannt hat:
//
//   > „Vorzähler, ausschließlich erfolgreiche Löschungen und Nachzähler müssen konsistent sein.
//   > **Der erkannte Versuchszähler darf nicht in den Resetvertrag übernommen werden.**"
//   > (Korrekturpflicht 2)
//
// und in Prüflücke 5:
//
//   > „Ein fehlgeschlagener Löschversuch darf die Erfolgsmenge nicht erhöhen."
//
// AM CODE NACHGEMESSEN, und der Fehler ist an drei Stellen derselbe: `purgeDemoSeed` ruft
// `resolve`/`dismiss`/`deleteGap` mit angehängtem `.catch(() => undefined)` und zählt DANACH
// hoch. Der Fehler wird also verschluckt — und der Zähler meldet ihn trotzdem als Erfolg. Ein
// Reset, der so berichtet, sagt „vier Konflikte entfernt", wo keiner entfernt wurde.
//
// DIE VIERTE STELLE IST DER GEGENBEWEIS, dass es kein Stilproblem ist: Der Nutzerzähler zählt
// INNERHALB des `try` nach dem `await` und ist damit ein echter Erfolgszähler. Dieselbe Datei, zwei
// verschiedene Bauformen — die Tests unten pinnen beide.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSCHIEDEN WIRD: welche Bestände ein Reset überhaupt löschen darf.
// Das ist Korrekturpflicht 1 und eine Ownerentscheidung (zwölf offene Postbedingungen). Dieser
// Test sagt nur: was gemeldet wird, muss stimmen.
import { describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { purgeDemoSeed, seedDemo } from "../../services/app/src/seed-demo";

type Dienste = ReturnType<typeof buildServices>;

async function bestueckt(): Promise<Dienste> {
  const services = buildServices();
  await services.ko.activateSearchProjectionV2();
  await seedDemo(services);
  return services;
}

/**
 * Legt EINE Methode eines Dienstes lahm — sie wirft, statt zu arbeiten.
 *
 * Bewusst ein Proxy auf den ECHTEN Dienst: nur der eine Weg bricht, alles andere bleibt das
 * Produkt. Eine Attrappe, die nichts kann, würde nicht den Fehlerweg des Purges messen, sondern
 * den der Attrappe.
 */
function mitDefekt<T extends object>(dienst: T, methode: keyof T & string): T {
  return new Proxy(dienst, {
    get(ziel, feld, empfaenger) {
      if (feld === methode) {
        return async () => {
          throw new Error(`${methode} ist ausgefallen`);
        };
      }
      return Reflect.get(ziel, feld, empfaenger);
    },
  }) as T;
}

describe("JOB 1052 D3 · der Purge meldet Erfolge, nicht Versuche", () => {
  // ============================================================================================
  // KALIBRIERUNG — UND EIN BEFUND, DEN SIE SOFORT SICHTBAR GEMACHT HAT.
  // ============================================================================================
  //
  // Erwartet war eine leere Fehlerliste. Gemessen wurde ein Eintrag im Bestand `users`, und er ist
  // KEIN Defekt, sondern gültiges Produktverhalten: Der Demo-Admin ist in diesem Aufbau der letzte
  // aktive Admin und wird vom Selbstsperrschutz gehalten (`auth`, Last-Admin-Regel). Der
  // Bestandstest `seed.test.ts` legt genau deshalb vorher einen echten Admin an.
  //
  // DAS IST DER PUNKT DER GANZEN ÄNDERUNG: Vor ihr verschwand dieser Fehlschlag spurlos — der
  // `catch`-Zweig war leer, und der Aufrufer erfuhr nie, dass ein Konto stehengeblieben ist. Jetzt
  // steht er in der Liste, mit Bestand, Kennung und Grund.
  it("KALIBRIERUNG · ohne Defekt sind Fund- und Erfolgszahl gleich; der einzige Fehler ist der Last-Admin-Schutz", async () => {
    const services = await bestueckt();
    const ergebnis = await purgeDemoSeed(services, "admin-test");

    expect(ergebnis.gefunden.kos).toBeGreaterThan(0);
    expect(ergebnis.kos).toBe(ergebnis.gefunden.kos);
    expect(ergebnis.conflicts).toBe(ergebnis.gefunden.conflicts);
    expect(ergebnis.duplicates).toBe(ergebnis.gefunden.duplicates);
    expect(ergebnis.gaps).toBe(ergebnis.gefunden.gaps);
    // Kein Fehler in den vier Beständen, die ohne Schutzregel arbeiten.
    expect(ergebnis.fehler.filter((f) => f.bestand !== "users")).toEqual([]);
    // Und der Nutzerbestand meldet den gehaltenen Admin ehrlich, statt ihn zu verschweigen.
    expect(ergebnis.users).toBeLessThan(ergebnis.gefunden.users);
    expect(ergebnis.fehler.some((f) => f.bestand === "users")).toBe(true);
  });

  it("GEGENFALL · scheitert das Aufloesen eines Konflikts, zaehlt er NICHT als entfernt", async () => {
    const services = await bestueckt();
    const vorher = (await services.conflicts.unresolved()).length;
    expect(vorher, "ohne offenen Konflikt prueft der Fall nichts").toBeGreaterThan(0);

    const ergebnis = await purgeDemoSeed(
      { ...services, conflicts: mitDefekt(services.conflicts, "resolve") },
      "admin-test",
    );

    expect(ergebnis.gefunden.conflicts).toBeGreaterThan(0);
    expect(ergebnis.conflicts, "ein verschluckter Fehler wurde als Erfolg gezaehlt").toBe(0);
    expect(ergebnis.fehler.some((f) => f.bestand === "conflicts")).toBe(true);
  });

  it("GEGENFALL · scheitert das Verwerfen eines Duplikats, zaehlt es NICHT als entfernt", async () => {
    const services = await bestueckt();
    const offen = (await services.overlaps.unresolved()).length;
    if (offen === 0) {
      // Ohne offene Ueberschneidung ist der Fall gegenstandslos — dann muss der Zaehler 0 sein
      // UND es darf kein Fehler gemeldet werden. Auch das ist eine Aussage, kein Skip.
      const leer = await purgeDemoSeed(
        { ...services, overlaps: mitDefekt(services.overlaps, "dismiss") },
        "admin-test",
      );
      expect(leer.duplicates).toBe(0);
      expect(leer.fehler.some((f) => f.bestand === "duplicates")).toBe(false);
      return;
    }
    const ergebnis = await purgeDemoSeed(
      { ...services, overlaps: mitDefekt(services.overlaps, "dismiss") },
      "admin-test",
    );
    expect(ergebnis.gefunden.duplicates).toBeGreaterThan(0);
    expect(ergebnis.duplicates).toBe(0);
    expect(ergebnis.fehler.some((f) => f.bestand === "duplicates")).toBe(true);
  });

  it("GEGENFALL · scheitert das Loeschen einer Wissensluecke, zaehlt sie NICHT als entfernt", async () => {
    const services = await bestueckt();
    const luecken = (await services.ask.listGaps()).filter((g) => g.demoSeed === true).length;
    expect(luecken, "ohne Demo-Luecke prueft der Fall nichts").toBeGreaterThan(0);

    const ergebnis = await purgeDemoSeed(
      { ...services, ask: mitDefekt(services.ask, "deleteGap") },
      "admin-test",
    );

    expect(ergebnis.gefunden.gaps).toBeGreaterThan(0);
    expect(ergebnis.gaps).toBe(0);
    expect(ergebnis.fehler.some((f) => f.bestand === "gaps")).toBe(true);
  });

  it("Die Fehlerliste nennt Bestand und Kennung — sie ist vollstaendig, nicht nur eine Zahl", async () => {
    const services = await bestueckt();
    const ergebnis = await purgeDemoSeed(
      { ...services, conflicts: mitDefekt(services.conflicts, "resolve") },
      "admin-test",
    );
    const eintrag = ergebnis.fehler.find((f) => f.bestand === "conflicts");
    expect(eintrag).toBeDefined();
    expect(typeof eintrag?.id).toBe("string");
    expect((eintrag?.id ?? "").length).toBeGreaterThan(0);
    expect((eintrag?.grund ?? "").length).toBeGreaterThan(0);
  });

  it("REGRESSIONSSCHUTZ · der Nutzerzaehler war schon ein Erfolgszaehler und bleibt es", async () => {
    const services = await bestueckt();
    const ergebnis = await purgeDemoSeed(
      { ...services, auth: mitDefekt(services.auth, "deleteUser") },
      "admin-test",
    );
    expect(ergebnis.users).toBe(0);
    expect(ergebnis.gefunden.users).toBeGreaterThan(0);
    expect(ergebnis.fehler.some((f) => f.bestand === "users")).toBe(true);
  });
});
