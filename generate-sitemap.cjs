// generate-sitemap.cjs

const { SitemapStream, streamToPromise } = require('sitemap');
const { createWriteStream, existsSync, mkdirSync } = require('fs');
const path = require('path');
const axios = require('axios');

async function generateSitemap() {
    const hostname = 'https://stocksrlab.netlify.app';
    const sitemap = new SitemapStream({ hostname });

    // dist 폴더 존재 여부 확인 및 생성
    const distDir = path.resolve(__dirname, 'dist');
    if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
        console.log(`DEBUG: 'dist' 폴더가 없어 생성했습니다: ${distDir}`);
    }

    // 1. 정적 페이지 추가 (필수)
    sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 });
    sitemap.write({ url: '/blog', changefreq: 'daily', priority: 0.9 });
    sitemap.write({ url: '/news', changefreq: 'daily', priority: 0.8 });
    sitemap.write({ url: '/ai-summaries', changefreq: 'daily', priority: 0.7 });
    // 기타 정적 페이지 추가 (이전에 있었던 것들)
    sitemap.write({ url: '/list', changefreq: 'weekly', priority: 0.6 }); // sitemap.xml에 있었던 추가 페이지
    sitemap.write({ url: '/recommendations', changefreq: 'weekly', priority: 0.6 });
    sitemap.write({ url: '/theme/energy', changefreq: 'weekly', priority: 0.5 });
    sitemap.write({ url: '/theme/forex', changefreq: 'weekly', priority: 0.5 });
    sitemap.write({ url: '/theme/bci', changefreq: 'weekly', priority: 0.5 });


    // 2. 동적 블로그 글 추가
    let dynamicUrlsAdded = 0;
    try {
        const blogPostsApiUrl = 'https://stock-lab-backend-repo.onrender.com/api/blog/posts-list';

        console.log(`백엔드 API 호출 중: ${blogPostsApiUrl}`);
        const response = await axios.get(blogPostsApiUrl, { timeout: 30000 }); // 타임아웃 30초로 증가 (콜드 스타트 대비)
        
        const posts = response.data; 

        if (Array.isArray(posts)) {
            for (const post of posts) {
                if (post._id) { 
                    sitemap.write({ url: `/blog/${post._id}`, changefreq: 'weekly', priority: 0.8 });
                    dynamicUrlsAdded++;
                } else if (post.id) { 
                    sitemap.write({ url: `/blog/${post.id}`, changefreq: 'weekly', priority: 0.8 });
                    dynamicUrlsAdded++;
                } else {
                    console.warn('API 응답에서 블로그 글의 고유 ID(_id 또는 id)를 찾을 수 없습니다:', post);
                }
            }
            console.log(`총 ${dynamicUrlsAdded}개의 블로그 글 URL이 사이트맵에 추가되었습니다.`);
        } else {
            console.warn('API 응답이 예상과 다릅니다. 배열 형태의 데이터를 기대했습니다:', posts);
        }

    } catch (error) {
        console.error('블로그 글 API를 가져오는 중 오류 발생:', error.message);
        if (error.response) {
            console.error('API 응답 상태:', error.response.status);
            console.error('API 응답 데이터 (일부):', String(error.response.data).substring(0, 500) + '...'); // 너무 길면 잘라서 출력
        } else if (error.request) {
            console.error('API 요청이 응답을 받지 못했습니다. (네트워크 오류 또는 타임아웃):', error.request);
        } else {
            console.error('API 요청 설정 오류:', error.message);
        }
        console.warn('API 오류로 인해 동적 블로그 글 URL은 사이트맵에 추가되지 않았습니다.');
        // 오류가 발생해도 정적 페이지는 사이트맵에 포함될 수 있도록 스크립트가 중단되지 않게 합니다.
    }

    // 최종 사이트맵 파일 생성
    sitemap.end(); 
    const sitemapFilePath = path.resolve(distDir, 'sitemap.xml'); 
    console.log(`사이트맵 파일을 ${sitemapFilePath} 에 생성 중...`);

    const writable = createWriteStream(sitemapFilePath);
    try {
        await streamToPromise(sitemap).then(data => {
            writable.write(data.toString());
            writable.end();
            console.log(`Sitemap.xml 파일이 성공적으로 생성되었습니다. (동적 URL ${dynamicUrlsAdded}개 포함)`);
        });
    } catch (error) {
        console.error('사이트맵 파일 최종 생성 중 오류 발생:', error);
    }
}

generateSitemap();
