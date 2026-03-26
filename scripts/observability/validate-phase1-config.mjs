import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ALERTS_PATH = path.join(ROOT, "config/observability/alerts.phase1.json");
const DASHBOARDS_PATH = path.join(ROOT, "config/observability/dashboards.phase1.json");
const RUNBOOKS_PATH = path.join(ROOT, "docs/observability-runbooks.md");

const REQUIRED_ALERT_FIELDS = [
  "alert_id",
  "aggregation_window",
  "sustain_period",
  "threshold_formula",
  "minimum_sample_volume",
  "deduplication_key",
  "auto_close_condition",
  "paging_eligibility",
  "data_source_type",
  "runbook_id"
];

const VALID_DATA_SOURCES = new Set(["sentry", "metric", "log-derived", "db-derived"]);
const VALID_OUTCOMES = new Set(["success", "failure", "timeout", "retry", "dropped"]);
const EXPECTED_SLOS = new Set([
  "SLO-API-AVAIL-001",
  "SLO-AUTH-LOGIN-001",
  "SLO-EXTRACT-RESUME-001",
  "SLO-TRANSCRIPT-PARSE-001",
  "SLO-ATS-PIPELINE-001"
]);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const isRatioFormula = (formula) => formula.includes("/");

const errors = [];

const alertsConfig = readJson(ALERTS_PATH);
const dashboardsConfig = readJson(DASHBOARDS_PATH);
const runbooksText = readText(RUNBOOKS_PATH);

if (!Array.isArray(alertsConfig.alerts)) {
  errors.push("alerts.phase1.json must contain an alerts array.");
}

if (!Array.isArray(dashboardsConfig.dashboards)) {
  errors.push("dashboards.phase1.json must contain a dashboards array.");
}

const alerts = Array.isArray(alertsConfig.alerts) ? alertsConfig.alerts : [];
const dashboards = Array.isArray(dashboardsConfig.dashboards) ? dashboardsConfig.dashboards : [];

const alertIds = new Set();
const panelIds = new Set();
const linkedSloIds = new Set();

for (const alert of alerts) {
  for (const field of REQUIRED_ALERT_FIELDS) {
    if (!Object.hasOwn(alert, field) || String(alert[field]).trim().length === 0) {
      errors.push(`${alert.alert_id ?? "<missing_alert_id>"} missing required field: ${field}`);
    }
  }

  if (alertIds.has(alert.alert_id)) {
    errors.push(`Duplicate alert_id detected: ${alert.alert_id}`);
  }
  alertIds.add(alert.alert_id);

  if (!VALID_DATA_SOURCES.has(alert.data_source_type)) {
    errors.push(`${alert.alert_id} has invalid data_source_type: ${alert.data_source_type}`);
  }

  if (isRatioFormula(String(alert.threshold_formula))) {
    const ratioRule = alert.ratio_rule;
    if (!ratioRule || typeof ratioRule !== "object") {
      errors.push(`${alert.alert_id} is ratio-based and must include ratio_rule.`);
    } else {
      const requiredRatioFields = ["numerator", "denominator", "window", "minimum_denominator_volume"];
      for (const field of requiredRatioFields) {
        if (!Object.hasOwn(ratioRule, field) || String(ratioRule[field]).trim().length === 0) {
          errors.push(`${alert.alert_id} ratio_rule missing ${field}`);
        }
      }
    }
  }

  if (["Sev1", "Sev2"].includes(alert.severity)) {
    if (!String(alert.runbook_id).startsWith("RB-")) {
      errors.push(`${alert.alert_id} must map to exactly one RB-* runbook.`);
    } else {
      const runbookHeader = `## ${alert.runbook_id}`;
      const sectionStart = runbooksText.indexOf(runbookHeader);
      if (sectionStart < 0) {
        errors.push(`${alert.alert_id} references missing runbook section ${alert.runbook_id}`);
      } else {
        const nextHeader = runbooksText.indexOf("\n## ", sectionStart + runbookHeader.length);
        const section = nextHeader < 0 ? runbooksText.slice(sectionStart) : runbooksText.slice(sectionStart, nextHeader);
        if (!section.includes("First 10 minutes:")) {
          errors.push(`${alert.alert_id} runbook ${alert.runbook_id} is missing first-10-minute triage steps.`);
        }
      }
    }
  }
}

for (const dashboard of dashboards) {
  if (!Array.isArray(dashboard.panels)) {
    errors.push(`${dashboard.dashboard_id ?? "<missing_dashboard_id>"} must include panels array.`);
    continue;
  }

  for (const panel of dashboard.panels) {
    const requiredPanelFields = ["panel_id", "panel_name", "query_intent", "linked_metrics", "linked_slo_id"];
    for (const field of requiredPanelFields) {
      if (!Object.hasOwn(panel, field)) {
        errors.push(`${dashboard.dashboard_id} panel missing required field: ${field}`);
      }
    }

    if (panelIds.has(panel.panel_id)) {
      errors.push(`Duplicate panel_id detected: ${panel.panel_id}`);
    }
    panelIds.add(panel.panel_id);

    if (!Array.isArray(panel.linked_metrics) || panel.linked_metrics.length === 0) {
      errors.push(`${panel.panel_id} must include one or more linked_metrics.`);
    }

    if (panel.linked_slo_id !== null) {
      linkedSloIds.add(panel.linked_slo_id);
    }
  }
}

for (const sloId of EXPECTED_SLOS) {
  if (!linkedSloIds.has(sloId)) {
    errors.push(`Missing dashboard-to-SLO mapping for ${sloId}.`);
  }
}

if (![...VALID_OUTCOMES].every((outcome) => VALID_OUTCOMES.has(outcome))) {
  errors.push("Outcome policy validation failed.");
}

if (errors.length > 0) {
  console.error("Phase 1 observability config validation failed:");
  for (const issue of errors) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Phase 1 observability config validation passed.");
console.log(`Validated ${alerts.length} alerts and ${dashboards.length} dashboards.`);
