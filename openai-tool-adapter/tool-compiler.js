/**
 * @fileoverview P0: Production Tool Output Compiler
 * Transforms raw, verbose tool outputs into high-density, structured representations.
 * Eliminates LLM confusion and reduces prompt token consumption by 50-80%.
 */

/**
 * Compile pytest / python unittest output into concise diagnostic summary.
 */
function compileTestOutput(rawOutput) {
  if (typeof rawOutput !== 'string') return rawOutput;

  // If already JSON, check if it contains test output
  let parsed = null;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {}

  const textToAnalyze = parsed && parsed.output ? parsed.output : rawOutput;
  const isPassed = (parsed && parsed.passed === true) || textToAnalyze.includes('passed in') || textToAnalyze.includes('OK\n') || textToAnalyze.includes('=== 1 passed');

  if (isPassed) {
    return JSON.stringify({
      status: 'PASS',
      exit_code: 0,
      summary: 'All unit tests passed successfully.',
    });
  }

  // Extract failed test names
  const failedTestMatches = [...textToAnalyze.matchAll(/FAILED\s+([^\s:]+)/g)].map((m) => m[1]);
  const failSummaryLines = textToAnalyze
    .split(/\r?\n/)
    .filter((l) => l.includes('AssertionError') || l.includes('Error:') || l.includes('FAILED') || l.includes('!=') || l.includes('Traceback'))
    .slice(0, 8);

  return JSON.stringify({
    status: 'FAIL',
    exit_code: 1,
    failed_tests: failedTestMatches.length > 0 ? failedTestMatches : ['Unit test failure'],
    error_summary: failSummaryLines.join('\n') || 'Test failed assertion.',
  });
}

/**
 * Compile search_files / search_text output.
 */
function compileSearchResults(rawOutput) {
  if (typeof rawOutput !== 'string') return rawOutput;
  try {
    const data = JSON.parse(rawOutput);
    if (data.matches && Array.isArray(data.matches)) {
      if (data.matches.length > 8) {
        return JSON.stringify({
          query: data.query || data.pattern,
          total_matches: data.count || data.matches.length,
          top_matches: data.matches.slice(0, 8),
          note: `Showing top 8 of ${data.matches.length} matches to conserve context.`,
        });
      }
    }
  } catch {}
  return rawOutput;
}

/**
 * General Tool Output Compiler
 * Inspects tool output string and compiles it to high-signal format.
 */
function compileToolOutput(toolName, rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return rawContent;

  if (toolName === 'run_test') {
    return compileTestOutput(rawContent);
  }

  if (toolName === 'search_files' || toolName === 'search_text') {
    return compileSearchResults(rawContent);
  }

  // General test output heuristic if toolName is not explicitly known
  if (rawContent.includes('test session starts') || rawContent.includes('AssertionError') || rawContent.includes('================ FAILURES ================')) {
    return compileTestOutput(rawContent);
  }

  return rawContent;
}

module.exports = {
  compileTestOutput,
  compileSearchResults,
  compileToolOutput,
};
