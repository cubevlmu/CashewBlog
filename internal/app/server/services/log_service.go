package services

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type LogService struct {
	path string
}

type LogListFilter struct {
	Page     int
	PageSize int
	Level    string
	Keyword  string
}

type AdminLogItem struct {
	ID         int64       `json:"id"`
	UserID     int64       `json:"user_id"`
	Action     string      `json:"action"`
	TargetType string      `json:"target_type"`
	TargetID   int64       `json:"target_id"`
	Detail     interface{} `json:"detail"`
	IP         string      `json:"ip"`
	CreatedAt  time.Time   `json:"created_at"`
}

func NewLogService(path string) *LogService {
	return &LogService{path: path}
}

func (s *LogService) ListLogs(_ context.Context, filter LogListFilter) (*PageData, error) {
	items, err := s.readLogItems()
	if err != nil {
		return nil, err
	}

	filtered := make([]AdminLogItem, 0, len(items))
	level := strings.ToUpper(strings.TrimSpace(filter.Level))
	keyword := strings.ToLower(strings.TrimSpace(filter.Keyword))
	for i := len(items) - 1; i >= 0; i-- {
		item := items[i]
		if level != "" {
			logLevel, _ := item.Detail.(map[string]interface{})["level"].(string)
			if strings.ToUpper(logLevel) != level {
				continue
			}
		}
		if keyword != "" {
			raw, _ := json.Marshal(item)
			if !strings.Contains(strings.ToLower(string(raw)), keyword) {
				continue
			}
		}
		filtered = append(filtered, item)
	}

	total := int64(len(filtered))
	start := (filter.Page - 1) * filter.PageSize
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + filter.PageSize
	if end > len(filtered) {
		end = len(filtered)
	}

	pageItems := filtered[start:end]
	return &PageData{
		List:     pageItems,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (s *LogService) readLogItems() ([]AdminLogItem, error) {
	if s == nil || strings.TrimSpace(s.path) == "" {
		return []AdminLogItem{}, nil
	}

	file, err := os.Open(filepath.Clean(s.path))
	if err != nil {
		if os.IsNotExist(err) {
			return []AdminLogItem{}, nil
		}
		return nil, err
	}
	defer file.Close()

	items := make([]AdminLogItem, 0)
	scanner := bufio.NewScanner(file)
	var id int64
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "====================") {
			continue
		}
		id++
		item := parseLogLine(id, line)
		items = append(items, item)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func parseLogLine(id int64, line string) AdminLogItem {
	fields := strings.Fields(line)
	createdAt := time.Time{}
	level := ""
	loggerName := ""
	message := line

	if len(fields) >= 4 {
		if t, err := time.Parse("15:04:05 -0700", fields[0]+" "+fields[1]); err == nil {
			now := time.Now()
			createdAt = time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), t.Second(), 0, t.Location())
			level = strings.Trim(fields[2], "[]")
			loggerName = fields[3]
			if len(fields) > 4 {
				message = strings.Join(fields[4:], " ")
			}
		}
	}

	ip := extractField(message, "ip=")
	targetID, _ := strconv.ParseInt(extractField(message, "target_id="), 10, 64)
	userID, _ := strconv.ParseInt(extractField(message, "user_id="), 10, 64)
	targetType := extractField(message, "target_type=")
	action := extractField(message, "action=")
	if action == "" {
		action = message
	}
	if targetType == "" {
		targetType = loggerName
	}

	detail := map[string]interface{}{
		"line":    line,
		"level":   level,
		"logger":  loggerName,
		"message": message,
	}

	return AdminLogItem{
		ID:         id,
		UserID:     userID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     detail,
		IP:         ip,
		CreatedAt:  createdAt,
	}
}

func extractField(message string, key string) string {
	idx := strings.Index(message, key)
	if idx < 0 {
		return ""
	}
	rest := message[idx+len(key):]
	if end := strings.Index(rest, " "); end >= 0 {
		return strings.Trim(rest[:end], "\"")
	}
	return strings.Trim(rest, "\"")
}
