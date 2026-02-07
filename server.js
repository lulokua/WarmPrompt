const http = require("http");
const fs = require("fs");
const path = require("path");

// 先加载环境变量，再导入其他模块
const aiModule = require("./api/ai/ai");
aiModule.loadEnvFile();

// 环境变量加载后再导入依赖它们的模块
const {
  handleAiRequest
} = aiModule;
const {
  handleQQMusicRequest
} = require("./api/for_others/qqmusic/qqmusic");
const { handleNeteaseRequest } = require("./api/for_others/netease/netease");
const { handleAdminRequest, handleProtectedAdminApi } = require("./api/for_others/admin/admin");
const { handleAccountRequest } = require("./api/for_others/log_in/account");
const { handleGiftRequest } = require("./api/gift/gift");
const { handleLetterRequest } = require("./api/letter/letter");
const { handleMediaRequest } = require("./api/media/media");
const { handleFeedbackRequest } = require("./api/feedback/feedback");

const FRONTEND_DIR = path.resolve(__dirname, "public");
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};


function sendText(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 500, "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function getSafePath(requestPath) {
  const decoded = decodeURIComponent(requestPath || "");
  const stripped = decoded.replace(/^[/\\]+/, "");
  const normalized = path.normalize(stripped);

  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }

  const fullPath = path.resolve(FRONTEND_DIR, normalized);
  if (!fullPath.toLowerCase().startsWith(FRONTEND_DIR.toLowerCase())) {
    return null;
  }

  return fullPath;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + req.headers.host);
  const pathname = url.pathname;

  if (req.method === "POST" && pathname === "/api/ai") {
    handleAiRequest(req, res);
    return;
  }

  // QQ 音乐 API 路由
  if (pathname.startsWith("/api/qqmusic")) {
    handleQQMusicRequest(req, res, pathname);
    return;
  }

  // 网易云音乐 API 路由
  if (pathname.startsWith("/api/netease")) {
    handleNeteaseRequest(req, res, pathname);
    return;
  }

  // 管理员 API 路由
  if (pathname.startsWith("/api/admin")) {
    // 先™的处理受保护的 API（需要登录 + 速率限制）
    const handled = handleProtectedAdminApi(req, res, pathname);
    if (handled) {
      return;
    }
    // 否则处理普通管理员 API（登录、登出、验证等）
    handleAdminRequest(req, res, pathname);
    return;
  }

  if (pathname.startsWith("/api/account")) {
    const handled = handleAccountRequest(req, res, pathname);
    if (handled) {
      return;
    }
    sendText(res, 404, "Not Found");
    return;
  }

  if (pathname.startsWith("/api/gift")) {
    const handled = handleGiftRequest(req, res, pathname);
    if (handled) {
      return;
    }
    sendText(res, 404, "Not Found");
    return;
  }

  if (pathname.startsWith("/api/letter")) {
    const handled = handleLetterRequest(req, res, pathname);
    if (handled) {
      return;
    }
    sendText(res, 404, "Not Found");
    return;
  }

  if (pathname.startsWith("/api/feedback")) {
    const handled = handleFeedbackRequest(req, res, pathname);
    if (handled) {
      return;
    }
    sendText(res, 404, "Not Found");
    return;
  }

  if (pathname.startsWith("/api/media")) {
    const handled = handleMediaRequest(req, res, pathname);
    if (handled) {
      return;
    }
    sendText(res, 404, "Not Found");
    return;
  }

  if (req.method !== "GET") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  let requested = pathname === "/" ? "/index.html" : pathname;

  // 如果路径以 / 结尾，自动添加 index.html
  if (requested.endsWith("/")) {
    requested = requested + "index.html";
  }

  let safePath = getSafePath(requested);

  if (!safePath) {
    sendText(res, 400, "Bad Request");
    return;
  }

  fs.stat(safePath, (err, stats) => {
    // 如果是目录，尝试访问其中的 index.html
    if (!err && stats.isDirectory()) {
      const indexPath = path.join(safePath, "index.html");
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          sendFile(res, indexPath);
        } else {
          // 目录存在但没有 index.html，返回 404
          const notFoundPath = path.join(FRONTEND_DIR, "404.html");
          fs.readFile(notFoundPath, (err404, data) => {
            if (err404) {
              sendText(res, 404, "Not Found");
              return;
            }
            res.writeHead(404, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store"
            });
            res.end(data);
          });
        }
      });
      return;
    }

    if (err || !stats.isFile()) {
      // 发送 404.html 页面
      const notFoundPath = path.join(FRONTEND_DIR, "404.html");
      fs.readFile(notFoundPath, (err404, data) => {
        if (err404) {
          sendText(res, 404, "Not Found");
          return;
        }
        res.writeHead(404, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        res.end(data);
      });
      return;
    }

    sendFile(res, safePath);
  });
});

server.listen(PORT, () => {
  console.log("Server 启动成功");
});
