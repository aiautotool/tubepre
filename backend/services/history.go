package services

import (
	"log"
	"regexp"
	"sort"
	"strings"
	"unicode"

	"kvtube-go/models"
)

// AddToHistory records a video in the history for the user (default id 1)
func AddToHistory(videoID, title, thumbnail string) error {
	// First check if it already exists to just update timestamp, or insert new
	var existingId int
	err := models.DB.QueryRow("SELECT id FROM user_videos WHERE user_id = 1 AND video_id = ?", videoID).Scan(&existingId)

	if err == nil {
		// Exists, update timestamp
		_, err = models.DB.Exec("UPDATE user_videos SET timestamp = CURRENT_TIMESTAMP WHERE id = ?", existingId)
		if err != nil {
			log.Printf("Error updating history timestamp: %v", err)
			return err
		}
		TriggerInterestAnalysisIfNeeded()
		return nil
	}

	// Insert new
	_, err = models.DB.Exec(
		"INSERT INTO user_videos (user_id, video_id, title, thumbnail, type) VALUES (1, ?, ?, ?, 'history')",
		videoID, title, thumbnail,
	)
	if err != nil {
		log.Printf("Error inserting history: %v", err)
		return err
	}

	TriggerInterestAnalysisIfNeeded()
	return nil
}

// HistoryVideo represents a video in the user's history
type HistoryVideo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail"`
}

// GetHistory retrieves the most recently watched videos
func GetHistory(limit int) ([]HistoryVideo, error) {
	rows, err := models.DB.Query(
		"SELECT video_id, title, thumbnail FROM user_videos WHERE user_id = 1 ORDER BY timestamp DESC LIMIT ?", limit,
	)
	if err != nil {
		log.Printf("Error querying history: %v", err)
		return nil, err
	}
	defer rows.Close()

	var videos []HistoryVideo
	for rows.Next() {
		var v HistoryVideo
		if err := rows.Scan(&v.ID, &v.Title, &v.Thumbnail); err != nil {
			continue
		}
		videos = append(videos, v)
	}

	return videos, nil
}

func GetSuggestions(limit int) ([]VideoData, error) {
	if limit <= 0 {
		limit = 20
	}

	history, err := GetHistory(30)
	if err != nil {
		return nil, err
	}
	if len(history) == 0 {
		return SearchVideos("trending videos", limit)
	}

	watchedIDs := make(map[string]bool, len(history))
	for _, video := range history {
		watchedIDs[video.ID] = true
	}

	profile, profileErr := ensureInterestProfile(history, true)
	queries := interestQueriesFromProfile(profile)
	if profileErr != nil {
		log.Printf("Using local suggestion fallback: %v", profileErr)
	}
	if len(queries) == 0 {
		queries = buildSuggestionQueries(history)
	}
	if len(queries) == 0 {
		queries = []string{"recommended videos", "trending videos"}
	}

	results := make([]VideoData, 0, limit)
	seenIDs := make(map[string]bool)
	perQueryLimit := limit/len(queries) + 5
	if perQueryLimit < 8 {
		perQueryLimit = 8
	}
	if perQueryLimit > 14 {
		perQueryLimit = 14
	}

	for _, query := range queries {
		candidates, err := SearchVideos(query, perQueryLimit)
		if err != nil {
			log.Printf("Suggestion search failed for %q: %v", query, err)
			continue
		}

		for _, video := range candidates {
			if video.ID == "" || watchedIDs[video.ID] || seenIDs[video.ID] {
				continue
			}
			seenIDs[video.ID] = true
			results = append(results, video)
			if len(results) >= limit {
				return results, nil
			}
		}
	}

	if len(results) == 0 {
		return SearchVideos("trending videos", limit)
	}

	return results, nil
}

func buildSuggestionQueries(history []HistoryVideo) []string {
	wordScores := make(map[string]int)
	queries := make([]string, 0, 6)
	seenQueries := make(map[string]bool)

	for index, video := range history {
		title := normalizeTitle(video.Title)
		if title == "" {
			continue
		}

		weight := 4
		if index >= 3 {
			weight = 2
		}
		if index >= 10 {
			weight = 1
		}

		for _, word := range strings.Fields(title) {
			if isSuggestionStopWord(word) {
				continue
			}
			wordScores[word] += weight
		}

		if len(queries) < 3 {
			addSuggestionQuery(&queries, seenQueries, title)
		}
	}

	topWords := topSuggestionWords(wordScores, 8)
	for i := 0; i < len(topWords) && len(queries) < 6; i += 2 {
		if i+1 < len(topWords) {
			addSuggestionQuery(&queries, seenQueries, topWords[i]+" "+topWords[i+1])
		} else {
			addSuggestionQuery(&queries, seenQueries, topWords[i])
		}
	}

	if len(topWords) >= 3 {
		addSuggestionQuery(&queries, seenQueries, strings.Join(topWords[:3], " "))
	}

	return queries
}

func addSuggestionQuery(queries *[]string, seen map[string]bool, query string) {
	query = strings.TrimSpace(query)
	if query == "" || seen[query] {
		return
	}
	seen[query] = true
	*queries = append(*queries, query)
}

func normalizeTitle(title string) string {
	title = strings.ToLower(title)
	title = regexp.MustCompile(`https?://\S+`).ReplaceAllString(title, " ")
	title = regexp.MustCompile(`\b(19|20)\d{2}\b`).ReplaceAllString(title, " ")
	title = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSpace(r) {
			return r
		}
		return ' '
	}, title)

	words := strings.Fields(title)
	if len(words) > 10 {
		words = words[:10]
	}
	return strings.Join(words, " ")
}

func topSuggestionWords(scores map[string]int, limit int) []string {
	type scoredWord struct {
		word  string
		score int
	}

	words := make([]scoredWord, 0, len(scores))
	for word, score := range scores {
		if len([]rune(word)) < 3 {
			continue
		}
		words = append(words, scoredWord{word: word, score: score})
	}

	sort.Slice(words, func(i, j int) bool {
		if words[i].score == words[j].score {
			return words[i].word < words[j].word
		}
		return words[i].score > words[j].score
	})

	if len(words) > limit {
		words = words[:limit]
	}

	result := make([]string, 0, len(words))
	for _, item := range words {
		result = append(result, item.word)
	}
	return result
}

func isSuggestionStopWord(word string) bool {
	stopWords := map[string]bool{
		"the": true, "and": true, "for": true, "with": true, "from": true, "this": true,
		"that": true, "you": true, "your": true, "official": true, "video": true,
		"full": true, "new": true, "best": true, "top": true, "live": true,
		"của": true, "cho": true, "với": true, "trong": true, "những": true,
		"một": true, "các": true, "đang": true, "được": true, "không": true,
		"nhất": true, "hay": true, "mới": true, "tập": true, "phần": true,
	}
	return stopWords[word]
}
