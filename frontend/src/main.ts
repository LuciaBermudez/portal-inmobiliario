import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import 'maplibre-gl/dist/maplibre-gl.css';
import './assets/main.css';
import App from './App.vue';
import { configureAuth } from './api/http';
import { startRealtime } from './realtime/socket';
import { router } from './router';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const auth = useAuthStore(pinia);
configureAuth({ getToken: () => auth.accessToken, refresh: () => auth.refresh() });
startRealtime(pinia);

app.use(router);
app.mount('#app');

registerSW({ immediate: true });
