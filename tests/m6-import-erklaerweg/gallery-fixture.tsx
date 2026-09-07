import type { FastifyInstance } from "fastify";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import "../../apps/web/src/i18n";

// Derselbe SSR-Einstieg für Browser-Rundweg und Prüfung der ausgelieferten Bytes.
export function registerGalleryFixture(app: FastifyInstance): void {
  const gallery = renderToStaticMarkup(
    createElement(ImportSourceGallery, { onActivate: () => {} }),
  );
  app.get("/import", (_request, reply) =>
    // Ohne Zeichensatz dekodiert der Browser den UTF-8-Pfeil als „â†’“; der
    // unveränderte Rollen-Locator findet dann den tatsächlich gerenderten Link nicht.
    reply
      .type("text/html; charset=utf-8")
      .send(`<!doctype html><html lang="de"><body>${gallery}</body></html>`),
  );
}
