import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JavaScriptObfuscator from "javascript-obfuscator";

const rootDir = path.resolve(".");
const buildDir = path.join(rootDir, "build", "protected-app");
const outputDir = path.join(rootDir, "release 0.0.1");

const copyEntries = [
  "electron",
  "src",
  "public",
  "portable-license-flow",
  "config",
  "keys",
  ".env",
  "package.json"
];

const nodeObfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.45,
  deadCodeInjection: false,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  target: "node",
  transformObjectKeys: false
};

const browserObfuscationOptions = {
  ...nodeObfuscationOptions,
  target: "browser"
};

cleanBuildDir();
copyAppFiles();
rewritePackageConfig();
obfuscateJavaScriptFiles();
checkObfuscatedJavaScript();
runElectronBuilder();

function cleanBuildDir() {
  assertInside(rootDir, buildDir);
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });
}

function copyAppFiles() {
  for (const entry of copyEntries) {
    const source = path.join(rootDir, entry);
    const destination = path.join(buildDir, entry);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, destination, {
      recursive: true,
      filter: (filePath) => !isIgnoredPath(filePath)
    });
  }
}

function rewritePackageConfig() {
  const packageFile = path.join(buildDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  pkg.scripts = {
    start: pkg.scripts?.start || "electron ."
  };
  pkg.devDependencies = {
    electron: String(pkg.devDependencies?.electron || "35.7.5").replace(/^[^\d]*/, "")
  };
  pkg.build = {
    ...pkg.build,
    asar: true,
    directories: {
      ...(pkg.build?.directories || {}),
      output: outputDir
    }
  };
  fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
}

function obfuscateJavaScriptFiles() {
  const files = listFiles(buildDir).filter((file) => file.endsWith(".js"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(buildDir, file).replace(/\\/g, "/");
    const options = relativePath.startsWith("public/")
      ? browserObfuscationOptions
      : nodeObfuscationOptions;
    const result = JavaScriptObfuscator.obfuscate(source, {
      ...options,
      sourceMap: false
    });
    fs.writeFileSync(file, `${result.getObfuscatedCode()}\n`);
    console.log(`Obfuscated ${relativePath}`);
  }
}

function checkObfuscatedJavaScript() {
  const files = [
    "src/index.js",
    "src/config.js",
    "src/json-path.js",
    "src/saathi-client.js",
    "src/saathi-billing-client.js",
    "src/saathi-signing.js",
    "src/env-store.js",
    "src/error-log.js",
    "src/tally-log.js",
    "src/response-archive.js",
    "src/company-settings.js",
    "src/app-db.js",
    "src/tally-client.js",
    "src/server.js",
    "public/app.js",
    "electron/main.js"
  ];

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", path.join(buildDir, file)], {
      cwd: buildDir,
      stdio: "inherit"
    });
    if (result.status !== 0) {
      throw new Error(`Syntax check failed for obfuscated ${file}`);
    }
  }
}

function runElectronBuilder() {
  const command = process.execPath;
  const builderCli = path.join(rootDir, "node_modules", "electron-builder", "cli.js");
  const result = spawnSync(command, [builderCli, "--projectDir", buildDir], {
    cwd: rootDir,
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error("electron-builder failed for protected build.");
  }
}

function listFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function isIgnoredPath(filePath) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  return relativePath.startsWith("node_modules/")
    || relativePath.startsWith("release 0.0.1/")
    || relativePath.startsWith("build/")
    || relativePath.startsWith(".git/");
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside project: ${child}`);
  }
}
