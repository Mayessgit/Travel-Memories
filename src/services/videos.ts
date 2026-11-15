import { one } from '../db';
import type { AuthUser } from '../middleware/auth';
import { blockedBetween, followsUser } from './queries';

export function videoVisibleClause(viewer: string | null): string {
  const active = `u.status = 'active'`;
  if (!viewer) return `(${active} AND u.is_private = FALSE AND v.visibility = 'public')`;
  return `((v.user_id = ${viewer}) OR (${active} AND NOT ${blockedBetween(viewer, 'v.user_id')}
    AND ((v.visibility = 'public' AND (u.is_private = FALSE OR ${followsUser(viewer, 'v.user_id')}))
      OR (v.visibility = 'followers' AND ${followsUser(viewer, 'v.user_id')}))))`;
}

export async function getVisibleVideo(id: number, viewer?: Pick<AuthUser, 'id'>) {
  const params: unknown[] = [id];
  let placeholder: string | null = null;
  if (viewer) {
    params.push(viewer.id);
    placeholder = '$2';
  }
  const row = await one(
    `SELECT v.id, v.user_id, v.video_url, v.description, v.visibility, v.created_at,
            u.username AS u_username, u.full_name AS u_full_name, u.avatar_url AS u_avatar_url
     FROM videos v JOIN users u ON u.id = v.user_id
     WHERE v.id = $1 AND ${videoVisibleClause(placeholder)}`,
    params,
  );
  if (!row) return null;
  const { u_username, u_full_name, u_avatar_url, ...video } = row;
  return {
    ...video,
    user: { id: video.user_id, username: u_username, full_name: u_full_name, avatar_url: u_avatar_url },
  };
}
