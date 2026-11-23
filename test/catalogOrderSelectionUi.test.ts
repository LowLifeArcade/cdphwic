import {expect,it} from 'vitest';
import type {ProductRecord,RequestRecord} from '../shared/domain';
async function fixture(flag?: string, catalogName = 'Formula') {
    const { useAuthorizationEditor } = await import('../app/features/requests/composables/useAuthorizationEditor');
    const products = [{ id: 1, name: catalogName, form: 'powder', productCode: '001', unitsPerCase: 6, mcKessonPo: flag }] as ProductRecord[];
    const draft: Partial<RequestRecord> = { requestedFormulas: [{ productName: 'Formula', productForm: 'powder', ouncesPrescribed: 8 }], formulaAuthorizations: [{ productName: 'Formula', productForm: 'powder', unitsToOrder: 0, benefitIssuances: [] }] };
    const api = useAuthorizationEditor(draft, () => products, () => draft);
    return { draft, api };
}
it.each(['chooseAuthorizationProduct','enterProductNumber'])('applies catalog defaults through %s and retains them after quantity entry',async method=>{
    for(const [flag,special] of [['No',true],['Yes',false]] as const){
        const {draft,api}=await fixture(flag);
        api[method](0,'001');
        expect(draft.formulaOrders?.[0]?.specialOrder).toBe(special);
        draft.formulaAuthorizations![0]!.unitsToOrder=12;
        api.recalculateCasesFromUnitsToOrder(0);
        expect(draft.formulaAuthorizations?.[0]).toMatchObject({approvedCases:2,standardCases:special?0:2,specialOrderCases:special?2:0});
    }
});

it('populates a number-only catalog match and applies its Special Order default',async()=>{
    const {draft,api}=await fixture('No','Kate Farms Pediatric Std 1.2 Cal');
    api.enterProductNumber(0,'001');
    expect(draft.formulaAuthorizations?.[0]).toMatchObject({productName:'Formula',formulaName:'Kate Farms Pediatric Std 1.2 Cal',productCode:'001',unitsPerCase:6});
    expect(draft.formulaOrders?.[0]?.specialOrder).toBe(true);
});
