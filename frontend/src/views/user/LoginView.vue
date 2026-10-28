<script setup lang="ts">
import { reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const form = reactive({ email: '', password: '' });

async function submit() {
  if (await auth.login(form)) {
    const redirect = typeof route.query['redirect'] === 'string' ? route.query['redirect'] : '/';
    await router.replace(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
  }
}
</script>

<template>
  <section class="auth">
    <h1 class="h1">Iniciar sesión</h1>
    <form class="card form" @submit.prevent="submit">
      <label>Correo <input v-model.trim="form.email" type="email" autocomplete="email" required /></label>
      <label>Contraseña <input v-model="form.password" type="password" autocomplete="current-password" required minlength="8" /></label>
      <p v-if="auth.status === 'error'" class="error" role="alert">{{ auth.error }}</p>
      <button class="btn btn--primary btn--block" type="submit" :disabled="auth.status === 'loading'">
        {{ auth.status === 'loading' ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
    <p class="muted auth__hint">¿No tienes cuenta? <RouterLink to="/register">Regístrate</RouterLink></p>
  </section>
</template>
