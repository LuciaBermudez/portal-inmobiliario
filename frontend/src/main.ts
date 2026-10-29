import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'maplibre-gl/dist/maplibre-gl.css';
import './assets/styles/main.css';
import App from './App.vue';
import { router } from './router';
import { configureAuth } from './api/http';
import { useAuthStore } from './stores/auth';
import { startRealtime } from './realtime/socket';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);

const auth = useAuthStore(pinia);
configureAuth({ getToken: () => auth.accessToken, refresh: auth.refresh });

startRealtime(pinia);
app.use(router);
app.mount('#app');