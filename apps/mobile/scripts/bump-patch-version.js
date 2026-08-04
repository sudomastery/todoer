#!/usr/bin/env node
// Bumps the PATCH number in app.json (the source of truth for the app's
// version), mirrors it into package.json, and into the generated
// android/app/build.gradle if that folder exists locally (it's gitignored,
// regenerated per machine, and gradlew reads versionName/versionCode
// straight from it rather than from app.json).

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function bumpPatch(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

const appJsonPath = path.join(root, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const oldVersion = appJson.expo.version;
const newVersion = bumpPatch(oldVersion);
appJson.expo.version = newVersion;

const pkgJsonPath = path.join(root, 'package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
pkgJson.version = newVersion;

// Resolve the gradle update (if any) in memory first, and bail out before
// writing anything if the expected fields aren't found, so a format change
// can't silently leave build.gradle out of sync while app.json/package.json
// still get bumped.
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
let gradle = null;
if (fs.existsSync(gradlePath)) {
  gradle = fs.readFileSync(gradlePath, 'utf8');
  let versionCodeMatches = 0;
  gradle = gradle.replace(/versionCode\s+(\d+)/g, (_m, code) => {
    versionCodeMatches++;
    return `versionCode ${Number(code) + 1}`;
  });
  let versionNameMatches = 0;
  gradle = gradle.replace(/versionName\s+"[^"]*"/g, () => {
    versionNameMatches++;
    return `versionName "${newVersion}"`;
  });
  if (versionCodeMatches === 0 || versionNameMatches === 0) {
    throw new Error(
      `${gradlePath}: expected versionCode/versionName not found (found ${versionCodeMatches} versionCode, ${versionNameMatches} versionName); aborting before writing any files`
    );
  }
}

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
if (gradle !== null) {
  fs.writeFileSync(gradlePath, gradle);
}

console.log(`${oldVersion} -> ${newVersion}`);
