
import Joi from 'joi'
import { secureFileValidator } from '../lib/secureFileValidator.js'
import { configurationProvider } from '../config/configurationManager.js'

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
    .max(configurationProvider.uploads.maxFilesCount)
    .required()
    .messages({
      "array.min": "Debe enviar al menos 1 archivo",
      "array.max": `No puede enviar más de ${
        configurationProvider.uploads.maxFilesCount
        } archivos`,
      "any.required": "El array de archivos es requerido",
    }),
  hasCompany: Joi.boolean().required(),
});
