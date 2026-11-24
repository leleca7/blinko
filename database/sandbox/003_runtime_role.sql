-- Only the dedicated synthetic sandbox, after fixtures.
-- Do not enable LOGIN or set passwords in version-controlled SQL.
CREATE ROLE os_lab_runtime NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT os_lab_test TO os_lab_runtime;
-- Operator must review and provision the login securely before any live connection.
