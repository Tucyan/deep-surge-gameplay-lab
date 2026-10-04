import * as tables from '../content/index.js';
import {validateConfig} from './validation.js';

export const CONFIG_STORAGE_KEY = 'deep-surge-lab-content-v1';
export const DRAFT_STORAGE_KEY = 'deep-surge-lab-planner-draft-v1';
const copy = value => structuredClone(value);
const tableNames = Object.keys(tables);
const baseline = copy(Object.fromEntries(tableNames.map(key => [key, tables[key]])));
const baseVersion = baseline.CONFIG.contentVersion;

export function getDefaultConfig() {
  return {format:'deep-surge-content',schema:1,content:copy(baseline)};
}

export function getActiveConfig() {
  const content = copy(Object.fromEntries(tableNames.map(key => [key,tables[key]])));
  content.CONFIG.contentVersion = baseVersion;
  return {format:'deep-surge-content',schema:1,content};
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}

export function configFingerprint(config) {
  const content = copy(config.content);
  content.CONFIG.contentVersion = baseVersion;
  const text = JSON.stringify(canonical(content));
  let hash = 2166136261;
  for (let i=0;i<text.length;i++) hash=Math.imul(hash ^ text.charCodeAt(i),16777619) >>> 0;
  return hash.toString(16).padStart(8,'0');
}

function checked(config) {
  const result=validateConfig(config);
  if (!result.ok) {
    const error=new Error(result.errors.map(issue=>issue.message).join('；'));
    error.issues=result.errors;
    throw error;
  }
  return copy(config);
}

// Keep imported objects/arrays stable so every rules module sees the same tables.
export function applyConfig(config) {
  const candidate=checked(config);
  for (const key of tableNames) {
    const target=tables[key],source=candidate.content[key];
    if (Array.isArray(target)) target.splice(0,target.length,...source);
    else { for (const oldKey of Object.keys(target)) delete target[oldKey]; Object.assign(target,source); }
  }
  const fingerprint=configFingerprint(candidate);
  tables.CONFIG.contentVersion=fingerprint===configFingerprint(getDefaultConfig())?baseVersion:`${baseVersion}-${fingerprint}`;
  return getActiveConfig();
}

export function saveAppliedConfig(config,storage) {
  const candidate=checked(config);
  try {
    const target=storage===undefined?globalThis.localStorage:storage;
    if (!target) throw new Error('浏览器存储不可用');
    target.setItem(CONFIG_STORAGE_KEY,JSON.stringify(candidate));
  }
  catch { throw new Error('配置未保存：浏览器存储不可用或空间不足。请导出配置文件备份。'); }
  return applyConfig(candidate);
}

export function loadAppliedConfig(storage) {
  try {
    const target=storage===undefined?globalThis.localStorage:storage;
    const raw=target?.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return {ok:true,source:'default',errors:[]};
    applyConfig(JSON.parse(raw));
    return {ok:true,source:'browser',errors:[]};
  } catch (error) {
    return {ok:false,source:'default',errors:error.issues || [{message:`已应用配置无法读取：${error.message}。请在策划工具中检查或重新导入。`}]};
  }
}

export function clearAppliedConfig(storage) {
  try {
    const target=storage===undefined?globalThis.localStorage:storage;
    if (!target) throw new Error('浏览器存储不可用');
    target.removeItem(CONFIG_STORAGE_KEY);
  } catch { throw new Error('无法恢复配置：浏览器存储不可用，请检查浏览器设置。'); }
  return applyConfig(getDefaultConfig());
}

export async function loadPublishedConfig(fetcher=globalThis.fetch) {
  try {
    const response=await fetcher(new URL('../../config/default.json',import.meta.url),{cache:'no-store'});
    if (!response.ok) throw new Error(`配置文件未能加载（${response.status}）`);
    applyConfig(await response.json());
    return {ok:true,errors:[]};
  } catch (error) {
    return {ok:false,errors:error.issues || [{message:`发布配置加载失败：${error.message}。已使用内置配置。`}]};
  }
}
