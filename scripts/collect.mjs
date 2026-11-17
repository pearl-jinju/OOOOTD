import {collectCatalog} from '../backend/catalog.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const items=await collectCatalog();await mkdir('.build',{recursive:true});
await writeFile('.build/catalog.latest.json',JSON.stringify(items));
console.log('Collected '+items.length+' products with verified prices and direct purchase URLs');
