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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import { API_ENDPOINTS } from './constants'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
  Message,
  PlaygroundConversation,
} from './types'

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get user available models
 */
export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<
    string,
    { desc: string; ratio: number | string }
  >

  // label is for button display (name only); desc is for dropdown content
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

const CONVERSATIONS_ENDPOINT = '/api/playground/conversations'

function conversationMessages(messages: Message[]): string {
  return JSON.stringify(messages)
}

export async function listPlaygroundConversations(): Promise<PlaygroundConversation[]> {
  const res = await api.get(CONVERSATIONS_ENDPOINT)
  const response = requireServerSuccess(res.data) as {
    data?: PlaygroundConversation[]
  }
  return Array.isArray(response.data) ? response.data : []
}

export async function createPlaygroundConversation(input?: {
  title?: string
  model?: string
  group?: string
  messages?: Message[]
}): Promise<PlaygroundConversation> {
  const res = await api.post(CONVERSATIONS_ENDPOINT, {
    title: input?.title ?? '',
    model: input?.model ?? '',
    group: input?.group ?? '',
    messages: conversationMessages(input?.messages ?? []),
  })
  const response = requireServerSuccess(res.data) as {
    data: PlaygroundConversation
  }
  return response.data
}

export async function getPlaygroundConversation(
  id: number
): Promise<PlaygroundConversation> {
  const res = await api.get(`${CONVERSATIONS_ENDPOINT}/${id}`)
  const response = requireServerSuccess(res.data) as {
    data: PlaygroundConversation
  }
  return response.data
}

export async function updatePlaygroundConversation(
  id: number,
  input: { title: string; model: string; group: string; messages: Message[] }
): Promise<PlaygroundConversation> {
  const res = await api.put(`${CONVERSATIONS_ENDPOINT}/${id}`, {
    ...input,
    messages: conversationMessages(input.messages),
  })
  return requireServerSuccess(res.data) as PlaygroundConversation
}

export async function deletePlaygroundConversation(id: number): Promise<void> {
  const res = await api.delete(`${CONVERSATIONS_ENDPOINT}/${id}`)
  requireServerSuccess(res.data)
}
