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
import { configurationProvider } from "../config/configurationManager.js";

const Joi = BaseJoi.extend(JoiDate);

// Tipos excluidos para cuando suban varios archivos ya que podria colapsar el sistema (sin video y audio)
const typesExcluded = fileTypes.filter(
  (type) => type !== "video" && type !== "audio"
);

// Esquema base (compartido por todos)
const baseFileSchema = {
  channel: Joi.string()
    .valid(...channels)
    .required()
    .messages({
      "any.required": "El canal es requerido",
      "any.only": `El canal debe ser uno de: ${channels.join(", ")}`,
    }),

  documentType: Joi.string()
    .valid(...documentTypes)
    .required()
    .messages({
      "any.required": "El tipo de documento es requerido",
      "any.only": `El tipo debe ser uno de: ${documentTypes.join(", ")}`,
    }),

  hasCompany: Joi.boolean()
    .required()
    .messages({
      "any.required": "hasCompany es requerido",
      "boolean.base": "hasCompany debe ser true o false",
    }),

  securityLevel: Joi.string()
    .valid(...securityLevels)
    .required()
    .messages({
      "any.required": "El nivel de seguridad es requerido",
      "any.only": `Debe ser uno de: ${securityLevels.join(", ")}`,
    }),

  emissionDate: Joi.date()
    .format("YYYY-MM-DD")
    .min("1900-01-01")
    .max("now")
    .allow(null, "")
    .optional()
    .messages({
      "date.format": "La fecha de emisión debe estar en formato YYYY-MM-DD",
      "date.max": "La fecha de emisión no puede ser futura",
    }),

  expirationDate: Joi.date()
    .format("YYYY-MM-DD")
    .min(Joi.ref("emissionDate"))
    .max("2125-01-01")
    .allow(null, "")
    .optional()
    .messages({
      "date.format": "La fecha de expiración debe estar en formato YYYY-MM-DD",
      "date.min": "La fecha de expiración debe ser posterior a la de emisión",
    })
};

// VALIDACIÓN PERSONALIZADA: Archivos privados
const validatePrivateFileSecurity = (value, helpers) => {
  const { securityLevel, hasCompany } = helpers.state.ancestors[0];

  if (securityLevel === "private" && hasCompany !== true) {
    return helpers.error("any.invalid", {
      message: "Los archivos privados deben tener hasCompany en true (deben estar asociados a una empresa)"
    });
  }

  return value;
};

// Esquema para subir un archivo unico
export const createSingleFileSchema = Joi.object({
  ...baseFileSchema,

  typeOfFile: Joi.string()
    .required()
    .messages({
      "any.required": "El tipo de archivo es requerido",
    }),

  file: Joi.any()
    .custom(secureFileValidator)
    .custom(validatePrivateFileSecurity)
    .required()
    .messages({
      "any.required": "El archivo es requerido",
      "file.invalidSignature": "El archivo no coincide con su tipo declarado (posible spoofing)",
      "file.suspiciousContent": "El archivo contiene contenido potencialmente malicioso",
      "file.unknownType": "El tipo de archivo no pudo ser determinado",
      "file.unsupportedType": "El tipo de archivo no está permitido",
      "any.invalid": "Los archivos privados deben tener hasCompany en true (deben estar asociados a una empresa)",
    }),
});

// Esquema para subir multiples archivos que son iguales
export const createVariantsSchema = Joi.object({
  ...baseFileSchema,

  typeOfFile: Joi.string()
    .valid(...typesExcluded)
    .required()
    .messages({
      "any.required": "El tipo de archivo es requerido",
      "any.only": `El tipo debe ser uno de: ${typesExcluded.join(", ")}`,
    }),

  filesData: Joi.array()
    .items(
      Joi.object({
        file: Joi.any()
          .custom(secureFileValidator)
          .custom(validatePrivateFileSecurity)
          .required(),
        deviceType: Joi.string()
          .valid(...deviceTypes)
          .required()
          .messages({
            "any.required": "deviceType es requerido para cada variante",
            "any.only": `deviceType debe ser uno de: ${deviceTypes.join(", ")}`,
          }),
      })
    )
    .min(1)
    .max(configurationProvider.uploads.maxFilesCount)
    .required()
    .messages({
      "array.min": "Debe enviar al menos 1 variante",
      "array.max": `No puede enviar más de ${configurationProvider.uploads.maxFilesCount} variantes`,
      "any.required": "El array de variantes es requerido",
      "any.invalid": "Los archivos privados deben tener hasCompany en true",
    }),
});

// Esquema para subir archivos distintos y que puede tener diferentes valores en los campos divididos por comas
export const createDistinctFilesSchema = Joi.object({
  // Campos que vienen como strings separados por comas (o arrays)
  channel: Joi.alternatives()
    .try(
      Joi.string().required(),
      Joi.array().items(Joi.string().valid(...channels)).min(1)
    )
    .required()
    .messages({
      "any.required": "El campo channel es requerido",
    }),

  documentType: Joi.alternatives()
    .try(
      Joi.string().required(),
      Joi.array().items(Joi.string().valid(...documentTypes)).min(1)
    )
    .required()
    .messages({
      "any.required": "El campo documentType es requerido",
    }),

  securityLevel: Joi.alternatives()
    .try(
      Joi.string().required(),
      Joi.array().items(Joi.string().valid(...securityLevels)).min(1)
    )
    .required()
    .messages({
      "any.required": "El campo securityLevel es requerido",
    }),

  hasCompany: Joi.alternatives()
    .try(
      Joi.string().required(),
      Joi.boolean(),
      Joi.array().items(Joi.boolean()).min(1)
    )
    .required()
    .messages({
      "any.required": "El campo hasCompany es requerido",
    }),

  typeOfFile: Joi.alternatives()
    .try(
      Joi.string().required(),
      Joi.array().items(Joi.string().valid(...typesExcluded)).min(1)
    )
    .required()
    .messages({
      "any.required": "El tipo de archivo es requerido",
    }),

  // Campos opcionales
  emissionDate: Joi.alternatives()
    .try(
      Joi.string().optional(),
      Joi.array().items(Joi.date().format("YYYY-MM-DD")).optional()
    )
    .optional(),

  expirationDate: Joi.alternatives()
    .try(
      Joi.string().optional(),
      Joi.array().items(Joi.date().format("YYYY-MM-DD")).optional()
    )
    .optional(),

  // filesData será construido por el middleware validateSchemaMiddleware
  filesData: Joi.array()
    .items(
      Joi.object({
        file: Joi.any().required(),
        channel: Joi.string().valid(...channels).required(),
        documentType: Joi.string().valid(...documentTypes).required(),
        securityLevel: Joi.string().valid(...securityLevels).required(),
        hasCompany: Joi.boolean().required(),
        typeOfFile: Joi.string().valid(...typesExcluded).required(),
        emissionDate: Joi.date().format("YYYY-MM-DD").allow(null).optional(),
        expirationDate: Joi.date().format("YYYY-MM-DD").allow(null).optional(),
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
          .allow(null)
          .optional(),
      })
    )
    .min(1)
    .optional(),
});
