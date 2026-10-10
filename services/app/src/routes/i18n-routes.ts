import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type { I18nService } from "../../../i18n";
import type { Guards } from "../http";
import {
  GRUNDSPRACHEN,
  TEXT_MAX_ZEICHEN,
  type UebersetzungRepo,
  istGrundsprache,
  istSprachkennung,
  istTextschluessel,
  istZulaessigerSprachname,
  istZulaessigerText,
} from "../uebersetzungen";

// Mehrsprachigkeit (FR-I18N). UI-Strings sind öffentlich lesbar (kein Login nötig).
//
// R-1034 / FR-I18N-02 · DIE PFLEGE IM LAUFENDEN BETRIEB. Die Lesewege bleiben öffentlich — dieselbe
// Klasse wie `/api/branding`: die Anmeldemaske braucht ihre Texte, bevor es eine Sitzung gibt, und
// ausgeliefert werden Oberflächentexte, kein Bestand. Die drei Schreibwege sind Verwaltung und
// tragen dieselbe Schranke wie die Markenwahl: `requirePermission("users.manage")` im Rumpf.
// Ins Prüfprotokoll gehen Sprache und Schlüssel, NICHT der Text — der steht in der Ablage und ist
// dort auch wieder entfernbar; das Protokoll ist anhängend und könnte ihn nie mehr hergeben.

export interface I18nRouteDienste {
  i18n: I18nService;
  uebersetzungen: UebersetzungRepo;
  // Optional wie an `brandingRoutes`: direkte Test-Aufrufer bleiben kompatibel.
  audit?: AuditService;
}

/** Ist diese Sprache der Instanz bekannt — mitgeliefert oder angelegt? Nur dann wird gepflegt. */
async function istBekannteSprache(dienste: I18nRouteDienste, kennung: string): Promise<boolean> {
  if (istGrundsprache(kennung)) {
    return true;
  }
  return (await dienste.uebersetzungen.zusatzSprachen()).some((s) => s.kennung === kennung);
}

export function i18nRoutes(dienste: I18nRouteDienste, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    // Die Sprachen der Instanz: die mitgelieferten und die angelegten. `locales` bleibt die bisherige
    // flache Liste; `sprachen` sagt zusätzlich, welche davon das Bündel selbst mitbringt.
    app.get("/api/i18n/locales", async (_request, reply) => {
      const zusatz = await dienste.uebersetzungen.zusatzSprachen();
      const kennungen = [
        ...new Set([...GRUNDSPRACHEN, ...zusatz.map((s) => s.kennung), ...dienste.i18n.locales()]),
      ];
      reply.code(200).send({
        locales: kennungen,
        sprachen: kennungen.map((kennung) => ({
          kennung,
          name: zusatz.find((s) => s.kennung === kennung)?.name ?? null,
          grundsprache: istGrundsprache(kennung),
        })),
      });
    });

    // Alle im Betrieb gepflegten Texte EINER Sprache — das, was die Oberfläche über ihren
    // mitgelieferten Bestand legt. Eine unbekannte, aber formgerechte Sprache hat schlicht keine.
    app.get<{ Params: { locale: string } }>("/api/i18n/:locale", async (request, reply) => {
      const sprache = request.params.locale;
      if (!istSprachkennung(sprache)) {
        reply.code(400).send({ error: "INVALID_LOCALE", message: "Unbekannte Sprachkennung." });
        return;
      }
      reply.code(200).send({ sprache, texte: await dienste.uebersetzungen.texte(sprache) });
    });

    app.get<{ Params: { locale: string; key: string } }>(
      "/api/i18n/:locale/:key",
      async (request, reply) => {
        const { locale, key } = request.params;
        const gepflegt = istSprachkennung(locale) ? await dienste.uebersetzungen.texte(locale) : {};
        // `Object.hasOwn`: ein Schlüssel wie `constructor` ist kein gepflegter Text.
        const angepasst = Object.hasOwn(gepflegt, key) ? gepflegt[key] : undefined;
        reply.code(200).send({ value: angepasst ?? dienste.i18n.translate(key, locale) });
      },
    );

    app.put<{ Params: { locale: string; key: string }; Body: { text?: unknown } }>(
      "/api/admin/i18n/:locale/:key",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const { locale, key } = request.params;
        if (!istSprachkennung(locale) || !(await istBekannteSprache(dienste, locale))) {
          reply.code(400).send({
            error: "UNKNOWN_LOCALE",
            message: "Diese Sprache ist weder mitgeliefert noch angelegt.",
          });
          return;
        }
        if (!istTextschluessel(key)) {
          reply.code(400).send({ error: "INVALID_KEY", message: "Ungültiger Textschlüssel." });
          return;
        }
        const text = request.body?.text;
        if (!istZulaessigerText(text)) {
          reply.code(400).send({
            error: "INVALID_TEXT",
            message: `Erwartet wird { text } — nicht leer, höchstens ${TEXT_MAX_ZEICHEN} Zeichen.`,
          });
          return;
        }
        const am = new Date().toISOString();
        await dienste.uebersetzungen.setzeText(locale, key, text, user.id, am);
        await dienste.audit?.record({
          actor: user.id,
          action: "i18n.text-set",
          target: `${locale}:${key}`,
          payload: { sprache: locale, schluessel: key },
        });
        reply.code(200).send({ sprache: locale, schluessel: key, text });
      },
    );

    // Zurück zum mitgelieferten Text: die Anpassung wird entfernt, der Grundbestand gilt wieder.
    app.delete<{ Params: { locale: string; key: string } }>(
      "/api/admin/i18n/:locale/:key",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const { locale, key } = request.params;
        if (!istSprachkennung(locale) || !istTextschluessel(key)) {
          reply.code(400).send({
            error: "INVALID_KEY",
            message: "Ungültige Sprache oder Schlüssel.",
          });
          return;
        }
        const entfernt = await dienste.uebersetzungen.entferneText(locale, key);
        if (entfernt) {
          await dienste.audit?.record({
            actor: user.id,
            action: "i18n.text-reset",
            target: `${locale}:${key}`,
            payload: { sprache: locale, schluessel: key },
          });
        }
        reply.code(200).send({ sprache: locale, schluessel: key, entfernt });
      },
    );

    // FR-I18N-02: eine weitere Sprache anlegen oder umbenennen — ohne Code und ohne Bau. Die
    // mitgelieferten Sprachen sind keine anlegbaren Einträge; sie stehen fest im Bündel.
    app.put<{ Params: { locale: string }; Body: { name?: unknown } }>(
      "/api/admin/i18n-sprachen/:locale",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const kennung = request.params.locale;
        if (!istSprachkennung(kennung) || istGrundsprache(kennung)) {
          reply.code(400).send({
            error: "INVALID_LOCALE",
            message:
              "Erwartet wird eine neue Sprachkennung wie „fr“ oder „pt-BR“; de, en und nl sind mitgeliefert.",
          });
          return;
        }
        const name = request.body?.name;
        if (!istZulaessigerSprachname(name)) {
          reply.code(400).send({
            error: "INVALID_NAME",
            message: "Erwartet wird { name } — der Anzeigename der Sprache.",
          });
          return;
        }
        const sprache = { kennung, name: name.trim() };
        await dienste.uebersetzungen.setzeSprache(sprache, user.id, new Date().toISOString());
        await dienste.audit?.record({
          actor: user.id,
          action: "i18n.language-set",
          target: kennung,
          payload: { sprache: kennung },
        });
        reply.code(200).send(sprache);
      },
    );
  };
}
