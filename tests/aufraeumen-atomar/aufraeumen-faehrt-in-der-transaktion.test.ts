import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { Conflict, ConflictRepo, OverlapEntry, OverlapRepo } from "../../services/conflicts";
import type { TxContext } from "../../services/db-tx";
import type { WithTx } from "../../services/knowledge-object";

// ================================================================================================
// JOB 3066 · F2 — DAS AUFRÄUMEN FÄHRT IN DER TRANSAKTION MIT, NICHT DAVOR.
// ================================================================================================
//
// Der Ausgangsfehler: `setPurgeCleanup` (build-app.ts) läuft VOR `withTx` und ist danach nicht mehr
// rücknehmbar (services/knowledge-object/src/service.ts:3131-3132). Scheitert die Löschung darunter,
// bleibt der Befund geschlossen, obwohl beide Beiträge noch stehen.
//
// Gemessen wird deshalb nicht „irgendwann geschlossen", sondern ZWEIERLEI, beides prüfbar ohne
// Datenbank: dass der schliessende Zugriff auf beide Befundspeicher den KONTEXT der laufenden
// Transaktion bekommt (identisches Objekt, nicht bloss „irgendein tx"), und dass kein Ruf davor
// liegt. Die Attrappen-`withTx` markiert dafür ihr eigenes Zeitfenster.
//
// R4 (bens Korrekturpflicht 1 zu R3): der Schliess-Schritt ist EINE mengenbasierte Anweisung
// (`closeOpenForKo`) — kein `all`, kein `update` je Treffer. Der Test misst das mit: im Fenster der
// Endlöschung darf GENAU EIN Zugriff je Speicher stehen, sonst hielte der Transaktionskörper
// wieder n Einzelanweisungen (PurgeTxCleanup-Vertrag, knowledge-object/src/service.ts:248-255).
describe("JOB 3066 · F2: Befund-Aufräumung läuft auf dem Kontext der Löschtransaktion", () => {
  interface Ruf {
    speicher: "ueberschneidungen" | "konflikte";
    methode: "all" | "update" | "closeOpenForKo";
    tx: TxContext | undefined;
    imKoerper: boolean;
  }

  function aufbau() {
    const repos = inMemoryRepos();
    const rufe: Ruf[] = [];
    // Der EINE erkennbare Kontext dieser Transaktion — die Prüfung vergleicht auf Objektidentität.
    const derKontext: TxContext = { brand: "TxContext" };
    let imKoerper = false;

    const echteKonflikte = repos.conflictsRepo;
    const echteUeberschneidungen = repos.overlapRepo;

    const konflikte: ConflictRepo = {
      insert: (c) => echteKonflikte.insert(c),
      insertIfVersionsCurrent: (c, isCurrent) =>
        echteKonflikte.insertIfVersionsCurrent(c, isCurrent),
      supersedeIfOpen: (id, patch) => echteKonflikte.supersedeIfOpen(id, patch),
      findById: (id) => echteKonflikte.findById(id),
      update: (c: Conflict) => {
        rufe.push({ speicher: "konflikte", methode: "update", tx: undefined, imKoerper });
        return echteKonflikte.update(c);
      },
      all: () => {
        rufe.push({ speicher: "konflikte", methode: "all", tx: undefined, imKoerper });
        return echteKonflikte.all();
      },
      closeOpenForKo: (koId: string, patch: Partial<Conflict>, tx?: TxContext) => {
        rufe.push({ speicher: "konflikte", methode: "closeOpenForKo", tx, imKoerper });
        return echteKonflikte.closeOpenForKo(koId, patch, tx);
      },
    };

    const ueberschneidungen: OverlapRepo = {
      insert: (e) => echteUeberschneidungen.insert(e),
      insertIfVersionsCurrent: (e, isCurrent) =>
        echteUeberschneidungen.insertIfVersionsCurrent(e, isCurrent),
      supersedeIfOpen: (id, patch) => echteUeberschneidungen.supersedeIfOpen(id, patch),
      findById: (id) => echteUeberschneidungen.findById(id),
      update: (e: OverlapEntry) => {
        rufe.push({ speicher: "ueberschneidungen", methode: "update", tx: undefined, imKoerper });
        return echteUeberschneidungen.update(e);
      },
      all: () => {
        rufe.push({ speicher: "ueberschneidungen", methode: "all", tx: undefined, imKoerper });
        return echteUeberschneidungen.all();
      },
      closeOpenForKo: (koId: string, patch: Partial<OverlapEntry>, tx?: TxContext) => {
        rufe.push({ speicher: "ueberschneidungen", methode: "closeOpenForKo", tx, imKoerper });
        return echteUeberschneidungen.closeOpenForKo(koId, patch, tx);
      },
    };

    // Attrappe der echten `withPgTx`-Klammer: sie liefert genau EINEN Kontext und markiert, wann
    // ihr Körper läuft. Mehr braucht dieser Test nicht — die echte Commit-/Rollback-Grenze misst F3.
    const withTx: WithTx = async (fn) => {
      imKoerper = true;
      try {
        return await fn(derKontext);
      } finally {
        imKoerper = false;
      }
    };

    const services = assembleServices(
      { ...repos, conflictsRepo: konflikte, overlapRepo: ueberschneidungen },
      { withTx },
    );
    // Die Verdrahtung der Aufräum-Haken lebt in buildApp — ohne diesen Schritt misst der Test nichts.
    buildApp(services);
    return { services, rufe, derKontext };
  }

  async function befundePaar(services: ReturnType<typeof aufbau>["services"]) {
    const a = await services.ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    const b = await services.ko.create({
      title: "KO B",
      statement: "Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
    });
    await services.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
    await services.conflicts.create(
      { koA: a.id, koB: b.id, type: "truth", description: "Widerspruch zur Frist" },
      "anna",
    );
    return { a, b };
  }

  it("das Schliessen beider Befundspeicher läuft auf genau dem Kontext der Löschtransaktion", async () => {
    const { services, rufe, derKontext } = aufbau();
    const { a } = await befundePaar(services);
    rufe.length = 0; // nur das Fenster der Endlöschung zählt

    await services.ko.delete(a.id, "admin", { hard: true });

    for (const speicher of ["ueberschneidungen", "konflikte"] as const) {
      const treffer = rufe.filter((r) => r.speicher === speicher);
      // EINE mengenbasierte Anweisung — kein `all()` (der Gesamtbestand der Instanz durch die
      // gehaltene Verbindung) und kein `update` je Treffer (n Anweisungen, n-mal die Sperre).
      expect(
        treffer.map((r) => r.methode),
        `${speicher}: falsche Zugriffsform`,
      ).toEqual(["closeOpenForKo"]);
      for (const r of treffer) {
        expect(r.tx, `${speicher}.${r.methode} ohne den Transaktionskontext`).toBe(derKontext);
      }
    }
  });

  it("kein Ruf auf die Befundspeicher liegt VOR dem Transaktionskörper", async () => {
    const { services, rufe } = aufbau();
    const { a } = await befundePaar(services);
    rufe.length = 0;

    await services.ko.delete(a.id, "admin", { hard: true });

    const davor = rufe.filter((r) => !r.imKoerper);
    expect(davor).toEqual([]);
  });

  // Lieferung 6 (Ablösung) — R2/R4, bens Korrekturpflicht 1: der Pin darf NICHT nur build-app.ts
  // lesen. Er durchsucht das GANZE Modul services/app/src und schreibt das vollständige Inventar
  // der Aufräum-Aufrufe fest. Es sind zwei Orte, und seit R4 sind sie einander AUSSCHLIESSEND:
  //   1. build-app.ts — im transaktionsgebundenen Haken. Der Weg der ENDLÖSCHUNG.
  //   2. routes/ko-routes.ts — der Nachlauf des WEICHEN Löschens in DELETE /api/kos/:id, seit R4
  //      hinter `if (!endgeloescht)`. Kippt `ko.delete` dort intern in eine Endlöschung
  //      (Demo-Seed-Objekte, service.ts:3919-3927), läuft er NICHT.
  // Ein DRITTER Ort, eine Verschiebung oder ein Wegfall der Bedingung macht diesen Test rot.
  it("struktureller Pin: services/app/src ruft onKoRemoved nur an den zwei bekannten Orten", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const wurzel = new URL("../../services/app/src/", import.meta.url);
    const dateien = (await readdir(wurzel, { recursive: true })).filter((d) => d.endsWith(".ts"));
    const fundorte: string[] = [];
    for (const datei of dateien) {
      const inhalt = await readFile(new URL(datei, wurzel), "utf8");
      for (const zeile of inhalt.split("\n")) {
        // Nur echte Aufrufe, keine Kommentarzeilen (die Begründung nennt den Namen mehrfach).
        if (zeile.includes(".onKoRemoved(") && !zeile.trimStart().startsWith("//")) {
          fundorte.push(datei);
        }
      }
    }
    expect(fundorte.filter((d) => d === "build-app.ts")).toHaveLength(2);
    expect(fundorte.filter((d) => d === "routes/ko-routes.ts")).toHaveLength(2);
    expect(fundorte).toHaveLength(4); // kein dritter Ort

    // Und die zwei Rufe der Route stehen im Bedingungszweig des WEICHEN Löschens — nicht daneben.
    const route = await readFile(
      new URL("../../services/app/src/routes/ko-routes.ts", import.meta.url),
      "utf8",
    );
    const routenzeilen = route.split("\n");
    const wache = routenzeilen.findIndex((z) => z.includes("if (!endgeloescht) {"));
    expect(wache, "Bedingung `if (!endgeloescht)` fehlt in ko-routes.ts").toBeGreaterThan(-1);
    const zweigEnde = routenzeilen.findIndex(
      (z, i) =>
        i > wache &&
        z.trimEnd().endsWith("}") &&
        z.search(/\S/) === routenzeilen[wache]?.search(/\S/),
    );
    expect(zweigEnde).toBeGreaterThan(wache);
    for (const nadel of ["conflicts.onKoRemoved(", "overlaps.onKoRemoved("]) {
      const nr = routenzeilen.findIndex((z, i) => i > wache && z.includes(nadel));
      expect(nr, `${nadel} steht nicht hinter der Bedingung`).toBeGreaterThan(wache);
      expect(nr, `${nadel} steht nicht mehr IM Bedingungszweig`).toBeLessThan(zweigEnde);
    }

    const quelle = await readFile(
      new URL("../../services/app/src/build-app.ts", import.meta.url),
      "utf8",
    );
    const zeilen = quelle.split("\n");
    const treffer = (nadel: string) =>
      zeilen.map((z, i) => ({ z, nr: i + 1 })).filter(({ z }) => z.includes(nadel));

    const konflikt = treffer("services.conflicts.onKoRemoved(");
    const ueberschneidung = treffer("services.overlaps.onKoRemoved(");
    expect(konflikt).toHaveLength(1);
    expect(ueberschneidung).toHaveLength(1);

    const txHaken = treffer("services.ko.setPurgeTxCleanup(");
    const altHaken = treffer("services.ko.setPurgeCleanup(");
    expect(txHaken).toHaveLength(1);
    expect(altHaken).toHaveLength(1);
    // Der tx-gebundene Haken steht zuerst, der best-effort-Haken danach; beide Aufräumrufe liegen
    // dazwischen — also IM tx-Haken. Ein zweiter Schliessweg hätte hier keinen Platz mehr.
    const txStart = txHaken[0]?.nr ?? 0;
    const altStart = altHaken[0]?.nr ?? 0;
    expect(txStart).toBeGreaterThan(0);
    expect(txStart).toBeLessThan(altStart);
    for (const ruf of [konflikt[0]?.nr ?? 0, ueberschneidung[0]?.nr ?? 0]) {
      expect(ruf).toBeGreaterThan(txStart);
      expect(ruf).toBeLessThan(altStart);
    }
  });
});
