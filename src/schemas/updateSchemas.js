
import Joi from 'joi'
import { secureFileValidator } from '../lib/secureFileValidator.js'

// Esquema para actualizar multiples archivos
export const updateMultipleFilesSchema = Joi.object({
  fileToUpdate: Joi.array()
    .items(
      Joi.object({
        code: Joi.string().required(),
        file: Joi.any().custom(secureFileValidator).required(),
      })
    )
    .min(1)
    .max(parseInt(process.env.MAX_FILES_COUNT || "10"))
    .required()
    .messages({
      "array.min": "Debe enviar al menos 1 archivo",
      "array.max": `No puede enviar más de ${process.env.MAX_FILES_COUNT || "10"
        } archivos`,
      "any.required": "El array de archivos es requerido",
    }),
  hasCompany: Joi.boolean().required(),
});
