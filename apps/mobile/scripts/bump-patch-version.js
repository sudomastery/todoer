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
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

const pkgJsonPath = path.join(root, 'package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
pkgJson.version = newVersion;
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');

const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+(\d+)/, (_m, code) => `versionCode ${Number(code) + 1}`);
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${newVersion}"`);
  fs.writeFileSync(gradlePath, gradle);
}

console.log(`${oldVersion} -> ${newVersion}`);
