// ================================================================================================
// JOB 4011 R2 · DIE ZUSAGE GILT AUCH, WENN DIE ABLAGE NICHT ANTWORTET
// ================================================================================================
//
// WAS RUNDE 1 NICHT GEMESSEN HAT (BEN, Gegenprobe mit gestörtem Ablagenschreiben):
//
//     F1: POST 500 · Konto vorhanden · approved: true · ohne Befristung · ANMELDUNG 200
//     F2: POST 201 · Anmeldung MITTEN im Vorgang 200, erst danach 403
//
// Runde 1 hat die Eingabe geprüft, BEVOR etwas entsteht — das deckt den Tippfehler und nur ihn.
// Scheiterte danach ein SCHREIBEN, blieb genau das unbefristete, anmeldbare Konto zurück, gegen
// das dieser Auftrag gebaut ist; und während des Befristungsschreibens stand das Fenster ohnehin
// offen (freigegeben, aber noch ohne Ende). Die Rückgabe der Runde 1 behauptete trotzdem
// uneingeschränkt „befristet oder gar keiner".
//
// WAS DIESE DATEI MISST, und zwar an der Nutzerliste und an einer ECHTEN Anmeldung, nicht am
// Statuscode:
//
//   · G7  — scheitert das Befristungsschreiben, bleibt KEIN Konto zurück.
//   · G7b — scheitert zusätzlich die Rücknahme, bleibt ein UNFREIGEGEBENES Konto zurück, mit dem
//           niemand hereinkommt. Das ist die schwächere Zusage, und sie steht hier ausdrücklich
//           da, statt von der starken verdeckt zu werden.
//   · G7c — dasselbe für den letzten Schritt (die Freigabe selbst scheitert).
//   · G7d — BENs Kombination aus Runde 2: FREIGABESCHREIBEN UND RÜCKNAHME scheitern zusammen.
//   · G7e — dieselbe Lage eine Ebene tiefer, am Dienst: ein gescheitertes Freigabeschreiben lässt
//           das gehaltene Konto unverändert. Das ist die URSACHE, G7d ist ihre Wirkung.
//   · G7f — und der dritte Schritt: ROLLENSCHREIBEN UND RÜCKNAHME scheitern zusammen.
//   · G7g — BENs Schnitt aus Runde 3: nicht das Schreiben scheitert, sondern der VERMERK danach.
//   · G7h — derselbe Schnitt am Befristungsvermerk, G7i am Rollenvermerk (BENs Prüflücke 6).
//   · G7j — die Laufzeitzeile über den Rest, in drei Beständen gelesen: sie misst, sie leitet nicht her.
//
// JOB 4011 R4 — WARUM G7g–G7j DAZUGEKOMMEN SIND (BEN, Runde 3, Befunde 4–6):
//
// Runde 3 hat jedes SCHREIBEN gestört, das Prüfprotokoll aber nie. Genau dort lag der letzte
// offene Schnitt: `approveUser` schrieb `approved` und vermerkte danach.
//
//     BEN R3 REST: 500 · Konto vorhanden · approved: true · ANMELDUNG offen
//
// Seit R4 steht der Vermerk in allen drei Schritten VOR dem Schreiben, und wo die Wurzel eine
// echte Transaktion hergibt, laufen beide gemeinsam (`service.approveUser`, mega62 Block B). Damit
// gilt: nach dem Schreiben, das aufsperrt, kann nichts mehr scheitern — die Zusage hängt an KEINEM
// weiteren gelingenden Schritt mehr, insbesondere nicht an der Rücknahme, die BEN zweimal hat
// scheitern lassen. Die Kehrseite steht ebenso gemessen da (G7/G7d/G7e): ein Vermerk kann jetzt
// ohne Wirkung bleiben.
//
// JOB 4011 R3 — WARUM G7d/G7e/G7f DAZUGEKOMMEN SIND (BEN, Runde 2, Befunde 4–6):
//
// Runde 2 hat G7b (Befristung + Rücknahme) und G7c (Freigabe, Rücknahme gelingt) gemessen — die
// KOMBINATION aus beidem aber nicht. Genau sie fiel durch:
//
//     BEN R2 REST {"post":500,"vorhanden":true,"approved":true,"accessExpiresAt":"…","login":200}
//
// Der Grund lag nicht am Anlageweg, sondern in `service.approveUser`: es setzte `approved` am
// GEHALTENEN Konto, bevor es schrieb (`InMemoryUserRepo.findById` gibt den Map-Eintrag selbst
// heraus). Das Schreiben scheiterte, die Freigabe blieb trotzdem stehen, und der Satz „es bleibt
// UNFREIGEGEBEN stehen" im Anlageweg war eine Behauptung ohne Deckung. Behoben ist das an der
// Ursache (Kopie statt Mutation); gemessen wird seither JEDER der drei Schritte nach `register`
// zusammen mit einer ebenfalls scheiternden Rücknahme — Befristung (G7b), Freigabe (G7d), Rolle
// (G7f) —, und jedes Mal an einer ECHTEN Anmeldung, nicht am Statuscode.
//
// DASS ALLE DREI GEMESSEN WERDEN, HAT SICH SOFORT BEZAHLT: G7f war gegen das reparierte
// `approveUser` allein noch rot. `changeRole` trug dasselbe Muster, und der Rest stand mit einer
// Rolle da, die nie geschrieben wurde. Eine Reparatur nur an der Stelle, die BEN benannt hat,
// hätte den Befund geschlossen und den Fehler behalten.
//   · G8  — mitten im Befristungsschreiben wird eine echte Anmeldung versucht: sie kommt nicht
//           herein, und nach dem Aufruf kommt der Gast herein. Beide Hälften, sonst bestünde den
//           Fall auch ein Weg, der gar nicht mehr freigibt.
//   · G8b — BENs F2 wörtlich und die volle Zusage: ein Gast mit Datum in der VERGANGENHEIT ist in
//           KEINEM Moment dieses Aufrufs offen, auch nicht im Augenblick der Freigabe.
//
// DAS MITTEL IST DIE REIHENFOLGE, NICHT EINE TRANSAKTION, und das ist hier die ehrliche Grenze:
// eine gemeinsame Transaktion über alle vier Schreibschritte gäbe es nur über `UserRepo`
// (`insert` nimmt keinen `TxContext`), und `repo.ts` ist kein Zielpfad dieses Auftrags. Es bleibt
// bei zwei Mitteln, die sich ergänzen — Freigabe zuletzt (jeder Zwischenzustand gesperrt) und
// Rücknahme des halb Angelegten (kein Rest) —, und G7b sagt, was übrig bleibt, wenn auch die
// Rücknahme nicht durchkommt.
//
// KEIN ZWEITER AUFBAU. Uhr, Prüfprotokoll und Fastify-Draht kommen aus
// `tests/demo-zugang-gaeste/aufbau` und `tests/demo-zugang-gaeste-route/draht`; die störende
// Ablage wird dort HINEINGEREICHT (`baueDraht({ users })`), statt einen eigenen Draht daneben zu
// stellen.
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUserRepo, type UserRepo } from "../../services/auth";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import type { PublicUser, User } from "../../services/auth/src/types";
import type { TxContext } from "../../services/db-tx";
import {
  anmelden,
  baueDraht,
  schliesseOffeneDraehte,
  token,
} from "../demo-zugang-gaeste-route/draht";
import {
  GAST_PASSWORT,
  type Kreis,
  STUNDE,
  adminUndGast,
  vorgaenge,
} from "../demo-zugang-gaeste/aufbau";

afterEach(schliesseOffeneDraehte);

const NEU = "interessent@x.de";

/**
 * Eine Kontoablage, die auf Ansage nicht antwortet — und die jedes Schreiben vorher beobachten
 * lässt.
 *
 * NACH DEM VORBILD VON `StoerendeSitzungsablage` (`tests/demo-zugang-gaeste/aufbau.ts`), aus
 * demselben Grund: eine konstruktiv begründete Zusage ohne Störfall ist keine Messung, sondern
 * eine Hoffnung. Gestört wird ausschliesslich das SCHREIBEN; Lesen läuft durch, sonst könnte der
 * Fall den Zustand danach gar nicht mehr befragen.
 */
class StoerendeNutzerablage implements UserRepo {
  private readonly echt = new InMemoryUserRepo();
  /** Wirf beim Schreiben DIESES Kontos. */
  stoereSchreiben: ((user: User) => boolean) | undefined;
  /** Läuft VOR jedem Schreiben — hier misst G8 den Zwischenzustand von aussen. */
  beobachteSchreiben: ((user: User) => Promise<void>) | undefined;
  /** Lässt auch die Rücknahme scheitern (G7b). */
  stoereLoeschen = false;
  /** Lässt das LESEN der Liste scheitern — dafür gibt es seit R4 einen eigenen Befund (G7j). */
  stoereListe = false;
  loeschversuche = 0;

  /**
   * JOB 4011 R4: schreibt an der Störung UND am Dienst vorbei.
   *
   * Nur für G7j: dort muss ein FREIGEGEBENER Rest entstehen, und über den Anlageweg ist der seit
   * dieser Runde nicht mehr herstellbar (die Freigabe ist sein letzter Schritt, ihr Vermerk steht
   * davor). Genau deshalb taugt ein solcher Rest als Probe darauf, ob die Protokollzeile den
   * Bestand MISST oder ihn aus dem eigenen Ablauf herleitet.
   */
  schreibeDirekt(user: User): Promise<void> {
    return this.echt.update(user);
  }

  count(): Promise<number> {
    return this.echt.count();
  }
  list(): Promise<User[]> {
    if (this.stoereListe) {
      return Promise.reject(new Error("Kontoablage nicht erreichbar (Liste)."));
    }
    return this.echt.list();
  }
  findByEmail(email: string): Promise<User | undefined> {
    return this.echt.findByEmail(email);
  }
  findById(id: string): Promise<User | undefined> {
    return this.echt.findById(id);
  }
  findByOidcSubject(issuer: string, subject: string): Promise<User | undefined> {
    return this.echt.findByOidcSubject(issuer, subject);
  }
  insert(user: User): Promise<void> {
    return this.echt.insert(user);
  }
  async update(user: User, tx?: TxContext): Promise<void> {
    await this.beobachteSchreiben?.(user);
    if (this.stoereSchreiben?.(user)) {
      throw new Error("Kontoablage nicht erreichbar.");
    }
    await this.echt.update(user, tx);
  }
  async delete(id: string, tx?: TxContext): Promise<void> {
    this.loeschversuche += 1;
    if (this.stoereLoeschen) {
      throw new Error("Kontoablage nicht erreichbar (Löschen).");
    }
    await this.echt.delete(id, tx);
  }
  withAdminGuard<T>(fn: (tx?: TxContext) => Promise<T>): Promise<T> {
    return this.echt.withAdminGuard(fn);
  }
  listAdminsForGuard(tx?: TxContext): Promise<User[]> {
    return this.echt.listAdminsForGuard(tx);
  }
  tryClaimBootstrapAdmin(user: User): Promise<boolean> {
    return this.echt.tryClaimBootstrapAdmin(user);
  }
}

/**
 * JOB 4011 R4: EIN PRÜFPROTOKOLL, DAS AUF ANSAGE NICHT ANNIMMT.
 *
 * BENs Schnitt aus Runde 3 liegt nicht am Schreiben des Kontos, sondern am Vermerk DANACH: das
 * Konto war freigegeben, `record` warf, die Rücknahme scheiterte — und ein anmeldbarer Rest blieb.
 * Ohne eine Störung an dieser Stelle ist der Fall nicht messbar.
 *
 * GESTÖRT WIRD DIE EINE STELLE, AN DER DER DIENST DAS PROTOKOLL BENUTZT (`AuditService.record`),
 * und zwar an der Instanz aus `baueKreis`. Ein zweiter Kreis mit einer eigenen Protokollablage
 * daneben wäre der teurere Weg — `tests/demo-zugang-gaeste/aufbau.ts` reicht das Protokoll nicht
 * durch und ist kein Zielpfad dieses Auftrags, und zwei Aufbauten über denselben Weg sind zwei
 * Aussagen, die nur heute übereinstimmen (s. Kopf von `draht.ts`).
 */
function stoerePruefprotokoll(k: Kreis, trifft: (action: string) => boolean): void {
  const echt = k.audit.record.bind(k.audit);
  k.audit.record = async (eintrag, tx) => {
    if (trifft(eintrag.action)) {
      throw new Error("Prüfprotokoll nicht erreichbar.");
    }
    return echt(eintrag, tx);
  };
}

/** Die Fehlerzeile dieses Aufrufs aus dem Laufzeitprotokoll des Servers. */
function anlagezeile(zeilen: Record<string, unknown>[]): Record<string, unknown> {
  const treffer = zeilen.filter((z) => String(z.msg ?? "").startsWith("JOB 4011:"));
  expect(treffer.length, `Laufzeitzeilen: ${JSON.stringify(zeilen)}`).toBe(1);
  return treffer[0] as Record<string, unknown>;
}

/** Der Anlageweg, wörtlich über HTTP. */
function anlegen(
  app: FastifyInstance,
  sitzung: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}` },
    payload: body,
  });
}

/** Die ganze Nutzerliste, so wie ein Mensch sie sieht — nicht die Antwort von eben. */
async function liste(app: FastifyInstance, sitzung: string): Promise<PublicUser[]> {
  const antwort = await app.inject({
    method: "GET",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}` },
  });
  expect(antwort.statusCode, `GET /api/users: ${antwort.body}`).toBe(200);
  return antwort.json() as PublicUser[];
}

describe("JOB 4011 R2 · befristet oder gar nicht — auch bei Schreibfehlern", () => {
  it("G7 — das Befristungsschreiben scheitert: 500, und es bleibt KEIN Konto zurück", async () => {
    // BENs F1, gegen den reparierten Weg. Vorher: Konto vorhanden, freigegeben, unbefristet,
    // Anmeldung 200. Jetzt: der Aufruf nimmt zurück, was er angelegt hat.
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const vorher = await liste(app, sitzung);
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    ablage.stoereSchreiben = (u) => u.email === NEU;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: ablauf,
    });

    // Der Schreibfehler ist kein AuthError — der Admin bekommt ehrlich einen Serverfehler und
    // nicht etwa eine 201, die einen Zustand behauptet, den niemand hergestellt hat.
    expect(antwort.statusCode, antwort.body).toBe(500);
    expect(antwort.json().message).toBe(MELDUNGEN.INTERNAL.de);

    const nachher = await liste(app, sitzung);
    expect(
      nachher.find((u) => u.email === NEU),
      "ein Konto ist zurückgeblieben",
    ).toBeUndefined();
    expect(nachher.map((u) => u.email).sort()).toEqual(vorher.map((u) => u.email).sort());
    // Und der entscheidende Beleg ist nicht die Liste, sondern die Tür: niemand kommt herein.
    expect((await anmelden(app, NEU)).statusCode).not.toBe(200);
    // JOB 4011 R4 — HIER STAND BIS RUNDE 3 `toEqual([])`, UND DIE ÄNDERUNG IST BEABSICHTIGT.
    //
    // Seit R4 steht der Vermerk VOR dem Schreiben (s. `service.setAccessExpiry`), also entsteht er
    // auch dann, wenn das Schreiben danach scheitert. Das ist die Kehrseite der Reihenfolge, die
    // die Tür zuhält, und sie wird hier benannt statt verschwiegen: das Prüfprotokoll trägt einen
    // Schritt, dessen Wirkung ausblieb — unmittelbar gefolgt vom `user.delete` desselben Aufrufs,
    // der sagt, dass das Konto wieder weg ist. Die umgekehrte Reihenfolge wäre die teurere: sie
    // liesse einen geschriebenen Zustand ohne Nachweis zurück (mega62 Block B, dieselbe Abwägung).
    expect(await k.audit.list({ action: "user.access-expiry-set" })).toHaveLength(1);
    // Die Rücknahme geht über `deleteUser` und hinterlässt ihren eigenen Vermerk: ein Konto, das
    // es kurz gab, verschwindet nicht lautlos aus dem Prüfpfad.
    expect(await k.audit.list({ action: "user.delete" })).toHaveLength(1);
  });

  it("G7b — scheitert auch die Rücknahme, bleibt ein UNFREIGEGEBENES Konto zurück", async () => {
    // DIE EHRLICHE GRENZE. Ohne gemeinsame Transaktion (s. Kopf) kann die Rücknahme selbst
    // scheitern. Dann steht ein Rest da — aber einer, der gesperrt ist, weil die Freigabe der
    // LETZTE Schritt ist und nie stattgefunden hat. Dieser Fall hält die schwächere Zusage fest,
    // damit niemand die starke liest, wo sie nicht gilt.
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    ablage.stoereSchreiben = (u) => u.email === NEU;
    ablage.stoereLoeschen = true;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: ablauf,
    });

    // Der ursprüngliche Fehler kommt an, nicht der des Aufräumens.
    expect(antwort.statusCode, antwort.body).toBe(500);
    expect(ablage.loeschversuche).toBe(1);

    const rest = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(rest, "der Rest muss sichtbar sein, sonst misst dieser Fall nichts").toBeDefined();
    expect(rest?.approved).toBe(false);
    expect(rest?.accessExpiresAt).toBeUndefined();
    // UND DAS IST DER PUNKT: unbefristet UND unfreigegeben ist kein offener Zugang.
    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
  });

  it("G7c — scheitert die Freigabe (der letzte Schritt), bleibt ebenfalls nichts zurück", async () => {
    // Die Gegenrichtung zu G7: nicht nur der Befristungsschritt wird zurückgenommen, sondern jeder
    // Schritt nach `register`. Gestört wird hier gezielt das Schreiben, das freigibt.
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    ablage.stoereSchreiben = (u) => u.email === NEU && u.approved;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(500);
    expect((await liste(app, sitzung)).find((u) => u.email === NEU)).toBeUndefined();
    expect((await anmelden(app, NEU)).statusCode).not.toBe(200);
  });

  it("G7d — Freigabeschreiben UND Rücknahme scheitern: der Rest ist UNFREIGEGEBEN und kommt nicht herein", async () => {
    // BENs Gegenprobe aus Runde 2, wörtlich nachgestellt. Vorher:
    //     {"post":500,"vorhanden":true,"approved":true,"accessExpiresAt":"…","login":200}
    // Der Aufruf meldete einen Fehler und hinterliess einen anmeldbaren Zugang — also genau das,
    // wogegen dieser Auftrag gebaut ist, nur über den Umweg zweier Schreibfehler.
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    ablage.stoereSchreiben = (u) => u.email === NEU && u.approved;
    ablage.stoereLoeschen = true;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(500);
    expect(ablage.loeschversuche).toBe(1);

    // WAS WIRKLICH ZURÜCKBLEIBT, vollständig benannt statt beschönigt: das Konto ist da, es trägt
    // seine Rolle und sein Ende — die beiden Schreibvorgänge davor sind ja durchgekommen —, und
    // NICHT freigegeben ist es. Die schwächere Zusage, und diesmal eine wahre.
    const rest = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(rest, "der Rest muss sichtbar sein, sonst misst dieser Fall nichts").toBeDefined();
    expect(rest?.approved, "BENs Befund: hier stand `true`").toBe(false);
    expect(rest?.role).toBe("controller");
    expect(rest?.accessExpiresAt).toBe(ablauf);

    // UND DAS IST DER EIGENTLICHE BELEG — die Tür, nicht das Feld. BEN mass hier 200.
    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
    // JOB 4011 R4: der Vermerk der Freigabe steht jetzt VOR ihrem Schreiben, also steht er da,
    // obwohl das Schreiben scheiterte (Runde 3 erwartete hier 0). Was zählt, ist die Zeile darüber:
    // die Tür blieb zu. Ein Vermerk ohne Wirkung ist im Prüfprotokoll nachlesbar; eine Wirkung ohne
    // Vermerk wäre ein offener Zugang, den niemand veranlasst hat — s. G7g.
    expect(await vorgaenge(k, "user.approve", rest?.id ?? "")).toBe(1);
  });

  it("G7e — die Ursache, am Dienst gemessen: ein gescheitertes Freigabeschreiben ändert nichts", async () => {
    // G7d misst die Wirkung am HTTP-Weg, dieser Fall die Ursache eine Ebene tiefer — sonst hinge
    // die Zusage an der Reihenfolge im Anlageweg, statt an der Stelle zu liegen, an der sie gilt.
    // `approveUser` schrieb bis Runde 2 zuerst am gehaltenen Konto und versuchte danach zu
    // speichern; der Fall hier fällt genau dann.
    //
    // ER GILT ÜBER DIE SPEICHERFASSUNG HINAUS, und das ist der Grund, ihn so zu schneiden: gemessen
    // wird nicht „die Map wurde nicht verändert", sondern „das Konto, das die Ablage herausgibt,
    // ist unverändert". Für `PgUserRepo` ist das ohnehin wahr (eine frisch abgebildete Zeile, ein
    // gescheitertes UPDATE schreibt nichts) — der Dienst darf diese Zusage nur nicht selbst
    // unterlaufen. Was ECHTES PostgreSQL mit einem abgebrochenen UPDATE macht, ist hier NICHT
    // gemessen; dafür gibt es im Haus keinen Integrationslauf (s. `pg-rundlauf-ablaufspalte`).
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    const { admin } = await adminUndGast(k);
    const neu = await k.service.register({
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
    });
    expect(neu.approved).toBe(false);
    ablage.stoereSchreiben = (u) => u.id === neu.id;

    await expect(k.service.approveUser(neu.id, admin.id)).rejects.toThrow(
      "Kontoablage nicht erreichbar.",
    );

    // Das Konto, wie die Ablage es herausgibt — nicht die Antwort des Dienstes, die es gar nicht
    // gab. Vor der Reparatur stand hier `true`.
    expect((await ablage.findById(neu.id))?.approved).toBe(false);
    // JOB 4011 R4: der Vermerk steht seit dieser Runde VOR dem Schreiben und ist deshalb da, obwohl
    // das Schreiben scheiterte (Runde 3 erwartete 0). Dieselbe Kehrseite wie in G7/G7d, aus
    // demselben Grund: lieber ein nachlesbarer Vermerk ohne Wirkung als eine Freigabe ohne Vermerk.
    expect(await vorgaenge(k, "user.approve", neu.id)).toBe(1);

    // Die Ablage antwortet wieder — und trotzdem kommt niemand herein. Das schliesst aus, dass der
    // Fall nur die störende Ablage misst statt des Zustands, den sie hält.
    ablage.stoereSchreiben = undefined;
    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
  });

  it("G7f — Rollenschreiben UND Rücknahme scheitern: ebenfalls kein anmeldbarer Rest", async () => {
    // Der dritte und letzte Schritt nach `register` — und der Fall, der die Reparatur der Runde 3
    // von einer Einzelstelle zu einer Regel gemacht hat. Gegen das reparierte `approveUser` allein
    // war er ROT: `changeRole` trug DASSELBE Muster (`user.role = role` am gehaltenen Konto, dann
    // erst schreiben), und der Rest stand danach mit der Rolle `controller` da, die nie geschrieben
    // wurde. An der Rolle hängt keine Tür — die Anmeldung war in keiner Fassung offen —, aber der
    // Bestand log, und zwar je nach Ablage verschieden.
    //
    // GEMESSEN WIRD DESHALB BEIDES: dass niemand hereinkommt (die Zusage) und WELCHE Rolle der Rest
    // trägt (die Wahrheit über ihn).
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    ablage.stoereSchreiben = (u) => u.email === NEU && u.role === "controller";
    ablage.stoereLoeschen = true;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(500);
    expect(ablage.loeschversuche).toBe(1);

    const rest = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(rest, "der Rest muss sichtbar sein, sonst misst dieser Fall nichts").toBeDefined();
    expect(rest?.approved).toBe(false);
    // Die Rolle aus `register`, nicht die bestellte: ihr Schreiben ist ja gescheitert.
    expect(rest?.role).toBe("experte");
    expect(rest?.accessExpiresAt).toBe(ablauf);

    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
  });

  it("G7g — der VERMERK der Freigabe scheitert und die Rücknahme auch: der Rest kommt nicht herein", async () => {
    // ============================================================================================
    // BENs SCHNITT AUS RUNDE 3, WÖRTLICH. Gestört ist diesmal NICHT das Kontoschreiben, sondern
    // der Vermerk danach:
    //
    //     BEN R3 REST: 500 · Konto vorhanden · approved: true · ANMELDUNG offen
    //
    // Runde 3 schrieb `approved` und vermerkte danach; warf der Vermerk und scheiterte auch die
    // Rücknahme, stand wieder der freigegebene, anmeldbare Rest da. Seit R4 steht der Vermerk vor
    // dem Schreiben — scheitert er, ist nichts geschrieben, und nach dem Schreiben kann nichts
    // mehr scheitern, was die Tür offen liesse.
    // ============================================================================================
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    // Beide Schritte davor laufen durch — das ist der Punkt: das Konto ist fertig bis auf die
    // Freigabe, und genau an ihr bricht es.
    stoerePruefprotokoll(k, (action) => action === "user.approve");
    ablage.stoereLoeschen = true;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(500);
    expect(ablage.loeschversuche).toBe(1);

    const rest = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(rest, "der Rest muss sichtbar sein, sonst misst dieser Fall nichts").toBeDefined();
    expect(rest?.approved, "BEN R3 mass hier `true`").toBe(false);
    // Rolle und Ende sind da — ihre Schritte sind ja durchgelaufen. Der Rest wird vollständig
    // benannt und nicht auf die eine Zusage verkürzt.
    expect(rest?.role).toBe("controller");
    expect(rest?.accessExpiresAt).toBe(ablauf);

    // DER BELEG IST DIE TÜR, NICHT DAS FELD. BEN mass hier 200.
    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
    // Und der Vermerk, dessen Scheitern der ganze Fall ist, steht auch nicht da.
    expect(await vorgaenge(k, "user.approve", rest?.id ?? "")).toBe(0);
  });

  it("G7h — derselbe Schnitt am Befristungsvermerk: nichts geschrieben, nichts offen", async () => {
    // BEN, Prüflücke 6 der Runde 3: „Derselbe Fehlerschnitt sollte für Rolle und Befristung
    // geprüft werden, weil auch diese Methoden erst schreiben und danach auditieren." Sie tun es
    // seit R4 nicht mehr — gemessen hier und in G7i, nicht behauptet.
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    stoerePruefprotokoll(k, (action) => action === "user.access-expiry-set");
    ablage.stoereLoeschen = true;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(500);
    const rest = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(rest, "der Rest muss sichtbar sein, sonst misst dieser Fall nichts").toBeDefined();
    // Der Vermerk scheiterte VOR dem Schreiben: das Ende steht nicht am Konto, und weil der Aufruf
    // an dieser Stelle abbricht, auch die Rolle nicht.
    expect(rest?.accessExpiresAt).toBeUndefined();
    expect(rest?.role).toBe("experte");
    expect(rest?.approved).toBe(false);
    expect(await vorgaenge(k, "user.access-expiry-set", rest?.id ?? "")).toBe(0);

    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
  });

  it("G7i — derselbe Schnitt am Rollenvermerk: die Rolle bleibt die von `register`", async () => {
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();
    stoerePruefprotokoll(k, (action) => action === "user.role-change");
    ablage.stoereLoeschen = true;

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(500);
    const rest = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(rest, "der Rest muss sichtbar sein, sonst misst dieser Fall nichts").toBeDefined();
    // Der Schritt davor ist durch (Ende steht, mit Vermerk), der Rollenschritt nicht.
    expect(rest?.accessExpiresAt).toBe(ablauf);
    expect(await vorgaenge(k, "user.access-expiry-set", rest?.id ?? "")).toBe(1);
    expect(rest?.role).toBe("experte");
    expect(await vorgaenge(k, "user.role-change", rest?.id ?? "")).toBe(0);
    expect(rest?.approved).toBe(false);

    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
  });

  it("G7j — die Laufzeitzeile über den Rest ist GEMESSEN: drei Lagen, drei Sätze", async () => {
    // ============================================================================================
    // BENs KORREKTURPFLICHT 2 der Runde 3: „`freigabeDurchgelaufen` und Meldung in `routes.ts` nur
    // aus einem tatsächlich gemessenen Zustand ableiten. Erwarteter Beleg: Test des
    // Protokollinhalts."
    //
    // Runde 3 schrieb eine Konstante (`freigabeDurchgelaufen: false`) und nannte sie einen Befund.
    // Dieser Fall stellt DREI verschiedene Bestände her und liest jedes Mal die Zeile, die der
    // Server wirklich schreibt. Eine hergeleitete Zeile bestünde Lage 1 und fiele bei Lage 2.
    // ============================================================================================

    // LAGE 1 — unfreigegebener Rest (die Lage von G7g).
    {
      const ablage = new StoerendeNutzerablage();
      const zeilen: Record<string, unknown>[] = [];
      const { k, app } = await baueDraht({ users: ablage, protokoll: (z) => zeilen.push(z) });
      await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");
      stoerePruefprotokoll(k, (action) => action === "user.approve");
      ablage.stoereLoeschen = true;

      const antwort = await anlegen(app, sitzung, {
        name: "Interessent",
        email: NEU,
        password: GAST_PASSWORT,
      });
      expect(antwort.statusCode, antwort.body).toBe(500);

      const zeile = anlagezeile(zeilen);
      expect(zeile.restVorhanden).toBe(true);
      expect(zeile.restFreigegeben).toBe(false);
      expect(String(zeile.msg)).toContain("nicht freigegeben");
    }

    // LAGE 2 — DIE PROBE: ein FREIGEGEBENER Rest. Über den Anlageweg ist er seit R4 nicht mehr
    // herstellbar, deshalb schreibt ihn hier ein fremder Schreiber an Dienst und Störung vorbei,
    // genau in dem Augenblick, in dem der Vermerk scheitert. Leitete die Zeile ihren Inhalt aus
    // dem Ablauf des Aufrufs her, stünde jetzt „nicht freigegeben" da — und das wäre die Unwahrheit,
    // die BEN in Runde 3 gemessen hat.
    {
      const ablage = new StoerendeNutzerablage();
      const zeilen: Record<string, unknown>[] = [];
      const { k, app } = await baueDraht({ users: ablage, protokoll: (z) => zeilen.push(z) });
      await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");
      ablage.stoereLoeschen = true;
      const echt = k.audit.record.bind(k.audit);
      k.audit.record = async (eintrag, tx) => {
        if (eintrag.action === "user.approve") {
          const konto = await ablage.findById(eintrag.target);
          if (konto) {
            await ablage.schreibeDirekt({ ...konto, approved: true });
          }
          throw new Error("Prüfprotokoll nicht erreichbar.");
        }
        return echt(eintrag, tx);
      };

      const antwort = await anlegen(app, sitzung, {
        name: "Interessent",
        email: NEU,
        password: GAST_PASSWORT,
      });
      expect(antwort.statusCode, antwort.body).toBe(500);

      const zeile = anlagezeile(zeilen);
      expect(zeile.restVorhanden).toBe(true);
      expect(zeile.restFreigegeben, "die Zeile muss den Bestand lesen, nicht sich selbst").toBe(
        true,
      );
      expect(String(zeile.msg)).toContain("FREIGEGEBENES Konto");
      // UND SIE SAGT DIE WAHRHEIT: dieser Rest kommt wirklich herein. Der Satz ist ein Alarm, kein
      // Schmuck — ohne ihn stünde in der Betriebsmeldung eine Entwarnung für einen offenen Zugang.
      expect((await anmelden(app, NEU)).statusCode).toBe(200);
    }

    // LAGE 3 — die Ablage antwortet auch beim Lesen nicht mehr. Dann weiss dieser Aufruf nichts
    // über den Rest, und die Zeile gibt weder Entwarnung noch Alarm.
    {
      const ablage = new StoerendeNutzerablage();
      const zeilen: Record<string, unknown>[] = [];
      const { k, app } = await baueDraht({ users: ablage, protokoll: (z) => zeilen.push(z) });
      await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");
      stoerePruefprotokoll(k, (action) => action === "user.approve");
      ablage.stoereLoeschen = true;
      ablage.stoereListe = true;

      const antwort = await anlegen(app, sitzung, {
        name: "Interessent",
        email: NEU,
        password: GAST_PASSWORT,
      });
      expect(antwort.statusCode, antwort.body).toBe(500);

      const zeile = anlagezeile(zeilen);
      expect(zeile.restVorhanden).toBe("unbekannt");
      expect(zeile.restFreigegeben).toBe("unbekannt");
      expect(String(zeile.msg)).toContain("nicht mehr messbar");
    }
  });

  it("G8 — während des Befristungsschreibens ist der Gast gesperrt, danach kommt er herein", async () => {
    // BENs F2: eine ECHTE Anmeldung mitten im Schreiben, nicht eine Annahme über die Reihenfolge.
    // Vor der Reparatur antwortete sie an dieser Stelle 200 — das Konto war freigegeben und trug
    // sein Ende noch nicht.
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    const zwischenstaende: number[] = [];
    ablage.beobachteSchreiben = async (u) => {
      if (u.email !== NEU) {
        return;
      }
      zwischenstaende.push((await anmelden(app, NEU)).statusCode);
    };

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: ablauf,
    });
    expect(antwort.statusCode, antwort.body).toBe(201);
    expect(antwort.json().accessExpiresAt).toBe(ablauf);

    // Zwei Schreibschritte am neuen Konto: die Befristung, dann die Freigabe.
    expect(zwischenstaende.length, `Zwischenstände: ${zwischenstaende.join(", ")}`).toBe(2);
    // DER ERSTE IST DER GEMESSENE FALL. Mitten im Befristungsschreiben ist zu — genau das Fenster,
    // das BEN offen fand.
    expect(zwischenstaende[0], `Zwischenstände: ${zwischenstaende.join(", ")}`).toBe(403);
    // DER ZWEITE WIRD SEIT JOB 4011 R3 EBENFALLS GEPINNT, und dass das jetzt geht, ist der ganze
    // Unterschied dieser Runde. Er fällt auf den Freigabeschritt — den einzigen, der aufsperrt.
    // Runde 2 liess ihn ausdrücklich offen, weil die Antwort an der Ablage hing: die
    // Speicherfassung setzte `approved` am gehaltenen Objekt, BEVOR `update` gerufen wurde
    // (`approveUser`), eine Datenbank erst mit dem Schreiben. Dieser Unterschied ist behoben —
    // `approveUser` schreibt eine Kopie —, und damit ist der Zustand während des Freigabeschreibens
    // in BEIDEN Ablagen derselbe: noch zu. Ein offener Zwischenstand wäre wieder BENs F2.
    expect(zwischenstaende[1], `Zwischenstände: ${zwischenstaende.join(", ")}`).toBe(403);
    //
    // DIE KALIBRIERUNG: ein Weg, der einfach nie freigibt, bestünde alles darüber. Nach dem
    // Aufruf muss der Gast wirklich hereinkommen.
    expect((await anmelden(app, NEU)).statusCode).toBe(200);
  });

  it("G8b — dasselbe mit einem Datum in der Vergangenheit: in keinem Moment offen", async () => {
    // BENs F2 wörtlich, und DIESER Fall trägt die volle Zusage: bestellt war ein Gast, der bereits
    // abgelaufen ist. Vor der Reparatur antwortete die Anmeldung mitten im Vorgang 200 und erst
    // danach 403 — ein Fenster, in dem genau der Mensch hereinkam, den der Admin gerade aussperren
    // wollte. Jetzt ist KEIN Moment dieses Aufrufs offen: davor, weil noch nicht freigegeben ist;
    // beim Freigeben, weil das Ende dann schon am Konto steht.
    const ablage = new StoerendeNutzerablage();
    const { k, app } = await baueDraht({ users: ablage });
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const vergangen = new Date(k.jetzt() - STUNDE).toISOString();

    const zwischenstaende: number[] = [];
    ablage.beobachteSchreiben = async (u) => {
      if (u.email !== NEU) {
        return;
      }
      zwischenstaende.push((await anmelden(app, NEU)).statusCode);
    };

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: vergangen,
    });
    expect(antwort.statusCode, antwort.body).toBe(201);

    expect(zwischenstaende, `Zwischenstände: ${zwischenstaende.join(", ")}`).toEqual([403, 403]);
    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().message).toBe(MELDUNGEN.ACCESS_EXPIRED.de);
  });
});
