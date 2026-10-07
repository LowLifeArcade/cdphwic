import { SEED_PRODUCTS, SEED_REQUESTS } from '../data/seed';
import type { SummaryRecord } from '../../shared/domain';

export function buildSummary(): SummaryRecord {
    const unitsByProduct = SEED_PRODUCTS.map((product) => ({
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
    };
}
