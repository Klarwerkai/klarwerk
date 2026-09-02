// JOB 2966 D1 · F-0018 / F-0044 — WAS DIE VORDERTÜR NICHT FÜHRT, DARF SIE NICHT LÖSCHEN.
//
// GEMESSEN AM STAND 6d574fce, VOR JEDER ÄNDERUNG:
//
// JOB 2695 D5 (Commit 0fc486c) hat den SPEICHERN-Weg bereits geschlossen: über einem bestehenden
// Entwurf schrumpft `buildFrontDoorPayload` auf die Felder, die diese Fläche selbst führt
// (`nurEigene`, captureFrontDoor.ts:180-182). Das ist belegt und bleibt so — geprüft in
// `job2695-vordertuer-loescht-nicht.test.tsx` (F1, F2, F4).
//
// OFFEN GEBLIEBEN IST DER ZWEITE WEG, und er trägt denselben Schaden: das EINREICHEN über einen
// bestehenden Entwurf. `submitFrontDoorDraft` baut seinen Rumpf mit `vollstaendig: true`
// (captureFrontDoor.ts:413); damit ist `nurEigene` false und der Rumpf trägt die fest
// verdrahteten Leerwerte aus captureFrontDoor.ts:188-190:
//
//     tags: [], conditions: [], measures: []
//
// Dieser Rumpf reist als `draftPayload` ins Promote (capture-routes.ts:1304-1318) und läuft dort
// durch `capture.continueDraft` → `mergeDraftPayload` (services/capture/src/service.ts:379). Und
// dessen Vertrag steht ausgeschrieben in service.ts:371-372:
//
//     Schlüssel NICHT mitgeschickt (oder `undefined`) ⇒ Altwert bleibt.
//     Schlüssel mitgeschickt mit LEERWERT ([], "", …) ⇒ Altwert GEHT.
//
// Ein Studio-Entwurf mit drei Maßnahmen, über die Vordertür EINGEREICHT, verliert sie deshalb —
// still, ohne Fehler, und diesmal nicht nur im Entwurf, sondern im entstehenden Wissensobjekt
// (`capture.toKoInput` liest den bereits geleerten Stand, capture-routes.ts:1320).
//
// Diese Datei misst den Verlust am ECHTEN Merge des CaptureService, nicht an einer Nachbildung.
//
// D2 ergaenzte Fall C (exakte Schluesselpraesenz, `undefined` ≠ `[]`) — der bleibt
// unveraendert. Fall E ging den vollen Weg, aber ueber einen Test-Client, der die
// Handlerfolge nur NACHBAUTE.
//
// D3 (BENs Auflage aus der D2-Pruefung) stellt genau das um: „Als realer
// Einreich-/Befoerderungsweg gilt nur ein Test gegen den tatsaechlich registrierten
// Promote-Handler einschliesslich seiner Wire-Grenze." Fall E laeuft deshalb jetzt
// ueber `buildApp`/`buildServices` und `app.inject` — dieselbe Grenze, die auch ein
// Browser trifft:
//
//     POST /api/drafts             (capture-routes.ts:804)   Entwurf anlegen
//     POST /api/drafts/:id/promote (capture-routes.ts:1238)   befoerdern
//     GET  /api/kos/:id            (ko-routes.ts:553)         Wissensobjekt REGULAER auslesen
//     GET  /api/drafts             (capture-routes.ts:773)    Entwurf ist weg
//
// Keine Zeile der Handlerfolge ist hier nachgebaut; der Test kennt nur Route,
// Rumpf und Antwort.
import { describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import {
  buildFrontDoorPayload,
  submitFrontDoorDraft,
} from "../../apps/web/src/lib/captureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";

function service(): CaptureService {
  return new CaptureService({ repo: new InMemoryDraftRepo() });
}

type App = ReturnType<typeof buildApp>;

/** Echte App mit echten Diensten, angemeldeter Nutzer — wie in den Routentests der Anlage. */
async function appMitAnmeldung(): Promise<{ app: App; headers: Record<string, string> }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Expertin", email: "expertin@klarwerk.test", password: "secret123" },
  });
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "expertin@klarwerk.test", password: "secret123" },
  });
  expect(anmeldung.statusCode, "Anmeldung fehlgeschlagen").toBe(200);
  return { app, headers: { authorization: `Bearer ${anmeldung.json().token}` } };
}

/** Ein Studio-Entwurf, wie ihn ein Experte anlegt: mit Bedingungen und drei Maßnahmen. */
const STUDIO_ENTWURF: DraftPayload = {
  title: "Dichtung am Verdichter",
  statement: "Die Dichtung wird bei jeder Wartung getauscht.",
  bodyHtml: "<p>Die Dichtung wird bei jeder Wartung getauscht.</p>",
  type: "best_practice",
  category: "Instandhaltung",
  conditions: ["Anlage steht still", "Druck abgelassen"],
  measures: ["Dichtung tauschen", "Drehmoment prüfen", "Dichtheit protokollieren"],
  tags: ["verdichter", "wartung"],
};

async function entwurfAnlegen(svc: CaptureService, payload: DraftPayload = STUDIO_ENTWURF) {
  return svc.createDraft(payload, "expertin");
}

describe("JOB 2966 D1 · F-0018 — die Vordertür behält Bedingungen und Maßnahmen", () => {
  it("A — DREI MASSNAHMEN VOR DEM EINREICHEN, DREI DANACH (der eigentliche Schaden)", async () => {
    const svc = service();
    const entwurf = await entwurfAnlegen(svc);
    expect(entwurf.payload.measures, "Kalibrierung: der Entwurf trägt drei Maßnahmen").toHaveLength(
      3,
    );

    // Genau der Rumpf, den `submitFrontDoorDraft` ins Promote schickt.
    const rumpf = buildFrontDoorPayload({
      title: "Dichtung am Verdichter",
      bodyHtml: "<p>Die Dichtung wird bei jeder Wartung getauscht.</p>",
      activeDraftId: entwurf.id,
      vollstaendig: true,
    });

    // Der ECHTE Serverweg des Einreichens (capture-routes.ts:1312).
    const nachher = await svc.continueDraft(entwurf.id, rumpf, "expertin");

    expect(
      nachher.payload.measures,
      "die drei Maßnahmen sind beim Einreichen über die Vordertür verloren gegangen",
    ).toHaveLength(3);
    expect(nachher.payload.measures).toEqual(STUDIO_ENTWURF.measures);
    expect(
      nachher.payload.conditions,
      "die Bedingungen sind beim Einreichen verloren gegangen",
    ).toEqual(STUDIO_ENTWURF.conditions);
  });

  it("B — EIN NICHT GEFÜHRTES FELD REIST UNVERÄNDERT DURCH, ES WIRD NIE GELEERT", async () => {
    // Der allgemeine Fall und der wichtigere: Die Fläche führt `tags` nicht — also darf sie sie
    // weder setzen noch löschen. Ein fest verdrahteter Leerwert ist genau der Fehler, den dieser
    // Durchgang abschafft; er darf nicht durch einen zweiten ersetzt werden.
    const svc = service();
    const entwurf = await entwurfAnlegen(svc);

    const rumpf = buildFrontDoorPayload({
      title: "Dichtung am Verdichter",
      bodyHtml: "<p>Text</p>",
      activeDraftId: entwurf.id,
      vollstaendig: true,
    });

    // Am Vertrag: über einem Bestand trägt der Rumpf für ein nicht geführtes Feld KEINEN Leerwert.
    for (const feld of ["tags", "conditions", "measures"] as const) {
      const wert = (rumpf as Record<string, unknown>)[feld];
      expect(
        wert === undefined || (Array.isArray(wert) && wert.length > 0),
        `der Einreichen-Rumpf sendet „${feld}" als Leerwert und löscht damit den Altwert`,
      ).toBe(true);
    }

    // Und am Ergebnis: der Altwert steht danach unverändert da.
    const nachher = await svc.continueDraft(entwurf.id, rumpf, "expertin");
    expect(nachher.payload.tags, "die Hinweise wurden still geleert").toEqual(STUDIO_ENTWURF.tags);

    // Was die Vordertür SEHR WOHL führt, schreibt sie weiterhin — sonst wäre der Fix eine Lähmung.
    expect(nachher.payload.title).toBe("Dichtung am Verdichter");
    expect(
      rumpf.type,
      "das Promote bekäme keinen Typ und antwortete 400 INCOMPLETE (JOB 2695 D3)",
    ).toBe("best_practice");
    expect(rumpf.category, "das Promote bekäme keine Kategorie").toBe("Allgemein");
  });

  it("C — EIN ENTWURF OHNE DIESE FELDER BLEIBT UNVERÄNDERT, NICHTS WIRD ERFUNDEN", async () => {
    const svc = service();
    const schlicht: DraftPayload = {
      title: "Kurznotiz",
      statement: "Nur ein Satz.",
      bodyHtml: "<p>Nur ein Satz.</p>",
      type: "best_practice",
      category: "Allgemein",
    };
    const entwurf = await entwurfAnlegen(svc, schlicht);

    const rumpf = buildFrontDoorPayload({
      title: "Kurznotiz",
      bodyHtml: "<p>Nur ein Satz.</p>",
      activeDraftId: entwurf.id,
      vollstaendig: true,
    });
    const nachher = await svc.continueDraft(entwurf.id, rumpf, "expertin");

    // D2 (BEN): EXAKTE Schlüsselpräsenz. `undefined` und `[]` sind NICHT
    // gleichwertig — ein erfundenes leeres Feld ist genau der Fehler, den
    // dieser Durchgang abschafft, und die D1-Fassung hätte ihn durchgelassen.
    for (const feld of ["conditions", "measures", "tags"] as const) {
      expect(
        Object.hasOwn(nachher.payload, feld),
        `Schlüssel „${feld}" wurde erfunden, obwohl der Entwurf ihn nie trug`,
      ).toBe(Object.hasOwn(entwurf.payload, feld));
    }
  });

  it("C2 — DIE SCHÄRFUNG BEISST: eine Fassung, die `undefined` und `[]` gleichsetzt, fällt durch", () => {
    // BENs Auflage verlangt den Nachweis, dass die geschärfte Prüfung mehr kann
    // als die alte. Beide Fassungen werden hier auf denselben Fall angesetzt:
    // ein Entwurf ohne die Felder, und ein Ergebnis, das ein leeres `measures`
    // ERFUNDEN hat. Der Merge-Vertrag liest ein solches `[]` als Löschbefehl —
    // es ist also kein harmloses Nichts.
    const ohneFelder = { title: "Kurznotiz", statement: "Nur ein Satz." } as Record<
      string,
      unknown
    >;
    const mitErfundenemLeerwert = { ...ohneFelder, measures: [] } as Record<string, unknown>;

    const grobGleich = (a: Record<string, unknown>, b: Record<string, unknown>, feld: string) => {
      const wa = a[feld];
      const wb = b[feld];
      const leer = (w: unknown) => w === undefined || (Array.isArray(w) && w.length === 0);
      return leer(wa) === leer(wb);
    };
    const scharfGleich = (a: Record<string, unknown>, b: Record<string, unknown>, feld: string) =>
      Object.hasOwn(a, feld) === Object.hasOwn(b, feld);

    // Die alte, zu grobe Fassung hält den erfundenen Leerwert für in Ordnung …
    expect(
      grobGleich(mitErfundenemLeerwert, ohneFelder, "measures"),
      "Gegenprobe misslungen: die grobe Fassung müsste hier fälschlich Gleichheit sehen",
    ).toBe(true);
    // … die geschärfte deckt ihn auf. Genau das ist BENs Auflage.
    expect(
      scharfGleich(mitErfundenemLeerwert, ohneFelder, "measures"),
      "die geschärfte Fassung übersieht einen erfundenen Leerwert",
    ).toBe(false);
    // Und sie bleibt gutmütig, wo nichts erfunden wurde.
    expect(scharfGleich(ohneFelder, { ...ohneFelder }, "measures")).toBe(true);
  });

  it("E — DER VOLLE WEG: das tatsächlich erzeugte WISSENSOBJEKT trägt Bedingungen und Maßnahmen", async () => {
    // ============================================================================================
    // BENs Auflage aus der D2-Prüfung, und sie ist berechtigt: D2 belegte den vollen Weg über
    // einen Test-Client, der die Handlerfolge NACHBAUTE. Ein Nachbau beweist nur, dass meine
    // Vorstellung von der Route hält — nicht die Route.
    //
    // Deshalb läuft dieser Fall jetzt über die WIRE-GRENZE der echten App: derselbe Rumpf, dieselbe
    // Route, dieselbe Serialisierung, die auch ein Browser trifft. Der Test kennt nur Pfad, Rumpf
    // und Antwort; jede Zeile dahinter gehört dem Produkt.
    // ============================================================================================
    const { app, headers } = await appMitAnmeldung();

    // 1 · Der Studio-Entwurf entsteht über die ECHTE Anlege-Route, nicht im Speicher daneben.
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: STUDIO_ENTWURF,
    });
    expect(angelegt.statusCode, "der Studio-Entwurf ließ sich nicht anlegen").toBe(201);
    const entwurfId: string = angelegt.json().id;
    expect(
      angelegt.json().payload.measures,
      "Kalibrierung: drei Maßnahmen im Bestand",
    ).toHaveLength(3);

    // 2 · Einreichen über den echten Client-Einstieg — der Transport ist die Route selbst.
    const erzeugt = await submitFrontDoorDraft<{ id: string }, { id: string }>(
      {
        title: "Dichtung am Verdichter",
        bodyHtml: "<p>Die Dichtung wird bei jeder Wartung getauscht.</p>",
        activeDraftId: entwurfId,
      },
      {
        createDraft: async (payload) => {
          const res = await app.inject({ method: "POST", url: "/api/drafts", headers, payload });
          expect(res.statusCode).toBe(201);
          return res.json();
        },
        promoteDraft: async (id, vorgang) => {
          const res = await app.inject({
            method: "POST",
            url: `/api/drafts/${id}/promote`,
            headers,
            payload: vorgang,
          });
          expect(res.statusCode, `Promote antwortete ${res.statusCode}: ${res.body}`).toBe(201);
          return res.json();
        },
      },
      { id: "op-2966-d3-echte-route", draftRef: { current: null } },
    );

    // 3 · Das Wissensobjekt wird REGULÄR ausgelesen — nicht die Promote-Antwort geglaubt.
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/kos/${erzeugt.id}`,
      headers,
    });
    expect(gelesen.statusCode, "das erzeugte Wissensobjekt ist nicht abrufbar").toBe(200);
    const ko = gelesen.json();

    expect(
      ko.measures,
      "das ausgelesene Wissensobjekt hat die drei Maßnahmen verloren — der Verlust sitzt hinter dem Merge",
    ).toEqual(STUDIO_ENTWURF.measures);
    expect(ko.conditions, "das ausgelesene Wissensobjekt hat die Bedingungen verloren").toEqual(
      STUDIO_ENTWURF.conditions,
    );
    expect(ko.tags, "das ausgelesene Wissensobjekt hat die Hinweise verloren").toEqual(
      STUDIO_ENTWURF.tags,
    );
    // Und was die Vordertür führt, steht ebenfalls im Wissensobjekt.
    expect(ko.title).toBe("Dichtung am Verdichter");

    // 4 · Der Entwurf ist weg — das Promote hat ihn geräumt, kein zweiter Weg zurück.
    const entwuerfe = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(entwuerfe.statusCode).toBe(200);
    const liste: Array<{ id: string }> = entwuerfe.json();
    expect(
      liste.find((d) => d.id === entwurfId),
      "der Entwurf liegt nach dem Einreichen noch im Bestand",
    ).toBeUndefined();
  });

  it("D — GEGENPROBE: der Neuanlage-Weg setzt die Felder weiterhin, sonst misst A nichts", () => {
    // Fall D beweist, dass die Änderung eng ist und der Test zubeißt: OHNE bestehenden Entwurf
    // gibt es keinen Altwert, den ein Leerwert löschen könnte — dort MÜSSEN die Felder gesetzt
    // bleiben, damit ein neuer Entwurf mit Einordnung entsteht. Fiele diese Erwartung mit dem Fix,
    // hätte ich den Fehler nur verschoben.
    const neu = buildFrontDoorPayload({
      title: "Frisch",
      bodyHtml: "<p>Text</p>",
    }) as Record<string, unknown>;

    expect(neu.type, "der Neuanlage-Weg verliert den Typ").toBe("best_practice");
    expect(neu.category, "der Neuanlage-Weg verliert die Kategorie").toBe("Allgemein");
    expect(neu.origin, "der Neuanlage-Weg verliert die Herkunft").toBe("frontdoor");
    expect(neu.conditions, "der Neuanlage-Weg legt keine Bedingungen an").toEqual([]);
    expect(neu.measures, "der Neuanlage-Weg legt keine Maßnahmen an").toEqual([]);
    expect(neu.tags, "der Neuanlage-Weg legt keine Hinweise an").toEqual([]);

    // Und der SPEICHERN-Weg über einen Bestand bleibt, wie JOB 2695 D5 ihn gebaut hat.
    const speichern = buildFrontDoorPayload({
      title: "Bestehend",
      bodyHtml: "<p>Text</p>",
      activeDraftId: "d-1",
    }) as Record<string, unknown>;
    for (const feld of ["type", "category", "tags", "conditions", "measures", "origin"]) {
      expect(
        Object.hasOwn(speichern, feld),
        `der Speichern-Weg sendet wieder „${feld}" — JOB 2695 D5 wäre rückgängig gemacht`,
      ).toBe(false);
    }
  });
});
