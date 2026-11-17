import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Module} from "node:module";
import ts from "typescript";
const m=new Module("igdb-transport-test");m.require=name=>{if(name==="server-only")return {};throw Error(name);};m._compile(ts.transpileModule(readFileSync(new URL("../src/lib/igdb-transport.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,"igdb-transport-test.cjs");
const {createIgdbTransport}=m.exports;const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
test("tokens are reused; simultaneous requests are paced and authenticated",async()=>{
 let auth=0;const starts=[];const transport=createIgdbTransport(()=>"id",()=>"secret",async(url,options)=>{if(url.includes("oauth2")){auth++;assert.equal(options.body.get("client_secret"),"secret");return response({access_token:"token",expires_in:3600});}starts.push(Date.now());assert.equal(options.headers.Authorization,"Bearer token");return response([{id:1}]);});
 await Promise.all([transport.request("games","fields id;"),transport.request("genres","fields id;")]);assert.equal(auth,1);assert.ok(starts[1]-starts[0]>=270);
});
test("401 renews token and 429 retry is bounded",async()=>{
 let auth=0,calls=0;const transport=createIgdbTransport(()=>"id",()=>"secret",async(url)=>{if(url.includes("oauth2")){auth++;return response({access_token:`token${auth}`,expires_in:3600});}calls++;return calls===1?response({},401):calls===2?response({},429,{"Retry-After":"0"}):response([{id:2}]);});
 assert.deepEqual(await transport.request("games","fields id;"),[{id:2}]);assert.equal(auth,2);assert.equal(calls,3);
});
test("missing credentials and provider failures never include secrets in errors",async()=>{
 const missing=createIgdbTransport(()=>undefined,()=>undefined,async()=>{throw Error("should not fetch");});await assert.rejects(missing.request("games","fields id;"),/not configured/);
 const denied=createIgdbTransport(()=>"id",()=>"super-secret",async()=>response({message:"super-secret"},400));await assert.rejects(denied.request("games","fields id;"),error=>!error.message.includes("super-secret"));
});
test("expired application tokens are acquired again",async()=>{
 let auth=0;const transport=createIgdbTransport(()=>"id",()=>"secret",async url=>url.includes("oauth2")?(auth++,response({access_token:`t${auth}`,expires_in:1})):response([{id:1}]));
 await transport.request("games","fields id;");await new Promise(resolve=>setTimeout(resolve,1100));await transport.request("games","fields id;");assert.equal(auth,2);
});
test("malformed provider responses remain generic and do not echo response bodies",async()=>{
 const transport=createIgdbTransport(()=>"id",()=>"secret",async()=>new Response("private-provider-content",{status:200}));await assert.rejects(transport.request("games","fields id;"),error=>error.message.includes("invalid response")&&!error.message.includes("private-provider-content"));
});
