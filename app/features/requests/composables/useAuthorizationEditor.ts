import { computed } from 'vue';
import type { ProductRecord, RequestRecord } from '#shared/domain';
import {
    authorizationCatalogProduct,
    candidateProducts,
    enterAuthorizationProductNumber,
} from '#shared/productMatching';
import { applyCatalogOrderDefault } from '#shared/catalogOrderDefaults';
import { formulaOrders } from '#shared/formulaOrders';
import { formatIssuanceMonth, type FormulaAuthorization } from '#shared/formulaAuthorizations';
import { getNextBenefitMonth, subsequentIssuanceMonths } from '#shared/requestOperations';
import { localDate } from '#shared/surplus';

/** Local authorization edits and catalog defaults; persistence remains with the drawer. */
export function useAuthorizationEditor(
    draft: Partial<RequestRecord>,
    products: () => ProductRecord[] | undefined,
    request: () => Partial<RequestRecord> | null,
) {
    const issuanceMonthWindow = computed(() => {
        const date = new Date(`${localDate().slice(0, 7)}-01T00:00:00Z`);
        date.setUTCMonth(date.getUTCMonth() - 1);
        return Array.from(
            {
                length: 7,
            },
            (_, index) => {
                const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + index, 1));
                const value = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
                return {
                    value,
                    label: formatIssuanceMonth(value),
                };
            },
        );
    });
    function authorizationProduct(
        authorization: Pick<FormulaAuthorization, 'productName' | 'productForm' | 'flavor' | 'productCode'>,
    ) {
        return authorizationCatalogProduct(products() ?? [], authorization);
    }
    function authorizationProducts(authorization: FormulaAuthorization) {
        // Keep all catalog flavors available for staff to review against the requested flavor.
        const matches = candidateProducts(products() ?? [], {
            name: authorization.productName,
            form: authorization.productForm,
        }).filter((product) => product.productCode.trim());
        const selected = authorizationProduct(authorization);
        return selected && !matches.some((product) => product.id === selected.id) ? [selected, ...matches] : matches;
    }
    function chooseAuthorizationProduct(index: number, productCode: string) {
        const authorization = draft.formulaAuthorizations?.[index];
        if (!authorization) {
            return;
        }
        Object.assign(authorization, enterAuthorizationProductNumber(authorization, products() ?? [], productCode));
        authorization.approvedCases = undefined;
        applySelectedProductDefault(index);
        recalculateCasesFromUnitsToOrder(index);
    }
    function enterProductNumber(index: number, productCode: string) {
        const authorization = draft.formulaAuthorizations?.[index];
        if (!authorization) {
            return;
        }
        Object.assign(authorization, enterAuthorizationProductNumber(authorization, products() ?? [], productCode));
        applySelectedProductDefault(index);
        recalculateCasesFromUnitsToOrder(index);
    }
    function applySelectedProductDefault(index: number) {
        const authorization = draft.formulaAuthorizations?.[index];
        const product = authorization && authorizationProduct(authorization);
        if (product) {
            Object.assign(draft, applyCatalogOrderDefault(draft, index, product));
        }
    }
    function authorizationUnitsPerCase(authorization: Pick<FormulaAuthorization, 'productName' | 'productForm' | 'flavor' | 'productCode' | 'unitsPerCase'>) {
        return authorization.unitsPerCase ?? authorizationProduct(authorization)?.unitsPerCase;
    }
    function assignedUnits(authorization: FormulaAuthorization) {
        return (authorization.localSurplusAllocations ?? []).reduce((sum, row) => sum + row.units, 0);
    }
    function setLocalSurplusAllocation(authorization: FormulaAuthorization, lotId: string, units: number) {
        const rows = (authorization.localSurplusAllocations ?? []).filter((row) => row.lotId !== lotId);
        if (units > 0) {
            rows.push({
                lotId,
                units,
            });
        }
        authorization.localSurplusAllocations = rows;
        const index = draft.formulaAuthorizations?.indexOf(authorization) ?? -1;
        if (index >= 0) {
            updateUnitsToOrder(index);
        }
    }
    function updateUnitsToOrder(index: number) {
        const authorization = draft.formulaAuthorizations?.[index];
        if (!authorization) {
            return;
        }
        authorization.unitsToOrder = Math.max(0, (authorization.totalUnitsIssued ?? 0) - assignedUnits(authorization));
        recalculateCasesFromUnitsToOrder(index);
    }
    function recalculateCasesFromUnitsToOrder(index: number) {
        const authorization = draft.formulaAuthorizations?.[index];
        if (!authorization) {
            return;
        }
        const size = authorizationUnitsPerCase(authorization);
        if (size && size > 0) {
            authorization.approvedCases = Math.ceil(Math.max(0, authorization.unitsToOrder ?? 0) / size);
        }
        adjustFulfillmentAllocation(index);
    }
    function recalculateAuthorizationCases(index: number) {
        const authorization = draft.formulaAuthorizations?.[index];
        if (!authorization) {
            return;
        }
        authorization.totalUnitsIssued = authorization.benefitIssuances.reduce(
            (sum, row) => sum + (Number.isFinite(row.quantity) ? Math.max(0, row.quantity) : 0),
            0,
        );
        authorization.approvedMonths = authorization.benefitIssuances.filter(
            (row) => row.month && row.quantity > 0,
        ).length;
        updateUnitsToOrder(index);
    }
    function updateTotalUnitsFromIssuances(index: number) {
        recalculateAuthorizationCases(index);
    }
    function addBenefitMonth(formulaIndex: number) {
        const authorization = draft.formulaAuthorizations![formulaIndex]!;
        const issuances = authorization.benefitIssuances;
        const month = getNextBenefitMonth(issuances);
        if (
            !issuances.length ||
            !issuances.at(-1)?.month ||
            !issuanceMonthWindow.value.some((option) => option.value === month)
        ) {
            return;
        }
        if (issuances.some((issuance) => issuance.month === month)) {
            return;
        }
        authorization.benefitIssuances = [
            ...issuances,
            {
                month,
                quantity: 0,
            },
        ];
    }
    function updateFollowingIssuanceMonths(formulaIndex: number, index: number) {
        const authorization = draft.formulaAuthorizations![formulaIndex]!;
        authorization.benefitIssuances = subsequentIssuanceMonths(authorization.benefitIssuances, index);
        recalculateAuthorizationCases(formulaIndex);
    }
    function issuanceMonthOptions(authorization: {
        benefitIssuances: Array<{
            month: string;
        }>;
    }) {
        return [
            ...new Set([
                ...issuanceMonthWindow.value.map((month) => month.value),
                ...authorization.benefitIssuances.map((row) => row.month).filter(Boolean),
            ]),
        ]
            .sort()
            .map((value) => ({
                value,
                label: formatIssuanceMonth(value),
            }));
    }
    function canAddIssuanceMonth(authorization: Pick<FormulaAuthorization, 'benefitIssuances'>) {
        const next = getNextBenefitMonth(authorization.benefitIssuances);
        return (
            !!authorization.benefitIssuances.at(-1)?.month &&
            issuanceMonthWindow.value.some((option) => option.value === next)
        );
    }
    function removeBenefitMonth(formulaIndex: number, index: number) {
        draft.formulaAuthorizations?.[formulaIndex]?.benefitIssuances.splice(index, 1);
        recalculateAuthorizationCases(formulaIndex);
    }
    function adjustFulfillmentAllocation(index: number) {
        const authorization = draft.formulaAuthorizations?.[index];
        if (!authorization || !Number.isSafeInteger(authorization.approvedCases) || authorization.approvedCases! < 0) {
            return;
        }
        if (
            (authorization.standardCases === undefined && authorization.specialOrderCases === undefined) ||
            (authorization.standardCases === 0 && authorization.specialOrderCases === 0)
        ) {
            const special =
                draft.formulaOrders?.[index]?.specialOrder ??
                formulaOrders(request() ?? {})[index]?.specialOrder === true;
            authorization.standardCases = special ? 0 : authorization.approvedCases;
            authorization.specialOrderCases = special ? authorization.approvedCases : 0;
        } else if (authorization.standardCases === 0) {
            authorization.specialOrderCases = authorization.approvedCases;
        } else if (authorization.specialOrderCases === 0) {
            authorization.standardCases = authorization.approvedCases;
        } else {
            authorization.standardCases = Math.max(0, authorization.approvedCases! - authorization.specialOrderCases!);
        }
    }
    return {
        authorizationProduct,
        authorizationProducts,
        chooseAuthorizationProduct,
        enterProductNumber,
        applySelectedProductDefault,
        authorizationUnitsPerCase,
        assignedUnits,
        setLocalSurplusAllocation,
        updateUnitsToOrder,
        recalculateCasesFromUnitsToOrder,
        recalculateAuthorizationCases,
        updateTotalUnitsFromIssuances,
        addBenefitMonth,
        updateFollowingIssuanceMonths,
        issuanceMonthOptions,
        canAddIssuanceMonth,
        removeBenefitMonth,
        adjustFulfillmentAllocation,
    };
}
