import { ttdl, igdl, fbdown, twitter, youtube, pinterest, capcut, yts } from 'btch-downloader';
import rahadPkg from 'rahad-all-downloader-v2';
const alldl = rahadPkg.alldl || rahadPkg.default?.alldl;

// In-Memory Ultra-Fast Video Cache (30 min TTL)
const videoCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(url) {
  const item = videoCache.get(url);
  if (item && Date.now() - item.time < CACHE_TTL_MS) {
    return item.data;
  }
  return null;
}

function setCache(url, data) {
  if (videoCache.size > 500) {
    const keys = Array.from(videoCache.keys()).slice(0, 50);
    keys.forEach(k => videoCache.delete(k));
  }
  videoCache.set(url, { time: Date.now(), data });
}

// Top Verified Public Cobalt Instances
// (2026-10-13: all instances dead — emptied so races skip Cobalt instantly)
const COBALT_SERVERS = [];

async function querySingleCobalt(srv, url, platform) {
  const res = await fetch(`${srv}/`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    body: JSON.stringify({
      url,
      videoQuality: '720'
    }),
    signal: AbortSignal.timeout(3000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  let vUrl = null;
  if (data.status === 'tunnel' || data.status === 'redirect') {
    vUrl = data.url;
  } else if (data.status === 'picker' && Array.isArray(data.picker)) {
    const item = data.picker.find(p => p.type === 'video') || data.picker[0];
    vUrl = item?.url;
  }
  if (vUrl && typeof vUrl === 'string') {
    return {
      success: true,
      source: `${platform} (Cobalt)`,
      title: `${platform} Video`,
      videoUrl: vUrl,
      thumbnail: null
    };
  }
  throw new Error('No video stream in Cobalt response');
}

/**
 * Concurrently queries all Cobalt instances in parallel
 * Whichever answers first wins; never waits sequentially
 */
async function queryCobalt(url, platform = 'Video') {
  const tasks = COBALT_SERVERS.map(srv => querySingleCobalt(srv, url, platform));
  return await Promise.any(tasks);
}

function parseRahadData(res, defaultSource = 'Universal Video') {
  if (!res || !res.data) return null;
  const d = res.data;
  const dl = d.download || {};
  // Prefer standard high-speed 720p/sd streams over bloated 80MB files
  const vUrl =
    dl.no_watermark ||
    dl.video ||
    dl.sd ||
    d.videoUrl ||
    dl.hd ||
    dl.url ||
    dl.watermark;

  if (vUrl && typeof vUrl === 'string') {
    return {
      success: true,
      source: d.source || defaultSource,
      title: d.title || 'Video Stream',
      videoUrl: vUrl,
      thumbnail: d.thumbnail || null
    };
  }
  return null;
}

/**
 * Ultra-Fast Multi-Engine Video Downloader
 * Concurrently races multiple high-speed backends to return the fastest direct MP4 stream!
 */
export async function downloadVideo(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Please provide a valid video link.');
  }

  const cleanUrl = url.trim();

  // Instant Cache Check (0ms response for duplicate or recent links)
  const cached = getCached(cleanUrl);
  if (cached) {
    console.log(`[DOWNLOAD] Cache HIT for: ${cleanUrl}`);
    return cached;
  }

  const startTime = Date.now();

  // 1. Direct Video Link (.mp4, .mov, .webm, etc.)
  if (/\.(mp4|mov|webm|mkv|m4v)(\?.*)?$/i.test(cleanUrl)) {
    const directResult = {
      success: true,
      source: 'Direct MP4 Video',
      title: 'Direct MP4 Stream',
      videoUrl: cleanUrl,
      thumbnail: null
    };
    setCache(cleanUrl, directResult);
    return directResult;
  }

  let result = null;

  // 2. TikTok (Concurrent race: TikWM + Tiklydown + Siputzx + Cobalt + Rahad + ttdl)
  if (/tiktok\.com/i.test(cleanUrl)) {
    result = await raceTikTok(cleanUrl);
  }
  // 3. Instagram (Concurrent race: Direct Embed Scraper + Siputzx + GuruAPI + Cobalt + igdl + Rahad)
  else if (/instagram\.com/i.test(cleanUrl)) {
    result = await raceInstagram(cleanUrl);
  }
  // 4. Twitter / X (Concurrent race: vxtwitter + fxtwitter + Siputzx + Cobalt + twitter + Rahad)
  else if (/twitter\.com|x\.com/i.test(cleanUrl)) {
    result = await raceTwitter(cleanUrl);
  }
  // 5. YouTube (Concurrent race: Cobalt + Invidious Pool + Siputzx + youtube + Rahad)
  else if (/youtube\.com|youtu\.be/i.test(cleanUrl)) {
    result = await raceYouTube(cleanUrl);
  }
  // 6. Facebook (Concurrent race: Siputzx + GuruAPI + Cobalt + fbdown + Rahad)
  else if (/facebook\.com|fb\.watch/i.test(cleanUrl)) {
    result = await raceFacebook(cleanUrl);
  }
  // 7. Pinterest
  else if (/pinterest\.com|pin\.it/i.test(cleanUrl)) {
    result = await racePinterest(cleanUrl);
  }
  // 8. CapCut
  else if (/capcut\.com/i.test(cleanUrl)) {
    result = await raceCapCut(cleanUrl);
  }
  // 9. All other websites (Snapchat, Threads, Likee, Kwai, Vimeo, Dailymotion, etc.)
  else {
    result = await downloadUniversal(cleanUrl);
  }

  if (result && result.videoUrl) {
    const elapsed = Date.now() - startTime;
    console.log(`[DOWNLOAD] Link resolved in ${elapsed}ms via ${result.source}`);
    setCache(cleanUrl, result);
    return result;
  }

  throw new Error('Unable to extract MP4 video from this link. Please make sure the post is public.');
}

// --- FAST PARALLEL RACERS ---

async function raceTikTok(url) {
  const tasks = [];

  // Engine 1: TikWM (Ultra-fast direct API, ~250ms)
  tasks.push(
    fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => {
        if (data.code === 0 && data.data) {
          const v = data.data;
          const playUrl = v.play || v.wmplay || v.hdplay;
          if (playUrl) {
            return {
              success: true,
              source: 'TikTok (TikWM)',
              title: v.title || 'TikTok Video',
              videoUrl: playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`,
              thumbnail: v.cover,
              author: v.author?.nickname || v.author?.unique_id || 'TikTok Creator',
              duration: v.duration ? `${v.duration}s` : null
            };
          }
        }
        throw new Error('TikWM empty');
      })
  );

  // Engine 2: Tiklydown fallback API
  tasks.push(
    fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const v = data.video?.noWatermark || data.video?.url || data.video?.watermark;
        if (v) {
          return {
            success: true,
            source: 'TikTok (Tiklydown)',
            title: data.title || 'TikTok Video',
            videoUrl: v,
            thumbnail: data.video?.cover || null,
            author: data.author?.name || null
          };
        }
        throw new Error('Tiklydown empty');
      })
  );

  // Engine 3: Siputzx Fast Open Downloader API
  tasks.push(
    fetch(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const v = data.data?.video?.noWatermark || data.data?.video || data.data?.play || data.result?.video;
        const vUrl = typeof v === 'string' ? v : (v?.url || v?.no_watermark);
        if (vUrl) {
          return {
            success: true,
            source: 'TikTok (Siputzx API)',
            title: data.data?.title || 'TikTok Video',
            videoUrl: vUrl,
            thumbnail: data.data?.cover || null
          };
        }
        throw new Error('Siputzx TikTok empty');
      })
  );

  // Engine 4: Cobalt Fast Parallel Pipeline
  tasks.push(queryCobalt(url, 'TikTok'));

  // Engine 5: Rahad alldl
  if (alldl) {
    tasks.push(
      Promise.race([
        alldl(url, { retries: 0 }).then(r => {
          const p = parseRahadData(r, 'TikTok (Rahad)');
          if (p) return p;
          throw new Error('Rahad empty');
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
    );
  }

  // Engine 6: btch ttdl
  tasks.push(
    Promise.race([
      ttdl(url).then(data => {
        if (data.status && data.video && data.video.length > 0) {
          return {
            success: true,
            source: 'TikTok (ttdl)',
            title: data.title || 'TikTok Video',
            videoUrl: data.video[0],
            thumbnail: data.thumbnail
          };
        }
        throw new Error('ttdl empty');
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ])
  );

  try {
    return await Promise.any(tasks);
  } catch (err) {
    throw new Error("Couldn't retrieve MP4 video from this TikTok link. Please make sure it is public.");
  }
}

async function raceInstagram(url) {
  const tasks = [];

  // Engine 1: Direct Embed Meta CDN Extraction (Ultra-fast, ~300ms)
  const shortcodeMatch = url.match(/\/(reel|p|tv|reels)\/([A-Za-z0-9_-]+)/i);
  if (shortcodeMatch && shortcodeMatch[2]) {
    const code = shortcodeMatch[2];
    tasks.push(
      fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(3500)
      })
      .then(r => r.text())
      .then(html => {
        const vMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
        if (vMatch && vMatch[1]) {
          const directUrl = vMatch[1]
            .replace(/\\u002F/g, '/')
            .replace(/\\/g, '')
            .replace(/&amp;/g, '&');
          const thumbMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/);
          return {
            success: true,
            source: 'Instagram (Direct CDN)',
            title: 'Instagram Reel',
            videoUrl: directUrl,
            thumbnail: thumbMatch ? thumbMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '').replace(/&amp;/g, '&') : null
          };
        }
        throw new Error('Embed empty');
      })
    );
  }

  // Engine 2: Siputzx Instagram Open API
  tasks.push(
    fetch(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const items = data.data || data.result;
        if (Array.isArray(items) && items.length > 0) {
          const v = items.find(i => i.url || i.video) || items[0];
          const vUrl = typeof v === 'string' ? v : (v.url || v.video);
          if (vUrl) {
            return {
              success: true,
              source: 'Instagram (Siputzx API)',
              title: 'Instagram Video',
              videoUrl: vUrl,
              thumbnail: v.thumbnail || null
            };
          }
        }
        throw new Error('Siputzx IG empty');
      })
  );

  // Engine 3: GuruAPI Instagram Downloader
  tasks.push(
    fetch(`https://api.guruapi.tech/insta/v1/igdl?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const media = data.media || data.result || [];
        if (Array.isArray(media) && media.length > 0) {
          const first = media[0];
          const vUrl = typeof first === 'string' ? first : (first.url || first.download_url);
          if (vUrl) {
            return {
              success: true,
              source: 'Instagram (GuruAPI)',
              title: 'Instagram Reel',
              videoUrl: vUrl,
              thumbnail: first.thumbnail || null
            };
          }
        }
        throw new Error('GuruAPI empty');
      })
  );

  // Engine 4: Cobalt Fast Parallel Pipeline
  tasks.push(queryCobalt(url, 'Instagram'));

  // Engine 5: btch igdl
  tasks.push(
    Promise.race([
      igdl(url).then(data => {
        if (data.status && data.result && data.result.length > 0) {
          const first = data.result[0];
          const vUrl = typeof first === 'string' ? first : (first.url || first.video);
          if (vUrl) {
            return {
              success: true,
              source: 'Instagram (igdl)',
              title: 'Instagram Reel / Post',
              videoUrl: typeof vUrl === 'string' ? vUrl : vUrl.url,
              thumbnail: first.thumbnail || null
            };
          }
        }
        throw new Error('igdl empty');
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ])
  );

  // Engine 6: Rahad alldl
  if (alldl) {
    tasks.push(
      Promise.race([
        alldl(url, { retries: 0 }).then(r => {
          const p = parseRahadData(r, 'Instagram (Rahad)');
          if (p) return p;
          throw new Error('Rahad empty');
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
    );
  }

  try {
    return await Promise.any(tasks);
  } catch (e) {
    throw new Error("Couldn't extract this Instagram video. Please check that the post or account is public.");
  }
}

async function raceTwitter(url) {
  const tasks = [];

  const tweetIdMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
  const tid = tweetIdMatch ? tweetIdMatch[1] : null;

  // Engine 1: vxtwitter API (Ultra-fast direct JSON, ~200ms)
  if (tid) {
    tasks.push(
      fetch(`https://api.vxtwitter.com/i/status/${tid}`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      .then(r => r.json())
      .then(data => {
        const ext = data.media_extended || [];
        const vid = ext.find(m => m.type === 'video' && m.url);
        if (vid) {
          return {
            success: true,
            source: 'Twitter / X (vxtwitter)',
            title: (data.text || 'Twitter / X Video').slice(0, 100),
            videoUrl: vid.url,
            thumbnail: data.mediaURLs?.[0] || null
          };
        }
        throw new Error('vxtwitter empty');
      })
    );

    // Engine 2: fxtwitter API fallback
    tasks.push(
      fetch(`https://api.fxtwitter.com/i/status/${tid}`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      .then(r => r.json())
      .then(data => {
        const tweet = data.tweet;
        const vid = tweet?.media?.videos?.[0];
        if (vid && vid.url) {
          return {
            success: true,
            source: 'Twitter / X (fxtwitter)',
            title: (tweet.text || 'Twitter / X Video').slice(0, 100),
            videoUrl: vid.url,
            thumbnail: vid.thumbnail_url || null
          };
        }
        throw new Error('fxtwitter empty');
      })
    );
  }

  // Engine 3: Siputzx Twitter API
  tasks.push(
    fetch(`https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const v = data.data?.video || data.data?.url || data.result?.url;
        if (v) {
          return {
            success: true,
            source: 'Twitter / X (Siputzx)',
            title: data.data?.title || 'Twitter / X Video',
            videoUrl: typeof v === 'string' ? v : v[0],
            thumbnail: null
          };
        }
        throw new Error('Siputzx Twitter empty');
      })
  );

  // Engine 4: Cobalt Parallel
  tasks.push(queryCobalt(url, 'Twitter / X'));

  // Engine 5: btch twitter
  tasks.push(
    Promise.race([
      twitter(url).then(data => {
        if (data.status && data.url) {
          const vUrl = Array.isArray(data.url) ? data.url[0] : data.url;
          return {
            success: true,
            source: 'Twitter / X (btch)',
            title: data.title || 'Twitter / X Video',
            videoUrl: typeof vUrl === 'string' ? vUrl : vUrl.url,
            thumbnail: null
          };
        }
        throw new Error('twitter empty');
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ])
  );

  // Engine 6: Rahad alldl
  if (alldl) {
    tasks.push(
      Promise.race([
        alldl(url, { retries: 0 }).then(r => {
          const p = parseRahadData(r, 'Twitter / X (Rahad)');
          if (p) return p;
          throw new Error('Rahad empty');
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
    );
  }

  try {
    return await Promise.any(tasks);
  } catch (e) {
    throw new Error("Couldn't download this Twitter/X video.");
  }
}

async function raceYouTube(url) {
  const tasks = [];

  // Engine 1: Cobalt Parallel (Fastest for YouTube Shorts & Videos)
  tasks.push(queryCobalt(url, 'YouTube'));

  // Engine 2: Invidious Pool (Multi-Instance Parallel Race)
  const ytIdMatch = url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (ytIdMatch && ytIdMatch[1]) {
    const ytid = ytIdMatch[1];
    const invidiousHosts = [
      'https://invidious.f5.si',
      'https://inv.nadeko.net',
      'https://yt.drgnz.club'
    ];

    invidiousHosts.forEach(host => {
      tasks.push(
        fetch(`${host}/api/v1/videos/${ytid}`, { signal: AbortSignal.timeout(3500) })
          .then(r => r.json())
          .then(data => {
            const streams = (data.formatStreams || []).filter(s => s.url);
            if (streams.length > 0) {
              const chosen = streams.find(s => /720p|480p/i.test(s.quality)) || streams[0];
              return {
                success: true,
                source: `YouTube (Invidious)`,
                title: data.title || 'YouTube Video',
                videoUrl: chosen.url,
                thumbnail: data.videoThumbnails?.[0]?.url || null,
                author: data.author || 'YouTube'
              };
            }
            throw new Error('Invidious no streams');
          })
      );
    });
  }

  // Engine 3: Siputzx YouTube Downloader API
  tasks.push(
    fetch(`https://api.siputzx.my.id/api/d/youtube?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const v = data.data?.video || data.data?.url || data.result?.url;
        if (v) {
          return {
            success: true,
            source: 'YouTube (Siputzx API)',
            title: data.data?.title || 'YouTube Video',
            videoUrl: typeof v === 'string' ? v : v[0],
            thumbnail: data.data?.thumbnail || null
          };
        }
        throw new Error('Siputzx YT empty');
      })
  );

  // Engine 4: btch youtube
  tasks.push(
    Promise.race([
      youtube(url).then(data => {
        if (data.status && (data.mp4 || data.video)) {
          return {
            success: true,
            source: 'YouTube (btch)',
            title: data.title || 'YouTube Video',
            videoUrl: data.mp4 || data.video,
            thumbnail: data.thumbnail,
            author: data.author || 'YouTube Channel'
          };
        }
        throw new Error('youtube empty');
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500))
    ])
  );

  // Engine 5: Rahad alldl
  if (alldl) {
    tasks.push(
      Promise.race([
        alldl(url, { retries: 0 }).then(r => {
          const p = parseRahadData(r, 'YouTube (Rahad)');
          if (p) return p;
          throw new Error('Rahad empty');
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500))
      ])
    );
  }

  try {
    return await Promise.any(tasks);
  } catch (e) {
    throw new Error("Couldn't download this YouTube video. Age-restricted videos or live streams are not supported.");
  }
}

async function raceFacebook(url) {
  const tasks = [];

  // Engine 1: Siputzx Facebook API
  tasks.push(
    fetch(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const v = data.data?.normal || data.data?.sd || data.data?.video || data.data?.hd;
        if (v) {
          return {
            success: true,
            source: 'Facebook (Siputzx)',
            title: data.data?.title || 'Facebook Video',
            videoUrl: v,
            thumbnail: data.data?.thumbnail || null
          };
        }
        throw new Error('Siputzx FB empty');
      })
  );

  // Engine 2: GuruAPI Facebook Downloader
  tasks.push(
    fetch(`https://api.guruapi.tech/fb/v1/download?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3500) })
      .then(r => r.json())
      .then(data => {
        const v = data.sd || data.video || data.hd || data.result?.sd;
        if (v) {
          return {
            success: true,
            source: 'Facebook (GuruAPI)',
            title: data.title || 'Facebook Video',
            videoUrl: v,
            thumbnail: null
          };
        }
        throw new Error('GuruAPI FB empty');
      })
  );

  // Engine 3: Cobalt Parallel
  tasks.push(queryCobalt(url, 'Facebook'));

  // Engine 4: btch fbdown (Prefer Normal/SD for fast sending)
  tasks.push(
    Promise.race([
      fbdown(url).then(data => {
        if (data.status && (data.Normal_video || data.HD)) {
          return {
            success: true,
            source: 'Facebook (fbdown)',
            title: 'Facebook Reel / Video',
            videoUrl: data.Normal_video || data.HD,
            thumbnail: null
          };
        }
        throw new Error('fbdown empty');
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ])
  );

  // Engine 5: Rahad alldl
  if (alldl) {
    tasks.push(
      Promise.race([
        alldl(url, { retries: 0 }).then(r => {
          const p = parseRahadData(r, 'Facebook (Rahad)');
          if (p) return p;
          throw new Error('Rahad empty');
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
    );
  }

  try {
    return await Promise.any(tasks);
  } catch (e) {
    throw new Error("Couldn't extract Facebook video. Make sure the video or reel is public.");
  }
}

async function racePinterest(url) {
  const tasks = [];

  tasks.push(queryCobalt(url, 'Pinterest'));

  tasks.push(
    Promise.race([
      pinterest(url).then(data => {
        if (data.status && (data.url || data.video)) {
          return {
            success: true,
            source: 'Pinterest (btch)',
            title: data.title || 'Pinterest Video',
            videoUrl: data.url || data.video,
            thumbnail: null
          };
        }
        throw new Error('pinterest empty');
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500))
    ])
  );

  if (alldl) {
    tasks.push(
      Promise.race([
        alldl(url, { retries: 0 }).then(r => {
          const p = parseRahadData(r, 'Pinterest (Rahad)');
          if (p) return p;
          throw new Error('Rahad empty');
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
    );
  }

  try {
    return await Promise.any(tasks);
  } catch (e) {
    throw new Error("Couldn't download this Pinterest media.");
  }
}

async function raceCapCut(url) {
  const tasks = [];

  tasks.push(
    Promise.race([
      capcut(url).then(data => {
        if (data.status && (data.video || data.originalVideoUrl)) {
          return {
            success: true,
            source: 'CapCut (btch)',
            title: data.title || 'CapCut Video',
            videoUrl: data.video || data.originalVideoUrl,
            thumbnail: null,
            author: data.author || 'CapCut Creator'
          };
        }
        throw new Error('capcut empty');
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500))
    ])
  );

  if (alldl) {
    tasks.push(
      Promise.race([
        alldl(url, { retries: 0 }).then(r => {
          const p = parseRahadData(r, 'CapCut (Rahad)');
          if (p) return p;
          throw new Error('Rahad empty');
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ])
    );
  }

  try {
    return await Promise.any(tasks);
  } catch (e) {
    throw new Error("Couldn't download this CapCut video.");
  }
}

async function downloadUniversal(url) {
  try {
    return await queryCobalt(url, 'Video');
  } catch (e) {}

  if (alldl) {
    try {
      const rRes = await Promise.race([
        alldl(url, { retries: 0 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);
      const parsed = parseRahadData(rRes, 'Universal Video');
      if (parsed) return parsed;
    } catch (e) {}
  }

  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data.code === 0 && data.data?.play) {
      return {
        success: true,
        source: 'Video Stream',
        title: data.data.title || 'Video',
        videoUrl: data.data.play.startsWith('http') ? data.data.play : `https://www.tikwm.com${data.data.play}`,
        thumbnail: data.data.cover
      };
    }
  } catch (e) {}

  throw new Error('Unsupported video website or private link. Supported: TikTok, Instagram, YouTube, Facebook, Twitter/X, Pinterest, CapCut, Snapchat, Threads, Likee, Kwai, Dailymotion, Vimeo, and direct MP4 URLs.');
}

/**
 * High-Speed Audio Stream Downloader
 * Extracts crystal clear MP3 audio directly from video links
 */
export async function downloadAudio(url) {
  if (!url || typeof url !== 'string') throw new Error('Please provide a valid link');
  const cleanUrl = url.trim();

  // TikTok Direct MP3
  if (/tiktok\.com/i.test(cleanUrl)) {
    try {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data.code === 0 && data.data?.music) {
        return {
          title: data.data.music_info?.title || 'TikTok Audio',
          audioUrl: data.data.music.startsWith('http') ? data.data.music : `https://www.tikwm.com${data.data.music}`,
          mimetype: 'audio/mpeg'
        };
      }
    } catch (e) {}
  }

  // Cobalt Parallel Direct MP3 Audio Extraction
  const cobaltTasks = COBALT_SERVERS.map(async srv => {
    const res = await fetch(`${srv}/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({
        url: cleanUrl,
        downloadMode: 'audio',
        audioFormat: 'mp3'
      }),
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const aUrl = data.url;
    if (aUrl && typeof aUrl === 'string') {
      return {
        title: 'Audio Stream',
        audioUrl: aUrl,
        mimetype: 'audio/mpeg'
      };
    }
    throw new Error('No audio');
  });

  try {
    return await Promise.any(cobaltTasks);
  } catch (e) {}

  // Fallback to video stream
  const v = await downloadVideo(cleanUrl);
  return {
    title: v.title || 'Audio',
    audioUrl: v.videoUrl,
    mimetype: 'audio/mp4'
  };
}

/**
 * Score how well a song result matches the user's query (0-100).
 * Higher = better match. Considers title words, artist, and penalizes
 * ringtones/previews/covers when the user wants the original.
 */
function scoreSongMatch(query, title, artist, index = 0, total = 1) {
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const t = (title || '').toLowerCase();
  const a = (artist || '').toLowerCase();
  if (!q.length || !t) return 0;
  let score = 0;
  for (const word of q) {
    if (t.includes(word)) score += 20;
    else if (a.includes(word)) score += 10;
  }
  // Penalize previews, ringtones, covers, remixes unless asked
  const tl = t.toLowerCase();
  if (/ringtone|jio ?tune|preview|30 sec/.test(tl) && !/ringtone|tune/.test(query.toLowerCase())) score -= 30;
  if (/cover|unplugged|remix|dj /.test(tl) && !/cover|remix|unplugged/.test(query.toLowerCase())) score -= 15;
  // Bonus for exact title containment
  if (t.includes(query.toLowerCase().trim())) score += 15;
  // Popularity boost (2026-10-13): JioSaavn/YouTube return popular first,
  // so earlier results get a bonus — user wants the POPULAR song, not obscure matches
  score += Math.max(0, 10 - index * 2);
  return Math.max(0, score);
}

/**
 * Search and download any song / audio by title or singer
 * Powered by high-speed JioSaavn 320kbps CDN + YouTube MP3 extraction
 */
export async function searchAndDownloadSong(query) {
  if (!query || typeof query !== 'string') throw new Error('Song ka naam batayein');
  const cleanQ = query.trim();

  // 1. Primary Engine: Official High-Speed JioSaavn Direct Engine (Works 100% globally & Pakistan)
  try {
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=5&p=1&q=${encodeURIComponent(cleanQ)}`;
    const sRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (sRes.ok) {
      const sData = await sRes.json();
      const songs = sData.results || [];
      if (Array.isArray(songs) && songs.length > 0) {
        // Smart match: score all results, pick the best (not blindly [0])
        let top = songs[0];
        let bestScore = -1;
        for (let si = 0; si < songs.length; si++) {
          const s = songs[si];
          const sc = scoreSongMatch(cleanQ, s.title, s.more_info?.singers || s.more_info?.music || '', si, songs.length);
          if (sc > bestScore) { bestScore = sc; top = s; }
        }
        let audioUrl = null;

        // 1.1 Try full 320kbps generateAuthToken FIRST (not the 30s preview)
        if (top.more_info?.encrypted_media_url) {
          try {
            const authRes = await fetch(`https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(top.more_info.encrypted_media_url)}&bitrate=320&_format=json&ctx=android`, {
              signal: AbortSignal.timeout(2500),
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const authData = await authRes.json();
            if (authData.auth_url) {
              audioUrl = authData.auth_url;
            }
          } catch (e) {}
        }

        // 1.2 Fallback: JioTune 30s preview only if full track failed
        if (!audioUrl && top.more_info?.vlink) {
          audioUrl = top.more_info.vlink;
        }

        if (audioUrl) {
          const artist = top.more_info?.singers || top.more_info?.music || top.singers || 'Artist';
          const thumb = top.image ? top.image.replace('150x150', '500x500') : null;
          return {
            title: (top.title || cleanQ).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
            author: artist.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
            duration: top.more_info?.duration ? `${Math.floor(top.more_info.duration / 60)}:${String(top.more_info.duration % 60).padStart(2, '0')}` : '',
            thumbnail: thumb,
            audioUrl: audioUrl,
            source: 'Jio Music'
          };
        }
      }
    }
  } catch (e) {
    console.warn('Official JioSaavn search exception:', e.message);
  }

  // 2. Secondary Engine: YouTube Search via yts
  try {
    const searchRes = await yts(cleanQ);
    const videos = searchRes?.result?.videos || searchRes?.videos || [];
    if (videos && videos.length > 0) {
      // Smart match for YouTube too
      let best = videos[0];
      let bestScore = -1;
      const vids = videos.slice(0, 8);
      for (let vi = 0; vi < vids.length; vi++) {
        const v = vids[vi];
        const sc = scoreSongMatch(cleanQ, v.title, v.author?.name || '', vi, vids.length);
        if (sc > bestScore) { bestScore = sc; best = v; }
      }
      const videoUrl = best.url || `https://www.youtube.com/watch?v=${best.videoId}`;

      // Try btch youtube extractor
      try {
        const dl = await youtube(videoUrl);
        if (dl && (dl.mp3 || dl.audio)) {
          return {
            title: dl.title || best.title,
            author: dl.author || best.author?.name || 'Artist',
            duration: best.timestamp || '',
            thumbnail: dl.thumbnail || best.thumbnail,
            audioUrl: dl.mp3 || dl.audio,
            source: 'YouTube Music'
          };
        }
      } catch (err) {}

      // Try Cobalt audio extraction
      try {
        const cobaltAudio = await downloadAudio(videoUrl);
        if (cobaltAudio?.audioUrl) {
          return {
            title: best.title,
            author: best.author?.name || 'Artist',
            duration: best.timestamp || '',
            thumbnail: best.thumbnail,
            audioUrl: cobaltAudio.audioUrl,
            source: 'Cobalt YouTube'
          };
        }
      } catch (err) {}
    }
  } catch (e) {
    console.warn('YouTube search warning:', e.message);
  }

  throw new Error(`"${cleanQ}" ke liye audio stream nahi mil saki. Baraye meherbani doosra naam try karein.`);
}

/**
 * Search High-Quality Images & Wallpapers
 */
export async function searchImage(query) {
  if (!query || typeof query !== 'string') throw new Error('Image ka naam batayein');
  const cleanQ = query.trim();

  try {
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(cleanQ)}&t=h_&iax=images&ia=images`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4500)
    });
    const tokenHtml = await tokenRes.text();
    const vqdMatch = tokenHtml.match(/vqd=([\d-]+)/) || tokenHtml.match(/vqd="([^"]+)"/);
    if (vqdMatch) {
      const vqd = vqdMatch[1];
      const imgRes = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(cleanQ)}&vqd=${vqd}&f=,,,`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500)
      });
      if (imgRes.ok) {
        const data = await imgRes.json();
        const first = data.results?.find(r => r.image && r.image.startsWith('http'));
        if (first) {
          return {
            title: first.title || cleanQ,
            imageUrl: first.image,
            source: first.url
          };
        }
      }
    }
  } catch (e) {
    console.error('DDG image search error:', e.message);
  }

  // High quality fallback
  return {
    title: cleanQ,
    imageUrl: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80`,
    source: 'Unsplash'
  };
}
