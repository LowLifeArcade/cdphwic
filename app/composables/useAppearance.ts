import {normalizeAppearance,type Appearance} from '~/../shared/appearance';
export function useAppearance(){
    const preference=useCookie<Appearance>('appearance',{default:()=> 'auto',maxAge:60*60*24*365,sameSite:'lax',path:'/',decode:value=>normalizeAppearance(value),encode:value=>value});
    return preference;
}
