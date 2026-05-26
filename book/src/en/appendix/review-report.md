# Reader Review Report

> Summary from 3 simulated user reviews, used to guide content improvements

## 🔴 Critical Issues (Must Fix)

### 1. Many Chapter 3 sections marked as "under construction"
- **Reader**: Team Lead
- **Issue**: Sections 3.1, 3.2, 3.4 are empty shells
- **Fix**: Fill in the core content for these three sections

### 2. payload-analyze invocation method not explained
- **Reader**: Frontend Developer
- **Issue**: Users don't know whether to run it in chat or terminal CLI
- **Fix**: Clearly state "This is an AI tool, run it in chat by asking the AI"

### 3. No distill configuration examples
- **Reader**: Frontend Developer
- **Issue**: context.md distill section has only concepts, no code
- **Fix**: Add JSON configuration examples and field descriptions

### 4. Chapter 7 example code uses `|>` pipe operator
- **Reader**: Extension Developer
- **Issue**: This operator is not officially available, copying will cause errors
- **Fix**: Change to standard syntax

## 🟡 Important Issues (Should Fix)

### 5. Unclear division of labor between smart-compact and context-manager
- **Fix**: Add comparison table in Chapter 5

### 6. Missing file path reference
- **Fix**: Add `settings.json` / `.pi/config.json` path explanation in introduction.md

### 7. Terms appear without cross-references on first use
- **Issue**: Terms like shepherd, payload, tools definitions appear suddenly
- **Fix**: Add footnotes or links on first occurrence

### 8. Chapter 7 missing debugging methods
- **Fix**: Add "Debugging Extensions" section

### 9. shepherd condition expression syntax not formally defined
- **Fix**: Add syntax explanation and common examples

### 10. No team usage guide
- **Fix**: Add team scenarios in Chapter 3 or Appendix

## 🟢 Improvement Suggestions (Nice to Have)

- Add frontend project adaptation notes (whether JSX/CSS is compressed by distill)
- Compaction failure troubleshooting section
- ExtensionContext type definitions and import methods
- pi-shared-utils storage path explanation
- Rule template library (15-20 copy-paste rules)
- "From Zero to Publish" quick reference checklist
