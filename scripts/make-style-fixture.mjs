import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {OCCASIONS,CATEGORIES,appropriate,genderCompatible,coverage} from '../shared/outfits.mjs';
const items=JSON.parse(await readFile('.build/catalog.latest.json','utf8')),chosen=new Map();
for(const gender of ['men','women'])for(const occasion of OCCASIONS)for(const category of CATEGORIES){
 const candidates=items.filter(item=>genderCompatible(item,gender)&&item.category===category&&appropriate(item,occasion.id));
 const groups=new Map();for(const item of candidates){if(!groups.has(item.season))groups.set(item.season,[]);groups.get(item.season).push(item)}
 const ordered=[...groups.values()].sort((a,b)=>b.length-a.length).flat();
 for(const item of ordered.slice(0,6))chosen.set(item.id,item);
}
await mkdir('tests/fixtures',{recursive:true});
await writeFile('tests/fixtures/style-catalog.json',JSON.stringify([...chosen.values()],null,2)+'\n');
const report=coverage(items);await writeFile('.build/catalog.coverage.json',JSON.stringify({count:items.length,coverage:report},null,2));
console.log('Verified catalog',items.length,'fixture',chosen.size,'minimum type/category count',Math.min(...Object.values(report).flatMap(types=>Object.values(types).map(row=>row.minimum))));
