
console.log({
  CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME ? "present" : "missing",
  CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY ? "present" : "missing",
  CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET ? "present" : "missing",
  VITE_CLOUDINARY_CLOUD_NAME: !!process.env.VITE_CLOUDINARY_CLOUD_NAME ? "present" : "missing",
  cloudName: process.env.CLOUDINARY_CLOUD_NAME
});
