-- ─── Platform Admin Settings ───────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Event Organisers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS organisers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  organisation   TEXT,
  is_active      BOOLEAN DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Per-Organiser Site Settings ───────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  organiser_id INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  FOREIGN KEY (organiser_id) REFERENCES organisers(id)
);

-- ─── Events Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  organiser_id  INTEGER NOT NULL,
  title         TEXT NOT NULL DEFAULT 'Untitled Event',
  description   TEXT,
  event_date    TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
  published_at  TEXT,
  state         TEXT NOT NULL DEFAULT 'draft', -- draft or published
  FOREIGN KEY (organiser_id) REFERENCES organisers(id)
);

-- ─── Tickets Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  type       TEXT NOT NULL,
  price      REAL NOT NULL,
  quantity   INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- ─── Users (Attendees) Table ───────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─── Bookings Table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id       INTEGER NOT NULL,
  ticket_id      INTEGER NOT NULL,
  user_id        INTEGER, -- Links to users table
  qty            INTEGER NOT NULL DEFAULT 1,
  buyer_name     TEXT NOT NULL,
  buyer_email    TEXT,
  total_amount   REAL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'completed',
  booked_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─── Trigger: Auto-update last_modified on event update ───
CREATE TRIGGER IF NOT EXISTS update_event_last_modified
AFTER UPDATE ON events
FOR EACH ROW
BEGIN
  UPDATE events SET last_modified = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ─── Trigger: Auto-create default tickets on new event ────
CREATE TRIGGER IF NOT EXISTS create_default_tickets
AFTER INSERT ON events
FOR EACH ROW
BEGIN
  INSERT INTO tickets (event_id, type, price, quantity)
  VALUES (NEW.id, 'full-price', 0, 0),
         (NEW.id, 'concession', 0, 0);
END;

-- ─── Trigger: Auto-calculate booking total amount ─────────
CREATE TRIGGER IF NOT EXISTS update_booking_total_amount
AFTER INSERT ON bookings
FOR EACH ROW
BEGIN
  UPDATE bookings SET total_amount = (
    SELECT price * qty FROM tickets WHERE id = NEW.ticket_id
  ) WHERE id = NEW.id;
END;
