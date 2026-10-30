# Light House – Mess Meal Manager

Meals, bazar, bills and month-end settlement for a shared mess. One codebase ships as a web app (GitHub Pages, installable PWA) and an Android app (Capacitor), backed by a free-tier Supabase project.

- **Live:** https://julfikerhaider2001.github.io/Light-House-Management/
- **Android APK:** [latest release](https://github.com/julfikerhaider2001/Light-House-Management/releases/latest)

> Work in progress. Phase 1 (pipeline) is in place; the full guide (architecture, adding members, restore from backup) lands with the feature phases.

## Pipeline

Every change goes through a pull request. All six gates are required on `main`:

| Gate | What it proves                                                                               |
| ---- | -------------------------------------------------------------------------------------------- |
| G1   | Prettier, ESLint (0 warnings), `tsc --noEmit`, gitleaks, `npm audit --audit-level=high`      |
| G2   | Vitest, ≥ 95% coverage on `src/lib/calc/**`                                                  |
| G3   | Migrations apply from zero, `supabase db lint`, pgTAP, generated types match the schema      |
| G4   | Production build, `version.json` carries the commit, initial JS ≤ 250 KB gzip                |
| G5   | Playwright (desktop + mobile) against local Supabase                                         |
| G6   | Lighthouse (perf ≥ 85, a11y ≥ 95, best practices ≥ 90) and Chrome's PWA installability check |

A merge to `main` re-runs the gates, then deploys: **D1** database migrations → **D2** GitHub Pages → **D3** smoke test (live `version.json` = commit, prod `health()` healthy; failures open an issue) → **D4** signed APK release.

## Local development

```sh
npm ci
cp .env.example .env.local   # point at local or prod Supabase (publishable key only)
npm run dev
```
