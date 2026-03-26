# Observability Config Pack (Phase 1)

This folder contains ticket-ready configuration artifacts for alert routing and dashboards.

## Delivery boundary
- These files define desired state and implementation scope.
- They do not auto-provision Sentry alerts or dashboards.
- Any query examples are normative templates, not mandatory production query syntax.

## Files
- `alert-routing.phase1.json`: escalation policy, severity routing, blast-radius reclassification.
- `alerts.phase1.json`: formula-driven alert contracts aligned to `ALRT-*` in docs.
- `dashboards.phase1.json`: dashboard and panel contracts aligned to `DASH-*` and `SLO-*`.

## Manual implementation sequence
1. Configure Sentry notification targets for `#stu-incidents` and incident email list.
2. Implement `Sev1` route with 24x7 interruption.
3. Implement `Sev2` route as business-hours-only.
4. Create alert rules from `alerts.phase1.json`, preserving IDs and formulas.
5. Create dashboards/panels from `dashboards.phase1.json`, preserving panel IDs and SLO links.
6. Run `npm run observability:guard` and store output in implementation ticket.

## PR Guardrail
- Required PR check: `npm run observability:guard`.
- `observability:check-changed-api` fails any changed `app/api/**/route.ts` file missing required observability wiring:
  - `createApiObsContext`
  - `logApiRequestStart`
  - `logApiRequestResult`
  - `attachRequestIdHeader`
  - explicit `routeTemplate`
- `observability:validate-config` enforces alert/dash contracts (IDs, ratio-rule fields, runbook mappings, SLO links).

## Required evidence
- Routing screenshots: `Sev1` and `Sev2` policy pages.
- Alert screenshots: 1 per `ALRT-*` in Phase 1 scope.
- Dashboard screenshot exports for `DASH-API-001`, `DASH-AUTH-001`, `DASH-EXTRACT-001`.
- Validation command output attached to execution ticket.
