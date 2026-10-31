/**
 * Read-only Manual KYC sandbox config audit (no Cloudinary calls, no DB writes).
 */
import { auditManualKycTestConfig, loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";

function main(): void {
  const env = loadManualKycTestProcessEnv();
  const audit = auditManualKycTestConfig(env);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.envValid) {
    process.exit(1);
  }
}

main();
