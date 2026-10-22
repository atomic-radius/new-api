package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type playgroundConversationRequest struct {
	Title    string `json:"title"`
	Model    string `json:"model"`
	Group    string `json:"group"`
	Messages string `json:"messages"`
}

func playgroundConversationID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, errors.New("invalid conversation id"))
		return 0, false
	}
	return id, true
}

func writePlaygroundConversationError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorStatus(c, http.StatusNotFound, errors.New("playground conversation not found"))
		return
	}
	common.ApiErrorStatus(c, http.StatusBadRequest, err)
}

func ListPlaygroundConversations(c *gin.Context) {
	conversations, err := model.ListPlaygroundConversations(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, conversations)
}

func CreatePlaygroundConversation(c *gin.Context) {
	request := playgroundConversationRequest{Messages: "[]"}
	if c.Request.Body != nil {
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			common.ApiErrorStatus(c, http.StatusBadRequest, errors.New("invalid conversation parameters"))
			return
		}
	}
	conversation, err := model.CreatePlaygroundConversation(c.GetInt("id"), request.Title, request.Model, request.Group, request.Messages)
	if err != nil {
		writePlaygroundConversationError(c, err)
		return
	}
	common.ApiSuccess(c, conversation)
}

func GetPlaygroundConversation(c *gin.Context) {
	id, ok := playgroundConversationID(c)
	if !ok {
		return
	}
	conversation, err := model.GetPlaygroundConversation(c.GetInt("id"), id)
	if err != nil {
		writePlaygroundConversationError(c, err)
		return
	}
	common.ApiSuccess(c, conversation)
}

func UpdatePlaygroundConversation(c *gin.Context) {
	id, ok := playgroundConversationID(c)
	if !ok {
		return
	}
	var request playgroundConversationRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || strings.TrimSpace(request.Messages) == "" {
		common.ApiErrorStatus(c, http.StatusBadRequest, errors.New("invalid conversation parameters"))
		return
	}
	conversation, err := model.UpdatePlaygroundConversation(c.GetInt("id"), id, request.Title, request.Model, request.Group, request.Messages)
	if err != nil {
		writePlaygroundConversationError(c, err)
		return
	}
	common.ApiSuccess(c, conversation)
}

func DeletePlaygroundConversation(c *gin.Context) {
	id, ok := playgroundConversationID(c)
	if !ok {
		return
	}
	if err := model.DeletePlaygroundConversation(c.GetInt("id"), id); err != nil {
		writePlaygroundConversationError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}
