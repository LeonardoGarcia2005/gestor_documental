import sizeOf from "image-size";
import { loggerGlobal } from "../logging/loggerManager.js";

export const getImageDimensionsWithLibrary = (buffer) => {
  try {
    const dimensions = sizeOf(buffer);

    return {
      resolution: `${dimensions.width}x${dimensions.height}`,
    };
  } catch (error) {
    loggerGlobal.error("Error al obtener dimensiones:", error);
    return null;
  }
};
