import { expect, it } from 'vitest';
import { createSSRApp, type Component } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { loadComponent } from './helpers/vueComponent';
import * as presentation from '../shared/requestPresentation';
import * as breastfeeding from '../shared/breastfeeding';
import * as phone from '../shared/phone';
import * as formulas from '../shared/formulaEntries';

function detailsApp(component: Component, props: Record<string, unknown>) {
    const app = createSSRApp(component, props);
    app.component('AdditionalFormulaFields', { render: () => null });
    app.component('RequestDiagnosisEditor', { render: () => null });
    return app;
}
const request = { id: 1, agencyId: 10, agencyMemberId: 100, participantName: 'Synthetic', productName: 'Fortini', status: 'opened', doctorPrintedName: 'Example Provider', doctorHasSignedOff: true, wicFoodRestrictions: 'none' };
const component = () => loadComponent(new URL('../app/features/requests/components/RequestMedicalDetails.vue', import.meta.url), {
    '#shared/requestPresentation': presentation, '#shared/breastfeeding': breastfeeding,
    '#shared/phone': phone, '#shared/formulaEntries': formulas,
});
it('keeps medical sections ordered and read-only for agency viewers', async () => {
    const html = await renderToString(detailsApp(await component(), { request, draft: {}, canStaffEdit: false, saving: false, editingSection: null, editableDiagnoses: [], editableFormulas: [], ageMilestoneAlerts: [], benefitMonths: [], error: '' }));
    expect([...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map(match => match[1])).toEqual(['Participant', 'Prescription', 'WIC Food Restrictions', 'Health Care Provider']);
    expect(html).toContain('Example Provider'); expect(html).toContain('Verified on medical documentation');
    expect(html).not.toContain('>Edit</button>'); expect(html).not.toContain('<input');
});
it('renders staff editing for the selected section without editing unrelated sections', async () => {
    const html = await renderToString(detailsApp(await component(), { request, draft: { ...request, participantFirstName: 'First' }, canStaffEdit: true, saving: true, editingSection: 'participant', editableDiagnoses: [], editableFormulas: [], ageMilestoneAlerts: [], benefitMonths: [], error: '' }));
    expect(html).toContain('autocomplete="given-name"'); expect(html).toContain('value="First"');
    expect(html).toContain('Save Section'); expect(html).toContain('disabled');
    expect(html).not.toContain('class="form-grid compact-form-grid provider-editor"');
});
