package services

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"kvtube-go/models"
)

const (
	defaultAIBaseURL      = "https://api9.aiautotool.com/v1"
	defaultAIModel        = "cx/gpt-5.5"
	minNewVideosForAI     = 3
	maxHistoryForAnalysis = 24
	aiFailureCooldown     = 30 * time.Minute
)

var (
	interestAnalysisMu          sync.Mutex
	interestAnalysisLastFailure time.Time
	interestAnalysisLastError   string
)

type InterestTopic struct {
	Query  string  `json:"query"`
	Weight float64 `json:"weight"`
}

type interestProfile struct {
	Topics         []InterestTopic
	Summary        string
	SourceVideoIDs []string
}

type aiInterestResponse struct {
	Summary string          `json:"summary"`
	Topics  []InterestTopic `json:"topics"`
}

func TriggerInterestAnalysisIfNeeded() {
	go func() {
		history, err := GetHistory(maxHistoryForAnalysis)
		if err != nil {
			log.Printf("Interest analysis skipped, history read failed: %v", err)
			return
		}
		if _, err := ensureInterestProfile(history, false); err != nil {
			log.Printf("Interest analysis skipped: %v", err)
		}
	}()
}

func getCachedInterestProfile() (*interestProfile, error) {
	var topicsJSON, sourceIDsJSON string
	var summary sql.NullString
	err := models.DB.QueryRow(
		`SELECT topics_json, summary, source_video_ids FROM user_interest_profiles WHERE user_id = 1`,
	).Scan(&topicsJSON, &summary, &sourceIDsJSON)
	if err != nil {
		return nil, err
	}

	var topics []InterestTopic
	if err := json.Unmarshal([]byte(topicsJSON), &topics); err != nil {
		return nil, err
	}

	var sourceIDs []string
	if sourceIDsJSON != "" {
		_ = json.Unmarshal([]byte(sourceIDsJSON), &sourceIDs)
	}

	return &interestProfile{
		Topics:         cleanInterestTopics(topics),
		Summary:        summary.String,
		SourceVideoIDs: sourceIDs,
	}, nil
}

func ensureInterestProfile(history []HistoryVideo, allowSynchronousCreate bool) (*interestProfile, error) {
	if len(history) == 0 {
		return nil, errors.New("no watch history available")
	}

	cached, err := getCachedInterestProfile()
	if err == nil && len(cached.Topics) > 0 {
		if countNewHistoryVideos(history, cached.SourceVideoIDs) >= minNewVideosForAI {
			go refreshInterestProfile(history)
		}
		return cached, nil
	}

	if !allowSynchronousCreate {
		go refreshInterestProfile(history)
		return nil, errors.New("interest profile not ready")
	}

	return refreshInterestProfile(history)
}

func refreshInterestProfile(history []HistoryVideo) (*interestProfile, error) {
	if len(history) < minNewVideosForAI {
		return nil, errors.New("not enough history for AI analysis")
	}

	interestAnalysisMu.Lock()
	defer interestAnalysisMu.Unlock()

	if err := recentInterestAnalysisFailureLocked(); err != nil {
		return nil, err
	}
	if os.Getenv("AIAUTOTOOL_API_KEY") == "" {
		err := errors.New("AIAUTOTOOL_API_KEY is not configured")
		rememberInterestAnalysisFailureLocked(err)
		return nil, err
	}

	if cached, err := getCachedInterestProfile(); err == nil && len(cached.Topics) > 0 {
		if countNewHistoryVideos(history, cached.SourceVideoIDs) < minNewVideosForAI {
			return cached, nil
		}
	}

	profile, err := analyzeInterestProfileWithAI(history)
	if err != nil {
		rememberInterestAnalysisFailureLocked(err)
		return nil, err
	}
	if len(profile.Topics) == 0 {
		err := errors.New("AI returned no usable topics")
		rememberInterestAnalysisFailureLocked(err)
		return nil, err
	}

	topicsJSON, _ := json.Marshal(profile.Topics)
	sourceIDsJSON, _ := json.Marshal(profile.SourceVideoIDs)
	_, err = models.DB.Exec(
		`INSERT INTO user_interest_profiles (user_id, topics_json, summary, source_video_ids, updated_at)
		 VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(user_id) DO UPDATE SET
		 	topics_json = excluded.topics_json,
		 	summary = excluded.summary,
		 	source_video_ids = excluded.source_video_ids,
		 	updated_at = CURRENT_TIMESTAMP`,
		string(topicsJSON),
		profile.Summary,
		string(sourceIDsJSON),
	)
	if err != nil {
		return nil, err
	}

	log.Printf("Updated AI interest profile: %s", profile.Summary)
	interestAnalysisLastFailure = time.Time{}
	interestAnalysisLastError = ""
	return profile, nil
}

func recentInterestAnalysisFailureLocked() error {
	if interestAnalysisLastFailure.IsZero() {
		return nil
	}
	if time.Since(interestAnalysisLastFailure) >= aiFailureCooldown {
		return nil
	}
	return fmt.Errorf("AI analysis cooldown after recent failure: %s", interestAnalysisLastError)
}

func rememberInterestAnalysisFailureLocked(err error) {
	interestAnalysisLastFailure = time.Now()
	interestAnalysisLastError = compactError(err)
}

func compactError(err error) string {
	message := strings.TrimSpace(err.Error())
	if len(message) > 180 {
		return message[:180]
	}
	return message
}

func analyzeInterestProfileWithAI(history []HistoryVideo) (*interestProfile, error) {
	apiKey := os.Getenv("AIAUTOTOOL_API_KEY")
	baseURL := strings.TrimRight(envOrDefault("AIAUTOTOOL_BASE_URL", defaultAIBaseURL), "/")
	model := envOrDefault("AIAUTOTOOL_MODEL", defaultAIModel)

	sourceHistory := history
	if len(sourceHistory) > maxHistoryForAnalysis {
		sourceHistory = sourceHistory[:maxHistoryForAnalysis]
	}

	type chatMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	body := map[string]interface{}{
		"model": model,
		"messages": []chatMessage{
			{
				Role: "system",
				Content: "You analyze a user's YouTube watch history and infer stable content preferences. Return only compact JSON. Do not include markdown.",
			},
			{
				Role:    "user",
				Content: buildInterestPrompt(sourceHistory),
			},
		},
		"temperature": 0.2,
		"max_tokens":   700,
	}

	requestBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(requestBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 35 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("AI API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &completion); err != nil {
		return nil, err
	}
	if len(completion.Choices) == 0 {
		return nil, errors.New("AI API returned no choices")
	}

	parsed, err := parseAIInterestContent(completion.Choices[0].Message.Content)
	if err != nil {
		return nil, err
	}

	return &interestProfile{
		Topics:         cleanInterestTopics(parsed.Topics),
		Summary:        strings.TrimSpace(parsed.Summary),
		SourceVideoIDs: historyIDs(sourceHistory),
	}, nil
}

func buildInterestPrompt(history []HistoryVideo) string {
	var b strings.Builder
	b.WriteString("Analyze these watched video titles. Infer the user's recurring interests, not one-off exact titles.\n")
	b.WriteString("Return JSON exactly like: {\"summary\":\"...\",\"topics\":[{\"query\":\"...\",\"weight\":1.0}]}\n")
	b.WriteString("Rules: 5 to 8 topics, query must be a concise YouTube search query in the same dominant language as the history when useful, no years unless essential, no duplicate topics.\n\n")
	b.WriteString("Recent watch history, newest first:\n")
	for i, video := range history {
		b.WriteString(fmt.Sprintf("%d. %s\n", i+1, video.Title))
	}
	return b.String()
}

func parseAIInterestContent(content string) (*aiInterestResponse, error) {
	content = strings.TrimSpace(content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end > start {
		content = content[start : end+1]
	}

	var parsed aiInterestResponse
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, err
	}
	return &parsed, nil
}

func cleanInterestTopics(topics []InterestTopic) []InterestTopic {
	seen := make(map[string]bool)
	cleaned := make([]InterestTopic, 0, len(topics))
	for _, topic := range topics {
		query := strings.TrimSpace(topic.Query)
		if query == "" {
			continue
		}
		key := strings.ToLower(query)
		if seen[key] {
			continue
		}
		seen[key] = true
		if topic.Weight <= 0 {
			topic.Weight = 1
		}
		topic.Query = query
		cleaned = append(cleaned, topic)
		if len(cleaned) >= 8 {
			break
		}
	}
	return cleaned
}

func countNewHistoryVideos(history []HistoryVideo, previousIDs []string) int {
	previous := make(map[string]bool, len(previousIDs))
	for _, id := range previousIDs {
		previous[id] = true
	}

	count := 0
	for _, video := range history {
		if video.ID != "" && !previous[video.ID] {
			count++
		}
	}
	return count
}

func historyIDs(history []HistoryVideo) []string {
	ids := make([]string, 0, len(history))
	for _, video := range history {
		if video.ID != "" {
			ids = append(ids, video.ID)
		}
	}
	return ids
}

func interestQueriesFromProfile(profile *interestProfile) []string {
	if profile == nil {
		return nil
	}

	queries := make([]string, 0, len(profile.Topics))
	for _, topic := range profile.Topics {
		if strings.TrimSpace(topic.Query) != "" {
			queries = append(queries, topic.Query)
		}
	}
	return queries
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
