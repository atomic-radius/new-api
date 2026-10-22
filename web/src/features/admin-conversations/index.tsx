import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionPageLayout } from '@/components/layout'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

type Conversation = {
  id: number
  user_id: number
  title: string
  model: string
  group: string
  messages: string
  updated_at: number
}

export function AdminConversations() {
  const { t } = useTranslation()
  const [items, setItems] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/admin/playground/conversations', {
        params: { keyword, page_size: 100 },
      })
      const data = requireServerSuccess(response.data) as {
        data: { items: Conversation[] }
      }
      setItems(data.data.items ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Failed to load conversations'))
    } finally {
      setLoading(false)
    }
  }, [keyword, t])

  useEffect(() => {
    void load()
  }, [load])

  const open = async (id: number) => {
    const response = await api.get(`/api/admin/playground/conversations/${id}`)
    const data = requireServerSuccess(response.data) as { data: Conversation }
    setSelected(data.data)
  }

  const save = async () => {
    if (!selected) return
    const response = await api.put(`/api/admin/playground/conversations/${selected.id}`, selected)
    const data = requireServerSuccess(response.data) as { data: Conversation }
    setSelected(data.data)
    await load()
    toast.success(t('Conversation saved'))
  }

  const remove = async () => {
    if (!selected) return
    await api.delete(`/api/admin/playground/conversations/${selected.id}`)
    setSelected(null)
    await load()
    toast.success(t('Conversation deleted'))
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('All conversations')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex min-h-0 size-full gap-4'>
        <div className='flex w-80 min-w-0 flex-col gap-2'>
          <div className='flex gap-2'>
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t('Search conversations')} />
            <Button onClick={() => void load()} disabled={loading}>{t('Search')}</Button>
          </div>
          <div className='min-h-0 flex-1 overflow-auto rounded border'>
            {items.map((item) => (
              <button type='button' className='hover:bg-muted block w-full border-b p-3 text-start' key={item.id} onClick={() => void open(item.id)}>
                <div className='font-medium'>{item.title}</div>
                <div className='text-muted-foreground text-xs'>{t('User ID')}: {item.user_id} · {item.model}</div>
              </button>
            ))}
          </div>
        </div>
        <div className='min-w-0 flex-1 space-y-3'>
          {selected ? (
            <>
              <Input value={selected.title} onChange={(event) => setSelected({ ...selected, title: event.target.value })} />
              <textarea className='bg-background min-h-96 w-full rounded border p-3 font-mono text-xs' value={selected.messages} onChange={(event) => setSelected({ ...selected, messages: event.target.value })} />
              <div className='flex gap-2'>
                <Button onClick={() => void save()}>{t('Save')}</Button>
                <Button variant='destructive' onClick={() => void remove()}>{t('Delete')}</Button>
              </div>
            </>
          ) : <p className='text-muted-foreground'>{t('Select a conversation')}</p>}
        </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
