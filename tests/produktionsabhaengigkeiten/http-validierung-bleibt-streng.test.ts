// ================================================================================================
// JOB 4272 · 6b — DIE FASTIFY-ADVISORY BRAUCHT EINE PRIMITIVE BODY-WURZEL. KLARWERK HAT KEINE.
// ================================================================================================
//
// DIE MELDUNG: `fastify` 5.8.5 trägt GHSA-w2qp-rph6-63g4 („schema validation bypass via root
// primitive coercion mismatch", Bereich <5.12.1). Der Recherchebefund vom 16.09.
// (`ABHAENGIGKEITEN-SICHERHEIT.md:21`) grenzt sie ausdrücklich „auf primitive Body-Wurzeln" ein.
//
// DASS DIE LÜCKE AUF DER GEBUNDENEN VERSION WIRKLICH DA IST, ist in dieser Runde gemessen und
// nicht abgeschrieben (Cloud-Lauf 4ff043e98dcb61c356bb8d1b): eine Route mit `body: {type:"number"}`
// nimmt den JSON-Körper `"42"` mit **200** an und reicht dem Handler einen STRING; eine Route mit
// `body: {type:"string"}` nimmt `42` an und reicht eine ZAHL. Der Validator prüft also eine
// coercierte Kopie, der Handler bekommt das Rohe. Das ist die Advisory, am Draht.
//
// UND HIER IST DER PUNKT: Klarwerk hat GENAU ZWEI Routen mit Body-Schema — `POST /api/ask`
// (`services/app/src/routes/ask-routes.ts:288`, `askBodySchema` ab `:23`) und `POST /api/check-text`
// (`services/app/src/routes/check-text-routes.ts:556`, `bodySchema` ab `:57`). BEIDE haben
// `type: "object"`. Eine primitive Body-Wurzel existiert nirgends; die Bedingung der Advisory ist
// damit nicht erfüllt.
//
// URTEIL: nicht exponiert für GHSA-w2qp-rph6-63g4 — an DIESER Bedingung. (Die zweite
// Fastify-Advisory, GHSA-3m5p-2c4r-xxw2 zum trustProxy-Hop-Count, hat eine ANDERE Bedingung und
// ein anderes Urteil; sie steht im Bericht daneben und wird von diesem Test NICHT abgedeckt.)
//
// DER ERSTE FALL IST DER STOLPERDRAHT: Kommt eine dritte Schema-Route hinzu oder wird eine der
// beiden Wurzeln primitiv, wird er rot — und die Einordnung gehört neu gemacht, nicht der Test
// angepasst.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { abweisungsBefund } from "./waechter";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function quelldateien(ordner: string, gesammelt: string[] = []): string[] {
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag);
    if (eintrag === "node_modules" || eintrag === "dist") {
      continue;
    }
    if (statSync(pfad).isDirectory()) {
      quelldateien(pfad, gesammelt);
    } else if (pfad.endsWith(".ts") && !pfad.endsWith(".test.ts")) {
      gesammelt.push(pfad);
    }
  }
  return gesammelt;
}

const ZUGANG = { name: "Admin", email: "job4272-http@x.de", password: "secret123" };

async function angemeldet() {
  const app = buildApp(buildServices());
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: ZUGANG,
  });
  expect(registriert.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  expect(login.statusCode).toBe(200);
  return {
    app,
    headers: {
      authorization: `Bearer ${login.json().token as string}`,
      "content-type": "application/json",
    },
  };
}

describe("JOB 4272 · die Bedingung der Fastify-Advisory ist nicht erfüllt", () => {
  it("jedes Body-Schema des Produkts hat eine OBJEKT-Wurzel — keine primitive", () => {
    const mitSchema: string[] = [];
    for (const datei of quelldateien(join(WURZEL, "services"))) {
      const text = readFileSync(datei, "utf8");
      if (/schema:\s*\{\s*body:/.test(text)) {
        mitSchema.push(datei.slice(WURZEL.length + 1));
      }
    }
    expect(
      [...mitSchema].sort(),
      "Die Menge der Routen mit Body-Schema hat sich geändert. Die Einordnung von GHSA-w2qp-rph6-63g4 ruht darauf, dass JEDE Body-Wurzel ein Objekt ist — neu prüfen, Test NICHT anpassen.",
    ).toEqual([
      "services/app/src/routes/ask-routes.ts",
      "services/app/src/routes/check-text-routes.ts",
    ]);

    // Und die beiden Wurzeln selbst: `const <name>Schema = { type: "object"` — nichts Primitives.
    for (const datei of mitSchema) {
      const text = readFileSync(join(WURZEL, datei), "utf8");
      for (const treffer of text.matchAll(/const \w*[Bb]odySchema = \{\s*\n\s*type: "(\w+)"/g)) {
        expect(treffer[1], `${datei}: Body-Wurzel ist „${String(treffer[1])}" statt object`).toBe(
          "object",
        );
      }
    }
  });
});

describe("JOB 4272 · 6b — die HTTP-Validierung weist weiter ab", () => {
  it("ein nicht coercierbarer Feldwert wird abgewiesen (400), der Handler sieht ihn nie", async () => {
    const { app, headers } = await angemeldet();
    try {
      for (const frage of [{ verschachtelt: true }, ["a", "b"]]) {
        const res = await app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: JSON.stringify({ question: frage }),
        });
        // Dieselbe Funktion fährt `kalibrierung.test.ts` gegen eine Route OHNE Schema; dort muss
        // sie reden, hier muss sie schweigen.
        expect(abweisungsBefund(res.statusCode, res.body)).toBeNull();
        expect(res.body).toContain("FST_ERR_VALIDATION");
      }
      // Ein Wert ausserhalb des `enum` ist ebenfalls nicht coercierbar.
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: JSON.stringify({ question: "Frage?", mode: "gibt-es-nicht" }),
      });
      expect(res.statusCode, res.body.slice(0, 200)).toBe(400);
    } finally {
      await app.close();
    }
  });

  // ==============================================================================================
  // WAS HIER BEWUSST NICHT BEHAUPTET WIRD — gemessen, nicht angenommen.
  // ==============================================================================================
  // `{ question: 123 }` kommt mit **200** durch: ajv coerciert die Zahl zum String, weil Fastify
  // `coerceTypes` standardmässig anhat. Das ist dokumentiertes Fastify-Verhalten und NICHT
  // GHSA-w2qp-rph6-63g4 — bei einer OBJEKT-Wurzel bekommt der Handler den coercierten Wert, die
  // Prüfung und die Weitergabe sind also EINIG. Die Advisory beschreibt genau den Fall, in dem sie
  // das nicht sind, und der tritt nur bei einer primitiven Wurzel auf.
  //
  // Der Fall steht hier, damit niemand später „die API prüft Typen streng" aus diesem Ordner
  // herausliest. Sie tut es nicht; sie coerciert, und das ist gewollt.
  it("MESSPUNKT: ein coercierbarer Feldwert kommt durch — das ist Fastify-Vorgabe, keine Lücke", async () => {
    const { app, headers } = await angemeldet();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: JSON.stringify({ question: 123 }),
      });
      expect(res.statusCode, res.body.slice(0, 200)).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("ein Wert jenseits der Längengrenze wird abgewiesen (400)", async () => {
    const { app, headers } = await angemeldet();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: JSON.stringify({ question: "x".repeat(8_001) }),
      });
      expect(res.statusCode, res.body.slice(0, 200)).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("DER FALL DER ADVISORY: eine PRIMITIVE Body-Wurzel wird abgewiesen, nicht coerciert", async () => {
    const { app, headers } = await angemeldet();
    try {
      // Genau die Form, die GHSA-w2qp-rph6-63g4 beschreibt — nur in der Richtung, die Klarwerk
      // wirklich hat: das Schema erwartet ein Objekt, der Körper ist ein JSON-Primitiv.
      for (const koerper of ['"hallo"', "42", "true", "null"]) {
        const res = await app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: koerper,
        });
        expect(
          res.statusCode,
          `Primitiver Body ${koerper} kam mit ${res.statusCode} durch: ${res.body.slice(0, 200)}`,
        ).toBe(400);
      }
    } finally {
      await app.close();
    }
  });
});
