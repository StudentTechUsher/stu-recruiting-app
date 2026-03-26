import fs from "node:fs";
import { execSync } from "node:child_process";

const OBS_IMPORT_TOKENS = [
  "createApiObsContext",
  "logApiRequestStart",
  "logApiRequestResult",
  "attachRequestIdHeader"
];

const REQUIRED_USAGE_PATTERNS = [
  /createApiObsContext\s*\(/,
  /logApiRequestStart\s*\(/,
  /logApiRequestResult\s*\(/,
  /attachRequestIdHeader\s*\(/,
  /routeTemplate\s*:\s*["'`][^"'`]+["'`]/
];

const readLines = (command) => {
  try {
    const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
};

const collectChangedApiRoutes = () => {
  const changed = new Set();
  const unstaged = readLines("git diff --name-only --diff-filter=AM -- app/api");
  const staged = readLines("git diff --cached --name-only --diff-filter=AM -- app/api");
  for (const filePath of [...unstaged, ...staged]) {
    if (filePath.startsWith("app/api/") && filePath.endsWith("/route.ts")) {
      changed.add(filePath);
    }
  }
  return [...changed].sort();
};

const validateFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return [`missing file: ${filePath}`];
  }

  const source = fs.readFileSync(filePath, "utf8");
  const failures = [];

  for (const token of OBS_IMPORT_TOKENS) {
    if (!source.includes(token)) {
      failures.push(`missing ${token}`);
    }
  }

  for (const pattern of REQUIRED_USAGE_PATTERNS) {
    if (!pattern.test(source)) {
      failures.push(`missing pattern ${pattern}`);
    }
  }

  return failures;
};

const changedApiRoutes = collectChangedApiRoutes();
if (changedApiRoutes.length === 0) {
  console.log("No changed API route handlers detected. Observability guard passed.");
  process.exit(0);
}

const issues = [];
for (const filePath of changedApiRoutes) {
  const fileIssues = validateFile(filePath);
  if (fileIssues.length > 0) {
    issues.push({ filePath, fileIssues });
  }
}

if (issues.length > 0) {
  console.error("Observability guard failed for changed API routes:");
  for (const issue of issues) {
    console.error(`- ${issue.filePath}`);
    for (const entry of issue.fileIssues) {
      console.error(`  - ${entry}`);
    }
  }
  process.exit(1);
}

console.log("Observability guard passed for changed API routes:");
for (const filePath of changedApiRoutes) {
  console.log(`- ${filePath}`);
}
