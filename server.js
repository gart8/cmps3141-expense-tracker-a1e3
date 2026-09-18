import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataPath = join(root, "data.json");
const port = process.env.PORT || 3000;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType });
  response.end(body);
}

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/data") {
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", async () => {
      try {
        const data = JSON.parse(body);
        if (!Array.isArray(data)) throw new Error("Data must be an array.");
        await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
        send(response, 204, "");
      } catch (error) {
        send(response, 400, error.message);
      }
    });
    return;
  }

  if (request.method !== "GET") {
    send(response, 405, "Method not allowed");
    return;
  }

  const requestedPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const filePath = normalize(join(root, relativePath));
  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    send(response, 200, content, contentTypes[extname(filePath)] || "application/octet-stream");
  } catch {
    send(response, 404, "Not found");
  }
});

server.listen(port, () => {
  console.log(`Expense tracker running at http://localhost:${port}`);
});