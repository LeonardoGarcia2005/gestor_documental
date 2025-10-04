export const measureUploadTime = async (req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const end = process.hrtime(start);
    const timeInMs = end[0] * 1000 + end[1] / 1000000;
    console.log(`Upload time: ${timeInMs}ms`);
  });

  next();
};
