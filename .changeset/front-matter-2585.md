---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

A leading YAML front matter block (`---` ... `---`) is now accepted on every diagram type instead of failing with "Invalid mermaid header". `config:` is applied like the equivalent `%%{init}%%` directive; `title:` and other keys are ignored. An unterminated block reports the line of its opening `---` (#2585).
