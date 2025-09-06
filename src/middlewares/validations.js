import { z } from 'zod';

export const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      const validationResult = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query
      });
      
      // Opcional: agregar datos validados al request
      req.validated = validationResult;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};