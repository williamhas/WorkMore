import { createRouter, createWebHashHistory } from 'vue-router';
import OverviewPage from './pages/OverviewPage.vue';
import LibraryPage from './pages/LibraryPage.vue';
import SignInPage from './pages/SignInPage.vue';
import { isSignedIn, safeRedirect } from './auth.js';

// Hash URLs (/#/library) work on any static host, GitHub Pages included, with no
// server-side fallback to configure.
export const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        // `public` pages are reachable signed out and shown without the app header.
        { path: '/signin', name: 'signin', component: SignInPage, meta: { title: 'Sign in', public: true } },
        { path: '/', name: 'overview', component: OverviewPage, meta: { title: 'Overview' } },
        { path: '/library', name: 'library', component: LibraryPage, meta: { title: 'Types & Modules' } },
        { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
    scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
    if (to.meta.public) {
        // Already signed in: skip the sign-in page and go where they were headed.
        return isSignedIn.value && to.name === 'signin' ? safeRedirect(to.query.redirect) : true;
    }
    if (!isSignedIn.value) {
        return { name: 'signin', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
    }
    return true;
});

router.afterEach((to) => {
    document.title = to.meta.title ? to.meta.title + ' · WorkMore' : 'WorkMore';
});
