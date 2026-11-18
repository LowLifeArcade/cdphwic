import { SEED_REQUESTS } from '../data/seed';
import type { SummaryRecord, ProductRecord } from '../../shared/domain';
import { getMasterLogMonthlyTotals } from './reportStore';

export function buildSummary(products: ProductRecord[] = []): SummaryRecord {
    const unitsByProduct = products.map((product) => ({
        label: product.name,
        value: SEED_REQUESTS.filter((request) => request.productId === product.id).reduce(
            (sum, request) => sum + (request.unitsRequested ?? 0),
            0,
        ),
    })).filter((item) => item.value > 0);

    const topFormulas = [...unitsByProduct].sort((a, b) => b.value - a.value).slice(0, 10);
    const requestsByAgency = [10, 11, 12].map((agencyId) => ({
        label: `Agency ${agencyId}`,
        value: SEED_REQUESTS.filter((request) => request.agencyId === agencyId).length,
    }));

    return {
        unitsByProduct,
        topFormulas,
        requestsByAgency,
        monthlyCases: 84,
        monthlyCapacity: 100,
        averageUnitsPerMonth: 18,
        masterLogByMonth: getMasterLogMonthlyTotals(products),
    };
}
