import type { Role } from '@portal/shared';
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    roles?: Role[];
    guestOnly?: boolean;
    title?: string;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [

    { path: '/', name: 'search', component: () => import('@/views/SearchView.vue'), meta: { title: 'Buscar' } },
    {
      path: '/listings/:id',
      name: 'listing',
      component: () => import('@/views/ListingDetailView.vue'),
      props: true,
      meta: { title: 'Propiedad' },
    },
    {
      path: '/imports',
      name: 'imports',
      component: () => import('@/views/ImportsView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'agent'], title: 'Carga masiva' },
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: () => import('@/views/AlertsView.vue'),
      meta: { requiresAuth: true, title: 'Alertas por zona' },
    },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true, title: 'Ingresar' } },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { guestOnly: true, title: 'Crear cuenta' },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
});


router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.ensureSession();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.roles && !auth.hasRole(...to.meta.roles)) {
    useToastStore().push('error', 'No tienes permisos para acceder a esa sección');
    return { name: 'search' };
  }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'search' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Portal Inmobiliario` : 'Portal Inmobiliario';
});
