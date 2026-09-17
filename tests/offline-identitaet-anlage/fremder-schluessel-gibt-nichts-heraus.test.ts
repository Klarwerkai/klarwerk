// ================================================================================================
// JOB 4249 · A5 — DERSELBE SCHLÜSSEL GIBT NIE ETWAS FREMDES HERAUS.
// ================================================================================================
//
// ERST MESSEN, DANN HANDELN (Auftrag Lieferung 5). Gemessen wurde am unveränderten Produktstand,
// ob der vorhandene Weg das schon garantiert. ER TUT ES — und zwar nicht zufällig, sondern durch
// zwei Zeilen, die den Schlüssel ausdrücklich AN DEN EIGENTÜMER BINDEN:
//
//   services/capture/src/repo-pg.ts:132-148
//     ON CONFLICT (create_operation_id, COALESCE(create_operation_actor, ''))   … und
//     SELECT … WHERE create_operation_id = $1 AND COALESCE(create_operation_actor,'') = $2
//
//   services/capture/src/service.ts:642-666
//     „DER EIGENTÜMER IST `author`, also die authentifizierte Person aus der Route — nie ein Wert
//      aus dem Rumpf." Der Abdruckvergleich läuft „NUR auf dem gefundenen EIGENEN Datensatz".
//
// DESHALB WURDE HIER NICHTS GEÄNDERT. Was fehlte, war der NACHWEIS: ohne ihn hinge die Zusage an
// zwei Kommentaren. Diese Datei nagelt sie an der echten App fest (`buildApp`, `app.inject`, zwei
// wirkliche Konten) — und deckt damit auch den Weg ab, den JOB 4249 neu benutzt: die Anlage aus
// der Offline-Warteschlange schickt jetzt eine Vorgangskennung mit, und zwei Geräte/Konten können
// dieselbe Kennung tragen (sie ist eine UUID des Clients, keine Zusage über Fremdheit).
import { beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { CaptureService } from "../../services/capture";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";

let app: ReturnType<typeof buildApp>;
let ablage: InMemoryDraftRepo;
let kopfA: Record<string, string>;
let kopfB: Record<string, string>;

/** Der Vorgangsschlüssel, den BEIDE Konten benutzen — das ist der ganze Fall. */
const SCHLUESSEL = "vorgang-gleich-fuer-beide";

const A_TITEL = "Ventil bei Überdruck schliessen";
const A_TEXT = "Vertrauliche Aussage von Anna.";
const B_TITEL = "Pumpe entlüften";
const B_TEXT = "Ganz andere Aussage von Bert.";

async function anlegen(
  kopf: Record<string, string>,
  payload: Record<string, unknown>,
  operationId?: string,
  expectedOwner?: string,
  sprache?: string,
) {
  return app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { ...kopf, ...(sprache ? { "accept-language": sprache } : {}) },
    payload: {
      ...payload,
      ...(operationId ? { operationId } : {}),
      ...(expectedOwner ? { expectedOwner } : {}),
    },
  });
}

/** Die Kennung des angemeldeten Kontos — die echte Serverantwort, kein erfundener Wert. */
async function kennungVon(kopf: Record<string, string>): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: kopf });
  return String((res.json() as { id: string }).id);
}

beforeEach(async () => {
  ablage = new InMemoryDraftRepo();
  app = buildApp({ ...buildServices(), capture: new CaptureService({ repo: ablage }) });
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Chef", email: "chef@x.de", password: "secret123" },
  });
  const chef = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "chef@x.de", password: "secret123" },
  });
  const chefKopf = { authorization: `Bearer ${String(chef.json().token)}` };
  for (const [name, mail] of [
    ["Anna", "anna@x.de"],
    ["Bert", "bert@x.de"],
  ]) {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: chefKopf,
      payload: { name, email: mail, password: "passwort12", role: "experte" },
    });
  }
  const anmelden = async (mail: string): Promise<Record<string, string>> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: mail, password: "passwort12" },
    });
    return { authorization: `Bearer ${String(res.json().token)}` };
  };
  kopfA = await anmelden("anna@x.de");
  kopfB = await anmelden("bert@x.de");
});

describe("JOB 4249 · A5 · derselbe Vorgangsschlüssel, ein anderes Konto", () => {
  it("S1 · B bekommt NICHT den Entwurf von A, sondern einen eigenen", async () => {
    const vonA = await anlegen(kopfA, { title: A_TITEL, statement: A_TEXT }, SCHLUESSEL);
    expect(vonA.statusCode, "A konnte nicht anlegen").toBe(201);

    const vonB = await anlegen(kopfB, { title: B_TITEL, statement: B_TEXT }, SCHLUESSEL);

    // 201 heisst: NEU angelegt. Ein 200 hier wäre die Katastrophe — es hiesse „derselbe Vorgang",
    // und B hielte den Entwurf von A in der Hand.
    expect(vonB.statusCode, "der fremde Schlüssel wurde als Wiederholung gedeutet").toBe(201);
    expect(vonB.json().id, "B bekam die Entwurfs-Id von A").not.toBe(vonA.json().id);
    expect(vonB.json().originalAuthor).not.toBe(vonA.json().originalAuthor);
    expect(await ablage.list(), "es steht nicht je ein Entwurf je Konto").toHaveLength(2);
  });

  it("S2 · in Bs Antwort steht kein Zeichen von As Inhalt", async () => {
    await anlegen(kopfA, { title: A_TITEL, statement: A_TEXT }, SCHLUESSEL);
    const vonB = await anlegen(kopfB, { title: B_TITEL, statement: B_TEXT }, SCHLUESSEL);

    expect(vonB.body, "As Titel scheint in Bs Antwort durch").not.toContain(A_TITEL);
    expect(vonB.body, "As Aussage scheint in Bs Antwort durch").not.toContain(A_TEXT);
    expect(vonB.json().payload.title, "B bekam As Nutzlast").toBe(B_TITEL);

    // Und die Listen bleiben getrennt — dieselbe Regel (`canSeeDraft`), an der Aussenkante gemessen.
    const listeB = await app.inject({ method: "GET", url: "/api/drafts", headers: kopfB });
    expect(listeB.body, "A steht in Bs Entwurfsliste").not.toContain(A_TITEL);
    const listeA = await app.inject({ method: "GET", url: "/api/drafts", headers: kopfA });
    expect(listeA.body, "B steht in As Entwurfsliste").not.toContain(B_TITEL);
  });

  it("S3 · derselbe Schlüssel, dasselbe Konto, dieselbe Nutzlast → EIN Entwurf, dieselbe Id", async () => {
    // Der Vertrag aus JOB 2697 D7, an dem der Offline-Weg seit diesem Auftrag hängt. Ohne diesen
    // Fall wäre auch eine Fassung grün, die Fremdheit sauber trennt und Wiederholung nicht kann.
    const erst = await anlegen(kopfA, { title: A_TITEL, statement: A_TEXT }, SCHLUESSEL);
    const wieder = await anlegen(kopfA, { title: A_TITEL, statement: A_TEXT }, SCHLUESSEL);

    expect(erst.statusCode).toBe(201);
    expect(wieder.statusCode, "die Wiederholung legte ein zweites Mal an").toBe(200);
    expect(wieder.json().id).toBe(erst.json().id);
    expect(await ablage.list()).toHaveLength(1);
  });

  it("S4 · derselbe Schlüssel, dasselbe Konto, ANDERE Nutzlast → 409, und nichts scheint durch", async () => {
    await anlegen(kopfA, { title: A_TITEL, statement: A_TEXT }, SCHLUESSEL);
    const anders = await anlegen(kopfA, { title: "Etwas ganz anderes" }, SCHLUESSEL);

    expect(anders.statusCode).toBe(409);
    expect(anders.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    // Der Fehlertext benennt den KONFLIKT, nicht den Inhalt. Eine Meldung, die den gespeicherten
    // Entwurf zitierte, wäre ein Leseweg an jeder Berechtigung vorbei.
    expect(anders.body, "der gespeicherte Inhalt steht im Fehlertext").not.toContain(A_TEXT);
    expect(await ablage.list(), "der Abdruckkonflikt hat trotzdem angelegt").toHaveLength(1);
  });

  // ==============================================================================================
  // JOB 4249 R6 · S6–S8 — DIE VORAUSSETZUNG DES AUFRUFS: `expectedOwner`.
  // ==============================================================================================
  //
  // WARUM DIESE DREI FÄLLE HIER STEHEN: Fünf Runden lang wurde die Kontobindung im Client geprüft,
  // und fünfmal hat BEN das nächste Zeitfenster zwischen Prüfung und Absenden gemessen (R1, R3, R4,
  // R5). Das ist kein Zufall — welches Cookie der Browser anhängt, entscheidet sich ERST beim
  // Absenden, und darauf hat kein Client Zugriff. Seit R6 trägt der Aufruf seine Voraussetzung
  // deshalb MIT, in derselben Bauform wie `expectedUpdatedAt` beim Aktualisieren: Stimmt sie nicht,
  // legt der Server nichts an. Die Zusage „mit dem richtigen Konto" hängt damit an den Daten und
  // nicht mehr am richtigen Augenblick.
  it("S6 · der Aufruf war für A gedacht und kommt als B an → 409, und es entsteht NICHTS", async () => {
    const kennungA = await kennungVon(kopfA);

    const alsB = await anlegen(kopfB, { title: A_TITEL, statement: A_TEXT }, SCHLUESSEL, kennungA);

    expect(alsB.statusCode, "der Aufruf für ein fremdes Konto wurde angenommen").toBe(409);
    expect(alsB.json().error).toBe("DRAFT_OWNER_MISMATCH");
    expect(await ablage.list(), "es wurde trotzdem etwas angelegt").toHaveLength(0);
    // Weder in As noch in Bs Liste steht etwas — nichts ist entstanden, nichts ist umgehängt.
    const listeB = await app.inject({ method: "GET", url: "/api/drafts", headers: kopfB });
    expect(listeB.json()).toHaveLength(0);
    const listeA = await app.inject({ method: "GET", url: "/api/drafts", headers: kopfA });
    expect(listeA.json()).toHaveLength(0);
    // Und die Antwort verrät nichts: weder das erwartete noch das tatsächliche Konto.
    expect(alsB.body, "die Antwort nennt die Kennung des erwarteten Kontos").not.toContain(
      kennungA,
    );
    expect(alsB.body, "die Antwort nennt die Kennung des angemeldeten Kontos").not.toContain(
      await kennungVon(kopfB),
    );
  });

  // ==============================================================================================
  // JOB 4249 R7 · S6a–S6c — DER SATZ SPRICHT DIE SPRACHE DER SITZUNG.
  // ==============================================================================================
  //
  // DER BEFUND, der diese drei Fälle ausgelöst hat: In Runde 6 stand der Satz der 409-Antwort als
  // deutsches Literal in `capture-routes.ts`. Das Tor war rot
  // (`tests/q9-fremde-flaechen/keine-deutschen-literale.test.ts`, 4 von 29 Fällen) — der Wächter hat
  // genau das getan, wofür er gebaut ist. Der Satz kommt seit R7 aus dem Katalog
  // (`services/auth/src/meldungen.ts`, Schlüssel `DRAFT_OWNER_MISMATCH`).
  //
  // EIN NEUER KATALOGSCHLÜSSEL BRINGT SEINE MESSUNG MIT — dieselbe Regel, nach der `ACCESS_EXPIRED`
  // (JOB 3756), `ACCESS_EXPIRY_UNREADABLE` (JOB 4011) und die beiden Entwurfssätze (JOB 3956)
  // eingeführt wurden: ohne einen aktiven Fall, der EN und NL an einer echten Antwort liest, wäre
  // die Übersetzung eine Behauptung. Deshalb steht der Schlüssel NICHT in `OHNE_ROUTENFALL`
  // (`tests/q9-serverfehlertexte/katalogschluessel-herkunft.test.ts`), sondern mit diesen beiden
  // Fällen in `GEMESSEN_VON`.
  //
  // JEDER FALL HÄLT DEN SATZ DOPPELT, wie E1/F1 in `tests/q9-entwurfsfehler/`: WÖRTLICH (ein
  // deutscher oder schiefer Satz im Sprachfeld des Katalogs fällt auf) UND gegen
  // `MELDUNGEN.DRAFT_OWNER_MISMATCH.<sprache>` (ein zweites Literal im Code oder ein verstellter
  // Schlüssel fällt auf).
  it("S6a EN · fremdes Konto beim Anlegen: 409 DRAFT_OWNER_MISMATCH mit englischem Satz", async () => {
    const kennungA = await kennungVon(kopfA);
    const alsB = await anlegen(
      kopfB,
      { title: A_TITEL, statement: A_TEXT },
      SCHLUESSEL,
      kennungA,
      "en",
    );
    expect(alsB.statusCode).toBe(409);
    expect(alsB.json().error).toBe("DRAFT_OWNER_MISMATCH");
    expect(alsB.json().message).toBe(
      "This entry was created by a different account. Nothing was saved — sign in with the account it belongs to.",
    );
    expect(alsB.json().message).toBe(MELDUNGEN.DRAFT_OWNER_MISMATCH.en);
    expect(String(alsB.json().message)).not.toMatch(/Vorgang|angelegt|Unerwarteter/);
    expect(await ablage.list(), "trotz Absage wurde angelegt").toHaveLength(0);
  });

  it("S6b NL · fremdes Konto beim Anlegen: 409 DRAFT_OWNER_MISMATCH mit niederländischem Satz", async () => {
    const kennungA = await kennungVon(kopfA);
    const alsB = await anlegen(
      kopfB,
      { title: A_TITEL, statement: A_TEXT },
      SCHLUESSEL,
      kennungA,
      "nl",
    );
    expect(alsB.statusCode).toBe(409);
    expect(alsB.json().error).toBe("DRAFT_OWNER_MISMATCH");
    expect(alsB.json().message).toBe(
      "Dit item is met een ander account gemaakt. Er is niets opgeslagen — meld je aan met het account waar het bij hoort.",
    );
    expect(alsB.json().message).toBe(MELDUNGEN.DRAFT_OWNER_MISMATCH.nl);
    expect(String(alsB.json().message)).not.toMatch(/Vorgang|angelegt|Unerwarteter/);
    expect(await ablage.list(), "trotz Absage wurde angelegt").toHaveLength(0);
  });

  it("S6c DE · ohne und mit unbekanntem Sprachkopf bleibt es beim deutschen Wortlaut", async () => {
    // Der Rückfall — und zugleich die Zusage, dass der deutsche Satz zeichengleich mit dem Literal
    // aus Runde 6 ist: die Übersetzung hat den Wortlaut nicht nebenbei geändert.
    const kennungA = await kennungVon(kopfA);
    for (const sprache of [undefined, "de", "fr"]) {
      const alsB = await anlegen(
        kopfB,
        { title: A_TITEL, statement: A_TEXT },
        SCHLUESSEL,
        kennungA,
        sprache,
      );
      expect(alsB.statusCode, String(sprache)).toBe(409);
      expect(alsB.json(), String(sprache)).toEqual({
        error: "DRAFT_OWNER_MISMATCH",
        message:
          "Dieser Vorgang wurde von einem anderen Konto erfasst. Es wurde nichts angelegt — melde dich mit dem Konto an, von dem er stammt.",
      });
    }
    expect(await ablage.list(), "trotz Absage wurde angelegt").toHaveLength(0);
  });

  it("S7 · der Schlüssel ist danach UNVERBRAUCHT: A holt denselben Vorgang eigenhändig nach", async () => {
    // Die Hälfte, die eine 409-Antwort allein nicht belegt. Würde die Abweisung den Vorgang
    // verbrennen (etwa weil der Schlüssel schon vermerkt wäre), wäre die Arbeit von A verloren,
    // sobald sie einmal beim falschen Konto anklopft — Datenverlust auf dem Umweg über eine
    // Schutzmassnahme.
    const kennungA = await kennungVon(kopfA);
    const abgewiesen = await anlegen(
      kopfB,
      { title: A_TITEL, statement: A_TEXT },
      SCHLUESSEL,
      kennungA,
    );
    expect(abgewiesen.statusCode).toBe(409);

    const nachgeholt = await anlegen(
      kopfA,
      { title: A_TITEL, statement: A_TEXT },
      SCHLUESSEL,
      kennungA,
    );
    expect(nachgeholt.statusCode, "der abgewiesene Schlüssel war verbraucht").toBe(201);
    expect(nachgeholt.json().payload.title).toBe(A_TITEL);
    const bestand = await ablage.list();
    expect(bestand).toHaveLength(1);
    expect(bestand[0]?.originalAuthor).toBe(kennungA);
  });

  it("S8 · passende Voraussetzung ändert nichts, und ohne sie bleibt alles wie bisher", async () => {
    // Ohne diesen Fall wäre auch eine Fassung grün, die JEDE Anlage mit Voraussetzung abweist —
    // dann ginge aus der Warteschlange nie wieder etwas hinaus, und niemand merkte es an den
    // Fällen oben.
    const kennungA = await kennungVon(kopfA);
    const passend = await anlegen(
      kopfA,
      { title: A_TITEL, statement: A_TEXT },
      SCHLUESSEL,
      kennungA,
    );
    expect(passend.statusCode).toBe(201);

    // Und die Wiederholung desselben Vorgangs bleibt die Wiederholung — die Voraussetzung tritt
    // dem Vertrag aus JOB 2697 D7 nicht in den Weg.
    const wieder = await anlegen(
      kopfA,
      { title: A_TITEL, statement: A_TEXT },
      SCHLUESSEL,
      kennungA,
    );
    expect(wieder.statusCode, "die Wiederholung legte ein zweites Mal an").toBe(200);
    expect(wieder.json().id).toBe(passend.json().id);

    // Ein Aufruf OHNE Voraussetzung verhält sich unverändert (`pages/Capture.tsx`, das Panel, Word).
    const ohne = await anlegen(kopfB, { title: B_TITEL, statement: B_TEXT });
    expect(ohne.statusCode).toBe(201);
    expect(await ablage.list()).toHaveLength(2);

    // Die Voraussetzung landet NICHT im Dokument — dieselbe Regel wie für `operationId` (JOB 2697
    // D1 ist genau daran gescheitert).
    expect(
      Object.keys(passend.json().payload),
      "die Voraussetzung wurde in die Nutzlast geschrieben",
    ).not.toContain("expectedOwner");
    expect(passend.body).not.toContain("expectedOwner");
  });

  it("S5 · ohne Schlüssel bleibt der Bestandsweg unverändert: jeder Aufruf legt an", async () => {
    // Die Gegenprobe zur Idempotenz. Ohne sie wäre auch eine Fassung grün, die JEDE zweite Anlage
    // verschluckt — dann ginge ein wirklich zweiter Entwurf verloren.
    const erst = await anlegen(kopfA, { title: A_TITEL, statement: A_TEXT });
    const zweit = await anlegen(kopfA, { title: A_TITEL, statement: A_TEXT });

    expect(erst.statusCode).toBe(201);
    expect(zweit.statusCode).toBe(201);
    expect(zweit.json().id).not.toBe(erst.json().id);
    expect(await ablage.list()).toHaveLength(2);
  });
});
