'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, Loader2, Search, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { socialApi } from '@/lib/api/social';
import { getErrorMessage } from '@/lib/api/errors';
import { useAuthStore } from '@/store/authStore';
import type { PublicUser, SearchUser } from '@/types/social';

type Tab = 'search' | 'friends' | 'received' | 'sent';
type SentRequest = PublicUser & { requested_at: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Découvrir' },
  { id: 'friends', label: 'Mes amis' },
  { id: 'received', label: 'Demandes reçues' },
  { id: 'sent', label: 'Demandes envoyées' },
];

export default function FriendsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('search');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [received, setReceived] = useState<PublicUser[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadDiscover = useCallback(async (query: string, nextPage: number) => {
    if (query.length === 1) {
      ++requestId.current;
      setResults([]);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      return;
    }
    const id = ++requestId.current;
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const response = query
        ? await socialApi.searchUsers(query, nextPage)
        : await socialApi.suggestions(nextPage);
      if (id !== requestId.current) return;
      setResults((previous) => {
        if (nextPage === 1) return response.data;
        const existing = new Set(previous.map((u) => u.id));
        return [...previous, ...response.data.filter((u) => !existing.has(u.id))];
      });
      setPage(nextPage);
      setHasMore(response.pagination.hasMore);
    } catch (e) {
      if (id === requestId.current) setError(getErrorMessage(e));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (tab !== 'search') return;
    const timer = setTimeout(() => void loadDiscover(term, 1), 0);
    return () => clearTimeout(timer);
  }, [loadDiscover, tab, term]);

  useEffect(() => {
    if (tab === 'search' || !user) return;
    let active = true;
    ++requestId.current;
    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      try {
        if (tab === 'friends') {
          const response = await socialApi.friends();
          if (active) setFriends(response.data);
        } else if (tab === 'received') {
          const response = await socialApi.requests();
          if (active) setReceived(response.data);
        } else {
          const response = await socialApi.sentRequests();
          if (active) setSent(response.data);
        }
      } catch (e) {
        if (active) setError(getErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [tab, user]);

  const loadMore = () => {
    if (!loadingMore && hasMore) void loadDiscover(term, page + 1);
  };

  const act = async (target: SearchUser | PublicUser, action: 'follow' | 'unfollow' | 'accept' | 'decline' | 'cancel' | 'remove') => {
    setBusyId(target.id);
    setError(null);
    try {
      if (action === 'follow') {
        const response = await socialApi.follow(target.id);
        setResults((items) => items.map((u) => u.id === target.id
          ? { ...u, follow_status: response.data.status, is_friend: response.data.status === 'following' && u.follows_you }
          : u));
      } else if (action === 'unfollow' || action === 'cancel') {
        if (action === 'unfollow' && !window.confirm(`Ne plus suivre @${target.username} ?`)) return;
        await socialApi.unfollow(target.id);
        setResults((items) => items.map((u) => u.id === target.id ? { ...u, follow_status: 'none', is_friend: false } : u));
        setSent((items) => items.filter((u) => u.id !== target.id));
      } else if (action === 'accept' || action === 'decline') {
        if (action === 'accept') await socialApi.acceptRequest(target.id);
        else await socialApi.declineRequest(target.id);
        setReceived((items) => items.filter((u) => u.id !== target.id));
        setResults((items) => items.map((u) => u.id === target.id
          ? {
              ...u,
              incoming_request: false,
              follows_you: action === 'accept',
              is_friend: action === 'accept' && u.follow_status === 'following',
            }
          : u));
      } else {
        if (!window.confirm(`Retirer @${target.username} de vos amis ?`)) return;
        await socialApi.removeFriend(target.id);
        setFriends((items) => items.filter((u) => u.id !== target.id));
        setResults((items) => items.map((u) => u.id === target.id
          ? { ...u, is_friend: false, follows_you: false, follow_status: 'none' }
          : u));
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <Users className="mx-auto mb-4 h-10 w-10 text-[#1F5F7B]" />
        <h1 className="text-2xl font-semibold text-[#111A22]">Rechercher des amis</h1>
        <p className="mt-2 text-[#46525E]">Connectez-vous pour découvrir des voyageurs et gérer vos relations.</p>
        <Button asChild className="mt-5 bg-[#1F5F7B] text-white hover:bg-[#174B62]"><Link href="/login">Se connecter</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-7">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#1F5F7B]">Communauté</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#111A22] sm:text-4xl">Amis et voyageurs</h1>
        <p className="mt-2 text-[#46525E]">Trouvez des voyageurs, gérez vos demandes et retrouvez vos amis.</p>
      </header>

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-[#E3E7EC]" role="tablist" aria-label="Relations">
        {TABS.map((item) => (
          <button
            key={item.id}
            id={`friends-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => {
              setTab(item.id);
              setError(null);
            }}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${
              tab === item.id ? 'border-[#1F5F7B] font-semibold text-[#1F5F7B]' : 'border-transparent text-[#7A8794] hover:text-[#111A22]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <section role="tabpanel" aria-labelledby="friends-tab-search">
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7A8794]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher des amis..."
              aria-label="Rechercher des amis"
              className="h-12 rounded-xl border-[#D9E0E5] bg-white pl-12 pr-12 shadow-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#7A8794] hover:bg-[#F4F5F7]"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <h2 className="mb-3 text-lg font-semibold text-[#111A22]">
            {term ? 'Résultats de recherche' : 'Suggestions d’amis'}
          </h2>
          {term.length === 1 && <p className="mb-4 text-sm text-[#7A8794]">Saisissez au moins deux caractères.</p>}
          <UserList
            users={results}
            loading={loading}
            error={error}
            emptyText={term ? 'Aucun utilisateur trouvé.' : 'Aucune suggestion pour le moment.'}
            busyId={busyId}
            onAction={act}
          />
          {hasMore && (
            <div className="flex justify-center py-5">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Afficher plus
              </Button>
            </div>
          )}
        </section>
      )}

      {tab === 'friends' && (
        <section role="tabpanel" aria-labelledby="friends-tab-friends">
          <h2 className="mb-3 text-lg font-semibold text-[#111A22]">Mes amis</h2>
          <UserList
            users={friends}
            loading={loading}
            error={error}
            emptyText="Vous n’avez pas encore d’amis. Découvrez des voyageurs pour commencer."
            busyId={busyId}
            onAction={act}
            friendList
          />
        </section>
      )}

      {tab === 'received' && (
        <section role="tabpanel" aria-labelledby="friends-tab-received">
          <h2 className="mb-3 text-lg font-semibold text-[#111A22]">Demandes reçues</h2>
          <UserList
            users={received}
            loading={loading}
            error={error}
            emptyText="Aucune demande en attente."
            busyId={busyId}
            onAction={act}
            requestList="received"
          />
        </section>
      )}

      {tab === 'sent' && (
        <section role="tabpanel" aria-labelledby="friends-tab-sent">
          <h2 className="mb-3 text-lg font-semibold text-[#111A22]">Demandes envoyées</h2>
          <UserList
            users={sent}
            loading={loading}
            error={error}
            emptyText="Aucune demande envoyée en attente."
            busyId={busyId}
            onAction={act}
            requestList="sent"
          />
        </section>
      )}
    </div>
  );
}

function UserList({
  users,
  loading,
  error,
  emptyText,
  busyId,
  onAction,
  friendList = false,
  requestList,
}: {
  users: (SearchUser | PublicUser | SentRequest)[];
  loading: boolean;
  error: string | null;
  emptyText: string;
  busyId: number | null;
  onAction: (user: SearchUser | PublicUser, action: 'follow' | 'unfollow' | 'accept' | 'decline' | 'cancel' | 'remove') => void;
  friendList?: boolean;
  requestList?: 'received' | 'sent';
}) {
  if (loading) {
    return <div className="flex justify-center rounded-xl border border-[#E3E7EC] bg-white py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1F5F7B]" /></div>;
  }
  if (error) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }
  if (!users.length) return <p className="rounded-xl border border-dashed border-[#D9E0E5] px-4 py-10 text-center text-sm text-[#7A8794]">{emptyText}</p>;

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const result = user as SearchUser;
        const isBusy = busyId === user.id;
        return (
          <article key={user.id} className="flex flex-col gap-3 rounded-xl border border-[#E3E7EC] bg-white p-4 shadow-sm transition hover:border-[#C4D5DE] sm:flex-row sm:items-center">
            <Link href={`/profile/${user.username}`} className="flex min-w-0 flex-1 items-start gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={user.avatar_url} alt="" />
                <AvatarFallback className="bg-[#E3EDF2] font-medium text-[#1F5F7B]">{(user.full_name || user.username).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate font-semibold text-[#111A22]">{user.full_name}</p>
                  {user.is_private && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F5F7] px-2 py-0.5 text-xs text-[#46525E]">
                      <ShieldCheck className="h-3 w-3" /> Privé
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-[#7A8794]">@{user.username}</p>
                {user.bio && <p className="mt-1 line-clamp-2 text-sm text-[#46525E]">{user.bio}</p>}
                {!!result.mutual_friends_count && <p className="mt-1 text-xs text-[#7A8794]">{result.mutual_friends_count} ami{result.mutual_friends_count > 1 ? 's' : ''} en commun</p>}
              </div>
            </Link>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              {friendList ? (
                <>
                  <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#E3EDF2] px-3 text-sm font-medium text-[#1F5F7B]">
                    <Check className="h-4 w-4" /> Amis
                  </span>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(user, 'remove')}>
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
                  </Button>
                </>
              ) : requestList === 'received' ? (
                <>
                  <Button size="sm" disabled={isBusy} className="bg-[#1F5F7B] text-white hover:bg-[#174B62]" onClick={() => onAction(user, 'accept')}>
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accepter'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(user, 'decline')}>Refuser</Button>
                </>
              ) : requestList === 'sent' ? (
                <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(user, 'cancel')}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Annuler'}
                </Button>
              ) : result.incoming_request ? (
                <>
                  <Button size="sm" disabled={isBusy} className="bg-[#1F5F7B] text-white hover:bg-[#174B62]" onClick={() => onAction(user, 'accept')}>
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accepter'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(user, 'decline')}>Refuser</Button>
                </>
              ) : result.is_friend ? (
                <>
                  <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#E3EDF2] px-3 text-sm font-medium text-[#1F5F7B]">
                    <Check className="h-4 w-4" /> Amis
                  </span>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(user, 'remove')}>
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
                  </Button>
                </>
              ) : result.follow_status === 'requested' ? (
                <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(user, 'cancel')}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Clock className="mr-1 h-4 w-4" /> Annuler la demande</>}
                </Button>
              ) : result.follow_status === 'following' ? (
                <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(user, 'unfollow')}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Abonné</>}
                </Button>
              ) : (
                <Button size="sm" disabled={isBusy} className="bg-[#1F5F7B] text-white hover:bg-[#174B62]" onClick={() => onAction(user, 'follow')}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="mr-1 h-4 w-4" /> Ajouter</>}
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
