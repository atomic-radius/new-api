/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useRef, useState } from 'react'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import {
  applyMessageStateUpdate,
  getInitialParameterEnabled,
  getInitialPlaygroundConfig,
  loadMessages,
  saveConfig,
  saveParameterEnabled,
  type MessageStateUpdater,
} from '../lib'
import {
  createPlaygroundConversation,
  deletePlaygroundConversation,
  getPlaygroundConversation,
  listPlaygroundConversations,
  updatePlaygroundConversation,
} from '../api'
import type {
  Message,
  PlaygroundConfig,
  ParameterEnabled,
  ModelOption,
  GroupOption,
  PlaygroundConversation,
} from '../types'

const MESSAGE_SAVE_DEBOUNCE_MS = 500

/**
 * Main state management hook for playground
 */
export function usePlaygroundState() {
  // Load initial state from localStorage
  const [config, setConfig] = useState<PlaygroundConfig>(
    getInitialPlaygroundConfig
  )

  const [parameterEnabled, setParameterEnabled] = useState<ParameterEnabled>(
    getInitialParameterEnabled
  )

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [conversations, setConversations] = useState<PlaygroundConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const messagesSaveTimerRef = useRef<number | null>(null)
  const latestMessagesRef = useRef<Message[]>(messages)
  const hasLoadedMessagesRef = useRef(false)
  const activeConversationRef = useRef<number | null>(null)

  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  const persistMessages = useCallback((messagesToSave: Message[]) => {
    latestMessagesRef.current = messagesToSave

    const conversationId = activeConversationRef.current
    if (!hasLoadedMessagesRef.current || conversationId === null) {
      return
    }

    if (messagesSaveTimerRef.current !== null) {
      window.clearTimeout(messagesSaveTimerRef.current)
    }

    messagesSaveTimerRef.current = window.setTimeout(() => {
      messagesSaveTimerRef.current = null
      const title = getConversationTitle(latestMessagesRef.current)
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title,
                model: configRef.current.model,
                group: configRef.current.group,
                updated_at: Math.floor(Date.now() / 1000),
              }
            : conversation
        )
      )
      void updatePlaygroundConversation(conversationId, {
        title,
        model: configRef.current.model,
        group: configRef.current.group,
        messages: latestMessagesRef.current,
      })
    }, MESSAGE_SAVE_DEBOUNCE_MS)
  }, [])

  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        let loadedConversations = await listPlaygroundConversations()
        if (loadedConversations.length === 0) {
          const legacyMessages = loadMessages() ?? []
          const created = await createPlaygroundConversation({
            model: configRef.current.model,
            group: configRef.current.group,
            messages: legacyMessages,
          })
          loadedConversations = [created]
        }
        if (cancelled) return
        setConversations(loadedConversations)
        const first = loadedConversations[0]
        const detail = await getPlaygroundConversation(first.id)
        if (cancelled) return
        const loadedMessages = parseConversationMessages(detail.messages)
        activeConversationRef.current = detail.id
        setActiveConversationId(detail.id)
        latestMessagesRef.current = loadedMessages
        hasLoadedMessagesRef.current = true
        setMessages(loadedMessages)
      } finally {
        if (!cancelled) {
          setIsLoadingConversations(false)
          setIsLoadingMessages(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      if (messagesSaveTimerRef.current !== null) {
        window.clearTimeout(messagesSaveTimerRef.current)
      }
    },
    []
  )

  // Update config with automatic save
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((prev) => {
        const updated = { ...prev, [key]: value }
        saveConfig(updated)
        return updated
      })
    },
    []
  )

  // Update parameter enabled with automatic save
  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      setParameterEnabled((prev) => {
        const updated = { ...prev, [key]: value }
        saveParameterEnabled(updated)
        return updated
      })
    },
    []
  )

  // Update messages with automatic save
  const updateMessages = useCallback(
    (updater: MessageStateUpdater) => {
      setMessages((prev) => {
        const newMessages = applyMessageStateUpdate(prev, updater)
        persistMessages(newMessages)
        return newMessages
      })
    },
    [persistMessages]
  )

  // Clear all messages
  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
    saveConfig(DEFAULT_CONFIG)
    saveParameterEnabled(DEFAULT_PARAMETER_ENABLED)
  }, [])

  const selectConversation = useCallback(async (conversationId: number) => {
    if (conversationId === activeConversationRef.current) return
    if (messagesSaveTimerRef.current !== null) {
      window.clearTimeout(messagesSaveTimerRef.current)
      messagesSaveTimerRef.current = null
    }
    setIsLoadingMessages(true)
    const detail = await getPlaygroundConversation(conversationId)
    const loadedMessages = parseConversationMessages(detail.messages)
    activeConversationRef.current = detail.id
    setActiveConversationId(detail.id)
    latestMessagesRef.current = loadedMessages
    setMessages(loadedMessages)
    setIsLoadingMessages(false)
  }, [])

  const createConversation = useCallback(async () => {
    const conversation = await createPlaygroundConversation({
      model: configRef.current.model,
      group: configRef.current.group,
    })
    setConversations((previous) => [conversation, ...previous])
    activeConversationRef.current = conversation.id
    setActiveConversationId(conversation.id)
    latestMessagesRef.current = []
    setMessages([])
    hasLoadedMessagesRef.current = true
  }, [])

  const deleteConversation = useCallback(async (conversationId: number) => {
    await deletePlaygroundConversation(conversationId)
    const remaining = conversations.filter((item) => item.id !== conversationId)
    if (remaining.length === 0) {
      const replacement = await createPlaygroundConversation({
        model: configRef.current.model,
        group: configRef.current.group,
      })
      setConversations([replacement])
      activeConversationRef.current = replacement.id
      setActiveConversationId(replacement.id)
      latestMessagesRef.current = []
      setMessages([])
      return
    }
    setConversations(remaining)
    if (activeConversationRef.current === conversationId) {
      await selectConversation(remaining[0].id)
    }
  }, [conversations, selectConversation])

  return {
    // State
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    models,
    groups,

    // Setters
    setModels,
    setGroups,

    // Actions
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    clearMessages,
    resetConfig,
    conversations,
    activeConversationId,
    isLoadingConversations,
    selectConversation,
    createConversation,
    deleteConversation,
  }
}

function parseConversationMessages(value: string): Message[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as Message[]) : []
  } catch {
    return []
  }
}

function getConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((message) => message.from === 'user')
  const content = firstUserMessage?.versions.at(-1)?.content.trim()
  return content ? content.slice(0, 80) : 'New conversation'
}
