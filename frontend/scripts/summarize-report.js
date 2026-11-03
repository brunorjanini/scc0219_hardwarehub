// Dev helper: turns a Vitest JSON report into a short text summary.
//   npx vitest run <filter> --reporter=json --outputFile=report.json
//   node scripts/summarize-report.js report.json summary.txt
// Useful on terminals that cut long test output.
import { readFileSync, writeFileSync } from "node:fs";
// Explicit import: the ESLint config only declares browser globals
import process from "node:process";

const [input = "report.json", output = "report-summary.txt"] = process.argv.slice(2);
const report = JSON.parse(readFileSync(input, "utf8"));

const lines = [`Tests: ${report.numPassedTests} passed, ${report.numFailedTests} failed, ${report.numTotalTests} total`];
for (const file of report.testResults) {
  for (const test of file.assertionResults) {
    if (test.status !== "failed") continue;
    lines.push("", `FAIL ${test.fullName}`);
    // First lines of each message: the assertion and our custom text
    for (const message of test.failureMessages) {
      lines.push(...message.split("\n").filter((line) => !line.trim().startsWith("at ")).slice(0, 40));
    }
  }
}

writeFileSync(output, `${lines.join("\n")}\n`, "utf8");
console.log(`Summary written to ${output}`);
