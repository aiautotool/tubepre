package models

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"
)

type CacheEntry struct {
	VideoID   string
	Data      []byte
	ExpiresAt time.Time
}

// GetCachedVideo retrieves cached video data by video ID
func GetCachedVideo(videoID string) ([]byte, error) {
	if DB == nil {
		return nil, nil
	}

	var data []byte
	var expiresAt time.Time
	err := DB.QueryRow(
		`SELECT data, expires_at FROM video_cache WHERE video_id = ? AND expires_at > ?`,
		videoID, time.Now(),
	).Scan(&data, &expiresAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		log.Printf("Cache query error: %v", err)
		return nil, err
	}

	return data, nil
}

// SetCachedVideo stores video data in cache with TTL
func SetCachedVideo(videoID string, data interface{}, ttlSeconds int) error {
	if DB == nil {
		return nil
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	expiresAt := time.Now().Add(time.Duration(ttlSeconds) * time.Second)

	_, err = DB.Exec(
		`INSERT OR REPLACE INTO video_cache (video_id, data, expires_at) VALUES (?, ?, ?)`,
		videoID, string(jsonData), expiresAt,
	)

	if err != nil {
		log.Printf("Cache store error: %v", err)
	}

	return err
}

// CleanExpiredCache removes expired cache entries
func CleanExpiredCache() {
	if DB == nil {
		return
	}

	result, err := DB.Exec(`DELETE FROM video_cache WHERE expires_at < ?`, time.Now())
	if err != nil {
		log.Printf("Cache cleanup error: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		log.Printf("Cleaned %d expired cache entries", rows)
	}
}

// StartCacheCleanupScheduler runs periodic cache cleanup
func StartCacheCleanupScheduler() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		for range ticker.C {
			CleanExpiredCache()
		}
	}()
}
