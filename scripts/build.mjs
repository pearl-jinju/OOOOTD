import {build} from 'esbuild';
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
await mkdir('.build',{recursive:true});await mkdir('assets',{recursive:true});
await build({entryPoints:['backend/index.mjs'],bundle:true,platform:'node',target:'node24',format:'esm',outfile:'.build/index.mjs',banner:{js:"import{createRequire as ___cr}from'node:module';const require=___cr(import.meta.url);"}});
await build({entryPoints:['frontend/cloud.mjs'],bundle:true,platform:'browser',target:'es2022',format:'esm',outfile:'assets/cloud.js',minify:true});
console.log('Built backend and browser client');

await build({entryPoints:['shared/outfits.mjs'],bundle:true,platform:'browser',target:'es2022',format:'iife',globalName:'OOOOTD_RULES',outfile:'assets/outfit-rules-layers.js',minify:true});
