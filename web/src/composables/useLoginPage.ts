import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { loginWithPassword } from '@/services/auth'
import { authState } from '@/stores/authStore'

export function useLoginPage() {
  const router = useRouter()
  const route = useRoute()
  const loading = ref(false)
  const errorMessage = ref('')
  const form = reactive({
    username: '',
    password: '',
  })

  async function submitLogin() {
    if (!form.username.trim() || !form.password) {
      errorMessage.value = '请输入用户名和密码'
      return
    }

    loading.value = true
    errorMessage.value = ''

    try {
      const session = await loginWithPassword(form.username, form.password)
      const redirect = String(route.query.redirect ?? '')

      if (redirect) {
        await router.replace(redirect)
        return
      }

      await router.replace(session.user.role === 'admin' ? { name: 'admin-dashboard' } : { name: 'home' })
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '登录失败'
    } finally {
      loading.value = false
    }
  }

  return {
    authState,
    loading,
    errorMessage,
    form,
    submitLogin,
  }
}
