const { existsSync, mkdirSync, createWriteStream } = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function escapeXml(str) {
  return str
    ? str.replace(/[<>&'"]/g, ch => {
        switch (ch) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return ch;
        }
      })
    : '';
}

async function generateRSS() {
  const hostname = 'https://stocksrlab.netlify.app';
  const distDir = path.resolve(__dirname, 'dist');

  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
    console.log(`DEBUG: 'dist' 폴더가 없어 생성했습니다: ${distDir}`);
  }

  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  let db = null;

  if (serviceAccountBase64) {
    try {
      const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
      db = admin.firestore();
      console.log('Firebase Admin SDK가 성공적으로 초기화되었습니다.');
    } catch (e) {
      console.error('ERROR: FIREBASE_SERVICE_ACCOUNT 환경 변수가 올바른 JSON/Base64 형식이 아닙니다:', e);
    }
  } else {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT 환경 변수가 설정되지 않았습니다. Firestore 연동 실패.');
  }

  let rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>지지저항 Lab 블로그</title>\n    <link>${hostname}</link>\n    <description>지지저항 Lab의 최신 블로그 글</description>\n`;

  let itemCount = 0;

  if (db) {
    try {
      const snapshot = await db.collection('blogPosts').orderBy('createdAt', 'desc').get();
      snapshot.forEach(doc => {
        const data = doc.data();
        let pubDate = new Date();
        if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
          pubDate = data.updatedAt.toDate();
        } else if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          pubDate = data.createdAt.toDate();
        }
        rss += `    <item>\n` +
               `      <title>${escapeXml(data.title || '')}</title>\n` +
               `      <link>${hostname}/blog/${doc.id}</link>\n` +
               `      <description><![CDATA[${data.contentHtml || ''}]]></description>\n` +
               `      <pubDate>${pubDate.toUTCString()}</pubDate>\n` +
               `      <guid>${hostname}/blog/${doc.id}</guid>\n` +
               `    </item>\n`;
        itemCount++;
      });
      console.log(`총 ${itemCount}개의 블로그 글이 RSS 피드에 추가되었습니다.`);
    } catch (error) {
      console.error('Firestore에서 블로그 글을 가져오는 중 오류 발생:', error.message);
    }
  }

  rss += '  </channel>\n</rss>\n';

  const rssPath = path.resolve(distDir, 'rss.xml');
  const writable = createWriteStream(rssPath);
  writable.write(rss);
  writable.end();
  console.log('rss.xml 파일이 성공적으로 생성되었습니다.');
}

generateRSS();
