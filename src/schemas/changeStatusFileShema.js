import Joi from 'joi'

export const changeStatusFileSchema = Joi.object({
    codeFile: Joi.string()
      .pattern(/^FILE-[A-F0-9]{8}$/)
      .required()
      .messages({
        'any.required': "El campo 'codeFile' es obligatorio.",
        'string.pattern.base':
          'Código de archivo inválido. Debe seguir el formato FILE-XXXXXXXX.',
      }),
    isActive: Joi.boolean().required().messages({
      'any.required': "El campo 'is_active' es obligatorio.",
      'boolean.base': "El campo 'is_active' debe ser un valor booleano.",
    }),
  })