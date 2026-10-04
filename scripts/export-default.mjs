import {writeFile,mkdir} from 'node:fs/promises';
import {getDefaultConfig} from '../src/config/store.js';
const directory=new URL('../config/',import.meta.url);
await mkdir(directory,{recursive:true});
await writeFile(new URL('default.json',directory),JSON.stringify(getDefaultConfig(),null,2)+'\n');
process.stdout.write('已从内置内容生成 config/default.json。\n');

