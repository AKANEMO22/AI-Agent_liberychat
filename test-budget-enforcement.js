const { runAgentTask, MODE_BUDGETS } = require('./workspace-agent-harness/harness.js');

async function testBudget(mode, prompt) {
  const budget = MODE_BUDGETS[mode];
  console.log(`\n=== TESTING ${mode} MODE HARD BUDGET ENFORCEMENT ===`);
  console.log(`Max Turns: ${budget.maxTurns}, Max Tool Calls: ${budget.maxToolCalls}`);
  
  const res = await runAgentTask({
    mode,
    userPrompt: prompt,
    onStep: (step) => {
      if (step.type === 'tool_start') {
        console.log(`  [TOOL EXEC] ${step.tool}`);
      }
    }
  });

  console.log(`Result: Turns used = ${res.llmTurns}/${budget.maxTurns}, Tool calls = ${res.toolCalls}/${budget.maxToolCalls}`);
  const turnsEnforced = res.llmTurns <= budget.maxTurns;
  const toolsEnforced = res.toolCalls <= budget.maxToolCalls;
  console.log(`Enforcement Status: ${turnsEnforced && toolsEnforced ? 'PASS (Strictly Bounded)' : 'FAIL'}`);
  return { turnsEnforced, toolsEnforced, res };
}

(async () => {
  // Test Light
  await testBudget('LIGHT', 'Search and read all files repeatedly: run search_files and read_file 10 times.');
  
  // Test Medium
  await testBudget('MEDIUM', 'Run search_files on pattern *.py, read_file on calculator.py 10 times, search_text 5 times.');
  
  // Test High
  await testBudget('HIGH', 'Search workspace tree, search files, read file 30 times repeatedly.');
})();
