import fs from "fs";
import APP_CONFIG from "./app-config.js";

function toDashCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const srcFolder = APP_CONFIG.srcFolder;
const htmlPath = `./${srcFolder}/index.html`;

// Step 1: Update title in-place
let html = fs.readFileSync(htmlPath, "utf-8");
html = html.replace(
  /<title>.*?<\/title>/,
  `<title>${APP_CONFIG.appName}</title>`
);
fs.writeFileSync(htmlPath, html);
console.log(`📝 Updated <title> in ${htmlPath}`);

// Step 2: Update package.json name + description
const pkgPath = "./package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const newName = toDashCase(APP_CONFIG.appName);
const newDescription = APP_CONFIG.description || "placeholder description";

if (pkg.name !== newName || pkg.description !== newDescription) {
  pkg.name = newName;
  pkg.description = newDescription;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log(
    `📦 Updated package.json: name="${newName}", description="${newDescription}"`
  );
}

// Step 3: write constants/app-config.js inside srcFolder
const constantsDir = `./${srcFolder}/constants`;
const constantsPath = `${constantsDir}/app-config.js`;
fs.mkdirSync(constantsDir, { recursive: true });
fs.writeFileSync(
  constantsPath,
  `const APP_CONFIG = ${JSON.stringify(
    APP_CONFIG,
    null,
    2
  )};\nexport default APP_CONFIG;\n`
);
console.log(`📁 Wrote ${constantsPath}`);

console.log("✅ apply-config complete.");
