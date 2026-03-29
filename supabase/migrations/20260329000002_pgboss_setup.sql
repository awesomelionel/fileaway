-- pgboss job queue schema
-- This creates the pgboss schema used for background job processing.
-- Run after initial_schema migration.
-- The pg-boss npm package handles schema creation automatically on first connect,
-- but this migration documents the intent and ensures the schema exists.

create schema if not exists pgboss;

-- Grant usage to the service role
grant usage on schema pgboss to service_role;
grant all privileges on all tables in schema pgboss to service_role;
grant all privileges on all sequences in schema pgboss to service_role;
alter default privileges in schema pgboss grant all on tables to service_role;
alter default privileges in schema pgboss grant all on sequences to service_role;
