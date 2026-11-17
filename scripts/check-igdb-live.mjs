// Read-only live IGDB smoke test. Prints catalog information, never credentials/tokens.
import { createRequire,Module } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const load=createRequire(import.meta.url);const ts=load("typescript");load("@next/env").loadEnvConfig(process.cwd());
function compile(file,stubs){const m=new Module(file);m.require=name=>Object.hasOwn(stubs,name)?stubs[name]:load(name);m._compile(ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports;}
const validation=compile("src/lib/game-validation.ts",{});
const transport=compile("src/lib/igdb-transport.ts",{"server-only":{}});
const igdb=compile("src/lib/igdb.ts",{"server-only":{},"next/cache":{cacheLife(){}},"@/lib/igdb-transport":transport,"@/lib/game-validation":validation});
try{
 for(const key of ["IGDB_CLIENT_ID","IGDB_CLIENT_SECRET"])assert.ok(process.env[key]?.trim(),`${key} missing`);
 const found=await igdb.searchGames("Elden Ring");assert.ok(found.games.length);
 const game=await igdb.getGame(found.games[0].id);assert.ok(game.name);assert.equal(game.id,found.games[0].id);
 const facets=await igdb.getGameFacets();assert.ok(facets.genres.length&&facets.platforms.length);
 const filter=await igdb.searchGames("",1,game.genres?.[0]?.id,game.platforms?.[0]?.id);assert.ok(filter.games.length);
 const cards=await igdb.getGameCards([game.id]);assert.equal(cards[0].id,game.id);
 console.log(`PASS live search/detail/batch/genre/platform: ${game.name} (#${game.id}); ${facets.genres.length} genres, ${facets.platforms.length} platforms; ${game.screenshots?.length||0} screenshots`);
}catch(error){console.error("Live IGDB verification failed:",error instanceof transport.IgdbError?`${error.message} (HTTP ${error.status})`:error.message);process.exitCode=1;}
