// ================================================================================================
// AUFTRAG-mega80 BLOCK A — EINE KENNUNG IST KEIN LESERECHT.
// ================================================================================================
//
// DER BEFUND (bens Fund, hier nachgestellt und erweitert). `PUT /api/kos/:id` verzweigt per
// `{action}` in siebzehn Aktionen. Bis mega80 hat KEINE davon das Sichtbarkeitstor passiert:
// `revise` verlangte `ko.create` (ko-routes.ts:1118-1124), lud das Objekt über den Dienst direkt
// aus dem Bestand (knowledge-object/src/service.ts:1813-1866) und sendete danach das VOLLSTÄNDIGE
// revidierte Objekt mit 200 zurück. Dasselbe bei `comment` (das nur eine ANMELDUNG verlangte),
// `attach`, `detach`, `add-source` und allen übrigen.
//
// In einem Satz: wer die Kennung eines fremden vertraulichen Objekts kennt, liest damit seinen
// Inhalt, seine Anhänge, seine Quellen und seine Metadaten — und verändert es im selben Zug.
// EINE UNERRATBARKEIT ERSETZT KEINE AUTORISIERUNG.
//
// ------------------------------------------------------------------------------------------------
// WIE DIESER TEST GEBAUT IST, UND WARUM SO.
// ------------------------------------------------------------------------------------------------
//
// bens Wächter-Merksatz aus KOMMUNIKATIONSWEGE §4, Punkt für Punkt:
//
//   ERHEBT SEINE GRUNDMENGE SELBST. Die Aktionsliste steht NICHT in diesem Test. Sie wird aus dem
//   Quelltext des Switch in ko-routes.ts gelesen (`case "…":`). Eine Aktion, die jemand morgen
//   hinzufügt, ist damit automatisch Teil der Prüfung — auch wenn niemand diesen Test anfasst.
//
//   ERKENNT SCHRUMPFEN FAIL-CLOSED. Fände das Suchmuster plötzlich weniger Aktionen (umbenannt,
//   umformatiert, Switch aufgelöst), prüfte der Test stillschweigend fast nichts mehr. Deshalb
//   steht unten eine harte Untergrenze: weniger als die heute bekannten siebzehn ist ein Fehler,
//   kein „nichts zu tun".
//
//   ORDNET JEDEM FUND GENAU EIN NACHGEPRÜFTES URTEIL ZU. Jede gefundene Aktion MUSS in der
//   Torurteil-Tabelle des Produktivcodes stehen; jede Tabellenaktion MUSS im Switch vorkommen.
//   Beide Richtungen, sonst deckt eine Lücke die andere zu.
//
//   BINDET AUSNAHMEN AUF DERSELBEN GRANULARITÄT AN IHREN BELEG. Die zwei `kein-zielobjekt`-Aktionen
//   werden nicht einfach übersprungen. Für jede wird NACHGEWIESEN, dass ihre eigene Rechteschwelle
//   die Sichtbarkeit bereits abdeckt — der Beleg steht als ausgeführte Prüfung da, nicht als
//   Kommentar.
//
//   PINNT DAS GESCHÜTZTE ANTWORTVERHALTEN STATT BLOSS NAMEN. Es wird kein Aufruf von
//   `sichtbaresKoOder404` gezählt und kein Bezeichner gesucht. Es wird GEFEUERT und der
//   Statuscode am Draht gemessen — dazu, dass der Geheimtext nirgends im Rumpf steht.
//
// ------------------------------------------------------------------------------------------------
// DIE GEGENPROBE, ohne die die 404 nichts beweisen.
// ------------------------------------------------------------------------------------------------
//
// Ein Test, der nur 404 misst, ist auch dann grün, wenn die Route gar nichts mehr herausgibt. Die
// Kontrolle ist deshalb eine DIFFERENZMESSUNG mit nur EINER veränderten Variable: DERSELBE fremde
// Nutzer feuert DIESELBEN Nutzlasten gegen ein INTERNES Objekt. Dort darf keine einzige Aktion 404
// liefern — 200/201/204 (erlaubt) oder 403 (Recht fehlt), aber nie „gibt es nicht". Unterschied
// zwischen beiden Läufen ist allein die Vertraulichkeitsstufe.
//
// Zweite Gegenprobe: der AUTOR des vertraulichen Objekts bekommt auf demselben Objekt weiterhin
// 200 — der Alltagsweg „ich bearbeite, was ich selbst geschrieben habe" trägt.
//
// ------------------------------------------------------------------------------------------------
// ROT-ZUERST-KALIBRIERUNG. Gegen die Fassung OHNE das Tor (Stand 7ae58bc) fallen alle gated
// Aktionen mit „expected 200 to be 404". Die Ausgabe steht wörtlich im Bericht.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { KO_AKTIONEN_MIT_TORURTEIL } from "../../services/app/src/routes/ko-routes";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const GEHEIM = "GEHEIMTEXT-MEGA80-NUR-FUER-DEN-AUTOR";

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@mega80.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@mega80.test", "geheim12345");

  for (const [email, role] of [
    ["autor@mega80.test", "experte"],
    ["fremd@mega80.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }

  return {
    app,
    admin,
    autor: await login(app, "autor@mega80.test", "geheim12345"),
    fremd: await login(app, "fremd@mega80.test", "geheim12345"),
  };
}

async function legeKoAn(app: App, autor: Auth, titel: string, vertraulich: boolean) {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: { title: titel, type: "technik", statement: GEHEIM, bodyHtml: `<p>${GEHEIM}</p>` },
  });
  if (created.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${created.statusCode} ${created.body}`);
  }
  const id: string = created.json().id;
  if (vertraulich) {
    const up = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    if (up.statusCode !== 200) {
      throw new Error(`Einstufung fehlgeschlagen: ${up.statusCode} ${up.body}`);
    }
  }
  return id;
}

// Eine MINIMALE, fachlich gültige Nutzlast je Aktion. Sie muss nur weit genug tragen, dass die
// Aktion am internen Objekt NICHT mit 404 endet — den Rest entscheidet die jeweilige Fachlogik.
function nutzlast(action: string, ctx: { attachmentId: string; koB: string }): object {
  switch (action) {
    case "rate":
      return { action, verdict: "up" };
    case "assign":
      return { action, userIds: [] };
    case "admin-validate":
      return { action };
    case "revise":
      return { action, changes: { title: "Geändert durch mega80" } };
    case "comment":
      return { action, text: "Kommentar aus mega80" };
    case "attach":
      return {
        action,
        attachment: {
          name: "bild.png",
          mime: "image/png",
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      };
    case "detach":
      return { action, attachmentId: ctx.attachmentId };
    case "add-source":
      return { action, source: { label: "Quelle aus mega80" } };
    case "append-document":
      return {
        action,
        appendDocument: {
          operationId: "op-mega80",
          anchor: { objectId: "obj-mega80", name: "d.pdf", mime: "application/pdf" },
          points: [{ label: "Belegstelle aus mega80" }],
        },
      };
    case "remove-source":
      return { action, sourceId: "src-mega80" };
    case "category":
      return { action, category: "Allgemein" };
    case "tags":
      return { action, tags: ["mega80"] };
    case "confidentiality":
      return { action, level: "intern" };
    case "conflict":
      return {
        action,
        conflict: { koA: ctx.koB, koB: ctx.koB, type: "truth", description: "Konflikt aus mega80" },
      };
    case "resolve-conflict":
      return { action, conflictId: "konflikt-mega80", decision: "Entschieden in mega80" };
    case "transfer-author":
      return { action, newAuthor: "irgendwer" };
    case "revalidate":
      return { action };
    default:
      throw new Error(`Keine Nutzlast hinterlegt für Aktion "${action}" — Test unvollständig.`);
  }
}

// ------------------------------------------------------------------------------------------------
// DIE GRUNDMENGE — aus dem Quelltext des Switch, nicht aus einer Liste in diesem Test.
// ------------------------------------------------------------------------------------------------
const KO_ROUTES = join(__dirname, "../../services/app/src/routes/ko-routes.ts");

/** Der Rumpf des EINEN Mutations-Endpunkts — damit fremde `case`-Marken der Datei draußen bleiben. */
function switchRumpf(): string {
  const quelltext = readFileSync(KO_ROUTES, "utf8");
  const ab = quelltext.indexOf('app.put<{ Params: { id: string }; Body: PutBody }>("/api/kos/:id"');
  if (ab < 0) {
    throw new Error("Der Mutations-Endpunkt PUT /api/kos/:id wurde im Quelltext nicht gefunden.");
  }
  return quelltext.slice(ab);
}

function aktionenAusDemSwitch(): string[] {
  const gefunden = [...switchRumpf().matchAll(/^\s*case "([a-z-]+)": \{/gm)].map(
    (m) => m[1] as string,
  );
  return [...new Set(gefunden)];
}

/**
 * Das Recht, das der Zweig dieser Aktion TATSÄCHLICH verlangt — gelesen aus dem AUSGEFÜHRTEN
 * `requirePermission`-Aufruf, nicht aus einer Liste in diesem Test.
 *
 * AUFTRAG-mega82 Block C (bens Befund an mega80). Die Ausnahme `conflict` war bis mega82 nur an
 * eine STATISCHE Aussage über die Rechtematrix gebunden („Experte hat kein `ko.validate`,
 * Controller schon"). Diese Aussage bleibt wahr, wenn jemand den ROUTE-ZWEIG später auf
 * `ko.create` absenkt — der Test wäre grün geblieben, während die Begründung der Ausnahme
 * („die Rechteschwelle deckt die Sichtbarkeit ohnehin ab") lautlos falsch geworden wäre. Eine
 * Zusage, die nur gilt, solange niemand eine Zeile ändert, ist keine Zusage.
 */
function rechtDerAktion(action: string): string {
  const rumpf = switchRumpf();
  const ab = rumpf.indexOf(`case "${action}": {`);
  if (ab < 0) {
    throw new Error(`Der Zweig der Aktion "${action}" wurde im Switch nicht gefunden.`);
  }
  // Bis zur nächsten `case`-Marke — der Zweig endet dort, und nur sein eigener Aufruf zählt.
  const naechste = rumpf.slice(ab + 1).search(/^\s*case "[a-z-]+": \{/m);
  const zweig = naechste < 0 ? rumpf.slice(ab) : rumpf.slice(ab, ab + 1 + naechste);
  const treffer = zweig.match(/requirePermission\("([a-z.]+)"/);
  if (!treffer?.[1]) {
    throw new Error(
      `Der Zweig der Aktion "${action}" ruft kein requirePermission auf — die benannte Ausnahme stützt sich damit auf gar keine Rechteschwelle mehr.`,
    );
  }
  return treffer[1];
}

// Heute bekannt: siebzehn. Die Untergrenze ist die Schrumpf-Sicherung — ein Suchmuster, das
// plötzlich weniger findet, macht diesen Test ROT statt heimlich wirkungslos.
const BEKANNTE_AKTIONEN = 17;

describe("mega80 A — eine Kennung ist kein Leserecht", () => {
  it("erhebt die Grundmenge aus dem Switch und ordnet jeder Aktion genau ein Torurteil zu", () => {
    const ausDemSwitch = aktionenAusDemSwitch();

    // Schrumpfen ist ein Fehler, kein Freibrief.
    expect(ausDemSwitch.length).toBeGreaterThanOrEqual(BEKANNTE_AKTIONEN);

    // Jede Aktion im Switch hat ein Urteil …
    for (const action of ausDemSwitch) {
      expect(
        KO_AKTIONEN_MIT_TORURTEIL[action],
        `Aktion "${action}" steht im Switch, hat aber KEIN Torurteil. Jede kennungsbasierte KO-Aktion muss beurteilt sein — eintragen in ZIELOBJEKT_TOR (ko-routes.ts).`,
      ).toBeDefined();
    }
    // … und jedes Urteil einen Fall im Switch. Sonst verrottet die Tabelle unbemerkt.
    for (const action of Object.keys(KO_AKTIONEN_MIT_TORURTEIL)) {
      expect(
        ausDemSwitch,
        `Aktion "${action}" hat ein Torurteil, kommt im Switch aber nicht vor.`,
      ).toContain(action);
    }
  });

  it("verweigert JEDER torpflichtigen Aktion das fremde vertrauliche Objekt — mit 404, ohne Inhalt", async () => {
    const { app, autor, fremd } = await setup();
    const geheim = await legeKoAn(app, autor, "Vertraulicher Beitrag", true);
    const koB = await legeKoAn(app, autor, "Zweitobjekt", false);

    const torpflichtig = aktionenAusDemSwitch().filter(
      (a) => KO_AKTIONEN_MIT_TORURTEIL[a] === "tor",
    );
    expect(torpflichtig.length).toBeGreaterThan(0);

    // BEWUSST erst sammeln, dann urteilen: eine Schleife mit sofortigem `expect` bricht beim
    // ERSTEN Fund ab und verschweigt die übrigen sechzehn. Der Rot-zuerst-Lauf soll die ganze
    // Fläche zeigen, nicht ihre erste Zeile.
    const befund: Record<string, string> = {};
    const erwartet: Record<string, string> = {};
    for (const action of torpflichtig) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${geheim}`,
        headers: fremd,
        payload: nutzlast(action, { attachmentId: "egal", koB }),
      });
      befund[action] = res.body.includes(GEHEIM)
        ? `${res.statusCode} MIT INHALT`
        : `${res.statusCode}`;
      erwartet[action] = "404";
    }
    expect(befund).toEqual(erwartet);

    // Auch das Löschen ist eine kennungsbasierte Aktion an einem Zielobjekt.
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/kos/${geheim}`,
      headers: fremd,
    });
    expect(geloescht.statusCode).toBe(404);

    // Und das Objekt steht danach unverändert da — die 404 haben nichts durchgelassen.
    const nachher = await app.inject({ method: "GET", url: `/api/kos/${geheim}`, headers: autor });
    expect(nachher.statusCode).toBe(200);
    expect(nachher.json().title).toBe("Vertraulicher Beitrag");
    expect(nachher.json().confidentiality).toBe("vertraulich");
  });

  // DIE DIFFERENZMESSUNG. Gleicher Nutzer, gleiche Nutzlasten, EINE veränderte Variable: die Stufe.
  it("lässt dieselben Aktionen desselben Nutzers am INTERNEN Objekt durch — keine 404", async () => {
    const { app, autor, fremd } = await setup();
    const intern = await legeKoAn(app, autor, "Interner Beitrag", false);
    const koB = await legeKoAn(app, autor, "Zweitobjekt", false);

    // Ein echter Anhang, damit `detach` etwas zu greifen hat.
    const angehaengt = await app.inject({
      method: "PUT",
      url: `/api/kos/${intern}`,
      headers: fremd,
      payload: nutzlast("attach", { attachmentId: "egal", koB }),
    });
    expect(angehaengt.statusCode).toBe(200);
    const attachmentId: string = angehaengt.json().attachments.at(-1).id;

    const torpflichtig = aktionenAusDemSwitch().filter(
      (a) => KO_AKTIONEN_MIT_TORURTEIL[a] === "tor",
    );

    for (const action of torpflichtig) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${intern}`,
        headers: fremd,
        payload: nutzlast(action, { attachmentId, koB }),
      });
      // 404 ist hier VERBOTEN. Alles andere ist eine fachliche Antwort: 200/204 (durchgeführt),
      // 400 (Nutzlast), 403 (Recht fehlt). Nur „gibt es nicht" darf es nicht sein.
      expect(res.statusCode, `Aktion "${action}" gab am INTERNEN Objekt 404`).not.toBe(404);
    }
  });

  // DER ALLTAGSWEG. Ohne ihn wäre der Schutz nur die Abschaltung der Route.
  it("lässt den Autor sein eigenes vertrauliches Objekt weiter bearbeiten", async () => {
    const { app, autor } = await setup();
    const geheim = await legeKoAn(app, autor, "Vertraulicher Beitrag", true);

    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${geheim}`,
      headers: autor,
      payload: { action: "revise", changes: { title: "Vom Autor überarbeitet" } },
    });
    expect(revidiert.statusCode).toBe(200);
    expect(revidiert.json().title).toBe("Vom Autor überarbeitet");

    const kommentiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${geheim}`,
      headers: autor,
      payload: { action: "comment", text: "Mein eigener Kommentar" },
    });
    expect(kommentiert.statusCode).toBe(200);
  });

  // DIE BENANNTE AUSNAHME, an ihren Beleg gebunden — auf derselben Granularität wie die Regel.
  it("belegt für JEDE kein-zielobjekt-Aktion, dass ihre Rechteschwelle die Sichtbarkeit deckt", async () => {
    const { can } = await import("../../services/rbac");
    const ausgenommen = Object.keys(KO_AKTIONEN_MIT_TORURTEIL).filter(
      (a) => KO_AKTIONEN_MIT_TORURTEIL[a] === "kein-zielobjekt",
    );
    expect(ausgenommen.sort()).toEqual(["conflict", "resolve-conflict"]);

    // AUFTRAG-mega82 Block C: ZUERST die Rechteschwelle aus dem AUSGEFÜHRTEN Aufruf holen. Erst
    // dadurch hängt alles Folgende an der Route und nicht an einer Behauptung dieses Tests. Wird
    // ein Zweig später abgesenkt, wird HIER rot — nicht irgendwann im Betrieb.
    const rechte = Object.fromEntries(ausgenommen.map((a) => [a, rechtDerAktion(a)]));
    expect(rechte).toEqual({ conflict: "ko.validate", "resolve-conflict": "conflict.resolve" });

    // Der Beleg: JEDE Rolle, die eine dieser Aktionen überhaupt ausführen darf, hält `ko.validate`
    // — und für die liefert `darfSehen` unbedingt `true`. Das Tor wäre auf diesen zwei Aktionen ein
    // No-op auf der Sichtbarkeit. Kippt die Rechtematrix ODER die Schwelle im Zweig, kippt dieser
    // Test. Geprüft wird gegen das eben ausgelesene Recht, nicht gegen eine hier notierte Kopie.
    const rollen = ["viewer", "experte", "controller", "admin"] as const;
    for (const aktion of ausgenommen) {
      const schwelle = rechte[aktion] as Parameters<typeof can>[1];
      for (const rolle of rollen) {
        if (can(rolle, schwelle)) {
          expect(
            can(rolle, "ko.validate"),
            `Rolle "${rolle}" darf "${aktion}" ausführen (${schwelle}), sieht aber nicht`,
          ).toBe(true);
        }
      }
    }

    // Und der Nachweis, dass die Schleife oben überhaupt etwas trennt: `ko.validate` ist kein
    // Jedermannsrecht. Ohne diese zwei Zeilen wäre sie auch bei einer allmächtigen Matrix grün.
    expect(can("experte", "ko.validate")).toBe(false);
    expect(can("controller", "ko.validate")).toBe(true);
  });
});
