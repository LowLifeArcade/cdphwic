export interface SurplusDisposalRow {
    id: string;
    kind: 'Donation' | 'Destruction';
    event_date: string;
    quantity: number;
    original_quantity: number;
    corrected: boolean;
    formula_name: string;
    form: string;
    flavor: string;
    packaging: string;
    expiration_date: string;
    clinic_name: string;
    agency_id: number;
    agency_name: string;
    staff_name: string;
    recorded_by: string;
    recorded_at: string;
}
