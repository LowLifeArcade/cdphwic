export interface ArchivedNotification {
    id: string;
    kind: string;
    title: string;
    message: string;
    requestId?: number;
    transferId?: string;
    readAt?: string;
}

const notices: Record<string, [string, string]> = {
    'request-info': ['Request More Info', 'CDPH/WIC requested more information.'],
    'request-response': ['Response to Request More Info', 'The Local Agency responded.'],
    'request-eta': ['Shipment Update', 'Shipment details and authorization are ready.'],
    'request-special-order': ['Special Order Delivery Update', 'Special order delivery details were updated.'],
    'transfer-availability': ['Transfer Availability Response', 'The sending agency responded about stock availability.'],
    'transfer-stock': ['Transfer Request', 'Confirm the reserved product is available.'],
    'transfer-ready': ['Transfer Labels Ready', 'Download the labels and arrange pickup.'],
    'transfer-confirmed': ['Stock Confirmed', 'The sending agency confirmed the reserved stock.'],
    'transfer-pickup': ['Transfer Pickup', 'The sending agency confirmed GSO pickup.'],
    forecast: ['Anticipated Surplus', 'Confirm the actual surplus quantity.'],
    donation: ['Donation Reminder', 'Arrange donation of surplus formula.'],
    destruction: ['Destruction Required', 'Destroy the surplus and record verified destruction.'],
};

export function archiveNotification(notice: {
    id: string; kind: string; title?: string; notes?: string; formula_label?: string; formula_name?: string;
    request_id?: number; transfer_id?: string;
}): ArchivedNotification {
    const [type, fallback] = notices[notice.kind] ?? ['Inventory Update', ''];
    const formula = notice.formula_label || notice.formula_name;
    return {
        id: notice.id,
        kind: notice.kind,
        title: [notice.title || type, formula].filter(Boolean).join(' · '),
        message: notice.notes || fallback,
        requestId: notice.request_id,
        transferId: notice.transfer_id,
    };
}
