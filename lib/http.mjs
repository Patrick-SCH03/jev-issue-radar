// Limit decoded response bytes as well as time, including chunked/compressed bodies.
export async function readJson(response, {maxBytes, signal} = {}) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response body.');
  const cancel = () => {void reader.cancel().catch(() => {});};
  let onAbort;
  try {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error('Response body is too large.');
    signal?.throwIfAborted();
    const aborted = new Promise((_, reject) => {
      onAbort = () => {cancel(); reject(signal.reason);};
      signal?.addEventListener('abort', onAbort, {once: true});
    });
    const chunks = []; let size = 0;
    while (true) {
      const {done, value} = await Promise.race([reader.read(), aborted]);
      signal?.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Response body is too large.');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
  } catch (error) {cancel(); throw error;}
  finally {signal?.removeEventListener('abort', onAbort); reader.releaseLock();}
}
