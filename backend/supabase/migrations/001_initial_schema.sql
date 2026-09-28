-- DataPilot initial schema
-- Run this in the Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DATASETS
-- ============================================================
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'json')),
    row_count BIGINT NOT NULL DEFAULT 0,
    column_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'profiling', 'ready', 'error')),
    profile JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS datasets_user_id_idx ON datasets(user_id);
CREATE INDEX IF NOT EXISTS datasets_status_idx ON datasets(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER datasets_updated_at
    BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CLEANING PIPELINES
-- ============================================================
CREATE TABLE IF NOT EXISTS cleaning_pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cleaning_pipelines_user_id_idx ON cleaning_pipelines(user_id);
CREATE INDEX IF NOT EXISTS cleaning_pipelines_dataset_id_idx ON cleaning_pipelines(dataset_id);

CREATE TRIGGER cleaning_pipelines_updated_at
    BEFORE UPDATE ON cleaning_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CHARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS charts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    pipeline_id UUID REFERENCES cleaning_pipelines(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS charts_user_id_idx ON charts(user_id);

CREATE TRIGGER charts_updated_at
    BEFORE UPDATE ON charts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DASHBOARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    layout JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    public_slug TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dashboards_user_id_idx ON dashboards(user_id);
CREATE INDEX IF NOT EXISTS dashboards_public_slug_idx ON dashboards(public_slug) WHERE public_slug IS NOT NULL;

CREATE TRIGGER dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

-- Datasets: users own their data
CREATE POLICY "datasets_select_own" ON datasets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "datasets_insert_own" ON datasets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "datasets_update_own" ON datasets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "datasets_delete_own" ON datasets FOR DELETE USING (auth.uid() = user_id);

-- Pipelines
CREATE POLICY "pipelines_select_own" ON cleaning_pipelines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pipelines_insert_own" ON cleaning_pipelines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pipelines_update_own" ON cleaning_pipelines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pipelines_delete_own" ON cleaning_pipelines FOR DELETE USING (auth.uid() = user_id);

-- Charts
CREATE POLICY "charts_select_own" ON charts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "charts_insert_own" ON charts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "charts_update_own" ON charts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "charts_delete_own" ON charts FOR DELETE USING (auth.uid() = user_id);

-- Dashboards: own + public read
CREATE POLICY "dashboards_select_own" ON dashboards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dashboards_select_public" ON dashboards FOR SELECT USING (is_public = TRUE);
CREATE POLICY "dashboards_insert_own" ON dashboards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dashboards_update_own" ON dashboards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dashboards_delete_own" ON dashboards FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- Run separately in Storage settings or via Supabase CLI
-- ============================================================
-- Create bucket: name="datasets", public=false
-- Add policy: allow authenticated users to upload/read their own files
-- Path pattern: {user_id}/**
