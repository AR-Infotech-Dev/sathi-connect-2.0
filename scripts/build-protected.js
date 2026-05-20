import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JavaScriptObfuscator from "javascript-obfuscator";

const rootDir = path.resolve(".");
const buildDir = path.join(rootDir, "build", "protected-app");
const outputDir = path.join(rootDir, "release 0.0.1");
const builderArgs = process.argv.slice(2);

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
organizeFinalOutput();

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
    electron: String(pkg.devDependencies?.electron || "22.3.27").replace(/^[^\d]*/, "")
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
  const files = listFiles(buildDir).filter((file) => file.endsWith(".js") || file.endsWith(".cjs"));
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
    "electron/main.cjs"
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
  const result = spawnSync(command, [builderCli, "--projectDir", buildDir, "--win", ...builderArgs], {
    cwd: rootDir,
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error("electron-builder failed for protected build.");
  }
}

function organizeFinalOutput() {
  const arch = builderArgs.includes("--x64") ? "x64" : "ia32";
  const bitLabel = arch === "x64" ? "64 bit" : "32 bit";
  const installerArch = arch === "x64" ? "x64" : "ia32";
  const sourceInstaller = path.join(outputDir, `Sathi Connect Setup 0.1.3 ${installerArch}.exe`);
  const sourceMainDir = path.join(outputDir, arch === "x64" ? "win-unpacked" : "win-ia32-unpacked");
  const finalArchDir = path.join(outputDir, bitLabel);
  const finalSetupDir = path.join(finalArchDir, "setup");
  const finalMainDir = path.join(finalArchDir, "main");
  const finalInstaller = path.join(finalSetupDir, `Sathi Connect Setup 0.1.3 (${bitLabel}).exe`);

  if (!fs.existsSync(sourceInstaller)) {
    throw new Error(`Missing installer output: ${sourceInstaller}`);
  }
  if (!fs.existsSync(sourceMainDir)) {
    throw new Error(`Missing unpacked app output: ${sourceMainDir}`);
  }

  assertInside(outputDir, finalArchDir);
  fs.rmSync(finalArchDir, { recursive: true, force: true });
  fs.mkdirSync(finalSetupDir, { recursive: true });
  fs.mkdirSync(finalMainDir, { recursive: true });
  fs.copyFileSync(sourceInstaller, finalInstaller);
  copyDirectoryContents(sourceMainDir, finalMainDir);
  console.log(`Prepared final ${bitLabel} output at ${finalArchDir}`);
  removeIntermediateOutput(arch);
}

function copyDirectoryContents(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const destination = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(source, destination, { recursive: true });
    } else {
      fs.copyFileSync(source, destination);
    }
  }
}

function removeIntermediateOutput(arch) {
  const names = [
    arch === "x64" ? "win-unpacked" : "win-ia32-unpacked",
    `Sathi Connect Setup 0.1.3 ${arch === "x64" ? "x64" : "ia32"}.exe`,
    `Sathi Connect Setup 0.1.3 ${arch === "x64" ? "x64" : "ia32"}.exe.blockmap`,
    `saathi-setu-0.1.3-${arch}.nsis.7z`,
    "builder-debug.yml",
    "builder-effective-config.yaml",
    "latest.yml"
  ];

  for (const name of names) {
    const target = path.join(outputDir, name);
    if (!fs.existsSync(target)) continue;
    assertInside(outputDir, target);
    fs.rmSync(target, { recursive: true, force: true });
  }
}

export function cleanReleaseOutput() {
  const keep = new Set(["32 bit", "64 bit"]);
  if (!fs.existsSync(outputDir)) return;
  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (keep.has(entry.name)) continue;
    const target = path.join(outputDir, entry.name);
    assertInside(outputDir, target);
    fs.rmSync(target, { recursive: true, force: true });
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
