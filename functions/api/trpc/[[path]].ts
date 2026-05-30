// เพิ่มใน functions/api/trpc/[[path]].ts
// เพิ่ม handleNoindexPosts ก่อน handleProcedure
// และเพิ่ม if (proc.includes("monitor.noindexPosts")) return handleNoindexPosts(env);
// ในส่วน handleProcedure

async function handleNoindexPosts(env: CloudflareFunctionEnv) {
  try {
    const siteUrl = "https://nakornchiangrainews.com";
    
    // ดึง published posts ล่าสุด 15 บทความ พร้อม ID
    const res = await fetch(
      `${siteUrl}/wp-json/wp/v2/posts?per_page=15&status=publish&_fields=id,title,link&orderby=date&order=desc`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { posts: [], available: false };
    
    const posts = await res.json() as { id: number; title: { rendered: string }; link: string }[];
    
    // ตรวจ noindex โดยดึง HTML ของแต่ละ post (batch 5 ต่อรอบ)
    const results = [];
    const batch = posts.slice(0, 8); // ตรวจแค่ 8 บทความล่าสุดป้องกัน timeout
    
    await Promise.all(batch.map(async (post) => {
      try {
        const htmlRes = await fetch(post.link, { 
          signal: AbortSignal.timeout(6000),
          headers: { "User-Agent": "NCR-Watchdog/1.0" }
        });
        const html = await htmlRes.text();
        
        // ตรวจ noindex จาก meta robots tag
        const hasNoindex = 
          (html.includes('name="robots"') && html.toLowerCase().includes("noindex")) ||
          (html.includes("name='robots'") && html.toLowerCase().includes("noindex")) ||
          html.includes('X-Robots-Tag: noindex');
        
        // Extract post ID จาก link หรือใช้ ID จาก API
        results.push({
          id: post.id,
          title: post.title.rendered.replace(/<[^>]*>/g, ""), // strip HTML tags
          link: post.link,
          editUrl: `${siteUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
          hasNoindex,
          path: post.link.replace(siteUrl, "") || "/",
        });
      } catch {
        // skip ถ้า timeout
      }
    }));
    
    const noindexPosts = results.filter(p => p.hasNoindex);
    
    return {
      posts: results,
      noindexPosts,
      noindexCount: noindexPosts.length,
      available: true,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { posts: [], noindexPosts: [], noindexCount: 0, available: false, error: String(err) };
  }
}
