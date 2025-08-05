import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const programLogosDir = path.join(uploadsDir, 'program-logos');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(programLogosDir)) {
  fs.mkdirSync(programLogosDir, { recursive: true });
}

// Configure multer for program logo uploads
const programLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, programLogosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `program-logo-${uniqueSuffix}${ext}`);
  }
});

// File filter for images only
const imageFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Multer configuration for program logos
export const uploadProgramLogo = multer({
  storage: programLogoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Helper function to delete old logo file
export const deleteLogoFile = (logoPath: string) => {
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      fs.unlinkSync(logoPath);
    } catch (error) {
      console.error('Error deleting logo file:', error);
    }
  }
};

// Helper function to get logo URL
export const getLogoUrl = (filename: string) => {
  return `/uploads/program-logos/${filename}`;
};
