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
// writing anything unless there's exactly one versionCode/versionName. This
// script only understands a single-flavor build.gradle: blindly bumping
// every match would also clobber flavor-specific version overrides (or a
// stray commented-out line), so an unexpected count means stop and let a
// human update it rather than guessing.
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
let gradle = null;
if (fs.existsSync(gradlePath)) {
  gradle = fs.readFileSync(gradlePath, 'utf8');
  const versionCodeCount = (gradle.match(/versionCode\s+\d+/g) || []).length;
  const versionNameCount = (gradle.match(/versionName\s+"[^"]*"/g) || []).length;
  if (versionCodeCount !== 1 || versionNameCount !== 1) {
    throw new Error(
      `${gradlePath}: expected exactly one versionCode and one versionName (found ${versionCodeCount} versionCode, ${versionNameCount} versionName); this script only supports a single-flavor build.gradle, update it manually`
    );
  }
  gradle = gradle
    .replace(/versionCode\s+(\d+)/, (_m, code) => `versionCode ${Number(code) + 1}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${newVersion}"`);
}

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
if (gradle !== null) {
  fs.writeFileSync(gradlePath, gradle);
}

console.log(`${oldVersion} -> ${newVersion}`);
