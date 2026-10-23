export const diagnosisCatalog = [
    { name: 'Prematurity', detail: false },
    { name: 'Failure to thrive', detail: false },
    { name: 'Low birthweight', detail: false },
    { name: 'Dysphagia', detail: false },
    { name: 'Food allergy', detail: true },
    { name: 'Immune system disorder', detail: true },
    { name: 'GI disorder', detail: true },
    { name: 'Life-threatening disorder', detail: true },
    { name: 'Genetic/Metabolic disorder', detail: true },
    { name: 'Malabsorption (specify nutrient)', detail: true },
    { name: 'Other', detail: true },
];

export function findDiagnosis(name: string) {
    const normalized = name.trim().toLowerCase();
    const aliases: Record<string, string> = { 'gastrointestinal disorder': 'gi disorder', 'malabsorption': 'malabsorption (specify nutrient)', 'other medical condition': 'other' };
    return diagnosisCatalog.find((item) => item.name.toLowerCase() === (aliases[normalized] ?? normalized));
}

export function validateDiagnoses(value: string) {
    const entries = value.split(/[\n;]/).map((entry) => entry.trim()).filter(Boolean);
    if (!entries.length) return 'Add at least one Qualifying Diagnosis.';
    for (const entry of entries) {
        const [name, ...details] = entry.split(':');
        if (findDiagnosis(name!)?.detail && !details.join(':').trim()) return `Provide details for ${name}.`;
    }
    return '';
}
