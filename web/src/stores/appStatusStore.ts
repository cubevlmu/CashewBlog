import { reactive } from 'vue'

type AppNoticeKind = 'backend-error' | 'auth-expired'

const noticeState = reactive<{
  kind: AppNoticeKind | ''
  message: string
}>({
  kind: '',
  message: '',
})

export const appStatusState = reactive({
  get noticeKind() {
    return noticeState.kind
  },
  get noticeMessage() {
    return noticeState.message
  },
  get hasNotice() {
    return Boolean(noticeState.message)
  },
})

export function setAppNotice(kind: AppNoticeKind, message: string) {
  noticeState.kind = kind
  noticeState.message = message
}

export function clearAppNotice(kind?: AppNoticeKind) {
  if (kind && noticeState.kind !== kind) {
    return
  }

  noticeState.kind = ''
  noticeState.message = ''
}
