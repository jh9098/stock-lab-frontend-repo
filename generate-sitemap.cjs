// generate-sitemap.cjs

const { SitemapStream, streamToPromise } = require('sitemap');
const { createWriteStream, existsSync, mkdirSync } = require('fs');
const path = require('path');
const axios = require('axios'); // axios는 이제 더 이상 필요 없지만, 혹시 몰라 남겨둡니다.
const admin = require('firebase-admin'); // Firebase Admin SDK 임포트

async function generateSitemap() {
    const hostname = 'https://stocksrlab.netlify.app';
    const sitemap = new SitemapStream({ hostname });

    // dist 폴더 존재 여부 확인 및 생성
    const distDir = path.resolve(__dirname, 'dist');
    if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
        console.log(`DEBUG: 'dist' 폴더가 없어 생성했습니다: ${distDir}`);
    }

    // --- Firebase Admin SDK 초기화 ---
    // Netlify 환경 변수에서 서비스 계정 정보 가져오기
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountBase64) {
        console.error('ERROR: FIREBASE_SERVICE_ACCOUNT 환경 변수가 설정되지 않았습니다. Firestore 연동 실패.');
        // 환경 변수가 없으면 동적 URL 추가 없이 정적 사이트맵만 생성하고 종료
        sitemap.end();
        const sitemapFilePath = path.resolve(distDir, 'sitemap.xml'); 
        const writable = createWriteStream(sitemapFilePath);
        await streamToPromise(sitemap).then(data => writable.write(data.toString()));
        writable.end();
        console.log('Sitemap.xml 파일이 환경 변수 없이 (정적 URL만) 생성되었습니다.');
        return; // 스크립트 종료
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
    } catch (e) {
        console.error('ERROR: FIREBASE_SERVICE_ACCOUNT 환경 변수가 올바른 JSON/Base64 형식이 아닙니다:', e);
        // 오류 발생 시에도 정적 사이트맵만 생성하고 종료
        sitemap.end();
        const sitemapFilePath = path.resolve(distDir, 'sitemap.xml'); 
        const writable = createWriteStream(sitemapFilePath);
        await streamToPromise(sitemap).then(data => writable.write(data.toString()));
        writable.end();
        console.log('Sitemap.xml 파일이 (정적 URL만) 생성되었습니다. (Firebase 초기화 오류)');
        return; // 스크립트 종료
    }

    if (!admin.apps.length) { // 이미 초기화되지 않은 경우에만 초기화
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK가 성공적으로 초기화되었습니다.');
    } else {
        console.log('Firebase Admin SDK가 이미 초기화되어 있습니다.');
    }

    const db = admin.firestore();

    // 1. 정적 페이지 추가 (필수)
    sitemap.write({ url: '/', changefreq: 'daily', priority: 1.0 });
    sitemap.write({ url: '/blog', changefreq: 'daily', priority: 0.9 });
    sitemap.write({ url: '/news', changefreq: 'daily', priority: 0.8 });
    sitemap.write({ url: '/list', changefreq: 'weekly', priority: 0.6 });
    sitemap.write({ url: '/recommendations', changefreq: 'weekly', priority: 0.6 });
    sitemap.write({ url: '/theme/energy', changefreq: 'weekly', priority: 0.5 });
    sitemap.write({ url: '/theme/forex', changefreq: 'weekly', priority: 0.5 });
    sitemap.write({ url: '/theme/bci', changefreq: 'weekly', priority: 0.5 });

    // 2. 동적 블로그 글 추가 (Firestore에서 가져오기)
    let dynamicUrlsAdded = 0;
    try {
        // --- 여기를 수정하세요: Firestore 컬렉션 이름 ---
        // 블로그 글이 저장된 Firestore 컬렉션 이름으로 변경하세요.
        // 예: 'blogPosts' 또는 'posts'
        const blogPostsCollectionRef = db.collection('blogPosts'); // <-- 이 부분!

        console.log(`Firestore 컬렉션 '${blogPostsCollectionRef.path}'에서 블로그 글 가져오는 중...`);
        const snapshot = await blogPostsCollectionRef.get();

        if (snapshot.empty) {
            console.warn('Firestore에서 블로그 글을 찾을 수 없습니다.');
        } else {
            snapshot.forEach(doc => {
                // doc.id는 Firestore 문서의 실제 ID입니다.
                const data = doc.data();
                let lastModDate = null;
                if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
                    lastModDate = data.updatedAt.toDate();
                } else if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                    lastModDate = data.createdAt.toDate();
                }
                sitemap.write({
                    url: `/blog/${doc.id}`,
                    changefreq: 'weekly',
                    priority: 0.8,
                    ...(lastModDate ? { lastmod: lastModDate.toISOString() } : {})
                });
                dynamicUrlsAdded++;
            });
            console.log(`총 ${dynamicUrlsAdded}개의 블로그 글 URL이 사이트맵에 추가되었습니다.`);
        }

    } catch (error) {
        console.error('Firestore에서 블로그 글을 가져오는 중 오류 발생:', error.message);
        console.warn('Firestore 오류로 인해 동적 블로그 글 URL은 사이트맵에 추가되지 않았습니다.');
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
        const sitemapUrl = `${hostname}/sitemap.xml`;
        try {
            await axios.get('https://www.google.com/ping?sitemap=' + encodeURIComponent(sitemapUrl));
            console.log('구글 서치콘솔에 사이트맵 제출 완료');
        } catch (e) {
            console.error('구글 서치콘솔 제출 실패:', e.message);
        }
    } catch (error) {
        console.error('사이트맵 파일 최종 생성 중 오류 발생:', error);
    }
}

generateSitemap();
