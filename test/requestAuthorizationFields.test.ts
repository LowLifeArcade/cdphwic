import { expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { loadComponent } from './helpers/vueComponent';
import * as editor from '../app/features/requests/composables/useAuthorizationEditor';
import * as mckesson from '../shared/mckessonPo';
import * as defaults from '../shared/catalogOrderDefaults';
import * as presentation from '../shared/requestPresentation';
import * as orders from '../shared/formulaOrders';

it('renders catalog fields and issuance quantities using the selected authorization without extra wrappers', async () => {
    const component = await loadComponent(new URL('../app/features/requests/components/RequestAuthorizationFields.vue', import.meta.url), {
        '../composables/useAuthorizationEditor': editor,
        '#shared/mckessonPo': mckesson,
        '#shared/catalogOrderDefaults': defaults,
        '#shared/requestPresentation': presentation,
        '#shared/formulaOrders': orders,
    });
    const authorization = { productName: 'Fortini', productForm: 'powder', productCode: '', benefitIssuances: [{ month: '2026-11', quantity: 8 }] };
    const draft = { formulaAuthorizations: [authorization] };
    const app = createSSRApp(component, { draft, request: draft, products: [], authorization, formulaIndex: 0, identity: 'internal', saving: false, splitOrderTypesEnabled: false });
    app.component('ProductVariantSelect', { render: () => h('select', { 'aria-label': 'Product' }) });
    const html = await renderToString(app);
    expect(html).toContain('Product Number'); expect(html).toContain('Units Per Case'); expect(html).toContain('Yield (fl oz)');
    expect(html).toContain('Formula 1 issuance quantity 1'); expect(html).toContain('value="8"');
    expect(html).toContain('Add issuance month'); expect(html).toContain('Total Units Approved');
});
