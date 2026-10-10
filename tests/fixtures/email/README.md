# Email fixtures

Fictional `.eml` messages for parser tests. None is a real email; addresses use
`example.com`. `tests/helpers/eml.ts` converts them into the Gmail API
`format=full` shape. Sentinel strings (`BODY-ONLY-SENTINEL`,
`ATTACHMENT-SENTINEL-NEVER-READ`) let tests prove that body text outside the
parsed fields, and attachments, are never kept.
