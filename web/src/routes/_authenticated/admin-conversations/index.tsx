import { createFileRoute, redirect } from '@tanstack/react-router'

import { AdminConversations } from '@/features/admin-conversations'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/admin-conversations/')({
  beforeLoad: () => {
    if ((useAuthStore.getState().auth.user?.role ?? 0) < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: AdminConversations,
})
