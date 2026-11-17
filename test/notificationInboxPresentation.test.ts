import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';

const inbox=readFileSync(new URL('../app/components/NotificationInbox.vue',import.meta.url),'utf8');

it('closes notifications from the backdrop and Escape key',()=>{
 expect(inbox).toContain('class="notice-backdrop"');
 expect(inbox).toContain('@click="open=false"');
 expect(inbox).toContain("event.key==='Escape'");
});

it('uses participant names and concise summaries in request notifications',()=>{
 expect(inbox).toContain('{{n.participant_name ||');
 expect(inbox).not.toContain('Request #{{n.request_id}}');
 expect(inbox).toContain('Shipment details and authorization are ready.');
 expect(inbox).toContain('notificationTitle(n)');
 expect(inbox).toContain('notificationNature(n)');
 expect(inbox).not.toContain('class="notice-new"');
 expect(inbox).not.toContain("'Extension'");
});
