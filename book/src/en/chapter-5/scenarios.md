# 5.4 Long Session Real-World Scenarios

> This section walks through real-world use cases, demonstrating how to combine pi-atelier's tools to solve common problems in long sessions.

## Scenario 1: AI Gets Dumber — Compress with Smart Compact

### Symptoms

You've been chatting with AI for 2 hours and done a lot. Suddenly you notice the AI starts to:
- Ask questions you've already answered
- Re-propose solutions that have already been rejected
- Code quality drops noticeably — missing error handling

### Traditional Compaction vs Smart Compact

pi's built-in Compaction triggers automatically when the context approaches its limit, but it simply compresses old conversations into a generic summary. Smart Compact is smarter:

```
Traditional Compaction:
  100 rounds of conversation → one generic 500-word summary
  Problem: critical details are lost, AI doesn't know what was decided

Smart Compact (two phases):
  Phase 1 (Intent Summary):
    → Extracts: decisions, agreements, file modifications, conclusions
    → Preserves all critical information, discards redundant processes
  
  Phase 2 (Tool Filtering):
    → Evaluates each tool result batch by batch to decide whether to keep it
    → Discards: repeated reads, failed attempts, debugging processes
```

### Steps

```
1. AI has already done a lot for you, and you feel the context is nearly full
2. Type /smart-compact
3. Smart Compact analyzes the conversation history and generates an enhanced summary
4. AI continues working, but "remembers" all key decisions
```

Or do nothing — if configured in `auto` mode (default), Smart Compact will trigger automatically at the right time.

### Works Better with Context Manager

Smart Compact compresses **conversation history**, while Context Manager's Distill compresses **tool results**. Using them together:

```
Context Window
├── Conversation History ←── Compressed by Smart Compact (preserves decisions and conclusions)
├── Tool Results         ←── Compressed by Distill (preserves key info, discards redundancies)
└── Memory Injection     ←── Fixed size, unchanged
```

## Scenario 2: Context Already Exploded — Handoff with Takeover

### Symptoms

A more extreme case: AI reports an error — "context window exceeded." The entire session can no longer continue.

At this point, mere compression is too late — the session has crashed outright.

### Solution: Start a New Session + Takeover

```
1. Open a new session
2. Tell AI: "Help me take over the last session's work"
3. AI calls session_analyze(action="takeover")
4. Generates a 5-dimension takeover report:

📋 Session Takeover Report

1. User Intent: Refactor auth module, switch from JWT to session-based auth
2. Modified Files:
   - src/auth/middleware.ts (done)
   - src/auth/login.ts (in progress, 80% complete)
   - src/auth/__tests__/login.test.ts (to be written)
3. Recent Steps:
   - Modified type signatures in middleware.ts
   - Started modifying login.ts but not finished
   - Tests not yet written
4. Next Steps:
   - Complete login.ts modifications
   - Write login.test.ts tests
   - Run full test suite
5. Key Decisions:
   - Chose session-based over refresh token approach
   - Reason: project doesn't need cross-domain SSO
```

### Takeover's 5 Dimensions

| Dimension | What It Contains | Why It Matters |
|-----------|-----------------|----------------|
| User Intent | Original requirements and goals | New AI knows "what to do" |
| Modified Files | List of files changed and pending | Knows "what was changed" |
| Recent Steps | Last 3-5 operations | Knows "how far we got" |
| Next Steps | What still needs to be done | Knows "what to do next" |
| Key Decisions | Important technical choices and rationale | Knows "why it was done this way" |

With these 5 dimensions, a new session's AI can fully recover working context within 1-2 conversation rounds.

### Example

```
You: Help me take over the Godot MCP Bridge work

AI:
  🛠 session_analyze(action="takeover", sessionId="019e620f-...")
  
  📋 Takeover report generated. You were debugging the MCP Bridge WebSocket 
  connection issue and had identified that nohup was swallowing the listen() 
  return value. The next step is to start the TCP port directly without nohup. 
  Shall I continue?
```

## Scenario 3: Want to Know What Happened — Session Analysis

### Symptoms

Yesterday you had AI do a ton of things. Today you want to review: "How exactly was that DuckDB timezone bug fixed?"

### Steps

```
Step 1: Cross-session search
You: Search for the session where DuckDB timezone was fixed

AI:
  🛠 session_search(action="grep", query="DuckDB timezone")
  
  Found 2 matching sessions:
  1. 05-22 19:36 — DuckDB timezone configuration fix
  2. 05-20 14:30 — Database initialization discussion

Step 2: View timeline
You: Show the detailed process of the first one

AI:
  🛠 session_analyze(action="timeline", sessionId="...")
  
  📅 Timeline:
  [19:36] User: DuckDB query returns UTC time
  [19:37] AI: Reads db/connection.ts
  [19:38] AI: Discovers no timezone parameter set
  [19:39] AI: Adds SET timezone = 'Asia/Shanghai'
  [19:43] AI: All tests pass ✅

Step 3: View original conversation (if more detail needed)
You: Show the conversation around 19:39

AI:
  🛠 session_analyze(action="entries", msgRange="5-10", sessionId="...")
```

### Common Analysis Pattern Combinations

```
Quick overview of a session:       summary → see what was done
Trace operation order:             timeline → see the steps
View raw conversation:             entries → see the details
Take over someone's work:          takeover → get the context
Check for violations:              audit → see if there are problems
```

## Scenario 4: Tool Output Fills the Context — Aging Automatic Eviction

### Symptoms

AI has used many tools in one session: read 20 files, ran 10 searches, executed 5 bash commands. Every tool's returned result stays in the context.

The problem is: you only need the **most recent** results. That file you `read` 20 minutes ago is no longer needed now.

### Solution: Aging Automatic Eviction

Aging automatically evicts tool outputs that haven't been referenced again after a specified number of rounds:

```
Timeline:
  Round 1:  read(auth.ts) → 5K tokens
  Round 2:  read(middleware.ts) → 4K tokens
  Round 3:  grep("TODO") → 3K tokens
  ...
  Round 10: edit(auth.ts)  ← auth.ts is referenced again, "life extended"
  
  Round 1+8=9:  grep("TODO") → not referenced for 8 rounds, auto-evicted ✅
  Round 2+8=10: middleware.ts not referenced again, auto-evicted ✅
  Round 1+8=9:  auth.ts → referenced by edit, preserved!
```

### Configuring Aging

```
/aging-config 8    # Evict after 8 rounds (recommended: 8-12)
/aging-config off  # Disable auto-eviction
```

> 💡 **Skill file exemption**: SKILL.md content is not evicted by aging — AI always retains access to currently loaded skills.

### Manual Intervention: /context TUI Panel

If you don't want to wait for auto-eviction, you can manually mark items for deletion:

```
1. Type /context to open the TUI panel
2. Browse by category: view all context content by tool type or chronological order
3. Select unwanted content, mark it for deletion
4. Marked content won't be included in the next AI request
```

This is especially useful when:
- AI read a huge config file but you only need one line from it
- A search returned 50 results but you only used 3
- Error messages from earlier debugging are no longer needed

## Scenario 5: Why Is AI Getting Slower — Token Budget Diagnosis

### Symptoms

AI's response keeps getting slower, and the wait time per conversation round is noticeably longer. You suspect the context is too large, but you don't know exactly what's taking up space.

### Steps

```
Step 1: Enable recording
You: /record on

... do a few more rounds ...

Step 2: Check token budget
You: Analyze the token budget

AI:
  🛠 payload_analyze(action="budget")
  
  📊 Token Budget Analysis
  System Prompt:    4,200 (3.2%)
  Tool Definitions: 8,100 (6.2%)
  Memory Injection: 2,300 (1.8%)
  Conversation:    52,400 (40.0%)
  Tool Results:    64,800 (49.5%)  ← This is the big one!
  
Step 3: Find the most expensive calls
You: Find the most token-consuming tool calls

AI:
  🛠 payload_analyze(action="expensive", topN=5)
  
  Top 5 Most Expensive Tool Calls:
  1. read(src/database/schema.ts)  — 8,200 tokens
  2. code_graph_module_overview    — 6,400 tokens
  3. grep("TODO|FIXME")           — 4,100 tokens
  4. read(src/config/settings.ts)  — 3,800 tokens
  5. bash("npm test")             — 3,200 tokens

Step 4: Targeted optimization
→ schema.ts is too large, use offset/limit to read only the needed parts
→ Use compact=true mode for code_graph
→ Add --include to grep to limit file types
```

### Diagnosis Flow Quick Reference

```
1. budget     → See overall distribution (which part has the highest share?)
2. expensive  → Find the big consumers (which specific calls use the most tokens?)
3. growth     → See the trend (which period had the fastest growth?)
4. messages   → Pinpoint (take a look at that specific message content)
5. Targeted optimization (switch tools, add filters, enable distill)
```

## Combined Scenario: Complete Survival Strategy for Ultra-Long Sessions

```
Session starts
│
├── Rounds 1-20: Working normally, no concerns
│
├── Rounds 20-40: Context usage ~40%
│   → Enable /record on (optional, to prepare for later diagnosis)
│   → Avoid repeatedly reading large files
│
├── Rounds 40-60: Context starting to get tight
│   → Smart Compact takes over pi's compaction event (if auto mode is on)
│   → Or manually trigger /smart-compact
│   → Aging starts evicting old tool outputs
│
├── Rounds 60-80: Approaching the limit
│   → Smart Compact has completed two-phase compaction
│   → Consider whether to start a new session
│   → If continuing: check with payload_analyze budget
│
├── 💥 Crashed!
│   → Start a new session
│   → session_analyze(action="takeover") to take over
│   → Continue working
│
└── Before wrapping up:
    → /record off
    → Have AI generate a daily report with /journal
    → agent_end auto-reminds to commit + update memory
```

> 📖 Back to [5.1 Long Session Survival Guide](./long-session.md) for a complete tool introduction.
