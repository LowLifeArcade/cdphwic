import { expect, it } from 'vitest';
import { createSSRApp, h, type Component } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { loadComponent } from './helpers/vueComponent';
import { blankRequestForm } from '../app/features/requests/requestForm';
import * as breastfeeding from '../shared/breastfeeding';
import * as phone from '../shared/phone';

function sectionApp(component: Component, props: Record<string, unknown>) {
    const app = createSSRApp(component, props);
    app.component('RequestHistory', { render: () => h('section', { 'aria-label': 'Prior requests' }) });
    return app;
}

it('renders participant insurance and breastfeeding conditional fields and limits additional months', async () => {
    const component = await loadComponent(new URL('../app/features/requests/components/RequestParticipantFields.vue', import.meta.url), { '#shared/breastfeeding': breastfeeding });
    const form = { ...blankRequestForm(), medicalStatus: 'yes', breastfeedingStatus: 'Discontinued BF' };
    const html = await renderToString(sectionApp(component, { form, requestedMonths: ['01', '02', '03'], benefitMonthOptions: [{ value: '01', label: 'JAN', selected: true }, { value: '04', label: 'APR', selected: false }] }));
    expect(html).toContain('id="medi-cal-status"');
    expect(html).toMatch(/id="breastfeeding".*?<\/select>\s*<div[^>]*>\s*<label[^>]*for="breastfeeding-discontinued-date"/s);
    expect(html).toMatch(/type="checkbox"[^>]*disabled/);
    const empty = await renderToString(sectionApp(component, { form: blankRequestForm(), requestedMonths: [], benefitMonthOptions: [] }));
    expect(empty).not.toContain('id="medi-cal-status"');
    expect(empty).not.toContain('Date BF Discontinued');
});
it('renders Breastfeeding before the separate Prior Requests panel', async () => {
    const component = await loadComponent(new URL('../app/features/requests/components/RequestParticipantFields.vue', import.meta.url), { '#shared/breastfeeding': breastfeeding });
    const render = (requestKind: 'new' | 'extension') => renderToString(sectionApp(component, {
        form: { ...blankRequestForm(), requestKind }, requestedMonths: [], benefitMonthOptions: [],
    }));
    expect(await render('extension')).toMatch(/id="request-type".*?id="breastfeeding".*?class="benefit-prior-requests".*?aria-label="Prior requests"/s);
    expect(await render('new')).not.toContain('aria-label="Prior requests"');
});
it('preserves required provider signature, date and phone controls', async () => {
    const component = await loadComponent(new URL('../app/features/requests/components/RequestProviderFields.vue', import.meta.url), { '#shared/phone': phone });
    const html = await renderToString(sectionApp(component, { form: blankRequestForm() }));
    expect(html).toMatch(/id="doctor-signed-off"[^>]*required/);
    expect(html).toMatch(/id="prescription-signed-date"[^>]*required/);
    expect(html).toContain('aria-label="Medical office/clinic address"');
    expect(html).toContain('type="tel"');
});
it('shows staff review fields only when the provider left food restrictions unmarked', async () => {
    const component = await loadComponent(new URL('../app/features/requests/components/RequestFoodRestrictionFields.vue', import.meta.url));
    const render = (form: ReturnType<typeof blankRequestForm>) => renderToString(sectionApp(component, { form, validationAttempted: true }));
    const empty = await render(blankRequestForm());
    expect(empty).toContain('aria-invalid="true"');
    expect(empty).not.toContain('id="wic-staff-name"');
    const reviewed = await render({ ...blankRequestForm(), wicFoodRestrictions: 'not-indicated', wicStaffFoodRestrictions: 'restricted' });
    expect(reviewed).toContain('id="wic-staff-name"');
    expect(reviewed).toContain('id="wic-staff-notes"');
});
