-- EventBoard v2 schema
-- Conventions: snake_case, timestamptz everywhere (display timezone is Asia/Riyadh),
-- constraints live in the database so the API cannot write inconsistent rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('attendee', 'organizer');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE interaction_type AS ENUM ('view', 'share', 'search', 'favorite', 'unfavorite', 'book');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  email         text        NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'attendee',
  interests     text[]      NOT NULL DEFAULT '{}',
  is_sample     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id               serial PRIMARY KEY,
  slug             text        NOT NULL UNIQUE,
  title            text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  summary          text        NOT NULL CHECK (char_length(summary) <= 300),
  description      text        NOT NULL,
  category         text        NOT NULL,
  event_type       text        NOT NULL,
  image_url        text,
  venue            text        NOT NULL,
  district         text        NOT NULL,
  lat              double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng              double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  price_sar        numeric(8,2) NOT NULL DEFAULT 0 CHECK (price_sar >= 0),
  requires_booking boolean     NOT NULL DEFAULT false,
  capacity         integer     CHECK (capacity IS NULL OR capacity > 0),
  audience         text        NOT NULL DEFAULT 'الجميع',
  format           text        NOT NULL DEFAULT 'حضوري',
  highlights       text[]      NOT NULL DEFAULT '{}',
  organizer_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  organizer_name   text        NOT NULL,
  featured         boolean     NOT NULL DEFAULT false,
  is_sample        boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_time_order CHECK (ends_at > starts_at),
  CONSTRAINT events_booking_needs_capacity CHECK (NOT requires_booking OR capacity IS NOT NULL)
);
CREATE INDEX events_starts_at_idx ON events (starts_at);
CREATE INDEX events_category_idx ON events (category);
CREATE INDEX events_organizer_idx ON events (organizer_id);

CREATE TABLE bookings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    integer        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seats       integer        NOT NULL CHECK (seats BETWEEN 1 AND 6),
  status      booking_status NOT NULL DEFAULT 'confirmed',
  ticket_code text           NOT NULL UNIQUE,
  created_at  timestamptz    NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);
-- One active booking per user per event; cancelled rows are kept for analytics.
CREATE UNIQUE INDEX bookings_one_active_idx ON bookings (event_id, user_id) WHERE status = 'confirmed';
CREATE INDEX bookings_user_idx ON bookings (user_id);

CREATE TABLE reviews (
  id         serial PRIMARY KEY,
  event_id   integer     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text        NOT NULL DEFAULT '' CHECK (char_length(comment) <= 600),
  verified   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE favorites (
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   integer     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- Behavioural log. session_id is a random client-generated id (no personal data).
-- This table feeds popularity, recommendations, the organizer funnel and demand gaps.
CREATE TABLE interactions (
  id         bigserial PRIMARY KEY,
  user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  session_id text        NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),
  event_id   integer     REFERENCES events(id) ON DELETE CASCADE,
  type       interaction_type NOT NULL,
  meta       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_sample  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interactions_event_type_idx ON interactions (event_id, type, created_at);
CREATE INDEX interactions_user_idx ON interactions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX interactions_type_time_idx ON interactions (type, created_at);

-- Small key/value table. Used to remember when the sample dataset was last re-anchored to "today"
-- so the public demo never shows a calendar full of past events.
CREATE TABLE app_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);
