import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { homedir, platform, arch } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const distDir = join(repoRoot, "dist");

const versions = {
  liteparse: "2.0.4",
  tesseractRs: "0.2.0",
  tesseract: "5.3.4",
  leptonica: "1.84.1",
  tessdata: "tessdata_best",
};

function runtimeKey() {
  const os = platform();
  const cpu = arch();
  if (os === "darwin" && cpu === "arm64") return "darwin-arm64";
  if (os === "darwin" && cpu === "x64") return "darwin-x64";
  if (os === "linux" && cpu === "x64") return "linux-x64";
  if (os === "win32" && cpu === "x64") return "win32-x64";
  throw new Error(`Unsupported OCR runtime platform: ${os}-${cpu}`);
}

function tesseractRsRoot() {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "tesseract-rs");
  }
  if (process.platform === "linux") {
    return join(homedir(), ".tesseract-rs");
  }
  if (process.platform === "win32") {
    const base = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(base, "tesseract-rs");
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  };
  walk(root);
  return files.sort();
}

function requiredFiles(root) {
  if (process.platform === "win32") {
    return [
      join(root, "cache", "leptonica", "leptonica.lib"),
      join(root, "cache", "tesseract", "tesseract.lib"),
      join(root, "tessdata", "eng.traineddata"),
      join(root, "tessdata", "tur.traineddata"),
    ];
  }
  return [
    join(root, "cache", "leptonica", "libleptonica.a"),
    join(root, "cache", "tesseract", "libtesseract.a"),
    join(root, "tessdata", "eng.traineddata"),
    join(root, "tessdata", "tur.traineddata"),
  ];
}

function ensureWindowsCacheLibrary(root, name, expectedFileName, installCandidates) {
  const cacheDir = join(root, "cache", name);
  const cachePath = join(cacheDir, expectedFileName);
  const installLibDir = join(root, name, "lib");
  const installPath = join(installLibDir, expectedFileName);

  if (existsSync(cachePath)) return;

  const recursiveCandidates = existsSync(join(root, name)) ? listFiles(join(root, name)) : [];
  const candidatePaths = [
    ...installCandidates.map((candidate) => join(installLibDir, candidate)),
    ...recursiveCandidates.filter((path) => {
      const fileName = basename(path).toLowerCase();
      return fileName.endsWith(".lib") && fileName.includes(name);
    }),
  ];
  const sourcePath = candidatePaths.find((path) => existsSync(path));

  if (!sourcePath) return;

  mkdirSync(cacheDir, { recursive: true });
  cpSync(sourcePath, cachePath);

  if (!existsSync(installPath)) {
    mkdirSync(installLibDir, { recursive: true });
    cpSync(sourcePath, installPath);
  }
}

function ensureWindowsCacheLibraries(root) {
  if (process.platform !== "win32") return;

  ensureWindowsCacheLibrary(root, "leptonica", "leptonica.lib", [
    "leptonica.lib",
    "libleptonica.lib",
    "leptonica-static.lib",
    "leptonica-1.84.1.lib",
  ]);
  ensureWindowsCacheLibrary(root, "tesseract", "tesseract.lib", [
    "tesseract.lib",
    "libtesseract.lib",
    "tesseract-static.lib",
    "tesseract53.lib",
    "tesseract54.lib",
  ]);
}

function summarizeLibraries(root) {
  return listFiles(root)
    .filter((path) => basename(path).toLowerCase().endsWith(".lib"))
    .map((path) => relative(root, path).replaceAll("\\", "/"))
    .slice(0, 40)
    .join(", ");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: repoRoot,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

const key = runtimeKey();
const cacheRoot = tesseractRsRoot();
const expectedKey = process.env.MSTY_CLAW_OCR_RUNTIME_EXPECTED;

if (expectedKey && expectedKey !== key) {
  throw new Error(`Runner produced ${key}, but the workflow expected ${expectedKey}`);
}

run("cargo", ["check", "--manifest-path", join(repoRoot, "builder", "Cargo.toml")]);

ensureWindowsCacheLibraries(cacheRoot);

for (const file of requiredFiles(cacheRoot)) {
  if (!existsSync(file)) {
    const availableLibraries = process.platform === "win32" ? ` Available .lib files: ${summarizeLibraries(cacheRoot)}` : "";
    throw new Error(`Expected OCR cache file was not produced: ${file}.${availableLibraries}`);
  }
}

rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });

const packageName = `msty-claw-ocr-runtime-${key}`;
const packageRoot = join(distDir, packageName);
mkdirSync(packageRoot, { recursive: true });

for (const dir of ["cache", "leptonica", "tesseract", "third_party", "tessdata"]) {
  const source = join(cacheRoot, dir);
  if (existsSync(source)) {
    run(process.execPath, [
      "-e",
      "require('node:fs').cpSync(process.argv[1], process.argv[2], { recursive: true })",
      source,
      join(packageRoot, dir),
    ]);
  }
}

const files = listFiles(packageRoot).map((path) => ({
  path: relative(packageRoot, path).replaceAll("\\", "/"),
  size: statSync(path).size,
  sha256: sha256(path),
}));

const manifest = {
  schemaVersion: 1,
  packageName,
  platform: process.platform,
  arch: process.arch,
  runtimeKey: key,
  createdAt: new Date().toISOString(),
  versions,
  files,
};

writeFileSync(join(packageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const archiveBase = join(distDir, packageName);
if (process.platform === "win32") {
  const archivePath = `${archiveBase}.zip`;
  run("powershell", [
    "-NoProfile",
    "-Command",
    "& { param($PackageRoot, $ArchivePath) Compress-Archive -Path (Join-Path $PackageRoot '*') -DestinationPath $ArchivePath -Force }",
    packageRoot,
    archivePath,
  ]);
  writeFileSync(`${archivePath}.sha256`, `${sha256(archivePath)}  ${basename(archivePath)}\n`);
} else {
  const archivePath = `${archiveBase}.tar.gz`;
  run("tar", ["-czf", archivePath, "-C", packageRoot, "."]);
  writeFileSync(`${archivePath}.sha256`, `${sha256(archivePath)}  ${basename(archivePath)}\n`);
}

console.log(`Packaged ${packageName}`);
