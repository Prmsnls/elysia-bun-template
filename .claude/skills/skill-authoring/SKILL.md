---
name: Skill Authoring Best Practices
description: A guide for AI agents on how to author effective, token-efficient skills for OpenCode/Claude.
---

## 1. Core Principles

- **Information Density**: Maximize signal, minimize noise. No fluff, prose, or conversational filler.
- **Actionability**: Instructions must be direct, specific, and unambiguous.
- **Structure**: Use clear headings, lists, and tables to make information scannable.

## 2. Skill Structure

All skills MUST start with a YAML frontmatter block.

```yaml
---
name: "Concise Name of the Skill"
description: "A one-sentence summary of what this skill enables the agent to do."
---
```

Use Markdown headings (`##`, `###`) to create logical sections.

## 3. Token Optimization

- **Be Terse**: Use short sentences and direct language.
- **Use Lists**: Employ bulleted (`-`) or numbered (`1.`) lists for steps, items, or key points.
- **Use Tables**: Use Markdown tables to present structured, comparative data.
- **Reference, Don't Embed**: Refer to project files by their full path instead of embedding large content blocks.

## 4. Patterns: Good vs. Bad

| Pattern              | Good (Efficient & Clear)                                                                | Bad (Inefficient & Vague)                                               |
| -------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Instruction**      | `In `user_service.ts`, refactor the `getUser` function to return `null` if not found.`                                                                | `The user service has a bug you should fix. It's in the user file.`     |
| **File Content**     | `See the schema in `convex/schema.ts`.`                                                 | `Here is the content of schema.ts: [very long file content]`          |
| **Data**             | `Key dependencies: { "react": "18.2.0", "vite": "5.0.0" }`                              | `The project uses React and Vite, among other things.`                  |
| **Commands**         | `Run `npm install --save-dev prettier`.`                                                 | `You should probably add Prettier to the project.`                      |

## 5. Formatting Guide

### Code Blocks

Use code blocks for:
- Shell commands: `` `run_shell_command` ``
- Code snippets: ` ```typescript 
 // code 
 ``` `
- File paths: `` `path/to/your/file.ext` ``
- Configuration examples: ` ```yaml 
 key: value 
 ``` `

### Tables vs. Lists

- **Use Tables** for comparing attributes or showing key-value pairs (e.g., Good/Bad Patterns).
- **Use Lists** for sequential steps, checklists, or simple enumerations.

### File References

Always refer to files using their full path from the project root. This allows the agent to locate and interact with them directly.

**Example**:
- **Correct**: `Update the `User` table definition in `convex/schema.ts`.`
- **Incorrect**: `Update the schema.`

## 6. Actionable Instructions

Your goal is to provide instructions that can be directly translated into actions or tool calls.

- **Start with a strong verb**: "Refactor", "Add", "Create", "Delete", "Update".
- **Be specific**: Provide file names, function names, and variable names.
- **Provide context**: Briefly state the *why* behind the action if it's not obvious.
  - *Example*: "To improve performance, add a `db.index` for the `email` field in the `users` table schema located in `convex/schema.ts`."
