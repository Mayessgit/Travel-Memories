import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { videoUpload } from '../middleware/videoUpload';
import { validate } from '../middleware/validate';
import { sendMessage } from '../services/messages';
import { getVisibleVideo, videoVisibleClause } from '../services/videos';
import { deleteFile, saveVideo } from '../utils/files';
import { asyncHandler, getPage, HttpError, intParam, ok } from '../utils/http';

const router = Router();
const selectVideo = () => `
  SELECT v.id, v.user_id, v.video_url, v.description, v.visibility, v.created_at,
         u.username AS u_username, u.full_name AS u_full_name, u.avatar_url AS u_avatar_url
  FROM videos v JOIN users u ON u.id = v.user_id`;

const shapeVideo = ({ u_username, u_full_name, u_avatar_url, ...video }: any) => ({
  ...video,
  user: { id: video.user_id, username: u_username, full_name: u_full_name, avatar_url: u_avatar_url },
});

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPage(req, 12, 50);
    const viewer = req.user ? '$1' : null;
    const params = req.user ? [req.user.id, limit, offset] : [limit, offset];
    const where = videoVisibleClause(viewer);
    const rows = await query(
      `${selectVideo()} WHERE ${where} ORDER BY v.created_at DESC, v.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const count = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM videos v JOIN users u ON u.id = v.user_id WHERE ${where}`,
      req.user ? [req.user.id] : [],
    );
    return ok(res, rows.map(shapeVideo), { pagination: { page, limit, total: count!.n, totalPages: Math.max(1, Math.ceil(count!.n / limit)), hasMore: page * limit < count!.n } });
  }),
);

router.post(
  '/',
  authenticate,
  videoUpload.single('video'),
  validate(z.object({
    description: z.string().trim().min(1, 'Description requise').max(1000, 'Description trop longue'),
    visibility: z.enum(['public', 'followers', 'private']).default('public'),
  })),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Ajoutez une vidéo à votre publication');
    const saved = await saveVideo(req.file.buffer);
    const row = await one<{ id: number }>(
      `INSERT INTO videos (user_id, video_url, file_name, description, visibility) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user!.id, saved.url, saved.fileName, req.body.description, req.body.visibility],
    );
    return ok(res, await getVisibleVideo(row!.id, req.user), { message: 'Vidéo publiée' }, 201);
  }),
);

router.post(
  '/:id/share',
  authenticate,
  validate(z.object({
    user_ids: z.array(z.number().int().positive()).min(1, 'Choisissez au moins un destinataire').max(10, 'Maximum 10 destinataires'),
    body: z.string().trim().min(1).max(500).optional(),
  })),
  asyncHandler(async (req, res) => {
    const id = intParam(req.params.id, 'Vidéo');
    if (!(await getVisibleVideo(id, req.user))) throw new HttpError(404, 'Vidéo introuvable');
    const sent: number[] = [];
    const failed: { user_id: number; reason: string }[] = [];
    for (const userId of [...new Set<number>(req.body.user_ids)]) {
      try {
        await sendMessage({ sender: req.user!, recipientId: userId, videoId: id, body: req.body.body });
        sent.push(userId);
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        if (e.status === 404 && /Vidéo/.test(e.message)) throw e;
        failed.push({ user_id: userId, reason: e.message });
      }
    }
    return ok(res, { sent, failed });
  }),
);

router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = intParam(req.params.id, 'Vidéo');
    const video = await one<{ user_id: number; file_name: string }>('SELECT user_id, file_name FROM videos WHERE id = $1', [id]);
    if (!video) throw new HttpError(404, 'Vidéo introuvable');
    if (video.user_id !== req.user!.id && req.user!.role !== 'admin') throw new HttpError(403, 'Cette vidéo ne vous appartient pas');
    await query('DELETE FROM videos WHERE id = $1', [id]);
    await deleteFile(video.file_name);
    return ok(res, undefined, { message: 'Vidéo supprimée' });
  }),
);

export default router;
