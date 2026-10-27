<script setup lang="ts">
import type {Appearance} from '~/../shared/appearance';
const preference=useAppearance();
const options:Array<{value:Appearance;label:string}>=[{value:'light',label:'Light'},{value:'dark',label:'Dark'},{value:'auto',label:'Auto'}];
</script>
<template>
    <div class="appearance-toggle" role="group" aria-label="Appearance">
        <button v-for="option in options" :key="option.value" type="button" :aria-pressed="preference===option.value" :title="option.value==='auto'?'Follow device appearance':`${option.label} appearance`" @click="preference=option.value">{{option.label}}</button>
    </div>
</template>
<style scoped>
.appearance-toggle{display:inline-flex;flex-shrink:0;align-items:center;gap:2px;padding:3px;background:var(--surface);border:1px solid var(--line);border-radius:9px;}
button{border:0;border-radius:6px;padding:7px 9px;background:transparent;color:var(--muted);font-size:0.76rem;cursor:pointer;}
button:hover{background:var(--surface-hover);color:var(--text);}
button[aria-pressed="true"]{background:var(--nav-active);color:var(--purple-light);font-weight:700;}
button:focus-visible{outline:2px solid var(--purple);outline-offset:2px;}
</style>
