// ================================================================================================
// JOB 4223 · A — ANLEGEN, ANMELDEN, ARBEITEN: DER WEG IN EINEM STÜCK.
// ================================================================================================
//
// Was diese Datei belegt, ist NICHT, dass die einzelnen Bausteine funktionieren — das tun sie, und
// sechs Testbereiche messen es seit JOB 3665. Belegt wird, dass sie ALS KETTE tragen: EINE Instanz,
// EIN Socket, zwei getrennte Sitzungen, und zwischen den Schritten nichts Erfundenes.
//
// DIE REIHENFOLGE IST DER GEGENSTAND:
//   A1  Admin meldet sich an → legt in EINEM Formularschritt einen Gast mit Rolle UND Ablaufdatum
//       an → das Datum steht am RICHTIGEN Eintrag der Kontenliste → der Gast meldet sich in einem
//       EIGENEN Profil an → erreicht seinen ersten erlaubten Arbeitsweg und sieht den Inhalt.
//   A2  Die Gegenprobe zum „richtigen Eintrag": ein zweites Konto daneben bleibt unbefristet.
//       Ohne sie wäre A1 auch von einem Server erfüllt, der jedem Konto dieselbe Frist anhängt.
//   A3  Die Gegenprobe zur Kette selbst: mit falschem Passwort kommt derselbe Gast nicht herein,
//       und sein Arbeitsweg bleibt zu. Ohne sie misst A1 nur, dass irgendetwas antwortet.
//   A4  Der Gast ist ein GAST und kein zweiter Admin: schreiben darf er nicht, die Kontenliste
//       sieht er nicht. Eine Rolle, die beim Anlegen mitgeht und nicht wirkt, wäre eine Anzeige
//       ohne Deckung.
//   A5  `approved` IST NICHT „ANMELDBAR". Ein freigegebenes, aber abgelaufenes Konto trägt in der
//       Kontenliste weiterhin `approved: true` — und kommt nicht herein. Das ist der Fehlschluss,
//       den JOB 4011 ausdrücklich als BEN-Neufund festgehalten hat; er wird hier an der Kette
//       gemessen, nicht am Dienst.
//
// KEIN DOPPEL AN KEINER STELLE: kein gefälschtes `fetch` (anders als
// `tests/gast-befristung-flaeche/befristung-ist-bedienbar.test.tsx:22-28`), kein `app.inject`
// (anders als `tests/demo-zugang-gaeste-route/draht.ts`), keine gestellte Uhr (anders als
// `tests/demo-zugang-gaeste/aufbau.ts:52`). Die Begründung steht in `strecke.ts`.
import { afterEach, describe, expect, it } from "vitest";
import type { PublicUser } from "../../services/auth/src/types";
import {
  PASSWORT,
  type Strecke,
  arbeitsweg,
  ausDerListe,
  ersteinrichtung,
  gastAnlegen,
  kuenftig,
  mussGelingen,
  starteStrecke,
  vergangen,
  wissensobjektAnlegen,
} from "./strecke";

let offen: Strecke | undefined;

afterEach(async () => {
  await offen?.schliessen();
  offen = undefined;
});

async function aufbau(): Promise<Strecke> {
  offen = await starteStrecke();
  return offen;
}

describe("JOB 4223 A · der Gastweg vom Anlegen bis zum ersten Arbeitsschritt", () => {
  it("A1 — Admin legt in EINEM Schritt an, das Datum steht am richtigen Eintrag, der Gast arbeitet", async () => {
    const strecke = await aufbau();
    const { sitzung: admin } = await ersteinrichtung(strecke);
    const titel = "Wartungsfenster der Anlage 7";
    await wissensobjektAnlegen(admin, titel);

    // ── EIN Formularschritt: Name, E-Mail, Passwort, ROLLE und ENDE in einem Aufruf. ──────────
    const ende = kuenftig();
    const angelegt = mussGelingen(
      "POST /api/users",
      await gastAnlegen(admin, {
        name: "Gast Eins",
        email: "gast1@gastweg-4223.test",
        role: "viewer",
        accessExpiresAt: ende,
      }),
      201,
    );
    const gast = angelegt.json as PublicUser;
    expect(gast.role, "die mitgegebene Rolle steht in der Antwort").toBe("viewer");
    expect(gast.accessExpiresAt, "das mitgegebene Ende steht in der Antwort").toBe(ende);

    // ── Und zwar am RICHTIGEN Eintrag der Liste, nicht bloss in der Antwort von eben. ─────────
    const inDerListe = await ausDerListe(admin, gast.id);
    expect(inDerListe?.email).toBe("gast1@gastweg-4223.test");
    expect(inDerListe?.accessExpiresAt, "das Ende steht an DIESEM Eintrag").toBe(ende);
    expect(inDerListe?.role).toBe("viewer");
    expect(inDerListe?.approved, "ein in einem Schritt angelegter Gast ist freigegeben").toBe(true);

    // ── Ein EIGENES, frisches Profil: kein geliehener Keks, keine geliehene Anmeldung. ───────
    const gastProfil = strecke.profil("gast");
    expect(gastProfil.hatSitzungskeks(), "ein frisches Profil ist nicht angemeldet").toBe(false);
    // Vor der Anmeldung steht ihm nichts offen — sonst bewiese der Schritt danach nichts.
    expect((await arbeitsweg(gastProfil)).status).toBe(401);

    const anmeldung = mussGelingen(
      "Anmeldung des Gastes",
      await gastProfil.sende("POST", "/api/auth/login", {
        email: "gast1@gastweg-4223.test",
        password: PASSWORT,
      }),
    );
    expect(
      anmeldung.kopf.get("set-cookie") ?? "",
      "die Anmeldung setzt den Sitzungskeks über den echten Socket",
    ).toContain("kw_session=");
    expect(gastProfil.hatSitzungskeks()).toBe(true);

    // ── Der erste erlaubte Arbeitsweg — und er trägt wirklich Inhalt. ─────────────────────────
    const arbeit = await arbeitsweg(gastProfil);
    expect(arbeit.status, arbeit.text).toBe(200);
    expect(arbeit.text, "der Gast sieht den Bestand, nicht eine leere Liste").toContain(titel);

    // Und er weiss, wer er ist — über denselben Keks, ohne einen Bearer irgendwo einzusetzen.
    const ich = await gastProfil.sende("GET", "/api/auth/me");
    expect(ich.status, ich.text).toBe(200);
    expect((ich.json as PublicUser).id).toBe(gast.id);
  });

  it("A2 — das Ende hängt an DIESEM Konto: der Nachbar daneben bleibt unbefristet", async () => {
    // Ohne diesen Fall wäre A1 auch von einem Server erfüllt, der die Frist an jedes Konto hängt
    // oder sie global führt.
    const strecke = await aufbau();
    const { sitzung: admin } = await ersteinrichtung(strecke);

    const ende = kuenftig();
    const befristet = (
      mussGelingen(
        "POST /api/users (befristet)",
        await gastAnlegen(admin, {
          name: "Gast Befristet",
          email: "befristet@gastweg-4223.test",
          role: "viewer",
          accessExpiresAt: ende,
        }),
        201,
      ).json as PublicUser
    ).id;
    const dauerhaft = (
      mussGelingen(
        "POST /api/users (unbefristet)",
        await gastAnlegen(admin, {
          name: "Kollegin Dauerhaft",
          email: "dauerhaft@gastweg-4223.test",
          role: "experte",
        }),
        201,
      ).json as PublicUser
    ).id;

    expect((await ausDerListe(admin, befristet))?.accessExpiresAt).toBe(ende);
    const nachbar = await ausDerListe(admin, dauerhaft);
    expect(nachbar?.role, "die zweite Rolle ist ebenfalls die mitgegebene").toBe("experte");
    // Nicht `toBeUndefined()` allein: der SCHLÜSSEL darf gar nicht dastehen. Ein `null` oder ein
    // leerer String wäre ein dritter Zustand, den nur die Datenhaltung kennt (JOB 3665 D1).
    expect(Object.hasOwn(nachbar ?? {}, "accessExpiresAt")).toBe(false);

    // Und beide kommen herein — die Frist des einen sperrt den anderen nicht.
    for (const email of ["befristet@gastweg-4223.test", "dauerhaft@gastweg-4223.test"]) {
      const profil = strecke.profil(email);
      const anmeldung = await profil.sende("POST", "/api/auth/login", {
        email,
        password: PASSWORT,
      });
      expect(anmeldung.status, `${email}: ${anmeldung.text}`).toBe(200);
    }
  });

  it("A3 — Gegenprobe: mit falschem Passwort bleibt der Arbeitsweg zu", async () => {
    const strecke = await aufbau();
    const { sitzung: admin } = await ersteinrichtung(strecke);
    await wissensobjektAnlegen(admin, "Wartungsfenster der Anlage 7");
    mussGelingen(
      "POST /api/users",
      await gastAnlegen(admin, {
        name: "Gast Drei",
        email: "gast3@gastweg-4223.test",
        role: "viewer",
        accessExpiresAt: kuenftig(),
      }),
      201,
    );

    const profil = strecke.profil("gast-falsch");
    const anmeldung = await profil.sende("POST", "/api/auth/login", {
      email: "gast3@gastweg-4223.test",
      password: `${PASSWORT}-falsch`,
    });
    expect(anmeldung.status).toBe(401);
    expect(profil.hatSitzungskeks(), "eine gescheiterte Anmeldung setzt keinen Keks").toBe(false);

    const arbeit = await arbeitsweg(profil);
    expect(arbeit.status).toBe(401);
    expect(arbeit.text).not.toContain("Wartungsfenster der Anlage 7");
  });

  it("A4 — der Gast bleibt Gast: kein Schreiben, keine Kontenliste", async () => {
    const strecke = await aufbau();
    const { sitzung: admin } = await ersteinrichtung(strecke);
    mussGelingen(
      "POST /api/users",
      await gastAnlegen(admin, {
        name: "Gast Vier",
        email: "gast4@gastweg-4223.test",
        role: "viewer",
        accessExpiresAt: kuenftig(),
      }),
      201,
    );
    const profil = strecke.profil("gast4");
    mussGelingen(
      "Anmeldung",
      await profil.sende("POST", "/api/auth/login", {
        email: "gast4@gastweg-4223.test",
        password: PASSWORT,
      }),
    );

    // Lesen ja (`ko.read`), schreiben nein (`ko.create` fehlt dem viewer).
    expect((await arbeitsweg(profil)).status).toBe(200);
    const schreiben = await profil.sende("POST", "/api/kos", {
      confidentiality: "intern",
      title: "Vom Gast erfunden",
      statement: "Das darf hier nicht entstehen.",
      type: "best_practice",
      category: "Wartung",
    });
    expect(schreiben.status, schreiben.text).toBe(403);
    // Die Kontenverwaltung ist Adminsache — und sie enthält E-Mail-Adressen fremder Menschen.
    const konten = await profil.sende("GET", "/api/users");
    expect(konten.status).toBe(403);
    expect(konten.text).not.toContain("admin@gastweg-4223.test");
  });

  it("A5 — `approved` ist nicht dasselbe wie anmeldbar: freigegeben UND abgelaufen kommt nicht herein", async () => {
    // DER FEHLSCHLUSS, DEN JOB 4011 ALS BEN-NEUFUND FESTGEHALTEN HAT. Er wird hier an der Kette
    // gemessen: die Kontenliste sagt `approved: true`, der Eingang sagt trotzdem Nein.
    const strecke = await aufbau();
    const { sitzung: admin } = await ersteinrichtung(strecke);
    const gast = mussGelingen(
      "POST /api/users",
      await gastAnlegen(admin, {
        name: "Gast Fuenf",
        email: "gast5@gastweg-4223.test",
        role: "viewer",
        accessExpiresAt: vergangen(),
      }),
      201,
    ).json as PublicUser;

    const inDerListe = await ausDerListe(admin, gast.id);
    expect(inDerListe?.approved, "das Konto ist freigegeben").toBe(true);

    const profil = strecke.profil("gast5");
    const anmeldung = await profil.sende("POST", "/api/auth/login", {
      email: "gast5@gastweg-4223.test",
      password: PASSWORT,
    });
    expect(anmeldung.status, "freigegeben und trotzdem zu").toBe(403);
    expect((anmeldung.json as { error: string }).error).toBe("NOT_APPROVED");
    expect(profil.hatSitzungskeks()).toBe(false);
  });
});
