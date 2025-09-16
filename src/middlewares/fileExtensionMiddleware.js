// fileExtensionMiddleware.js
import path from "path";
import { extensionDAO } from "../dataAccessObjects/extensionDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";

// ==========================
// Configuración estática
// ==========================

// Mapeo de MIME types a extensiones
const MIME_TO_EXTENSION = {
  // Documentos
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
  "text/html": "html",
  "text/css": "css",
  "application/javascript": "js",

  // Imágenes
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",

  // Audio
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",

  // Video
  "video/mp4": "mp4",
  "video/avi": "avi",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/webm": "webm",

  // Comprimidos
  "application/zip": "zip",
  "application/x-rar-compressed": "rar",
  "application/x-7z-compressed": "7z",
  "application/gzip": "gz",

  // Otros
  "application/xml": "xml",
  "application/rtf": "rtf",
};

// MIME types peligrosos
const DANGEROUS_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-msdos-program",
  "application/x-winexe",
  "text/x-shellscript",
  "application/x-sh",
  "application/x-javascript",
  "text/javascript",
];

// Extensiones peligrosas
const DANGEROUS_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js", "jar",
  "msi", "dll", "app", "sh", "run", "deb", "pkg", "dmg",
];

// ==========================
// Middleware
// ==========================
export const attachFileExtensions = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay archivos para procesar",
      });
    }

    // Extensiones válidas desde BD
    const extensions = await extensionDAO.getAllExtensions();
    const extMap = new Map(
      extensions.map((ext) => [ext.name.toLowerCase(), { id: ext.id, name: ext.name }])
    );

    const validateFile = (file) => {
      const extFromName = path.extname(file.originalname).replace(/^\./, "").toLowerCase();
      const extFromMime = MIME_TO_EXTENSION[file.mimetype];

      // Bloquear MIME peligroso
      if (DANGEROUS_MIME_TYPES.includes(file.mimetype)) {
        throw new Error(`MIME peligroso detectado: ${file.mimetype}`);
      }

      // Bloquear extensión peligrosa
      if (DANGEROUS_EXTENSIONS.includes(extFromName)) {
        throw new Error(`Extensión peligrosa detectada: ${extFromName}`);
      }

      // Verificar que el MIME esté soportado
      if (!extFromMime) {
        throw new Error(`MIME no soportado: ${file.mimetype}`);
      }

      // Verificar que extensión y MIME coincidan
      if (extFromMime !== extFromName) {
        throw new Error(
          `La extensión y el MIME no coinciden en ${file.originalname}. ` +
          `Extensión: ${extFromName}, MIME esperado: ${extFromMime}`
        );
      }

      // Verificar que la extensión esté en BD
      const dbExt = extMap.get(extFromName);
      if (!dbExt) {
        throw new Error(`Extensión no registrada en BD: ${extFromName}`);
      }

      return {
        extensionId: dbExt.id,
        extensionName: dbExt.name,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size_bytes: file.size ?? 0, // tamaño en bytes
      };
    };

    req.fileInfo =
      req.files.length === 1
        ? validateFile(req.files[0])
        : req.files.map(validateFile);

    loggerGlobal.info("Información de archivos lista para insertar", {
      fileInfo: req.fileInfo,
    });

    next();
  } catch (error) {
    loggerGlobal.error("Error en attachFileExtensions", error);
    return res.status(400).json({
      success: false,
      message: "Error al validar archivo",
      details: error.message,
    });
  }
};
