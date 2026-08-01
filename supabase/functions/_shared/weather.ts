// 和风天气代理：城市 -> 实时天气 + 三日预报，写入 weather_cache
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface WeatherResult {
  city: string;
  temp: number;
  condition: string;
  icon_code: string;
  forecast: { date: string; temp_max: number; temp_min: number; condition: string; icon_code: string }[];
}

// 主要城市经纬度（和风天气 location 支持 "经度,纬度"）。
// 说明：本项目 key 的 Location API(geo 城市查询) 被安全设置限制返回 403，
// 因此改为用经纬度直查天气接口，避开被封的城市查询接口。
const CITY_COORDS: Record<string, string> = {
  宁波: '121.55,29.87',
  北京: '116.41,39.90',
  上海: '121.47,31.23',
  广州: '113.26,23.13',
  深圳: '114.06,22.55',
  杭州: '120.15,30.27',
  成都: '104.07,30.57',
  武汉: '114.30,30.59',
  南京: '118.80,32.06',
  西安: '108.94,34.34',
  重庆: '106.55,29.56',
  苏州: '120.62,31.30',
  天津: '117.20,39.13',
  长沙: '112.94,28.23',
  郑州: '113.62,34.75',
  青岛: '120.38,36.07',
  厦门: '118.09,24.48',
  昆明: '102.83,24.88',
  大连: '121.62,38.92',
  合肥: '117.28,31.86',
  福州: '119.30,26.08',
  济南: '117.00,36.65',
  哈尔滨: '126.53,45.80',
  沈阳: '123.43,41.80',
  长春: '125.32,43.82',
  石家庄: '114.51,38.04',
  太原: '112.55,37.87',
  南昌: '115.86,28.68',
  南宁: '108.32,22.82',
  贵阳: '106.63,26.65',
  兰州: '103.83,36.06',
  海口: '110.35,20.02',
  香港: '114.17,22.32',
  澳门: '113.55,22.20',
  台北: '121.56,25.03',
  拉萨: '91.11,29.97',
  乌鲁木齐: '87.62,43.82',
  呼和浩特: '111.75,40.84',
  银川: '106.23,38.49',
  西宁: '101.78,36.62',
  东京: '139.69,35.69',
  纽约: '-74.01,40.71',
  伦敦: '-0.13,51.51',
};

async function qweatherGet(path: string, params: Record<string, string>): Promise<any> {
  const key = Deno.env.get('QWEATHER_API_KEY');
  if (!key) throw new Error('QWEATHER_API_KEY 未设置');
  // 使用和风天气标准 API Host（免费订阅: devapi.qweather.com / 商业订阅: api.qweather.com）
  const host = Deno.env.get('QWEATHER_API_HOST') || 'devapi.qweather.com';
  const url = new URL(`https://${host}${path}`);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // 重试逻辑（最多 2 次，间隔 1s）
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url.toString(), {
        headers: { 'User-Agent': 'SusuBot/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`和风天气 HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }
      return await resp.json();
    } catch (e) {
      lastErr = e as Error;
      if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr ?? new Error('和风天气请求失败');
}

/** 城市名 -> location 参数（优先本地坐标表；geo 不可用时兜底尝试一次） */
async function resolveLocation(city: string): Promise<string> {
  if (CITY_COORDS[city]) return CITY_COORDS[city];
  // 兜底：尝试被限制的 geo 接口（部署环境若放行即可命中）
  try {
    const geo = await qweatherGet('/geo/v2/city/lookup', { location: city, number: '1' });
    const loc = geo?.location?.[0];
    if (loc?.id) return loc.id;
  } catch {
    /* 忽略，继续抛错 */
  }
  throw new Error(`未找到城市坐标: ${city}（可在 CITY_COORDS 中补充经纬度）`);
}

/** 拉取并缓存某城市天气；返回天气结果 */
export async function refreshWeather(sb: SupabaseClient, city: string): Promise<WeatherResult> {
  const id = await resolveLocation(city);

  // 三日预报（含今日实时）
  const fc = await qweatherGet('/v7/weather/3d', { location: id });
  const daily = (fc?.daily ?? []).slice(0, 3).map((d: any) => ({
    date: d.fxDate,
    temp_max: Number(d.tempMax),
    temp_min: Number(d.tempMin),
    condition: d.textDay,
    icon_code: d.iconDay,
  }));
  const now = await qweatherGet('/v7/weather/now', { location: id });
  const temp = Number(now?.now?.temp ?? daily[0]?.temp_max ?? 0);
  const condition = now?.now?.text ?? daily[0]?.condition ?? '';
  const icon_code = now?.now?.icon ?? daily[0]?.icon_code ?? '';

  const result: WeatherResult = { city, temp, condition, icon_code, forecast: daily };

  // 缓存（按 city 主键 upsert）
  const { error } = await sb.from('weather_cache').upsert(
    { city, temp, condition, icon_code, forecast: daily, updated_at: new Date().toISOString() },
    { onConflict: 'city' }
  );
  if (error) throw new Error(`weather_cache 写入失败: ${error.message}`);
  return result;
}
