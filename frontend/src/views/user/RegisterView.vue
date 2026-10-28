<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const form = reactive({ name: '', email: '', password: '' });

async function submit() {
  if (await auth.register(form)) await router.replace('/');
}
</script>

<template>
  <section class="auth">
    <h1 class="h1">Crear cuenta</h1>
    <form class="card form" @submit.prevent="submit">
      <label>Nombre <input v-model.trim="form.name" autocomplete="name" required minlength="2" maxlength="100" /></label>
      <label>Correo <input v-model.trim="form.email" type="email" autocomplete="email" required /></label>
      <label>
        Contraseña (mínimo 8)
        <input v-model="form.password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" />
      </label>
      <p v-if="auth.status === 'error'" class="error" role="alert">{{ auth.error }}</p>
      <button class="btn btn--primary btn--block" type="submit" :disabled="auth.status === 'loading'">Registrarme</button>
    </form>
    <p class="muted auth__hint">¿Ya tienes cuenta? <RouterLink to="/login">Inicia sesión</RouterLink></p>
  </section>
</template>
