import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import type { PlaygroundConversation } from '../types'

type ConversationListProps = {
  conversations: PlaygroundConversation[]
  activeConversationId: number | null
  disabled?: boolean
  onCreate: () => void
  onSelect: (id: number) => void
  onDelete: (id: number) => Promise<void>
}

export function ConversationList(props: ConversationListProps) {
  const { t } = useTranslation()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const selected = props.conversations.find((item) => item.id === deleteId)

  return (
    <aside className='bg-muted/20 flex w-64 shrink-0 flex-col border-e'>
      <div className='flex items-center justify-between gap-2 border-b p-3'>
        <h2 className='text-sm font-semibold'>{t('Conversations')}</h2>
        <Button
          aria-label={t('New conversation')}
          disabled={props.disabled}
          onClick={props.onCreate}
          size='icon-sm'
          variant='outline'
        >
          <PlusIcon />
        </Button>
      </div>
      <ScrollArea className='min-h-0 flex-1'>
        <div className='space-y-1 p-2'>
          {props.conversations.map((conversation) => (
            <div
              className={cn(
                'group flex items-center gap-1 rounded-lg p-1',
                props.activeConversationId === conversation.id && 'bg-muted'
              )}
              key={conversation.id}
            >
              <Button
                className='min-w-0 flex-1 justify-start truncate text-start'
                disabled={props.disabled}
                onClick={() => props.onSelect(conversation.id)}
                variant='ghost'
              >
                <span className='truncate'>{conversation.title}</span>
              </Button>
              <Button
                aria-label={t('Delete conversation')}
                className='text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100'
                disabled={props.disabled}
                onClick={() => setDeleteId(conversation.id)}
                size='icon-xs'
                variant='ghost'
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      <ConfirmDialog
        destructive
        desc={t('This conversation and its messages will be permanently deleted.')}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (deleteId !== null) {
            void props.onDelete(deleteId)
          }
          setDeleteId(null)
        }}
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title={t('Delete conversation?')}
      >
        <p className='text-muted-foreground text-sm'>{selected?.title}</p>
      </ConfirmDialog>
    </aside>
  )
}
