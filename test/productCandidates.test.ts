import {expect,it} from 'vitest';
import type {ProductRecord} from '../shared/domain';
import {candidateProducts,matchingProducts,resolveProduct} from '../shared/productMatching';
const row=(name:string,code:string,flavor='Vanilla',form='ready-to-feed')=>({name,productCode:code,flavor,form,formulaDescription:`${name.replace('Std','Standard')}, 8.45 fl oz RTF, ${flavor}`}) as ProductRecord;
const kate=[row('Kate Farms Pediatric Std 1.2','851823006997'),row('Kate Farms Pediatric Std 1.2','811112030713','Chocolate'),row('Kate Farms Pediatric Peptide 1.5','851823006201')];
it('associates the actual submitted Kate Farms name with both exact descriptions',()=>{
    expect(candidateProducts(kate,{name:'Kate Farms Pediatric Std 1.2 Cal',form:'ready-to-feed'}).map(r=>r.productCode)).toEqual(['851823006997','811112030713']);
    expect(matchingProducts(kate,{name:'Kate Farms Pediatric Standard 1.2 Cal',flavor:'Vanilla'}).map(r=>r.productCode)).toEqual(['851823006997']);
});
it('suggests strengths for a broader submitted formula without arbitrarily resolving one',()=>{
    const rows=[row('Boost Kid Essentials 1.0','B1'),row('Boost Kid Essentials 1.5','B2'),row('Boost Breeze','OTHER')];
    expect(candidateProducts(rows,{name:'Boost Kid Essentials'}).map(r=>r.productCode)).toEqual(['B1','B2']);
    expect(resolveProduct(rows,{name:'Boost Kid Essentials'})).toBeUndefined();
    expect(candidateProducts(rows,{name:'Boost Kid Essentials 1.5'}).map(r=>r.productCode)).toEqual(['B2']);
});
it('uses descriptions when the catalog name differs and keeps form/flavor restrictions',()=>{
    const rows=[{...row('Internal catalog name','A'),formulaDescription:'Kate Farms Pediatric Standard 1.2, 8.45 fl oz RTF, Vanilla'},row('Kate Farms Pediatric Std 1.2','B','Chocolate'),row('Kate Farms Pediatric Std 1.2','C','Vanilla','powder')];
    expect(candidateProducts(rows,{name:'Kate Farms Pediatric Std 1.2 Cal',form:'ready-to-feed',flavor:'Vanilla'}).map(r=>r.productCode)).toEqual(['A']);
});
it('does not suggest unrelated formula families or guess from blank text',()=>{
    expect(candidateProducts(kate,{name:'Kate Farms Pediatric Standard 1.5'})).toEqual([]);
    expect(candidateProducts(kate,{name:''})).toEqual([]);
});
it('matches shortened names with omitted words and embedded flavor',()=>{
    const rows=[row('Enfamil NeuroPro Enfacare','E'),row('Alfamino Junior','A'),row('Alfamino Junior','B','Unflavored')];
    expect(candidateProducts(rows,{name:'Enfamil Enfacare'}).map(r=>r.productCode)).toEqual(['E']);
    expect(candidateProducts(rows,{name:'Alfamino Jr, Vanilla'}).map(r=>r.productCode)).toEqual(['A']);
});
it('includes products whose description supplies the requested flavor despite incorrect catalog flavor',()=>{
    const rows=[{...row('PediaSure 1.5 Cal','P','Unflavored'),formulaDescription:'PediaSure 1.5 Cal, 8 fl oz RTF, Vanilla, Bottle'},row('PediaSure 1.5 Cal','C','Chocolate')];
    expect(candidateProducts(rows,{name:'PediaSure 1.5 Cal',flavor:'Vanilla'}).map(r=>r.productCode)).toEqual(['P']);
});
it('does not discard explicit strength or clinical qualifiers when matching shortened names',()=>{
    const rows=[row('Kate Farms Pediatric Standard 1.2','A'),row('Kate Farms Pediatric Peptide 1.5','B'),row('PediaSure Standard 1.0 with Fiber','C')];
    expect(candidateProducts(rows,{name:'Kate Farms Standard 1.2'}).map(r=>r.productCode)).toEqual(['A']);
    expect(candidateProducts(rows,{name:'Kate Farms Standard 1.5'})).toEqual([]);
    expect(candidateProducts(rows,{name:'PediaSure 1.5 with Fiber'})).toEqual([]);
});
it('offers every flavor of the requested Kate Farms formula in the drawer',async()=>{
    const {useAuthorizationEditor}=await import('../app/features/requests/composables/useAuthorizationEditor');
    const products=kate.map((p,index)=>({...p,id:index+1}));
    const {authorizationProducts:list}=useAuthorizationEditor({},()=>products,()=>null);
    expect(list({productName:'Kate Farms Pediatric Std 1.2 Cal',productForm:'ready-to-feed',flavor:'Vanilla'}).map((p:ProductRecord)=>p.productCode)).toEqual(['851823006997','811112030713']);
});
