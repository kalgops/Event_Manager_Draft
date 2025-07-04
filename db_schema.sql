PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- 1) organisers
CREATE TABLE organisers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE,
  password_hash  TEXT    NOT NULL
);

-- 2) site settings (one row per organiser)
CREATE TABLE site_settings (
  organiser_id  INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  FOREIGN KEY(organiser_id) REFERENCES organisers(id) ON DELETE CASCADE
);

-- 3) events (belongs to organiser)
CREATE TABLE events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  organiser_id  INTEGER NOT NULL,
  title         TEXT    NOT NULL DEFAULT 'Untitled Event',
  description   TEXT    NOT NULL DEFAULT '',
  event_date    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_modified TEXT    NOT NULL DEFAULT (datetime('now')),
  published_at  TEXT,
  state         TEXT    NOT NULL DEFAULT 'draft',
  FOREIGN KEY(organiser_id) REFERENCES organisers(id) ON DELETE CASCADE
);

-- 4) tickets (belongs to event)
CREATE TABLE tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  type       TEXT    NOT NULL,
  price      REAL    NOT NULL DEFAULT 0,
  quantity   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 5) bookings (records each sale)
CREATE TABLE bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  ticket_id  INTEGER NOT NULL,
  buyer_name TEXT    NOT NULL,
  qty        INTEGER NOT NULL,
  booked_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id)  REFERENCES events(id)   ON DELETE CASCADE,
  FOREIGN KEY(ticket_id) REFERENCES tickets(id)  ON DELETE CASCADE
);

-- 6) users (for your add-user feature)
CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name  TEXT    NOT NULL UNIQUE
);

-- Enforce non-blank user_name
CREATE TRIGGER validate_user_name
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN length(trim(NEW.user_name)) = 0
    THEN RAISE(ABORT, 'User name must not be blank')
  END;
END;

-- Keep events.last_modified up to date
CREATE TRIGGER update_event_last_modified
AFTER UPDATE ON events
FOR EACH ROW
BEGIN
  UPDATE events
     SET last_modified = datetime('now')
   WHERE id = NEW.id;
END;

COMMIT;
