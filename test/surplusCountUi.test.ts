import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const page=readFileSync(new URL('../app/pages/surplus.vue',import.meta.url),'utf8');

describe('Formula Surplus agency count and lot groups',()=>{
 it('offers agency count entry with clinic and staff/date attestation',()=>{
  expect(page).toContain('Record Surplus');
  expect(page).toContain("data?.user.agencyId");
  expect(page).toContain("'/api/surplus/counts'");
  expect(page).toContain('v-model="input.confirmerName"');
  expect(page).toContain('v-model="input.date"');
  expect(page).toContain('v-model="input.clinicId"');
  expect(page).toContain('v-model="formulaSearch" class="form-input" type="search" placeholder="Search formula name or description"');
  expect(page).toContain('product.formulaDescription?.trim()');
  expect(page).toContain('v-if="!input.formulaName" class="surplus-formula-options"');
  expect(page).toContain('@click="selectSurplusProduct(product)">{{ surplusProductLabel(product) }}');
  expect(page).toContain('v-model="input.form" class="form-input" required :disabled="!surplusAvailableForms.length" @change="selectSurplusForm"');
  expect(page).toContain('surplusCatalogVariants(productData.value?.products??[])');
  expect(page).toContain('input.form=\'\';input.flavor=\'\';');
  expect(page).toContain('Select a flavor');
  expect(page).toContain('Package size');
  expect(page).toContain('v-for="packaging in surplusAvailablePackagings"');
  expect(page).toContain('packaging:input.packaging');
  expect(page).not.toContain('v-model="input.formulaName"\n');
  expect(page).toContain('surplusMovementReason(h.reason)');
 });

 it('summarizes multi-expiration inventory groups and retains individual lot actions',()=>{
  expect(page).toContain('groupSurplusLots(activeLots.value)');
  expect(page).toContain("row.kind==='group'");
  expect(page).toContain('row.group.earliestExpiration');
  expect(page).toMatch(/\{\{expandedInventoryGroups\[row\.group\.key\]\?'Hide':'View'\}\}\s*\{\{row\.group\.lots\.length\}\} expiration lots/);
  expect(page).toContain('useInRequest(row.lot)');
  expect(page).toContain("start('edit-inventory',row.lot)");
  expect(page).toContain('showHistory(selected)');
 });

 it('shows a recorded date for each lot and warns agencies before saving short-dated surplus',()=>{
  expect(page).toContain('<th>Date Recorded</th>');
  expect(page).toContain('row.lot.recordedAt');
  expect(page).toContain('v-if="recordedSurplusAction" role="status"');
  expect(page).toContain("if (disposition === 'destruction') return 'Destruction required.");
  expect(page).toContain("if (disposition === 'donation') return 'Donation required.");
 });

 it('offers agencies audited donation and destruction actions only for eligible stock',()=>{
  expect(page).toContain("daysRemaining(selected.expirationDate,localDate())>=45");
  expect(page).toContain("daysRemaining(selected.expirationDate,localDate())<=60");
  expect(page).toContain("start('donate',selected)");
  expect(page).toContain("start('destroy',selected)");
  expect(page).toContain('Staff name attesting to donation');
  expect(page).toContain('Donation date');
 });

 it('allows corrections from history while leaving original movement rows visible',()=>{
  expect(page).toContain('h.correctable');
  expect(page).toContain("start('correct-entry',selected,h)");
  expect(page).toContain('v-model="correctedVariantSelection"');
  expect(page).toContain('v-model="input.correctedExpirationDate"');
  expect(page).toContain('h.effective_quantity');
  expect(page).toContain('h.actor_name');
  expect(page).toContain('h.correction_target');
  expect(page).toContain('correctionOf:correctionTarget.value.id');
  expect(page).toContain('Correction explanation');
  expect(page).toContain('class="correction-form"');
  expect(page).toContain('class="history-entry correction-original-entry"');
  expect(page).toContain('class="correction-fields"');
 });

 it('shows the Record Surplus action in Inventory and reserves Counts & Forecasts for reviewers',()=>{
  expect(page).toContain('Counts &amp; Forecasts');
  expect(page).toContain('Pending Agency Counts for Review');
  expect(page).toContain('v-if="pendingAgencyCounts.length"');
  expect(page).toContain('These counts were submitted by Local Agencies');
  expect(page).toContain('Anticipated Surplus');
  expect(page).toContain('start(\'new\')');
  expect(page).toContain('v-if="reviewer" class="surplus-counts-section"');
  expect(page).toContain('v-if="data && !reviewer" class="button" type="button" @click="start(\'new\')">Record Surplus</button>');
  expect(page).not.toContain('@click="start(\'new\')">Record physical count</button>');
  expect(page).not.toContain("start('reconcile',row.lot)");
 });

 it('renders Inventory and Transfers as color-coded accessible tabs',()=>{
  expect(page).toContain('role="tablist"');
  expect(page).toContain('role="tab"');
  expect(page).toContain(':aria-selected="view===\'inventory\'"');
  expect(page).toContain('role="tabpanel"');
  expect(page).toContain('.surplus-tab[aria-selected="true"]');
  expect(page).toContain("useNuxtData<{ count: number }>('pending-transfer-count')");
  expect(page).toContain('v-if="pendingInventoryTabCount" class="surplus-tab-badge"');
  expect(page).toContain('v-if="pendingTransferTabCount" class="surplus-tab-badge"');
  expect(page).toContain('moveSurplusTab');
  expect(page).not.toContain('id="counts-tab"');
 });

 it('emphasizes lot expiration and unit counts and places count actions below the stable tab row',()=>{
  expect(page).toContain('<h2>Available Inventory</h2>');
  expect(page).toContain('class="inventory-expiration"');
  expect(page).toContain('class="inventory-quantity"');
  expect(page).toContain('class="counts-actions"');
  expect(page).toContain('.counts-actions {display:flex;');
  expect(page.indexOf('class="surplus-views"')).toBeLessThan(page.indexOf('class="counts-actions"'));
 });

 it('does not report empty inventory while the inventory request is loading or failed',()=>{
  expect(page).toContain('status===\'pending\'&&!data');
  expect(page).toContain('Loading inventory…');
  expect(page).toContain(`v-if="status === 'error' && !data"`);
  expect(page).toContain(`v-else-if="status==='success'">No matching inventory.`);
  expect(page).toContain('@click="refresh()">Retry</button>');
  expect(page).toContain('retry: 2');
  expect(page).toContain('HTTP {{ error.statusCode }}');
 });

 it('opens one role-aware inventory action popup instead of the More dropdown',()=>{
  expect(page).toContain("start('edit-inventory',row.lot)\">Edit</button>");
  expect(page).toContain("modal==='edit-inventory'");
  expect(page).toContain("'edit-inventory':'Edit Inventory'");
  expect(page).toContain("!['history','edit-inventory','use-request'].includes(modal)");
  expect(page).toContain('class="history-product"');
  expect(page).toContain('Inventory History</button>');
  expect(page).toContain("start('assign-clinic',selected)");
  expect(page).toContain("start('deduct',selected)");
  expect(page).toContain("start('correct-expiry',selected)");
  expect(page).not.toContain('<summary>More</summary>');
 });

 it('formats the Use in Request popup like the inventory edit popup',()=>{
  expect(page).toContain("'use-request':'Use in Request'");
  expect(page).toContain("!['history','edit-inventory','use-request'].includes(modal)");
  expect(page).toContain('Find Request<input');
  expect(page).toContain('Destination Request<select');
  expect(page).toContain('Select a Request</option>');
 });

 it('shows the agency name in inventory product details only for reviewer views',()=>{
  expect(page).toContain('<span v-if="reviewer">{{agencyName(row.group.agencyId)}}</span>');
  expect(page).toContain('row.group.clinicName');
 });

 it('formats inventory history dates and product details consistently',()=>{
  expect(page).toContain('{{formatDisplayDate(h.created_at)}}');
  expect(page).toContain('[selected.formulaName,formulaFormLabel(selected.form),selected.flavor,selected.packaging].filter(Boolean).join(\' \')');
  expect(page).toContain('function movementLabel');
  expect(page).toContain("reconcile:'Physical count'");
  expect(page).toContain('class="history-entry-heading"');
  expect(page).toContain("history:'Inventory History'");
  expect(page).toContain('On Hand {{h.on_hand}}');
  expect(page).toContain('formatDisplayDate(r.counted_at)');
  expect(page).not.toContain('{{ h.created_at }}');
 });
});
