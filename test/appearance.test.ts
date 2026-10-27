import {describe,it,expect} from 'vitest';
import {normalizeAppearance,resolveAppearance,appearanceInitScript} from '../shared/appearance';
import {runInNewContext} from 'node:vm';
describe('appearance preferences',()=>{
 it('defaults to auto and accepts only supported preferences',()=>{
  for(const value of [undefined,'','sepia','LIGHT'])expect(normalizeAppearance(value)).toBe('auto');
  for(const value of ['light','dark','auto'])expect(normalizeAppearance(value)).toBe(value);
 });
 it('follows system appearance only in auto',()=>{
  expect(resolveAppearance('auto',true)).toBe('dark');
  expect(resolveAppearance('auto',false)).toBe('light');
  expect(resolveAppearance('light',true)).toBe('light');
  expect(resolveAppearance('dark',false)).toBe('dark');
 });
 it('applies persisted preference before the page paints',()=>{
  for(const [cookie,dark,expected] of [['appearance=dark',false,'dark'],['appearance=light',true,'light'],['appearance=auto',true,'dark'],['appearance=invalid',false,'light'],['',true,'dark']] as const){
   const attributes:Record<string,string>={};
   runInNewContext(appearanceInitScript,{document:{cookie,documentElement:{setAttribute:(key:string,value:string)=>{attributes[key]=value;}}},window:{matchMedia:()=>({matches:dark})}});
   expect(attributes['data-theme']).toBe(expected);
  }
 });
});
