PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- 1) organisers
CREATE TABLE organisers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL
);

-- add a default organiser (user: admin  pass: admin)
INSERT INTO organisers(username, password_hash)
VALUES ('admin', '$2b$10$2b1yZ5SB3N/rm7ZvCnj4ROVk78RrGOKu96a9FQzu9J6cCgrYwKs7u'); -- bcrypt hash of 'admin'

-- 2) site settings (NOW per organiser)
CREATE TABLE site_settings (
  organiser_id INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  FOREIGN KEY(organiser_id) REFERENCES organisers(id) ON DELETE CASCADE
);
INSERT INTO site_settings(organiser_id,name,description)
SELECT id,'Auction Gala Planner','Plan and run your charity auctions.' FROM organisers WHERE username='admin';

-- 3) events (add organiser_id)
CREATE TABLE events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  organiser_id  INTEGER NOT NULL,
  title         TEXT NOT NULL DEFAULT 'Untitled Event',
  description   TEXT NOT NULL DEFAULT '',
  event_date    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_modified TEXT NOT NULL DEFAULT (datetime('now')),
  published_at  TEXT,
  state         TEXT NOT NULL DEFAULT 'draft',
  FOREIGN KEY(organiser_id) REFERENCES organisers(id) ON DELETE CASCADE
);

-- 4) tickets, 5) bookings, 6) users  (unchanged except FK to events)
CREATE TABLE tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  type       TEXT NOT NULL,
  price      REAL NOT NULL DEFAULT 0,
  quantity   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL,
  ticket_id   INTEGER NOT NULL,
  buyer_name  TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  booked_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id)  REFERENCES events(id)  ON DELETE CASCADE,
  FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name TEXT NOT NULL UNIQUE
);
CREATE TRIGGER validate_user_name
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  SELECT CASE WHEN length(trim(NEW.user_name)) = 0
             THEN RAISE(ABORT,'User name must not be blank') END;
END;

CREATE TRIGGER update_event_last_modified
AFTER UPDATE ON events
FOR EACH ROW
BEGIN
  UPDATE events SET last_modified = datetime('now') WHERE id = NEW.id;
END;

COMMIT;
