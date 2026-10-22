package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const PlaygroundConversationMessagesLimit = 2 * 1024 * 1024

// PlaygroundConversation stores a user's Playground transcript. Messages are
// kept as JSON text so the schema remains compatible with SQLite, MySQL and
// PostgreSQL without relying on dialect-specific JSON columns.
type PlaygroundConversation struct {
	ID        int64  `json:"id" gorm:"primaryKey"`
	UserID    int    `json:"user_id" gorm:"not null;index"`
	Title     string `json:"title" gorm:"type:varchar(200);not null"`
	Model     string `json:"model" gorm:"type:varchar(128)"`
	Group     string `json:"group" gorm:"type:varchar(50)"`
	Messages  string `json:"messages" gorm:"type:text;not null"`
	CreatedAt int64  `json:"created_at" gorm:"not null;index"`
	UpdatedAt int64  `json:"updated_at" gorm:"not null;index"`
}

func (PlaygroundConversation) TableName() string {
	return "playground_conversations"
}

func normalizePlaygroundTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return "New conversation"
	}
	if len(title) > 200 {
		return title[:200]
	}
	return title
}

func normalizePlaygroundMessages(messages string) (string, error) {
	if len(messages) > PlaygroundConversationMessagesLimit {
		return "", errors.New("playground conversation is too large")
	}
	if strings.TrimSpace(messages) == "" {
		return "[]", nil
	}
	var value any
	if err := common.UnmarshalJsonStr(messages, &value); err != nil {
		return "", errors.New("invalid playground conversation messages")
	}
	if _, ok := value.([]any); !ok {
		return "", errors.New("playground conversation messages must be an array")
	}
	return messages, nil
}

func CreatePlaygroundConversation(userID int, title, modelName, group, messages string) (*PlaygroundConversation, error) {
	normalizedMessages, err := normalizePlaygroundMessages(messages)
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	conversation := &PlaygroundConversation{
		UserID:    userID,
		Title:     normalizePlaygroundTitle(title),
		Model:     strings.TrimSpace(modelName),
		Group:     strings.TrimSpace(group),
		Messages:  normalizedMessages,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := DB.Create(conversation).Error; err != nil {
		return nil, err
	}
	return conversation, nil
}

func ListPlaygroundConversations(userID int) ([]PlaygroundConversation, error) {
	var conversations []PlaygroundConversation
	err := DB.Where("user_id = ?", userID).
		Order("updated_at DESC, id DESC").
		Find(&conversations).Error
	return conversations, err
}

func GetPlaygroundConversation(userID int, id int64) (*PlaygroundConversation, error) {
	conversation := &PlaygroundConversation{}
	err := DB.Where("user_id = ? AND id = ?", userID, id).First(conversation).Error
	return conversation, err
}

func UpdatePlaygroundConversation(userID int, id int64, title, modelName, group, messages string) (*PlaygroundConversation, error) {
	normalizedMessages, err := normalizePlaygroundMessages(messages)
	if err != nil {
		return nil, err
	}
	conversation, err := GetPlaygroundConversation(userID, id)
	if err != nil {
		return nil, err
	}
	conversation.Title = normalizePlaygroundTitle(title)
	conversation.Model = strings.TrimSpace(modelName)
	conversation.Group = strings.TrimSpace(group)
	conversation.Messages = normalizedMessages
	conversation.UpdatedAt = time.Now().Unix()
	if err := DB.Save(conversation).Error; err != nil {
		return nil, err
	}
	return conversation, nil
}

func DeletePlaygroundConversation(userID int, id int64) error {
	result := DB.Where("user_id = ? AND id = ?", userID, id).Delete(&PlaygroundConversation{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
