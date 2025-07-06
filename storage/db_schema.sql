-- Updated db_schema.sql to ensure proper ticket type handling
PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- site settings (single row)
CREATE TABLE site_settings (
  id          INTEGER PRIMARY KEY CHECK(id=1),
  name        TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT OR IGNORE INTO site_settings(id, name, description)
VALUES (1, 'Event Manager Pro', 'Professional event management for all your needs.');

-- events
CREATE TABLE events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL DEFAULT 'Untitled Event',
  description   TEXT NOT NULL DEFAULT '',
  event_date    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_modified TEXT NOT NULL DEFAULT (datetime('now')),
  published_at  TEXT,
  state         TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft', 'published'))
);

-- ticket types - ensure we have standard types
CREATE TABLE tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('full-price', 'concession', 'student', 'early-bird', 'vip')),
  price      REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
  quantity   INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(event_id, type)
);

-- bookings table
CREATE TABLE bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL,
  ticket_id   INTEGER NOT NULL,
  buyer_name  TEXT NOT NULL,
  qty         INTEGER NOT NULL CHECK(qty > 0),
  booked_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

COMMIT;

-- Trigger to update last_modified on events
CREATE TRIGGER update_event_last_modified
AFTER UPDATE ON events
FOR EACH ROW
BEGIN
  UPDATE events SET last_modified = datetime('now') WHERE id = NEW.id;
END;

-- Insert default ticket types for new events
CREATE TRIGGER create_default_tickets
AFTER INSERT ON events
FOR EACH ROW
BEGIN
  INSERT INTO tickets(event_id, type, price, quantity) 
  VALUES 
    (NEW.id, 'full-price', 25.00, 100),
    (NEW.id, 'concession', 15.00, 50);
END;