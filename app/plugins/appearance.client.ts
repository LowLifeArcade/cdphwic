import {normalizeAppearance,resolveAppearance} from '~/../shared/appearance';
export default defineNuxtPlugin((nuxtApp)=>{
    const preference=useAppearance();
    const system=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>document.documentElement.setAttribute('data-theme',resolveAppearance(normalizeAppearance(preference.value),system.matches));
    const stop=watch(preference,apply,{immediate:true,flush:'sync'});
    system.addEventListener('change',apply);
    nuxtApp.vueApp.onUnmount(()=>{stop();system.removeEventListener('change',apply);});
});
