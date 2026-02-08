
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team TEXT NOT NULL,
  contact TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  location TEXT,
  latitude REAL,
  longitude REAL,
  image_url TEXT,
  follow_up_date DATE,
  is_completed BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activities_team ON activities(team);
CREATE INDEX idx_activities_follow_up_date ON activities(follow_up_date);
CREATE INDEX idx_activities_is_completed ON activities(is_completed);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
