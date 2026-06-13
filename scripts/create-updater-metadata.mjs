import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const nsisDir = path.join(repoRoot, "src-tauri", "target", "release", "bundle", "nsis");
const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const version = packageJson.version;
const releaseBaseUrl = process.env.EASYGITHUB_RELEASE_DOWNLOAD_BASE_URL
  ?? "https://github.com/snowtie/Easy-Github/releases/latest/download";

const files = await readdir(nsisDir);
const setupName = files.find((name) => name === `EasyGithub_${version}_x64-setup.exe`);

if (!setupName) {
  throw new Error(`NSIS setup exe for version ${version} not found in ${nsisDir}`);
}

const setupPath = path.join(nsisDir, setupName);
const sigPath = `${setupPath}.sig`;
const content = await readFile(setupPath);
const signature = (await readFile(sigPath, "utf8")).trim();
const fileStat = await stat(setupPath);
const sha512 = createHash("sha512").update(content).digest("base64");
const releaseDate = new Date().toISOString();

const latestYml = [
  `version: ${version}`,
  "files:",
  `  - url: ${setupName}`,
  `    sha512: ${sha512}`,
  `    size: ${fileStat.size}`,
  `path: ${setupName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${releaseDate}'`,
  ""
].join("\n");

const latestJson = {
  version,
  notes: "Tauri 기반 경량 빌드로 전환했습니다.",
  pub_date: releaseDate,
  platforms: {
    "windows-x86_64": {
      signature,
      url: `${releaseBaseUrl}/${setupName}`
    }
  }
};

await writeFile(path.join(nsisDir, "latest.yml"), latestYml, "utf8");
await writeFile(path.join(nsisDir, "latest.json"), `${JSON.stringify(latestJson, null, 2)}\n`, "utf8");

console.log(`Created legacy electron-updater metadata: latest.yml -> ${setupName}`);
console.log(`Created Tauri updater metadata: latest.json -> ${setupName}`);
