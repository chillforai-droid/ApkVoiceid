import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import uploadHandler from "./api/upload";
import uploadAuthHandler from "./api/upload-auth";
import downloadAuthHandler from "./api/download-auth";
import downloadHandler from "./api/download";
import ackHandler from "./api/ack";
import deleteHandler from "./api/delete/[objectKey]";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/media/upload", express.raw({ type: '*/*', limit: '10mb' }), (req, res) => uploadHandler(req as any, res as any));
  app.post("/api/media/upload-auth", (req, res) => uploadAuthHandler(req as any, res as any));
  app.post("/api/media/download-auth", (req, res) => downloadAuthHandler(req as any, res as any));
  app.post("/api/media/download", (req, res) => downloadHandler(req as any, res as any));
  app.post("/api/media/ack", (req, res) => ackHandler(req as any, res as any));
  app.delete("/api/media/delete/:objectKey", (req, res) => {
    (req as any).query = { ...req.query, objectKey: req.params.objectKey };
    deleteHandler(req as any, res as any);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
