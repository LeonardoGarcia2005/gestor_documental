
import { fileExtensions } from "../dataAccessObjects/enumDAO.js";
import { fileTypeFromBuffer } from "file-type";

// Mapa extensión ↔ mimetype (basado en tu tabla)
const EXTENSION_MIME_MAP = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  zip: "application/zip",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};

// Validador personalizado para archivos con validación de seguridad
export const secureFileValidator = async (value, helpers) => {
  if (!value || !value.buffer) {
    return helpers.error("file.required");
  }

  const { originalname, mimetype, buffer } = value;

  // Detectar tipo real con file-type
  const detected = await fileTypeFromBuffer(buffer);

  if (detected) {
    const detectedMime = detected.mime;

    // Buscar extensión permitida para ese mimetype
    const matchedExtension = Object.keys(EXTENSION_MIME_MAP).find(
      (ext) => EXTENSION_MIME_MAP[ext] === detectedMime
    );

    if (!matchedExtension || !fileExtensions.includes(matchedExtension)) {
      return helpers.error("file.unsupportedType", { detectedMime });
    }

    // También podemos validar que el mimetype que envía el cliente coincida
    if (detectedMime !== mimetype) {
      return helpers.error("file.invalidSignature", { mimetype });
    }
  } else {
    // Si no lo detecta, solo aceptamos txt explícitamente
    if (!["txt"].includes(originalname.split(".").pop().toLowerCase())) {
      return helpers.error("file.unknownType");
    }
  }

  // Detectar contenido malicioso básico
  const suspiciousPatterns = [
    /<script/i, // Scripts embebidos
    /javascript:/i, // URLs javascript
    /data:.*base64/i, // Data URLs sospechosas
    /\x00/, // Null bytes
  ];

  const bufferString = buffer.toString(
    "utf8",
    0,
    Math.min(1024, buffer.length)
  );
  const hasSuspiciousContent = suspiciousPatterns.some((pattern) =>
    pattern.test(bufferString)
  );

  if (hasSuspiciousContent) {
    return helpers.error("file.suspiciousContent");
  }

  return value;
};