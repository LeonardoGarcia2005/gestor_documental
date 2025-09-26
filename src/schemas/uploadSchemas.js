import {
  channels,
  documentTypes,
  securityLevels,
  fileExtensions,
  deviceTypes,
  fileTypes,
} from "../dataAccessObjects/enumDAO.js";
import BaseJoi from "joi";
import JoiDate from "@joi/date";
import { fileTypeFromBuffer } from "file-type";

const Joi = BaseJoi.extend(JoiDate);

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

const typesExcluded = fileTypes.filter(
  (type) => type !== "video" && type !== "audio"
);

// Validador personalizado para archivos con validación de seguridad
const secureFileValidator = async (value, helpers) => {
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

// Esquema base
const baseFileSchema = {
  channel: Joi.string()
    .valid(...channels)
    .required(),

  documentType: Joi.string()
    .valid(...documentTypes)
    .required(),

  hasCompany: Joi.boolean().required(),

  securityLevel: Joi.string()
    .valid(...securityLevels)
    .required(),

  emissionDate: Joi.date()
    .format("YYYY-MM-DD")
    .min("1900-01-01")
    .max("now")
    .allow(null, "")
    .optional(),

  expirationDate: Joi.date()
    .format("YYYY-MM-DD")
    .min(Joi.ref("emissionDate"))
    .max("2125-01-01")
    .allow(null, "")
    .optional(),

  metadata: Joi.alternatives()
    .try(
      Joi.array().items(
        Joi.object({
          clave: Joi.string().max(100).required(),
          valor: Joi.string().max(500).required(),
        })
      ),
      Joi.string().max(2000)
    )
    .optional()
    .custom((value, helpers) => {
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (JSON.stringify(parsed).length > 2000) {
            return helpers.error("metadata.tooComplex");
          }
          return parsed;
        } catch (error) {
          return helpers.error("metadata.invalidJson");
        }
      }
      return value;
    }),
};

// Esquema para archivo único
export const createSingleFileSchema = Joi.object({
  ...baseFileSchema,
  typeOfFile: Joi.string()
    .valid(...fileTypes)
    .required(),
  file: Joi.any().custom(secureFileValidator).required().messages({
    "file.required": "El archivo es requerido",
    "file.invalidSignature":
      "El archivo no coincide con su tipo declarado (posible spoofing)",
    "file.suspiciousContent":
      "El archivo contiene contenido potencialmente malicioso",
    "file.unknownType": "El tipo de archivo no pudo ser determinado",
    "file.unsupportedType": "El tipo de archivo no está permitido",
  }),
});

// Esquema para múltiples archivos
export const createMultipleFilesSchema = Joi.object({
  ...baseFileSchema,
  typeOfFile: Joi.string()
    .valid(...typesExcluded)
    .required(),
  filesData: Joi.array()
    .items(
      Joi.object({
        file: Joi.any().custom(secureFileValidator).required(),
        deviceType: Joi.string()
          .valid(...deviceTypes)
          .required(),
      })
    )
    .min(1)
    .max(parseInt(process.env.MAX_FILES_COUNT || "10"))
    .required()
    .messages({
      "array.min": "Debe enviar al menos 1 archivo",
      "array.max": `No puede enviar más de ${
        process.env.MAX_FILES_COUNT || "10"
      } archivos`,
      "any.required": "El array de archivos es requerido",
    }),
});
