import puppeteer from "puppeteer-core";
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

const [, , htmlArg, pdfArg] = process.argv;
const htmlPath = resolve(
  __dirname,
  htmlArg ?? "../public/downloads/azure-zero-trust-terraform-cheatsheet.html",
);
const pdfPath = resolve(
  __dirname,
  pdfArg ?? "../public/downloads/azure-zero-trust-terraform-cheatsheet.pdf",
);

// Prefer a Linux-native Chrome installed via `npx puppeteer browsers install chrome`
// (lives under ~/.cache/puppeteer/chrome/...). Running everything inside WSL avoids
// the cross-boundary localhost connection between WSL Node and a Windows chrome.exe,
// which is unreliable for Puppeteer's DevTools websocket.
function findLinuxChrome() {
  const cacheDir = resolve(homedir(), ".cache/puppeteer/chrome");
  if (!existsSync(cacheDir)) return null;
  const versions = readdirSync(cacheDir).filter((d) => d.startsWith("linux-"));
  if (versions.length === 0) return null;
  const latest = versions.sort().at(-1);
  const binPath = resolve(cacheDir, latest, "chrome-linux64/chrome");
  return existsSync(binPath) ? binPath : null;
}

const chromePath =
  process.env.CHROME_PATH ??
  findLinuxChrome() ??
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";
const isWindowsChrome = chromePath.includes("/mnt/c/");

console.log(`Using Chrome: ${chromePath}`);
if (isWindowsChrome) {
  console.log(
    "⚠️  Falling back to Windows chrome.exe — this is unreliable from WSL.\n" +
      "   Run `npx puppeteer browsers install chrome` once to install a Linux build instead."
  );
}

const html = readFileSync(htmlPath, "utf8");

// Serve HTML on localhost so Chrome can load fonts etc.
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((r) => server.listen(9876, "127.0.0.1", r));
console.log("Server running on http://127.0.0.1:9876");

// chrome.exe is a native Windows binary — it understands Windows paths only.
// Passing a WSL-style path (/mnt/c/...) as --user-data-dir fails because Chrome
// never translates it; it must be the literal Windows-format path (C:\...).
const args = ["--no-sandbox", "--disable-setuid-sandbox"];
if (isWindowsChrome) {
  args.push("--user-data-dir=C:\\Windows\\Temp\\puppeteer-chrome-profile");
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args,
});

const page = await browser.newPage();
await page.goto("http://127.0.0.1:9876", { waitUntil: "networkidle2", timeout: 30000 });

await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
});

await browser.close();
server.close();
console.log("PDF generated:", pdfPath);
