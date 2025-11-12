import Joi from 'joi'

export const searchFilesSchema = Joi.object({
  codes: Joi.string()
    .pattern(/^(FILE-[A-Za-z0-9]+)(,FILE-[A-Za-z0-9]+)*$/)
    .required()
    .messages({
      "any.required": "El parámetro codes es obligatorio",
      "string.empty": "El parámetro codes no puede estar vacío",
      "string.pattern.base": "Los códigos deben tener el formato FILE-XXXXXXXX separados por comas"
    }),
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