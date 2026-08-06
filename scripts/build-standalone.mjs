import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = resolve(root, "site");
const lectureNumber = process.argv[2] || "12";
const lectureName = `lecture-${lectureNumber}.js`;
const lecturePath = resolve(site, "lectures", lectureName);

let [html, css, app, lecture] = await Promise.all([
  readFile(resolve(site, "index.html"), "utf8"),
  readFile(resolve(site, "styles.css"), "utf8"),
  readFile(resolve(site, "app.js"), "utf8"),
  readFile(lecturePath, "utf8"),
]);

const exportMatch = lecture.match(/export const (lecture\d+)\s*=\s*/);
if (!exportMatch) throw new Error(`Не найдена экспортируемая лекция в ${lectureName}`);

const variableName = exportMatch[1];
lecture = lecture.replace(`export const ${variableName} =`, `const ${variableName} =`);
app = app.replace(/^import \{ lectures \} from .*\n/m, "");

const imagePattern = /image:\s*"(\.\/assets\/[^\"]+)"/g;
for (const match of [...lecture.matchAll(imagePattern)]) {
  const relativePath = match[1].replace(/^\.\//, "");
  const imagePath = resolve(site, relativePath);
  const extension = imagePath.split(".").pop().toLowerCase();
  const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
  const encoded = (await readFile(imagePath)).toString("base64");
  lecture = lecture.replace(match[1], `data:${mime};base64,${encoded}`);
}

html = html
  .replace(/<link rel="stylesheet"[^>]+>/, () => `<style>\n${css}\n</style>`)
  .replace(
    /<script type="module" src="\.\/app\.js[^>]*><\/script>/,
    () => `<script type="module">\n${lecture}\nconst lectures = [${variableName}];\n${app}\n</script>`,
  )
  .replace(
    "PsychoLearn · Психология без воды",
    `PsychoLearn · Тема ${lectureNumber}`,
  );

const output = resolve(root, "downloads", `theme-${lectureNumber}.html`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html, "utf8");
console.log(output);
