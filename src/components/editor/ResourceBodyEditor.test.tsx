import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResourceBodyEditor } from "@/components/editor/ResourceBodyEditor";

const exactMarkdownSample = `# \u{1F680} Markdown Test Document

## Headings
### H3 Heading
#### H4 Heading

---

## Text Formatting
**Bold text**  
*Italic text*  
~~Strikethrough~~  
\`Inline code\`

---

## Lists

### Unordered
- Item 1
- Item 2
  - Nested Item
  - Another nested item

### Ordered
1. First item
2. Second item
3. Third item

---

## Links & Images
[OpenAI](https://openai.com)

![Sample Image](https://via.placeholder.com/150)

---

## Blockquote
> This is a blockquote  
> It can span multiple lines

---

## Code Blocks

### JavaScript
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet("World"));
\`\`\`

### JSON
\`\`\`json
{
  "name": "Test User",
  "role": "Developer",
  "active": true
}
\`\`\`

---

## Table

| Feature       | Status  | Notes              |
|--------------|--------|--------------------|
| Headings     | \u2705     | Working fine       |
| Lists        | \u2705     | Nested supported   |
| Code Blocks  | \u2705     | Syntax highlight   |
| Tables       | \u26A0\uFE0F     | Check alignment    |

---

## Task List
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task

---

## Horizontal Rule
---

## Escaping Characters
\\*This should not be italic\\*  
\\# This should not be a heading  

---

## Mixed Content Test
Here is **bold**, *italic*, and a [link](https://example.com) inside a sentence.

---

## Emoji Support
\u{1F525} \u{1F680} \u2705 \u274C \u{1F60E}

---

## Edge Cases
- Empty line below:

  
- Long text wrapping test:
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

---

## Final Check
> If all sections render correctly, your markdown parser is solid \u2705`;

const markdownSample = `# 🚀 Markdown Test Document

## Headings
### H3 Heading
#### H4 Heading

---

## Text Formatting
**Bold text**  
*Italic text*  
~~Strikethrough~~  
\`Inline code\`

---

## Lists

### Unordered
- Item 1
- Item 2
  - Nested Item
  - Another nested item

### Ordered
1. First item
2. Second item
3. Third item

---

## Links & Images
[OpenAI](https://openai.com)

![Sample Image](https://via.placeholder.com/150)

---

## Blockquote
> This is a blockquote  
> It can span multiple lines

---

## Code Blocks

### JavaScript
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet("World"));
\`\`\`

### JSON
\`\`\`json
{
  "name": "Test User",
  "role": "Developer",
  "active": true
}
\`\`\`

---

## Table

| Feature       | Status  | Notes              |
|--------------|--------|--------------------|
| Headings     | ✅     | Working fine       |
| Lists        | ✅     | Nested supported   |
| Code Blocks  | ✅     | Syntax highlight   |
| Tables       | ⚠️     | Check alignment    |

---

## Task List
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
`;

describe("ResourceBodyEditor", () => {
  it("renders the provided markdown sample correctly after switching to rich text", async () => {
    render(<ResourceBodyEditor value={exactMarkdownSample} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /switch to rich text/i }));

    await waitFor(() => {
      expect(screen.getByText("H3 Heading")).toBeInTheDocument();
    });

    expect(screen.getByText("Inline code")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("First item")).toBeInTheDocument();
    expect(screen.getByText("Working fine")).toBeInTheDocument();
    expect(screen.getByText("Completed task")).toBeInTheDocument();
    expect(screen.getByText(/This should not be italic/i)).toBeInTheDocument();
    expect(screen.getByText(/This should not be a heading/i)).toBeInTheDocument();
    expect(screen.getByText(/your markdown parser is solid/i)).toBeInTheDocument();
    expect(screen.getAllByAltText("Sample Image").length).toBeGreaterThan(0);
  });

  it("shows a preview after selecting a local image", async () => {
    function Harness() {
      const [value, setValue] = useState("");
      return <ResourceBodyEditor value={value} onChange={setValue} />;
    }

    const { container } = render(<Harness />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "preview.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText("preview.png")).toBeInTheDocument();
    });
  });
});
