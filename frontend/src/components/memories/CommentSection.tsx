'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Heart, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/errors';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MentionText } from '@/components/ui/MentionText';
import { timeAgo } from '@/lib/utils';
import { commentsApi, type Comment } from '@/lib/api/comments';

export function CommentSection({ memoryId, memoryOwnerId, onCountChange }: { memoryId: number; memoryOwnerId?: number; onCountChange?: (n: number) => void }) {
  const { user, isAuthenticated } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replying, setReplying] = useState(false);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      // apiClient ajoute le jeton : on voit aussi l'état « aimé » et on respecte les blocages.
      const res = await apiClient.get<{ data: Comment[]; count: number }>(`/memories/${memoryId}/comments`);
      setComments(res.data ?? []);
      const count = res.count ?? countComments(res.data ?? []);
      setCommentCount(count);
      onCountChange?.(count);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [memoryId, onCountChange]);

  useEffect(() => {
    void Promise.resolve().then(loadComments);
  }, [loadComments, isAuthenticated]);

  const handleSubmit = async () => {
    const content = newComment.trim();
    if (!content) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/memories/${memoryId}/comments`, { content });
      setNewComment('');
      await loadComments();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (c: Comment) => {
    if (!isAuthenticated) return;
    setComments((list) => updateComment(list, c.id, (x) => ({ ...x, is_liked: !c.is_liked, likes_count: x.likes_count + (c.is_liked ? -1 : 1) })));
    try {
      if (c.is_liked) await apiClient.delete(`/comments/${c.id}/like`);
      else await apiClient.post(`/comments/${c.id}/like`);
    } catch {
      await loadComments();
    }
  };

  const handleDelete = async (c: Comment) => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    try {
      await apiClient.delete(`/comments/${c.id}`);
      await loadComments();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const submitReply = async (parentId: number) => {
    const content = replyDraft.trim();
    if (!content || replying) return;
    setReplying(true);
    setError(null);
    try {
      await commentsApi.create(memoryId, content, parentId);
      setReplyDraft('');
      setReplyingTo(null);
      await loadComments();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setReplying(false);
    }
  };

  const renderComment = (c: Comment, depth = 0): ReactNode => (
    <div key={c.id} className={`rounded-xl border border-[#E3E7EC] bg-white p-4 ${depth ? 'ml-6 sm:ml-10' : ''}`}>
      <div className="flex gap-3">
        <Link href={`/profile/${c.user?.username}`}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={c.user?.avatar_url} />
            <AvatarFallback className="bg-[#E3EDF2] text-[#1F5F7B]">{c.user?.username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/profile/${c.user?.username}`} className="font-medium text-[#111A22] hover:underline">{c.user?.full_name}</Link>
            <span className="text-xs text-gray-500">@{c.user?.username}</span>
            <span className="text-xs text-gray-400">· {timeAgo(c.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm"><MentionText text={c.content} /></p>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <button type="button" onClick={() => handleLike(c)} disabled={!isAuthenticated} className="flex items-center gap-1 hover:text-red-500 disabled:opacity-50">
              <Heart className={`h-3.5 w-3.5 ${c.is_liked ? 'fill-red-500 text-red-500' : ''}`} />{c.likes_count}
            </button>
            {isAuthenticated && (
              <button type="button" onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyDraft(''); }} className="hover:text-[#1F5F7B]">
                Répondre
              </button>
            )}
            {user && (user.id === c.user_id || user.id === memoryOwnerId || user.role === 'admin' || user.role === 'moderator') && (
              <button type="button" onClick={() => handleDelete(c)} className="flex items-center gap-1 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />Supprimer
              </button>
            )}
          </div>
          {replyingTo === c.id && (
            <div className="mt-3 flex gap-2">
              <Textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder={`Répondre à @${c.user?.username}…`} maxLength={1000} rows={2} />
              <Button type="button" onClick={() => void submitReply(c.id)} disabled={replying || !replyDraft.trim()} className="self-end bg-[#1F5F7B] text-white hover:bg-[#174B62]">
                {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Répondre'}
              </Button>
            </div>
          )}
          {!!c.replies?.length && <div className="mt-3 space-y-3">{c.replies.map((reply) => renderComment(reply, depth + 1))}</div>}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div id="comments" className="scroll-mt-20 space-y-5">
      <div className="flex items-center gap-2 text-lg font-semibold text-[#111A22]">
        <MessageCircle className="h-5 w-5" />
        <span>Commentaires ({commentCount})</span>
      </div>

      {isAuthenticated ? (
        <div className="space-y-3">
          <Textarea
            placeholder="Partagez votre avis… (@pseudo pour identifier quelqu'un)"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={1000}
            rows={3}
          />
          <Button onClick={handleSubmit} disabled={isSubmitting || !newComment.trim()} className="bg-[#1F5F7B] text-white hover:bg-[#174B62]">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publier'}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E3E7EC] bg-white py-4 text-center text-gray-500">
          <p>Connectez-vous pour laisser un commentaire</p>
          <Button variant="outline" className="mt-2" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-center text-gray-500">Aucun commentaire pour le moment</p>
        ) : (
          comments.map((c) => renderComment(c))
        )}
      </div>
    </div>
  );
}

function countComments(comments: Comment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies ?? []), 0);
}

function updateComment(comments: Comment[], id: number, update: (comment: Comment) => Comment): Comment[] {
  return comments.map((comment) => ({
    ...(comment.id === id ? update(comment) : comment),
    replies: comment.replies ? updateComment(comment.replies, id, update) : comment.replies,
  }));
}
