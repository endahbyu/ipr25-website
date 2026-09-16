// Minimal static file server for the RRE site.
// Usage: node serve.mjs [port]
import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || process.argv[2] || 3000);
const host = "0.0.0.0";
const root = fileURLToPath(new URL(".", import.meta.url));

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

async function resolveFilePath(urlPath) {
  let decoded = decodeURIComponent(urlPath);
  if (decoded === "/") decoded = "/index.html";

  let filePath = normalize(join(root, decoded));
  if (!filePath.startsWith(root)) {
    return null;
  }

  // Check if file exists directly
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      const indexPath = join(filePath, "index.html");
      if (existsSync(indexPath)) {
        return indexPath;
      }
    } else if (s.isFile()) {
      return filePath;
    }
  } catch {
    // Continue to check fallback extensions
  }

  // Extensionless clean URLs (e.g. /portfolio -> /portfolio.html)
  if (!extname(decoded)) {
    const withHtml = normalize(join(root, decoded + ".html"));
    if (withHtml.startsWith(root) && existsSync(withHtml)) {
      return withHtml;
    }
  }

  return null;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const filePath = await resolveFilePath(url.pathname);

    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + req.url);
      return;
    }

    const fileStat = await stat(filePath);
    const contentType = mime[extname(filePath)] || "application/octet-stream";
    const range = req.headers.range;

    if (range) {
      // Range header format: bytes=start-end
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1;

      if (isNaN(start) || isNaN(end) || start >= fileStat.size || end >= fileStat.size || start > end) {
        res.writeHead(416, {
          "Content-Range": `bytes */${fileStat.size}`,
        });
        res.end();
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileStat.size,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });

      createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`RRE site serving at http://${host}:${port}`);
});
