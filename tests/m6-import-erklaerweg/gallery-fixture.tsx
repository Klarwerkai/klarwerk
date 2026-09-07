import type { FastifyInstance } from "fastify";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import "../../apps/web/src/i18n";

// SSR-Einstieg NUR noch für die Prüfung der ausgelieferten Bytes (Linkname überlebt die Dekodierung,
// JOB 3138 R2). JOB 3194 (M6b) hat den Rundweg von hier abgezogen: über die RÜCKKEHR aus der
// Erklärseite sagt diese Fixture nichts mehr — sie liefert nur den Zielabschnitt aus und lädt nichts
// nach, der Anker träfe hier also auch dann, wenn er an der echten Route danebengeht. Belegt wird der
// Rückweg ausschließlich an der gebauten App (`rueckweg-echte-route-chromium.test.ts`,
// `rundweg-tastatur-chromium.test.ts`).
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
