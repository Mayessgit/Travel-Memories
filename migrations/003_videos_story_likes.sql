CREATE TABLE videos (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url   TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  description VARCHAR(1000) NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers','private')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX videos_feed_idx ON videos (created_at DESC);
CREATE INDEX videos_user_idx ON videos (user_id, created_at DESC);

CREATE TABLE story_likes (
  story_id   INT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

ALTER TABLE messages ADD COLUMN video_id INT REFERENCES videos(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN shared_video BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages DROP CONSTRAINT messages_check;
ALTER TABLE messages ADD CONSTRAINT messages_has_content
  CHECK (body IS NOT NULL OR shared_memory OR shared_video);

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like','comment','follow','follow_request','follow_accepted','message','mention','story_like'));
