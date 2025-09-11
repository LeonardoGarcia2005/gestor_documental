import { filesDAO } from "../../dataAccessObjects/filesDAO.js"

export const changeStatusFile = async (req, res) => {
  try {
    const { codeFile, is_active } = req.body;

    const result = await filesDAO.changeStatusFile(codeFile, is_active);
    // Responder con el resultado
    return res.status(200).json(result);
  } catch (error) {
    // Manejo de errores internos
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};
