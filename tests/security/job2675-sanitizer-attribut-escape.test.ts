// ================================================================================================
// JOB 2675 · D1 (R2-15) — DER SANITIZER, DER SEIN EIGENES VERSPRECHEN BRICHT.
// ================================================================================================
//
// PEDIS FRAGE IST DIE ABNAHME: „Kann jemand ueber ein Dokument etwas in Klara einschleusen, das
// spaeter ausgefuehrt wird?"
//
// DER BEFUND, ausgefuehrt und nicht gelesen: Der Tokenizer nimmt EINFACH gequotete Attribute an
// (`'([^']*)'`), deren Wert also ein `"` enthalten darf. `renderAttrs` gibt DOPPELT gequotet aus,
// und `escapeText` escaped `&`, `<`, `>` — aber kein `"`. Gemessen im Rot-Lauf dieses Durchgangs:
//
//     Eingabe:     <img src="data:image/png;base64,AAAA" alt='x" onerror="alert(1)'>
//     Gespeichert: <img src="data:image/png;base64,AAAA" alt="x" onerror="alert(1)">
//     Eingabe:     <a href='#" onclick="alert(3)'>Anker</a>
//     Gespeichert: <a href="#" onclick="alert(3)" rel="…" target="_blank">Anker</a>
//
// Das ist GESPEICHERTES aktives Markup, kein Anzeigefehler.
//
// WO DIESE DATEI ANSETZT — und warum nicht im Editor: EXT1 sagt es fuer BEN ausdruecklich:
// „der Test ist ein Server-Test mit Ruecklesen — die Flaeche ist ‚was gespeichert ist', nicht ‚was
// gerendert wird'." Der Web-Client sanitisiert vor dem Rendern ein ZWEITES Mal
// (`SanitizedHtml.tsx`) und faengt das Attribut ab; in Konsole und Editor ist der Fehler deshalb
// unsichtbar. Gerettet wird die Anlage von einem Zufall, nicht von ihrer Sicherung — und jeder
// kuenftige Konsument ohne zweiten Durchlauf steht offen. Deshalb wird hier ueber die ECHTE
// Entwurfsroute geschrieben und der GESPEICHERTE Stand zurueckgelesen.
//
// Die Einheitenpruefung des Sanitizers selbst (Fixpunkt, `='`-Faelle) steht in
// `services/structure/src/sanitize.test.ts`; hier steht die Kette bis zum Bestand und die
// Paritaet der beiden Fassungen.
import { describe, expect, it } from "vitest";
import { sanitizeHtml as clientSanitize } from "../../apps/web/src/lib/richText";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { sanitizeHtml as serverSanitize } from "../../services/structure";

/** Ein Ereignisattribut entsteht nur, wenn ein echtes, nicht escaptes `"` den Wert schliesst. */
const ALS_ATTRIBUT = (name: string) => new RegExp(`\\s${name}\\s*=\\s*"`, "i");

/** Die Eingaben, an denen sich die Luecke zeigt — plus harmlose zur Kalibrierung. */
const FAELLE: readonly { name: string; html: string }[] = [
  {
    name: "img/alt schliesst den Wert und haengt onerror an",
    html: `<img src="data:image/png;base64,AAAA" alt='x" onerror="alert(1)'>`,
  },
  {
    name: "a/title schliesst den Wert und haengt onclick an",
    html: `<a href="https://example.invalid/x" title='y" onclick="alert(2)'>Text</a>`,
  },
  {
    name: "a/href sieht wie ein Anker aus und haengt onclick an",
    html: `<a href='#" onclick="alert(3)'>Anker</a>`,
  },
  { name: "einfach gequotet, harmlos", html: `<p>Ein <em>Satz</em> mit 'Apostroph'.</p>` },
  { name: "doppelt gequotet, harmlos", html: "<h2>Titel</h2><p>Text</p>" },
];

async function angemeldeteApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@x.de", password: "secret123" },
  });
  return {
    app,
    headers: {
      authorization: `Bearer ${login.json().token}`,
      "content-type": "application/json",
    },
  };
}

describe("JOB 2675 D1 · W0 · Kalibrierung: die Pruefreihe misst wirklich", () => {
  it("die Reihe enthaelt einfach gequotete Attribute mit einem Anfuehrungszeichen im Wert", () => {
    // Ohne diesen Fall koennte die ganze Reihe harmlos sein und jede Zusicherung waere leer.
    const gefaehrlich = FAELLE.filter((f) => /='[^']*"/.test(f.html));
    expect(gefaehrlich.length).toBeGreaterThanOrEqual(3);
  });

  it("die Attributform wuerde ein echtes Ereignisattribut auch finden", () => {
    // Sonst koennten alle Faelle unten gruen sein, weil das Muster an allem vorbeigeht.
    expect(`<img src="x" onerror="alert(1)">`).toMatch(ALS_ATTRIBUT("onerror"));
    expect(`<a href="#" onclick="y">x</a>`).toMatch(ALS_ATTRIBUT("onclick"));
    expect(`<img src="x" alt="harmlos">`).not.toMatch(ALS_ATTRIBUT("onerror"));
  });
});

describe("JOB 2675 D1 · W1 · DIE ABNAHME: was gespeichert wird, traegt kein Ereignisattribut", () => {
  it("Entwurf anlegen und zuruecklesen — der GESPEICHERTE Text hat kein onerror-Attribut", async () => {
    // Die Flaeche im Sinne des Befundes: nicht das Gerenderte, sondern das Gespeicherte. Der Weg
    // ist die echte Route, der Beleg das Zuruecklesen.
    const { app, headers } = await angemeldeteApp();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: JSON.stringify({
        title: "BAADER Wartung",
        statement: "Kurz.",
        type: "best_practice",
        category: "Allgemein",
        origin: "frontdoor",
        bodyHtml: `<p>Vorher</p><img src="data:image/png;base64,AAAA" alt='x" onerror="alert(1)'><p>Nachher</p>`,
      }),
    });
    expect(angelegt.statusCode, angelegt.body.slice(0, 200)).toBe(201);

    const gelesen = await app.inject({
      method: "GET",
      url: `/api/drafts/${angelegt.json().id}`,
      headers,
    });
    expect(gelesen.statusCode).toBe(200);
    const gespeichert = gelesen.json().payload.bodyHtml ?? "";

    expect(gespeichert, `gespeichert: ${gespeichert}`).not.toMatch(ALS_ATTRIBUT("onerror"));
    // Der Inhalt ist nicht verschwunden, sondern entschaerft — der Sanitizer wirft nichts weg.
    expect(gespeichert).toContain("&quot;");
    // Und der Rest des Dokuments steht unveraendert.
    expect(gespeichert).toContain("Vorher");
    expect(gespeichert).toContain("Nachher");
  });

  it("dasselbe fuer einen Link mit `href='#\" onclick=…'`", async () => {
    const { app, headers } = await angemeldeteApp();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: JSON.stringify({
        title: "BAADER Wartung",
        statement: "Kurz.",
        type: "best_practice",
        category: "Allgemein",
        origin: "frontdoor",
        bodyHtml: `<p><a href='#" onclick="alert(3)'>Anker</a></p>`,
      }),
    });
    expect(angelegt.statusCode).toBe(201);
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/drafts/${angelegt.json().id}`,
      headers,
    });
    const gespeichert = gelesen.json().payload.bodyHtml ?? "";
    expect(gespeichert, `gespeichert: ${gespeichert}`).not.toMatch(ALS_ATTRIBUT("onclick"));
  });
});

describe("JOB 2675 D1 · W2 · Der Fixpunkt — die eigentliche Zusicherung", () => {
  it("SERVER: zweimal sanitisieren aendert nichts mehr", () => {
    // `sanitize(sanitize(x)) === sanitize(x)`. Ein Sanitizer, dessen Ausgabe beim zweiten
    // Durchlauf anders aussieht, hat beim ersten etwas erzeugt, das er selbst fuer gefaehrlich
    // haelt. Das ist die Eigenschaft, nicht ein Einzelfall — deshalb ueber die ganze Reihe.
    for (const fall of FAELLE) {
      const einmal = serverSanitize(fall.html);
      expect(
        serverSanitize(einmal),
        `${fall.name} ist serverseitig kein Fixpunkt:\n  einmal: ${einmal}`,
      ).toBe(einmal);
    }
  });

  it("CLIENT: zweimal sanitisieren aendert nichts mehr", () => {
    for (const fall of FAELLE) {
      const einmal = clientSanitize(fall.html);
      expect(
        clientSanitize(einmal),
        `${fall.name} ist clientseitig kein Fixpunkt:\n  einmal: ${einmal}`,
      ).toBe(einmal);
    }
  });
});

describe("JOB 2675 D1 · W4 · `readAnchor` ist mitrepariert — belegt, nicht angenommen", () => {
  // DER NACHTRAG DES KOPFS (`ENTSCHEIDUNGEN/JOB-2675.md`), woertlich: „`readAnchor` verlaesst sich
  // ausdruecklich darauf, dass `renderAttrs` ‚immer doppelt gequotet' ausgibt — genau die Annahme,
  // die R2-15 bricht. Sieh ihn dir an und sag in der Rueckgabe, ob dein Fix ihn mitrepariert."
  //
  // SO SIEHT DER SCHADEN AUS: `readAnchor` sucht die Zeichenfolge ` data-image-id="` und liest bis
  // zum naechsten `"`. Vor dem Fix konnte ein Angreifer diese Zeichenfolge IN EINEM ANDEREN
  // Attributwert unterbringen — `alt='x" data-image-id="untergeschoben'` wurde gespeichert als
  // `alt="x" data-image-id="untergeschoben"`. Der Anker war damit faelschbar, obwohl der Sanitizer
  // echte Anker ueber `isImageAnchorId` streng prueft: die Pruefung greift nur fuer das ECHTE
  // Attribut, nicht fuer eines, das erst beim Ausgeben entsteht.
  //
  // NACH DEM FIX ist die Annahme wiederhergestellt: ein `"` im Wert wird zu `&quot;`, die
  // Zeichenfolge entsteht nicht mehr, und `readAnchor` findet nur echte Anker.
  const UNTERGESCHOBEN = "kw-img-fremd-9";

  it("ein untergeschobener Anker entsteht beim Speichern nicht mehr", () => {
    const gespeichert = serverSanitize(
      `<img src="data:image/png;base64,AAAA" alt='x" data-image-id="${UNTERGESCHOBEN}'>`,
    );
    // Kein ECHTES Ankerattribut — das ist genau die Annahme, auf die sich `readAnchor` stuetzt.
    expect(gespeichert, `gespeichert: ${gespeichert}`).not.toMatch(
      new RegExp(`\\sdata-image-id\\s*=\\s*"${UNTERGESCHOBEN}"`),
    );
    // Der Text bleibt erhalten, nur entschaerft.
    expect(gespeichert).toContain("&quot;");
  });

  it("ein ECHTER Anker bleibt lesbar — die Reparatur nimmt nichts weg", () => {
    // Die Gegenprobe: waere der Fix zu scharf, verschwaende er auch die gueltigen Anker, und
    // Bild-Fussnoten haetten ihre Paarung verloren.
    const echt = serverSanitize(
      `<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-img-abc123-1"><figcaption data-image-id="kw-img-abc123-1">Bildtext</figcaption></figure>`,
    );
    expect(echt).toContain('data-image-id="kw-img-abc123-1"');
    expect(echt).toContain("Bildtext");
  });
});

describe("JOB 2675 D1 · W3 · Paritaet: zwei Fassungen, eine Regel", () => {
  // Der Auftrag verlangt, den Paritaetstest aus JOB 2656 D3 zu erweitern statt einen zweiten
  // danebenzustellen. NACHGESEHEN: Jener Test aus 2656 D3 (Allowlist und Panelzahl) existiert in
  // diesem Klon NICHT — 2656 D3 ist noch nicht eingebaut —, und er deckt inhaltlich nur die
  // BILD-ALLOWLIST ab (`SAFE_INLINE_IMAGE_SRC` gegen `isSafeImgSrc`), nicht `renderAttrs`.
  // (Sein Dateiname steht hier bewusst NICHT ausgeschrieben: der Waechter „JOB 619 D5 · jeder
  // Testverweis im Quelltext loest auf" wuerde an einem Pfad scheitern, den es hier noch nicht
  // gibt — zu Recht.)
  // Die Paritaet fuer diese Funktion steht deshalb hier. Beim Einbau von 2656 D3 stehen beide
  // Paritaetspruefungen nebeneinander und decken verschiedene Funktionen — keine Doppelung.
  it("beide Fassungen liefern fuer dieselbe Eingabe dasselbe Ergebnis", () => {
    for (const fall of FAELLE) {
      const server = serverSanitize(fall.html);
      const client = clientSanitize(fall.html);
      expect(
        client,
        `${fall.name}: Server und Client sind auseinandergelaufen\n  server: ${server}\n  client: ${client}`,
      ).toBe(server);
    }
  });

  it("KALIBRIERUNG: der Vergleich WUERDE einen Unterschied finden", () => {
    // Ohne diesen Fall koennte „beide gleich" auch dann wahr sein, wenn beide Funktionen dasselbe
    // Nichts taeten. Eine Eingabe, die der Sanitizer nachweislich veraendert, zeigt, dass hier
    // ueberhaupt etwas verglichen wird.
    const roh = "<script>alert(1)</script><p>bleibt</p>";
    expect(serverSanitize(roh)).not.toBe(roh);
    expect(serverSanitize(roh)).toBe(clientSanitize(roh));
  });
});
