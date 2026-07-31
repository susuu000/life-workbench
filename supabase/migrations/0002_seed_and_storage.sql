-- ============================================================
-- 生活工作台 · 迁移 0002
-- 内容: 1) journal 存储桶（手账图片）  2) 手动精选表种子数据
-- 说明: 自动抓取表(news_cache 等)由 Edge Functions 填充；
--       此处仅填充需人工精选的公共表，使首屏即有内容。
-- ============================================================

-- ===== 1. journal 存储桶（手账图片上传，私有）=====
insert into storage.buckets (id, name, public)
values ('journal', 'journal', false)
on conflict (id) do nothing;

-- 仅本人可读写自己上传的手账图片
create policy "journal objects owner only"
  on storage.objects for all
  using (bucket_id = 'journal' and owner = auth.uid())
  with check (bucket_id = 'journal' and owner = auth.uid());


-- ===== 2. 公众号精选（单读 / KnowYourself / heytea）=====
insert into wechat_picks (account, title, summary, url) values
  ('单读', '我们为什么还需要文学？', '在信息碎片的年代，长阅读是一种抵抗。', 'https://mp.weixin.qq.com'),
  ('KnowYourself', '如何与自己的情绪和平共处', '情绪不是敌人，而是信号。', 'https://mp.weixin.qq.com'),
  ('喜茶', '当季新品灵感：茶与生活的仪式感', '一杯好茶，是日常的微小确幸。', 'https://mp.weixin.qq.com')
on conflict do nothing;


-- ===== 3. 三联中读精选 =====
insert into sanlian_articles (title, summary, url) values
  ('我们时代的阅读困境与可能', '在算法推荐之外，重建主动阅读的能力。', 'https://www.lifeweek.com.cn'),
  ('博物馆里的中国色彩', '从秘色到滇红，传统色如何回到日常。', 'https://www.lifeweek.com.cn')
on conflict do nothing;


-- ===== 4. 播客（小宇宙热榜示例）=====
insert into podcast_items (name, episode_title, summary, play_url, source) values
  ('不合时宜', '我们如何想象另一种生活', '关于逃离与重建的对话。', 'https://www.xiaoyuzhoufm.com', 'xiaoyuzhou_hot'),
  ('硅谷101', 'AI 浪潮下的普通人机会', '技术之外，更关乎选择。', 'https://www.xiaoyuzhoufm.com', 'xiaoyuzhou_hot'),
  ('随机波动', '女性在公共领域的声音', '倾听与被倾听。', 'https://www.xiaoyuzhoufm.com', 'xiaoyuzhou_hot')
on conflict do nothing;


-- ===== 5. 自媒体推荐（今日推荐 / 灵感 / 审美搭建）=====
insert into social_media_recs (type, title, content, traffic_analysis, platform) values
  ('today_rec', '今日推荐：把日子过成展品', '记录而非表演，是自媒体最稀缺的品质。', '真诚记录类内容完播率更高', 'xiaohongshu'),
  ('inspiration', '灵感：用「对比」讲一个故事', '前后对比、理想与现实对比，天然有戏剧张力。', '对比结构更易触发收藏', 'douyin'),
  ('aesthetic', '审美搭建：秘色 + 留白的视觉系统', '低饱和主色 + 大量留白 + 衬线标题，质感立现。', null, 'other')
on conflict do nothing;


-- ===== 6. AI 知识库（办公 / 漫剧 / 搭建）=====
insert into ai_knowledge_items (category, prompt_formula, four_elements, summary, core_tip) values
  ('ai_office', '角色+任务+格式+约束', '你是资深助理；帮我写周报；输出 Markdown；不超过 200 字', '用 AI 把重复文书工作自动化。', '先把流程写清楚，再让 AI 填空。'),
  ('ai_comic', '风格+主角+场景+情绪', '吉卜力风；女孩；雨后的窗边；安静治愈', '一句话生成分镜灵感。', '情绪词决定画面气质。'),
  ('ai_build', '目标+技术栈+约束+验收', '做一个记账网页；Next.js；移动端优先；可导出 CSV', '用 AI 辅助从 0 到 1 搭应用。', '把验收标准写进 prompt，减少返工。')
on conflict do nothing;


-- ============================================================
-- 完成: journal 桶 + 5 类公共表种子数据
-- 自动抓取表请部署 Edge Functions 后由 daily-cron 填充。
-- ============================================================
