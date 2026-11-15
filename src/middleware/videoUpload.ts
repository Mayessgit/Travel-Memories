import multer from 'multer';
import { config } from '../config';
import { HttpError } from '../utils/http';

const ALLOWED = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_VIDEO_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new HttpError(415, 'Format vidéo non accepté (MP4, MOV ou WebM)'));
    cb(null, true);
  },
});
