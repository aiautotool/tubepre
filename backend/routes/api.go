package routes

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"kvtube-go/services"

	"github.com/gin-gonic/gin"
)

// getAllowedOrigins returns allowed CORS origins from environment variable or defaults
func getAllowedOrigins() []string {
	originsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")
	if originsEnv == "" {
		// Default: allow localhost for development
		return []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:5011",
			"http://127.0.0.1:5011",
		}
	}
	origins := strings.Split(originsEnv, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	return origins
}

// isAllowedOrigin checks if the given origin is in the allowed list
func isAllowedOrigin(origin string, allowedOrigins []string) bool {
	for _, allowed := range allowedOrigins {
		if allowed == "*" || allowed == origin {
			return true
		}
	}
	return false
}

func SetupRouter() *gin.Engine {
	r := gin.Default()

	// CORS middleware - restrict to specific origins from environment variable
	allowedOrigins := getAllowedOrigins()
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && isAllowedOrigin(origin, allowedOrigins) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// API Routes - Using yt-dlp for video operations
	api := r.Group("/api")
	{
		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// Video endpoints
		api.GET("/search", handleSearch)
		api.GET("/trending", handleTrending)
		api.GET("/get_stream_info", handleGetStreamInfo)
		api.GET("/video/:id", handleGetVideoInfo)
		api.GET("/video/:id/qualities", handleGetQualities)
		api.GET("/video/:id/related", handleRelatedVideos)
		api.GET("/video/:id/comments", handleComments)
		api.GET("/video/:id/download", handleDownload)

		// Channel endpoints
		api.GET("/channel/info", handleChannelInfo)
		api.GET("/channel/videos", handleChannelVideos)

		// History routes
		api.POST("/history", handlePostHistory)
		api.GET("/history", handleGetHistory)
		api.GET("/suggestions", handleGetSuggestions)

		// Subscription routes
		api.POST("/subscribe", handleSubscribe)
		api.DELETE("/subscribe", handleUnsubscribe)
		api.GET("/subscribe", handleCheckSubscription)
		api.GET("/subscriptions", handleGetSubscriptions)
	}

	return r
}

// Video search endpoint
func handleSearch(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	limitStr := c.Query("limit")
	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
		limit = l
	}

	results, err := services.SearchVideos(query, limit)
	if err != nil {
		log.Printf("Search error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search videos"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// Trending videos endpoint
func handleTrending(c *gin.Context) {
	limitStr := c.Query("limit")
	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
		limit = l
	}

	// Use popular music search as trending
	results, err := services.SearchVideos("popular music trending", limit)
	if err != nil {
		log.Printf("Trending error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get trending videos"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// Get video info
func handleGetVideoInfo(c *gin.Context) {
	videoID := c.Param("id")
	if videoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Video ID is required"})
		return
	}

	video, err := services.GetVideoInfo(videoID)
	if err != nil {
		log.Printf("GetVideoInfo error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get video info"})
		return
	}

	c.JSON(http.StatusOK, video)
}

func handleGetStreamInfo(c *gin.Context) {
	videoID := c.Query("v")
	if videoID == "" {
		videoID = c.Query("id")
	}
	if videoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Video ID is required"})
		return
	}

	video, qualities, _, err := services.GetFullStreamData(videoID)
	if err != nil {
		log.Printf("GetStreamInfo error: %v", err)
		c.JSON(http.StatusOK, gin.H{"error": "Failed to get stream info"})
		return
	}

	streamURL := ""
	selectedFormat := ""
	for _, quality := range qualities {
		if quality.HasAudio && !quality.IsHLS && quality.URL != "" {
			streamURL = quality.URL
			selectedFormat = quality.FormatID
			break
		}
	}
	if streamURL == "" {
		for _, quality := range qualities {
			if quality.HasAudio && quality.URL != "" {
				streamURL = quality.URL
				selectedFormat = quality.FormatID
				break
			}
		}
	}
	if streamURL == "" && video != nil {
		streamURL = video.StreamURL
	}
	if streamURL == "" {
		c.JSON(http.StatusOK, gin.H{"error": "No stream URL available"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"stream_url": streamURL,
		"format_id":  selectedFormat,
	})
}

// Get video qualities
func handleGetQualities(c *gin.Context) {
	videoID := c.Param("id")
	if videoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Video ID is required"})
		return
	}

	qualities, audioURL, err := services.GetVideoQualitiesWithAudio(videoID)
	if err != nil {
		log.Printf("GetQualities error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get video qualities"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"qualities": qualities,
		"audio_url": audioURL,
	})
}

// Get related videos
func handleRelatedVideos(c *gin.Context) {
	videoID := c.Param("id")
	if videoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Video ID is required"})
		return
	}

	limitStr := c.Query("limit")
	limit := 15
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
		limit = l
	}

	// First get video info to get title and uploader
	video, err := services.GetVideoInfo(videoID)
	if err != nil {
		log.Printf("GetVideoInfo for related error: %v", err)
		// Fallback: search for similar content
		results, err := services.SearchVideos("music", limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get related videos"})
			return
		}
		c.JSON(http.StatusOK, results)
		return
	}

	related, err := services.GetRelatedVideos(video.Title, video.Uploader, limit)
	if err != nil {
		log.Printf("GetRelatedVideos error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get related videos"})
		return
	}

	c.JSON(http.StatusOK, related)
}

// Get video comments
func handleComments(c *gin.Context) {
	videoID := c.Param("id")
	if videoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Video ID is required"})
		return
	}

	limitStr := c.Query("limit")
	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
		limit = l
	}

	comments, err := services.GetComments(videoID, limit)
	if err != nil {
		log.Printf("GetComments error: %v", err)
		c.JSON(http.StatusOK, []interface{}{}) // Return empty array instead of error
		return
	}

	c.JSON(http.StatusOK, comments)
}

// Get download URL
func handleDownload(c *gin.Context) {
	videoID := c.Param("id")
	if videoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Video ID is required"})
		return
	}

	formatID := c.Query("format")

	downloadInfo, err := services.GetDownloadURL(videoID, formatID)
	if err != nil {
		log.Printf("GetDownloadURL error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get download URL"})
		return
	}

	c.JSON(http.StatusOK, downloadInfo)
}

// Get channel info
func handleChannelInfo(c *gin.Context) {
	channelID := c.Query("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID is required"})
		return
	}

	channelInfo, err := services.GetChannelInfo(channelID)
	if err != nil {
		log.Printf("GetChannelInfo error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channel info"})
		return
	}

	c.JSON(http.StatusOK, channelInfo)
}

// Get channel videos
func handleChannelVideos(c *gin.Context) {
	channelID := c.Query("id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID is required"})
		return
	}

	limitStr := c.Query("limit")
	limit := 30
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
		limit = l
	}

	videos, err := services.GetChannelVideos(channelID, limit)
	if err != nil {
		log.Printf("GetChannelVideos error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channel videos"})
		return
	}

	c.JSON(http.StatusOK, videos)
}

// History handlers
func handlePostHistory(c *gin.Context) {
	var body struct {
		VideoID   string `json:"video_id"`
		Title     string `json:"title"`
		Thumbnail string `json:"thumbnail"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if body.VideoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Video ID is required"})
		return
	}

	err := services.AddToHistory(body.VideoID, body.Title, body.Thumbnail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func handleGetHistory(c *gin.Context) {
	limitStr := c.Query("limit")
	limit := 50
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	history, err := services.GetHistory(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get history"})
		return
	}

	// Make the API response shape match the VideoData shape the frontend expects
	var results []services.VideoData
	for _, h := range history {
		results = append(results, services.VideoData{
			ID:        h.ID,
			Title:     h.Title,
			Thumbnail: h.Thumbnail,
			Uploader:  "History",
		})
	}

	c.JSON(http.StatusOK, results)
}

func handleGetSuggestions(c *gin.Context) {
	limitStr := c.Query("limit")
	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	suggestions, err := services.GetSuggestions(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get suggestions"})
		return
	}

	c.JSON(http.StatusOK, suggestions)
}

// Subscription handlers
func handleSubscribe(c *gin.Context) {
	var body struct {
		ChannelID     string `json:"channel_id"`
		ChannelName   string `json:"channel_name"`
		ChannelAvatar string `json:"channel_avatar"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if body.ChannelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID is required"})
		return
	}

	err := services.SubscribeChannel(body.ChannelID, body.ChannelName, body.ChannelAvatar)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to subscribe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "subscribed"})
}

func handleUnsubscribe(c *gin.Context) {
	channelID := c.Query("channel_id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID is required"})
		return
	}

	err := services.UnsubscribeChannel(channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unsubscribe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "unsubscribed"})
}

func handleCheckSubscription(c *gin.Context) {
	channelID := c.Query("channel_id")
	if channelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Channel ID is required"})
		return
	}

	subscribed, err := services.IsSubscribed(channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subscribed": subscribed})
}

func handleGetSubscriptions(c *gin.Context) {
	subs, err := services.GetSubscriptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get subscriptions"})
		return
	}

	c.JSON(http.StatusOK, subs)
}

func logPrintf(format string, v ...interface{}) {
	log.Printf(format, v...)
}
