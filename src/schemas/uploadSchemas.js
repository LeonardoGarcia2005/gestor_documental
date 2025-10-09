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
import { secureFileValidator } from "../lib/secureFileValidator.js";

const Joi = BaseJoi.extend(JoiDate);

const typesExcluded = fileTypes.filter(
  (type) => type !== "video" && type !== "audio"
);

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
export const createMultipleFilesSchema = (isDistinct = true) => Joi.object({
  ...baseFileSchema,
  typeOfFile: Joi.string()
    .valid(...typesExcluded)
    .required(),
  filesData: Joi.array()
    .items(
      isDistinct
        ? Joi.object({ file: Joi.any().custom(secureFileValidator).required() }).required()
        : Joi.object({
            file: Joi.any().custom(secureFileValidator).required(),
            deviceType: Joi.string().valid(...deviceTypes).required(),
          }).required()
    )
    .min(1)
    .max(parseInt(process.env.MAX_FILES_COUNT || "20"))
    .required()
    .messages({
      "array.min": "Debe enviar al menos 1 archivo",
      "array.max": `No puede enviar más de ${
        process.env.MAX_FILES_COUNT || "10"
      } archivos`,
      "any.required": "El array de archivos es requerido",
    }),
});
