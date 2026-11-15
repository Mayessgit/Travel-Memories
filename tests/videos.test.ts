import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, auth, follow, register, setupDb, teardownDb, type TestUser } from './helpers';

let author: TestUser;
let recipient: TestUser;

const mp4 = Buffer.alloc(16);
mp4.write('ftyp', 4, 'ascii');
mp4.write('isom', 8, 'ascii');

const publish = (user: TestUser, visibility = 'public', file = mp4, contentType = 'video/mp4') =>
  api().post('/api/videos').set(auth(user.token))
    .field('description', 'Vue aérienne de la côte')
    .field('visibility', visibility)
    .attach('video', file, { filename: 'coast.mp4', contentType });

beforeAll(async () => {
  await setupDb();
  author = await register('video_author');
  recipient = await register('video_viewer');
});
afterAll(teardownDb);

describe('Vidéos et partage privé', () => {
  it('valide le fichier vidéo et publie avec son auteur et sa description', async () => {
    expect((await publish(author, 'public', Buffer.from('fake video'))).status).toBe(415);
    const result = await publish(author);
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({
      user_id: author.id,
      description: 'Vue aérienne de la côte',
      user: { username: 'video_author' },
    });
    const feed = await api().get('/api/videos');
    expect(feed.body.data.map((video: any) => video.id)).toContain(result.body.data.id);
  });

  it('partage la vidéo dans une conversation avec son lien et son auteur original', async () => {
    const video = (await publish(author)).body.data;
    const share = await api().post(`/api/videos/${video.id}/share`).set(auth(author.token)).send({ user_ids: [recipient.id], body: 'Regarde ça !' });
    expect(share.body.data).toMatchObject({ sent: [recipient.id], failed: [] });

    const conversations = await api().get('/api/conversations').set(auth(recipient.token));
    const conversation = conversations.body.data[0];
    const messages = await api().get(`/api/conversations/${conversation.id}/messages`).set(auth(recipient.token));
    expect(messages.body.data[0]).toMatchObject({
      body: 'Regarde ça !',
      video: {
        id: video.id,
        video_url: video.video_url,
        description: 'Vue aérienne de la côte',
        user: { id: author.id, username: 'video_author' },
      },
    });
  });

  it('applique la visibilité abonnés aux destinataires et bloque les suppressions d’autrui', async () => {
    const video = (await publish(author, 'followers')).body.data;
    expect((await api().get('/api/videos')).body.data.map((v: any) => v.id)).not.toContain(video.id);
    const denied = await api().post(`/api/videos/${video.id}/share`).set(auth(author.token)).send({ user_ids: [recipient.id] });
    expect(denied.body.data.sent).toEqual([]);
    expect(denied.body.data.failed).toHaveLength(1);
    expect((await api().delete(`/api/videos/${video.id}`).set(auth(recipient.token))).status).toBe(403);

    await follow(recipient, author);
    const allowed = await api().post(`/api/videos/${video.id}/share`).set(auth(author.token)).send({ user_ids: [recipient.id] });
    expect(allowed.body.data.sent).toEqual([recipient.id]);

    await api().delete(`/api/users/${recipient.id}/follower`).set(auth(author.token));
    const publicVideo = (await publish(author)).body.data;
    await api().put('/api/users/me').set(auth(author.token)).send({ is_private: true });
    expect((await api().get('/api/videos')).body.data.map((v: any) => v.id)).not.toContain(publicVideo.id);
    expect((await api().get('/api/videos').set(auth(recipient.token))).body.data.map((v: any) => v.id)).not.toContain(publicVideo.id);
    expect((await follow(recipient, author)).body.data.status).toBe('requested');
    await api().post(`/api/follow-requests/${recipient.id}/accept`).set(auth(author.token));
    expect((await api().get('/api/videos').set(auth(recipient.token))).body.data.map((v: any) => v.id)).toContain(publicVideo.id);
    await api().put('/api/users/me').set(auth(author.token)).send({ is_private: false });
  });
});
