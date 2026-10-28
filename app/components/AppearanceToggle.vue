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
button{border:0;border-radius:6px;padding:7px 9px;background:transparent;color:var(--button-neutral-text);font-size:calc(0.76rem + 2px);cursor:pointer;}
button:hover{background:var(--button-neutral-hover);color:var(--button-neutral-text);}
button[aria-pressed="true"]{background:var(--button-secondary-bg);color:var(--button-secondary-text);font-weight:700;}
button:focus-visible{outline:2px solid #0077cf;outline-offset:2px;}
</style>
