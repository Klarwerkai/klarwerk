// ================================================================================================
// JOB 4223 · D — WAS DER GESPERRTE GAST LIEST, IN DREI SPRACHEN, ÜBER DEN ECHTEN DRAHT.
// ================================================================================================
//
// DIE ZWEI LAGEN DÜRFEN NIE ZU EINER WERDEN. „Noch nicht freigegeben" und „abgelaufen" haben zwei
// verschiedene Wege zurück — im einen Fall erteilt der Admin die Freigabe, im anderen nimmt oder
// verlängert er die Befristung. Ein gemeinsamer Satz schickte die Hälfte der Betroffenen in die
// falsche Richtung; genau das hat JOB 3756 behoben, und diese Datei hält es fest.
//
// DER FEHLERCODE IST BEI BEIDEN `NOT_APPROVED` (403), UND DAS IST ABSICHT. `AuthErrorCode`
// (`services/auth/src/types.ts:62`) trägt den HTTP-Status und den Vertrag der Clients; fachlich hat
// sich nichts geändert, nur der SATZ sagt die Wahrheit (`service.ts:275-277`). Diese Datei misst
// deshalb BEIDES: gleicher Code, verschiedener Satz. Wer künftig die Sätze zusammenlegt ODER den
// Code auseinanderzieht, wird hier rot.
//
// DER SOLLWERT KOMMT AUS DEM KATALOG (`MELDUNGEN`), NICHT AUS EINER ABSCHRIFT — dieselbe Regel wie
// in `tests/gast-ablauf-anmeldemaske/…:27-30`. Einmal, und nur einmal, steht der deutsche Satz
// trotzdem wörtlich da (D1), damit ein Mensch die Zusage lesen kann.
//
// WAS DIESE DATEI GEGENÜBER DEN VORHANDENEN NEU MISST: `tests/demo-zugang-gaeste-meldung/` misst am
// Dienst, `tests/gast-ablauf-anmeldemaske/` in jsdom mit `fetch` auf `app.inject`. Hier läuft der
// `Accept-Language`-Kopf über einen ECHTEN Socket durch Fastifys Kopfzeilenverarbeitung — die eine
// Station, an der eine Sprachaushandlung überhaupt schiefgehen kann.
//
// ================================================================================================
// JOB 4265 · DIE GRENZE VON 4223 IST ABGERÄUMT — DER SATZ NENNT JETZT AUCH DIE HANDLUNG.
// ================================================================================================
//
// Hier stand bis JOB 4265 eine „EHRLICHE GRENZE": der Katalogsatz benenne die LAGE („Ihr Zugang ist
// abgelaufen."), nicht die Handlung; was der Gast TUN könne, stehe im Produkt nur mittelbar da, und
// ein eigener Handlungssatz müsste in `services/auth/src/meldungen.ts` stehen — der damals kein
// Zielpfad war. Genau das ist jetzt geschehen, und die Grenzbeschreibung wird deshalb ERSETZT und
// nicht stehengelassen: eine Beschreibung, die eine behobene Lücke weiter behauptet, ist ab dem Tag
// ihrer Behebung eine Unwahrheit.
//
// WAS D5 UND D6 NEU MESSEN — und warum es zwei Fälle sind:
//
//   · D5 verlangt den HANDLUNGSTEIL, in allen drei Sprachen und über denselben echten Socket. Die
//     naheliegende Halbheit ist „nur das Deutsche geändert"; D5 fragt jede Sprache einzeln.
//   · D6 verlangt, dass der Satz dabei NICHTS erfindet. Ein Handlungssatz ist die Einladung, mehr
//     hineinzuschreiben, als der Katalog weiss — ein Datum, ein Konto, einen Namen, einen Link auf
//     eine Selbstbedienung, die es nicht gibt. Der Katalog steht vor JEDEM abgelaufenen Zugang
//     gleich da und kennt nichts davon.
import { afterEach, describe, expect, it } from "vitest";
import { MELDUNGEN, type Sprache } from "../../services/auth/src/meldungen";
import type { PublicUser } from "../../services/auth/src/types";
import {
  PASSWORT,
  type Strecke,
  arbeitsweg,
  ausDerListe,
  befristen,
  ersteinrichtung,
  gastAnlegen,
  kuenftig,
  mussGelingen,
  starteStrecke,
  vergangen,
} from "./strecke";

const SPRACHEN: Sprache[] = ["de", "en", "nl"];
const ABGELAUFEN = "abgelaufen@gastweg-4223.test";
const UNFREIGEGEBEN = "unfreigegeben@gastweg-4223.test";

/**
 * JOB 4265 · WAS DER HANDLUNGSTEIL JE SPRACHE NENNEN MUSS.
 *
 * Nicht der ganze Satz — den hält D1 wörtlich, einmal, auf Deutsch. Hier stehen die beiden Stücke,
 * ohne die aus einer Handlungsanweisung wieder eine blosse Lagemeldung würde: WER hilft
 * (`zustaendiger`) und WAS er tut (`tat`). Beides wird gebraucht: „Bitte an den Admin wenden."
 * nennt niemanden, der verlängert, und „Bitte verlängern lassen." nennt niemanden, an den man sich
 * wenden könnte.
 *
 * Wortstämme statt vollständiger Wörter (`verlänger`, `verleng`), damit eine Umformulierung der
 * Beugung den Wächter nicht rot macht — gemeint ist die Aussage, nicht die Endung.
 */
const HANDLUNG: Record<Sprache, { zustaendiger: string; tat: string }> = {
  de: { zustaendiger: "Admin", tat: "verlänger" },
  en: { zustaendiger: "administrator", tat: "extend" },
  nl: { zustaendiger: "beheerder", tat: "verleng" },
};

let offen: Strecke | undefined;

afterEach(async () => {
  await offen?.schliessen();
  offen = undefined;
});

/** Eine Instanz mit beiden Lagen nebeneinander: ein abgelaufenes und ein unfreigegebenes Konto. */
async function beideLagen(): Promise<Strecke> {
  const strecke = await starteStrecke();
  offen = strecke;
  const { sitzung: admin } = await ersteinrichtung(strecke);
  mussGelingen(
    "POST /api/users (abgelaufen)",
    await gastAnlegen(admin, {
      name: "Abgelaufener Gast",
      email: ABGELAUFEN,
      role: "viewer",
      accessExpiresAt: vergangen(),
    }),
    201,
  );
  // Der zweite entsteht über den Selbstregistrierweg — so entsteht ein UNFREIGEGEBENES Konto.
  // (Die Testumgebung schaltet ihn ausdrücklich frei, `tests/setup-env.ts:6`.)
  mussGelingen(
    "POST /api/auth/register",
    await strecke.profil("neuling").sende("POST", "/api/auth/register", {
      name: "Neuling",
      email: UNFREIGEGEBEN,
      password: PASSWORT,
    }),
    201,
  );
  return strecke;
}

describe("JOB 4223 D · der gesperrte Gast liest seinen Satz — DE, EN, NL", () => {
  it("D1 — der abgelaufene Zugang bekommt in jeder Sprache SEINEN Satz", async () => {
    const strecke = await beideLagen();
    // Einmal wörtlich, damit die Zusage lesbar ist; die drei Sprachen darunter kommen aus dem Katalog.
    // JOB 4265: der Wortlaut ist nachgeführt — der Satz nennt jetzt Lage UND Handlung.
    expect(MELDUNGEN.ACCESS_EXPIRED.de).toBe(
      "Ihr Zugang ist abgelaufen. Bitte vom Admin verlängern lassen.",
    );

    for (const sprache of SPRACHEN) {
      const profil = strecke.profil(`abgelaufen-${sprache}`, sprache);
      const antwort = await profil.sende("POST", "/api/auth/login", {
        email: ABGELAUFEN,
        password: PASSWORT,
      });
      expect(antwort.status, `${sprache}: ${antwort.text}`).toBe(403);
      const rumpf = antwort.json as { error: string; message: string };
      expect(rumpf.error, "der Fehlercode bleibt derselbe").toBe("NOT_APPROVED");
      expect(rumpf.message, `${sprache}`).toBe(MELDUNGEN.ACCESS_EXPIRED[sprache]);
      expect(profil.hatSitzungskeks()).toBe(false);
    }
  });

  it("D2 — das noch nicht freigegebene Konto bekommt den ANDEREN Satz, in jeder Sprache", async () => {
    const strecke = await beideLagen();
    for (const sprache of SPRACHEN) {
      const antwort = await strecke
        .profil(`unfreigegeben-${sprache}`, sprache)
        .sende("POST", "/api/auth/login", { email: UNFREIGEGEBEN, password: PASSWORT });
      expect(antwort.status, `${sprache}: ${antwort.text}`).toBe(403);
      const rumpf = antwort.json as { error: string; message: string };
      expect(rumpf.error).toBe("NOT_APPROVED");
      expect(rumpf.message, `${sprache}`).toBe(MELDUNGEN.NOT_APPROVED[sprache]);
      // UNTERSCHEIDBAR — und zwar in jeder der drei Sprachen einzeln, nicht nur im Deutschen.
      expect(
        MELDUNGEN.NOT_APPROVED[sprache],
        `${sprache}: die beiden Lagen sagen dasselbe`,
      ).not.toBe(MELDUNGEN.ACCESS_EXPIRED[sprache]);
    }
  });

  it("D3 — die abgelaufene LAUFENDE Sitzung behauptet nicht, das Konto sei nie freigegeben worden", async () => {
    // Die Lage ist eine dritte: der Gast war drin, sein Zugang ist unterwegs geendet. Was er
    // zurückbekommt, darf nicht behaupten, sein Konto sei nie freigegeben worden.
    const strecke = await starteStrecke();
    offen = strecke;
    const { sitzung: admin } = await ersteinrichtung(strecke);
    const gast = mussGelingen(
      "POST /api/users",
      await gastAnlegen(admin, {
        name: "Gast im Haus",
        email: "laufend@gastweg-4223.test",
        role: "viewer",
        accessExpiresAt: kuenftig(),
      }),
      201,
    ).json as PublicUser;

    const profil = strecke.profil("laufend", "de");
    mussGelingen(
      "Anmeldung",
      await profil.sende("POST", "/api/auth/login", {
        email: "laufend@gastweg-4223.test",
        password: PASSWORT,
      }),
    );
    mussGelingen("Frist in die Vergangenheit", await befristen(admin, gast.id, vergangen()));

    const antwort = await arbeitsweg(profil);
    expect([401, 403], antwort.text).toContain(antwort.status);
    expect(
      antwort.text,
      `die laufende Sitzung darf nicht „${MELDUNGEN.NOT_APPROVED.de}" behaupten`,
    ).not.toContain(MELDUNGEN.NOT_APPROVED.de);
  });

  it("D4 — `approved` wird nirgends als anmeldbar ausgegeben", async () => {
    // Die Kontenliste sagt über dieses Konto beides und trennt es: freigegeben JA, Ende gesetzt.
    // Ein Feld, das „anmeldbar" behauptete, gäbe es nicht — und es darf auch keines dazukommen.
    const strecke = await beideLagen();
    const admin = strecke.profil("admin2");
    mussGelingen(
      "Anmeldung des Admins",
      await admin.sende("POST", "/api/auth/login", {
        email: "admin@gastweg-4223.test",
        password: PASSWORT,
      }),
    );
    const liste = mussGelingen("GET /api/users", await admin.sende("GET", "/api/users"))
      .json as PublicUser[];

    const abgelaufen = liste.find((u) => u.email === ABGELAUFEN);
    const unfreigegeben = liste.find((u) => u.email === UNFREIGEGEBEN);
    expect(abgelaufen?.approved, "der abgelaufene Gast ist freigegeben").toBe(true);
    expect(abgelaufen?.accessExpiresAt, "und trägt sein Ende").toBeDefined();
    expect(unfreigegeben?.approved, "der Neuling ist nicht freigegeben").toBe(false);
    expect(Object.hasOwn(unfreigegeben ?? {}, "accessExpiresAt"), "und trägt kein Ende").toBe(
      false,
    );

    // Kein Feld dieser Liste behauptet Anmeldbarkeit — die Fläche kann sie nur aus beiden Stücken
    // zusammen ableiten, und genau das soll so bleiben.
    for (const konto of liste) {
      for (const name of Object.keys(konto)) {
        expect(
          /anmeldbar|loginable|canlogin|signinallowed/i.test(name),
          `„${name}" behauptet Anmeldbarkeit`,
        ).toBe(false);
      }
    }

    // Und die Probe aufs Exempel: derselbe Bestand, und der eine kommt trotz `approved` nicht herein.
    const versuch = await strecke
      .profil("probe")
      .sende("POST", "/api/auth/login", { email: ABGELAUFEN, password: PASSWORT });
    expect(versuch.status).toBe(403);
    expect((await ausDerListe(admin, abgelaufen?.id ?? ""))?.approved).toBe(true);
  });

  it("D5 — der Satz sagt nicht nur, WAS ist, sondern was der Gast TUN kann — in jeder Sprache", async () => {
    const strecke = await beideLagen();
    for (const sprache of SPRACHEN) {
      const antwort = await strecke
        .profil(`handlung-${sprache}`, sprache)
        .sende("POST", "/api/auth/login", { email: ABGELAUFEN, password: PASSWORT });
      expect(antwort.status, `${sprache}: ${antwort.text}`).toBe(403);
      const satz = (antwort.json as { message: string }).message;
      // Der Sollwert kommt weiterhin aus dem Katalog: gemessen wird, was am Draht ankommt.
      expect(satz, `${sprache}: der Satz am Draht ist nicht der des Katalogs`).toBe(
        MELDUNGEN.ACCESS_EXPIRED[sprache],
      );

      const { zustaendiger, tat } = HANDLUNG[sprache];
      expect(
        satz,
        `${sprache}: der Satz sagt nicht, AN WEN sich der Gast wenden muss — „${satz}"`,
      ).toContain(zustaendiger);
      expect(
        satz,
        `${sprache}: der Satz sagt nicht, WAS geschehen soll (die Befristung verlängern) — „${satz}"`,
      ).toContain(tat);
      // Die Lage bleibt VORNE: die Handlung ergänzt sie, sie ersetzt sie nicht. Wer nur noch läse
      // „Bitte vom Admin verlängern lassen.", wüsste nicht, warum er nicht hereinkommt.
      expect(
        satz.indexOf(zustaendiger),
        `${sprache}: die Handlung steht vor der Lage — „${satz}"`,
      ).toBeGreaterThan(satz.indexOf("."));
    }
  });

  it("D6 — und er erfindet dabei nichts: kein Datum, kein Konto, kein Selbstbedienungsweg", () => {
    // Die Gefahr eines Handlungssatzes ist, mehr zu versprechen, als der Katalog weiss. Er steht
    // vor JEDEM abgelaufenen Zugang gleich da (`meldungen.ts`) und kennt weder das Ende noch das
    // Konto noch den Namen eines Zuständigen — und es gibt keinen Weg, den der Gast selbst gehen
    // könnte. Ein Satz, der einen nennte, wäre eine Sackgasse mit Wegweiser.
    for (const sprache of SPRACHEN) {
      const satz = MELDUNGEN.ACCESS_EXPIRED[sprache];
      expect(
        /\d/.test(satz),
        `${sprache}: im Satz steht eine Ziffer — ein Datum oder eine Frist, die der Katalog nicht kennt: „${satz}"`,
      ).toBe(false);
      expect(satz, `${sprache}: der Satz nennt ein Konto — „${satz}"`).not.toContain("@");
      expect(
        /https?:\/\/|www\./i.test(satz),
        `${sprache}: der Satz verweist auf einen Selbstbedienungsweg, den es nicht gibt: „${satz}"`,
      ).toBe(false);
    }
  });
});
