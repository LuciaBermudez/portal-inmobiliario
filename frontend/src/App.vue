<script setup lang="ts">
import { useRouter } from 'vue-router';
import ToastHost from '@/components/ToastHost.vue';
import { useOnline } from '@/composables/useOnline';
import { useNotificationsStore } from '@/stores/alerts';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const notifications = useNotificationsStore();
const router = useRouter();
const online = useOnline();

async function logout() {
  await auth.logout();
  await router.push({ name: 'search' });
}
</script>

<template>
  <header class="navbar">
    <div class="navbar__left">
      <RouterLink to="/" class="brand">
        <img src="/icon.svg" alt="" width="22" height="22" />
        <span>Portal Inmobiliario</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/">Inmuebles</RouterLink>
        <RouterLink v-if="auth.hasRole('admin', 'agent')" to="/imports">Carga masiva</RouterLink>
        <RouterLink v-if="auth.isAuthenticated" to="/alerts" class="nav__alerts">
          Alertas
          <span v-if="notifications.unreadCount > 0" class="pill" :aria-label="`${notifications.unreadCount} sin leer`">
            {{ notifications.unreadCount }}
          </span>
        </RouterLink>
      </nav>
    </div>
    <div class="nav nav--session">
      <template v-if="auth.user">
        <span class="nav__user">{{ auth.user.name }}</span>
        <button class="nav__button" type="button" @click="logout">Salir</button>
      </template>
      <template v-else>
        <RouterLink to="/login">Entrar</RouterLink>
        <RouterLink to="/register">Registrarse</RouterLink>
      </template>
    </div>
  </header>

  <div v-if="!online" class="offline" role="status">
    Sin conexión: verás los últimos datos guardados y el mapa en caché.
  </div>

  <main class="page">
    <RouterView />
  </main>

  <footer class="footer">Portal Inmobiliario · Cali</footer>

  <ToastHost />
</template>
