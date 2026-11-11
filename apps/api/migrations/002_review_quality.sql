-- Additive migration; existing user-owned rows and images are preserved.
ALTER TABLE events ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN publication_status text NOT NULL DEFAULT 'published'
  CHECK (publication_status IN ('draft', 'published'));
ALTER TABLE bookings ADD COLUMN unit_price_sar numeric(8,2) CHECK (unit_price_sar >= 0);
-- Only synthetic bookings have known, reproducible seed prices. Real historical prices remain unknown.
UPDATE bookings b SET unit_price_sar = e.price_sar FROM events e WHERE e.id = b.event_id AND e.is_sample;
UPDATE events SET details = jsonb_build_object('locationAccuracy', 'illustrative', 'imageIllustrative', true) WHERE is_sample;
CREATE INDEX interactions_view_session_idx ON interactions (event_id, session_id, created_at) WHERE type = 'view';
