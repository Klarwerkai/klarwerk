// ================================================================================================
// AUFTRAG-mega61 BLOCK A — DIE ERSTE RECHTSFLÄCHE DES PRODUKTS.
// ================================================================================================
//
// Bis mega60 hatte KLARWERK 22 Seiten und keine einzige Rechtsseite: kein Impressum, keine
// Datenschutzerklärung, und beide liegen hinter dem Anmeldetor. Das ist an zwei Stellen falsch —
// § 5 DDG verlangt ein von JEDER Seite erreichbares Impressum, und die Artikel 13/14 DSGVO
// verlangen die Datenschutzerklärung VOR der ersten Datenerhebung. Die erste Datenerhebung ist
// die Anmeldemaske selbst.
//
// DIE TEXTE SIND NICHT HIER FORMULIERT. Sie stehen als i18n-Schlüssel (`legal.*`) und stammen
// wörtlich aus den rechtlich abgewogenen Entwürfen des Kopfes. Diese Datei ist ausschließlich die
// Anordnung — kein Satz Rechtsprosa als JSX-Zeichenkette, in keiner der drei Sprachen.
//
// WAS FEHLT, FEHLT SICHTBAR. Die Angaben, die nur das Unternehmen liefern kann, stehen als
// `legal.tbd.*` mit dem Wert „— wird ergänzt —“. Nichts davon ist erfunden, auch nicht plausibel.
// Damit ein solcher Platzhalter nicht wie ein DEFEKT aussieht, steht der Entwurfsvermerk sichtbar
// am Anfang beider Seiten: das ist der Unterschied zwischen schlampig und bewusst.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFeatures } from "../api/hooks";

/** Die beiden Pfade, einmal. Torwächter, Fußbereich und Tests lesen sie hier — nicht abgeschrieben. */
export const LEGAL_PATHS = {
  imprint: "/impressum",
  privacy: "/datenschutz",
} as const;

export type LegalPage = keyof typeof LEGAL_PATHS;

/** Welche Rechtsseite steht unter diesem Pfad — oder keine? */
export function legalPageForPath(pathname: string): LegalPage | null {
  if (pathname === LEGAL_PATHS.imprint) {
    return "imprint";
  }
  if (pathname === LEGAL_PATHS.privacy) {
    return "privacy";
  }
  return null;
}

/**
 * Der Merkmalsschalter dieser Fläche. VORGABE AN (Server: services/app/src/feature-flags.ts) —
 * er ist ein Notausschalter, keine Freigabesperre. Solange die Auskunft nicht da ist, gilt wie
 * überall fail-closed „aus“; für eine Fläche, die es sonst gar nicht gäbe, ist das das richtige
 * Verhalten (lieber einen Wimpernschlag später als kurz aufblitzen und wieder weg).
 */
export function useRechtsseitenAn(): boolean {
  return useFeatures().data?.features?.rechtsseiten ?? false;
}

/**
 * Für den Torwächter: derselbe Schalter, aber MIT der Auskunft „ist das schon entschieden?“.
 *
 * Warum der Unterschied zählt: Beim Fußbereich ist „noch nicht geklärt“ harmlos — er erscheint
 * einen Wimpernschlag später. An der ROUTE wäre es sichtbar falsch: Der Rückfall einer
 * abgeschalteten Rechtsseite ist die Anmeldemaske, und die für einen Moment zu zeigen, bevor das
 * Impressum erscheint, sähe aus wie ein Fehler. Solange nichts entschieden ist, wird gewartet.
 */
export function useRechtsseitenTor(): { an: boolean; geklaert: boolean } {
  const features = useFeatures();
  return {
    an: features.data?.features?.rechtsseiten ?? false,
    // Auch ein FEHLER ist eine Klärung: Antwortet der Server nicht, gilt fail-closed „aus“ — dann
    // aber sofort und nicht als endloses Warten.
    geklaert: features.isSuccess || features.isError,
  };
}

// ------------------------------------------------------------------------------------------------
// Der Fußbereich. Er gehört auf JEDE Seite einschließlich der Anmeldemaske (§ 5 DDG: von jeder
// Seite mit höchstens zwei Klicks). Die Sammlung unter „Rechtliches“ ist zulässig, solange die
// beiden Bezeichnungen „Impressum“ und „Datenschutz“ erkennbar bleiben — deshalb stehen sie als
// eigene, ausgeschriebene Links da und nicht hinter einem Aufklapper.
//
// Es sind bewusst echte `<a href>` und keine In-App-Navigation: die Rechtsseiten liegen VOR dem
// Torwächter, also außerhalb des Routers. Ein `<Link>` würde auf der Anmeldemaske ins Leere führen.
// ------------------------------------------------------------------------------------------------
export function LegalFooter({
  tone = "muted",
}: { tone?: "muted" | "inverse" }): JSX.Element | null {
  const { t } = useTranslation();
  const an = useRechtsseitenAn();
  if (!an) {
    return null;
  }
  const linkClass =
    tone === "inverse"
      ? "rounded-btn text-white/70 underline underline-offset-2 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      : "rounded-btn text-muted underline underline-offset-2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  return (
    <footer
      data-testid="legal-footer"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-[12px] ${
        tone === "inverse" ? "text-white/50" : "text-muted-2"
      }`}
    >
      <span>{t("legal.footer.title")}</span>
      <a className={linkClass} href={LEGAL_PATHS.imprint}>
        {t("legal.footer.imprint")}
      </a>
      <a className={linkClass} href={LEGAL_PATHS.privacy}>
        {t("legal.footer.privacy")}
      </a>
    </footer>
  );
}

// ------------------------------------------------------------------------------------------------
// Bausteine der beiden Seiten.
// ------------------------------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="mt-7">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-text">{children}</div>
    </section>
  );
}

/** Eine noch offene Angabe. Sie trägt eine eigene Auszeichnung, damit sie nicht wie Inhalt liest. */
function Pending({ value }: { value: string }): JSX.Element {
  return (
    <span data-testid="legal-pending" className="font-mono text-[12.5px] text-muted-2">
      {value}
    </span>
  );
}

/** „Zweck: …“, „Rechtsgrundlage: …“ — Beschriftung und Wert, nicht allein über Farbe getrennt. */
function Labelled({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <p className="text-[13px] text-muted">
      <span className="font-semibold text-text">{label}: </span>
      {children}
    </p>
  );
}

function DraftNotice(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="legal-draft-notice"
      className="rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-4 text-[13px] text-trust-warn-text"
    >
      <strong className="block font-semibold">{t("legal.draftNotice.title")}</strong>
      <span className="mt-1 block">{t("legal.draftNotice.body")}</span>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Impressum (Entwurf Teil 1). § 5 DDG — NICHT § 5 TMG: das Telemediengesetz ist am 14.05.2024 vom
// Digitale-Dienste-Gesetz abgelöst worden. Wer noch TMG zitiert, zitiert eine aufgehobene Vorschrift.
// ------------------------------------------------------------------------------------------------
export function ImprintContent(): JSX.Element {
  const { t } = useTranslation();
  return (
    <article>
      <h1 className="text-2xl font-semibold text-ink">{t("legal.imprint.title")}</h1>
      <div className="mt-4">
        <DraftNotice />
      </div>

      <Section title={t("legal.imprint.ddg")}>
        <p>
          <Pending value={t("legal.tbd.company")} />
        </p>
        <p>
          <Pending value={t("legal.tbd.address")} />
        </p>
      </Section>

      <Section title={t("legal.imprint.representedBy")}>
        <p>
          <Pending value={t("legal.tbd.representative")} />
        </p>
      </Section>

      <Section title={t("legal.imprint.contact")}>
        <Labelled label={t("legal.imprint.contactEmail")}>
          <Pending value={t("legal.tbd.email")} />
        </Labelled>
        <Labelled label={t("legal.imprint.contactPhone")}>
          <Pending value={t("legal.tbd.phone")} />
        </Labelled>
      </Section>

      <Section title={t("legal.imprint.register")}>
        <p>
          <Pending value={t("legal.tbd.register")} />
        </p>
        <p className="text-[12.5px] text-muted-2">{t("legal.imprint.registerNote")}</p>
      </Section>

      <Section title={t("legal.imprint.vat")}>
        <p>{t("legal.imprint.vatText")}</p>
        <p>
          <Pending value={t("legal.tbd.vatId")} />
        </p>
      </Section>

      <Section title={t("legal.imprint.responsible")}>
        <p>
          <Pending value={t("legal.tbd.responsible")} />
        </p>
      </Section>

      <Section title={t("legal.imprint.supervisory")}>
        <p className="text-[12.5px] text-muted-2">{t("legal.imprint.supervisoryNote")}</p>
        <p>
          <Pending value={t("legal.tbd.supervisoryAuthority")} />
        </p>
      </Section>

      <Section title={t("legal.imprint.status")}>
        <p>{t("legal.imprint.statusBody")}</p>
      </Section>
    </article>
  );
}

// ------------------------------------------------------------------------------------------------
// Datenschutzerklärung (Entwurf Teil 2). Jede Tatsachenaussage darin ist am Quelltext belegt
// (Herkunft: RECHT-Entwuerfe-und-Overview.md Teil 5). Wo eine Angabe fehlt, steht ein Platzhalter —
// nicht eine plausible Formulierung.
// ------------------------------------------------------------------------------------------------
export function PrivacyContent(): JSX.Element {
  const { t } = useTranslation();
  const purpose = t("legal.privacy.label.purpose");
  const basis = t("legal.privacy.label.basis");
  const retention = t("legal.privacy.label.retention");
  const recipient = t("legal.privacy.label.recipient");
  return (
    <article>
      <h1 className="text-2xl font-semibold text-ink">{t("legal.privacy.title")}</h1>
      <div className="mt-4">
        <DraftNotice />
      </div>

      <Section title={t("legal.privacy.s1.title")}>
        <p>{t("legal.privacy.s1.body")}</p>
        <p>
          <Pending value={t("legal.tbd.company")} />
        </p>
        <Labelled label={t("legal.privacy.s1.dpo").replace(/:$/, "")}>
          <Pending value={t("legal.tbd.dataProtectionOfficer")} />
        </Labelled>
      </Section>

      <Section title={t("legal.privacy.s2.title")}>
        <p>{t("legal.privacy.s2.body")}</p>
      </Section>

      <Section title={t("legal.privacy.s3.title")}>
        <p>{t("legal.privacy.s3.body")}</p>
        <Labelled label={purpose}>{t("legal.privacy.s3.purpose")}</Labelled>
        <Labelled label={basis}>{t("legal.privacy.s3.basis")}</Labelled>
        <Labelled label={retention}>
          {t("legal.privacy.s3.retention")} <Pending value={t("legal.tbd.retention")} />
        </Labelled>
        <p>{t("legal.privacy.s3.reset")}</p>
      </Section>

      <Section title={t("legal.privacy.s4.title")}>
        <p>{t("legal.privacy.s4.p1")}</p>
        <p>{t("legal.privacy.s4.p2")}</p>
        <p>{t("legal.privacy.s4.p3")}</p>
        <p>{t("legal.privacy.s4.p4")}</p>
        <p>{t("legal.privacy.s4.p5")}</p>
        <p>{t("legal.privacy.s4.p6")}</p>
        {/* AUFTRAG-mega63 Block D: der Merker aus Block A. Ein Browser-Token, der im Produkt
            existiert, aber nicht in dieser Aufzählung steht, macht sie unvollständig. */}
        <p>{t("legal.privacy.s4.p7")}</p>
      </Section>

      <Section title={t("legal.privacy.s5.title")}>
        <p>{t("legal.privacy.s5.body")}</p>
        <Labelled label={basis}>{t("legal.privacy.s5.basis")}</Labelled>
      </Section>

      <Section title={t("legal.privacy.s6.title")}>
        <p>{t("legal.privacy.s6.body")}</p>
        <Labelled label={basis}>{t("legal.privacy.s6.basis")}</Labelled>
        <Labelled label={retention}>
          <Pending value={t("legal.tbd.retention")} />
        </Labelled>
      </Section>

      <Section title={t("legal.privacy.s7.title")}>
        <p>{t("legal.privacy.s7.body")}</p>
        <Labelled label={basis}>{t("legal.privacy.s7.basis")}</Labelled>
        <Labelled label={t("legal.privacy.s7.logs").replace(/:$/, "")}>
          <Pending value={t("legal.tbd.serverLogs")} />
        </Labelled>
      </Section>

      <Section title={t("legal.privacy.s8.title")}>
        <p>{t("legal.privacy.s8.p1")}</p>
        <p>{t("legal.privacy.s8.p2")}</p>
        {/* AUFTRAG-mega61 Block G: die einzige Tatsachenzusicherung dieser Erklärung, die am Code
            hängt. Gedeckt durch tests/ask/mega61-vertraulich-kein-cloud-kontext.test.ts — ohne
            diesen Test dürfte der Satz hier nicht stehen. */}
        <p>{t("legal.privacy.s8.p3")}</p>
        <Labelled label={recipient}>
          <Pending value={t("legal.tbd.modelProvider")} />
        </Labelled>
        <Labelled label={t("legal.privacy.s8.thirdCountry").replace(/:$/, "")}>
          <Pending value={t("legal.tbd.thirdCountry")} />
        </Labelled>
      </Section>

      <Section title={t("legal.privacy.s9.title")}>
        <p>{t("legal.privacy.s9.body")}</p>
        <Labelled label={recipient}>
          <Pending value={t("legal.tbd.mailProvider")} />
        </Labelled>
        <Labelled label={basis}>{t("legal.privacy.s9.basis")}</Labelled>
      </Section>

      <Section title={t("legal.privacy.s10.title")}>
        <p>{t("legal.privacy.s10.body")}</p>
        <Labelled label={recipient}>
          <Pending value={t("legal.tbd.hostingProvider")} />
        </Labelled>
        <Labelled label={basis}>{t("legal.privacy.s10.basis")}</Labelled>
      </Section>

      <Section title={t("legal.privacy.s11.title")}>
        <p>{t("legal.privacy.s11.body")}</p>
      </Section>

      <Section title={t("legal.privacy.s12.title")}>
        <p>{t("legal.privacy.s12.body")}</p>
      </Section>

      <Section title={t("legal.privacy.s13.title")}>
        <p>{t("legal.privacy.s13.body")}</p>
        <Labelled label={t("legal.privacy.s13.contact").replace(/:$/, "")}>
          <Pending value={t("legal.tbd.dataProtectionContact")} />
        </Labelled>
        <p>{t("legal.privacy.s13.authority")}</p>
        <p>
          <Pending value={t("legal.tbd.supervisoryAuthority")} />
        </p>
      </Section>

      <Section title={t("legal.privacy.s14.title")}>
        <p>{t("legal.privacy.s14.body")}</p>
      </Section>

      <Section title={t("legal.privacy.s15.title")}>
        <p>
          {t("legal.privacy.s15.body")} <Pending value={t("legal.tbd.version")} />
        </p>
      </Section>
    </article>
  );
}

/**
 * Die stehende Fläche für beide Seiten — dieselbe Hülle vor UND nach der Anmeldung, damit es nicht
 * zwei Darstellungen desselben Rechtstextes gibt. Sie hängt bewusst nicht in der AppShell: die
 * Seiten müssen ohne Anmeldung erreichbar sein, und die Shell setzt eine Sitzung voraus.
 */
export function LegalScreen({ page }: { page: LegalPage }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 sm:py-12">
        <a
          href="/"
          className="inline-flex rounded-btn text-[13px] text-muted underline underline-offset-2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {t("legal.back")}
        </a>
        <div className="mt-5">{page === "imprint" ? <ImprintContent /> : <PrivacyContent />}</div>
        <div className="mt-10 border-t border-hairline">
          <LegalFooter />
        </div>
      </div>
    </div>
  );
}
