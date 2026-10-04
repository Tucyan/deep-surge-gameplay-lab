import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateConfig} from '../src/config/validation.js';
const root=fileURLToPath(new URL('../',import.meta.url));
async function walk(dir){
  const files=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())files.push(...await walk(file));
    else if(/\.(mjs|js)$/.test(entry.name))files.push(file);
  }
  return files;
}
const files=[...await walk(path.join(root,'src')),...await walk(path.join(root,'scripts')),path.join(root,'server.mjs')];
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const config=JSON.parse(await readFile(path.join(root,'config/default.json'),'utf8'));
const result=validateConfig(config);
if(!result.ok){process.stderr.write(result.errors.map(e=>`${e.path}: ${e.message}`).join('\n')+'\n');process.exit(1);}
process.stdout.write(`${files.length} 个脚本语法检查通过；发布配置检查通过。\n`);

