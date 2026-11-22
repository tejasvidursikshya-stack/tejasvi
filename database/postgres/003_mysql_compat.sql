-- MySQL-compatible helper functions used by the app's SQL (see lib/pg-compat.mjs).
-- Timestamps are stored as UTC "timestamp without time zone", matching the MySQL DATETIME(3) columns.

CREATE OR REPLACE FUNCTION utc_timestamp() RETURNS timestamp(0) LANGUAGE sql STABLE AS
$$ SELECT (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(0) $$;

CREATE OR REPLACE FUNCTION utc_timestamp(p integer) RETURNS timestamp LANGUAGE sql STABLE AS
$$ SELECT CASE WHEN p >= 3 THEN (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
               ELSE (statement_timestamp() AT TIME ZONE 'UTC')::timestamp(0) END $$;

CREATE OR REPLACE FUNCTION date_sub(t timestamp, i interval) RETURNS timestamp LANGUAGE sql IMMUTABLE AS $$ SELECT t - i $$;
CREATE OR REPLACE FUNCTION date_add(t timestamp, i interval) RETURNS timestamp LANGUAGE sql IMMUTABLE AS $$ SELECT t + i $$;

-- MySQL JSON paths such as '$.a.b' and '$.a[0]' are valid SQL/JSON paths.
CREATE OR REPLACE FUNCTION json_extract(doc jsonb, path text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS
$$ SELECT jsonb_path_query_first(doc, path::jsonpath) $$;

CREATE OR REPLACE FUNCTION json_unquote(v jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT CASE WHEN v IS NULL THEN NULL WHEN jsonb_typeof(v) = 'string' THEN v #>> '{}' ELSE v::text END $$;

CREATE OR REPLACE FUNCTION json_unquote(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT v $$;

CREATE OR REPLACE FUNCTION json_length(v jsonb) RETURNS integer LANGUAGE sql IMMUTABLE AS
$$ SELECT CASE WHEN v IS NULL THEN NULL
                WHEN jsonb_typeof(v) = 'array' THEN jsonb_array_length(v)
                WHEN jsonb_typeof(v) = 'object' THEN (SELECT count(*)::int FROM jsonb_object_keys(v))
                ELSE 1 END $$;

-- JSON_OBJECT() is a Postgres keyword; lib/pg-compat.mjs rewrites an empty JSON_OBJECT() to '{}'::jsonb.

-- JSON_SET(doc, '$.k1', v1, '$.k2', v2, ...): values are stored as JSON strings (or null).
CREATE OR REPLACE FUNCTION json_set(doc jsonb, VARIADIC args text[]) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE i int := 1; keys text[];
BEGIN
  IF doc IS NULL THEN RETURN NULL; END IF;
  WHILE i < coalesce(array_length(args, 1), 0) LOOP
    keys := regexp_split_to_array(regexp_replace(args[i], '^\$\.?', ''), '\.');
    doc := jsonb_set(doc, keys, coalesce(to_jsonb(args[i + 1]), 'null'::jsonb), true);
    i := i + 2;
  END LOOP;
  RETURN doc;
END $$;
