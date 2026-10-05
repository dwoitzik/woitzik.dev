// Tests the subnet calculator against the source that actually ships.
//
// The page carries two copies of the IPv6 arithmetic: one in the frontmatter
// that renders the defaults without JavaScript, and one in the client script
// that reacts to input. A duplicate is easy to let drift, so this test loads
// both blocks out of the .astro file and asserts they produce identical
// results, then checks those results against known-correct values.
//
// TypeScript is stripped with esbuild, which Astro already pulls in through
// Vite, so nothing extra has to be installed for the tests to run.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = join(root, "src/pages/tools/subnet-calculator.astro");
const source = readFileSync(pagePath, "utf8");

let failures = 0;
let checks = 0;

function check(label, got, want) {
  checks++;
  const ok = String(got) === String(want);
  if (!ok) failures++;
  const line = ok ? `  OK      ${label}` : `  FEHLER  ${label}`;
  console.log(ok ? line : `${line} = ${got} (erwartet ${want})`);
}

// Loads one block of the page as a callable function object. The frontmatter
// block ends at the closing delimiter, which keeps the JSX template out; the
// script block loses its final listener registration because there is no
// document in Node.
function loadFrontmatter() {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error("Frontmatter nicht gefunden");
  const body = match[1]
    .split("\n")
    .filter((line) => !line.startsWith("import "))
    .join("\n");
  return evaluate(body, ["toIp6", "mask6", "usableHosts6", "expandIpv6", "parseIpv6"]);
}

function loadClientScript() {
  const match = source.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Client-Script nicht gefunden");
  const body = match[1]
    .replace(/^\s*document\.addEventListener\([\s\S]*?;\s*$/m, "");
  return evaluate(body, [
    "toIp",
    "toIp6",
    "mask6",
    "usableHosts6",
    "expandIpv6",
    "parseIpv6",
    "parseCidr",
    "usableHosts",
  ]);
}

function evaluate(body, names) {
  const js = transformSync(body, { loader: "ts", target: "es2022" }).code;
  const factory = new Function(
    `${js}\nreturn { ${names.map((n) => `${n}: ${n}`).join(", ")} };`,
  );
  return factory();
}

const server = loadFrontmatter();
const client = loadClientScript();

// Reads straight off the values each block returns.
function summarize(api, input) {
  const parsed = api.parseIpv6(input);
  if (parsed.error) return { error: parsed.error };
  return {
    network: api.toIp6(parsed.network),
    last: api.toIp6(parsed.last),
    netmask: api.toIp6(parsed.mask),
    prefix: parsed.prefix,
    total: (1n << BigInt(128 - parsed.prefix)).toString(),
    usable: api.usableHosts6(parsed.prefix).toString(),
  };
}

console.log("--- Beide Implementierungen liefern dasselbe ---");

const parity = [
  "fd00:10::/64",
  "2001:db8:0:0:1::/48",
  "::1/128",
  "fe80::1/127",
  "::/0",
  "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128",
  "2001:db8::/127",
  "fd00:abcd:1234::/96",
  "2a02:26f0:ee00::/40",
  "::ffff:192.0.2.1/96",
];

for (const input of parity) {
  const a = summarize(server, input);
  const b = summarize(client, input);
  const same = JSON.stringify(a) === JSON.stringify(b);
  checks++;
  if (!same) failures++;
  console.log(
    same
      ? `  OK      ${input}`
      : `  FEHLER  ${input} serverseitig ${JSON.stringify(a)} client ${JSON.stringify(b)}`,
  );
}

console.log("\n--- Adressformat nach RFC 5952 ---");
check("::1", server.toIp6(1n), "::1");
check("null", server.toIp6(0n), "::");
check(
  "2001:db8::1",
  server.toIp6(BigInt("0x" + server.expandIpv6("2001:db8::1").hex)),
  "2001:db8::1",
);
check("keine fuehrenden Nullen", server.toIp6(BigInt("0x" + "00010002000300040005000600070008")), "1:2:3:4:5:6:7:8");
check("laengster Nullblock gewinnt", server.toIp6(BigInt("0x" + "20010db8000000000001000000000001")), "2001:db8::1:0:0:1");
check("Einzelne Nullgruppe bleibt", server.toIp6(BigInt("0x" + "20010000000100020003000400050006")), "2001:0:1:2:3:4:5:6");
check("Loopback", server.toIp6(BigInt("0x" + "00000000000000000000000000000001")), "::1");

console.log("\n--- Praxisfall aus dem MikroTik-Artikel ---");
const n64 = summarize(server, "fd00:10::/64");
check("fd00:10::/64 Netz", n64.network, "fd00:10::");
check("fd00:10::/64 letzte Adresse", n64.last, "fd00:10::ffff:ffff:ffff:ffff");
check("fd00:10::/64 nutzbar", n64.usable, "18446744073709551614");
check("fd00:10::/64 Maske", n64.netmask, "ffff:ffff:ffff:ffff::");
check("fd00:10::/64 gesamt", n64.total, "18446744073709551616");

console.log("\n--- Sonderfaelle laut RFC 6164 ---");
check("/128 nutzbar", summarize(server, "2001:db8::1/128").usable, "1");
check("/127 nutzbar", summarize(server, "2001:db8::1/127").usable, "2");
check("/0 nutzbar", summarize(server, "::/0").usable, "340282366920938463463374607431768211454");
check("/0 letzte Adresse", summarize(server, "::/0").last, "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
check("/0 Netz", summarize(server, "::/0").network, "::");
check("/64 aus Hostadresse", summarize(server, "fd00:10::abcd/64").network, "fd00:10::");
check("/127 aus Hostadresse", summarize(server, "fe80::5/127").network, "fe80::4");

console.log("\n--- Fehlerfaelle ---");
check("prefix 129 abgelehnt", server.parseIpv6("2001:db8::1/129").error, "The prefix has to be between 0 and 128.");
check("prefix nicht numerisch", server.parseIpv6("2001:db8::1/x").error, "The prefix has to be a number from 0 to 128.");
check("doppeltes :: abgelehnt", server.parseIpv6("2001::db8::1/64").error, "Only one \"::\" is allowed in an IPv6 address.");
check("zu viele Gruppen mit ::", server.parseIpv6("1:2:3:4:5:6:7:8::/64").error, "Too many groups for this address.");
check("zu wenige Gruppen", server.parseIpv6("1:2:3:4:5:6:7/64").error, "Not a valid IPv6 address: expected 8 groups.");
check("ungueltiges Hextet", server.parseIpv6("2001:zzzz::1/64").error, "Invalid hextet: zzzz");
check("zu langes Hextet", server.parseIpv6("20011:2:3:4:5:6:7/64").error, "Invalid hextet: 20011");
check("IPv4-Adresse abgelehnt", server.parseIpv6("192.168.1.0/24").error, "Invalid hextet: 192.168.1.0");

console.log("\n--- IPv4 unveraendert ---");
const v4 = client.parseCidr("192.168.1.0/24");
check("IPv4 Netz", client.toIp(v4.network), "192.168.1.0");
check("IPv4 Broadcast", client.toIp(v4.broadcast), "192.168.1.255");
check("IPv4 Maske", client.toIp(v4.mask), "255.255.255.0");
check("IPv4 Wildcard", client.toIp(~v4.mask >>> 0), "0.0.0.255");
check("IPv4 /24 nutzbar", client.usableHosts(24, 256), "254");
check("IPv4 /31 nutzbar laut RFC 3021", client.usableHosts(31, 2), "2");
check("IPv4 /32 nutzbar laut RFC 3021", client.usableHosts(32, 1), "1");
check("IPv4 /8", client.toIp(client.parseCidr("10.0.0.0/8").network), "10.0.0.0");
check("IPv4 /0", client.toIp(client.parseCidr("1.2.3.4/0").network), "0.0.0.0");
check("IPv4 200.1.2.3 gueltig", client.parseCidr("200.1.2.3/8").error, undefined);
check("IPv4 Octett ueber 255 abgelehnt", client.parseCidr("256.1.2.3/8").error, "Each octet has to be between 0 and 255.");
check("IPv4 prefix 33 abgelehnt", client.parseCidr("192.168.1.0/33").error, "The prefix has to be between 0 and 32.");
check("IPv6-Adresse nicht als IPv4", client.parseCidr("fd00:10::/64").error, "Enter a dotted IPv4 address, for example 192.168.1.10.");

console.log(
  failures === 0
    ? `\nAlle ${checks} Pruefungen bestanden`
    : `\n${failures} von ${checks} Pruefungen fehlgeschlagen`,
);
process.exit(failures === 0 ? 0 : 1);