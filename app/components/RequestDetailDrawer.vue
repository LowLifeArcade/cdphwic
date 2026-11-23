<script setup lang="ts">
import RequestAuthorizationFields from '~/features/requests/components/RequestAuthorizationFields.vue';
import RequestMedicalDetails from '~/features/requests/components/RequestMedicalDetails.vue';
import { useAuthorizationEditor } from '~/features/requests/composables/useAuthorizationEditor';
import { useRequestConversationSync } from '~/features/requests/composables/useRequestConversationSync';

import { resolveProduct } from '~/../shared/productMatching';
import {unitLabel} from '~/../shared/quantityLabels';
import {issuanceTransferLots,setIssuanceTransferUnits} from '~/../shared/issuanceTransfers';
import {toRaw} from 'vue';
import {unreadOutgoingMessage,sameRequestOutsideMessages,type MoreInfoConversation} from '~/../shared/moreInfoMessages';
import {shipmentFormulaOptions,shipmentFormulaKey,resolveShipmentFormula,shipmentFormulaLabel,requireShipmentFormula} from '~/../shared/shipmentFormulas';
import type {Directive} from 'vue';
import {formatClinic,type ClinicRecord,blankClinicAddress,validateShipping} from '~/../shared/shipping';
const vTrackingSize:Directive<HTMLTextAreaElement>={mounted:fitTrackingNumbers,updated:fitTrackingNumbers};
function fitTrackingNumbers(input:HTMLTextAreaElement){input.style.height='auto';input.style.height=`${input.scrollHeight+input.offsetHeight-input.clientHeight}px`;}
import {formulaOrders,allFormulasSpecialOrder} from '~/../shared/formulaOrders';
import {formulaAuthorizations,formatIssuanceMonth,validateFormulaAuthorizations,type FormulaAuthorization} from '~/../shared/formulaAuthorizations';
import {transferAuthorizationError,transferEntryQuantity,transferCatalogUnitsPerCase,matchingTransferLot,surplusShipmentDraft,transferLotFormulaLabel} from '~/../shared/requestTransfers';
import {localDate,type SurplusLot} from '~/../shared/surplus';
import {canDeleteShipment,storedShipmentRows} from '~/../shared/shipmentDeletion';
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
import {compactShipmentSummary} from '~/../shared/shipmentSummary';
import {fulfillmentProgress,hasSplitOrderAllocation,shipmentFulfillmentType} from '~/../shared/fulfillmentAllocations';
import {formatCaseEquivalent} from '~/../shared/shipmentQuantities';
import {caseBalance} from '~/../shared/shipmentCaseTracking';
import { validateBreastfeeding } from '~/../shared/breastfeeding';
import {participantAgeAlerts} from '~/../shared/participantAgeAlerts';
import {validateRequestedMonths} from '~/../shared/requestMonthSelection';
import {editableRequestFormulas,requestFormulaUpdates} from '~/../shared/requestFormulaEditing';
import { formulaEntryName, validateFormulaEntry, validateFormulaSelection, type FormulaEntry } from '~/../shared/formulaEntries';
import { shipmentReceived, allShipmentsConfirmed, shipmentReceiptKey, type ShipmentReceiptSelection } from '~/../shared/shipmentReceipts';
import {staffShipmentRows,shipmentHasUnsentChanges} from '~/../shared/shipmentPublishing';
import {blankShipment,requestShipments,validateShipments,type RequestShipment} from '~/../shared/requestShipments';
import { formatDisplayDate, requestFormulas, participantNames, formulaFormLabel, providerAddressLines, submissionDateOnly } from '~/../shared/requestPresentation';
import { validateDiagnoses } from '~/../shared/diagnosisCatalog';
import {canEditSubmission,hasPendingMoreInfo,canResolveMoreInfo,canReplyToMoreInfo,canReopenMoreInfo,latestMoreInfoRequest} from '~/../shared/requestEditing';
import type { ProductRecord, RequestRecord } from '~/../shared/domain';
import { canGenerateAuthorizationForm } from '~/../shared/requestOperations';
import { normalizeRequestedMonths, validateRequestDetailNumbers, validateSurplusItems } from '~/../shared/requestDetailFields';
import { formatPhoneNumber, normalizePhoneNumber } from '~/../shared/phone';

type Agency = { name: string; shippingAddress: string; city: string; state: string; postalCode: string };
type Representative = { name: string; email: string; phone?: string };

const props = defineProps<{
    request: RequestRecord | null;
    products?: ProductRecord[];
    agency?: Agency;
    rep?: Representative;
    hasPrevious?: boolean;
    hasNext?: boolean;
}>();
const emit = defineEmits<{ close: []; previous: []; next: [] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const draft = reactive<Partial<RequestRecord>>({});
const transferRoute=useRoute();
const transferLabelsReady=reactive<Record<string,boolean>>({});
const shortcutApplied=ref('');
const shortcutNotice=ref('');
const saving = ref(false);
const documentOpen=ref(false);
const historyOpen=ref(false);
watch(()=>[props.request?.id,props.request?.prescriptionAttachment?.storageKey,identity.value],()=>{documentOpen.value=false;});
const error = ref('');
const staffSaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const photoNames = ref<string[]>([]);
const surplusRemovalIndex = ref<number | null>(null);
const editingSection = ref<'participant' | 'overview' | 'prescription' | 'food' | 'shipping' | null>(null);
const editableDiagnoses = ref<string[]>([]);
const editableFormulas = ref<FormulaEntry[]>([]);
const medicalDetails = ref<InstanceType<typeof RequestMedicalDetails>>();
const shippingSection = ref<HTMLElement>();
watch(() => [props.request?.id, identity.value], async () => {
    if (identity.value === 'agency' && props.request?.status === 'shipped') {
        await nextTick();
        shippingSection.value?.scrollIntoView({block:'start',behavior:'instant'});
        shippingSection.value?.focus({preventScroll:true});
    }
}, {immediate:true,flush:'post'});
const agencySaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const reportingSurplus = ref(false);
const showMoreInfoComposer=ref(false);
const editingReviewDecision=ref(false);
const approvingReviewDecision=ref(false);
const selectedReviewDecision=computed(()=>{
    if(pendingDecision.value==='denied')return 'deny';
    if(approvingReviewDecision.value)return 'approve';
    if(showMoreInfoComposer.value)return 'request-info';
    if(!editingReviewDecision.value)return null;
    if(props.request?.status==='denied')return 'deny';
    if(props.request?.status==='needs_info')return 'request-info';
    return hasSavedReviewDecision.value?'approve':null;
});
const hasSavedReviewDecision=computed(()=>props.request?.status==='denied'||props.request?.status==='approved'||props.request?.approved===true);
const denialReason=ref('');
const authorizationSection=ref<HTMLElement>();
const reviewDecisionSection=ref<HTMLElement>();
watch(()=>[props.request?.id,identity.value],()=>{showMoreInfoComposer.value=false;editingReviewDecision.value=false;pendingDecision.value=null;denialReason.value='';});
const pendingDecision = ref<'denied' | null>(null);
const sendingEtaIndex = ref<number | null>(null);
const editingEtaIndex = ref<number | null>(null);
const deletingShipmentIndex=ref<number|null>(null);
const receiptEditors=ref<Record<number,boolean>>({});
const shipmentDeleteNotice=ref('');
const shipmentPublishNotice=ref<{index:number;updated:boolean}|null>(null);
const shippingSaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const shipmentFeatures=shipmentFeatureFlags(useRuntimeConfig().public);
const splitOrderTypesEnabled=computed(()=>shipmentFeatures.splitOrderTypes||hasSplitOrderAllocation(props.request??{}));
const shipmentCaseBalance=computed(()=>(shipmentFeatures.caseReconciliation||shipmentFeatures.potentialOverDelivery)?caseBalance(props.request ?? {}):null);
const canStaffEdit = computed(() => identity.value === 'admin' || identity.value === 'internal');
const reviewerOpenDate = ref(localDate());
watch(() => props.request?.id, () => { reviewerOpenDate.value = localDate();editingEtaIndex.value=null;shipmentPublishNotice.value=null; });
const ageMilestoneAlerts = computed(() => participantAgeAlerts(props.request?.participantDob,reviewerOpenDate.value,30));
const moreInfoNotes=ref('');
const moreInfoNotice=ref('');
const editingMoreInfoId=ref('');
const editingMoreInfoNotes=ref('');
const deletingMoreInfoId=ref('');
const moreInfoReplies=ref<Record<string,string>>({});
const editingResponseId=ref('');const editingResponseNotes=ref('');
function startResponseEdit(response:NonNullable<MoreInfoConversation['responses']>[number]){editingResponseId.value=response.id;editingResponseNotes.value=response.notes;}
async function saveResponseEdit(noteId:string,responseId:string){await save({editMoreInfoMessage:{noteId,responseId,notes:editingResponseNotes.value.trim()}} as Partial<RequestRecord>);if(!error.value){editingResponseId.value='';editingResponseNotes.value='';moreInfoNotice.value='Message updated.';}}
function hasProtectedRequestDraft(){return !!(saving.value||editingSection.value||editingEtaIndex.value!==null||editingResponseId.value||editingMoreInfoId.value)||!!props.request&&!sameRequestOutsideMessages(draft,copyRequest(props.request));}
const { queueMessageRead, start: startConversationSync } = useRequestConversationSync({
    request: () => props.request,
    identity,
    draft,
    copyRequest,
    hasProtectedDraft: hasProtectedRequestDraft,
    load: async (id, who) => (await $fetch<{ request: RequestRecord }>(`/api/requests/${id}`, { headers: { 'x-demo-user': who } })).request,
    markRead: async (id, who, noticeIds, revision) => (await $fetch<{ request: RequestRecord }>(`/api/requests/${id}/more-info-read`, {
        method: 'POST', headers: { 'x-demo-user': who }, body: { noticeIds, revision },
    })).request,
    changed: () => window.dispatchEvent(new Event('request-messages-changed')),
    error: message => { moreInfoNotice.value = message; },
    reset: () => { editingResponseId.value = ''; editingResponseNotes.value = ''; },
});
onMounted(startConversationSync);

const canCollapseReviewDetails=computed(()=>props.request?.approved===true || props.request?.status==='approved');
const reviewDetailsExpanded=ref(true);
watch([()=>props.request?.id,canCollapseReviewDetails],()=>{reviewDetailsExpanded.value=!canCollapseReviewDetails.value;},{immediate:true});
async function sendMoreInfoReply(noteId:string){const notes=moreInfoReplies.value[noteId]?.trim();if(!notes)return;await save({moreInfoReply:{noteId,notes}} as Partial<RequestRecord>);if(!error.value){moreInfoReplies.value[noteId]='';moreInfoNotice.value=canStaffEdit.value?'Response sent to Local Agency.':'Response sent to CDPH/WIC.';}}
async function reopenForResubmission(){await save({reopenMoreInfo:true} as Partial<RequestRecord>);if(!error.value)moreInfoNotice.value='Reopened for Local Agency resubmission.';}
const canReopenForResubmission=computed(()=>props.request?canReopenMoreInfo(props.request):false);
async function resolveInformationRequest(){await save({resolveMoreInfo:true} as Partial<RequestRecord>);if(!error.value)moreInfoNotice.value='Resolved.';}
const hasUnresolvedMoreInfo=computed(()=>props.request?canResolveMoreInfo(props.request):false);
const hasActiveMoreInfoConversation=computed(()=>!!props.request?.moreInfoRequests?.some(entry=>canReplyToMoreInfo(props.request!,entry.id)));
const visibleMoreInfoRequests=computed(()=>props.request?.moreInfoRequests?.filter(entry=>!entry.deletedAt)??[]);
const canCollapseMoreInfo=computed(()=>visibleMoreInfoRequests.value.length>0&&visibleMoreInfoRequests.value.every(entry=>!!entry.resolvedAt)&&!showMoreInfoComposer.value&&!editingMoreInfoId.value&&!deletingMoreInfoId.value);
const moreInfoExpanded=ref(true);
watch([()=>props.request?.id,canCollapseMoreInfo],()=>{moreInfoExpanded.value=!canCollapseMoreInfo.value;},{immediate:true});
function startMoreInfoEdit(entry:NonNullable<RequestRecord['moreInfoRequests']>[number]){editingMoreInfoId.value=entry.id;editingMoreInfoNotes.value=entry.notes;deletingMoreInfoId.value='';}
async function saveMoreInfoNote(action:'edit'|'delete',noteId:string){await save({moreInfoNote:{noteId,action,...(action==='edit'?{notes:editingMoreInfoNotes.value.trim()}:{})}} as Partial<RequestRecord>);if(!error.value){editingMoreInfoId.value='';deletingMoreInfoId.value='';moreInfoNotice.value=action==='edit'?'Note updated.':'Note deleted.';}}

watch(()=>props.request?.id,()=>{moreInfoNotes.value='';moreInfoNotice.value='';editingMoreInfoId.value='';deletingMoreInfoId.value='';moreInfoReplies.value={};});
async function sendMoreInfo(){if(!props.request||!moreInfoNotes.value.trim())return;await save({reviewDecision:{action:'request-info',notes:moreInfoNotes.value.trim()}} as Partial<RequestRecord>);if(!error.value){moreInfoNotes.value='';showMoreInfoComposer.value=false;editingReviewDecision.value=false;moreInfoNotice.value='Sent to Local Agency.';}}
const canEditOriginal= computed(()=>!!props.request&&canEditSubmission(props.request));
const {data:distributorData}=await useFetch<{distributors:import('~/../shared/distributors').DistributorProfile[]}>('/api/distributors',{headers:computed(()=>({'x-demo-user':identity.value})),watch:[identity]});
function selectDistributor(shipment:import('~/../shared/requestShipments').RequestShipment,id:string){shipment.distributorId=id||undefined;const found=distributorData.value?.distributors.find(d=>d.id===id);shipment.supplier=found?.name??'';}
const {data:transferAgencies}=await useFetch('/api/agencies');
const {data:transferStock,refresh:refreshTransferStock,error:transferStockError}=await useFetch<{lots:SurplusLot[]}>('/api/surplus',{headers:computed(()=>({'x-demo-user':identity.value})),server:false,watch:[identity]});
const {data:anticipatedSurplusData,refresh:refreshAnticipatedSurplus}=await useFetch<{forecasts:Array<{id:string;agency_id:number;request_ref:string;formula_name:string;form:string;flavor:string;expected_units:number;actual_units:number|null;due_date:string;status:string;clinic_name?:string|null}>}>('/api/surplus',{headers:computed(()=>({'x-demo-user':identity.value})),server:false,watch:[identity]});
const anticipatedSurplusRows=computed(()=>{
 const request=props.request;if(!request)return [];
 const refs=new Set([String(request.id),request.submissionId].filter((value):value is string=>!!value));
 return (anticipatedSurplusData.value?.forecasts??[]).filter(item=>item.agency_id===request.agencyId&&refs.has(String(item.request_ref)));
});
const {data:surplusClinics,error:surplusClinicError}=await useFetch<{clinics:ClinicRecord[]}>(()=>`/api/agencies/${props.request?.agencyId??0}/clinics`,{headers:computed(()=>({'x-demo-user':identity.value})),server:false});
const shipmentFormulaChoices=computed(()=>props.request?shipmentFormulaOptions(props.request):[]);
function shipmentFormula(row:RequestShipment){return row.shipmentFormula??(props.request?resolveShipmentFormula(props.request,row):undefined);}
function shipmentRequest(row:RequestShipment):Partial<RequestRecord>{const formula=props.request?resolveShipmentFormula(props.request,row):undefined;return formula?{...props.request,requestedFormulas:[{...formula,productForm:formula.productForm!,ouncesPrescribed:0}]}:props.request??{};}
function shipmentCatalogSize(row:RequestShipment){const formula=shipmentFormula(row);return formula?transferCatalogUnitsPerCase({formulaName:formula.productName,form:formula.productForm??'',flavor:formula.flavor},props.products??[])??((props.request?.requestedFormulas?.length??1)<=1?selectedProduct.value?.unitsPerCase:undefined):undefined;}
function hasTransferLabelRequest(row:RequestShipment){return row.shipmentSource!=='agency'||!!row.transferStockConfirmedAt&&Number.isSafeInteger(row.transferLabelCount)&&Number(row.transferLabelCount)>0;}
function selectShipmentFormula(row:RequestShipment,key:string){const formula=shipmentFormulaChoices.value.find(f=>shipmentFormulaKey(f)===key);row.shipmentFormula=formula?{...formula}:undefined;row.sourceLotId=undefined;row.unitsPerCase=shipmentCatalogSize(row);syncTransferQuantity(row);}
function transferLots(row:RequestShipment){return (transferStock.value?.lots??[]).filter(lot=>props.request&&lot.agencyId===row.sourceAgencyId&&matchingTransferLot(shipmentRequest(row),lot)&&lot.expirationDate>=localDate()&&!lot.expiredUnits&&lot.onHand>lot.reserved);}
function changeShipmentSource(row:RequestShipment,value:string){row.shipmentSource=value==='agency'?'agency':'distributor';row.sourceAgencyId=undefined;row.sourceClinicId=undefined;row.sourceClinicName=undefined;row.sourceClinicAddress=undefined;row.sourceLotId=undefined;row.distributorId=undefined;row.supplier=undefined;row.unitsToTransfer=undefined;row.casesShipped=0;row.looseUnitsShipped=0;if(value==='agency')row.carrier='gso';}
function selectTransferLot(row:RequestShipment){const lot=transferLots(row).find(l=>l.id===row.sourceLotId);if(lot){row.sourceClinicId=lot.clinicId;row.sourceClinicName=lot.clinicName;row.sourceClinicAddress=lot.clinicAddress;}if(lot&&props.request)row.shipmentFormula=requireShipmentFormula(props.request,{transferFormulaName:lot.formulaName,transferForm:lot.form,transferFlavor:lot.flavor});row.unitsPerCase=lot?transferCatalogUnitsPerCase(lot,props.products??[]):undefined;syncTransferQuantity(row);}
let transferSelectionGroupSequence=0;
const transferSelectionGroups=new WeakMap<RequestShipment,string>();
function transferSelectionGroup(row:RequestShipment){const key=toRaw(row);let group=transferSelectionGroups.get(key);if(!group){group=`selection-${++transferSelectionGroupSequence}`;transferSelectionGroups.set(key,group);}return group;}
function sameTransferSelection(row:RequestShipment,candidate:RequestShipment){return transferSelectionGroup(row)===transferSelectionGroup(candidate);}
function selectedTransferLotIds(row:RequestShipment){return (draft.shipments??[]).filter(candidate=>sameTransferSelection(row,candidate)).flatMap(candidate=>candidate.sourceLotId?[candidate.sourceLotId]:[]);}
function toggleTransferLot(row:RequestShipment,lotId:string,checked:boolean){const selected=new Set(selectedTransferLotIds(row));if(checked)selected.add(lotId);else selected.delete(lotId);selectTransferLots(row,[...selected]);}
function selectTransferLots(row:RequestShipment,lotIds:string[]){
 const selected=transferLots(row).filter(lot=>lotIds.includes(lot.id));
 if(!selected.length){const rows=draft.shipments??[];const group=rows.filter(candidate=>sameTransferSelection(row,candidate));const indexes=group.map(candidate=>rows.indexOf(candidate));const index=indexes.length?Math.min(...indexes):rows.indexOf(row);for(let i=indexes.length-1;i>=0;i--)rows.splice(indexes[i]!,1);const blank={...row,sourceLotId:undefined,sourceClinicId:undefined,sourceClinicName:undefined,sourceClinicAddress:undefined,casesShipped:0,looseUnitsShipped:0,unitsToTransfer:undefined,transferId:undefined};transferSelectionGroups.set(toRaw(blank),transferSelectionGroup(row));if(index>=0)rows.splice(index,0,blank);draft.shipments=rows;return;}
 const rows=draft.shipments??[];const groupRows=rows.filter(candidate=>sameTransferSelection(row,candidate));const indexes=groupRows.map(candidate=>rows.indexOf(candidate));const index=indexes.length?Math.min(...indexes):rows.indexOf(row);if(index<0)return;
 const next=selected.map(lot=>{
  const nextRow=groupRows.find(candidate=>candidate.sourceLotId===lot.id)??{...row,trackingNumbers:[...row.trackingNumbers],casesShipped:0,looseUnitsShipped:0,unitsToTransfer:undefined,transferId:undefined};
  transferSelectionGroups.set(toRaw(nextRow),transferSelectionGroup(row));
  nextRow.sourceLotId=lot.id;nextRow.sourceClinicId=lot.clinicId;nextRow.sourceClinicName=lot.clinicName;nextRow.sourceClinicAddress=lot.clinicAddress;
  if(props.request)nextRow.shipmentFormula=requireShipmentFormula(props.request,{transferFormulaName:lot.formulaName,transferForm:lot.form,transferFlavor:lot.flavor});
  nextRow.unitsPerCase=transferCatalogUnitsPerCase(lot,props.products??[]);syncTransferQuantity(nextRow);return nextRow;
 });
 for(let i=indexes.length-1;i>=0;i--)rows.splice(indexes[i]!,1);
 rows.splice(index,0,...next);draft.shipments=rows;
}
function syncTransferQuantity(row:RequestShipment){if(row.shipmentSource==='agency')row.unitsToTransfer=transferEntryQuantity(row);}
function transferDraftFields(row:RequestShipment,size?:number){
 if(row.shipmentSource!=='agency'||row.transferId||!Number.isSafeInteger(size)||!size)return {};
 const total=row.unitsToTransfer??transferEntryQuantity({...row,unitsPerCase:size});
 return total===undefined?{}:{unitsToTransfer:total,casesShipped:Math.floor(total/size),looseUnitsShipped:total%size};
}
const transferAuthorizationIndex=ref<number|null>(null);
const transferAuthorizationMessage=ref('');
async function reserveShipmentTransfer(index:number){
    transferAuthorizationIndex.value=index;transferAuthorizationMessage.value='';
    const row=draft.shipments?.[index];if(!row||!props.request)return;
    syncTransferQuantity(row);
    const validation=transferStock.value?transferAuthorizationError(shipmentRequest(row),row,transferStock.value.lots):'Surplus inventory is not available yet. Please try again.';
    if(validation){transferAuthorizationMessage.value=validation;return;}
    await save({shipmentDrafts:draft.shipments,reserveTransferIndex:index});
    if(error.value){transferAuthorizationMessage.value=error.value;return;}
    transferAuthorizationIndex.value=null;await refreshTransferStock();
}
const issuanceTransferMessage=ref('');
function formulaTransferSelections(authorization:FormulaAuthorization){return (draft.shipments??[]).map((row,index)=>({row,index})).filter(({row})=>row.shipmentSource==='agency'&&row.replacementFor===undefined&&shipmentFormulaKey(shipmentFormula(row))===shipmentFormulaKey(authorization));}
function otherAgencyLots(authorization:FormulaAuthorization){return props.request?issuanceTransferLots(props.request,authorization,transferStock.value?.lots??[],localDate()):[];}
function selectIssuanceTransfer(authorization:FormulaAuthorization,lot:SurplusLot,units:number){
 issuanceTransferMessage.value='';
 try{draft.shipments=setIssuanceTransferUnits(draft.shipments??[],authorization,lot,units,transferCatalogUnitsPerCase(lot,props.products??[])??authorizationUnitsPerCase(authorization));for(const row of draft.shipments)if(row.sourceLotId===lot.id&&!row.sourceAgencyName)row.sourceAgencyName=transferAgencies.value?.agencies.find(agency=>agency.id===lot.agencyId)?.name;}
 catch(error){issuanceTransferMessage.value=(error as Error).message;}
}
function removeIssuanceTransfer(index:number){if(!draft.shipments?.[index]?.transferId)draft.shipments?.splice(index,1);}
async function reserveIssuanceTransfer(index:number){
 issuanceTransferMessage.value='';
 const rows=JSON.parse(JSON.stringify(draft.shipments??[])) as RequestShipment[];
 const row=rows[index];if(!row||!props.request)return;
 const publishedCount=requestShipments(props.request).length;
 if(index>publishedCount){rows.splice(index,1);rows.splice(publishedCount,0,row);index=publishedCount;}
 const validation=transferStock.value?transferAuthorizationError(shipmentRequest(row),row,transferStock.value.lots):'Surplus inventory is not available yet.';
 if(validation){issuanceTransferMessage.value=validation;return;}
 await saveStaffFields();
 if(error.value){issuanceTransferMessage.value=error.value;return;}
 draft.shipments=rows;
 await reserveShipmentTransfer(index);
 issuanceTransferMessage.value=transferAuthorizationMessage.value||error.value;
}
const canRepEdit = computed(() => identity.value === 'admin' || identity.value === 'agency');
const selectedProduct = computed(() => props.products?.find((product) => product.id === props.request?.productId));

const { authorizationProduct, authorizationUnitsPerCase, assignedUnits, setLocalSurplusAllocation } = useAuthorizationEditor(draft, () => props.products, () => props.request);

function savedLocalSurplusUnits(index:number,lotId:string){return props.request?formulaAuthorizations(props.request)[index]?.localSurplusAllocations?.find(row=>row.lotId===lotId)?.units??0:0;}
function localSurplusAvailable(lot:SurplusLot,index:number){return Math.max(0,lot.onHand-lot.reserved+savedLocalSurplusUnits(index,lot.id));}
function localAgencySurplusLots(authorization:FormulaAuthorization,index:number){const formula=requestFormulas(props.request??{})[index];if(!formula)return [];const name=(formula.otherFormulaName||formula.productName).trim().toLowerCase();return (transferStock.value?.lots??[]).filter(lot=>lot.agencyId===props.request?.agencyId&&lot.form===formula.productForm&&lot.formulaName.trim().toLowerCase()===name&&(lot.flavor??'').trim().toLowerCase()===(formula.flavor??'').trim().toLowerCase()&&lot.expirationDate>=localDate()&&!lot.expiredUnits&&(lot.onHand>lot.reserved||savedLocalSurplusUnits(index,lot.id)>0));}

function copyRequest(request: RequestRecord): Partial<RequestRecord> {
    const requestedMonths = normalizeRequestedMonths(request.benefitMonthsRequested);
    return {
        ...request,
        genericFields:{...request.genericFields},
        shipping:request.shipping?{...request.shipping}:undefined,
        formulaAuthorizations:formulaAuthorizations(request).map(authorization => {
            const product=authorizationProduct(authorization);
            return product ? {...authorization,productCode:product.productCode,unitsPerCase:authorization.unitsPerCase??product.unitsPerCase,yield:authorization.yield??product.yield} : authorization;
        }),
        shipments:staffShipmentRows(request).map(row=>{const size=row.unitsPerCase ?? ((request.requestedFormulas?.length ?? 1)<=1?selectedProduct.value?.unitsPerCase:undefined);return {...row,unitsPerCase:size,...transferDraftFields(row,size)};}),
        requestedFormulas: request.requestedFormulas?.map(formula=>({...formula})),
        participantFirstName: participantNames(request).first,
        participantLastName: participantNames(request).last,
        trackingNumbers: request.trackingNumbers?.map((tracking) => ({ ...tracking })),
        receivedPhotos: request.receivedPhotos ? [...request.receivedPhotos] : undefined,
        benefitIssuances:
            request.benefitIssuances?.map((issuance) => ({ ...issuance })) ??
            [{ month: '', quantity: 0 }],
        benefitMonthsRequested: normalizeRequestedMonths(request.benefitMonthsRequested),
        surplusItems: request.surplusItems?.map((item) => ({ ...item })) ?? [],
    };
}

const benefitMonths = computed(() => {
    const start = props.request?.benefitsStartDate ?? new Date().toISOString().slice(0, 7) + '-01';
    const date = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return Array.from({ length: 24 }, (_, index) => {
        const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + index, 1));
        const value = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
        return { value, label: formatIssuanceMonth(value) };
    });
});

function formatTitleCase(value?: string) {
    if (!value) return '—';
    return value
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

watch(
    () => props.request,
    (request) => {
        Object.keys(draft).forEach((key) => delete draft[key as keyof typeof draft]);
        if (request) {
            Object.assign(draft, copyRequest(request));
        }
        photoNames.value = request?.receivedPhotos ? [...request.receivedPhotos] : [];
        error.value = '';
        staffSaveStatus.value = 'idle';
        agencySaveStatus.value = 'idle';
        pendingDecision.value = null;
        deletingShipmentIndex.value=null;
        receiptEditors.value={};
        shipmentDeleteNotice.value='';
        shippingSaveStatus.value = 'idle';
        reportingSurplus.value = false;
    },
    { immediate: true },
);

watch([()=>props.request?.id,()=>transferRoute.query.surplusLot,()=>transferStock.value?.lots,()=>props.products],async()=>{
 const request=props.request;const lotId=typeof transferRoute.query.surplusLot==='string'?transferRoute.query.surplusLot:'';
 if(!request||!canStaffEdit.value||String(transferRoute.query.request)!==String(request.id)||!lotId||!transferStock.value?.lots||!props.products)return;
 const key=`${request.id}:${lotId}`;if(shortcutApplied.value===key)return;
 const lot=transferStock.value.lots.find(l=>l.id===lotId);
 const row=lot?surplusShipmentDraft(request,lot,props.products):undefined;
 shortcutApplied.value=key;
 if(!row){shortcutNotice.value='This stock is no longer available for this request. Select another available surplus lot.';return;}
 const rows=draft.shipments??[];
 const existing=rows.findIndex(r=>r.sourceLotId===lotId&&!r.transferId&&!r.etaSentAt);
 if(existing<0){const blank=rows.findIndex((r,i)=>canDeleteShipment({...request,shipmentDrafts:rows},i)&&!r.shipmentSource&&!r.supplier&&!r.shipmentFormula&&!r.transferId&&!r.etaSentAt&&!r.sourceLotId&&!r.distributorId&&!r.casesShipped&&!r.trackingNumbers.length&&!r.eta&&!r.issue&&!r.receiptConfirmed&&r.receivedCases===undefined&&r.receivedUnits===undefined);if(blank>=0)rows[blank]=row;else rows.push(row);draft.shipments=rows;}
 shortcutNotice.value='Surplus selected in Issuance. Enter the transfer units, then Reserve Stock to request confirmation from the sending agency.';
 await nextTick();document.getElementById(`issuance-${request.id}`)?.scrollIntoView({block:'start'});
},{immediate:true,flush:'post'});
watch([()=>props.request?.id,()=>transferRoute.hash],async()=>{if(props.request&&transferRoute.hash===`#shipments-${props.request.id}`){await nextTick();document.getElementById(`shipments-${props.request.id}`)?.scrollIntoView({block:'start'});}},{immediate:true,flush:'post'});
onMounted(async()=>{if(props.request&&transferRoute.hash===`#shipments-${props.request.id}`){await nextTick();shippingSection.value?.scrollIntoView({block:'start',behavior:'instant'});}});

async function save(updates: Partial<RequestRecord> & {reserveTransferIndex?:number;deleteShipmentIndex?:number;sendEtaShipmentIndex?:number;confirmShipmentReceipts?:ShipmentReceiptSelection[];recordLocalSurplusIssue?:{formulaIndex:number;month:string;units:number}} = draft) {
    if (!props.request) {
        return;
    }
    const savingRequest=props.request;
    saving.value = true;
    error.value = '';
    try {
        const result = await $fetch<{ request: RequestRecord }>(`/api/requests/${savingRequest.id}`, {
            method: 'PUT',
            headers: {'x-demo-user':identity.value},
            body: {...updates,revision:savingRequest.revision ?? 0},
        });
        Object.assign(savingRequest, result.request);
        window.dispatchEvent(new Event('request-messages-changed'));
        if (props.request?.id===savingRequest.id) Object.assign(draft, copyRequest(result.request));
    } catch (requestError) {
        error.value = (requestError as {data?:{statusMessage?:string};statusMessage?:string}).data?.statusMessage ?? (requestError as {statusMessage?:string}).statusMessage ?? 'Request could not be updated.';
    } finally {
        saving.value = false;
    }
}
async function recordLocalSurplusIssue(command:{formulaIndex:number;month:string;units:number}){if(!props.request)return;await save({recordLocalSurplusIssue:command});if(!error.value)await refreshTransferStock();}

function addRequestedMonth() {
    const selected = normalizeRequestedMonths(draft.benefitMonthsRequested);
    if (selected.length >= 3) return;
    const month = benefitMonths.value.find((option) => !selected.includes(option.value))?.value;
    if (month) draft.benefitMonthsRequested = [...selected, month].sort();
}

function removeRequestedMonth(index: number) {
    draft.benefitMonthsRequested = (draft.benefitMonthsRequested ?? []).filter((_, itemIndex) => itemIndex !== index);
}

function startEditing(section: 'participant' | 'overview' | 'prescription' | 'food' | 'shipping') {
    if(section==='shipping'){draft.shipping={...blankClinicAddress(),...draft.shipping,clinicName:draft.shipping?.clinicName||props.agency?.name||'',attention:draft.shipping?.attention||props.rep?.name||'',email:draft.shipping?.email||props.rep?.email||'',phone:formatPhoneNumber(draft.shipping?.phone||props.rep?.phone||'')};}
    if (section === 'overview') {
        editableDiagnoses.value = (draft.diagnosis ?? '').split(/[\n;]/).map(value => value.trim()).filter(Boolean);
        editableFormulas.value = editableRequestFormulas(draft, props.products);
    }
    if (section === 'prescription') {
        draft.doctorOfficePhone = formatPhoneNumber(draft.doctorOfficePhone ?? '');
        draft.doctorOfficeAddress = providerAddressLines(draft.doctorOfficeAddress).filter(line => line !== '—').join('\n');
    }
    editingSection.value = section;
    error.value = '';
}

function editParticipantName() {
    reviewDetailsExpanded.value = true;
    startEditing('participant');
}

function cancelEditing() {
    if (props.request) Object.assign(draft, copyRequest(props.request));
    editingSection.value = null;
    error.value = '';
}

function saveFormSection() {
    const savedSection = editingSection.value;
    const savedRequestId = props.request?.id;
    const updates: Partial<RequestRecord> = {};
    if (editingSection.value === 'participant') {
        const firstName = (draft.participantFirstName ?? '').trim();
        const lastName = (draft.participantLastName ?? '').trim();
        if (!firstName || !lastName) { error.value = 'Enter the participant first and last name.'; return; }
        const breastfeedingError = validateBreastfeeding(draft);
        if (breastfeedingError) {error.value = breastfeedingError; return;}

        const monthError = validateRequestedMonths(draft.benefitMonthsRequested);
        if (monthError) {error.value = monthError; return;}

        Object.assign(updates, {
            participantName: `${firstName} ${lastName}`,
            participantFirstName: firstName,
            participantLastName: lastName,
            participantFamilyId: draft.participantFamilyId,
            benefitMonthsRequested: normalizeRequestedMonths(draft.benefitMonthsRequested),
            mediCalStatus: draft.medicalStatus==='yes'?draft.mediCalStatus:undefined,
            participantDob: draft.participantDob,
            benefitsStartDate: draft.benefitsStartDate,
            wicIndividualId: draft.wicIndividualId,
            breastfeedingStatus: draft.breastfeedingStatus,
            breastfeedingDiscontinuedDate: draft.breastfeedingStatus === 'Discontinued BF' ? draft.breastfeedingDiscontinuedDate : '',
            medicalStatus: draft.medicalStatus,
        });
    } else if (editingSection.value === 'overview') {
        const diagnoses = editableDiagnoses.value.map(value => value.trim()).filter(Boolean).join('\n');
        const diagnosisError = validateDiagnoses(diagnoses);
        if (diagnosisError) { error.value = diagnosisError; return; }
        const duplicateError = validateFormulaSelection(editableFormulas.value.map(entry => ({name:formulaEntryName(entry),form:entry.productForm,flavor:entry.formulaFlavor})), props.products);
        const formulaError = editableFormulas.value.map(entry => validateFormulaEntry(entry, props.products)).find(Boolean);
        if (duplicateError || formulaError || !editableFormulas.value.length) { error.value = duplicateError || formulaError || 'Add a formula.'; return; }
        if (!Number.isInteger(Number(draft.durationMonths)) || Number(draft.durationMonths) < 1 || Number(draft.durationMonths) > 6) {error.value = 'Enter Duration between 1 and 6 months.'; return;}
        Object.assign(updates, requestFormulaUpdates({...draft, diagnosis: diagnoses},editableFormulas.value, props.products));
        const first = editableFormulas.value[0]!;
        if (formulaEntryName(first) !== props.request?.productName || first.productForm !== props.request?.productForm || first.formulaFlavor !== (props.request?.formulaFlavor ?? ''))
            updates.productId = resolveProduct(props.products??[], {name:formulaEntryName(first),form:first.productForm,flavor:first.formulaFlavor})?.id ?? -1;
    } else if (editingSection.value === 'food') {
        if (!draft.wicFoodRestrictions) { error.value = 'Select WIC Food Restrictions.'; return; }
        if (draft.wicFoodRestrictions === 'not-indicated' && (!draft.wicStaffFoodRestrictions || !draft.wicNutritionStaffName?.trim() || (draft.wicStaffFoodRestrictions === 'restricted' && !draft.wicNutritionStaffNotes?.trim()))) {
            error.value = 'Complete the WIC Nutrition Staff selection, name, and notes when food restrictions are selected.';
            return;
        }
        Object.assign(updates, {
            wicFoodRestrictions: draft.wicFoodRestrictions,
            wicFoodRestrictionDetails: draft.wicFoodRestrictions === 'restricted' ? draft.wicFoodRestrictionDetails : '',
            wicStaffFoodRestrictions: draft.wicFoodRestrictions === 'not-indicated' ? draft.wicStaffFoodRestrictions : undefined,
            wicNutritionStaffName: draft.wicFoodRestrictions === 'not-indicated' ? draft.wicNutritionStaffName : '',
            wicNutritionStaffNotes: draft.wicFoodRestrictions === 'not-indicated' && draft.wicStaffFoodRestrictions === 'restricted' ? draft.wicNutritionStaffNotes : '',
        });
    } else if(editingSection.value==='shipping'){
        const shipping={...draft.shipping!,clinicId:undefined,phone:normalizePhoneNumber(draft.shipping?.phone??'')};
        const shippingError=validateShipping(shipping);if(shippingError){error.value=shippingError;return;}
        updates.shipping=shipping;
    } else if (editingSection.value === 'prescription') {
        Object.assign(updates, {
            doctorPrintedName: draft.doctorPrintedName,
            doctorHasSignedOff: draft.doctorHasSignedOff,
            prescriptionSignedDate: draft.prescriptionSignedDate,
            doctorOfficeName: draft.doctorOfficeName,
            doctorOfficeAddress: draft.doctorOfficeAddress,
            doctorOfficePhone: normalizePhoneNumber(draft.doctorOfficePhone ?? ''),
        });
    }
    save(updates).then(async () => {
        if (error.value || props.request?.id !== savedRequestId) return;
        editingSection.value = null;
        await nextTick();
        if (savedSection === 'overview') {
            medicalDetails.value?.focusPrescription();
        }
    });
}

function addSurplusItem() {
    draft.surplusItems = [...(draft.surplusItems ?? []), { productName: '', units: 0, expirationDate: '', clinicId: props.request?.shipping?.clinicId }];
}

function startSurplusReport() {
    reportingSurplus.value = true;
    if (!draft.surplusItems?.length) addSurplusItem();
}

function requestRemoveSurplusItem(index: number) {
    surplusRemovalIndex.value = index;
}

function confirmRemoveSurplusItem() {
    if (surplusRemovalIndex.value !== null) {
        draft.surplusItems?.splice(surplusRemovalIndex.value, 1);
    }
    surplusRemovalIndex.value = null;
}

async function saveStaffFields() {
    staffSaveStatus.value = 'saving';
    const authorizations=draft.formulaAuthorizations??[];
    const first=authorizations[0];
    const issuances = first?.benefitIssuances ?? [];
    const validationErrors = validateFormulaAuthorizations(authorizations);
    if (validationErrors.length) {
        error.value = validationErrors[0];
        staffSaveStatus.value = 'failed';
        return;
    }
    const detailNumberErrors = validateRequestDetailNumbers(draft);
    if (detailNumberErrors.length) {
        error.value = detailNumberErrors[0];
        staffSaveStatus.value = 'failed';
        return;
    }
    await save({
        formulaAuthorizations:authorizations,
        formulaOrders:draft.formulaOrders,
        productId:first ? authorizationProduct(first)?.id ?? -1 : -1,
        benefitIssuances: issuances,
        approvedCases: Number(first?.approvedCases??0),
        approvedMonths: Number(first?.approvedMonths??0),
        staffNotes: draft.staffNotes,
        nextSteps: draft.nextSteps,
    });
    if(!error.value)await refreshTransferStock();
    staffSaveStatus.value = error.value ? 'failed' : 'saved';
}

async function changeFormulaOrder(index:number,value:string){
    if(!props.request)return;
    const rows=formulaOrders(draft);
    if(!rows[index])return;
    rows[index]!.specialOrder=value==='special';
    draft.formulaOrders=rows;
    const authorization=draft.formulaAuthorizations?.[index];
    if(authorization?.approvedCases!==undefined){
        authorization.standardCases=rows[index]!.specialOrder?0:authorization.approvedCases;
        authorization.specialOrderCases=rows[index]!.specialOrder?authorization.approvedCases:0;
    }
    await save({formulaOrders:rows,formulaAuthorizations:draft.formulaAuthorizations});
}

async function chooseReviewDecision(action:'approve'|'deny'|'reopen'|'clear') {
    if(action==='deny'){denialReason.value=props.request?.denialReason??'';pendingDecision.value='denied';return;}
    approvingReviewDecision.value=action==='approve';
    try {await save({reviewDecision:{action}} as Partial<RequestRecord>);}
    finally {approvingReviewDecision.value=false;}
    if(!error.value){cancelReviewDecisionEdit();await nextTick();(action==='approve'?authorizationSection.value:reviewDecisionSection.value)?.scrollIntoView({block:'start',behavior:'smooth'});}
}
async function confirmDenial() {
    if(!denialReason.value.trim()){error.value='Enter a reason for denial.';return;}
    await save({reviewDecision:{action:'deny',reason:denialReason.value.trim()}} as Partial<RequestRecord>);
    if(!error.value){editingSection.value=null;pendingDecision.value=null;cancelReviewDecisionEdit();await nextTick();reviewDecisionSection.value?.scrollIntoView({block:'start',behavior:'smooth'});}
}
function cancelMoreInfoDraft(){showMoreInfoComposer.value=false;moreInfoNotes.value='';moreInfoNotice.value='';}
function cancelReviewDecisionEdit(){editingReviewDecision.value=false;cancelMoreInfoDraft();}
async function openMoreInfo(){showMoreInfoComposer.value=true;moreInfoExpanded.value=true;await nextTick();document.getElementById(`more-info-${props.request?.id}`)?.scrollIntoView({block:'start',behavior:'smooth'});}

async function confirmDeleteShipment(){
    const index=deletingShipmentIndex.value;
    if(index===null || !props.request || !canStaffEdit.value)return;
    const savedCount=props.request.shipmentDrafts?.length ?? storedShipmentRows(props.request).length;
    if(index>=savedCount){
        draft.shipments?.splice(index,1);
    }else{
        await save({deleteShipmentIndex:index});
        if(error.value)return;
    }
    deletingShipmentIndex.value=null;
    editingEtaIndex.value=null;
    shipmentPublishNotice.value=null;
    shippingSaveStatus.value='idle';
    shipmentDeleteNotice.value='Shipment deleted.';
}

function editingShipmentLogistics(row:RequestShipment,index:number){return editingShipmentPlan(row,index)||(canStaffEdit.value&&row.shipmentSource==='agency'&&row.transferStatus==='reserved'&&!!row.transferId&&(!row.transferEtaSentAt||editingEtaIndex.value===index));}
async function editOrSendTransferEta(index:number){
 const row=draft.shipments?.[index];if(!row?.transferId||!props.request)return;
 if(row.transferEtaSentAt&&editingEtaIndex.value!==index){editingEtaIndex.value=index;return;}
 const requestId=props.request.id;saving.value=true;error.value='';sendingEtaIndex.value=index;
 try{const result=await $fetch<{request:RequestRecord}>(`/api/request-transfers/${row.transferId}/eta`,{method:'POST',headers:{'x-demo-user':identity.value},body:{eta:row.eta,carrier:row.carrier,trackingNumbers:row.trackingNumbers,revision:props.request.revision??0}});if(props.request?.id===requestId){applyShipmentIssueResult(result.request);editingEtaIndex.value=null;}}
 catch(e){error.value=(e as {data?:{statusMessage?:string}}).data?.statusMessage??'Transfer ETA could not be saved.';}finally{saving.value=false;sendingEtaIndex.value=null;}
}
function editingShipmentPlan(shipment:RequestShipment,index:number){return canStaffEdit.value&&!shipment.transferId&&!shipmentReceived(props.request??{},shipment)&&shipment.receivedCases===undefined&&!shipment.issue&&!shipment.deletedIssues?.length&&(!shipment.etaSentAt||editingEtaIndex.value===index||shipmentHasUnsentChanges(shipment,requestShipments(props.request??{})[index]));}
function editOrSendEta(index:number){
    if(draft.shipments?.[index]?.etaSentAt && !editingShipmentPlan(draft.shipments[index]!,index)){if(editingEtaIndex.value!==null)cancelEtaEdit(editingEtaIndex.value);editingEtaIndex.value=index;return;}
    return saveShipments(index);
}
function cancelEtaEdit(index:number){
    const row=draft.shipments?.[index];const saved=requestShipments(props.request??{})[index];
    if(row&&saved&&draft.shipments)draft.shipments[index]=copyRequest(props.request!).shipments?.[index]??saved;
    editingEtaIndex.value=null;
}
function setShipmentTracking(shipment: RequestShipment, value: string) {
    shipment.trackingNumbers = value.split(/\r?\n/);
}
async function saveShipments(index?: number) {
    shippingSaveStatus.value = 'saving';
    sendingEtaIndex.value = index ?? null;
    const rows = draft.shipments ?? [];
    const validation = index === undefined
        ? validateShipments(rows.map(row=>({...row,etaSentAt:undefined})))
        : validateShipments([rows[index]!],true);
    if (validation) {
        error.value = index === undefined ? validation : `Shipment ${index + 1}: ${validation.replace(/^Shipment 1: /,'')}`;
        shippingSaveStatus.value = 'failed';
        sendingEtaIndex.value = null;
        return;
    }
    const wasPublished=index!==undefined && !!requestShipments(props.request??{})[index]?.etaSentAt;
    await save({shipmentDrafts:rows, ...(index === undefined ? {} : {sendEtaShipmentIndex:index})});
    shippingSaveStatus.value = error.value ? 'failed' : index===undefined?'saved':'idle';
    if(!error.value && index!==undefined)shipmentPublishNotice.value={index,updated:wasPublished};
    if(!error.value && index!==undefined)editingEtaIndex.value=null;
    sendingEtaIndex.value = null;
}

function applyShipmentIssueResult(request:RequestRecord) {
    if (props.request?.id!==request.id) return;
    Object.assign(props.request,request);
    draft.shipments=canStaffEdit.value?staffShipmentRows(request):requestShipments(request);
    draft.receivedStatus=request.receivedStatus;
    draft.status=request.status;
}

async function saveAgencyUpdate() {
    agencySaveStatus.value = 'saving';
    const surplusErrors = validateSurplusItems(draft.surplusItems ?? []);
    if (draft.surplusItems?.length && surplusErrors.length) {
        error.value = surplusErrors[0];
        agencySaveStatus.value = 'failed';
        return;
    }
    await save({
        repNotes: draft.repNotes,
        surplusItems: draft.surplusItems ?? [],
    });
    agencySaveStatus.value = error.value ? 'failed' : 'saved';
}

</script>

<template>
    <section v-if="request?.prescriptionAttachment&&documentOpen" id="request-document-panel" class="request-document-pane" aria-label="Uploaded medical documentation" @click.stop>
        <div class="document-pane-header"><strong>Medical Documentation</strong><button type="button" class="button button-ghost" @click="documentOpen=false">Close document</button></div>
        <RequestDocumentPreview :key="`${request.id}-${request.prescriptionAttachment.storageKey}-${identity}`" :request-id="request.id" :attachment="request.prescriptionAttachment" />
    </section>
    <aside
        v-if="request"
        class="detail-drawer"
        :class="{'document-visible':documentOpen || historyOpen}"
        @click.stop
    >
        <div class="drawer-header">
            <div>
                <span class="eyebrow">Request #{{ request.id }}</span>
                <div class="participant-name-heading">
                    <h2>{{ request.participantName }}</h2>
                    <button v-if="canStaffEdit && request.status!=='denied' && editingSection !== 'participant'" class="participant-name-edit" type="button" aria-label="Edit participant name" title="Edit participant name" @click="editParticipantName">
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 5 5-13 13H3v-5L16 3Z"/><path d="m14 5 5 5"/></svg>
                    </button>
                </div>
                <div class="request-kind-attachment">
                <span class="request-tag request-kind-tag">{{ request.requestKind === 'extension' ? 'Extension' : 'New' }}</span>
                <button v-if="request.prescriptionAttachment" type="button" class="attachment-toggle" title="View medical documentation" :aria-expanded="documentOpen" aria-controls="request-document-panel" @click="documentOpen=!documentOpen"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l10-10a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l9.19-9.19" /></svg><span>Rx</span></button>
                </div>
            </div>
            <div class="drawer-header-tools">
            <div class="drawer-header-actions">
                <button
                    class="button button-ghost"
                    type="button"
                    aria-label="Previous request"
                    :disabled="!hasPrevious || saving"
                    @click="emit('previous')"
                >
                    ‹ Prev
                </button>
                <button
                    class="button button-ghost"
                    type="button"
                    aria-label="Next request"
                    :disabled="!hasNext || saving"
                    @click="emit('next')"
                >
                    Next ›
                </button>
                <button
                    class="icon-button"
                    type="button"
                    aria-label="Close details"
                    @click="emit('close')"
                >
                    ×
                </button>
            </div>
            </div>
        </div>
        <div class="drawer-status">
            <div class="request-status-tags">
                <StatusBadge v-if="!hasPendingMoreInfo(request) && !(allFormulasSpecialOrder(request) && (draft.status ?? request.status)==='in_progress')" :status="draft.status ?? request.status" />
                <span v-if="hasPendingMoreInfo(request)" class="request-tag more-info-status" title="Returned to Local Agency for more information" role="status">Request More Info</span>
                <span
                    v-if="allFormulasSpecialOrder(request)"
                    class="status-badge status-special-order"
                >Special Order</span>
                <span
                    v-if="request.approved && request.status!=='complete'"
                    class="request-tag"
                >Approved</span>
            </div>
            <span>Submitted {{ formatDisplayDate(request.submissionDate) }}</span>
        </div>
        <RequestHistory :key="request.id" :family-id="String(request.participantFamilyId ?? '')" :individual-id="request.wicIndividualId ?? ''" :name="request.participantName" :dob="request.participantDob ?? ''" :current-id="request.id" context="review" :suspended="documentOpen" @preview="historyOpen=$event; if($event) documentOpen=false" />
        <button v-if="canCollapseReviewDetails" class="review-details-toggle" type="button" :aria-expanded="reviewDetailsExpanded" :aria-controls="`review-details-${request.id}`" @click="reviewDetailsExpanded=!reviewDetailsExpanded"><span>Participant and Medical Details</span><span aria-hidden="true">{{reviewDetailsExpanded?'⌃':'⌄'}}</span></button>
        <div :id="`review-details-${request.id}`" v-show="!canCollapseReviewDetails || reviewDetailsExpanded">
        <RequestMedicalDetails
            ref="medicalDetails"
            :request="request"
            :draft="draft"
            :products="products"
            :can-staff-edit="canStaffEdit"
            :saving="saving"
            :editing-section="editingSection"
            :editable-formulas="editableFormulas"
            :editable-diagnoses="editableDiagnoses"
            :age-milestone-alerts="ageMilestoneAlerts"
            :benefit-months="benefitMonths"
            :error="error"
            @edit="startEditing"
            @cancel="cancelEditing"
            @save="saveFormSection"
            @add-month="addRequestedMonth"
            @remove-month="removeRequestedMonth"
        />
        </div>
        <button v-if="canCollapseMoreInfo" class="review-details-toggle" type="button" :aria-expanded="moreInfoExpanded" :aria-controls="`more-info-${request.id}`" @click="moreInfoExpanded=!moreInfoExpanded"><span>Request More Info</span><span aria-hidden="true">{{moreInfoExpanded?'⌃':'⌄'}}</span></button>
        <section v-if="showMoreInfoComposer || request.moreInfoRequests?.some(note=>!note.deletedAt)" :id="`more-info-${request.id}`" class="detail-section more-info-section" v-show="!canCollapseMoreInfo || moreInfoExpanded">
            <div v-if="!canCollapseMoreInfo" class="section-heading"><h3>Request More Info</h3><div v-if="canStaffEdit" class="more-info-toolbar"><button v-if="canReopenForResubmission" class="button button-secondary" type="button" :disabled="saving" @click="reopenForResubmission">Reopen for Resubmission</button><span v-else-if="latestMoreInfoRequest(request)?.resubmissionOpen && hasPendingMoreInfo(request)" class="more-info-open-status">Open for Resubmission</span><button v-if="hasUnresolvedMoreInfo" class="button button-secondary more-info-resolve" type="button" :disabled="saving" @click="resolveInformationRequest">Resolved</button></div></div>
            <div>
            <div v-if="identity==='agency' && canEditOriginal && hasPendingMoreInfo(request)" class="more-info-correction"><MoreInfoReadMarker :notice-id="`followup:${latestMoreInfoRequest(request)?.id}:reopen:${latestMoreInfoRequest(request)?.resubmissionOpenedAt}`" :read-at="latestMoreInfoRequest(request)?.resubmissionReadAt" :incoming="true" @visible="queueMessageRead"><p>CDPH/WIC reopened this request for corrections.</p></MoreInfoReadMarker><NuxtLink class="button button-secondary" :to="{path:'/requests/new',query:{request:request.id}}">Update and Resubmit</NuxtLink></div>
            <component :is="entry.resolvedAt?'details':'div'" v-for="entry in visibleMoreInfoRequests" :key="`${entry.id}-${!!entry.resolvedAt}`" class="more-info-history">
                <summary v-if="entry.resolvedAt">Resolved {{formatDisplayDate(submissionDateOnly(entry.resolvedAt))}} · {{1+(entry.responses?.length??0)}} {{entry.responses?.length?'messages':'message'}}</summary>
                <template v-if="canStaffEdit && editingMoreInfoId===entry.id && !entry.deletionLocked && !entry.readAt && !entry.responses?.some(response=>response.readAt)"><label class="field-label">Notes<textarea v-model="editingMoreInfoNotes" class="form-textarea" maxlength="4000" rows="3" /></label><div class="more-info-actions"><button class="button button-secondary" type="button" :disabled="saving || !editingMoreInfoNotes.trim()" @click="saveMoreInfoNote('edit',entry.id)">Save Note</button><button class="button button-ghost" type="button" :disabled="saving" @click="editingMoreInfoId=''">Cancel</button></div></template>
                <template v-else><MoreInfoReadMarker :notice-id="`followup:${entry.id}`" :read-at="entry.readAt" :incoming="identity==='agency'" @visible="queueMessageRead"><strong class="more-info-sender">CDPH/WIC</strong></MoreInfoReadMarker><p class="more-info-notes">{{entry.notes}}</p><div v-if="canStaffEdit && request.status!=='denied' && !entry.deletionLocked && !entry.readAt && !entry.responses?.some(response=>response.readAt)" class="more-info-actions"><button class="text-button" type="button" :disabled="saving" @click="startMoreInfoEdit(entry)">Edit</button><button class="text-button" type="button" :disabled="saving" @click="deletingMoreInfoId=entry.id">Delete</button></div></template>
                <small>Requested {{formatDisplayDate(submissionDateOnly(entry.requestedAt))}}<template v-if="entry.readAt"> · Read {{formatDisplayDate(submissionDateOnly(entry.readAt))}}</template><template v-if="entry.editedAt"> · Edited {{formatDisplayDate(submissionDateOnly(entry.editedAt))}}</template><template v-if="entry.resubmittedAt"> · Resubmitted {{formatDisplayDate(submissionDateOnly(entry.resubmittedAt))}}</template><template v-if="entry.resolvedAt"> · ✓ Resolved {{formatDisplayDate(submissionDateOnly(entry.resolvedAt))}}</template></small>
                <div v-if="entry.responses?.length" class="more-info-responses"><article v-for="response in entry.responses" :key="response.id" class="more-info-response" :class="response.respondedAs==='reviewer'?'from-reviewer':'from-agency'"><MoreInfoReadMarker :notice-id="`followup-response:${response.id}`" :read-at="response.readAt" :incoming="(response.respondedAs==='reviewer')!==canStaffEdit" @visible="queueMessageRead"><strong class="more-info-sender">{{response.respondedAs==='reviewer'?'CDPH/WIC':'Local Agency'}}</strong></MoreInfoReadMarker><template v-if="editingResponseId===response.id"><label class="field-label">Message<textarea v-model="editingResponseNotes" class="form-textarea" maxlength="4000" rows="3" /></label><div class="more-info-actions"><button class="button button-secondary" type="button" :disabled="saving||!editingResponseNotes.trim()" @click="saveResponseEdit(entry.id,response.id)">Save Message</button><button class="text-button" type="button" @click="editingResponseId=''">Cancel</button></div></template><p v-else>{{response.notes}}</p><small>{{formatDisplayDate(submissionDateOnly(response.respondedAt))}}<template v-if="response.editedAt"> · Edited</template><template v-if="response.readAt"> · Read {{formatDisplayDate(submissionDateOnly(response.readAt))}}</template></small><button v-if="request.status!=='denied'&&!response.readAt&&!entry.resolvedAt&&(response.respondedAs==='reviewer')===canStaffEdit&&editingResponseId!==response.id" class="text-button" type="button" @click="startResponseEdit(response)">Edit Message</button></article></div>
                <div v-if="(identity==='agency' || canStaffEdit) && canReplyToMoreInfo(request,entry.id) && !unreadOutgoingMessage(entry,canStaffEdit)" class="more-info-reply"><label class="field-label" :for="`more-info-reply-${entry.id}`">Response<textarea :id="`more-info-reply-${entry.id}`" v-model="moreInfoReplies[entry.id]" class="form-textarea" maxlength="4000" rows="3" placeholder="Type your message here." :disabled="saving" /></label><button class="button button-secondary" type="button" :disabled="saving || !moreInfoReplies[entry.id]?.trim()" @click="sendMoreInfoReply(entry.id)">Send Response</button></div>
                <p v-if="unreadOutgoingMessage(entry,canStaffEdit)" class="muted-copy">Your message has not been read yet. Click Edit Message above to make changes.</p>
                <div v-if="canStaffEdit && deletingMoreInfoId===entry.id" class="more-info-delete-confirmation"><p>Are you sure you want to delete this note?</p><div class="more-info-actions"><button class="button button-danger" type="button" :disabled="saving" @click="saveMoreInfoNote('delete',entry.id)">Delete Note</button><button class="button button-ghost" type="button" :disabled="saving" @click="deletingMoreInfoId=''">Cancel</button></div></div>
            </component>
            <div v-if="canStaffEdit && showMoreInfoComposer && !hasActiveMoreInfoConversation" class="more-info-compose"><label class="field-label">Notes<textarea v-model="moreInfoNotes" class="form-textarea" maxlength="4000" rows="3" placeholder="Describe what is missing and/or what needs to be addressed." /></label><div class="more-info-compose-actions"><button class="button button-secondary" type="button" :disabled="saving || !moreInfoNotes.trim()" @click="sendMoreInfo">Send to LA</button><button class="button button-ghost" type="button" :disabled="saving" @click="cancelMoreInfoDraft">Cancel</button></div></div>
            <p v-if="moreInfoNotice" role="status">{{moreInfoNotice}}</p>
            </div>
        </section>
        <section v-if="canStaffEdit || request.status==='denied' || identity==='agency'" ref="reviewDecisionSection" class="detail-section review-decision-section" tabindex="-1">
            <div class="section-heading"><h3>Review Decision</h3><button v-if="canStaffEdit && hasSavedReviewDecision && !editingReviewDecision" type="button" class="text-button review-decision-edit" aria-label="Edit review decision" :disabled="saving" @click="editingReviewDecision=true">Edit</button><button v-else-if="canStaffEdit && editingReviewDecision" type="button" class="text-button review-decision-edit" :disabled="saving" @click="cancelReviewDecisionEdit">Cancel</button></div>
            <p v-if="canCollapseReviewDetails && request.status!=='denied'" class="review-approved"><strong>{{request.status==='needs_info'?'Request More Info':'Approved'}}</strong></p>
            <p v-else-if="identity==='agency' && request.status!=='denied'" class="review-approved"><strong>{{request.status==='needs_info'?'Request More Info':'Awaiting CDPH/WIC Decision'}}</strong></p>
            <template v-if="request.status==='denied'">
                <p class="review-denied"><strong>Denied</strong></p>
                <div class="detail-grid"><div class="detail-field-wide"><strong class="preserve-lines">{{request.denialReason || request.staffNotes || '—'}}</strong></div></div>
            </template>
            <div v-if="canStaffEdit && (!hasSavedReviewDecision || editingReviewDecision)" class="review-decision-buttons">
                <button class="button button-secondary" :class="{'review-decision-selected':selectedReviewDecision==='request-info'}" :aria-pressed="selectedReviewDecision==='request-info'" type="button" :disabled="saving" @click="openMoreInfo">Request More Info</button>
                <button class="button button-secondary" :class="{'review-decision-selected':selectedReviewDecision==='approve'}" :aria-pressed="selectedReviewDecision==='approve'" type="button" :disabled="saving" @click="chooseReviewDecision('approve')">Approve</button>
                <button class="button button-secondary" :class="{'review-decision-selected':selectedReviewDecision==='deny'}" :aria-pressed="selectedReviewDecision==='deny'" type="button" :disabled="saving" @click="chooseReviewDecision('deny')">Deny</button>
                <button v-if="hasSavedReviewDecision" class="button button-ghost" type="button" :disabled="saving" @click="chooseReviewDecision('clear')">Clear decision</button>
            </div>
        </section>
        <hr v-if="canCollapseReviewDetails && request.status!=='denied'" class="cdph-section-divider" />
        <section v-if="canCollapseReviewDetails && request.status!=='denied'" ref="authorizationSection" class="cdph-workspace" aria-label="State-Issued Formula Authorization" tabindex="-1">
            <header class="cdph-workspace-header"><h3>State-Issued Formula Authorization</h3></header>
        <section
            v-if="canStaffEdit"
            class="detail-section cdph-review-section"
        >
            <fieldset class="cdph-fields" :disabled="draft.status === 'denied'">
            <div :id="`issuance-${request.id}`" class="issuance-heading"><h3>Issuance</h3></div>
            <fieldset v-for="(authorization,formulaIndex) in draft.formulaAuthorizations" :key="`${authorization.productName}-${authorization.productForm}-${authorization.flavor}`" class="authorization-formula">
                <legend v-if="(draft.formulaAuthorizations?.length??0)>1">Formula {{formulaIndex+1}}</legend>
            <RequestAuthorizationFields
                :draft="draft"
                :request="request"
                :authorization="authorization"
                :formula-index="formulaIndex"
                :products="products"
                :identity="identity"
                :saving="saving"
                :split-order-types-enabled="splitOrderTypesEnabled"
                @change-order="changeFormulaOrder"
            />
            <fieldset v-if="localAgencySurplusLots(authorization,formulaIndex).length || assignedUnits(authorization)>0" class="local-surplus-assignment">
                <div class="transfer-heading"><h4>On Hand</h4></div>
                <p class="muted-copy">Available units are shown for each lot. Enter the number to assign to this request, then save the issuance changes.</p>
                <div v-if="localAgencySurplusLots(authorization,formulaIndex).length" class="local-surplus-lots">
                    <div v-for="lot in localAgencySurplusLots(authorization,formulaIndex)" :key="lot.id" class="local-surplus-lot">
                        <div class="surplus-lot-info"><strong>{{transferLotFormulaLabel(lot)}}</strong><small>{{lot.clinicName||'Clinic not specified'}}</small><small>Exp {{formatDisplayDate(lot.expirationDate)}}</small><span>{{localSurplusAvailable(lot,formulaIndex)}} {{unitLabel(localSurplusAvailable(lot,formulaIndex))}} available</span></div>
                        <label class="field-label local-surplus-assign-field">Assign Units<input class="form-input authorization-number" type="number" inputmode="numeric" min="0" :max="localSurplusAvailable(lot,formulaIndex)" :value="authorization.localSurplusAllocations?.find(row=>row.lotId===lot.id)?.units??0" :aria-label="`Units to assign from ${lot.clinicName||'clinic'}, expires ${lot.expirationDate}`" @input="setLocalSurplusAllocation(authorization,lot.id,Math.min(Number(($event.target as HTMLInputElement).value)||0,localSurplusAvailable(lot,formulaIndex)))" /></label>
                    </div>
                </div>
            </fieldset>
            <div v-if="splitOrderTypesEnabled" class="form-grid fulfillment-allocation-fields">
                <label class="field-label">Standard Order Cases<input v-model.number="authorization.standardCases" class="form-input authorization-number" type="number" inputmode="numeric" min="0" step="1" :aria-label="`Formula ${formulaIndex+1} Standard Order Cases`" :disabled="saving" /></label>
                <label class="field-label">Special Order Cases<input v-model.number="authorization.specialOrderCases" class="form-input authorization-number" type="number" inputmode="numeric" min="0" step="1" :aria-label="`Formula ${formulaIndex+1} Special Order Cases`" :disabled="saving" /></label>
                <p class="muted-copy fulfillment-allocation-help">Standard and Special Order cases must total {{authorization.approvedCases??0}} cases to order.</p>
            </div>
            <RequestTransferAllocation :lots="otherAgencyLots(authorization)" :selections="formulaTransferSelections(authorization)" :agencies="transferAgencies?.agencies??[]" :busy="saving" :loaded="!!transferStock" :load-error="!!transferStockError" :message="issuanceTransferMessage" @select="(lot,units)=>selectIssuanceTransfer(authorization,lot,units)" @reserve="reserveIssuanceTransfer" @remove="removeIssuanceTransfer" @refresh="refreshTransferStock" />
            <RequestSupplyPlan :published-shipments="requestShipments(request)" :request="{...request,...draft}" :authorization="authorization" :units-per-case="authorizationUnitsPerCase(authorization)" />
            </fieldset>
            <label class="field-label">
                Next Steps
                <textarea v-model="draft.nextSteps" class="form-textarea" placeholder="Add instructions or follow-up notes." />
            </label>
            <div class="staff-save-action">
                <button
                    class="button button-secondary"
                    type="button"
                    :disabled="saving"
                    @click="saveStaffFields"
                >
                    {{ staffSaveStatus === 'saving' ? 'SAVING…' : 'SAVE' }}
                </button>
                <span
                    v-if="staffSaveStatus !== 'idle'"
                    class="save-feedback"
                    :class="`save-feedback-${staffSaveStatus}`"
                    role="status"
                >
                    {{ staffSaveStatus === 'saving' ? 'Saving…' : staffSaveStatus === 'saved' ? 'Saved' : 'Save failed' }}
                </span>
            </div>
            </fieldset>
        </section>

        <McKessonOrderPanel v-if="canStaffEdit" :key="request.id" :request="request" :products="products ?? []" />
        <RequestIssuanceSummary v-if="identity==='agency'" :request="request" :products="products" @record-issue="recordLocalSurplusIssue" />

        <section ref="shippingSection" :id="`shipments-${request.id}`" class="detail-section" tabindex="-1">
            <div class="section-heading"><h3>Shipping</h3><button v-if="canStaffEdit && request.status!=='denied' && editingSection!=='shipping'" class="text-button" type="button" @click="startEditing('shipping')">Edit</button></div>
            <form v-if="editingSection==='shipping' && draft.shipping" class="shipping-detail-editor" @submit.prevent="saveFormSection">
                <div class="form-grid compact-form-grid">
                    <label class="field-label detail-field-wide">Local Agency<input :value="agency?.name" class="form-input" disabled /></label>
                    <label class="field-label">Contact<input v-model="draft.shipping.attention" class="form-input" maxlength="250" /></label>
                    <label class="field-label">Phone Number<input v-model="draft.shipping.phone" class="form-input" type="tel" @blur="draft.shipping.phone=formatPhoneNumber(draft.shipping.phone??'')" /></label>
                    <label class="field-label detail-field-wide">Email<input v-model="draft.shipping.email" class="form-input" type="email" /></label>
                    <label class="field-label detail-field-wide">Street Address<input v-model="draft.shipping.addressLine1" class="form-input" required maxlength="250" /></label>
                    <label class="field-label detail-field-wide">Address Line 2<input v-model="draft.shipping.addressLine2" class="form-input" maxlength="250" /></label>
                    <label class="field-label">City<input v-model="draft.shipping.city" class="form-input" required maxlength="250" /></label>
                    <div class="form-grid shipping-state-zip"><label class="field-label">State<input v-model="draft.shipping.state" class="form-input" required maxlength="2" /></label><label class="field-label">ZIP Code<input v-model="draft.shipping.postalCode" class="form-input" required maxlength="10" /></label></div>
                </div>
                <p v-if="error" class="form-error" role="alert">{{error}}</p>
                <div class="form-actions"><button class="button button-ghost" type="button" :disabled="saving" @click="cancelEditing">Cancel</button><button class="button button-secondary" type="submit" :disabled="saving">Save Section</button></div>
            </form>
            <div v-if="canStaffEdit && shipmentCaseBalance" class="shipment-case-summary">
                <strong v-if="shipmentFeatures.caseReconciliation">Case Reconciliation</strong>
                <p v-if="shipmentFeatures.caseReconciliation">Original Approved: {{shipmentCaseBalance.approved ?? 'Not set'}} · Received: {{formatCaseEquivalent(shipmentCaseBalance.received)}} · Returned/Destroyed: {{formatCaseEquivalent(shipmentCaseBalance.disposed)}} · Damaged Held: {{formatCaseEquivalent(shipmentCaseBalance.damaged)}} · Usable Cases Kept (equivalent): {{formatCaseEquivalent(shipmentCaseBalance.retained)}}</p>
                <p v-if="shipmentFeatures.caseReconciliation && shipmentCaseBalance.excess>0" class="shipment-case-warning" role="alert"><strong>Approved case limit exceeded:</strong> {{formatCaseEquivalent(shipmentCaseBalance.retained)}} usable cases kept vs {{shipmentCaseBalance.approved}} originally approved ({{formatCaseEquivalent(shipmentCaseBalance.excess)}} excess). Review all original and replacement deliveries.</p>
                <p v-if="shipmentFeatures.potentialOverDelivery && shipmentCaseBalance.projectedExcess>0" class="shipment-case-warning" role="alert"><strong>Potential over-delivery:</strong> outstanding original and replacement shipments could exceed the approved limit by {{formatCaseEquivalent(shipmentCaseBalance.projectedExcess)}} cases. Review before sending more product.</p>
                <p v-if="shipmentFeatures.caseReconciliation && shipmentCaseBalance.needsApproval" class="shipment-case-warning" role="alert">Set the approved case limit so received quantities can be checked.</p>
            </div>
            <p v-if="canStaffEdit && shortcutNotice" role="status">{{shortcutNotice}}</p>
            <template v-if="editingSection!=='shipping'">
            <div class="detail-grid shipping-contact-details">
                <div><span>Contact</span><strong>{{request.shipping?.attention || rep?.name || '—'}}</strong></div>
                <div><span>Phone Number</span><strong>{{(request.shipping?.phone || rep?.phone)?formatPhoneNumber(request.shipping?.phone || rep?.phone || ''):'—'}}</strong></div>
                <div class="detail-field-wide"><span>Email</span><strong>{{request.shipping?.email || rep?.email || '—'}}</strong></div>
            </div>
            <div class="shipping-address-field"><span class="detail-field-heading">Shipping Address</span><address v-if="request.shipping" class="shipping-preview shipping-destination"><strong>{{agency?.name || '—'}}</strong><template v-if="request.shipping.attention || rep?.name"><br />Attn: {{request.shipping.attention || rep?.name}}</template><br />{{request.shipping.addressLine1}}<template v-if="request.shipping.addressLine2"><br />{{request.shipping.addressLine2}}</template><br />{{request.shipping.city}}, {{request.shipping.state}} {{request.shipping.postalCode}}</address><p v-else class="shipping-destination muted-copy">No shipping address saved for this request.</p></div>
            </template>
            <div class="shipment-list">
                <p v-if="splitOrderTypesEnabled" v-for="progress in fulfillmentProgress(request).filter(row=>row.special.allocated>0)" :key="progress.formula" class="fulfillment-progress" role="status">
                    <strong>{{progress.formula}}</strong> · Standard: {{progress.standard.shipped}}/{{progress.standard.allocated}} case(s) shipped<template v-if="progress.standard.pending"> · {{progress.standard.pending}} Standard case(s) pending</template> · Special Order: {{progress.special.shipped}}/{{progress.special.allocated}} case(s) shipped<template v-if="progress.special.pending"> · {{progress.special.pending}} pending</template>
                </p>
                <details v-for="(shipment,index) in canStaffEdit ? draft.shipments : requestShipments(request)" :key="index" :class="{'shipment-compact-row':shipmentFeatures.compactRows}" :open="!shipmentFeatures.compactRows">
                    <summary v-if="shipmentFeatures.compactRows" class="shipment-compact-summary">
                        <span class="shipment-compact-title"><template v-if="requestShipments(request).length>1">Shipment {{index+1}} · </template>{{compactShipmentSummary(request,shipment).formula}} · {{shipmentFulfillmentType(request,shipment)==='special'?'Special Order':'Standard'}} · {{compactShipmentSummary(request,shipment).quantity}}</span>
                        <span class="shipment-compact-status">{{compactShipmentSummary(request,shipment).status}}</span>
                    </summary>
                    <fieldset class="shipment-card">
                    <legend v-if="!shipmentFeatures.compactRows">{{ (canStaffEdit ? draft.shipments?.length : requestShipments(request).length)! > 1 ? `Shipment ${index + 1}` : 'Shipment' }}</legend>
                    <div class="detail-grid">
                        <label v-if="editingShipmentPlan(shipment,index) && !shipment.etaSentAt && shipment.shipmentSource!=='agency'" class="field-label detail-field-wide">Formula<select :value="shipmentFormulaKey(shipmentFormula(shipment))" class="form-input" :aria-label="`Shipment ${index+1} Formula`" :disabled="saving || shipmentFormulaChoices.length===1" @change="selectShipmentFormula(shipment,($event.target as HTMLSelectElement).value)"><option value="">Select Formula</option><option v-for="formula in shipmentFormulaChoices" :key="shipmentFormulaKey(formula)" :value="shipmentFormulaKey(formula)">{{shipmentFormulaLabel(formula)}}</option></select></label>
                        <div v-else class="detail-field-wide"><span>Formula</span><strong>{{shipmentFormulaLabel(shipmentFormula(shipment))}}</strong></div>
                        <label v-if="splitOrderTypesEnabled && editingShipmentPlan(shipment,index)" class="field-label">Fulfillment Type<select :value="shipment.fulfillmentType??(shipmentFulfillmentType(request,shipment)??'')" class="form-input" :aria-label="`Shipment ${index+1} Fulfillment Type`" :disabled="saving || !!requestShipments(request)[index]?.etaSentAt" @change="shipment.fulfillmentType=($event.target as HTMLSelectElement).value as 'standard'|'special'"><option value="">Select type</option><option value="standard">Standard</option><option value="special">Special Order</option></select></label>
                        <div v-else-if="splitOrderTypesEnabled"><span>Fulfillment Type</span><strong>{{shipmentFulfillmentType(request,shipment)==='special'?'Special Order':'Standard'}}</strong></div>
                        <label v-if="editingShipmentPlan(shipment,index) && shipment.shipmentSource!=='agency'" class="field-label detail-field-wide">Shipment Source<select :value="shipment.shipmentSource??''" class="form-input" :aria-label="`Shipment ${index+1} Source`" :disabled="saving || !!requestShipments(request)[index]?.etaSentAt" @change="changeShipmentSource(shipment,($event.target as HTMLSelectElement).value)"><option disabled value="">Select source</option><option value="distributor">Distributor</option></select></label>
                        <template v-if="shipment.shipmentSource==='agency'">
                            <div><span>From</span><strong>{{shipment.sourceAgencyName||transferAgencies?.agencies.find(a=>a.id===shipment.sourceAgencyId)?.name||'Agency not selected'}}<br />{{shipment.sourceClinicName || 'Clinic not specified'}}</strong><small v-if="shipment.sourceClinicAddress">Pickup: {{formatClinic(shipment.sourceClinicAddress)}}</small></div>
                            <div><span>To</span><strong>{{agency?.name}}</strong></div>
                            <a v-if="canStaffEdit && !shipment.transferId" class="text-button" :href="`#issuance-${request.id}`">Select and reserve transfer stock in Issuance</a>
                        </template>
                        <template v-else>
                        <label v-if="editingShipmentPlan(shipment,index)" class="field-label">Distributor<select :value="shipment.distributorId ?? ''" class="form-input" :aria-label="`Shipment ${index+1} Distributor`" :disabled="saving" @change="selectDistributor(shipment,($event.target as HTMLSelectElement).value)"><option value="">{{!shipment.distributorId && shipment.supplier?`${shipment.supplier} (legacy supplier)`:'Select Distributor'}}</option><option v-for="item in distributorData?.distributors" :key="item.id" :value="item.id">{{item.name}}</option></select></label>
                        <div v-else><span>Distributor</span><strong>{{shipment.supplier || '—'}}</strong></div>
                        </template>
                        <template v-if="hasTransferLabelRequest(shipment)">
                        <label v-if="editingShipmentLogistics(shipment,index)" class="field-label">ETA<input v-model="shipment.eta" class="form-input" type="date" :aria-label="`Shipment ${index+1} ETA`" :disabled="saving" /></label>
                        <div v-else><span>ETA</span><strong>{{shipment.shipmentSource==='agency' && shipment.transferStatus==='reserved' && identity==='agency' ? 'Pending GSO pickup' : formatDisplayDate(shipment.eta)}}</strong></div>
                        </template>
                        <template v-if="shipment.shipmentSource==='agency'">
                            <div><span>Cases to Transfer</span><strong>{{shipment.casesShipped}}</strong></div><div><span>Units to Transfer</span><strong>{{shipment.looseUnitsShipped??0}}</strong></div>
                            <div class="detail-field-wide"><span>Total Transfer Quantity</span><strong>{{shipment.transferQuantity??shipment.unitsToTransfer??0}} {{unitLabel(shipment.transferQuantity??shipment.unitsToTransfer??0)}}</strong></div>
                        </template>
                        <template v-else-if="shipmentFeatures.casesShipped">
                        <label v-if="editingShipmentPlan(shipment,index)" class="field-label">Cases Shipped<input v-model.number="shipment.casesShipped" class="form-input" type="number" min="0" :aria-label="`Shipment ${index+1} Cases Shipped`" :disabled="saving" /></label>
                        <div v-else><span>Cases Shipped</span><strong>{{shipment.casesShipped}}<template v-if="shipmentFeatures.quantityTracking && shipment.looseUnitsShipped"> + {{shipment.looseUnitsShipped}} loose {{unitLabel(shipment.looseUnitsShipped)}}</template></strong></div>
                        <label v-if="shipmentFeatures.quantityTracking && editingShipmentPlan(shipment,index) && shipment.replacementFor!==undefined" class="field-label">Loose Units Shipped<input v-model.number="shipment.looseUnitsShipped" class="form-input" type="number" min="0" :max="(shipment.unitsPerCase??1)-1" :disabled="saving || shipment.replacementBasis==='cases'" :aria-label="`Shipment ${index+1} Loose Units Shipped`" /></label>
                        </template>
                        <template v-if="shipment.shipmentSource!=='agency' || shipment.transferStockConfirmedAt">
                        <label v-if="shipment.shipmentSource==='agency'" class="field-label detail-field-wide">Carrier<input value="GSO" class="form-input" readonly :aria-label="`Shipment ${index+1} Carrier`" /></label>
                        <label v-else-if="editingShipmentLogistics(shipment,index)" class="field-label detail-field-wide">Carrier<select v-model="shipment.carrier" class="form-input" :aria-label="`Shipment ${index+1} Carrier`" :disabled="saving"><option value="fedex">FedEx</option><option value="dhl">DHL</option><option value="ups">UPS</option></select></label>
                        <div v-else><span>Carrier</span><strong>{{shipment.carrier==='agency'?'Agency Delivery':shipment.carrier.toUpperCase()}}</strong></div>
                        <label v-if="editingShipmentLogistics(shipment,index)" class="field-label detail-field-wide">Tracking Numbers<textarea v-tracking-size :value="shipment.trackingNumbers.join('\n')" class="form-textarea shipment-tracking-input" placeholder="Enter one tracking number per line." :aria-label="`Shipment ${index+1} Tracking Numbers`" :disabled="saving" @input="setShipmentTracking(shipment,($event.target as HTMLTextAreaElement).value)" /></label>
                        <div v-else class="detail-field-wide"><span>{{shipment.shipmentSource==='agency'?'Tracking / Delivery Reference':'Tracking Numbers'}}</span><strong>{{shipment.trackingNumbers.join(', ') || 'N/A'}}</strong></div>
                        </template>
                    </div>
                    <p v-if="canStaffEdit && shipment.transferId && shipment.transferStatus==='reserved'" role="status">{{shipment.transferStockConfirmedAt?'✓ Sending agency confirmed product availability. Provide the shipping labels and send shipping details.':'Awaiting confirmation that the sending Local Agency physically has the reserved product.'}}</p>
                    <TransferShippingLabels v-if="shipment.transferId" :transfer-id="shipment.transferId" :can-upload="canStaffEdit" :allow-upload="shipment.transferStatus==='reserved' && !!shipment.transferStockConfirmedAt" @ready="transferLabelsReady[shipment.transferId!]= $event" />
                    <ShipmentReceiptPanel :key="`receipt-${request.id}-${index}`" v-if="requestShipments(request)[index]" :request="request" :shipment="requestShipments(request)[index]!" :index="index" :can-confirm="canRepEdit" @editing="value=>receiptEditors[index]=value" :catalog-units-per-case="shipmentCatalogSize(requestShipments(request)[index]!)" :disabled="saving" @updated="applyShipmentIssueResult" />
                    <ShipmentCasePanel :key="`cases-${request.id}-${index}`" v-if="shipmentFeatures.quantityTracking && requestShipments(request)[index] && (!canStaffEdit || shipmentReceiptKey(shipment)===shipmentReceiptKey(requestShipments(request)[index]!))" :request="request" :shipment="requestShipments(request)[index]!" :index="index" :can-manage="canStaffEdit" :disabled="saving" @updated="applyShipmentIssueResult" />
                    <ShipmentIssuePanel :key="`${request.id}-${index}`" v-if="requestShipments(request)[index] && (!canStaffEdit || shipmentReceiptKey(shipment)===shipmentReceiptKey(requestShipments(request)[index]!))" :request="request" :shipment="requestShipments(request)[index]!" :index="index" :can-report="canRepEdit" :receipt-editing="!!receiptEditors[index]" :catalog-units-per-case="shipmentCatalogSize(requestShipments(request)[index]!)" :disabled="saving" @updated="applyShipmentIssueResult" />
                    <div v-if="shipment.shipmentSource==='agency'" class="shipping-save-action">

                        <template v-if="canStaffEdit && shipment.transferId && shipment.transferStatus==='reserved'">
                            <button v-if="hasTransferLabelRequest(shipment)" class="button button-secondary" type="button" :disabled="saving || !shipment.transferStockConfirmedAt || !transferLabelsReady[shipment.transferId!]" @click="editOrSendTransferEta(index)">{{sendingEtaIndex===index?'Sending…':shipment.transferEtaSentAt?(editingShipmentLogistics(shipment,index)?'Send Shipping Update':'Edit Shipping Details'):'Send Labels & Shipping Details'}}</button>
                            <button v-if="shipment.transferEtaSentAt && editingShipmentLogistics(shipment,index)" class="button button-ghost" type="button" :disabled="saving" @click="cancelEtaEdit(index)">Cancel</button>
                            <span v-if="shipment.transferEtaSentAt && !editingShipmentLogistics(shipment,index)" class="shipment-sent-status" role="status">✓ ETA Sent</span>
                        </template>
                        <button v-if="canStaffEdit && canDeleteShipment({...request,shipmentDrafts:draft.shipments},index)" type="button" class="text-button" :disabled="saving" :aria-label="`Delete Shipment ${index+1}`" @click="deletingShipmentIndex=index">Delete Shipment</button>
                        <span v-if="shipment.transferId && shipment.transferStatus==='reserved'" class="shipment-sent-status" role="status"><span aria-hidden="true">✓</span> Transfer Requested</span><span v-else-if="shipment.transferId" :class="shipment.transferStatus==='received'?'shipment-sent-status':'shipment-transit-status'" role="status"><span v-if="shipment.transferStatus!=='received'" aria-hidden="true">→</span> {{shipment.transferStatus==='received'?'Confirmed Receipt':'In Transit'}}</span>
                        <NuxtLink v-if="shipment.transferId" :to="{path:'/surplus',query:{transfer:shipment.transferId},hash:`#transfer-${shipment.transferId}`}" class="text-button">View Transfer</NuxtLink>
                        <p v-if="transferAuthorizationIndex===index && transferAuthorizationMessage" class="form-error transfer-authorization-error" role="alert">{{transferAuthorizationMessage}}</p>
                    </div>
                    <div v-else-if="canStaffEdit && !shipmentReceived(request,shipment) && shipment.receivedCases===undefined && !shipment.issue && !shipment.deletedIssues?.length" class="shipping-save-action">
                        <button class="button button-secondary" type="button" :disabled="saving" :aria-label="`${shipment.etaSentAt?(editingShipmentPlan(shipment,index)?'Send Update':'Edit ETA'):'Send ETA'} for shipment ${index+1}`" @click="editOrSendEta(index)">{{ sendingEtaIndex === index ? 'Sending…' : shipment.etaSentAt ? (editingShipmentPlan(shipment,index)?'Send Update':'Edit ETA') : 'Send ETA' }}</button>
                        <button v-if="shipment.etaSentAt && editingShipmentPlan(shipment,index)" class="button button-ghost" type="button" :disabled="saving" :aria-label="`Cancel ETA edit for shipment ${index+1}`" @click="cancelEtaEdit(index)">Cancel</button>
                        <button v-if="canStaffEdit && canDeleteShipment({...request,shipmentDrafts:draft.shipments},index)" type="button" class="text-button" :disabled="saving" :aria-label="`Delete Shipment ${index+1}`" @click="deletingShipmentIndex=index">Delete Shipment</button>
                        <span v-if="!shipment.etaSentAt" class="save-feedback" role="status">Draft · Not sent</span><span v-else-if="!shipmentHasUnsentChanges(shipment,requestShipments(request)[index])" class="shipment-sent-status" role="status"><span aria-hidden="true">✓</span> {{shipmentPublishNotice?.index===index && shipmentPublishNotice.updated ? 'Update Sent' : 'ETA Sent'}}</span>
                    </div>
                    </fieldset>
                </details>
            </div>
            <template v-if="canStaffEdit">
                <p v-if="shipmentDeleteNotice" class="save-feedback save-feedback-saved" role="status">{{shipmentDeleteNotice}}</p>
                <button class="text-button" type="button" @click="draft.shipments = [...(draft.shipments ?? []), {...blankShipment(),unitsPerCase:(request.requestedFormulas?.length ?? 1)<=1?selectedProduct?.unitsPerCase:undefined}]">+ Add another shipment</button>
                <div class="shipping-save-action">
                    <button class="button button-ghost" type="button" :disabled="saving || !draft.shipments?.length" @click="saveShipments()">Save Shipments</button>
                    <span v-if="shippingSaveStatus !== 'idle'" class="save-feedback" :class="`save-feedback-${shippingSaveStatus}`" role="status">{{ shippingSaveStatus === 'saving' ? 'Saving…' : shippingSaveStatus === 'saved' ? 'Draft saved · Not sent to Local Agency' : 'Save failed' }}</span>
                </div>
            </template>
            <p
                v-if="photoNames.length"
                class="muted-copy"
            >
                {{ photoNames.join(', ') }}
            </p>
            <div v-if="canStaffEdit && canRepEdit && reportingSurplus" class="benefit-allocation-editor">
                <div class="panel-heading">
                    <div>
                        <h4>Surplus</h4>
                        <span>Use one row per formula and expiration date.</span>
                    </div>
                </div>
                <p v-if="surplusClinicError" role="alert">Storage clinics could not be loaded. Try again before selecting a clinic.</p>
                <div v-for="(item, index) in draft.surplusItems" :key="index" class="surplus-entry-row">
                    <label class="field-label">Formula<input v-model="item.productName" class="form-input" /></label>
                    <label class="field-label">Units<input v-model.number="item.units" class="form-input" type="number" min="0" /></label>
                    <label class="field-label">Storage clinic<select v-model="item.clinicId" class="form-input"><option :value="undefined">Clinic not specified</option><option v-for="c in surplusClinics?.clinics" :key="c.id" :value="c.id">{{c.clinicName}}</option></select></label>
                    <label class="field-label">Expiration<input v-model="item.expirationDate" class="form-input" type="date" /></label>
                    <button class="icon-button" type="button" aria-label="Remove surplus row" @click="requestRemoveSurplusItem(index)">×</button>
                </div>
                <div class="surplus-add-row-action">
                    <button class="text-button" type="button" @click="addSurplusItem">+ Add row</button>
                </div>
            </div>
            <div v-else-if="canStaffEdit && canRepEdit" class="confirmation-response-actions">
                <button class="button button-primary report-surplus-button" type="button" @click="startSurplusReport">Report Surplus</button>
            </div>
            <div v-if="canStaffEdit && canRepEdit && reportingSurplus" class="agency-save-action">
                <button
                v-if="canRepEdit"
                class="button button-secondary"
                type="button"
                :disabled="saving"
                @click="saveAgencyUpdate"
                >
                    {{ agencySaveStatus === 'saving' ? 'SAVING…' : 'SAVE' }}
                </button>
                <span v-if="agencySaveStatus !== 'idle'" class="save-feedback" :class="`save-feedback-${agencySaveStatus}`" role="status">
                    {{ agencySaveStatus === 'saving' ? 'Saving…' : agencySaveStatus === 'saved' ? 'Saved' : 'Save failed' }}
                </span>
            </div>
        </section>
            <div v-if="canGenerateAuthorizationForm(request)" class="authorization-downloads"><a class="button button-secondary" :href="`/api/requests/${request.id}/authorization-form.pdf`" target="_blank" rel="noopener">Print / Download Authorization</a><details v-if="(request.authorizationVersions?.length??0)>1"><summary>Earlier authorization versions</summary><p v-for="version in request.authorizationVersions" :key="version.id"><a :href="`/api/requests/${request.id}/authorization-form.pdf?version=${version.id}`" target="_blank" rel="noopener">{{formatDisplayDate(submissionDateOnly(version.sentAt))}} · Shipment {{version.shipmentIndex+1}}</a></p></details></div>
        </section>
        <section v-if="anticipatedSurplusRows.length" class="detail-section anticipated-surplus-section" aria-labelledby="anticipated-surplus-heading">
            <div class="section-heading"><h3 id="anticipated-surplus-heading">Anticipated Surplus</h3></div>
            <p class="muted-copy">The Local Agency should verify the actual count and expiration date for anticipated surplus.</p>
            <article v-for="forecast in anticipatedSurplusRows" :key="forecast.id" class="anticipated-surplus-row">
                <div><strong>{{forecast.formula_name}} · {{formulaFormLabel(forecast.form)}}<template v-if="forecast.flavor"> · {{forecast.flavor}}</template></strong><small>{{forecast.clinic_name||'Clinic not specified'}} · Due {{formatDisplayDate(forecast.due_date)}}</small></div>
                <div><span>Anticipated</span><strong>{{forecast.expected_units}} {{unitLabel(forecast.expected_units)}}</strong></div>
                <div><span>Status</span><strong>{{forecast.status==='awaiting-count'?'Needs Local Agency verification':forecast.status==='pending-review'?'Verified · Pending CDPH/WIC review':forecast.status==='reconciled'?'Verified':'Closed'}}</strong></div>
                <div v-if="forecast.actual_units!==null"><span>Actual</span><strong>{{forecast.actual_units}} {{unitLabel(forecast.actual_units)}}</strong></div>
                <NuxtLink v-if="identity==='agency' && forecast.status==='awaiting-count'" class="button button-secondary" :to="{path:'/surplus',query:{forecast:forecast.id}}">Verify Count</NuxtLink>
            </article>
        </section>
        <div v-if="canStaffEdit && allShipmentsConfirmed(request)" class="authorization-downloads detail-section"><a class="button button-secondary" :href="`/api/requests/${request.id}/shipment-confirmation.pdf`" target="_blank" rel="noopener">Download Shipment Confirmation</a></div>
        <hr v-if="canCollapseReviewDetails && request.status!=='denied'" class="cdph-section-divider" />

        <div v-if="canStaffEdit && deletingShipmentIndex!==null" class="confirmation-backdrop" @click.self="!saving && (deletingShipmentIndex=null)" @keydown.esc="!saving && (deletingShipmentIndex=null)">
            <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-shipment-title">
                <h3 id="delete-shipment-title">Are you sure you want to delete this shipment?</h3>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" :disabled="saving" @click="deletingShipmentIndex=null">Cancel</button>
                    <button class="button button-danger" type="button" :disabled="saving" @click="confirmDeleteShipment">{{saving?'Deleting…':'Delete Shipment'}}</button>
                </div>
                <p v-if="error" class="form-error" role="alert">{{error}}</p>
            </div>
        </div>

        <div v-if="pendingDecision" class="confirmation-backdrop" @click.self="pendingDecision = null">
            <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="deny-decision-title">
                <h3 id="deny-decision-title">Are you sure you want to deny this request?</h3>
                <label class="field-label">Reason for Denial<textarea v-model="denialReason" class="form-textarea" maxlength="4000" rows="3" required placeholder="Enter the reason for denial." :disabled="saving" /></label>
                <p v-if="error" class="form-error" role="alert">{{error}}</p>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" @click="pendingDecision = null">Cancel</button>
                    <button class="button button-danger" type="button"  :disabled="saving || !denialReason.trim()" @click="confirmDenial">Confirm Denial</button>
                </div>
            </div>
        </div>

        <div v-if="surplusRemovalIndex !== null" class="confirmation-backdrop" @click.self="surplusRemovalIndex = null">
            <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="remove-surplus-title">
                <h3 id="remove-surplus-title">Remove surplus row?</h3>
                <p>This surplus row will be removed from the form.</p>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" @click="surplusRemovalIndex = null">Cancel</button>
                    <button class="button button-danger" type="button" @click="confirmRemoveSurplusItem">Remove</button>
                </div>
            </div>
        </div>

    </aside>
</template>

<style scoped>
.review-decision-section {border:1px solid color-mix(in srgb,#002595 35%,var(--line));border-radius:10px;padding:10px 12px;background:color-mix(in srgb,#002595 4%,var(--surface));}
.review-decision-section > .section-heading {background:#141F68;margin:-10px -12px 8px;padding:8px 12px;border-radius:9px 9px 0 0;}
.review-decision-section > .section-heading h3 {color:#fff;margin:0;font-size:1rem;font-weight:600;line-height:1.4;}
.review-decision-section .review-decision-edit {color:#fff;text-decoration:underline;text-underline-offset:3px;}
.review-decision-section .review-approved,.review-decision-section .review-denied {margin:0;}
.more-info-compose-actions {display:flex;flex-wrap:wrap;gap:8px;}
.fulfillment-allocation-fields {grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:8px 0 12px;}
.fulfillment-allocation-help {grid-column:1/-1;margin:0;font-size:.85rem;}
.fulfillment-progress {padding:8px 10px;margin:0 0 8px;background:color-mix(in srgb,#002595 5%,var(--surface));border-radius:6px;font-size:.9rem;}
.review-decision-buttons {display:flex;flex-wrap:wrap;gap:10px;}
.review-decision-buttons .button.review-decision-selected,
.review-decision-buttons .button.review-decision-selected:hover {background:#002595;border-color:#002595;color:#fff;}
.review-approved {color:#007888;font-weight:600;}
.review-denied {color:#AE5018;}
.review-decision-section > .button {margin-top:12px;}
.more-info-section {background:color-mix(in srgb,#007888 6%,var(--surface));border:1px solid color-mix(in srgb,#007888 45%,var(--line));border-radius:10px;padding:18px;margin:16px 0;}
.more-info-section > .section-heading {margin:-18px -18px 16px;padding:14px 18px;background:#002595;border-radius:9px 9px 0 0;display:flex;flex-wrap:wrap;gap:12px;}
.more-info-toolbar {display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.more-info-toolbar .button {font-size:14px;color:#fff;background:transparent;border-color:#A9D3CA;}
.more-info-toolbar .more-info-resolve {background:#007888;border-color:#007888;}
.more-info-open-status {font-size:13px;color:#fff;}
.more-info-correction {padding:12px;margin-bottom:14px;background:var(--surface-raised);border:1px solid var(--line);border-radius:8px;}
.more-info-correction p {margin:0 0 8px;}
.more-info-section .section-heading h3 {color:#fff;margin:0;font-size:1rem;font-weight:600;line-height:1.4;}
.more-info-history {padding:12px 14px;margin-bottom:12px;background:var(--surface);border:1px solid var(--line);border-radius:8px;}
.more-info-history > summary {cursor:pointer;font-weight:600;font-size:14px;color:var(--text);}
.more-info-history[open] > summary {margin-bottom:12px;}
.more-info-responses {display:grid;gap:10px;margin:12px 0 0 16px;}
.more-info-response {padding:10px 12px;border:1px solid var(--line);border-radius:8px;}
.more-info-sender {display:inline-block;font-size:13px;padding:3px 8px;border-radius:5px;color:#fff;background:#002595;}
.from-agency .more-info-sender {background:#007888;}
.more-info-response.from-agency {margin-left:16px;background:color-mix(in srgb,#A9D3CA 12%,var(--surface));}
.more-info-response.from-reviewer {margin-right:16px;background:var(--surface-raised);}
.more-info-response p {white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0;}
.more-info-reply {margin:12px 0 0 16px;display:grid;gap:8px;justify-items:start;}
.more-info-reply .field-label {width:100%;}
.review-details-toggle {display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;padding:14px 16px;margin:12px 0;background:var(--surface-raised);color:var(--text);border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;}
.review-details-toggle:focus-visible {outline:2px solid #902A92;outline-offset:3px;}
.more-info-notes {white-space:pre-wrap;overflow-wrap:anywhere;}
.more-info-compose {display:grid;gap:8px;justify-items:start;}
.more-info-compose .field-label {width:100%;margin:0;gap:5px;}
.more-info-compose .form-textarea {min-height:78px;margin:0;}
.more-info-actions {display:flex;flex-wrap:wrap;gap:12px;margin:8px 0;}
.more-info-delete-confirmation {padding:10px 12px;border:1px solid var(--line);border-radius:8px;margin-top:8px;}
.surplus-entry-row {grid-template-columns:minmax(0,1fr) 80px minmax(120px,1fr) 140px 32px;}
@media(max-width:700px){.surplus-entry-row{grid-template-columns:minmax(0,1fr) 80px;}.surplus-entry-row .icon-button{justify-self:end;}}
.shipment-compact-row {border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);}
.shipment-compact-row + .shipment-compact-row {margin-top:8px;}
.shipment-compact-summary {display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;list-style-position:inside;}
.shipment-compact-title {font-weight:650;}
.shipment-compact-status {text-align:right;color:var(--muted);font-size:.9em;}
.shipment-compact-row[open] > .shipment-compact-summary {border-bottom:1px solid var(--border);}
.shipment-compact-row .shipment-card {margin:0;border:0;}
.shipment-compact-row[open] .shipment-card {padding:16px 14px 14px;}
.matching-surplus-picker {display:grid;gap:8px;min-width:0;}
.matching-surplus-options {display:grid;gap:6px;max-height:240px;overflow:auto;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface-raised);}
.matching-surplus-option {display:flex;align-items:flex-start;gap:10px;min-width:0;padding:7px 8px;border-radius:6px;background:var(--surface);cursor:pointer;}
.matching-surplus-option input {flex:0 0 auto;margin-top:3px;}
.matching-surplus-option > span {display:grid;gap:2px;min-width:0;overflow-wrap:anywhere;}
.matching-surplus-option strong {font-size:.95em;}
.matching-surplus-option small {color:var(--muted);font-size:.88em;line-height:1.35;}
.local-surplus-assignment {display:grid;gap:10px;margin:18px 0;padding:16px;border:1px solid var(--line);border-radius:10px;}
.local-surplus-assignment h4 {margin:0;font-size:1rem;}
.local-surplus-assignment > p {margin:0;font-size:.875rem;line-height:1.5;}
.local-surplus-lots {display:grid;}
.local-surplus-lot {display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--line);}
.local-surplus-lot .surplus-lot-info {display:grid;flex:1 1 190px;gap:3px;}
.local-surplus-lot .surplus-lot-info > strong {font-size:14px;line-height:1.4;}
.local-surplus-lot .surplus-lot-info small {display:block;margin:0;color:var(--muted);font-size:13px;line-height:1.4;}
.local-surplus-lot .surplus-lot-info > span {font-size:14px;line-height:1.4;font-weight:600;}
.local-surplus-assign-field {width:110px;flex:0 0 110px;margin:0;}
.anticipated-surplus-row {display:grid;grid-template-columns:minmax(220px,2fr) repeat(2,minmax(150px,1fr)) auto;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line);}
.anticipated-surplus-row > div {display:grid;gap:3px;}
.anticipated-surplus-row > div > span,.anticipated-surplus-row small {color:var(--muted);font-size:12px;}
@media(max-width:760px){.anticipated-surplus-row{grid-template-columns:1fr 1fr;}.anticipated-surplus-row > div:first-child{grid-column:1/-1;}}
.local-surplus-total {margin:0;text-align:right;}
</style>

<style scoped>
.participant-name-heading {display:flex;align-items:baseline;gap:8px;min-width:0;margin-bottom:8px;}
.participant-name-heading h2 {margin:0;min-width:0;overflow-wrap:anywhere;}
.participant-name-edit {display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:28px;height:28px;padding:5px;border:0;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer;align-self:flex-start;}
.participant-name-edit:hover {background:var(--button-secondary-bg);color:var(--button-secondary-text);}
.participant-name-edit:focus-visible {outline:2px solid currentColor;outline-offset:2px;}
</style>
