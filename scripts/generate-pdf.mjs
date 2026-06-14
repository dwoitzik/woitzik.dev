import puppeteer from "puppeteer-core";
import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "../public/downloads/azure-zero-trust-terraform-cheatsheet.html");
const pdfPath = resolve(__dirname, "../public/downloads/azure-zero-trust-terraform-cheatsheet.pdf");
const chromePath = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";

const html = readFileSync(htmlPath, "utf8");

// Serve HTML on localhost so Chrome can load fonts etc.
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((r) => server.listen(9876, "127.0.0.1", r));
console.log("Server running on http://127.0.0.1:9876");

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
