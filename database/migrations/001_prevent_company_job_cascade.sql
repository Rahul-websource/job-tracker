-- Prevent deleting companies that still have linked jobs.
-- Existing companies and jobs are preserved.

BEGIN;

ALTER TABLE public.jobs
    DROP CONSTRAINT jobs_company_id_fkey;

ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_company_id_fkey
    FOREIGN KEY (company_id)
    REFERENCES public.companies(id)
    ON DELETE RESTRICT;

COMMIT;
