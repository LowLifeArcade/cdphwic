<script setup lang="ts">
const props=defineProps<{noticeId:string;readAt?:string;incoming:boolean}>();
const emit=defineEmits<{visible:[noticeId:string]}>();
const marker=ref<HTMLElement>();let observer:IntersectionObserver|undefined;
function observe(){
 observer?.disconnect();
 if(!marker.value||!props.incoming||props.readAt||document.hidden)return;
 observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&!document.hidden){observer?.disconnect();emit('visible',props.noticeId);}},{threshold:1});
 observer.observe(marker.value);
}
onMounted(()=>{observe();document.addEventListener('visibilitychange',observe);window.addEventListener('focus',observe);});
watch(()=>[props.noticeId,props.readAt,props.incoming],()=>nextTick(observe));
onBeforeUnmount(()=>{observer?.disconnect();document.removeEventListener('visibilitychange',observe);window.removeEventListener('focus',observe);});
</script>
<template><span ref="marker" class="message-read-marker"><slot /></span></template>
<style scoped>.message-read-marker{display:inline-block;max-width:100%;}</style>
