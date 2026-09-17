// ================================================================================================
// JOB 4113 — DIE SCHREIBENDEN TÜREN AM DRAHT, JEDE MESSUNG AN IHRER EIGENEN BÜHNE.
// ================================================================================================
//
// `rollen-am-draht.test.ts` fährt die LESENDEN Türen: eine gemeinsame Bühne, 5 Akteure je Zeile,
// dünne Nutzlasten. Diese Datei fährt die SCHREIBENDEN — und das ist die gefährlichere Hälfte der
// Rechtefrage. Eine Lese-Tür, die zu weit offensteht, zeigt einem Gast etwas; eine Schreib-Tür, die
// zu weit offensteht, lässt ihn den BESTAND ändern.
//
// DREI UNTERSCHIEDE ZUR LESEABNAHME, und jeder hat einen Grund:
//
//   1. EINE EIGENE BÜHNE JE MESSUNG (`baueFrischeBuehne()`). Ein schreibender Vorgang hinterlässt
//      etwas. Liefen fünf Akteure gegen denselben Bestand, mässe der zweite, was der erste getan
//      hat — und die Reihenfolge der Akteure entschiede mit über das Ergebnis. F1 misst nach, dass
//      die Bühnen wirklich getrennt sind.
//   2. EIN ECHTER FACHVORGANG STATT EINER DÜNNEN NUTZLAST. Jede Zeile bringt ihr `ruesten` mit
//      (`schreibende-tueren.ts`), das den Vorgang auf der frischen Bühne herstellt, und ihr
//      `erfolg` — die Status, die ein GELUNGENER Vorgang an dieser Tür hat. Wer `erlaubt` erwartet,
//      muss einen davon bekommen; 400, 404, 409 und 503 fallen auf (S6 hält den Fall fest).
//   3. DIE SPERRE WIRD AM WIRKUNG-ENDE NACHGELESEN (S1), und zwar für JEDEN gesperrten Akteur. Ein
//      `403`, nach dem der Vorgang trotzdem stattgefunden hätte, wäre die gefährlichste
//      Grünfärbung dieser ganzen Abnahme.
//   4. KEIN AKTEUR DARF AUSGELASSEN WERDEN. Eine Lesezeile darf eine Tür mit Grund auslassen; eine
//      Schreibzeile nicht — sonst zählte die Abdeckung eine Tür, an der niemand geklopft hat (S5,
//      E10). Wer eine Schreib-Tür nicht mit allen fünf fahren kann, führt sie in NICHT_ABGENOMMEN.
import { afterEach, describe, expect, it } from "vitest";
import {
  AKTEURE,
  type Akteur,
  type Buehne,
  type FrischeBuehne,
  baueFrischeBuehne,
  kopfFuer,
  schliesseBuehnen,
} from "./buehne";
import { LAUF_KOPF, normalisierePfad } from "./registrierte-routen";
import {
  SCHREIB_TABELLE,
  type Schreibzeile,
  type Wirkung,
  ausgelasseneAkteure,
  sperrwirkungAbweichung,
  vollstaendigGemessen,
  wirkungsAbweichung,
} from "./schreibende-tueren";
import { type Erwartung, eintrag, erwarteterCode, gemessen } from "./tabelle";

afterEach(schliesseBuehnen);

// ================================================================================================
// JOB 4270 · LIEFERUNG 3 — DIE TÜREN, AN DENEN AUCH DER ERFOLGSFALL NACHGELESEN WIRD.
// ================================================================================================
//
// DIE LEHRE DES PRÜFERS ZU JOB 4141 R2 (`archiv/4141/runde-2/ben.md:44`): „Prüfe künftig auch
// erfolgreiche Schreibvorgänge durch Nachlesen des erwarteten Zielzustands; eine passende
// HTTP-Antwort allein belegt ihre Wirkung nicht."
//
// DIESE SECHS TÜREN SIND DER DEMOBESTAND SELBST — das Einzige, was ein Gast nach Pedis Zeile
// DEMO-ZUGANG-GAESTE überhaupt sehen soll. Für sie gilt seit JOB 4270 beides zugleich:
//   · JEDE MUSS EINEN BESTAND LESEN (`mitLesegriff`), auch für die gesperrten Akteure. Eine Zeile,
//     die nicht hinsieht, darf nicht dadurch grün werden, dass sie über die Sperre schweigt.
//   · JEDE MUSS EINEN ZIELZUSTAND FÜHREN (`nachlesepflicht`). Wer das `wirkung`-Feld einer dieser
//     Zeilen wieder entfernt, wird HIER rot und nicht erst beim nächsten Prüfer.
const WIRKUNG_NACHGELESEN = [
  "POST /api/admin/demo-seed",
  "DELETE /api/admin/demo-seed",
  "POST /api/admin/demo-packages/:id/load",
  "POST /api/admin/demo-packages/:id/reset",
  "DELETE /api/admin/demo-packages/:id",
  "POST /api/admin/examples/load",
];

let laufende = 0;

function naechsteMarke(art: string): string {
  laufende += 1;
  return `4113-${art}-${laufende}`;
}

/** Der Name, unter dem eine nicht getroffene Route in einer Fehlermeldung erscheint. */
const KEINE_ROUTE = "(keine Route — der 404-Fänger hat geantwortet)";

interface Messwert {
  status: number;
  ergebnis: ReturnType<typeof gemessen>;
  rumpf: string;
  getroffen: string;
  stimmt: boolean;
}

/**
 * Eine schreibende Messung: frische Bühne, Fachvorgang herstellen, EINMAL klopfen, Bühne schliessen.
 *
 * Die Bühne wird im `finally` geschlossen — auch wenn die Vorbereitung wirft. Eine offen gebliebene
 * Fastify-Instanz je Fehlschlag wäre bei 125 Messungen kein Schönheitsfehler, sondern ein Leck.
 */
async function messe(
  zeile: Schreibzeile,
  akteur: Akteur,
): Promise<
  Messwert & { bestandVorher: unknown; bestandNachher: unknown; wirkung: Wirkung | undefined }
> {
  const buehne: FrischeBuehne = await baueFrischeBuehne();
  try {
    const vorgang = await zeile.ruesten(buehne, akteur);
    const bestandVorher = vorgang.bestand ? await vorgang.bestand() : undefined;
    const marke = naechsteMarke("messung");
    const antwort = await buehne.app.inject({
      method: zeile.methode,
      url: vorgang.pfad,
      headers: { ...kopfFuer(buehne, akteur), [LAUF_KOPF]: marke },
      ...(vorgang.payload ? { payload: vorgang.payload } : {}),
    });
    const bestandNachher = vorgang.bestand ? await vorgang.bestand() : undefined;
    const getroffen = buehne.mitschrift.getroffen(marke);
    // BEIDE Seiten über dieselbe Form: `normalisierePfad` streicht die Parameter-NAMEN
    // (`/api/gaps/:id` → `/api/gaps/:`). Verglich man die Auskunft des Routers gegen das rohe
    // Muster der Zeile, wären zwei identische Pfade ungleich — und JEDE Messung meldete
    // `nicht-registriert`, obwohl der Router genau die richtige Tür gewählt hat (gemessen im ersten
    // Lauf dieser Datei: „wählte /api/gaps/:id, die Zeile führt aber /api/gaps/:id").
    const stimmt =
      getroffen !== undefined && normalisierePfad(getroffen) === normalisierePfad(zeile.route);
    return {
      status: antwort.statusCode,
      ergebnis: gemessen(antwort.statusCode, stimmt),
      rumpf: antwort.body,
      getroffen: getroffen ?? KEINE_ROUTE,
      stimmt,
      bestandVorher,
      bestandNachher,
      wirkung: vorgang.wirkung,
    };
  } finally {
    await buehne.schliesse();
  }
}

/** Was in der Anzeige am Ende steht — je Zeile die fünf gemessenen HTTP-Status. */
const anzeige: string[] = [];

describe("JOB 4113 · die schreibenden Türen am Draht", () => {
  // ----------------------------------------------------------------------------------------------
  // F1 — DER FRISCHE-NACHWEIS. Er ist die Voraussetzung für alles darunter.
  // ----------------------------------------------------------------------------------------------
  //
  // ZWEI frische Bühnen, DERSELBE schreibende Vorgang, DASSELBE Ergebnis. Wäre der Zustand geteilt,
  // wäre der zweite Durchlauf ein anderer: die Freigabe stünde schon, das Konto wäre schon da, das
  // Objekt schon angelegt. Gemessen wird deshalb nicht nur der Status, sondern der BESTAND vor und
  // nach dem Vorgang — der Status allein könnte auf zwei verschiedenen Beständen gleich aussehen.
  //
  // DIESER FALL WAR ZUERST ROT, und zwar gegen die GEMEINSAME Bühne (`baueBuehne()`): dort sieht der
  // zweite Durchlauf das Wissensobjekt des ersten und zählt `1 → 2` statt `0 → 1`. Genau das ist der
  // Zustand, den `tabelle.ts` mit „die Messungen dieser Tabelle sind deshalb bewusst zustandsfrei"
  // beschreibt.
  it("F1: zwei frische Bühnen, derselbe Schreibvorgang, derselbe Bestandsübergang", async () => {
    const durchlauf = async (buehne: Buehne) => {
      const kos = async () => {
        const liste = await buehne.app.inject({
          method: "GET",
          url: "/api/kos",
          headers: kopfFuer(buehne, "admin"),
        });
        return (liste.json() as unknown[]).length;
      };
      const vorher = await kos();
      const angelegt = await buehne.app.inject({
        method: "POST",
        url: "/api/kos",
        headers: kopfFuer(buehne, "experte"),
        payload: {
          title: "Frischeprobe",
          statement: "Zwei Bühnen, derselbe Anfang.",
          type: "best_practice",
          category: "Instandhaltung",
          confidentiality: "intern",
        },
      });
      return { status: angelegt.statusCode, vorher, nachher: await kos() };
    };

    const erste = await baueFrischeBuehne();
    const eins = await durchlauf(erste);
    await erste.schliesse();

    const zweite = await baueFrischeBuehne();
    const zwei = await durchlauf(zweite);
    await zweite.schliesse();

    expect(eins).toEqual({ status: 201, vorher: 0, nachher: 1 });
    expect(
      zwei,
      "Der zweite Durchlauf sieht den Bestand des ersten — dann sind die Bühnen nicht getrennt, und jede schreibende Messung hinge an der Reihenfolge ihrer Vorgängerin.",
    ).toEqual(eins);
  });

  // ----------------------------------------------------------------------------------------------
  // DIE ZEILEN. Ein Fall je Tür, fünf Messungen darin, jede an ihrer eigenen Bühne.
  // ----------------------------------------------------------------------------------------------
  for (const zeile of SCHREIB_TABELLE) {
    it(`${zeile.gruppe} · ${zeile.methode} ${zeile.route} (${zeile.tor})`, async () => {
      const tuer = `${zeile.methode} ${zeile.route}`;
      // JOB 4270: die sechs Demo-Türen schulden beides — einen Lesegriff für die Sperre UND einen
      // Zielzustand für den Erfolgsfall. Für alle übrigen Zeilen ändert sich nichts.
      const nachlesepflicht = WIRKUNG_NACHGELESEN.includes(tuer);
      const abweichungen: string[] = [];
      const gewaehlt = new Set<string>();
      const gemessenerStatus: string[] = [];
      // RUNDE 2 · KORREKTURPFLICHT 1: KEIN `continue` MEHR FÜR EINEN AUSGELASSENEN AKTEUR.
      //
      // Hier stand ein Übersprung für `nicht-geprueft`. Er ist aus den Lesezeilen übernommen, und
      // dort ist er richtig — eine Lesezeile darf eine Tür auslassen und den Grund danebenschreiben.
      // Für eine SCHREIBzeile war er der Fehler, den der Prüfer gemessen hat: `viewer:
      // nicht-geprueft` lief still durch, und die Abdeckung meldete die Tür weiter als „mit fünf
      // Akteuren gemessen". Jetzt wird die Zeile rot, bevor eine einzige Messung läuft, und nennt
      // den Akteur beim Namen.
      const ausgelassen = ausgelasseneAkteure(zeile);
      if (ausgelassen.length > 0) {
        abweichungen.push(
          `diese Schreibzeile lässt ${ausgelassen.join(", ")} aus. An einer Schreib-Tür gibt es kein begründetes Auslassen: wer sie nicht mit allen fünf Akteuren fahren kann, nimmt sie ganz aus der Tabelle und führt sie mit Grund in NICHT_ABGENOMMEN.`,
        );
      }
      for (const akteur of AKTEURE) {
        const e = eintrag(zeile.erwartet[akteur]);
        if (e.soll === "nicht-geprueft") {
          gemessenerStatus.push(`${akteur}: AUSGELASSEN`);
          continue;
        }
        const erwartet: Erwartung = e.ist ?? e.soll;
        const {
          status,
          ergebnis,
          rumpf,
          getroffen,
          stimmt,
          bestandVorher,
          bestandNachher,
          wirkung: zielzustand,
        } = await messe(zeile, akteur);
        gemessenerStatus.push(`${akteur}: ${status}`);
        if (!stimmt) {
          gewaehlt.add(getroffen);
        }
        if (ergebnis !== erwartet) {
          abweichungen.push(
            `${akteur}: erwartet ${erwartet}, gemessen ${ergebnis} (HTTP ${status}) — ${rumpf.slice(0, 200)}`,
          );
          continue;
        }
        // ==========================================================================================
        // RUNDE 2 · KORREKTURPFLICHT 1 — HIER WURDEN DIE BESTANDSWERTE BISHER WEGGEWORFEN.
        // ==========================================================================================
        //
        // An dieser Stelle stand `const { status, ergebnis, rumpf, getroffen, stimmt } = ...`: die
        // beiden Bestandswerte kamen aus `messe()` zurück und wurden nicht einmal entgegengenommen.
        // Der Lesegriff jeder Zeile lief also bei JEDER Messung — und sein Ergebnis entschied über
        // nichts. Der Prüfer hat genau das gemessen: Widerspruch durch `viewer` und `experte`
        // wirklich gelöst, danach 403, Lauf grün („Tests 198 passed (198)", 46/94).
        //
        // JETZT FÄLLT DAS URTEIL HIER, für JEDEN gesperrten Akteur JEDER Zeile, die einen Lesegriff
        // mitbringt — nicht nur für die zehn Türen der Namensliste in `S1`. Das ist der Unterschied,
        // auf den es ankommt: die fünf Urteils-Türen, an denen der Prüfer gemessen hat, standen
        // nicht in jener Liste, und keine künftige Zeile muss dort erst eingetragen werden, um ihre
        // Sperre am Wirkung-Ende geprüft zu bekommen.
        if (erwartet === "401" || erwartet === "403") {
          const wirkung = sperrwirkungAbweichung(
            tuer,
            akteur,
            status,
            bestandVorher,
            bestandNachher,
            nachlesepflicht,
          );
          if (wirkung) {
            abweichungen.push(wirkung);
            continue;
          }
        }
        // ==========================================================================================
        // DER FACHVORGANG MUSS GELINGEN — die Verschärfung dieses Auftrags, und sie gilt NUR hier.
        // ==========================================================================================
        //
        // Für die Lesezeilen ist ein 400 mit unvollständigem Rumpf dasselbe Ergebnis wie ein 200:
        // das Tor hat durchgelassen (`tabelle.ts:24-28`). Für eine SCHREIBENDE Zeile wäre das eine
        // Selbsttäuschung — sie behauptete, einen Fachvorgang gefahren zu haben, und hätte in
        // Wahrheit die Rumpfprüfung gemessen.
        //
        // RUNDE 2 · KORREKTURPFLICHT 2: HIER STAND `status === 400`, UND DAS WAR ZU WENIG. Der
        // Prüfer hat in `POST /api/kos/:id/restore` eine erfundene Zielkennung eingesetzt; der
        // Admin bekam 404, und die Zeile blieb grün — ein 404 ist kein 400. Verglichen wird seither
        // POSITIV gegen `zeile.erfolg`: der Berechtigte muss den Status bekommen, den ein
        // GELUNGENER Vorgang an dieser Tür hat. Alles andere — 400 (halber Rumpf), 404 (erfundene
        // Kennung), 409 (nicht wiederholbar), 503 (kein Adapter) — fällt jetzt auf.
        if (erwartet === "erlaubt" && !zeile.erfolg.includes(status)) {
          abweichungen.push(
            `${akteur}: kam durchs Tor, aber der Fachvorgang gelang nicht — HTTP ${status}, erwartet wäre ${zeile.erfolg.join(" oder ")}. Die Zeile misst damit nicht den Vorgang, sondern was davor abbricht: ${rumpf.slice(0, 300)}`,
          );
          continue;
        }
        // ==========================================================================================
        // JOB 4270 · LIEFERUNG 3 — UND JETZT DIE GEGENRICHTUNG: HAT DER ERFOLG ETWAS BEWIRKT?
        // ==========================================================================================
        //
        // Bis hierher endete die Prüfung des BERECHTIGTEN Akteurs beim Statuscode. Der Prüfer hat
        // das an JOB 4141 ausdrücklich als offene Lücke stehen lassen (`ben.md:30`): „Erfolgsfälle
        // werden weiterhin über HTTP-Erfolgsstatus bewertet … Zielrolle, Meinungstext und
        // Verknüpfungen zusätzlich nach erfolgreichem Aufruf nachlesen."
        //
        // DAS URTEIL FÄLLT EINE STELLE, NICHT SECHS — dieselbe Bauart wie `sperrwirkungAbweichung`
        // darüber: eine reine Funktion, die sich mit gestellten Werten gegenproben lässt (S10), und
        // die für die sechs Demo-Türen zusätzlich verlangt, dass überhaupt ein Zielzustand geführt
        // wird. Ein `200`, nach dem der Demobestand unverändert wäre, fällt genau hier auf.
        if (erwartet === "erlaubt") {
          const ausgeblieben = wirkungsAbweichung(
            tuer,
            akteur,
            status,
            bestandVorher,
            bestandNachher,
            zielzustand,
            nachlesepflicht,
          );
          if (ausgeblieben) {
            abweichungen.push(ausgeblieben);
            continue;
          }
        }
        const code = erwarteterCode(zeile, erwartet);
        if (code !== undefined) {
          let gelesen: unknown;
          try {
            gelesen = JSON.parse(rumpf);
          } catch {
            abweichungen.push(
              `${akteur}: Sperre ${erwartet} ohne lesbaren JSON-Rumpf — ${rumpf.slice(0, 200)}`,
            );
            continue;
          }
          const feld = (gelesen as { error?: unknown })?.error;
          if (feld !== code) {
            abweichungen.push(
              `${akteur}: Sperre ${erwartet} trägt error=${JSON.stringify(feld)}, erwartet "${code}" — die Antwort kommt nicht aus dem erwarteten Tor.`,
            );
          }
        }
      }
      for (const fremd of gewaehlt) {
        abweichungen.push(
          `der Router wählte für ${zeile.methode} dieser Zeile die Route ${fremd}, die Zeile führt aber ${zeile.route} — ${zeile.route} wird von dieser Zeile NICHT befragt`,
        );
      }
      anzeige.push(`  ${zeile.methode} ${zeile.route} → ${gemessenerStatus.join(" · ")}`);
      expect(
        abweichungen,
        `${zeile.methode} ${zeile.route} (${zeile.belegstelle}, Tor: ${zeile.tor})`,
      ).toEqual([]);
    });
  }

  // ----------------------------------------------------------------------------------------------
  // S1 · LIEFERUNG 4 — DIE SPERRE WIRD AM WIRKUNG-ENDE GEPRÜFT, NICHT NUR AM STATUS.
  // ----------------------------------------------------------------------------------------------
  //
  // Ein Statuscode ist eine BEHAUPTUNG des Servers über das, was er getan hat. Diese Abnahme prüft
  // sie nach: für jede genannte Tür wird der Bestand VOR und NACH dem abgewiesenen Schreibversuch
  // gelesen, und er muss gleich sein. Ein `403`, nach dem das Objekt trotzdem angelegt, gelöscht
  // oder verstellt worden wäre, ist schlimmer als ein ehrliches `200` — er sieht grün aus.
  //
  // DIESER FALL WAR ZUERST ROT, und zwar gegen eine Tür, die es in dieser Abnahme noch gar nicht
  // gab (`POST /api/kos` stand in `NICHT_ABGENOMMEN`): „keine Zeile für POST /api/kos".
  //
  // JOB 4141 · LIEFERUNG 3 — DIE FÜNF NEUEN NAMEN UNTEN SIND DIE TÜREN, AN DENEN EIN VERSCHWIEGENER
  // VORGANG AM TEUERSTEN WÄRE: zwei Löschwege für Konten, der Anlageweg, der Rollenwechsel und der
  // Bearbeitungsstand eines Dublettenpaares. An ihnen allen liest die Zeile den Bestand auf der
  // anderen Seite der Tür (Kontenzahl, Rolle am Zielkonto, Stand des Paares) — ein `403`, nach dem
  // das Konto trotzdem weg wäre oder die Rolle trotzdem stünde, fällt genau hier auf und nirgends
  // sonst.
  //
  // RUNDE 2 · KORREKTURPFLICHT 1 — DIE FÜNF NAMEN, DIE HIER GEFEHLT HABEN.
  //
  // Der Prüfer hat an `POST /api/conflicts/:id/dismiss` gemessen, und genau diese Tür stand nicht in
  // der Liste: die beiden Konflikt-Wege und die drei Dubletten-Abschlüsse fehlten, weil Runde 1 nur
  // die Türen aufgenommen hat, an denen ein Konto oder ein Bearbeitungsstand hängt. Ein Urteil über
  // den Bestand ist aber dasselbe in Gefährlichkeit: wer einen Widerspruch als „Fehlalarm" schliesst,
  // entfernt ihn aus der Prüfliste jedes anderen Menschen. Alle zehn JOB-4141-Türen stehen jetzt hier
  // — und `S8` unten hält fest, dass keine von ihnen wieder herausfallen kann.
  const WIRKUNG_GEPRUEFT = [
    "POST /api/kos",
    "DELETE /api/kos/:id",
    "PUT /api/upload-limits",
    "PUT /api/validation/settings",
    "POST /api/drafts",
    "DELETE /api/auth/users/:id",
    "POST /api/users",
    "PUT /api/users/:id",
    "DELETE /api/users/:id",
    "POST /api/conflicts/:id/dismiss",
    "POST /api/conflicts/:id/second-opinion",
    "POST /api/duplicates/:id/dismiss",
    "POST /api/duplicates/:id/keep-separate",
    "POST /api/duplicates/:id/link-related",
    "POST /api/duplicates/:id/status",
  ];
  for (const name of WIRKUNG_GEPRUEFT) {
    it(`S1: nach dem abgewiesenen Schreibversuch an ${name} ist der Bestand unverändert`, async () => {
      const zeile = SCHREIB_TABELLE.find((z) => `${z.methode} ${z.route}` === name);
      expect(zeile, `Zeile ${name} in SCHREIB_TABELLE`).toBeDefined();
      if (!zeile) {
        return;
      }
      // RUNDE 2 (Prüflücke 6 des Prüfers): JEDER gesperrte Akteur, nicht nur der erste.
      //
      // Hier stand `AKTEURE.find(...)`, und das traf immer `anonym` — den Akteur, den schon die
      // Anmeldeprüfung abweist, bevor irgendein Handler läuft. Der interessantere Fall ist der
      // ANGEMELDETE Gast: er kommt durch `requireUser` und wird erst am Rechtetor gestoppt. Genau
      // dort läge ein Schreibweg, der trotz 403 noch etwas täte. Seither wird jeder gesperrte
      // Akteur dieser Zeile gefahren und einzeln nachgelesen.
      const gesperrte = AKTEURE.filter((a) => {
        const soll = eintrag(zeile.erwartet[a]);
        const wert = soll.ist ?? soll.soll;
        return wert === "401" || wert === "403";
      });
      expect(gesperrte.length, `gesperrte Akteure für ${name}`).toBeGreaterThan(1);
      // RUNDE 2 · KORREKTURPFLICHT 1: DASSELBE URTEIL WIE IN DER ZEILENSCHLEIFE, aus derselben
      // Funktion. Vorher stand hier ein eigener `toEqual`-Vergleich — zwei Stellen, die dasselbe
      // entscheiden, und nur eine davon hat der Prüfer verstellt gefunden. Jetzt ist es eine; `S7`
      // probt sie gegen, und `mitLesegriff` verlangt für diese zehn Türen zusätzlich, dass überhaupt
      // ein Bestand gelesen wurde (eine Zeile ohne Lesegriff darf hier nicht still grün werden).
      const wirkungen: string[] = [];
      for (const gesperrt of gesperrte) {
        const { status, bestandVorher, bestandNachher } = await messe(zeile, gesperrt);
        expect([401, 403], `${name} als ${gesperrt}: HTTP ${status}`).toContain(status);
        const abweichung = sperrwirkungAbweichung(
          name,
          gesperrt,
          status,
          bestandVorher,
          bestandNachher,
          true,
        );
        if (abweichung) {
          wirkungen.push(abweichung);
        }
      }
      expect(wirkungen, `${name}: Wirkung der Sperre je gesperrtem Akteur`).toEqual([]);
    });
  }

  // ----------------------------------------------------------------------------------------------
  // S2 — DER MEHRFACHWEG `PUT /api/kos/:id` HAT JE AKTION EIN EIGENES TOR.
  // ----------------------------------------------------------------------------------------------
  //
  // Die Tabellenzeile zu dieser Tür misst GENAU die Aktion `revise`. Das ist eine ehrliche, aber
  // unvollständige Aussage — und ohne diesen Fall bliebe sie unbelegt. Hier stehen die vier
  // Aktionen mit UNTERSCHIEDLICHEN Toren nebeneinander, jede an ihrer eigenen frischen Bühne, mit
  // dem Akteur, der nach dem Rollenmodell die SCHWÄCHSTE noch berechtigte Rolle ist: wer eine
  // Aktion an das falsche Tor hängt, wird genau hier rot und nicht in einer Abdeckungszahl.
  it("S2: die Aktionen von PUT /api/kos/:id hängen an vier verschiedenen Toren", async () => {
    // RUNDE 2 (Prüflücke 6 des Prüfers): jede Aktion nennt ihren ERFOLGSSTATUS. Bis hierher genügte
    // dem Berechtigten „nicht 403" — ein 400 oder 404 wäre als bestandener Torgang durchgegangen,
    // derselbe Fehler wie in der Tabelle darüber, nur eine Ebene tiefer.
    const faelle = [
      { aktion: "revise", recht: "ko.create", darf: "experte", dorfNicht: "viewer", erfolg: 200 },
      {
        aktion: "rate",
        recht: "ko.validate",
        darf: "controller",
        dorfNicht: "experte",
        erfolg: 200,
      },
      {
        aktion: "assign",
        recht: "ko.assign",
        darf: "controller",
        dorfNicht: "experte",
        erfolg: 204,
      },
      {
        aktion: "admin-validate",
        recht: "users.manage",
        darf: "admin",
        dorfNicht: "controller",
        erfolg: 200,
      },
    ] as const;
    const abweichungen: string[] = [];
    for (const fall of faelle) {
      for (const [akteur, erwartet] of [
        [fall.darf, "durch"],
        [fall.dorfNicht, "gesperrt"],
      ] as const) {
        const buehne = await baueFrischeBuehne();
        try {
          const angelegt = await buehne.app.inject({
            method: "POST",
            url: "/api/kos",
            headers: kopfFuer(buehne, "admin"),
            payload: {
              title: "Torprobe",
              statement: "Je Aktion ein eigenes Tor.",
              type: "best_practice",
              category: "Instandhaltung",
              confidentiality: "intern",
            },
          });
          const id = (angelegt.json() as { id: string }).id;
          const rumpf: Record<string, unknown> = { action: fall.aktion };
          if (fall.aktion === "revise") {
            rumpf.changes = { statement: "Andere Fassung." };
          }
          if (fall.aktion === "rate") {
            rumpf.verdict = "correct";
          }
          if (fall.aktion === "assign") {
            rumpf.userIds = [buehne.konto.experte.id];
          }
          const antwort = await buehne.app.inject({
            method: "PUT",
            url: `/api/kos/${id}`,
            headers: kopfFuer(buehne, akteur),
            payload: rumpf,
          });
          const gesperrt = antwort.statusCode === 403;
          if (erwartet === "gesperrt" && !gesperrt) {
            abweichungen.push(
              `Aktion "${fall.aktion}" (${fall.recht}): ${akteur} kam durch — HTTP ${antwort.statusCode} ${antwort.body.slice(0, 200)}`,
            );
          }
          if (erwartet === "durch" && antwort.statusCode !== fall.erfolg) {
            abweichungen.push(
              `Aktion "${fall.aktion}" (${fall.recht}): ${akteur} trägt das Recht, aber der Vorgang gelang nicht — HTTP ${antwort.statusCode}, erwartet ${fall.erfolg}: ${antwort.body.slice(0, 200)}`,
            );
          }
        } finally {
          await buehne.schliesse();
        }
      }
    }
    expect(
      abweichungen,
      "Die Aktionen dieses Mehrfachwegs hängen je an einem eigenen Tor. Weicht eine davon ab, misst die Tabellenzeile (Aktion `revise`) etwas anderes, als sie über die Tür behauptet.",
    ).toEqual([]);
  });

  // ----------------------------------------------------------------------------------------------
  // S3 — DIE ABMELDUNG WIRKT WIRKLICH (die Gegenrichtung von S1).
  // ----------------------------------------------------------------------------------------------
  //
  // S1 belegt, dass eine SPERRE nichts verändert. Dieser Fall belegt das Gegenstück: dass ein
  // ERLAUBTER Schreibvorgang wirklich stattfindet. `POST /api/auth/logout` antwortet allen fünf
  // Akteuren 204 — ohne diesen Nachweis wäre die 204 des Angemeldeten von einer wirkungslosen
  // Höflichkeitsantwort nicht zu unterscheiden.
  it("S3: nach POST /api/auth/logout ist derselbe Token nicht mehr gültig", async () => {
    const buehne = await baueFrischeBuehne();
    try {
      const vorher = await buehne.app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: kopfFuer(buehne, "viewer"),
      });
      expect(vorher.statusCode, "vor der Abmeldung").toBe(200);
      const abgemeldet = await buehne.app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: kopfFuer(buehne, "viewer"),
      });
      expect(abgemeldet.statusCode).toBe(204);
      const nachher = await buehne.app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: kopfFuer(buehne, "viewer"),
      });
      expect(
        nachher.statusCode,
        "Nach der Abmeldung muss derselbe Token abgewiesen werden — sonst ist die 204 eine Behauptung ohne Wirkung.",
      ).toBe(401);
    } finally {
      await buehne.schliesse();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // S5 · RUNDE 2, KORREKTURPFLICHT 1 — DIE GEGENPROBE „AUSGELASSENER GAST", DAUERHAFT.
  // ----------------------------------------------------------------------------------------------
  //
  // Der Prüfer hat in einer Schreibzeile `viewer: nicht-geprueft` gesetzt und gemessen, dass alles
  // grün blieb: 52 Fälle bestanden, die Abdeckung meldete unverändert „36 von 94". Diese Gegenprobe
  // bleibt jetzt stehen — und zwar ohne 125 Bühnen zu bauen, weil das Urteil eine reine Funktion ist
  // (`vollstaendigGemessen`). Wer den Übersprung eines Tages wieder einbaut, wird HIER rot.
  //
  // ZWEI RICHTUNGEN, wie überall in dieser Abnahme: die echten Zeilen müssen bestehen (sonst wäre
  // die Funktion trivial streng), und die erfundene Zeile mit dem ausgelassenen Gast muss fallen
  // (sonst wäre sie trivial nachsichtig).
  it("S5: eine Schreibzeile, die einen Akteur auslässt, gilt nicht als gemessen", () => {
    for (const zeile of SCHREIB_TABELLE) {
      expect(
        ausgelasseneAkteure(zeile),
        `${zeile.methode} ${zeile.route} lässt Akteure aus — an einer Schreib-Tür gibt es kein begründetes Auslassen.`,
      ).toEqual([]);
      expect(vollstaendigGemessen(zeile)).toBe(true);
    }

    // Die Gegenprobe des Prüfers, wörtlich nachgestellt: dieselbe Zeile, nur der Gast ausgelassen.
    const echte = SCHREIB_TABELLE[0];
    expect(echte, "mindestens eine Schreibzeile").toBeDefined();
    if (!echte) {
      return;
    }
    const mitAusgelassenemGast = {
      erwartet: {
        ...echte.erwartet,
        viewer: { soll: "nicht-geprueft", grund: "Gegenprobe des Prüfers, Runde 1" },
      },
    } as const;
    expect(
      ausgelasseneAkteure(mitAusgelassenemGast),
      "Ein ausgelassener Gast muss namentlich auffallen — er ist der Akteur, um den Pedis Satz geht.",
    ).toEqual(["viewer"]);
    expect(
      vollstaendigGemessen(mitAusgelassenemGast),
      "Eine Zeile mit ausgelassenem Akteur darf NICHT als gemessen gelten — sonst zählt die Abdeckung eine Tür, an der niemand geklopft hat.",
    ).toBe(false);
  });

  // ----------------------------------------------------------------------------------------------
  // S6 · RUNDE 2, KORREKTURPFLICHT 2 — DIE GEGENPROBE „ERFUNDENE ZIELKENNUNG", DAUERHAFT.
  // ----------------------------------------------------------------------------------------------
  //
  // Der Prüfer hat in `POST /api/kos/:id/restore` die Kennung durch `ben-nicht-vorhanden` ersetzt.
  // Der Admin bekam 404 — und Runde 1 verbuchte das als `erlaubt`, weil sie beim Berechtigten nur
  // den Status 400 verschärft hat. Die Zeile hätte damit die Existenzprüfung gemessen und einen
  // Fachvorgang behauptet.
  //
  // HIER STEHEN BEIDE SEITEN NEBENEINANDER, an derselben frischen Bühne und mit demselben Akteur:
  // der ECHTE Vorgang (angelegt, gelöscht, zurückgeholt) und der erfundene. Beide laufen durchs
  // Tor; nur einer ist ein Vorgang. Dass die Abnahme den Unterschied sieht, ist der Punkt — der
  // Vergleich gegen `zeile.erfolg` ist dieselbe Regel, die auch die Tabellenzeile oben anwendet.
  it("S6: eine erfundene Zielkennung ist kein Fachvorgang — auch nicht für den Admin", async () => {
    const zeile = SCHREIB_TABELLE.find(
      (z) => `${z.methode} ${z.route}` === "POST /api/kos/:id/restore",
    );
    expect(zeile, "Zeile POST /api/kos/:id/restore in SCHREIB_TABELLE").toBeDefined();
    if (!zeile) {
      return;
    }
    const buehne = await baueFrischeBuehne();
    try {
      const vorgang = await zeile.ruesten(buehne, "admin");
      const erfunden = await buehne.app.inject({
        method: "POST",
        url: "/api/kos/ben-nicht-vorhanden/restore",
        headers: kopfFuer(buehne, "admin"),
      });
      expect(
        erfunden.statusCode,
        `Die erfundene Kennung muss am Handler scheitern — sonst misst diese Gegenprobe nichts: ${erfunden.body.slice(0, 200)}`,
      ).toBe(404);
      expect(
        zeile.erfolg.includes(erfunden.statusCode),
        `HTTP ${erfunden.statusCode} auf eine erfundene Kennung gilt als Erfolg dieser Zeile — genau die Lücke aus Runde 1: der Berechtigte kam durchs Tor, ein Vorgang fand aber nie statt.`,
      ).toBe(false);

      // Und die Gegenrichtung: derselbe Akteur, dieselbe Tür, ein ECHTES Ziel → der Vorgang gelingt
      // und sein Status steht in `erfolg`. Ohne diese Hälfte wäre die Strenge oben nur Strenge.
      const echt = await buehne.app.inject({
        method: "POST",
        url: vorgang.pfad,
        headers: kopfFuer(buehne, "admin"),
      });
      expect(echt.statusCode, `Der echte Vorgang muss gelingen: ${echt.body.slice(0, 200)}`).toBe(
        200,
      );
      expect(zeile.erfolg.includes(echt.statusCode)).toBe(true);
    } finally {
      await buehne.schliesse();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // S7 · RUNDE 2, KORREKTURPFLICHT 2 — DIE GEGENPROBE DES PRÜFERS, DAUERHAFT UND OHNE PRODUKTDIFF.
  // ----------------------------------------------------------------------------------------------
  //
  // WAS DER PRÜFER GETAN HAT: er hat im Produkt, vor dem Rechtetor von
  // `POST /api/conflicts/:id/dismiss`, den echten Dienst auch für `viewer` und `experte` laufen
  // lassen. Beide lösten den Widerspruch wirklich und bekamen danach 403 — die Abnahme blieb grün.
  //
  // WAS HIER STEHT: dieselbe LAGE, hergestellt ohne einen einzigen Produktdiff. Die Attrappe unten
  // ist die echte Zeile mit einem einzigen Unterschied — ihr Lesegriff lässt zwischen dem Lesen VOR
  // und dem Lesen NACH dem Klopfen den Fachvorgang am Dienst wirklich stattfinden. Für die Messung
  // ist das ununterscheidbar von einem Rechteloch im Produkt: der Gast klopft, bekommt 403, und der
  // Widerspruch ist trotzdem gelöst.
  //
  // WARUM DAS DIE ABSICHERUNG IST, die der Prüfer verlangt hat: die Attrappe läuft durch `messe()`
  // und durch `sperrwirkungAbweichung()` — durch genau den Weg, den auch die Zeilenschleife und `S1`
  // gehen. Nimmt jemand den Bestandsvergleich wieder heraus, liefert die Funktion `undefined`, und
  // dieser Fall wird rot. Die zweite Hälfte (die ECHTE Zeile, derselbe Akteur, keine Abweichung)
  // steht daneben, damit die Strenge nicht bloss Strenge ist: ein Vergleich, der immer meckert,
  // wäre ebenso wertlos wie einer, der nie meckert.
  it("S7: ein Vorgang, der trotz HTTP 403 stattfindet, macht die Abnahme namentlich rot", async () => {
    const name = "POST /api/conflicts/:id/dismiss";
    const echte = SCHREIB_TABELLE.find((z) => `${z.methode} ${z.route}` === name);
    expect(echte, `Zeile ${name} in SCHREIB_TABELLE`).toBeDefined();
    if (!echte) {
      return;
    }

    // (a) DIE ECHTE ZEILE: der Gast wird abgewiesen, und der Widerspruch bleibt, wie er war.
    const sauber = await messe(echte, "viewer");
    expect(sauber.status, `${name} als viewer: ${sauber.rumpf.slice(0, 200)}`).toBe(403);
    expect(
      sperrwirkungAbweichung(
        name,
        "viewer",
        sauber.status,
        sauber.bestandVorher,
        sauber.bestandNachher,
        true,
      ),
      `Am unveränderten Produkt darf diese Tür keine Abweichung melden — sonst prüft der Vergleich nicht, sondern lärmt. Gelesen: ${JSON.stringify(sauber.bestandVorher)} → ${JSON.stringify(sauber.bestandNachher)}`,
    ).toBeUndefined();

    // (b) DIESELBE TÜR, DERSELBE AKTEUR, ABER DER VORGANG FINDET STATT — die Lage des Prüfers.
    const attrappe: Schreibzeile = {
      ...echte,
      ruesten: async (buehne, akteur) => {
        const vorgang = await echte.ruesten(buehne, akteur);
        let gelesen = 0;
        return {
          ...vorgang,
          bestand: async () => {
            gelesen += 1;
            // Beim ZWEITEN Lesen — also nach dem abgewiesenen Klopfen — hat der Widerspruch sein
            // Urteil bekommen. Auf der frischen Bühne gibt es genau einen offener Widerspruch, der
            // aus `ruesten` dieser Zeile stammt.
            if (gelesen === 2) {
              const offen = await buehne.services.conflicts.unresolved();
              const widerspruch = offen[0];
              if (!widerspruch) {
                throw new Error(
                  "Die Gegenprobe kann ihre Lage nicht herstellen: auf der frischen Bühne steht kein offener Widerspruch, den ein unerlaubter Vorgang lösen könnte.",
                );
              }
              await buehne.services.conflicts.dismiss(widerspruch.id, "gegenprobe-s7");
            }
            return vorgang.bestand?.();
          },
        };
      },
    };

    const verseucht = await messe(attrappe, "viewer");
    expect(
      verseucht.status,
      "Die Gegenprobe ändert das Rechtetor NICHT — der Gast muss weiterhin abgewiesen werden, sonst mässe sie das Tor statt der Wirkung.",
    ).toBe(403);
    const abweichung = sperrwirkungAbweichung(
      name,
      "viewer",
      verseucht.status,
      verseucht.bestandVorher,
      verseucht.bestandNachher,
      true,
    );
    expect(
      abweichung,
      `Der Widerspruch wurde trotz HTTP ${verseucht.status} gelöst (${JSON.stringify(verseucht.bestandVorher)} → ${JSON.stringify(verseucht.bestandNachher)}), und die Abnahme hat es nicht gemerkt — das ist der Befund des Prüfers aus Runde 1, unrepariert.`,
    ).toBeDefined();
    expect(
      abweichung,
      "Die Meldung muss den Akteur beim Namen nennen — eine anonyme Abweichung schickt niemanden an die richtige Tür.",
    ).toContain("viewer");
    expect(abweichung).toContain(name);
  });

  // ----------------------------------------------------------------------------------------------
  // S8 — KEINE DER ZEHN URTEILS- UND KONTEN-TÜREN DARF AUS DER WIRKUNGSPRÜFUNG HERAUSFALLEN.
  // ----------------------------------------------------------------------------------------------
  //
  // Der Befund des Prüfers hatte zwei Hälften: der Vergleich fehlte (S7 hält sie), und die Tür stand
  // nicht in `WIRKUNG_GEPRUEFT` (diese hier). Ein stilles Streichen eines Namens aus jener Liste
  // nähme `S1` genau den Fall weg, um den es geht — und niemandem fiele es auf, weil ein Test, den
  // es nicht mehr gibt, auch nicht rot wird.
  it("S8: alle zehn JOB-4141-Türen stehen in der Wirkungsprüfung und lesen einen Bestand", () => {
    const zehn = [
      "DELETE /api/auth/users/:id",
      "POST /api/users",
      "PUT /api/users/:id",
      "DELETE /api/users/:id",
      "POST /api/conflicts/:id/dismiss",
      "POST /api/conflicts/:id/second-opinion",
      "POST /api/duplicates/:id/dismiss",
      "POST /api/duplicates/:id/keep-separate",
      "POST /api/duplicates/:id/link-related",
      "POST /api/duplicates/:id/status",
    ];
    const fehlen = zehn.filter((name) => !WIRKUNG_GEPRUEFT.includes(name));
    expect(
      fehlen,
      "Diese Türen ändern Konten oder Urteile über den Bestand. Fällt eine aus der Wirkungsprüfung, misst die Abnahme an ihr wieder nur den Statuscode — genau die Lage, in der der Prüfer den gelösten Widerspruch trotz 403 fand.",
    ).toEqual([]);
    for (const name of zehn) {
      expect(
        SCHREIB_TABELLE.some((z) => `${z.methode} ${z.route}` === name),
        `${name} steht in SCHREIB_TABELLE`,
      ).toBe(true);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // S9 · JOB 4270 — KEINE DER SECHS DEMO-TÜREN DARF AUS DER NACHLESUNG HERAUSFALLEN.
  // ----------------------------------------------------------------------------------------------
  //
  // Dasselbe Muster wie `S8`, und aus demselben Grund: ein stilles Streichen eines Namens aus
  // `WIRKUNG_NACHGELESEN` nähme der Zeilenschleife genau die Pflicht weg, um die es geht — die
  // betroffene Tür würde wieder allein am Statuscode gemessen, und niemandem fiele es auf.
  it("S9: alle sechs Demo-Türen stehen in der Nachlesung und in der Schreibtabelle", () => {
    const sechs = [
      "POST /api/admin/demo-seed",
      "DELETE /api/admin/demo-seed",
      "POST /api/admin/demo-packages/:id/load",
      "POST /api/admin/demo-packages/:id/reset",
      "DELETE /api/admin/demo-packages/:id",
      "POST /api/admin/examples/load",
    ];
    expect(
      sechs.filter((name) => !WIRKUNG_NACHGELESEN.includes(name)),
      "Diese Türen laden, setzen zurück und löschen den Demobestand — das Einzige, was ein Gast nach Pedis Zeile DEMO-ZUGANG-GAESTE sehen soll. Fällt eine aus der Nachlesung, gilt an ihr wieder ein 200 als Beleg für einen Vorgang, der nie stattgefunden haben muss.",
    ).toEqual([]);
    for (const name of sechs) {
      expect(
        SCHREIB_TABELLE.some((z) => `${z.methode} ${z.route}` === name),
        `${name} steht in SCHREIB_TABELLE`,
      ).toBe(true);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // S10 · JOB 4270 — DIE GEGENPROBE „ERFOLG OHNE WIRKUNG", AN ECHTEN MESSWERTEN.
  // ----------------------------------------------------------------------------------------------
  //
  // S7 hält die eine Richtung fest (ein Vorgang, der trotz 403 stattfindet). Dies ist die andere:
  // eine Antwort, die Erfolg meldet, ohne dass etwas geschehen ist. Sie wäre die bequemere
  // Grünfärbung — niemand sucht hinter einem 200 nach einem Fehler.
  //
  // GEMESSEN WIRD AN ECHTEN WERTEN, nicht an gestellten: EINE frische Bühne, der echte Ladevorgang
  // des Admins, und die drei Fälle danebengehalten. Die drei Attrappen unterscheiden sich von der
  // Wahrheit in genau einer Angabe — was daran rot wird, wird auch an einem echten Rechteloch rot.
  it("S10: ein Erfolgsstatus ohne Wirkung am Bestand macht die Abnahme namentlich rot", async () => {
    const name = "POST /api/admin/demo-seed";
    const zeile = SCHREIB_TABELLE.find((z) => `${z.methode} ${z.route}` === name);
    expect(zeile, `Zeile ${name} in SCHREIB_TABELLE`).toBeDefined();
    if (!zeile) {
      return;
    }
    const echt = await messe(zeile, "admin");
    expect(echt.status, `${name} als admin: ${echt.rumpf.slice(0, 200)}`).toBe(200);

    // (a) DIE WAHRHEIT: der Demobestand ist danach wirklich da, also keine Abweichung.
    expect(
      wirkungsAbweichung(
        name,
        "admin",
        echt.status,
        echt.bestandVorher,
        echt.bestandNachher,
        echt.wirkung,
        true,
      ),
      `Am unveränderten Produkt darf diese Tür keine Abweichung melden — sonst prüft die Nachlesung nicht, sondern lärmt. Gelesen: ${JSON.stringify(echt.bestandVorher)} → ${JSON.stringify(echt.bestandNachher)}`,
    ).toBeUndefined();

    // (b) DIE LAGE DES PRÜFERS: derselbe 200, aber der Bestand ist derselbe geblieben.
    const ohneWirkung = wirkungsAbweichung(
      name,
      "admin",
      echt.status,
      echt.bestandVorher,
      echt.bestandVorher,
      echt.wirkung,
      true,
    );
    expect(
      ohneWirkung,
      "Ein 200, nach dem der Demobestand unverändert wäre, muss auffallen — das ist die Lücke, die der Prüfer an JOB 4141 offen gelassen hat.",
    ).toBeDefined();
    expect(ohneWirkung).toContain(name);
    expect(ohneWirkung).toContain("admin");

    // (c) DIE NACHLESUNG WIRD AUSGEBAUT: `wirkung` fehlt, die Zeile misst wieder nur den Status.
    const ohneNachlesung = wirkungsAbweichung(
      name,
      "admin",
      echt.status,
      echt.bestandVorher,
      echt.bestandNachher,
      undefined,
      true,
    );
    expect(
      ohneNachlesung,
      "Wer den Zielzustand einer der sechs Demo-Türen entfernt, muss hier rot werden — sonst verschwindet Lieferung 3 wieder still.",
    ).toBeDefined();
    expect(ohneNachlesung).toContain(name);

    // (d) EINE ZUSICHERUNG, DIE SCHON VORHER GALT, ist keine Zusicherung. Sie ist die bequemste Art,
    //     die Nachlesung zu erfüllen, ohne etwas zu prüfen — und sie fällt vor allem anderen auf.
    const immerWahr = wirkungsAbweichung(
      name,
      "admin",
      echt.status,
      echt.bestandVorher,
      echt.bestandNachher,
      { beschreibung: "gilt immer", eingetreten: () => true },
      true,
    );
    expect(
      immerWahr,
      "Ein Zielzustand, der schon vor dem Aufruf zutraf, könnte einen gelungenen Vorgang nicht von einem ausgebliebenen unterscheiden.",
    ).toBeDefined();
  });

  // ----------------------------------------------------------------------------------------------
  // S11 · RUNDE 2, KORREKTURPFLICHT 1 — ZURÜCKSETZEN IST NICHT LÖSCHEN.
  // ----------------------------------------------------------------------------------------------
  //
  // WAS DER PRÜFER GEMESSEN HAT (Runde 1, Gegenprobe): er hat im Produkt den Reset-Dienst durch den
  // echten Paket-LÖSCHdienst ersetzt — Route und Rechtetor unverändert. Sechs Bausteine waren danach
  // fort („removed":6), und die Zeile blieb GRÜN. Der Grund stand in der Zusicherung selbst: sie
  // prüfte nur `bearbeitet === 0`, und nach dem Löschen ist auch nichts mehr bearbeitet. Eine
  // Nachlesung, die den Verlust des Gegenstands als Erfolg verbucht, ist keine.
  //
  // WAS HIER STEHT: dieselbe Lage, ohne einen einzigen Produktdiff. Statt des Zurücksetzens fährt
  // derselbe Admin an derselben frischen Bühne die ECHTE Löschtür des Pakets
  // (`DELETE /api/admin/demo-packages/:id`) — für die Nachlesung ist das ununterscheidbar von einem
  // Reset, der löscht statt herzustellen: Erfolgsstatus 200, Bestand verändert, Bausteine weg.
  //
  // WARUM ES DIE DAUERHAFTE ABSICHERUNG IST: das Urteil fällt `wirkungsAbweichung()` mit dem
  // Zielzustand der ECHTEN Reset-Zeile (`vorgang.wirkung` aus ihrem eigenen `ruesten`). Wer diesen
  // Zielzustand eines Tages wieder auf eine blosse Zählerzusage zurücknimmt, wird hier rot und nicht
  // erst beim nächsten Prüfer. Die erste Hälfte (der ECHTE Reset, keine Abweichung) steht daneben,
  // damit die Strenge nicht bloss Strenge ist.
  it("S11: ein Reset, der die Bausteine löscht statt sie herzustellen, macht die Abnahme namentlich rot", async () => {
    const name = "POST /api/admin/demo-packages/:id/reset";
    const zeile = SCHREIB_TABELLE.find((z) => `${z.methode} ${z.route}` === name);
    expect(zeile, `Zeile ${name} in SCHREIB_TABELLE`).toBeDefined();
    if (!zeile) {
      return;
    }

    // (a) DIE WAHRHEIT: der echte Reset des Admins stellt den verstellten Baustein wieder her.
    const echt = await messe(zeile, "admin");
    expect(echt.status, `${name} als admin: ${echt.rumpf.slice(0, 200)}`).toBe(200);
    expect(
      wirkungsAbweichung(
        name,
        "admin",
        echt.status,
        echt.bestandVorher,
        echt.bestandNachher,
        echt.wirkung,
        true,
      ),
      `Am unveränderten Produkt darf der echte Reset keine Abweichung melden — sonst prüft die Nachlesung nicht, sondern lärmt. Gelesen: ${JSON.stringify(echt.bestandVorher)} → ${JSON.stringify(echt.bestandNachher)}`,
    ).toBeUndefined();

    // (b) DIE LAGE DES PRÜFERS: derselbe Vorbereitungsvorgang, derselbe Akteur, derselbe
    //     Zielzustand — aber gefahren wird die Löschtür. Sechs Bausteine sind danach fort.
    const alsLoeschung: Schreibzeile = {
      ...zeile,
      methode: "DELETE",
      route: "/api/admin/demo-packages/:id",
      ruesten: async (buehne, akteur) => {
        const vorgang = await zeile.ruesten(buehne, akteur);
        // Nur der Pfad wechselt: `…/reset` → das Paket selbst. Nutzlast, Lesegriff und Zielzustand
        // bleiben WÖRTLICH die der echten Reset-Zeile — sonst mässe diese Gegenprobe ihre eigene
        // Erfindung statt der Zusicherung, um die es geht.
        return { ...vorgang, pfad: vorgang.pfad.replace(/\/reset$/, "") };
      },
    };
    const geloescht = await messe(alsLoeschung, "admin");
    expect(
      geloescht.status,
      `Die Löschtür muss dem Admin mit Erfolg antworten — sonst mässe diese Gegenprobe einen Fehlschlag statt einer falschen Wirkung: ${geloescht.rumpf.slice(0, 200)}`,
    ).toBe(200);
    const verlust = wirkungsAbweichung(
      name,
      "admin",
      geloescht.status,
      geloescht.bestandVorher,
      geloescht.bestandNachher,
      geloescht.wirkung,
      true,
    );
    expect(
      verlust,
      `Die sechs Bausteine wurden GELÖSCHT statt zurückgesetzt (${JSON.stringify(geloescht.bestandVorher)} → ${JSON.stringify(geloescht.bestandNachher)}), und die Nachlesung hat es nicht gemerkt — das ist der Befund des Prüfers aus Runde 1, unrepariert: "null bearbeitete Objekte" ist kein wiederhergestellter Auslieferungsstand.`,
    ).toBeDefined();
    expect(
      verlust,
      "Die Meldung muss die Tür beim Namen nennen — eine anonyme Abweichung schickt niemanden an die richtige Stelle.",
    ).toContain(name);
  });

  // ----------------------------------------------------------------------------------------------
  // DIE ANZEIGE — jede Zahl aus DIESEM Lauf.
  // ----------------------------------------------------------------------------------------------
  it("S4: die gemessenen Schreib-Türen stehen mit ihren fünf Status da", () => {
    expect(anzeige.length, "gefahrene Schreibzeilen").toBe(SCHREIB_TABELLE.length);
    console.log(
      [
        `SCHREIBENDE TÜREN, MIT FÜNF AKTEUREN GEFAHREN (${SCHREIB_TABELLE.length} Zeilen, je Messung eine eigene Bühne)`,
        "  Reihenfolge der Status: anonym · viewer · experte · controller · admin",
        ...anzeige,
      ].join("\n"),
    );
  });
});
