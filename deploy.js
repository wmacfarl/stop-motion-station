import { execSync } from "child_process";
import APP_CONFIG from "./app-config.js";

const bucket = "s3://apps.makeymakey.com";
const profile = "makey-apps";
const folder = APP_CONFIG.srcFolder;
const fullPath = `${bucket}/${folder}`;

console.log(`🚀 Deploying to ${fullPath}...`);

execSync(
  `aws s3 sync ./${folder}/ ${fullPath} --exclude "*.js" --acl public-read --profile ${profile}`,
  { stdio: "inherit" }
);

execSync(
  `aws s3 sync ./${folder}/ ${fullPath} --exclude ".*" --include "*.js" --acl public-read --profile ${profile} --content-type "application/javascript"`,
  { stdio: "inherit" }
);

console.log("✅ Deployment complete.");
