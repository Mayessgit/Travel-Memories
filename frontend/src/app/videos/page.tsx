'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Film, Loader2, Send, Trash2, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShareDialog } from '@/components/social/ShareDialog';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api/errors';
import { videosApi, type Video } from '@/lib/api/videos';

export default function VideosPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [videos, setVideos] = useState<Video[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareVideoId, setShareVideoId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    videosApi.list().then((response) => {
      if (!cancelled) {
        setVideos(response.data ?? []);
        setError(null);
      }
    }).catch((e) => {
      if (!cancelled) setError(getErrorMessage(e));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('video', file);
      form.append('description', description);
      form.append('visibility', visibility);
      const result = await videosApi.create(form);
      setVideos((items) => [result.data, ...items]);
      setFile(null);
      setDescription('');
      setVisibility('public');
      const input = document.getElementById('video-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (video: Video) => {
    if (!window.confirm('Supprimer cette vidéo ?')) return;
    try {
      await videosApi.remove(video.id);
      setVideos((items) => items.filter((item) => item.id !== video.id));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-24">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-[#111A22]"><Film className="h-7 w-7" />Vidéos</h1>
        <p className="mt-1 text-[#7A8794]">Découvrez et partagez les vidéos de voyage.</p>
      </header>

      {isAuthenticated && (
        <form onSubmit={publish} className="space-y-3 rounded-2xl border border-[#E3E7EC] bg-white p-5">
          <h2 className="font-semibold text-[#111A22]">Publier une vidéo</h2>
          <Input id="video-file" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          <p className="text-xs text-[#7A8794]">MP4, MOV ou WebM · 100 Mo maximum</p>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} required placeholder="Décrivez votre vidéo…" className="w-full rounded-md border border-[#E3E7EC] p-3 text-sm" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-[#46525E]">
              Visibilité
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="rounded-md border border-[#E3E7EC] bg-white px-2 py-1.5">
                <option value="public">Public</option>
                <option value="followers">Abonnés</option>
                <option value="private">Privé</option>
              </select>
            </label>
            <Button type="submit" disabled={!file || !description.trim() || uploading} className="bg-[#1F5F7B] text-white hover:bg-[#174B62]">
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Publier
            </Button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#1F5F7B]" /></div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#B9C3CC] py-14 text-center text-[#7A8794]">Aucune vidéo pour le moment.</div>
      ) : (
        <div className="space-y-5">
          {videos.map((video) => (
            <article id={`video-${video.id}`} key={video.id} className="overflow-hidden rounded-2xl border border-[#E3E7EC] bg-white">
              <header className="flex items-center gap-3 p-4">
                <Link href={`/profile/${video.user.username}`}>
                  <Avatar className="h-10 w-10"><AvatarImage src={video.user.avatar_url} /><AvatarFallback>{video.user.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${video.user.username}`} className="font-medium text-[#111A22] hover:underline">{video.user.full_name}</Link>
                  <p className="text-xs text-[#7A8794]">@{video.user.username}</p>
                </div>
                {user?.id === video.user_id && (
                  <button type="button" onClick={() => void remove(video)} aria-label="Supprimer la vidéo" className="rounded-full p-2 text-[#7A8794] hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </header>
              <video src={video.video_url} controls playsInline preload="metadata" className="max-h-[70vh] w-full bg-black" />
              <div className="space-y-3 p-4">
                <p className="whitespace-pre-wrap break-words text-sm text-[#111A22]">{video.description}</p>
                <Button type="button" variant="outline" onClick={() => setShareVideoId(video.id)} className="gap-2">
                  <Send className="h-4 w-4" />Partager
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {shareVideoId !== null && <ShareDialog videoId={shareVideoId} open onOpenChange={(open) => { if (!open) setShareVideoId(null); }} />}
    </main>
  );
}
