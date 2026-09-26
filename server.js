// Static file server + contact-endpoint voor ashraf-website.
// Draait op 0.0.0.0:3000; nginx zet dat door naar https://ashraf.sdai.nl.
//
//   GET  /...           → statische bestanden uit deze map
//   POST /api/contact   → { naam, email, bericht } → wordt bewaard in data/berichten.jsonl
//
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const BERICHTEN = path.join(DATA_DIR, "berichten.jsonl");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/* ---------- contact-endpoint ---------- */

const VENSTER_MS = 10 * 60 * 1000; // 10 minuten
const MAX_PER_VENSTER = 5;
const bezoekers = new Map(); // ip → [tijdstippen]

function magVerzenden(ip) {
  const nu = Date.now();
  const tijden = (bezoekers.get(ip) || []).filter((t) => nu - t < VENSTER_MS);
  if (tijden.length >= MAX_PER_VENSTER) return false;
  tijden.push(nu);
  bezoekers.set(ip, tijden);
  return true;
}

function stuurJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function leesBody(req, max = 20000) {
  return new Promise((resolve, reject) => {
    let data = "";
    let teGroot = false;
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > max) {
        teGroot = true;
        req.destroy();
      }
    });
    req.on("end", () => (teGroot ? reject(new Error("te groot")) : resolve(data)));
    req.on("error", reject);
  });
}

function geldigEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(s);
}

async function verwerkContact(req, res) {
  const doorgestuurd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = doorgestuurd || req.socket.remoteAddress || "onbekend";

  if (!magVerzenden(ip)) {
    return stuurJson(res, 429, {
      ok: false,
      fout: "Te veel berichten achter elkaar. Probeer het over tien minuten opnieuw.",
    });
  }

  let body;
  try {
    body = JSON.parse(await leesBody(req));
  } catch (e) {
    return stuurJson(res, 400, { ok: false, fout: "Ongeldige aanvraag." });
  }

  // honeypot: bots vullen dit verborgen veld in
  if (body.website) return stuurJson(res, 200, { ok: true, boodschap: "Bedankt!" });

  const naam = String(body.naam || "").trim();
  const email = String(body.email || "").trim();
  const bericht = String(body.bericht || "").trim();

  if (naam.length < 2 || naam.length > 120) {
    return stuurJson(res, 400, { ok: false, fout: "Vul uw naam in." });
  }
  if (!geldigEmail(email) || email.length > 160) {
    return stuurJson(res, 400, { ok: false, fout: "Vul een geldig e-mailadres in." });
  }
  if (bericht.length < 5 || bericht.length > 4000) {
    return stuurJson(res, 400, { ok: false, fout: "Vertel in een paar woorden waar het over gaat." });
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(
      BERICHTEN,
      JSON.stringify({ datum: new Date().toISOString(), naam, email, bericht }) + "\n"
    );
  } catch (e) {
    console.error("[contact] kon bericht niet opslaan:", e.message);
    return stuurJson(res, 500, { ok: false, fout: "Opslaan lukte niet. Mail gerust naar info@ashraf.sdai.nl." });
  }

  console.log(`[contact] nieuw bericht van ${naam} <${email}> (${bericht.length} tekens)`);
  stuurJson(res, 200, {
    ok: true,
    boodschap: "Bedankt! Uw aanvraag is ontvangen. Ik neem binnen één werkdag contact met u op.",
  });
}

/* ---------- server ---------- */

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);

    if (url === "/api/contact") {
      if (req.method === "POST") return verwerkContact(req, res);
      return stuurJson(res, 405, { ok: false, fout: "Alleen POST is toegestaan." });
    }
    if (url.startsWith("/api/")) {
      return stuurJson(res, 404, { ok: false, fout: "Onbekend endpoint." });
    }

    let rel = url === "/" ? "/index.html" : url;
    const file = path.join(ROOT, path.normalize(rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        return res.end("<h1>404 — Not Found</h1>");
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(PORT, "0.0.0.0", () =>
    console.log(`ashraf-website serving ${ROOT} on http://0.0.0.0:${PORT}`)
  );
