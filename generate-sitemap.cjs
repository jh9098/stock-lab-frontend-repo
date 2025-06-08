const { SitemapStream, streamToPromise } = require('sitemap');
const { createWriteStream } = require('fs');
const path = require('path');
const axios = require('axios'); // Node.js 18 이상에서는 require('node-fetch') 또는 fetch를 직접 사용 가능

async function generateSitemap() {
    const hostname = 'https://stocksrlab.netlify.app'; // 웹사이트의 기본 URL
    const sitemap = new SitemapStream({ hostname });

    // 1. 정적 페이지 추가 (필수)
    sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 }); // 메인 페이지
    sitemap.write({ url: '/blog', changefreq: 'daily', priority: 0.9 }); // 블로그 목록 페이지
    sitemap.write({ url: '/news', changefreq: 'daily', priority: 0.8 }); // 뉴스 목록 페이지
    sitemap.write({ url: '/ai-summaries', changefreq: 'daily', priority: 0.7 }); // AI 요약 목록 페이지
    // 기타 정적 페이지가 있다면 여기에 추가:
    // sitemap.write({ url: '/about', changefreq: 'monthly', priority: 0.7 });

    // 2. 동적 블로그 글 추가 (가장 중요!)
    try {
        // --- 여기를 수정하세요: 백엔드 API 엔드포인트 ---
        // Render 백엔드 주소: https://stock-lab-backend-repo.onrender.com
        // blogPostsApiUrl: 모든 블로그 글의 목록을 JSON 형태로 반환하는 백엔드 API 엔드포인트
        // 예시: 백엔드가 '/posts' 경로로 모든 글을 반환한다고 가정
        const blogPostsApiUrl = 'https://stock-lab-backend-repo.onrender.com/api/blog/posts-list';

        console.log(`백엔드 API 호출 중: ${blogPostsApiUrl}`);
        const response = await axios.get(blogPostsApiUrl);
        
        // API 응답 형태에 따라 .data.data 또는 .data 등 적절히 접근
        // 예시: API가 [{ _id: '...', title: '...' }, ...] 형태의 배열을 반환한다고 가정
        const posts = response.data; 

        if (Array.isArray(posts)) {
            for (const post of posts) {
                // 각 블로그 글의 고유 ID를 사용하여 URL 생성
                // post._id 또는 post.id (백엔드에서 사용하는 실제 고유 식별자 필드명)
                // 만약 백엔드에서 글 ID를 `_id`로 제공한다면 `post._id`
                // 만약 백엔드에서 글 ID를 `id`로 제공한다면 `post.id`
                // `https://stocksrlab.netlify.app/blog/Q4LTFFbHwK8JdutA5UMF` 패턴이므로 /blog/ 다음에 ID
                if (post._id) { // _id 필드가 존재한다고 가정
                    sitemap.write({ url: `/blog/${post._id}`, changefreq: 'weekly', priority: 0.8 });
                } else if (post.id) { // id 필드가 존재한다면 (_id가 없을 경우 대비)
                    sitemap.write({ url: `/blog/${post.id}`, changefreq: 'weekly', priority: 0.8 });
                } else {
                    console.warn('API 응답에서 블로그 글의 고유 ID(_id 또는 id)를 찾을 수 없습니다:', post);
                }
            }
            console.log(`총 ${posts.length}개의 블로그 글 URL이 사이트맵에 추가되었습니다.`);
        } else {
            console.warn('API 응답이 예상과 다릅니다. 배열 형태의 데이터를 기대했습니다:', posts);
        }

    } catch (error) {
        console.error('블로그 글 API를 가져오는 중 오류 발생:', error.message);
        if (error.response) {
            console.error('API 응답 상태:', error.response.status);
            console.error('API 응답 데이터:', error.response.data);
        }
        // 오류가 발생해도 정적 페이지는 사이트맵에 포함될 수 있도록 스크립트가 중단되지 않게 합니다.
    }

    sitemap.end(); // 사이트맵 스트림 종료

    // 사이트맵 파일을 public 폴더에 저장
    // Netlify는 public 폴더의 내용을 루트 경로에 배포합니다.
    const sitemapFilePath = path.resolve(__dirname, 'dist', 'sitemap.xml'); 
    console.log(`사이트맵 파일을 ${sitemapFilePath} 에 생성 중...`);

    const writable = createWriteStream(sitemapFilePath);
    try {
        await streamToPromise(sitemap).then(data => {
            writable.write(data.toString());
            writable.end();
            console.log('Sitemap.xml 파일이 성공적으로 생성되었습니다.');
        });
    } catch (error) {
        console.error('사이트맵 파일 생성 중 오류 발생:', error);
    }
}

generateSitemap();
