import type { FastifySchema } from "fastify";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Enthält auch inline registrierte Schemata und weitere Routen in derselben Datei. */
export async function routenschemata(): Promise<Record<string, FastifySchema>> {
  // Die optionale /api/check-text-Route gehört zum Produktinventar.
  const vorher = process.env.KLARWERK_ADDON_API;
  process.env.KLARWERK_ADDON_API = "1";
  try {
    return await erhebeSchemata();
  } finally {
    if (vorher === undefined) Reflect.deleteProperty(process.env, "KLARWERK_ADDON_API");
    else process.env.KLARWERK_ADDON_API = vorher;
  }
}

async function erhebeSchemata(): Promise<Record<string, FastifySchema>> {
  const app = buildApp(buildServices());
  const schemata: Record<string, FastifySchema> = {};
  app.addHook("onRoute", (route) => {
    if (route.schema && Object.keys(route.schema).length > 0) {
      // Fastify ergänzt die ursprüngliche Definition beim Kompilieren um interne Symbole.
      schemata[`${route.method} ${route.url}`] = structuredClone(route.schema);
    }
  });
  try {
    await app.ready();
    return schemata;
  } finally {
    await app.close();
  }
}
