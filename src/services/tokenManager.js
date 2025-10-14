import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// 📁 Ruta donde se almacenarán los tokens temporales
export const TOKEN_FILE_PATH = path.resolve("src/temp/tempTokens.txt");

// 🟢 Asegura que exista la carpeta src/temp
const ensureDirectoryExists = async () => {
  const dir = path.dirname(TOKEN_FILE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

// 🧩 Guarda el token en el archivo con su shortId y fecha
export const saveToken = async (fileCode, token) => {
  const shortId = crypto.createHash("md5").update(token).digest("hex").slice(0, 10);
  const line = `${shortId}|${fileCode}|${token}|${Date.now()}\n`;

  const data = await fs.readFile(TOKEN_FILE_PATH, "utf8").catch(() => "");
  if (!data.includes(`|${fileCode}|`)) {
    await fs.appendFile(TOKEN_FILE_PATH, line);
  }

  return shortId;
};

export const findShortIdByCode = async (fileCode) => {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf8");
    const lines = data.trim().split("\n");
    for (const line of lines) {
      const [shortId, code] = line.split("|");
      if (code === fileCode) return shortId;
    }
    return null;
  } catch {
    return null;
  }
};

// 🔍 Recupera un token por su shortId
export const getToken = async (shortId) => {
  try {
    const data = await fs.readFile(TOKEN_FILE_PATH, "utf8");
    const lines = data.trim().split("\n");

    for (const line of lines) {
      const [id, token] = line.split("|");
      if (id === shortId) return token;
    }
    return null;
  } catch {
    return null;
  }
}

// 🧹 Limpia tokens expirados (según el JWT)
export const cleanExpiredTokens = async () => {
  try {
    const data = await fs.readFile(TOKEN_FILE_PATH, "utf8");
    const lines = data.trim().split("\n");
    const validLines = [];

    for (const line of lines) {
      const [id, token] = line.split("|");
      try {
        jwt.verify(token, process.env.JWT_SECRET);
        validLines.push(line); // si no lanza error, sigue siendo válido
      } catch {
        console.log(`🧹 Token expirado eliminado: ${id}`);
      }
    }

    await fs.writeFile(TOKEN_FILE_PATH, validLines.join("\n") + "\n");
  } catch {}
}
