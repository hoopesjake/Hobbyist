export class BookCatalogError extends Error {
  readonly status: number;
  constructor(message = "The book catalog is temporarily unavailable. Please try again.", status = 503) { super(message); this.name = "BookCatalogError"; this.status = status; }
}
export function openLibraryWorkId(value: unknown): number | null {
  const match = typeof value === "string" ? /^(?:\/works\/)?OL([1-9]\d{0,9})W$/.exec(value) : null;
  return match && Number(match[1]) <= 2147483647 ? Number(match[1]) : null;
}
export function bookCover(id: unknown) { return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false` : null; }

// Public metadata only. Pace starts below 3/sec, with at most two active fetches.
export function createOpenLibraryTransport(contact: () => string | undefined, fetcher: typeof fetch = fetch, timing: {now?:()=>number;wait?:(ms:number)=>Promise<void>} = {}) {
  let queue: Promise<unknown> = Promise.resolve(), nextStart=0, active=0, blockedUntil=0;
  const slots: (()=>void)[]=[], pending=new Map<string,Promise<unknown>>();
  const recent=new Map<string,{value:unknown;at:number}>(), failures=new Map<string,number>();
  const clock=timing.now || Date.now;
  const sleep=timing.wait || ((ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
  function release(){active--;slots.shift()?.();}
  async function reserve() {
    const run=async()=>{
      if(active>=2)await new Promise<void>(resolve=>slots.push(resolve));
      for (;;) {
        const delay=Math.max(0,Math.max(nextStart,blockedUntil)-clock());
        if(delay>10000)throw new BookCatalogError("Book search is busy. Please try again in a moment.",429);
        if(!delay)break;
        await sleep(delay);
      }
      nextStart=clock()+400;active++;
    };
    const ready=queue.then(run,run);queue=ready.catch(()=>{});await ready;
  }
  return { request<T>(path:string):Promise<T> {
    const email=contact()?.trim();
    if(!email||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))return Promise.reject(new BookCatalogError("Book search needs OPEN_LIBRARY_CONTACT_EMAIL configured on the server."));
    if(!path.startsWith("/")||path.startsWith("//"))return Promise.reject(new BookCatalogError("Invalid book lookup.",400));
    const cached=recent.get(path),now=clock();
    if(cached&&now-cached.at<300000)return Promise.resolve(cached.value as T);
    if(pending.has(path))return pending.get(path) as Promise<T>;
    const run=async()=>{
      try {
        if((failures.get(path)||0)>clock())throw new BookCatalogError("Book search is busy. Please try again in a moment.",429);
        for(let attempt=0;attempt<2;attempt++) {
          await reserve();
          let response:Response;
          try {
            response=await fetcher(`https://openlibrary.org${path}`,{headers:{"User-Agent":`Hobbyist/1.0 (${email})`,email,Accept:"application/json"},signal:AbortSignal.timeout(8000),cache:"no-store"});
            if(!response.ok) {
              await response.body?.cancel();
              if(response.status===404)throw new BookCatalogError("This book could not be found.",404);
              if(response.status===429||response.status===503) {
                const retry=response.headers.get("retry-after"),seconds=retry===null?NaN:Number(retry);
                const retryMs=Number.isFinite(seconds)?seconds*1000:retry?Date.parse(retry)-clock():1000;
                blockedUntil=Math.max(blockedUntil,clock()+Math.max(1000,Number.isFinite(retryMs)?retryMs:1000));
              }
              throw new BookCatalogError(response.status===429?"Book search is busy. Please try again in a moment.":undefined,response.status);
            }
            const value=await response.json() as T;
            recent.delete(path);recent.set(path,{value,at:clock()});
            while(recent.size>100)recent.delete(recent.keys().next().value!);
            failures.delete(path);return value;
          } catch(error) {
            const status=error instanceof BookCatalogError?error.status:503;
            if(attempt===1||status===404||(status<500&&status!==429))throw error instanceof BookCatalogError?error:new BookCatalogError();
          } finally { release(); }
        }
        throw new BookCatalogError();
      } catch(error) {
        if(error instanceof BookCatalogError&&error.status===404)throw error;
        failures.set(path,clock()+15000);
        while(failures.size>100)failures.delete(failures.keys().next().value!);
        if(cached&&clock()-cached.at<1800000)return cached.value as T;
        throw error instanceof BookCatalogError?error:new BookCatalogError();
      }
    };
    const result=run();pending.set(path,result);
    void result.finally(()=>pending.delete(path)).catch(()=>{});
    return result;
  }};
}

