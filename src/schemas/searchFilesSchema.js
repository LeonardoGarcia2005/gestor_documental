import Joi from 'joi'

export const searchFilesSchema = Joi.object({
  files: Joi.array()
    .items(
      Joi.object({
        code: Joi.string()
          .pattern(/^FILE-[A-Za-z0-9]+$/)
          .required()
          .messages({
            "any.required": "El código del archivo es obligatorio",
            "string.empty": "El código no puede estar vacío",
            "string.pattern.base": "El código debe tener el formato FILE-XXXXXXXX"
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "Debe enviar al menos un archivo",
      "any.required": "El campo files es obligatorio"
    })
});

export const searchFilesSchemaResizing = Joi.object({
  files: Joi.array()
    .items(
      Joi.object({
        code: Joi.string()
          .pattern(/^FILE-[A-Za-z0-9]+$/)
          .required()
          .messages({
            "any.required": "El código del archivo es obligatorio",
            "string.empty": "El código no puede estar vacío",
            "string.pattern.base": "El código debe tener el formato FILE-XXXXXXXX"
          }),
        dimension: Joi.string()
          .pattern(/^\d+x\d+$/)
          .required()
          .messages({
            "string.pattern.base": "La dimensión debe tener el formato 'anchoXalto', ej: 400x300"
          })
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "Debe enviar al menos un archivo",
      "any.required": "El campo files es obligatorio"
    })
});