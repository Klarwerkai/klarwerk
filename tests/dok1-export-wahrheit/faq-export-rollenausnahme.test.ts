import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { FAQ_CONTENT, type FaqItem } from "../../apps/web/src/lib/faqContent";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Role } from "../../services/auth";
import { ROLE_PERMISSIONS, can } from "../../services/rbac/src/policy";

// Anzeigeweg: FAQ_CONTENT -> KlaraAssistant (gemessen in faq-anzeigeweg.test.tsx).
// DOK1-R: Text wird in Regeln übersetzt; das Urteil vergleicht deren Wahrheitstabelle mit
// echten HTTP-Exporten. KEIN Rollenwort/dürfen/validiert ist für sich ein Beleg.
// Bewusst begrenzte Grammatik: Subjekt + Modalverb + Objekt + Handlung (+ Negation),
// Relativsatz-Ausnahme und expliziter Ausschluss der übrigen Rollen. Unbekannte Aussagen
// werden nicht freigegeben. Neue sprachliche Bauformen brauchen eine positive UND negative
// Kalibrierung; dies ist kein allgemeiner Parser für beliebige deutsche Prosa.
const roles = Object.keys(ROLE_PERMISSIONS) as Role[];
const names: Record<Role, string> = {
  admin: "administratoren|admins?",
  controller: "controllern?",
  viewer: "viewer|betrachter",
  experte: "experten?",
};
const roleWord = `(?:${roles.map((role) => names[role]).join("|")})`;
const subject = `${roleWord}(?:(?:, | und )${roleWord})*`;
const permission = new RegExp(
  `^(?:auch )?(${subject}) (?:dürfen|können) (.+?) (exportieren|extern weitergeben|in der app ansehen)(, und nur validierte)?$`,
);
const relativePermission = new RegExp(
  `^ausgenommen sind (${subject}), die (.+?) (exportieren|extern weitergeben) dürfen$`,
);
const object =
  /^(?:(ausschließlich|nur|auch nicht|nicht) )?(validierte )?(?:(?:streng )?vertrauliche (?:und streng vertrauliche )?)?(?:wissens)?objekte(?: (niemals|nicht))?$/;
type Rule = {
  roles: Role[];
  action: "export" | "read";
  valid: boolean;
  unvalidated: boolean;
};
type Observation = { role: Role; validated: boolean; confidential: string; exported: boolean };
const observations: Observation[] = [];

function collect(entries: readonly FaqItem[]): FaqItem[] {
  return entries.filter(
    ({ answer }) =>
      (/vertraulich|sensibles wissen/i.test(answer) &&
        /objekt|sensibles wissen/i.test(answer) &&
        /export|extern\w* kontext|extern\w* weiter|nach außen/i.test(answer)) ||
      /dürfen .*objekte in der app ansehen/i.test(answer),
  );
}

function interpret(answer: string): Rule[] {
  const rules: Rule[] = [];
  let defaultExclusion = false;
  const clauses = answer
    .toLowerCase()
    .split(/[.;:—]/)
    .map((part) => part.trim());
  for (const clause of clauses) {
    const relative = relativePermission.exec(clause);
    const match = permission.exec(clause) ?? relative;
    if (match) {
      if (defaultExclusion && !relative) throw new Error("Grundsperre ohne ausdrückliche Ausnahme");
      const [, who, what, action, trailingLimit] = match;
      if (!who || !what || !action) throw new Error(`Unvollständige Erlaubnis: ${clause}`);
      const noun = object.exec(what);
      if (!noun) {
        throw new Error(`Nicht eindeutig verstandene Objekt-/Validierungsgrenze: ${clause}`);
      }
      const [, quantifier, validated, denied] = noun;
      const selected = roles.filter((role) => new RegExp(`\\b(?:${names[role]})\\b`).test(who));
      rules.push({
        roles: selected,
        action: action === "in der app ansehen" ? "read" : "export",
        valid: !denied && quantifier !== "nicht",
        unvalidated:
          !denied &&
          !(trailingLimit || (validated && /^(nur|ausschließlich)$/.test(quantifier ?? ""))),
      });
      if (defaultExclusion) {
        rules.push({
          roles: roles.filter((role) => !selected.includes(role)),
          action: "export",
          valid: false,
          unvalidated: false,
        });
        defaultExclusion = false;
      }
    } else if (
      /^als vertraulich markierte objekte bleiben aus dem regulären export draußen$/.test(clause)
    ) {
      defaultExclusion = true;
    } else if (
      /^für alle anderen rollen bleiben (sie|vertrauliche objekte) aus dem export$/.test(clause)
    ) {
      const previous = rules.at(-1);
      if (!previous || previous.action !== "export") {
        throw new Error("Ausschluss ohne vorherige Exporterlaubnis");
      }
      rules.push({
        roles: roles.filter((role) => !previous.roles.includes(role)),
        action: "export",
        valid: false,
        unvalidated: false,
      });
    } else if (
      /^(?:als vertraulich markierte|vertrauliche) objekte werden (?:grundsätzlich nicht|niemals|nie) exportiert$/.test(
        clause,
      ) ||
      /^solche objekte werden nie in externe kontexte gegeben, also weder exportiert noch in erzeugte dokumente aufgenommen$/.test(
        clause,
      ) ||
      /verhinderst du, dass sensibles wissen jemals in exporte oder erzeugte dokumente gelangt$/.test(
        clause,
      ) ||
      /als vertraulich markierte objekte gehen grundsätzlich nicht in externe kontexte$/.test(
        clause,
      )
    ) {
      rules.push({ roles, action: "export", valid: false, unvalidated: false });
    } else if (
      /vertraulich.*(?:export|externe kontexte)|sensibles wissen.*export|(?:dürfen|können).*export|(?:exportieren|weitergeben) dürfen|(?:sie|solche objekte).*export/.test(
        clause,
      )
    ) {
      // Insbesondere auch eine alte absolute Sperre NEBEN einer neuen Erlaubnis bleibt rot.
      throw new Error(`Unbelegte oder widersprüchliche Exportaussage: ${clause}`);
    }
  }
  if (defaultExclusion) throw new Error("Grundsperre ohne ausdrückliche Ausnahme");
  return rules;
}

function judge(answer: string, measured: readonly Observation[]): string[] {
  let rules: Rule[];
  try {
    rules = interpret(answer);
  } catch (error) {
    // BEN R6 soll die Handlung benennen, auch wenn davor ein absolutes Exportverbot steht.
    if (/dürfen [^. ;]*objekte in der app ansehen/i.test(answer)) {
      return ["Leseerlaubnis, keine Exporterlaubnis"];
    }
    return [(error as Error).message];
  }
  const exports = rules.filter((rule) => rule.action === "export");
  if (rules.some((rule) => rule.action === "read") && !exports.some((rule) => rule.valid)) {
    return ["Leseerlaubnis, keine Exporterlaubnis"];
  }
  if (!exports.length) {
    return [
      rules.some((rule) => rule.action === "read")
        ? "Leseerlaubnis, keine Exporterlaubnis"
        : "Keine belegte Exporterlaubnis",
    ];
  }
  return measured.flatMap((row) => {
    const predictions = exports
      .filter((rule) => rule.roles.includes(row.role))
      .map((rule) => (row.validated ? rule.valid : rule.unvalidated));
    return predictions.length > 0 && predictions.every((prediction) => prediction === row.exported)
      ? []
      : [
          `${row.role}/${row.confidential}/${row.validated ? "validiert" : "nicht validiert"}: FAQ=${predictions.length ? predictions.join(",") : "unbekannt"}, HTTP-Export=${row.exported}`,
        ];
  });
}

beforeAll(async () => {
  const services = buildServices();
  const app = buildApp(services);
  try {
    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "dok-admin@example.test", password: "secret123" },
    });
    expect(registered.statusCode).toBe(201);
    const login = async (email: string) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "secret123" },
      });
      expect(response.statusCode).toBe(200);
      return { authorization: `Bearer ${response.json().token}` };
    };
    const adminHeaders = await login("dok-admin@example.test");
    const fixtures: {
      id: string;
      validated: boolean;
      confidential: "intern" | "vertraulich" | "streng_vertraulich";
    }[] = [];
    for (const confidential of ["intern", "vertraulich", "streng_vertraulich"] as const) {
      for (const validated of [false, true]) {
        const ko = await services.ko.create({
          title: `${confidential}-${validated}`,
          statement: "Export-Testobjekt",
          type: "best_practice",
          category: "DOK1",
          author: "admin",
          tags: [],
        });
        if (validated)
          await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });
        await services.ko.setConfidentiality(ko.id, confidential, "admin");
        fixtures.push({ id: ko.id, confidential, validated });
      }
    }
    for (const role of roles) {
      const email = `dok-${role}-probe@example.test`;
      const created = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: adminHeaders,
        payload: { name: role, email, password: "secret123", role },
      });
      expect(created.statusCode).toBe(201);
      const response = await app.inject({
        method: "GET",
        url: "/api/library/export",
        headers: await login(email),
      });
      expect(response.statusCode, role).toBe(can(role, "ko.read") ? 200 : 403);
      const ids = can(role, "ko.read")
        ? (response.json() as { id: string }[]).map((item) => item.id)
        : [];
      for (const fixture of fixtures) {
        const exported = ids.includes(fixture.id);
        expect(
          exported,
          `${role}/${fixture.confidential}/${fixture.validated}: Bindung an ko.validate`,
        ).toBe(
          can(role, "ko.read") &&
            fixture.validated &&
            (fixture.confidential === "intern" || can(role, "ko.validate")),
        );
        if (fixture.confidential !== "intern")
          observations.push({
            role,
            validated: fixture.validated,
            confidential: fixture.confidential,
            exported,
          });
      }
    }
  } finally {
    await app.close();
  }
});

const cases = [
  {
    name: "a: Leseerlaubnis",
    answer:
      "Administratoren und Controller dürfen ausschließlich validierte Objekte in der App ansehen.",
    ok: false,
  },
  {
    name: "b: Exporterlaubnis mit Grenze",
    answer:
      "Administratoren und Controller dürfen vertrauliche Objekte exportieren, und nur validierte; für alle anderen Rollen bleiben sie aus dem Export.",
    ok: true,
  },
  {
    name: "c: nachgestelltes Exportverbot (BEN R5)",
    answer:
      "Auch Administratoren und Controller dürfen validierte vertrauliche Objekte niemals exportieren.",
    ok: false,
  },
  {
    name: "c: verneinte Ausnahme",
    answer:
      "Vertrauliche Objekte werden niemals exportiert, auch nicht von Administratoren und Controllern.",
    ok: false,
  },
  {
    name: "d: nicht validierte Objekte (BEN R5)",
    answer:
      "Als vertraulich markierte Objekte bleiben aus dem regulären Export draußen — ausgenommen sind Administratoren und Controller, die auch nicht validierte Objekte exportieren dürfen.",
    ok: false,
  },
  {
    name: "positive Gegenfassung zur Relativsatz-Ausnahme aus BEN R5",
    answer:
      "Als vertraulich markierte Objekte bleiben aus dem regulären Export draußen — ausgenommen sind Administratoren und Controller, die ausschließlich validierte Objekte exportieren dürfen.",
    ok: true,
  },
  {
    name: "d: direkte Erlaubnis für Nichtvalidiertes",
    answer:
      "Administratoren und Controller dürfen auch nicht validierte Objekte exportieren; für alle anderen Rollen bleiben sie aus dem Export.",
    ok: false,
  },
  {
    name: "umformulierte externe Weitergabe",
    answer:
      "Controller und Admins können nur validierte vertrauliche Objekte extern weitergeben; für alle anderen Rollen bleiben sie aus dem Export.",
    ok: true,
  },
  {
    name: "Validierungsgrenze fehlt",
    answer:
      "Administratoren und Controller dürfen vertrauliche Objekte exportieren; für alle anderen Rollen bleiben sie aus dem Export.",
    ok: false,
  },
  {
    name: "falsche Rollen trotz Exporthandlung",
    answer:
      "Viewer und Experten dürfen nur validierte vertrauliche Objekte exportieren; für alle anderen Rollen bleiben sie aus dem Export.",
    ok: false,
  },
  {
    name: "absolute Sperre neben echter Ausnahme",
    answer:
      "Vertrauliche Objekte werden niemals exportiert. Administratoren und Controller dürfen nur validierte vertrauliche Objekte exportieren; für alle anderen Rollen bleiben sie aus dem Export.",
    ok: false,
  },
] as const;

describe("DOK1-R: FAQ gegen den gemessenen Exportvertrag", () => {
  it("Sammler erreicht die vier Ausgangsaussagen und neue Kennungen", () => {
    const found = collect(FAQ_CONTENT).map((item) => item.id);
    for (const id of ["faq.vertrauen.4", "faq.vertrauen.5", "faq.bibliothek.6", "faq.ki.3"])
      expect(found).toContain(id);
    expect(
      collect([{ id: "faq.neu", question: "Neu", answer: cases[1].answer, route: "/" }]),
    ).toHaveLength(1);
  });

  for (const item of collect(FAQ_CONTENT)) {
    it(`${item.id}: Aussage entspricht HTTP-Export und Validierungsgrenze`, () => {
      expect(
        judge(item.answer, observations),
        `${item.id}: gemessener includeConfidential = can(role, "ko.validate")`,
      ).toEqual([]);
    });
  }

  for (const calibration of cases) {
    it(`Kalibrierung ${calibration.name}: ${calibration.ok ? "grün" : "rot"}`, () => {
      expect(judge(calibration.answer, observations).length === 0).toBe(calibration.ok);
    });
  }

  it("Red-first-Kalibrierung: dürfen allein segnet Lesen ab; Handlungsbindung weist es zurück", () => {
    const legacyWordOnly = (answer: string) => /dürfen/.test(answer);
    expect(legacyWordOnly(cases[0].answer)).toBe(true);
    expect(judge(cases[0].answer, observations)).toEqual(["Leseerlaubnis, keine Exporterlaubnis"]);
    expect(
      judge(`Vertrauliche Objekte werden niemals exportiert; ${cases[0].answer}`, observations),
    ).toEqual(["Leseerlaubnis, keine Exporterlaubnis"]);
  });

  it("Messdaten tragen das Urteil: gekippte Route kippt dieselbe korrekte Aussage", () => {
    expect(judge(cases[1].answer, observations)).toEqual([]);
    expect(
      judge(
        cases[1].answer,
        observations.map((row) => ({ ...row, exported: !row.exported })),
      ),
    ).not.toEqual([]);
  });

  it("Doku-Spiegel: jede erhobene Antwort steht unter ihrer eigenen Kennung", () => {
    const doc = readFileSync(
      resolve(
        __dirname,
        "../../docs/team2-austausch/HILFE_LIEFERUNG-3a_FAQ-ANTWORTEN_2026-07-05.md",
      ),
      "utf8",
    );
    const sections = doc.split(/^### /m).slice(1);
    const normalize = (value: string) => value.replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    for (const item of collect(FAQ_CONTENT)) {
      const matching = sections.filter((section) => section.startsWith(`${item.id} ·`));
      expect(matching, item.id).toHaveLength(1);
      const answer =
        (matching[0] ?? "").split("\n").slice(1).join("\n").split("*Verwandt:").at(0)?.trim() ?? "";
      expect(normalize(answer), item.id).toBe(normalize(item.answer));
    }
  });
});
