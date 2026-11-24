import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';

const inbox=readFileSync(new URL('../app/components/NotificationInbox.vue',import.meta.url),'utf8');

it('closes notifications from the backdrop and Escape key',()=>{
 expect(inbox).toContain('class="notice-backdrop"');
 expect(inbox).toContain('@click="open=false"');
 expect(inbox).toContain("event.key==='Escape'");
});

it('uses participant names and concise summaries in request notifications',()=>{
 expect(inbox).toContain('function notificationTitle(n:any)');
 expect(inbox).toContain("join(' | ')");
 expect(inbox).toContain('n.participant_name');
 expect(inbox).not.toContain('Request #{{n.request_id}}');
 expect(inbox).toContain('Shipment details and authorization are ready.');
 expect(inbox).toContain('notificationTitle(n)');
 expect(inbox).toContain('notificationNature(n)');
 expect(inbox).not.toContain('class="notice-new"');
 expect(inbox).not.toContain("'Extension'");
});

it('shows an anticipated special-order ETA until shipment dispatch, then the actual ETA',()=>{
 expect(inbox).toContain("'request-special-order':'Special Order Delivery Update'");
 expect(inbox).toContain('Anticipated ETA: {{formatDisplayDate(n.anticipated_eta)}}');
 expect(inbox).toContain('Actual ETA: {{formatDisplayDate(n.actual_eta)}}');
});
