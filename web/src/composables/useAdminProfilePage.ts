import { computed, reactive, ref, watch } from 'vue'

import { updateCurrentUserPassword, updateCurrentUserProfile } from '@/services/auth'
import { authState } from '@/stores/authStore'
import type { AuthUser } from '@/types/auth'

export function useAdminProfilePage() {
  const profileForm = reactive({
    displayName: '',
    email: '',
    avatar: '',
    avatarId: null as number | null,
    gender: 'unknown' as AuthUser['gender'],
    bio: '',
    website: '',
    role: 'user' as AuthUser['role'],
  })
  const passwordForm = reactive({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  })
  const savingProfile = ref(false)
  const savingPassword = ref(false)
  const profileError = ref('')
  const passwordError = ref('')
  const profileSuccess = ref('')
  const passwordSuccess = ref('')

  const currentUser = computed(() => authState.user)
  const roleLabel = computed(() => {
    if (currentUser.value?.role === 'admin') {
      return '管理员'
    }

    if (currentUser.value?.role === 'editor') {
      return '编辑'
    }

    return '普通用户'
  })
  const canEditRole = computed(() => authState.isAdmin)

  function syncProfileForm() {
    profileForm.displayName = currentUser.value?.displayName ?? ''
    profileForm.email = currentUser.value?.email ?? ''
    profileForm.avatar = currentUser.value?.avatar ?? ''
    profileForm.avatarId = currentUser.value?.avatarId ?? null
    profileForm.gender = currentUser.value?.gender ?? 'unknown'
    profileForm.bio = currentUser.value?.bio ?? ''
    profileForm.website = currentUser.value?.website ?? ''
    profileForm.role = currentUser.value?.role ?? 'user'
  }

  async function submitProfile() {
    profileError.value = ''
    profileSuccess.value = ''

    if (!profileForm.displayName.trim()) {
      profileError.value = '显示名称不能为空'
      return
    }

    if (!profileForm.email.trim()) {
      profileError.value = '邮箱不能为空'
      return
    }

    savingProfile.value = true

    try {
      await updateCurrentUserProfile({
        displayName: profileForm.displayName.trim(),
        email: profileForm.email.trim(),
        avatarId: profileForm.avatarId,
        bio: profileForm.bio.trim(),
        website: profileForm.website.trim(),
        gender: profileForm.gender,
        role: canEditRole.value ? profileForm.role : (currentUser.value?.role ?? 'user'),
      })
      profileSuccess.value = '个人资料已更新'
      syncProfileForm()
    } catch (error) {
      profileError.value = error instanceof Error ? error.message : '资料保存失败'
    } finally {
      savingProfile.value = false
    }
  }

  async function submitPassword() {
    passwordError.value = ''
    passwordSuccess.value = ''

    if (!passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword) {
      passwordError.value = '请完整填写密码字段'
      return
    }

    if (passwordForm.nextPassword.length < 6) {
      passwordError.value = '新密码至少需要 6 位'
      return
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      passwordError.value = '两次输入的新密码不一致'
      return
    }

    savingPassword.value = true

    try {
      await updateCurrentUserPassword(passwordForm.currentPassword, passwordForm.nextPassword)
      passwordForm.currentPassword = ''
      passwordForm.nextPassword = ''
      passwordForm.confirmPassword = ''
      passwordSuccess.value = '密码已更新'
    } catch (error) {
      passwordError.value = error instanceof Error ? error.message : '密码更新失败'
    } finally {
      savingPassword.value = false
    }
  }

  watch(currentUser, syncProfileForm, { immediate: true })

  return {
    currentUser,
    roleLabel,
    canEditRole,
    profileForm,
    passwordForm,
    savingProfile,
    savingPassword,
    profileError,
    passwordError,
    profileSuccess,
    passwordSuccess,
    submitProfile,
    submitPassword,
  }
}
