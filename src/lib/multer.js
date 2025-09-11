import multer from "multer";
import path from "path";
import { extensionDAO } from "../dataAccessObjects/extensionDAO.js"

// Configuración de Multer para almacenar archivos en memoria (como Buffer)
const storage = multer.memoryStorage();

// Extensiones permitidas
const allowedExtensions = await extensionDAO.getAllExtensions()

// Inicialización de Multer con almacenamiento en memoria y validación
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`Extensión no permitida: ${ext}`));
    }
    cb(null, true);
  },
});

export default upload;
