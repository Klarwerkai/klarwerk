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
  ausgelasseneAkteure,
  vollstaendigGemessen,
} from "./schreibende-tueren";
import { type Erwartung, eintrag, erwarteterCode, gemessen } from "./tabelle";

afterEach(schliesseBuehnen);

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
): Promise<Messwert & { bestandVorher: unknown; bestandNachher: unknown }> {
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
        const { status, ergebnis, rumpf, getroffen, stimmt } = await messe(zeile, akteur);
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
  const WIRKUNG_GEPRUEFT = [
    "POST /api/kos",
    "DELETE /api/kos/:id",
    "PUT /api/upload-limits",
    "PUT /api/validation/settings",
    "POST /api/drafts",
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
      for (const gesperrt of gesperrte) {
        const { status, bestandVorher, bestandNachher } = await messe(zeile, gesperrt);
        expect([401, 403], `${name} als ${gesperrt}: HTTP ${status}`).toContain(status);
        expect(
          bestandVorher,
          "Diese Zeile liest keinen Bestand — dann kann sie über die WIRKUNG der Sperre nichts sagen.",
        ).toBeDefined();
        expect(
          bestandNachher,
          `${name}: ${gesperrt} wurde mit HTTP ${status} abgewiesen, der Bestand hat sich aber trotzdem verändert (${JSON.stringify(bestandVorher)} → ${JSON.stringify(bestandNachher)}).`,
        ).toEqual(bestandVorher);
      }
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
