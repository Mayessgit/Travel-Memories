import { apiClient } from './client';

export interface Video {
  id: number;
  user_id: number;
  video_url: string;
  description: string;
  visibility: 'public' | 'followers' | 'private';
  created_at: string;
  user: { id: number; username: string; full_name: string; avatar_url: string };
}

type R<T> = { success: boolean; data: T; pagination?: { hasMore: boolean } };

export const videosApi = {
  list: () => apiClient.get<R<Video[]>>('/videos', { limit: 50 }),
  create: (form: FormData) => apiClient.postForm<R<Video>>('/videos', form),
  remove: (id: number) => apiClient.delete<R<undefined>>(`/videos/${id}`),
};
