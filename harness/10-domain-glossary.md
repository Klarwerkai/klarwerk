# 10 — Domänen-Glossar

> Verbindliche Begriffe für Code, Specs und Doku. Quelle: KLARWERK-Pflichtenheft v1.0 + Originalprojekt.

## Produkt
| Begriff | Definition |
|---|---|
| **KLARWERK** | Enterprise Knowledge Capital Platform: erfasst, strukturiert, validiert, pflegt und gibt industrielles Erfahrungswissen wieder aus. |
| **KO (Wissensobjekt)** | Zentrale Entität: ein erfasstes Wissensstück mit Status, Validierung, Bewährung durch Nutzung. |
| **Reasoner** | Gekapselte, austauschbare KI-Schicht (`/api/reasoner`: structure \| ask). Mock ohne Key, echtes Claude mit `ANTHROPIC_API_KEY`. |
| **Wissensarten** | Fünf Typen (💡 Idee · 🏛 Prinzip · 📈 Erfahrung · 🔧 Technik · ⛔ Verbot). Titel als Aussagen, nicht als Fragen. |
| **Re-Validierung** | KO wird bei Anlagenänderung erneut geprüft. |

## Rollen (RBAC)
| Rolle | Kurz |
|---|---|
| **Viewer** | Lesen/Abfragen. |
| **Experte** | Wissen erfassen/einreichen. |
| **Controller** | Validieren/priorisieren. |
| **Admin** | Nutzerverwaltung, Freigaben, Setup. Erstes Konto einer leeren Instanz wird Admin. |

## Prozess / Harness
| Begriff | Definition | Ort |
|---|---|---|
| Stakeholder | Pedi — gibt Idee, Richtung, Freigabe | |
| Pflichtenheft | Verbindliche Anforderungen (FR-/NFR + Abnahmekriterien) = WAS | `/specs` |
| Harness | Steuergerüst aus Regeln, Tools, Tests = WIE | `/harness` |
| Anforderungs-IDs | `FR-<Bereich>-<Nr>` funktional · `NFR-<Bereich>-<Nr>` nichtfunktional | |

## Technische Referenz (Originalprojekt)
Frontend Vite/React · Backend Cloudflare Pages Worker (`_worker.js`) · DB Cloudflare D1 (`schema.sql`: users, sessions, kos, drafts, audit) · Auth PBKDF2-SHA256, Session-Cookie. *Hinweis: Stack für die Neuauflage ist eine offene Entscheidung — siehe `SETUP.md`.*
