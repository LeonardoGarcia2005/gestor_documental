import sizeOf from "image-size";

export const getImageDimensionsWithLibrary = (buffer) => {
  try {
    const dimensions = sizeOf(buffer);

    return {
      resolution: `${dimensions.width}x${dimensions.height}`,
    };
  } catch (error) {
    console.error("Error al obtener dimensiones:", error);
    return null;
  }
};
