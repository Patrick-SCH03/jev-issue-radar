import {LIMITS, normalizeIssue, parseIssueUrl} from './core.mjs';

export async function loadRepositoryIssue(input, {fetchImpl = fetch} = {}) {
  const ref = parseIssueUrl(input);
  const root = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  async function read(path) {
    let response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        headers: {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'jev-issue-radar'},
        signal: AbortSignal.timeout(15000), redirect: 'error',
      });
    } catch { throw new Error('Could not connect to GitHub. Check the connection and repository URL.'); }
    if (!response.ok) {
      await response.body?.cancel();
      if ([403, 429].includes(response.status)) throw new Error('GitHub rate limit reached. Try again later.');
      if (response.status === 404) throw new Error('Public issue not found. Check the URL.');
      throw new Error(`GitHub request failed (HTTP ${response.status}).`);
    }
    return response.json();
  }
  const source = normalizeIssue(await read(`/issues/${ref.number}`));
  if (!source) throw new Error('Enter an issue URL, not a pull request.');
  const issues = [];
  let fetched = 0, pages = 0, limited = false;
  for (let page = 1; page <= LIMITS.poolPages; page++) {
    const data = await read(`/issues?state=all&sort=updated&direction=desc&per_page=100&page=${page}`);
    if (!Array.isArray(data)) throw new Error('GitHub returned an invalid issue list.');
    pages++; fetched += data.length;
    for (const raw of data) { const item = normalizeIssue(raw); if (item) issues.push(item); }
    limited = page === LIMITS.poolPages && data.length === 100;
    if (data.length < 100) break;
  }
  return {source, issues, coverage: {repository: `${ref.owner}/${ref.repo}`, fetched, issueCount: new Set(issues.map(x => x.url)).size, pages, limited, description: 'Scans up to 300 recently updated items, excluding pull requests. This is not a full repository search.'}};
}
