// Local, static production-equivalent build of the art study. Normal Pages build
// continues to publish dist only; this output is never deployed automatically.
import { cp,mkdir,rm,readdir,readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{cwd:root,stdio:'inherit'});
const output=path.join(root,'study-dist');
await rm(output,{recursive:true,force:true});await cp(path.join(root,'dist'),output,{recursive:true});
const source=path.join(root,'prototypes/fantasy-reef'),destination=path.join(output,'prototypes/fantasy-reef');
await mkdir(destination,{recursive:true});
for(const name of await readdir(source)){
  if(/\.(html|css|js)$/.test(name))await cp(path.join(source,name),path.join(destination,name));
}
await cp(path.join(source,'assets'),path.join(destination,'assets'),{recursive:true});
await cp(path.join(source,'perf'),path.join(destination,'perf'),{recursive:true,filter:file=>!(/\.(json|md|mjs)$/.test(file))});
let count=0;
async function verify(dir,relative=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const rel=path.join(relative,entry.name),full=path.join(dir,entry.name);
    if(entry.isDirectory())await verify(full,rel);
    else{const built=await readFile(full),original=await readFile(path.join(source,rel));if(!built.equals(original))throw Error(rel);count++;}
  }
}
await verify(destination);
console.log(`✓ ${count} study runtime files copied byte for byte to study-dist. No dev runtime, minification, or automatic publication.`);
