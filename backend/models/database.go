package models

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() {
	dataDir := os.Getenv("KVTUBE_DATA_DIR")
	if dataDir == "" {
		dataDir = "../data" // Default mapping assuming running from backend
	}

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	dbPath := filepath.Join(dataDir, "kvtube.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// Create tables
	userTable := `CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL
	);`

	userVideosTable := `CREATE TABLE IF NOT EXISTS user_videos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER,
		video_id TEXT,
		title TEXT,
		thumbnail TEXT,
		type TEXT,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);`

	videoCacheTable := `CREATE TABLE IF NOT EXISTS video_cache (
		video_id TEXT PRIMARY KEY,
		data TEXT,
		expires_at DATETIME
	);`

	subscriptionsTable := `CREATE TABLE IF NOT EXISTS subscriptions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER,
		channel_id TEXT NOT NULL,
		channel_name TEXT,
		channel_avatar TEXT,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, channel_id),
		FOREIGN KEY(user_id) REFERENCES users(id)
	);`

	interestProfilesTable := `CREATE TABLE IF NOT EXISTS user_interest_profiles (
		user_id INTEGER PRIMARY KEY,
		topics_json TEXT NOT NULL,
		summary TEXT,
		source_video_ids TEXT,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);`

	for _, stmt := range []string{userTable, userVideosTable, videoCacheTable, subscriptionsTable, interestProfilesTable} {
		if _, err := db.Exec(stmt); err != nil {
			log.Fatalf("Failed to create table: %v - Statement: %s", err, stmt)
		}
	}

	// Create performance indexes
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_user_videos_user_timestamp ON user_videos(user_id, timestamp DESC)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_videos_user_video ON user_videos(user_id, video_id)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_video_cache_expires ON video_cache(expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_interest_profiles_updated ON user_interest_profiles(updated_at)`,
	}
	for _, idx := range indexes {
		if _, err := db.Exec(idx); err != nil {
			log.Printf("Warning: Failed to create index: %v - Statement: %s", err, idx)
		}
	}

	// Insert default user for history tracking (password is not used for authentication)
	_, err = db.Exec(`INSERT OR IGNORE INTO users (id, username, password) VALUES (1, 'default_user', '')`)
	if err != nil {
		log.Printf("Failed to insert default user: %v", err)
	}

	DB = db
	log.Println("Database initialized successfully at", dbPath)
}
