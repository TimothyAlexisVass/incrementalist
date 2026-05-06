import { watch as fsWatch } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const watchMode = process.argv.includes("--watch");
const outdir = path.resolve(dirname, "../priv/static/assets");
const themeCss = path.resolve(dirname, "src/theme/app.css");

async function copyThemeCss() {
  await copyFile(themeCss, path.join(outdir, "app.css"));
}

async function loadEsbuild() {
  try {
    return (await import("esbuild")).default;
  } catch (error) {
    if (error && error.code === "ERR_MODULE_NOT_FOUND") {
      return null;
    }

    throw error;
  }
}

await mkdir(outdir, { recursive: true });
await copyThemeCss();

const options = {
  entryPoints: [path.resolve(dirname, "src/app.ts")],
  bundle: true,
  sourcemap: true,
  target: "es2020",
  outfile: path.join(outdir, "app.js")
};

if (watchMode) {
  const esbuild = await loadEsbuild();

  if (esbuild) {
    const context = await esbuild.context(options);
    await context.watch();
  } else {
    console.warn("esbuild is not installed; watching CSS only");
  }

  let pendingCssCopy = null;

  fsWatch(themeCss, { persistent: true }, () => {
    if (pendingCssCopy) return;
    pendingCssCopy = setTimeout(async () => {
      pendingCssCopy = null;
      try {
        await copyThemeCss();
        console.log("Copied theme CSS");
      } catch (error) {
        console.error("Failed to copy theme CSS", error);
      }
    }, 50);
  });

  console.log("Watching assets/src");
} else {
  const esbuild = await loadEsbuild();

  if (!esbuild) {
    throw new Error("esbuild is required for asset builds");
  }

  await esbuild.build(options);
}
