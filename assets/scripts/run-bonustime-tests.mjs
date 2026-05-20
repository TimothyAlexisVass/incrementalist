import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadEsbuild() {
  return (await import("esbuild")).default;
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "..");
const entryPoint = path.resolve(rootDir, "src/tests/bonustime-flow.test.ts");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "bonustime-tests-"));
const outfile = path.join(tempDir, "bonustime-flow.test.mjs");

try {
  const esbuild = await loadEsbuild();

  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2020",
    outfile,
    logLevel: "silent"
  });

  await import(pathToFileURL(outfile).href);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
