package services

import (
	"log"

	"kvtube-go/models"
)

type Subscription struct {
	ID            int    `json:"id"`
	ChannelID     string `json:"channel_id"`
	ChannelName   string `json:"channel_name"`
	ChannelAvatar string `json:"channel_avatar"`
}

func SubscribeChannel(channelID, channelName, channelAvatar string) error {
	_, err := models.DB.Exec(
		`INSERT OR IGNORE INTO subscriptions (user_id, channel_id, channel_name, channel_avatar) VALUES (1, ?, ?, ?)`,
		channelID, channelName, channelAvatar,
	)
	if err != nil {
		log.Printf("Error subscribing to channel: %v", err)
		return err
	}
	return nil
}

func UnsubscribeChannel(channelID string) error {
	_, err := models.DB.Exec(
		`DELETE FROM subscriptions WHERE user_id = 1 AND channel_id = ?`,
		channelID,
	)
	if err != nil {
		log.Printf("Error unsubscribing from channel: %v", err)
		return err
	}
	return nil
}

func IsSubscribed(channelID string) (bool, error) {
	var count int
	err := models.DB.QueryRow(
		`SELECT COUNT(*) FROM subscriptions WHERE user_id = 1 AND channel_id = ?`,
		channelID,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func GetSubscriptions() ([]Subscription, error) {
	rows, err := models.DB.Query(
		`SELECT id, channel_id, channel_name, channel_avatar FROM subscriptions WHERE user_id = 1 ORDER BY timestamp DESC`,
	)
	if err != nil {
		log.Printf("Error querying subscriptions: %v", err)
		return nil, err
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var s Subscription
		if err := rows.Scan(&s.ID, &s.ChannelID, &s.ChannelName, &s.ChannelAvatar); err != nil {
			continue
		}
		subs = append(subs, s)
	}

	return subs, nil
}
