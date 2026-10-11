import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG (R-0961, K1–K3) — DIE WARTENDE AUTORENÜBERGABE AM HTTP-RAND.
// ================================================================================================
//
// Quelle der Regel: Peters Entscheidungen 23/24 vom 11.10.2026, abgebildet in
// `apps/web/src/lib/autorenuebergabe.ts`. Gemessen wird ausschließlich über HTTP, mit der Anmeldung
// der Person, für die der Schritt gilt. Dienstaufrufe legen nur Wissensobjekte an.
//
//   A1  Auslöser „Konto gelöscht": Der Autor wird gelöscht, und die Übergabe steht an.
//   A2  Auslöser „Zugang beendet": Die Befristung des Autors ist abgelaufen, und die Übergabe steht an.
//   A3  Auslöser „angefordert": Der Autor verlangt die Übergabe, und sie steht an.
//   A4  Wer verlangen darf: Autor und Admin ja, ein fremder Experte 403.
//   A5  Wem sie angezeigt wird: nur Admins (Liste und Zahl 403 für Experten).
//   A6  Priorität: „kritisch" nur, wenn das Bereichsprofil die Kritikalität „hoch" trägt.
//   A7  Abschluss: Nach der vorhandenen Übergabe (`transfer-author`, Audit
//       `ko.author-transferred`) verschwindet die Aufgabe; Liste und Zahl stimmen in jedem Schritt.
//   A8  Gegenfall: Eine gescheiterte Übergabe (Versuch ohne Admin-Recht, 403) lässt sie stehen.
describe("R-0961: wartende Autorenübergabe — Auslöser, Berechtigung, Priorität, Abschluss", () => {
  async function setup() {
    const services = buildServices();
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
    return { app, services, ada, anna, bert, eintrag, lesen, anstehend, aktion };
  }

  it("Kalibrierung: ohne Auslöser steht keine Übergabe an", async () => {
    const { anna, eintrag, anstehend } = await setup();
    await eintrag(anna.id, "Instandhaltung");
    expect(await anstehend()).toEqual([]);
  });

  // Seit `produkt:20261007:ownership-uebergabe` (verantwortung-routes.ts, `kontoendeSperre`) lässt
  // die Kontoverwaltung ein Konto nicht mehr löschen oder befristen, solange es noch Beiträge
  // verantwortet (409 `BESTAND_OFFEN`). Der Auslöser bleibt trotzdem nötig: für Beiträge, deren
  // Konto schon fehlte, als sie entstanden (Altbestand, Import), und für Befristungen, die vor dem
  // Beitrag gesetzt wurden. Genau in dieser Reihenfolge stellen A1 und A2 den Zustand her, über
  // die echten Kontowege und ohne den Schutz zu umgehen.
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

  it("A2 · Zugang des Autors abgelaufen ⇒ Übergabe steht an; Befristung entfernt ⇒ nicht mehr", async () => {
    const { app, ada, anna, eintrag, anstehend } = await setup();
    const befristen = (accessExpiresAt: string | null) =>
      app.inject({
        method: "PUT",
        url: `/api/users/${anna.id}`,
        headers: ada.headers,
        payload: { accessExpiresAt },
      });
    // Die Befristung steht VOR dem Beitrag (s. Kommentar über A1) und ist inzwischen abgelaufen.
    const abgelaufen = await befristen("2026-01-01T00:00:00.000Z");
    expect(abgelaufen.statusCode, abgelaufen.body).toBeLessThan(300);
    const k = await eintrag(anna.id, "Instandhaltung");
    expect(await anstehend()).toEqual([{ koId: k, grund: "zugang-beendet", kritisch: false }]);

    // Die Befristung zu NEHMEN ist auch mit Bestand erlaubt — danach ist der Zugang offen.
    const entfernt = await befristen(null);
    expect(entfernt.statusCode, entfernt.body).toBeLessThan(300);
    expect(await anstehend()).toEqual([]);
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

  it("A4 · verlangen dürfen Autor und Admin — ein fremder Experte bekommt 403", async () => {
    const { ada, anna, bert, eintrag, anstehend, aktion, services } = await setup();
    const k = await eintrag(anna.id, "Instandhaltung");
    const fremd = await aktion(k, bert.headers, { action: "request-author-transfer" });
    expect(fremd.statusCode).toBe(403);
    expect(await anstehend(), "ein abgewiesener Antrag hat eine Aufgabe erzeugt").toEqual([]);
    const angefordert = { action: "ko.author-transfer-requested", target: k };
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
