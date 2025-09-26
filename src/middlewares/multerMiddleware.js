import multer from "multer";
import { loggerGlobal } from "../logging/loggerManager.js";
import dotenv from "dotenv";
import { sanitizeFileName } from "../lib/formatters.js";

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

// Handlers específicos para single y multiple
const commonMulterOptions = {
  storage,
  limits: {
    files: fileConfig.maxFiles,
    fieldNameSize: fileConfig.maxFilenameLength,
    fieldSize: fileConfig.maxFieldSize,
  },
  fileFilter: (_, file, cb) => {
    try {
      if (!file) {
        return cb(new Error("No se recibió ningún archivo"));
      }
      file.originalname = sanitizeFileName(
        file.originalname,
        fileConfig.maxFilenameLength
      );
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
};

export const handleSingleFile = (fieldName) => {
  return (req, res, next) => {
    const uploadHandler = multer(commonMulterOptions).single(fieldName);
    uploadHandler(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "Error en la subida",
          details: err.message,
        });
      }
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No se recibió el archivo",
          details: `Usa el campo '${fieldName}' en el formData`,
        });
      }
      loggerGlobal.info(`Archivo recibido: ${req.file.originalname}`);
      next();
    });
  };
};

export const handleMultipleFiles = (fieldName) => {
  return (req, res, next) => {
    const uploadHandler = multer(commonMulterOptions).array(
      fieldName,
      fileConfig.maxFiles
    );
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