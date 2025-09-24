import { filesDAO } from "../../dataAccessObjects/filesDAO.js"

export const changeStatusFile = async (req, res) => {
  try {
    const { codeFile, isActive } = req.body;

    await filesDAO.changeStatusFile(codeFile, isActive);
    // Responder con el resultado
    return res.status(200).json({
      success: true,
      message: "Archivo actualizado exitosamente",
    });
  } catch (error) {
    // Manejo de errores internos
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};
