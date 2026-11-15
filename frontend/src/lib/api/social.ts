import { apiClient } from './client';
import type { Memory } from '@/types/memory';
import type { FollowStatus, PublicUser, SearchUser } from '@/types/social';

type R<T> = { success: boolean; data: T; message?: string };

export const socialApi = {
  /** Suivre : renvoie "following" (compte public) ou "requested" (compte privé). */
  follow: (userId: number) => apiClient.post<R<{ status: FollowStatus }>>(`/users/${userId}/follow`),
  /** Se désabonner OU annuler une demande en attente. */
  unfollow: (userId: number) => apiClient.delete<R<{ status: FollowStatus }>>(`/users/${userId}/follow`),
  removeFollower: (userId: number) => apiClient.delete<R<undefined>>(`/users/${userId}/follower`),

  followers: (username: string, page = 1) => apiClient.get<R<PublicUser[]>>(`/users/${username}/followers`, { page }),
  following: (username: string, page = 1) => apiClient.get<R<PublicUser[]>>(`/users/${username}/following`, { page }),

  requests: () => apiClient.get<R<PublicUser[]> & { count: number }>('/follow-requests'),
  acceptRequest: (userId: number) => apiClient.post<R<undefined>>(`/follow-requests/${userId}/accept`),
  declineRequest: (userId: number) => apiClient.delete<R<undefined>>(`/follow-requests/${userId}`),

  friends: (q?: string, page = 1) => apiClient.get<R<PublicUser[]> & { pagination: { hasMore: boolean; total: number } }>('/friends', { ...(q ? { q } : {}), limit: 50, page }),
  suggestions: (page = 1) => apiClient.get<R<SearchUser[]> & { pagination: { hasMore: boolean; total: number } }>('/friends/suggestions', { page, limit: 10 }),
  removeFriend: (userId: number) => apiClient.delete<R<undefined>>(`/friends/${userId}`),

  blocks: () => apiClient.get<R<PublicUser[]>>('/blocks'),
  block: (userId: number) => apiClient.post<R<undefined>>(`/blocks/${userId}`),
  unblock: (userId: number) => apiClient.delete<R<undefined>>(`/blocks/${userId}`),

  searchUsers: (q: string, page = 1) => apiClient.get<R<SearchUser[]> & { pagination: { hasMore: boolean; total: number } }>('/users/search', { q, page, limit: 10 }),
  sentRequests: () => apiClient.get<R<(PublicUser & { requested_at: string })[]>>('/follow-requests/sent'),
  tagged: (username: string, page = 1) => apiClient.get<R<Memory[]> & { pagination: { hasMore: boolean } }>(`/users/${username}/tagged`, { page }),

  setPrivate: (is_private: boolean) => apiClient.put<R<PublicUser>>('/users/me', { is_private }),
};
