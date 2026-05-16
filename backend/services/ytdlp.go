package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sort"
	"strings"

	"kvtube-go/models"
)

var ytDlpBinPath string

func init() {
	ytDlpBinPath = resolveYtDlpBinPath()
}

func resolveYtDlpBinPath() string {
	// Check if yt-dlp is in PATH
	if _, err := exec.LookPath("yt-dlp"); err == nil {
		return "yt-dlp"
	}

	fallbacks := []string{
		os.ExpandEnv("$HOME/Library/Python/3.14/bin/yt-dlp"),
		os.ExpandEnv("$HOME/Library/Python/3.13/bin/yt-dlp"),
		os.ExpandEnv("$HOME/Library/Python/3.12/bin/yt-dlp"),
		os.ExpandEnv("$HOME/Library/Python/3.11/bin/yt-dlp"),
		os.ExpandEnv("$HOME/.local/bin/yt-dlp"),
		"/usr/local/bin/yt-dlp",
		"/opt/homebrew/bin/yt-dlp",
	}

	for _, fb := range fallbacks {
		if _, err := os.Stat(fb); err == nil {
			return fb
		}
	}

	// Default fallback
	return "yt-dlp"
}

type VideoData struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Uploader    string `json:"uploader"`
	ChannelID   string `json:"channel_id"`
	UploaderID  string `json:"uploader_id"`
	Thumbnail   string `json:"thumbnail"`
	ViewCount   int64  `json:"view_count"`
	UploadDate  string `json:"upload_date"`
	Duration    string `json:"duration"`
	Description string `json:"description"`
	StreamURL   string `json:"stream_url,omitempty"`
}

type VideoFormat struct {
	FormatID   string `json:"format_id"`
	FormatNote string `json:"format_note"`
	Ext        string `json:"ext"`
	Resolution string `json:"resolution"`
	Filesize   int64  `json:"filesize"`
	VCodec     string `json:"vcodec"`
	ACodec     string `json:"acodec"`
	Type       string `json:"type"` // "video", "audio", or "both"
}

type YtDlpEntry struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	Uploader    string      `json:"uploader"`
	Channel     string      `json:"channel"`
	ChannelID   string      `json:"channel_id"`
	UploaderID  string      `json:"uploader_id"`
	ViewCount   int64       `json:"view_count"`
	UploadDate  string      `json:"upload_date"`
	Duration    interface{} `json:"duration"` // Can be float64 or int
	Description string      `json:"description"`
	URL         string      `json:"url"`
}

func sanitizeVideoData(entry YtDlpEntry) VideoData {
	uploader := entry.Uploader
	if uploader == "" {
		uploader = entry.Channel
	}
	if uploader == "" {
		uploader = "Unknown"
	}

	var durationStr string
	if d, ok := entry.Duration.(float64); ok && d > 0 {
		hours := int(d) / 3600
		mins := (int(d) % 3600) / 60
		secs := int(d) % 60
		if hours > 0 {
			durationStr = fmt.Sprintf("%d:%02d:%02d", hours, mins, secs)
		} else {
			durationStr = fmt.Sprintf("%d:%02d", mins, secs)
		}
	}

	thumbnail := ""
	if entry.ID != "" {
		// Use hqdefault.jpg which is more reliably available than maxresdefault.jpg
		thumbnail = fmt.Sprintf("https://i.ytimg.com/vi/%s/hqdefault.jpg", entry.ID)
	}

	return VideoData{
		ID:          entry.ID,
		Title:       entry.Title,
		Uploader:    uploader,
		ChannelID:   entry.ChannelID,
		UploaderID:  entry.UploaderID,
		Thumbnail:   thumbnail,
		ViewCount:   entry.ViewCount,
		UploadDate:  entry.UploadDate,
		Duration:    durationStr,
		Description: entry.Description,
	}
}

// extractVideoID tries to extract a YouTube video ID from yt-dlp arguments
func extractVideoID(args []string) string {
	for _, arg := range args {
		// Look for 11-character video IDs (YouTube standard)
		if len(arg) == 11 {
			// Simple check: alphanumeric with underscore and dash
			isValid := true
			for _, c := range arg {
				if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-') {
					isValid = false
					break
				}
			}
			if isValid {
				return arg
			}
		}

		// Extract from YouTube URL patterns
		if strings.Contains(arg, "youtube.com") || strings.Contains(arg, "youtu.be") {
			// Simple regex for video ID in URL
			if idx := strings.Index(arg, "v="); idx != -1 {
				id := arg[idx+2:]
				if len(id) >= 11 {
					return id[:11]
				}
			}
			// youtu.be/ID
			if idx := strings.LastIndex(arg, "/"); idx != -1 {
				id := arg[idx+1:]
				if len(id) >= 11 {
					return id[:11]
				}
			}
		}
	}
	return ""
}

// RunYtDlpCached executes yt-dlp with caching
func RunYtDlpCached(cacheKey string, ttlSeconds int, args ...string) ([]byte, error) {
	// Try to get from cache first
	if cachedData, err := models.GetCachedVideo(cacheKey); err == nil && cachedData != nil {
		return cachedData, nil
	}

	// Execute yt-dlp
	data, err := RunYtDlp(args...)
	if err != nil {
		return nil, err
	}

	// Store in cache (ignore cache errors)
	if cacheKey != "" {
		_ = models.SetCachedVideo(cacheKey, string(data), ttlSeconds)
	}

	return data, nil
}

// RunYtDlp securely executes yt-dlp with the given arguments and returns JSON output
func RunYtDlp(args ...string) ([]byte, error) {
	cmdArgs := append([]string{
		"--dump-json",
		"--no-warnings",
		"--quiet",
		"--force-ipv4",
		"--ignore-errors",
		"--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	}, args...)

	cmd := exec.Command(ytDlpBinPath, cmdArgs...)

	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		log.Printf("yt-dlp error: %v, stderr: %s", err, stderr.String())
		return nil, err
	}

	return out.Bytes(), nil
}

func SearchVideos(query string, limit int) ([]VideoData, error) {
	searchQuery := fmt.Sprintf("ytsearch%d:%s", limit, query)

	args := []string{
		"--flat-playlist",
		searchQuery,
	}

	out, err := RunYtDlp(args...)
	if err != nil {
		return nil, err
	}

	var results []VideoData
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		var entry YtDlpEntry
		if err := json.Unmarshal([]byte(line), &entry); err == nil {
			if entry.ID != "" {
				results = append(results, sanitizeVideoData(entry))
			}
		}
	}

	return results, nil
}

func GetVideoInfo(videoID string) (*VideoData, error) {
	url := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	args := []string{
		"--format", "bestvideo+bestaudio/best",
		"--skip-download",
		"--no-playlist",
		url,
	}

	// Skip cache for now to avoid corrupted data issues
	out, err := RunYtDlp(args...)
	if err != nil {
		log.Printf("yt-dlp failed for %s: %v", videoID, err)
		return nil, err
	}

	// Log first 500 chars for debugging
	if len(out) > 0 {
		log.Printf("yt-dlp response for %s (first 200 chars): %s", videoID, string(out[:min(200, len(out))]))
	}

	var entry YtDlpEntry
	if err := json.Unmarshal(out, &entry); err != nil {
		log.Printf("JSON unmarshal error for %s: %v", videoID, err)
		log.Printf("Raw response: %s", string(out[:min(500, len(out))]))
		return nil, fmt.Errorf("failed to parse video info: %w", err)
	}

	data := sanitizeVideoData(entry)
	data.StreamURL = entry.URL

	return &data, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

type QualityFormat struct {
	FormatID   string `json:"format_id"`
	Label      string `json:"label"`
	Resolution string `json:"resolution"`
	Height     int    `json:"height"`
	URL        string `json:"url"`
	AudioURL   string `json:"audio_url,omitempty"`
	IsHLS      bool   `json:"is_hls"`
	VCodec     string `json:"vcodec"`
	ACodec     string `json:"acodec"`
	Filesize   int64  `json:"filesize"`
	HasAudio   bool   `json:"has_audio"`
}

func GetVideoQualities(videoID string) ([]QualityFormat, error) {
	url := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	cmdArgs := []string{
		"--dump-json",
		"--no-warnings",
		"--quiet",
		"--force-ipv4",
		"--no-playlist",
		"--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		url,
	}

	cacheKey := "video_qualities:" + videoID
	out, err := RunYtDlpCached(cacheKey, 3600, cmdArgs...) // Cache for 1 hour
	if err != nil {
		return nil, err
	}

	var raw struct {
		Formats []struct {
			FormatID    string      `json:"format_id"`
			FormatNote  string      `json:"format_note"`
			Ext         string      `json:"ext"`
			Resolution  string      `json:"resolution"`
			Width       interface{} `json:"width"`
			Height      interface{} `json:"height"`
			URL         string      `json:"url"`
			ManifestURL string      `json:"manifest_url"`
			VCodec      string      `json:"vcodec"`
			ACodec      string      `json:"acodec"`
			Filesize    interface{} `json:"filesize"`
		} `json:"formats"`
	}

	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var qualities []QualityFormat
	seen := make(map[int]int) // height -> index in qualities

	for _, f := range raw.Formats {
		if f.VCodec == "none" || f.URL == "" {
			continue
		}

		var height int
		switch v := f.Height.(type) {
		case float64:
			height = int(v)
		case int:
			height = v
		}

		if height == 0 {
			continue
		}

		hasAudio := f.ACodec != "none" && f.ACodec != ""

		var filesize int64
		switch v := f.Filesize.(type) {
		case float64:
			filesize = int64(v)
		case int64:
			filesize = v
		}

		isHLS := f.ManifestURL != "" || strings.Contains(f.URL, ".m3u8") || strings.Contains(f.URL, "manifest")

		label := f.FormatNote
		if label == "" {
			switch height {
			case 2160:
				label = "4K"
			case 1440:
				label = "1440p"
			case 1080:
				label = "1080p"
			case 720:
				label = "720p"
			case 480:
				label = "480p"
			case 360:
				label = "360p"
			default:
				label = fmt.Sprintf("%dp", height)
			}
		}

		streamURL := f.URL

		qf := QualityFormat{
			FormatID:   f.FormatID,
			Label:      label,
			Resolution: f.Resolution,
			Height:     height,
			URL:        streamURL,
			IsHLS:      isHLS,
			VCodec:     f.VCodec,
			ACodec:     f.ACodec,
			Filesize:   filesize,
			HasAudio:   hasAudio,
		}

		// Prefer formats with audio, otherwise just add
		if idx, exists := seen[height]; exists {
			// Replace if this one has audio and the existing one doesn't
			if hasAudio && !qualities[idx].HasAudio {
				qualities[idx] = qf
			}
		} else {
			seen[height] = len(qualities)
			qualities = append(qualities, qf)
		}
	}

	// Sort by height descending
	sort.Slice(qualities, func(i, j int) bool {
		return qualities[i].Height > qualities[j].Height
	})

	return qualities, nil
}

func GetBestAudioURL(videoID string) (string, error) {
	url := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	cmdArgs := []string{
		"--dump-json",
		"--no-warnings",
		"--quiet",
		"--force-ipv4",
		"--no-playlist",
		"--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		url,
	}

	binPath := "yt-dlp"
	if _, err := exec.LookPath("yt-dlp"); err != nil {
		fallbacks := []string{
			os.ExpandEnv("$HOME/.local/bin/yt-dlp"),
			"/usr/local/bin/yt-dlp",
			"/opt/homebrew/bin/yt-dlp",
			"/config/.local/bin/yt-dlp",
		}
		for _, fb := range fallbacks {
			if _, err := os.Stat(fb); err == nil {
				binPath = fb
				break
			}
		}
	}

	cmd := exec.Command(binPath, cmdArgs...)

	var out bytes.Buffer
	cmd.Stdout = &out

	if err := cmd.Run(); err != nil {
		return "", err
	}

	var raw struct {
		Formats []struct {
			FormatID   string      `json:"format_id"`
			URL        string      `json:"url"`
			VCodec     string      `json:"vcodec"`
			ACodec     string      `json:"acodec"`
			ABR        interface{} `json:"abr"`
			FormatNote string      `json:"format_note"`
		} `json:"formats"`
	}

	if err := json.Unmarshal(out.Bytes(), &raw); err != nil {
		return "", err
	}

	// Find best audio-only stream (prefer highest ABR)
	var bestAudio string
	var bestABR float64
	for _, f := range raw.Formats {
		if f.VCodec == "none" && f.ACodec != "none" && f.URL != "" {
			var abr float64
			switch v := f.ABR.(type) {
			case float64:
				abr = v
			case int:
				abr = float64(v)
			}
			if abr > bestABR {
				bestABR = abr
				bestAudio = f.URL
			}
		}
	}

	return bestAudio, nil
}

func GetVideoQualitiesWithAudio(videoID string) ([]QualityFormat, string, error) {
	qualities, err := GetVideoQualities(videoID)
	if err != nil {
		return nil, "", err
	}

	// Get best audio URL
	audioURL, err := GetBestAudioURL(videoID)
	if err != nil {
		log.Printf("Warning: could not get audio URL: %v", err)
	}

	// Attach audio URL to qualities without audio
	for i := range qualities {
		if !qualities[i].HasAudio && audioURL != "" {
			qualities[i].AudioURL = audioURL
		}
	}

	return qualities, audioURL, nil
}

// GetFullStreamData runs a single yt-dlp command to fetch all essential information at once
// This avoids doing 3 separate slow calls for video info, qualities, and best audio.
func GetFullStreamData(videoID string) (*VideoData, []QualityFormat, string, error) {
	urlStr := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	cmdArgs := []string{
		"--dump-json",
		"--no-warnings",
		"--quiet",
		"--force-ipv4",
		"--no-playlist",
		"--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		urlStr,
	}

	binPath := "yt-dlp"
	if _, err := exec.LookPath("yt-dlp"); err != nil {
		fallbacks := []string{
			os.ExpandEnv("$HOME/Library/Python/3.14/bin/yt-dlp"),
			os.ExpandEnv("$HOME/Library/Python/3.13/bin/yt-dlp"),
			os.ExpandEnv("$HOME/Library/Python/3.12/bin/yt-dlp"),
			os.ExpandEnv("$HOME/.local/bin/yt-dlp"),
			"/usr/local/bin/yt-dlp",
			"/opt/homebrew/bin/yt-dlp",
			"/config/.local/bin/yt-dlp",
		}
		for _, fb := range fallbacks {
			if _, err := os.Stat(fb); err == nil {
				binPath = fb
				break
			}
		}
	}

	cmd := exec.Command(binPath, cmdArgs...)

	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		log.Printf("yt-dlp error in GetFullStreamData: %v, stderr: %s", err, stderr.String())
		return nil, nil, "", err
	}

	// Unmarshal common metadata
	var entry YtDlpEntry
	if err := json.Unmarshal(out.Bytes(), &entry); err != nil {
		return nil, nil, "", err
	}

	videoData := sanitizeVideoData(entry)
	videoData.StreamURL = entry.URL

	// Unmarshal formats specifically
	var raw struct {
		Formats []struct {
			FormatID    string      `json:"format_id"`
			FormatNote  string      `json:"format_note"`
			Ext         string      `json:"ext"`
			Resolution  string      `json:"resolution"`
			Width       interface{} `json:"width"`
			Height      interface{} `json:"height"`
			URL         string      `json:"url"`
			ManifestURL string      `json:"manifest_url"`
			VCodec      string      `json:"vcodec"`
			ACodec      string      `json:"acodec"`
			Filesize    interface{} `json:"filesize"`
			ABR         interface{} `json:"abr"`
		} `json:"formats"`
	}

	if err := json.Unmarshal(out.Bytes(), &raw); err != nil {
		return nil, nil, "", err
	}

	var qualities []QualityFormat
	seen := make(map[int]int) // height -> index in qualities
	var bestAudio string
	var bestABR float64

	for _, f := range raw.Formats {
		// Determine if it's the best audio
		if f.VCodec == "none" && f.ACodec != "none" && f.URL != "" {
			var abr float64
			switch v := f.ABR.(type) {
			case float64:
				abr = v
			case int:
				abr = float64(v)
			}
			if bestAudio == "" || abr > bestABR {
				bestABR = abr
				bestAudio = f.URL
			}
		}

		if f.VCodec == "none" || f.URL == "" {
			continue
		}

		var height int
		switch v := f.Height.(type) {
		case float64:
			height = int(v)
		case int:
			height = v
		}

		if height == 0 {
			continue
		}

		hasAudio := f.ACodec != "none" && f.ACodec != ""

		var filesize int64
		switch v := f.Filesize.(type) {
		case float64:
			filesize = int64(v)
		case int64:
			filesize = v
		}

		isHLS := f.ManifestURL != "" || strings.Contains(f.URL, ".m3u8") || strings.Contains(f.URL, "manifest")

		label := f.FormatNote
		if label == "" {
			switch height {
			case 2160:
				label = "4K"
			case 1440:
				label = "1440p"
			case 1080:
				label = "1080p"
			case 720:
				label = "720p"
			case 480:
				label = "480p"
			case 360:
				label = "360p"
			default:
				label = fmt.Sprintf("%dp", height)
			}
		}

		streamURL := f.URL

		qf := QualityFormat{
			FormatID:   f.FormatID,
			Label:      label,
			Resolution: f.Resolution,
			Height:     height,
			URL:        streamURL,
			IsHLS:      isHLS,
			VCodec:     f.VCodec,
			ACodec:     f.ACodec,
			Filesize:   filesize,
			HasAudio:   hasAudio,
		}

		// Prefer formats with audio, otherwise just add
		if idx, exists := seen[height]; exists {
			// Replace if this one has audio and the existing one doesn't
			if hasAudio && !qualities[idx].HasAudio {
				qualities[idx] = qf
			}
		} else {
			seen[height] = len(qualities)
			qualities = append(qualities, qf)
		}
	}

	// Sort by height descending
	for i := range qualities {
		for j := i + 1; j < len(qualities); j++ {
			if qualities[j].Height > qualities[i].Height {
				qualities[i], qualities[j] = qualities[j], qualities[i]
			}
		}
	}

	// Attach audio URL to qualities without audio
	for i := range qualities {
		if !qualities[i].HasAudio && bestAudio != "" {
			qualities[i].AudioURL = bestAudio
		}
	}

	return &videoData, qualities, bestAudio, nil
}

func GetStreamURLForQuality(videoID string, height int) (string, error) {
	qualities, err := GetVideoQualities(videoID)
	if err != nil {
		return "", err
	}

	for _, q := range qualities {
		if q.Height == height {
			return q.URL, nil
		}
	}

	if len(qualities) > 0 {
		return qualities[0].URL, nil
	}

	return "", fmt.Errorf("no suitable quality found")
}

func GetRelatedVideos(title, uploader string, limit int) ([]VideoData, error) {
	query := title
	if uploader != "" {
		query = uploader + " " + title
	}
	// Limit query length to avoid issues
	if len(query) > 100 {
		query = query[:100]
	}
	return SearchVideos(query, limit)
}

type DownloadInfo struct {
	URL   string `json:"url"`
	Title string `json:"title"`
	Ext   string `json:"ext"`
}

func GetDownloadURL(videoID string, formatID string) (*DownloadInfo, error) {
	url := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	formatArgs := "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
	if formatID != "" {
		formatArgs = formatID
		if !strings.Contains(formatID, "+") && !strings.Contains(formatID, "best") {
			// If it's just a video format, we might want to try adding audio, but for simple direct download links,
			// let's stick to what the user requested or what yt-dlp gives for that ID.
			formatArgs = formatID + "+bestaudio/best"
		}
	}

	args := []string{
		"--format", formatArgs,
		"--no-playlist",
		url,
	}

	out, err := RunYtDlp(args...)
	if err != nil {
		return nil, err
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	downloadURL, _ := raw["url"].(string)
	title, _ := raw["title"].(string)
	ext, _ := raw["ext"].(string)

	if downloadURL == "" {
		formats, ok := raw["formats"].([]interface{})
		if ok && len(formats) > 0 {
			// Try to find the first mp4 format that is not m3u8
			for i := len(formats) - 1; i >= 0; i-- {
				fmtMap, ok := formats[i].(map[string]interface{})
				if !ok {
					continue
				}
				fUrl, _ := fmtMap["url"].(string)
				fExt, _ := fmtMap["ext"].(string)
				if fUrl != "" && !strings.Contains(fUrl, ".m3u8") && fExt == "mp4" {
					downloadURL = fUrl
					ext = fExt
					break
				}
			}
		}
	}

	if title == "" {
		title = "video"
	}
	if ext == "" {
		ext = "mp4"
	}

	return &DownloadInfo{
		URL:   downloadURL,
		Title: title,
		Ext:   ext,
	}, nil
}

func GetVideoFormats(videoID string) ([]VideoFormat, error) {
	url := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	args := []string{
		"--dump-json",
		"--no-playlist",
		url,
	}

	out, err := RunYtDlp(args...)
	if err != nil {
		return nil, err
	}

	var raw struct {
		Formats []struct {
			FormatID   string  `json:"format_id"`
			FormatNote string  `json:"format_note"`
			Ext        string  `json:"ext"`
			Resolution string  `json:"resolution"`
			Filesize   float64 `json:"filesize"`
			VCodec     string  `json:"vcodec"`
			ACodec     string  `json:"acodec"`
		} `json:"formats"`
	}

	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var formats []VideoFormat
	for _, f := range raw.Formats {
		// Filter out storyboards and other non-media formats
		if strings.Contains(f.FormatID, "sb") || f.VCodec == "none" && f.ACodec == "none" {
			continue
		}

		fType := "both"
		if f.VCodec == "none" {
			fType = "audio"
		} else if f.ACodec == "none" {
			fType = "video"
		}

		formats = append(formats, VideoFormat{
			FormatID:   f.FormatID,
			FormatNote: f.FormatNote,
			Ext:        f.Ext,
			Resolution: f.Resolution,
			Filesize:   int64(f.Filesize),
			VCodec:     f.VCodec,
			ACodec:     f.ACodec,
			Type:       fType,
		})
	}

	return formats, nil
}

type ChannelInfo struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	SubscriberCount int64  `json:"subscriber_count"`
	Avatar          string `json:"avatar"`
}

func GetChannelInfo(channelID string) (*ChannelInfo, error) {
	url := fmt.Sprintf("https://www.youtube.com/channel/%s", channelID)
	if strings.HasPrefix(channelID, "@") {
		url = fmt.Sprintf("https://www.youtube.com/%s", channelID)
	}

	// Fetch 1 video with full metadata to extract channel info
	args := []string{
		url + "/videos",
		"--dump-json",
		"--playlist-end", "1",
		"--no-warnings",
		"--quiet",
	}

	out, err := RunYtDlp(args...)
	if err != nil || len(out) == 0 {
		return nil, fmt.Errorf("failed to get channel info: %v", err)
	}

	// Parse the first video's JSON
	var raw map[string]interface{}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) == 0 {
		return nil, fmt.Errorf("no output from yt-dlp")
	}

	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	title, _ := raw["channel"].(string)
	if title == "" {
		title, _ = raw["uploader"].(string)
	}
	if title == "" {
		title = channelID
	}

	cID, _ := raw["channel_id"].(string)
	if cID == "" {
		cID = channelID
	}

	subCountFloat, _ := raw["channel_follower_count"].(float64)

	// Create an avatar based on the first letter of the channel title
	avatarStr := "?"
	if len(title) > 0 {
		avatarStr = strings.ToUpper(string(title[0]))
	}

	return &ChannelInfo{
		ID:              cID,
		Title:           title,
		SubscriberCount: int64(subCountFloat),
		Avatar:          avatarStr, // Simple fallback for now
	}, nil
}

func GetChannelVideos(channelID string, limit int) ([]VideoData, error) {
	url := fmt.Sprintf("https://www.youtube.com/channel/%s", channelID)
	if strings.HasPrefix(channelID, "@") {
		url = fmt.Sprintf("https://www.youtube.com/%s", channelID)
	}

	args := []string{
		url + "/videos",
		"--flat-playlist",
		fmt.Sprintf("--playlist-end=%d", limit),
	}

	out, err := RunYtDlp(args...)
	if err != nil {
		return nil, err
	}

	var results []VideoData
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		var entry YtDlpEntry
		if err := json.Unmarshal([]byte(line), &entry); err == nil {
			if entry.ID != "" {
				results = append(results, sanitizeVideoData(entry))
			}
		}
	}

	return results, nil
}

type Comment struct {
	ID          string `json:"id"`
	Text        string `json:"text"`
	Author      string `json:"author"`
	AuthorID    string `json:"author_id"`
	AuthorThumb string `json:"author_thumbnail"`
	Likes       int    `json:"likes"`
	IsReply     bool   `json:"is_reply"`
	Parent      string `json:"parent"`
	Timestamp   string `json:"timestamp"`
}

func GetComments(videoID string, limit int) ([]Comment, error) {
	url := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	cmdArgs := []string{
		"--no-warnings",
		"--quiet",
		"--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"--dump-json",
		"--no-download",
		"--no-playlist",
		"--write-comments",
		"--extractor-args", fmt.Sprintf("youtube:comment_sort=top;max_comments=%d", limit),
		url,
	}

	cmd := exec.Command(ytDlpBinPath, cmdArgs...)

	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		log.Printf("yt-dlp comments error: %v, stderr: %s", err, stderr.String())
		return nil, err
	}

	var raw struct {
		Comments []struct {
			ID          string `json:"id"`
			Text        string `json:"text"`
			Author      string `json:"author"`
			AuthorID    string `json:"author_id"`
			AuthorThumb string `json:"author_thumbnail"`
			Likes       int    `json:"like_count"`
			IsReply     bool   `json:"is_reply"`
			Parent      string `json:"parent"`
			Timestamp   int64  `json:"timestamp"`
		} `json:"comments"`
	}

	if err := json.Unmarshal(out.Bytes(), &raw); err != nil {
		return nil, err
	}

	var comments []Comment
	for _, c := range raw.Comments {
		timestamp := ""
		if c.Timestamp > 0 {
			timestamp = formatCommentTime(c.Timestamp)
		}
		comments = append(comments, Comment{
			ID:          c.ID,
			Text:        c.Text,
			Author:      c.Author,
			AuthorID:    c.AuthorID,
			AuthorThumb: c.AuthorThumb,
			Likes:       c.Likes,
			IsReply:     c.IsReply,
			Parent:      c.Parent,
			Timestamp:   timestamp,
		})
	}

	return comments, nil
}

func formatCommentTime(timestamp int64) string {
	now := float64(timestamp)
	then := float64(0)
	diff := int((now - then) / 1000)

	if diff < 60 {
		return "just now"
	} else if diff < 3600 {
		return fmt.Sprintf("%dm ago", diff/60)
	} else if diff < 86400 {
		return fmt.Sprintf("%dh ago", diff/3600)
	} else if diff < 604800 {
		return fmt.Sprintf("%dd ago", diff/86400)
	} else if diff < 2592000 {
		return fmt.Sprintf("%dw ago", diff/604800)
	} else if diff < 31536000 {
		return fmt.Sprintf("%dmo ago", diff/2592000)
	}
	return fmt.Sprintf("%dy ago", diff/31536000)
}
