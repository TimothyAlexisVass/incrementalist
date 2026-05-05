import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const outdir = path.resolve(dirname, "../priv/static/assets");

await mkdir(outdir, { recursive: true });
await copyFile(path.resolve(dirname, "src/theme/app.css"), path.join(outdir, "app.css"));

const options = {
  entryPoints: [path.resolve(dirname, "src/app.ts")],
  bundle: true,
  sourcemap: true,
  target: "es2020",
  outfile: path.join(outdir, "app.js")
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log("Watching assets/src");
} else {
  await esbuild.build(options);
}
