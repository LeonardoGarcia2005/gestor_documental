import {
  channels,
  documentTypes,
  securityLevels,
} from "../dataAccessObjects/enumDAO.js";
import BaseJoi from "joi";
import JoiDate from "@joi/date";

// Extender Joi con soporte de fechas
const Joi = BaseJoi.extend(JoiDate);

// Esquema base para validar lo que entra
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
    .optional()
    .messages({
      "date.format":
        "La fecha de emisión debe tener el formato YYYY-MM-DD (ejemplo: 2024-12-31)",
      "date.min": "La fecha de emisión no puede ser anterior a 1900-01-01",
      "date.max":
        "La fecha de emisión no puede ser posterior a la fecha actual",
      "date.base": "La fecha de emisión debe ser una fecha válida",
    }),

  expirationDate: Joi.date()
    .format("YYYY-MM-DD")
    .min(Joi.ref("emissionDate"))
    .max("2125-01-01")
    .allow(null, "")
    .optional()
    .messages({
      "date.format":
        "La fecha de expiración debe tener el formato YYYY-MM-DD (ejemplo: 2027-12-31)",
      "date.min":
        "La fecha de expiración debe ser posterior a la fecha de emisión",
      "date.max":
        "La fecha de expiración no puede ser superior a 100 años en el futuro",
      "date.base": "La fecha de expiración debe ser una fecha válida",
    }),

  metadata: Joi.alternatives()
    .try(
      Joi.array().items(
        Joi.object({
          clave: Joi.string().required(),
          valor: Joi.string().required(),
        })
      ),
      Joi.string() // JSON string
    )
    .optional()
    .custom((value, helpers) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch (error) {
          return helpers.error("any.invalid", {
            message: "Formato de 'metadata' inválido.",
          });
        }
      }
      return value;
    }),
};

export const createSingleFileSchema = Joi.object({
  ...baseFileSchema,
});


// Schema para múltiples archivos con resoluciones
export const createMultipleFilesSchema = Joi.object({
  ...baseFileSchema,

  // Para múltiples archivos, especificar las resoluciones esperadas
  resolutions: Joi.array()
    .items(
      Joi.object({
        deviceType: Joi.string()
          .valid("desktop", "tablet", "mobile", "tv")
          .required(),
        resolution: Joi.string()
          .valid("1920x1080", "1366x768", "768x1024", "375x667", "3840x2160")
          .required(),
        isOriginal: Joi.boolean().default(false),
      })
    )
    .min(1)
    .max(10)
    .optional()
    .custom((value, helpers) => {
      if (!value) return value;

      // Validar que solo haya un original
      const originals = value.filter((r) => r.isOriginal);
      if (originals.length > 1) {
        return helpers.error("any.invalid", {
          message: "Solo puede haber una resolución marcada como original",
        });
      }

      // Si no hay original, marcar el primero como original
      if (originals.length === 0 && value.length > 0) {
        value[0].isOriginal = true;
      }

      return value;
    }),

  // Alternativamente, permitir especificar por campos separados
  deviceTypes: Joi.alternatives()
    .try(
      Joi.string().valid("desktop", "tablet", "phone", "tv"),
      Joi.array().items(Joi.string().valid("desktop", "tablet", "phone", "tv"))
    )
    .optional(),

  /*   resolutionValues: Joi.alternatives()
    .try(
      Joi.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
      Joi.array().items(Joi.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/))
    )
    .optional() */
});
