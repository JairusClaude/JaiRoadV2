-- JaiROADS: read-only inventory. Does NOT change canonical or legacy metadata.
-- Execute with an approved operator; return only counts, never private object paths.
-- Historical public rows are not orphans simply because they are not canonical.
BEGIN TRANSACTION READ ONLY;

SELECT
    count(*) FILTER (WHERE canonical.id IS NOT NULL) AS canonical_document_objects,
    count(*) FILTER (WHERE canonical.id IS NULL AND legacy.id IS NOT NULL) AS legacy_only_document_objects,
    count(*) FILTER (WHERE canonical.id IS NULL AND legacy.id IS NULL) AS unreferenced_document_objects
FROM storage.objects AS obj
LEFT JOIN jairoads_next.maintenance_documents AS canonical ON canonical.file_path = obj.name
LEFT JOIN public.maintenance_documents AS legacy ON legacy.file_path = obj.name
WHERE obj.bucket_id = 'jairoads-maintenance-documents'
  AND coalesce(obj.is_delete_marker, false) = false;

SELECT
    (SELECT count(*) FROM jairoads_next.maintenance_documents AS doc
      WHERE NOT EXISTS (SELECT 1 FROM storage.objects AS obj
         WHERE obj.bucket_id = 'jairoads-maintenance-documents'
           AND obj.name = doc.file_path AND coalesce(obj.is_delete_marker, false) = false)) AS canonical_rows_missing_storage,
    (SELECT count(*) FROM public.maintenance_documents AS doc
      WHERE NOT EXISTS (SELECT 1 FROM storage.objects AS obj
         WHERE obj.bucket_id = 'jairoads-maintenance-documents'
           AND obj.name = doc.file_path AND coalesce(obj.is_delete_marker, false) = false)) AS legacy_rows_missing_storage;

COMMIT;
