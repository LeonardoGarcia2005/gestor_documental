import multer from "multer";
import path from "path";
import { loggerGlobal } from "../logging/loggerManager.js";
import dotenv from "dotenv";

dotenv.config();

// Configuración de Multer para almacenar en memoria
const storage = multer.memoryStorage();

// Configuración por env
const fileConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || "10") * 1024 * 1024,
  maxFiles: parseInt(process.env.MAX_FILES_COUNT || "10"),
  maxFilenameLength: parseInt(process.env.MAX_FILENAME_LENGTH || "50"),
  maxFieldSize: parseInt(process.env.MAX_FIELD_SIZE_KB || "1024") * 1024,
};

// Sanitizar nombre
export const sanitizeFileName = (filename) => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);

  const sanitizedName = name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9\-_]/g, "")
    .replace(/[-_]{2,}/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");

  const finalName = sanitizedName || `archivo_${Date.now()}`;
  const truncatedName = finalName.substring(0, fileConfig.maxFilenameLength);

  return `${truncatedName}${ext.toLowerCase()}`;
};

// Middleware genérico para subir
const uploadSettings = (fieldName) => {
  return (req, res, next) => {
    const uploadHandler = multer({
      storage,
      limits: {
        fileSize: fileConfig.maxFileSize,
        files: fileConfig.maxFiles,
        fieldNameSize: fileConfig.maxFilenameLength,
        fieldSize: fileConfig.maxFieldSize,
      },
      fileFilter: (_, file, cb) => {
        try {
          if (!file) {
            return cb(new Error("No se recibió ningún archivo"));
          }
          // sanitizamos el nombre
          file.originalname = sanitizeFileName(file.originalname);
          cb(null, true);
        } catch (error) {
          cb(error);
        }
      },
    }).array(fieldName, fileConfig.maxFiles);

    uploadHandler(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "Error en la subida",
          details: err.message,
        });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No se recibieron archivos",
          details: `Usa el campo '${fieldName}' en el formData`,
        });
      }

      loggerGlobal.info(`Archivos recibidos: ${req.files.length}`);
      next();
    });
  };
};

export const handleSingleFile = (fieldName = "file") =>
  uploadSettings(fieldName);
export const handleMultipleFiles = (fieldName = "files") =>
  uploadSettings(fieldName);