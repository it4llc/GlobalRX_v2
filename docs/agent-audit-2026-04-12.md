# Agent Audit — 2026-04-12

## Section 1 — File Size Table

| Agent File | Line Count | Word Count |
|------------|------------|------------|
| test-writer.md | 734 | 4641 |
| implementer.md | 449 | 3795 |
| standards-checker.md | 297 | 1868 |
| bug-investigator.md | 278 | 1721 |
| documentation-writer.md | 239 | 1823 |
| business-analyst.md | 157 | 1111 |
| project-manager.md | 129 | 932 |
| code-reviewer.md | 125 | 933 |
| architect.md | 124 | 708 |
| file-explorer.md | 97 | 521 |

## Section 2 — Per-Agent Summaries

### architect.md

**Purpose:** Reads the business analyst's specification and existing codebase to produce a detailed technical plan that test-writer and implementer agents will follow. Never writes production code, only produces planning documentation that bridges between business requirements and technical implementation.

**Top rules doing the most work:**
1. "REQUIRED READING BEFORE STARTING" (lines 10-14) — Enforces reading standards documents before planning, ensuring all technical decisions align with established patterns
2. "Step 2: Explore the codebase" (lines 39-47) — Requires reading actual files and verifying patterns rather than guessing, which prevents plans based on incorrect assumptions
3. "Step 3: Produce the technical plan" with detailed template (lines 48-122) — Provides comprehensive structure covering database, files, API routes, validation, types, components, and translation keys
4. "Use Grep and Glob to find relevant files. Do not guess — verify." (line 47) — Prevents assumption-based planning

**Scar-tissue rules:**
- "Do not guess — verify" (line 47) — Suggests past issues with agents making assumptions about code structure
- "Confirmation that this file was read before listing it here" (line 74) — Indicates problems with agents claiming to modify files they hadn't actually examined

**Possible bloat:**
- Platform reference section (lines 16-32) repeats information likely available in other documentation (uncertain — may be needed for self-contained operation)

### bug-investigator.md

**Purpose:** Investigates the root cause of bugs before any code is changed, producing a detailed investigation report that distinguishes between symptoms and root causes. Also categorizes failing tests across the test suite when invoked in test-fix mode. Read-only agent that never modifies files.

**Top rules doing the most work:**
1. "Which mode am I in?" dual-mode operation (lines 14-23) — Determines whether investigating a single bug or categorizing test suite failures
2. "Distinguish between: The symptom... The immediate cause... The root cause" (lines 71-74) — Forces deep analysis rather than surface-level fixes
3. "A regression test that proves the bug exists" requirement (lines 146-152) — Ensures bug fixes come with permanent guards against recurrence
4. "Assess the impact" (lines 77-83) including security assessment — Catches systemic issues and security vulnerabilities
5. "Failure Category Report" structure for test suite mode (lines 244-276) — Provides systematic approach to fixing large numbers of failing tests

**Scar-tissue rules:**
- "The regression test...must NEVER be deleted after the fix" (lines 149-152) — Suggests past issues with regression tests being removed
- "Do not summarize from memory. Run the command and work from the actual output." (line 197) — Indicates problems with agents working from assumptions
- "A single failure can belong to only one category" (line 218) — Prevents confusion from overlapping categorization

**Possible bloat:**
- Platform reference section (lines 25-37) duplicates information available elsewhere
- Some Git command examples could be condensed (lines 61-68, 84-87)

### business-analyst.md

**Purpose:** Takes plain English feature requests and turns them into clear, complete written specifications that all other agents depend on. Must always run first before any feature development, and must save the confirmed specification to docs/specs/ for other agents to reference.

**Top rules doing the most work:**
1. "MANDATORY — Save the spec to a file" (lines 137-145) — Ensures specifications are persistently stored where other agents can find them
2. "Do NOT proceed to saving the spec until Andy has explicitly confirmed" (lines 132-135) — Prevents work based on unconfirmed requirements
3. "Data Requirements" table format (lines 84-104) — Provides single source of truth for all field names and data types
4. "Check for an existing spec" (lines 22-32) — Prevents duplicate or conflicting specifications

**Scar-tissue rules:**
- "A lack of response is NOT confirmation. Wait for Andy to explicitly approve." (lines 134-135) — Clear response to past issues with proceeding without confirmation
- "Never overwrite a confirmed spec without flagging this to Andy first." (lines 31-32) — Prevents accidental loss of approved specifications
- "The test-writer and implementer will copy field names directly from this table — vague or incomplete definitions here cause wrong code to be built downstream." (lines 85-88) — Response to cascade failures from imprecise specs

**Possible bloat:**
- None identified — this is a focused, lean agent file

### code-reviewer.md

**Purpose:** Reviews completed code changes for logic correctness, security gaps, and business rule compliance after the implementer finishes. Produces a written report without modifying any files, checking whether code is logically correct and secure rather than checking style.

**Top rules doing the most work:**
1. "Check every API route for: Is getServerSession() called before anything else?" (lines 29-36) — Critical security enforcement
2. "Business Rule Compliance" checklist (lines 99-102) — Ensures all specified requirements are actually implemented
3. "Cross-module impact" checks (lines 56-60) — Catches integration issues across GlobalRx's four modules
4. "Security Assessment" comprehensive checklist (lines 104-110) — Systematic security verification

**Scar-tissue rules:**
- "Even one route missing this is a critical issue" regarding authentication (line 30) — Suggests past security incidents
- "does it leak extra data like password hashes, internal IDs, or other customers' information?" (line 34) — Specific examples suggest these exact leaks have occurred

**Possible bloat:**
- Some overlap between sections (security appears in multiple places)
- Examples could be more concise (uncertain — examples may be valuable for clarity)

### documentation-writer.md

**Purpose:** Runs last in the pipeline after code-reviewer and standards-checker approve changes, producing accurate documentation only for changes actually made in the current branch. Updates inline code comments and technical documentation based on the actual diff, never fabricating or speculating about changes.

**Top rules doing the most work:**
1. "ABSOLUTE RULES — VIOLATIONS ARE FAILURES" section (lines 14-45) — Six strict rules preventing common documentation errors
2. "Document only what is in the branch diff" (lines 18-20) — Prevents documentation drift from actual changes
3. "Never modify standards documents" prohibition list (lines 23-34) — Protects authoritative documents from accidental modification
4. "Establish the diff — this is mandatory" (lines 59-75) — Forces documentation to be based on actual changes, not assumptions
5. "Honest scope" rule (lines 39-42) — Prevents padding and over-documentation of small changes

**Scar-tissue rules:**
- "Never fabricate" rule (lines 21-22) — "You never claim a file was modified that was not modified" suggests past false documentation
- "Never include line numbers in documentation" (lines 36-38) — Response to stale line number references
- "Never claim work that other agents did" (lines 43-45) — Indicates past credit attribution issues
- "If git diff dev...HEAD --name-only returns no files, STOP" (lines 74-75) — Prevents documenting non-existent changes
- Entire "SELF-CHECK BEFORE SUBMITTING" section (lines 228-240) — Comprehensive checklist suggests many past mistakes

**Possible bloat:**
- Very repetitive emphasis on not fabricating or claiming false changes (appears in multiple forms throughout)
- Self-check section largely repeats earlier rules (uncertain — redundancy may be intentional for emphasis)

### file-explorer.md

**Purpose:** Lightweight read-only agent for quickly finding, reading, and mapping relevant files in the codebase. Provides focused file discovery without the overhead of a full agent, helping locate patterns and components before work begins.

**Top rules doing the most work:**
1. "Always be specific and actionable" output format (lines 64-96) — Ensures useful, immediately actionable results
2. Platform structure reference (lines 10-35) — Provides mental model for navigation
3. Specific search command patterns (lines 41-63) — Gives concrete tools for different search needs

**Scar-tissue rules:**
- "Always include full file paths. Always describe what each file contains. Always suggest a reading order." (line 97) — Response to vague or unhelpful output

**Possible bloat:**
- None identified — this is the smallest agent file and appropriately focused

### implementer.md

**Purpose:** Writes production code to make the test-writer's failing tests pass, following the architect's plan and coding standards exactly. Works through tests one at a time with strict rules preventing test modification, file deletion, or destructive git operations.

**Top rules doing the most work:**
1. "ABSOLUTE RULES" section with 6 mandatory rules (lines 18-97) — Comprehensive safety rails preventing common destructive mistakes
2. "Failure Loop Protocol" with 3-attempt limit (lines 114-216) — Systematic approach to handling failing tests with mandatory stop after 3 attempts
3. "Never edit, create, or delete any test file. Ever. For any reason." (lines 26-35) — Prevents circumventing TDD by modifying tests
4. "Output the Absolute Rules restatement before every task" (lines 91-97) — Forces acknowledgment of rules before work begins
5. "Bug Fix Mode — Additional Rules" including duplicate pattern scanning (lines 218-228) — Ensures complete fixes rather than partial patches

**Scar-tissue rules:**
- Entire Absolute Rules section reads as accumulated scar tissue
- "If you find yourself thinking 'let me just try one more thing' after a 3rd failure, that is the exact moment Rule 4 was written for. STOP." (lines 75-76) — Very specific scenario
- "You may not run git reset to 'start over'" (line 186) — Specific anti-pattern
- "A test file means any file matching ANY of these patterns" (lines 27-30) — Exhaustive list suggests past circumvention attempts
- "Do not delete files via the Write tool by writing empty content" (line 40) — Creative workaround that was blocked
- "Never import a real PrismaClient in a test" warning in three places — Major past issue

**Possible bloat:**
- Extreme repetition of rules in multiple forms (uncertain — likely intentional given critical nature)
- Rule restatement requirement adds overhead but seems intentional for safety
- Multiple warnings about not modifying tests appear throughout

### project-manager.md

**Purpose:** Evaluates the scope of feature requests, pushes back if too large, and breaks them into logical sequences of small self-contained phases. Runs before business-analyst to prevent scope creep and ensure manageable, testable deliverables.

**Top rules doing the most work:**
1. "What 'too large' means" criteria (lines 34-43) — Clear boundaries for when to break down work
2. "You are the first line of defence against scope creep" (line 10) — Empowerment to push back
3. Phase breakdown structure (lines 69-120) — Systematic approach to decomposition
4. "When in doubt, break it down. Smaller is always safer." (line 44) — Default to smaller pieces

**Scar-tissue rules:**
- "You are empowered — and expected — to push back" (line 10) — Suggests past issues with rubber-stamping
- List of failure reasons for large features (lines 18-24) — Specific problems that have occurred

**Possible bloat:**
- None identified — focused and appropriately sized

### standards-checker.md

**Purpose:** Mechanically verifies that every changed file follows the coding standards after code-reviewer approves changes. Produces a checklist report without modifying files. Also verifies TypeScript cleanup in a special mode to ensure no shortcuts were taken.

**Top rules doing the most work:**
1. Comprehensive checklist for every changed file (lines 47-130) — Systematic verification of all standards
2. Dual-mode operation for feature checking vs TypeScript cleanup (lines 23-32) — Adapts to different contexts
3. "Check for any usage across the whole codebase" in TypeScript mode (lines 194-201) — Catches shortcuts and workarounds
4. Required reading of ALL standards files (lines 10-17) — Ensures complete knowledge of rules

**Scar-tissue rules:**
- "New any usages added during cleanup with no justification are violations" (line 201) — Response to TypeScript "fixes" that just suppress errors
- "If docs/ts-suppressions.md does not exist, that is a violation" (lines 212-213) — Requires documentation for suppressions
- Search patterns for various rule violations throughout checklist — Each suggests a past violation

**Possible bloat:**
- Very detailed checklist could potentially be condensed (uncertain — detail may be necessary for mechanical checking)
- Some redundancy between Mode A and Mode B reporting templates

### test-writer.md

**Purpose:** Writes tests in two passes — Pass 1 before implementation writes schema/validation and end-to-end tests without mocks, Pass 2 after implementation writes component and API tests with real mocks based on actual code. Enforces strict TDD with tests that must fail initially.

**Top rules doing the most work:**
1. "ABSOLUTE RULES" section (lines 19-66) — Five critical rules including never guessing field names and never importing real PrismaClient
2. "HARD STOP — Prove you have read the spec before writing anything" (lines 77-135) — Mandatory spec confirmation before any test writing
3. "Bug Fix Regression Tests — CRITICAL RULES" (lines 147-215) — Ensures regression tests verify correct behavior, not buggy behavior
4. Two-pass structure explanation (lines 14-15) — Fundamental architecture preventing mock guessing
5. "Phase Test Inventory gate" (lines 267-305) — Prevents writing tests when there's nothing to test

**Scar-tissue rules:**
- "Never guess field names for ANY Prisma model" (lines 26-31) — Extreme emphasis suggests major past issues
- "If you find yourself writing new PrismaClient() in a test file, STOP" (lines 40-42) — Specific anti-pattern
- "Never test database-enforced behaviors" with exhaustive list (lines 45-58) — Each item likely a past mistake
- "The One Rule" for regression tests (lines 156-160) — Response to backwards regression tests
- "Cannot proceed — no specification file found" hard stop (lines 86-96) — Prevents assumption-based testing
- Multiple "Do NOT proceed" and "STOP COMPLETELY" warnings throughout

**Possible bloat:**
- Extreme length (734 lines) makes it unlikely to be fully absorbed at runtime
- Heavy repetition of rules about reading specs and not guessing (uncertain — may be necessary given criticality)
- Multiple overlapping sections about mocking patterns
- Very detailed examples and self-check sections

## Section 3 — Cross-File System Analysis

### Duplication

**Rules appearing in multiple files:**

1. **"Read the standards files" requirement**
   - architect.md: lines 10-14 lists specific standards files
   - implementer.md: lines 10-14 lists standards files
   - code-reviewer.md: lines 10-15 lists standards files
   - standards-checker.md: lines 10-17 lists ALL standards files
   - test-writer.md: lines 10-13 lists standards files
   - documentation-writer.md: lines 49-51 lists standards files
   - Wording: Similar but not identical — each agent lists the standards relevant to their role

2. **"Never modify test files" rule**
   - implementer.md: Absolute Rule 1 (lines 26-35) — extensive detail
   - test-writer.md: Referenced as implementer's rule
   - Wording: Only implementer has the full prohibition

3. **Platform/tech stack reference**
   - architect.md: lines 16-32
   - bug-investigator.md: lines 25-37
   - business-analyst.md: lines 10-16
   - test-writer.md: lines 218-227
   - Wording: Similar with minor variations

4. **"Do not guess — verify" sentiment**
   - architect.md: "Do not guess — verify" (line 47)
   - test-writer.md: "Never guess field names" (line 26)
   - implementer.md: "stop and ask, never guess and proceed" (line 89)
   - Wording: Drifted — different phrasings of same concept

5. **Prisma mock warnings**
   - test-writer.md: "Never import a real PrismaClient in a test" (lines 36-42)
   - implementer.md: Referenced in multiple places warning about wrong test setup
   - Wording: Similar emphasis, different contexts

### Contradictions

1. **Who writes tests?**
   - test-writer.md: Claims sole responsibility for all test creation
   - implementer.md: Absolute Rule 1 prohibits creating any test file
   - No actual contradiction — roles are clearly separated

2. **Documentation modification authority**
   - documentation-writer.md: Can update technical documentation but NOT standards docs
   - documentation-writer.md: Lists specific prohibited files (lines 27-33)
   - No contradiction, but the boundary could be confusing

3. **When to run agents**
   - project-manager.md: "ALWAYS use this agent BEFORE build-feature for any non-trivial request"
   - business-analyst.md: "ALWAYS use this agent FIRST before any new feature"
   - Apparent conflict about which comes first — project-manager should run before business-analyst according to descriptions, but could be clearer

### Gaps

**Important rules I would expect but cannot find:**

1. **Rollback procedures** — No agent has clear instructions for what to do when a feature needs to be rolled back or reverted

2. **Performance testing requirements** — No agent mentions performance benchmarks or load testing despite this being an enterprise platform

3. **Data migration safety** — While migrations are mentioned, no agent has specific rules about backwards compatibility or zero-downtime migrations

4. **Cross-browser testing requirements** — End-to-end tests are mentioned but browser compatibility is not addressed

5. **Accessibility standards** — No agent mentions WCAG compliance or accessibility testing

6. **API versioning** — No mention of how to handle API changes that might break existing consumers

7. **Secret management** — While "no secrets in code" is mentioned, there's no guidance on proper secret handling

8. **Deployment coordination** — No agent discusses deployment windows, feature flags, or gradual rollouts

### Size Concerns

**Files large enough to impact reliable execution:**

1. **test-writer.md (734 lines)** — Largest file by significant margin. Contains extensive rules, two separate passes, multiple gates and checkpoints. The sheer volume of instructions makes it unlikely an agent can consistently follow all rules, especially the nuanced regression test requirements and the complex decision tree for what to test when.

2. **implementer.md (449 lines)** — Second largest file with extreme rule repetition. The Absolute Rules section alone is lengthy, and the requirement to output rule restatements adds overhead. The Failure Loop Protocol is complex enough that consistent execution is questionable.

3. **standards-checker.md (297 lines)** — Contains exhaustive checklists that would be better as external references. The mechanical nature of the checking could be better served by automated tools rather than agent instructions.

4. **bug-investigator.md (278 lines)** — Dual-mode operation adds complexity. The two different workflows (single bug vs test suite) might be better as separate agents.

5. **documentation-writer.md (239 lines)** — Heavy emphasis on what NOT to do (roughly 40% of the file) suggests this agent frequently made mistakes, leading to rule accumulation that may now be counterproductive.

## Section 4 — Notes on What Could Not Be Determine

**Items I flagged but cannot analyze without reading files outside .claude/agents/:**

1. Whether the duplicate platform/tech stack references could be centralized in a single file that agents reference

2. How the global Prisma mock in `src/test/setup.ts` actually works — multiple agents reference it but disagree on details

3. Whether `docs/CODING_STANDARDS.md` and related standards files contain rules that conflict with agent instructions

4. How `/build-feature` and `/fix-bug` commands actually chain the agents — referenced but not defined in agent files

5. Whether the "Andy" mentioned throughout is the only user or if these agents need to handle multiple users

6. How Pass 2 of test-writer gets triggered "AUTOMATICALLY" — mechanism not explained

7. What the actual TypeScript error count is that triggers the standards-checker's TypeScript mode

8. Whether the prohibition on modifying standards documents in documentation-writer is consistently applied when standards legitimately need updating

9. How agents handle version control conflicts if multiple are running concurrently

10. What happens when one agent in a pipeline fails — no clear error handling or recovery process defined

11. Whether the test file patterns in implementer.md match what test-writer.md actually creates

12. How the "dev" branch referenced in multiple agents relates to the "main" branch mentioned elsewhere