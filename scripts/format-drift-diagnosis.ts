/**
 * Classifies Prettier format:check failures into line-ending-only vs substantive drift.
 * Does not modify files. Safe to run on Windows (CRLF) or CI (LF).
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import prettier from "prettier";

const ROOT = path.resolve(import.meta.dirname, "..");

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".data",
  ".cursor",
  "design-reference",
  "cursor_tasks",
]);

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      listSourceFiles(path.join(dir, entry.name), acc);
      continue;
    }
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    if (rel.endsWith(".png") || rel.endsWith(".pdf") || rel.endsWith(".zip")) {
      continue;
    }
    acc.push(full);
  }
  return acc;
}

async function classifyFile(
  filePath: string,
): Promise<"ok" | "line-ending-only" | "substantive" | "skipped"> {
  const info = await prettier.getFileInfo(filePath, {
    ignorePath: path.join(ROOT, ".prettierignore"),
  });
  if (info.ignored || !info.inferredParser) {
    return "skipped";
  }

  const raw = readFileSync(filePath);
  const text = raw.toString("utf8");
  const lfText = text.replace(/\r\n/g, "\n");

  const options = (await prettier.resolveConfig(filePath)) ?? {};
  const formattedFromLf = await prettier.format(lfText, { ...options, filepath: filePath });
  const formattedFromRaw = await prettier.format(text, { ...options, filepath: filePath });

  if (formattedFromRaw === text) {
    return "ok";
  }

  if (formattedFromLf === text.replace(/\r\n/g, "\n") && formattedFromLf === formattedFromRaw) {
    return "line-ending-only";
  }

  if (lfText !== text && formattedFromLf === formattedFromRaw) {
    const normalizedMatchesPrettier = formattedFromLf === lfText;
    if (normalizedMatchesPrettier) {
      return "line-ending-only";
    }
  }

  const onlyCrDrift =
    formattedFromLf === formattedFromRaw && formattedFromLf !== text && formattedFromLf === lfText;
  if (onlyCrDrift) {
    return "line-ending-only";
  }

  if (text.includes("\r\n") && formattedFromLf === lfText) {
    return "line-ending-only";
  }

  return "substantive";
}

async function main(): Promise<void> {
  let checkFailed = false;
  try {
    execSync("npx prettier --check .", { cwd: ROOT, stdio: "pipe" });
  } catch {
    checkFailed = true;
  }

  const files = listSourceFiles(ROOT);
  let ok = 0;
  let lineEndingOnly = 0;
  let substantive = 0;
  let skipped = 0;
  const substantiveSamples: string[] = [];
  const lineEndingSamples: string[] = [];

  for (const file of files) {
    if (!statSync(file).isFile()) {
      continue;
    }
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (rel.startsWith("dist/")) {
      continue;
    }

    const kind = await classifyFile(file);
    if (kind === "skipped") {
      skipped += 1;
      continue;
    }
    if (kind === "ok") {
      ok += 1;
    } else if (kind === "line-ending-only") {
      lineEndingOnly += 1;
      if (lineEndingSamples.length < 8) {
        lineEndingSamples.push(rel);
      }
    } else {
      substantive += 1;
      if (substantiveSamples.length < 8) {
        substantiveSamples.push(rel);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        prettierCheckPassed: !checkFailed,
        scannedPrettierEligibleFiles: ok + lineEndingOnly + substantive,
        skippedNonPrettierOrIgnored: skipped,
        ok,
        lineEndingOnly,
        substantive,
        lineEndingSamples,
        substantiveSamples,
        recommendation:
          lineEndingOnly > 0 && substantive === 0
            ? "Run one-time LF normalization via .gitattributes + optional dos2unix; avoid semantic edits."
            : substantive > 0
              ? "Review substantive samples; fix or format intentionally in scoped commits."
              : "No drift detected",
      },
      null,
      2,
    ),
  );

  if (checkFailed) {
    process.exitCode = 1;
  }
}

void main();
