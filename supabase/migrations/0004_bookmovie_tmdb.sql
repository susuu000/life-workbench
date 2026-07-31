-- 0004：书影上新支持 TMDB 数据源（原 Letterboxd 被 Cloudflare 403 拦截）
-- 1) 放宽 source 取值约束，允许 'tmdb'
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'book_movie_new'::regclass AND contype = 'c';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE book_movie_new DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE book_movie_new
  ADD CONSTRAINT book_movie_new_source_check
  CHECK (source IN ('douban', 'letterboxd', 'tmdb'));

-- 2) 丰富字段：海报与评分（TMDB 提供，原表无）
ALTER TABLE book_movie_new
  ADD COLUMN IF NOT EXISTS poster_url TEXT,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(4, 1);
