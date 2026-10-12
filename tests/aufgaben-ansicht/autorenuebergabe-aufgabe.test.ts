import { describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG (R-0961, K1–K3) — DIE WARTENDE AUTORENÜBERGABE AM HTTP-RAND.
// ================================================================================================
//
// Quelle der Regel: Peters Entscheidungen 23/24 vom 11.10.2026 und Entscheidung 1 vom 12.10.2026,
// abgebildet in `apps/web/src/lib/autorenuebergabe.ts`. Gemessen wird über HTTP, mit der Anmeldung
// der Person, für die der Schritt gilt. Dienstaufrufe legen nur Wissensobjekte und Prüfaufgaben an
// (in A12 auch eine erledigte), lesen Belege nach und stellen in A10/A11 die bloße Sperre her
// (Verzeichnisweg, ohne Status).
//
//   A1  Auslöser „Konto gelöscht": Der Autor wird gelöscht, und die Übergabe steht an.
//   A2  Gegenfall: Eine abgelaufene Zugangsbefristung allein löst nichts aus (kein belegtes
//       Ausscheiden, Ben Nacharbeit 9). Der befugte Antrag bleibt möglich.
//   A3  Auslöser „angefordert": Der Autor verlangt die Übergabe, und sie steht an.
//   A4  Wer verlangen darf: Autor und Admin ja, ein fremder Experte 403.
//   A5  Wem sie angezeigt wird: nur Admins (Liste und Zahl 403 für Experten).
//   A6  Priorität: „kritisch" nur, wenn das Bereichsprofil die Kritikalität „hoch" trägt.
//   A7  Abschluss: Nach der vorhandenen Übergabe (`transfer-author`, Audit
//       `ko.author-transferred`) verschwindet die Aufgabe; Liste und Zahl stimmen in jedem Schritt.
//   A8  Gegenfall: Eine gescheiterte Übergabe (Versuch ohne Admin-Recht, 403) lässt sie stehen.
//   A9  Auslöser „Ausgeschieden“: Der Admin setzt den Status mit Vertretung. Zugang und Sitzung
//       sind entzogen, die Urheberschaft bleibt, die offene Prüfaufgabe liegt bei der Vertretung,
//       die Übergabe steht an und ist nach `transfer-author` erledigt.
//   A10 Gegenfälle: ohne Berechtigung (403/401), ohne gültige Vertretung (400), bloße Sperre ohne
//       Status ⇒ kein Ausscheiden, keine Aufgabe.
//   A11 Ausscheiden → Wiederfreigabe (beendet den Status mit Vermerk) → gewöhnliche Sperre ⇒ der
//       Status lebt nicht wieder auf, keine Aufgabe.
//   A12 Vertretung hat das Objekt schon geprüft ⇒ 409 ohne Nebenwirkung; mit geeigneter
//       Vertretung 200, die Prüfaufgabe liegt danach bei ihr.
//   A13 Teilfehler der Übertragung (injizierter Schreibfehler) ⇒ 409, kein Status, Sitzung gilt,
//       Rest bei der Person; Wiederholung überträgt nur den Rest, 200, ohne Doppel.
describe("R-0961: wartende Autorenübergabe — Auslöser, Berechtigung, Priorität, Abschluss", () => {
  async function setup() {
    // Dieselbe Komposition wie `buildServices()`. Die Ablage wird nur gebraucht für die bereits
    // erledigte Prüfung der Vertretung (A12) und für eine offene Lücke samt Schreibfehler (A13).
    const repos = inMemoryRepos();
    const services = assembleServices(repos);
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@x.de", password: "secret123" },
    });
    const anmelden = async (email: string) => {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "secret123" },
      });
      return {
        headers: { authorization: `Bearer ${login.json().token}` },
        id: login.json().user.id as string,
      };
    };
    const ada = await anmelden("ada@x.de");
    const konto = async (name: string, email: string) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: ada.headers,
        payload: { name, email, password: "secret123", role: "experte" },
      });
      expect(res.statusCode, res.body).toBeLessThan(300);
      return anmelden(email);
    };
    const anna = await konto("Anna Autorin", "anna@x.de");
    const bert = await konto("Bert Autor", "bert@x.de");
    const eintrag = async (author: string, category: string) => {
      const ko = await services.ko.create({
        title: `Eintrag von ${author}`,
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category,
        author,
        tags: [],
      });
      return ko.id;
    };
    const lesen = (url: string, headers: Record<string, string>) =>
      app.inject({ method: "GET", url, headers });
    /** Liste UND Zahl als Admin — und die Zusage, dass beide dasselbe sagen. */
    const anstehend = async () => {
      const liste = await lesen("/api/me/author-transfers", ada.headers);
      expect(liste.statusCode, liste.body).toBe(200);
      const zahl = await lesen("/api/me/author-transfers/summary", ada.headers);
      expect(zahl.statusCode, zahl.body).toBe(200);
      const zeilen = liste.json() as { koId: string; grund: string; kritisch: boolean }[];
      expect(zahl.json(), "Liste und Zahl der Autorenübergaben weichen ab").toEqual({
        open: zeilen.length,
      });
      return zeilen;
    };
    const aktion = (koId: string, headers: Record<string, string>, payload: object) =>
      app.inject({ method: "PUT", url: `/api/kos/${koId}`, headers, payload });
    return { app, repos, services, ada, anna, bert, eintrag, lesen, anstehend, aktion };
  }

  it("Kalibrierung: ohne Auslöser steht keine Übergabe an", async () => {
    const { anna, eintrag, anstehend } = await setup();
    await eintrag(anna.id, "Instandhaltung");
    expect(await anstehend()).toEqual([]);
  });

  // Seit `produkt:20261007:ownership-uebergabe` (verantwortung-routes.ts, `kontoendeSperre`) lässt
  // die Kontoverwaltung ein Konto nicht mehr löschen oder befristen, solange es noch Beiträge
  // verantwortet (409 `BESTAND_OFFEN`). Der Auslöser bleibt trotzdem nötig: für Beiträge, deren
  // Konto schon fehlte, als sie entstanden (Altbestand, Import). In dieser Reihenfolge stellen A1
  // und A2 den Zustand her, über die echten Kontowege und ohne den Schutz zu umgehen.
  it("A1 · Konto des Autors gelöscht ⇒ Übergabe steht an; A7 · Übergabe ⇒ verschwindet", async () => {
    const { app, services, ada, anna, bert, eintrag, anstehend, aktion } = await setup();
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/users/${bert.id}`,
      headers: ada.headers,
    });
    expect(geloescht.statusCode, geloescht.body).toBe(204);
    // Ein Beitrag, dessen Autor kein Konto mehr hat (Altbestand).
    const k = await eintrag(bert.id, "Instandhaltung");
    expect(await anstehend()).toEqual([{ koId: k, grund: "konto-geloescht", kritisch: false }]);

    // Die vorhandene Admin-Handlung, unverändert: neuer Autor, Audit `ko.author-transferred`.
    const uebergabe = await aktion(k, ada.headers, {
      action: "transfer-author",
      newAuthor: anna.id,
    });
    expect(uebergabe.statusCode, uebergabe.body).toBe(200);
    expect(uebergabe.json().author).toBe(anna.id);
    expect(uebergabe.json().originalAuthor).toBe(bert.id);
    const belege = await services.audit.list({ action: "ko.author-transferred", target: k });
    expect(belege).toHaveLength(1);
    expect(await anstehend(), "die erledigte Übergabe steht noch an").toEqual([]);
  });

  // Ben, Nacharbeit 9: Ein abgelaufener Zugang ist eine aufhebbare Befristung und kein belegtes
  // „dauerhaft ausgeschieden" (Frage 24). Allein löst er deshalb nichts aus. Welcher Zustand als
  // Ausscheiden gilt, ist an Pedi gefragt; der Gegenfall dazu entsteht erst mit der Antwort.
  it("A2 · Gegenfall: bloße Zugangsbefristung (abgelaufen) ⇒ keine Übergabe; Antrag bleibt möglich", async () => {
    const { app, ada, anna, eintrag, anstehend, aktion } = await setup();
    // Die Befristung steht VOR dem Beitrag (s. Kommentar über A1) und ist inzwischen abgelaufen.
    const abgelaufen = await app.inject({
      method: "PUT",
      url: `/api/users/${anna.id}`,
      headers: ada.headers,
      payload: { accessExpiresAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(abgelaufen.statusCode, abgelaufen.body).toBeLessThan(300);
    const k = await eintrag(anna.id, "Instandhaltung");
    expect(await anstehend(), "eine bloße Zugangsbefristung hat eine Übergabe ausgelöst").toEqual(
      [],
    );

    // Der befugte Antrag bleibt der Weg für diesen Autor.
    const antrag = await aktion(k, ada.headers, { action: "request-author-transfer" });
    expect(antrag.statusCode, antrag.body).toBe(200);
    expect(await anstehend()).toEqual([{ koId: k, grund: "angefordert", kritisch: false }]);
  });

  // Peters Entscheidung 1 vom 12.10.2026: ein eigener Status „Ausgeschieden“, ausdrücklich durch
  // einen Berechtigten gesetzt. Zugang und Sitzungen werden entzogen, die Urheberschaft bleibt, und
  // eine Vertretung übernimmt die offenen Aufgaben.
  it("A9 · Status „Ausgeschieden“ ⇒ Zugang/Sitzung weg, Urheberschaft bleibt, Vertretung übernimmt, Übergabe steht an; A7 · Übergabe ⇒ erledigt", async () => {
    const { app, services, ada, anna, bert, eintrag, anstehend, aktion } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    // Eine offene Aufgabe bei Anna: eine Prüfaufgabe an einem fremden Objekt.
    const pruefobjekt = await eintrag(ada.id, "Instandhaltung");
    await services.validation.assign(pruefobjekt, [anna.id], ada.id);
    const offenVorher = await services.wissensuebergabe.offeneVorgaenge([anna.id]);
    expect(offenVorher.get(anna.id)?.pruefaufgaben).toEqual([{ koId: pruefobjekt }]);
    expect(await anstehend(), "vor dem Ausscheiden steht nichts an").toEqual([]);

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${anna.id}/ausscheiden`,
      headers: ada.headers,
      payload: { vertretung: bert.id },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ id: anna.id, approved: false, vertretung: bert.id });

    // Der Status ist ausdrücklich vermerkt: wer, an wem, mit welcher Vertretung.
    const vermerke = await services.audit.list({ action: "user.ausgeschieden", target: anna.id });
    expect(vermerke).toHaveLength(1);
    expect(vermerke[0]?.actor).toBe(ada.id);
    expect(vermerke[0]?.payload).toEqual({ vertretung: bert.id });

    // Zugang und Sitzungen entzogen: die alte Sitzung gilt nicht mehr, eine neue entsteht nicht.
    const sitzung = await app.inject({ method: "GET", url: "/api/auth/me", headers: anna.headers });
    expect(sitzung.statusCode, "die Sitzung der Ausgeschiedenen gilt noch").toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@x.de", password: "secret123" },
    });
    expect(login.statusCode, "die Ausgeschiedene kann sich noch anmelden").not.toBe(200);

    // Urheberschaft erhalten: das Konto besteht, das Objekt trägt Anna weiter als Autorin.
    expect((await services.auth.listUsers()).some((u) => u.id === anna.id)).toBe(true);
    const objekt = await services.ko.get(k);
    expect(objekt?.author).toBe(anna.id);
    expect(objekt?.originalAuthor).toBe(anna.id);

    // Die Vertretung hat die offene Aufgabe übernommen.
    const offenNachher = await services.wissensuebergabe.offeneVorgaenge([anna.id, bert.id]);
    expect(offenNachher.get(anna.id)?.pruefaufgaben).toEqual([]);
    expect(offenNachher.get(bert.id)?.pruefaufgaben).toEqual([{ koId: pruefobjekt }]);

    // Die wartende Autorenübergabe steht an; Liste und Zahl stimmen (`anstehend`).
    expect(await anstehend()).toEqual([{ koId: k, grund: "ausgeschieden", kritisch: false }]);

    // Abschluss über die vorhandene Admin-Handlung, unverändert.
    const uebergabe = await aktion(k, ada.headers, {
      action: "transfer-author",
      newAuthor: bert.id,
    });
    expect(uebergabe.statusCode, uebergabe.body).toBe(200);
    expect(uebergabe.json().author).toBe(bert.id);
    expect(uebergabe.json().originalAuthor).toBe(anna.id);
    const belege = await services.audit.list({ action: "ko.author-transferred", target: k });
    expect(belege).toHaveLength(1);
    expect(await anstehend(), "die erledigte Übergabe steht noch an").toEqual([]);
  });

  it("A10 · Gegenfälle: kein Berechtigter, ungültige Vertretung, bloße Sperre ⇒ kein Ausscheiden", async () => {
    const { app, services, ada, anna, bert, eintrag, anstehend } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    const ausscheiden = (headers: Record<string, string>, payload: object) =>
      app.inject({
        method: "POST",
        url: `/api/users/${anna.id}/ausscheiden`,
        headers,
        payload,
      });
    const vermerke = () => services.audit.list({ action: "user.ausgeschieden", target: anna.id });

    // Ohne `users.manage` (ein Experte) — 403, nichts vermerkt, Annas Sitzung gilt weiter.
    const fremd = await ausscheiden(bert.headers, { vertretung: bert.id });
    expect(fremd.statusCode).toBe(403);
    // Ohne Anmeldung — 401.
    const ohne = await app.inject({
      method: "POST",
      url: `/api/users/${anna.id}/ausscheiden`,
      payload: { vertretung: bert.id },
    });
    expect(ohne.statusCode).toBe(401);
    // Keine, dieselbe oder eine unbekannte Vertretung — 400, nichts vermerkt.
    for (const vertretung of [undefined, anna.id, "gibt-es-nicht"]) {
      const res = await ausscheiden(ada.headers, { vertretung });
      expect(res.statusCode, `Vertretung ${String(vertretung)}`).toBe(400);
    }
    expect(await vermerke()).toHaveLength(0);
    const sitzung = await app.inject({ method: "GET", url: "/api/auth/me", headers: anna.headers });
    expect(sitzung.statusCode, "ein abgewiesener Versuch hat die Sitzung entzogen").toBe(200);
    expect(await anstehend()).toEqual([]);

    // Eine bloße Sperre (Freigabe entzogen, ohne den Status) ist kein Ausscheiden.
    await services.auth.verzeichnisAendern(anna.id, { aktiv: false });
    expect(await vermerke()).toHaveLength(0);
    expect(await anstehend(), "eine bloße Sperre hat eine Übergabe ausgelöst").toEqual([]);
    expect((await services.ko.get(k))?.author).toBe(anna.id);
  });

  // Ben, Nacharbeit 13: Der Status hat ausdrückliche Wechsel. Eine Wiederfreigabe beendet ihn mit
  // eigenem Vermerk; eine spätere gewöhnliche Sperre ist kein neues Ausscheiden.
  it("A11 · Ausscheiden → Wiederfreigabe → gewöhnliche Sperre ⇒ der Status lebt nicht wieder auf", async () => {
    const { app, services, ada, anna, bert, eintrag, anstehend } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    const aus = await app.inject({
      method: "POST",
      url: `/api/users/${anna.id}/ausscheiden`,
      headers: ada.headers,
      payload: { vertretung: bert.id },
    });
    expect(aus.statusCode, aus.body).toBe(200);
    expect(await anstehend()).toEqual([{ koId: k, grund: "ausgeschieden", kritisch: false }]);

    // Die Verwaltung gibt das Konto wieder frei: der Status endet ausdrücklich, mit Vermerk.
    const frei = await app.inject({
      method: "PUT",
      url: `/api/users/${anna.id}`,
      headers: ada.headers,
      payload: { approve: true },
    });
    expect(frei.statusCode, frei.body).toBe(200);
    const beendet = await services.audit.list({
      action: "user.ausscheiden-beendet",
      target: anna.id,
    });
    expect(beendet).toHaveLength(1);
    expect(beendet[0]?.actor).toBe(ada.id);
    expect(await anstehend(), "nach der Wiederfreigabe steht die Übergabe noch an").toEqual([]);

    // Später eine gewöhnliche Sperre (Verzeichnisweg, ohne Status): kein neues Ausscheiden.
    await services.auth.verzeichnisAendern(anna.id, { aktiv: false });
    expect(await anstehend(), "eine spätere Sperre hat das alte Ausscheiden belebt").toEqual([]);
    const gesetzt = await services.audit.list({ action: "user.ausgeschieden", target: anna.id });
    expect(gesetzt).toHaveLength(1);
  });

  // Ben, Nacharbeit 13: Kann die Vertretung eine offene Aufgabe nicht übernehmen (sie hat das Objekt
  // schon geprüft), wird das Ausscheiden ohne Nebenwirkung abgelehnt.
  it("A12 · Vertretung hat das Objekt schon geprüft ⇒ 409 ohne Nebenwirkung; geeignete Vertretung ⇒ 200", async () => {
    const { app, repos, services, ada, anna, bert, eintrag, anstehend } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    const pruefobjekt = await eintrag(ada.id, "Instandhaltung");
    await services.validation.assign(pruefobjekt, [anna.id], ada.id);
    // Bert hat dieses Objekt bereits geprüft (erledigte Zuweisung).
    await repos.assignments.create({ koId: pruefobjekt, userId: bert.id, status: "done" });
    const ausscheiden = (vertretung: string) =>
      app.inject({
        method: "POST",
        url: `/api/users/${anna.id}/ausscheiden`,
        headers: ada.headers,
        payload: { vertretung },
      });

    const abgewiesen = await ausscheiden(bert.id);
    expect(abgewiesen.statusCode, abgewiesen.body).toBe(409);
    expect(abgewiesen.json().error).toBe("VERTRETUNG_UNGEEIGNET");
    expect(abgewiesen.json().abgelehnt).toEqual([
      expect.objectContaining({ art: "pruefaufgabe", id: pruefobjekt, an: bert.id }),
    ]);
    // Keine Nebenwirkung: kein Status, keine Übertragung, Zugang und Aufgabe bleiben bei Anna.
    const status = () => services.audit.list({ action: "user.ausgeschieden", target: anna.id });
    expect(await status()).toHaveLength(0);
    expect(await services.audit.list({ action: "lifecycle.handover" })).toHaveLength(0);
    const sitzung = await app.inject({ method: "GET", url: "/api/auth/me", headers: anna.headers });
    expect(sitzung.statusCode, "ein abgewiesenes Ausscheiden hat den Zugang entzogen").toBe(200);
    const offenVorher = await services.wissensuebergabe.offeneVorgaenge([anna.id]);
    expect(offenVorher.get(anna.id)?.pruefaufgaben).toEqual([{ koId: pruefobjekt }]);
    expect(await anstehend()).toEqual([]);

    // Ada hat das Objekt nicht geprüft und ist eine geeignete Vertretung.
    const erfolgreich = await ausscheiden(ada.id);
    expect(erfolgreich.statusCode, erfolgreich.body).toBe(200);
    expect(await status()).toHaveLength(1);
    const offenNachher = await services.wissensuebergabe.offeneVorgaenge([anna.id, ada.id]);
    expect(offenNachher.get(anna.id)?.pruefaufgaben).toEqual([]);
    expect(offenNachher.get(ada.id)?.pruefaufgaben).toEqual([{ koId: pruefobjekt }]);
    expect(await anstehend()).toEqual([{ koId: k, grund: "ausgeschieden", kritisch: false }]);
  });

  // Ben, Nacharbeit 14: der Teilfehlerpfad. Die Lücke geht über, das Schreiben der Prüfaufgabe
  // scheitert genau einmal (injizierter Fehler der Ablage). Dann darf kein Status entstehen, Anna
  // behält Zugang und den Rest, und die Wiederholung überträgt nur noch diesen Rest.
  it("A13 · Teilfehler der Übertragung ⇒ 409, kein Status, Zugang und Rest bleiben; Wiederholung ⇒ 200 ohne Doppel", async () => {
    const { app, repos, services, ada, anna, bert, eintrag, anstehend } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    const pruefobjekt = await eintrag(ada.id, "Instandhaltung");
    await services.validation.assign(pruefobjekt, [anna.id], ada.id);
    await repos.gaps.insert({
      id: "g-anna",
      question: "Fiktive Frage A13",
      status: "offen",
      assignee: anna.id,
      priority: "mittel" as const,
      createdAt: "2026-10-01T08:00:00.000Z",
    });
    const ausscheiden = () =>
      app.inject({
        method: "POST",
        url: `/api/users/${anna.id}/ausscheiden`,
        headers: ada.headers,
        payload: { vertretung: bert.id },
      });
    const status = () => services.audit.list({ action: "user.ausgeschieden", target: anna.id });
    const sitzung = async () =>
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: anna.headers })).statusCode;

    const schreiben = vi
      .spyOn(repos.assignments, "create")
      .mockRejectedValueOnce(new Error("Ablage nicht erreichbar (Testfehler A13)"));
    const teil = await ausscheiden();
    schreiben.mockRestore();
    expect(teil.statusCode, teil.body).toBe(409);
    expect(teil.json().error).toBe("UEBERGABE_UNVOLLSTAENDIG");
    expect(teil.json().uebertragen).toEqual([{ art: "luecke", id: "g-anna", an: bert.id }]);
    expect(teil.json().fehlgeschlagen).toEqual([
      expect.objectContaining({ art: "pruefaufgabe", id: pruefobjekt, an: bert.id }),
    ]);

    // Kein Status, Zugang bleibt, keine Übergabeaufgabe.
    expect(await status()).toHaveLength(0);
    expect(await sitzung(), "ein Teilfehler hat den Zugang entzogen").toBe(200);
    expect(await anstehend()).toEqual([]);
    // Zuständigkeiten: die Lücke liegt bei Bert, die Prüfaufgabe weiter bei Anna, nichts doppelt.
    expect((await repos.gaps.findById("g-anna"))?.assignee).toBe(bert.id);
    const nachTeil = await services.wissensuebergabe.offeneVorgaenge([anna.id, bert.id]);
    expect(nachTeil.get(anna.id)?.pruefaufgaben).toEqual([{ koId: pruefobjekt }]);
    expect(nachTeil.get(anna.id)?.luecken).toEqual([]);
    expect(nachTeil.get(bert.id)?.pruefaufgaben).toEqual([]);

    // Dieselbe Eingabe noch einmal: nur der Rest wird übertragen, dann der Status gesetzt.
    const wieder = await ausscheiden();
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json().vorgaenge.uebertragen).toEqual([
      { art: "pruefaufgabe", id: pruefobjekt, an: bert.id },
    ]);
    expect(await status()).toHaveLength(1);
    expect(await sitzung(), "nach dem Ausscheiden gilt die Sitzung noch").toBe(401);
    const danach = await services.wissensuebergabe.offeneVorgaenge([anna.id, bert.id]);
    expect(danach.get(anna.id)?.pruefaufgaben).toEqual([]);
    expect(danach.get(anna.id)?.luecken).toEqual([]);
    expect(danach.get(bert.id)?.pruefaufgaben).toEqual([{ koId: pruefobjekt }]);
    expect(danach.get(bert.id)?.luecken).toEqual([{ id: "g-anna" }]);
    const bertsZuweisungen = (await repos.assignments.all()).filter(
      (z) => z.koId === pruefobjekt && z.userId === bert.id,
    );
    expect(bertsZuweisungen, "die Prüfaufgabe wurde doppelt angelegt").toHaveLength(1);
    expect(await anstehend()).toEqual([{ koId: k, grund: "ausgeschieden", kritisch: false }]);
  });

  it("A3 · der Autor verlangt die Übergabe ⇒ sie steht an; A7 · Übergabe ⇒ erledigt", async () => {
    const { ada, anna, bert, eintrag, anstehend, aktion } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    const antrag = await aktion(k, anna.headers, { action: "request-author-transfer" });
    expect(antrag.statusCode, antrag.body).toBe(200);
    expect(await anstehend()).toEqual([{ koId: k, grund: "angefordert", kritisch: false }]);

    const uebergabe = await aktion(k, ada.headers, {
      action: "transfer-author",
      newAuthor: bert.id,
    });
    expect(uebergabe.statusCode, uebergabe.body).toBe(200);
    expect(await anstehend(), "die erledigte Übergabe steht noch an").toEqual([]);

    // Ein neuer Antrag nach der Übergabe öffnet eine neue Aufgabe — nicht die alte wieder.
    const zweiter = await aktion(k, bert.headers, { action: "request-author-transfer" });
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    expect(await anstehend()).toEqual([{ koId: k, grund: "angefordert", kritisch: false }]);
  });

  it("A4 · verlangen dürfen Autor und Admin — fremder Experte: verborgen 404, sichtbar 403", async () => {
    const { ada, anna, bert, eintrag, lesen, anstehend, aktion, services } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    expect((await lesen(`/api/kos/${k}`, bert.headers)).statusCode).toBe(404);
    const verborgen = await aktion(k, bert.headers, { action: "request-author-transfer" });
    const fehlend = await aktion("nicht-vorhandenes-testobjekt", bert.headers, {
      action: "request-author-transfer",
    });
    expect(verborgen.statusCode).toBe(404);
    expect(fehlend.statusCode).toBe(404);
    expect(verborgen.json()).toEqual(fehlend.json());
    expect(await anstehend(), "ein verborgener Antrag hat eine Aufgabe erzeugt").toEqual([]);
    const angefordert = { action: "ko.author-transfer-requested", target: k };
    expect(await services.audit.list(angefordert)).toHaveLength(0);

    const freigabe = await aktion(k, ada.headers, {
      action: "confidentiality",
      level: "intern",
    });
    expect(freigabe.statusCode, freigabe.body).toBe(200);
    const sichtbar = await lesen(`/api/kos/${k}`, bert.headers);
    expect(sichtbar.statusCode, sichtbar.body).toBe(200);
    expect(sichtbar.json().author).toBe(anna.id);
    const fremd = await aktion(k, bert.headers, { action: "request-author-transfer" });
    expect(fremd.statusCode).toBe(403);
    expect(await anstehend(), "ein abgewiesener Antrag hat eine Aufgabe erzeugt").toEqual([]);
    expect(await services.audit.list(angefordert)).toHaveLength(0);

    const verwaltung = await aktion(k, ada.headers, { action: "request-author-transfer" });
    expect(verwaltung.statusCode, verwaltung.body).toBe(200);
    const belege = await services.audit.list(angefordert);
    expect(belege).toHaveLength(1);
    expect(belege[0]?.actor).toBe(ada.id);
    expect(await anstehend()).toEqual([{ koId: k, grund: "angefordert", kritisch: false }]);
  });

  it("A5 · angezeigt wird sie nur der Verwaltung — Experten bekommen Liste und Zahl nicht", async () => {
    const { anna, eintrag, lesen, aktion } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    await aktion(k, anna.headers, { action: "request-author-transfer" });
    expect((await lesen("/api/me/author-transfers", anna.headers)).statusCode).toBe(403);
    expect((await lesen("/api/me/author-transfers/summary", anna.headers)).statusCode).toBe(403);
  });

  it("A6 · Priorität: „kritisch“ nur bei gepflegter Kritikalität „hoch“ des Bereichs", async () => {
    const { app, ada, anna, eintrag, anstehend, aktion } = await setup();
    const kritisch = await eintrag(anna.id, "Druckanlagen");
    const normal = await eintrag(anna.id, "Instandhaltung");
    const profil = await app.inject({
      method: "PUT",
      url: "/api/management/profiles/category",
      headers: ada.headers,
      payload: { category: "Druckanlagen", criticality: "hoch" },
    });
    expect(profil.statusCode, profil.body).toBe(200);
    // Eine niedrigere Stufe ist kein „kritisches Wissen".
    await app.inject({
      method: "PUT",
      url: "/api/management/profiles/category",
      headers: ada.headers,
      payload: { category: "Instandhaltung", criticality: "mittel" },
    });
    for (const k of [kritisch, normal]) {
      await aktion(k, anna.headers, { action: "request-author-transfer" });
    }
    const zeilen = await anstehend();
    const nach = new Map(zeilen.map((z) => [z.koId, z.kritisch]));
    expect(nach.get(kritisch), "Bereich mit Kritikalität „hoch“").toBe(true);
    expect(nach.get(normal), "Bereich mit Kritikalität „mittel“").toBe(false);
  });

  it("A8 · eine gescheiterte Übergabe (kein Admin) lässt die Aufgabe stehen", async () => {
    const { anna, bert, eintrag, anstehend, aktion } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    await aktion(k, anna.headers, { action: "request-author-transfer" });
    const versuch = await aktion(k, anna.headers, {
      action: "transfer-author",
      newAuthor: bert.id,
    });
    expect(versuch.statusCode).toBe(403);
    expect(await anstehend()).toEqual([{ koId: k, grund: "angefordert", kritisch: false }]);
  });

  it("ohne Anmeldung: 401 — Liste, Zahl und Antrag sind nie offen", async () => {
    const { app, anna, eintrag } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    const ohne = await app.inject({ method: "GET", url: "/api/me/author-transfers" });
    expect(ohne.statusCode).toBe(401);
    const antrag = await app.inject({
      method: "PUT",
      url: `/api/kos/${k}`,
      payload: { action: "request-author-transfer" },
    });
    expect(antrag.statusCode).toBe(401);
  });
});
