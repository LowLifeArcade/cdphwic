/** Use a singular unit only when the displayed quantity is exactly one. */
export function unitLabel(quantity:unknown):'Unit'|'Units'{
 return Number(quantity)===1?'Unit':'Units';
}
