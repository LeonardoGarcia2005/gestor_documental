import upload from "../lib/multer.js";

export const configureDynamicUpload = (req, res, next) => {
  const isMultiple = req.route.path.includes("multiple");
  let fileLimit = 10;

  // Configurar multer dinámicamente
  const dynamicUpload = isMultiple
    ? upload.array("files", fileLimit)
    : upload.single("file");

  // Ejecutar multer y capturar errores
  dynamicUpload(req, res, (err) => {
    if (err) {
      // Multer lanza dos tipos de errores:
      // - MulterError (ej: límite de archivos, tamaño excedido)
      // - Error normal (ej: extensión no permitida)
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};
