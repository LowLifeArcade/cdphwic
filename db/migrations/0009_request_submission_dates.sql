-- Recover the original submit date, not a later edit/open date.
-- Legacy seed imports have no trustworthy original submission timestamp.
UPDATE surplus_submissions
SET request_json = json_set(request_json, '$.submissionDate', replace(created_at, ' ', 'T') || 'Z')
WHERE (json_extract(request_json, '$.submissionDate') IS NULL
       OR trim(json_extract(request_json, '$.submissionDate')) = '')
  AND payload <> 'legacy';
