# START OF FILE backend/api.py

from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import re
import os
import json # JSON 모듈 추가

from crawler import fetch_naver_news_for_api

app = Flask(__name__)
CORS(app)

# --- 캐시 설정 ---
# 인메모리 캐시 (서버 실행 중 사용)
NEWS_CACHE = {}
# 파일 기반 캐시 (서버 재시작 시 로드)
CACHE_FILE = 'news_cache.json'
CACHE_TTL_SECONDS = 300 # 5분 (크롤링 성공 시 갱신)
FALLBACK_CACHE_TTL_SECONDS = 3600 * 6 # 6시간 (크롤링 실패 시 대체 캐시의 유효 기간)

# --- 헬퍼 함수: 캐시 파일 로드 및 저장 ---
def _load_cache():
    """파일에서 캐시 데이터를 로드하여 NEWS_CACHE에 저장합니다."""
    global NEWS_CACHE
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                loaded_data = json.load(f)
                temp_cache = {}
                for key, (data, timestamp_str) in loaded_data.items():
                    # JSON에 저장된 문자열 타임스탬프를 datetime 객체로 변환
                    temp_cache[key] = (data, datetime.fromisoformat(timestamp_str))
                NEWS_CACHE = temp_cache
                app.logger.info(f"캐시 파일 '{CACHE_FILE}'에서 {len(NEWS_CACHE)}개의 항목 로드 성공.")
        except (json.JSONDecodeError, FileNotFoundError, TypeError) as e:
            app.logger.error(f"캐시 파일 로드 오류: {e}. 캐시를 초기화합니다.")
            NEWS_CACHE = {} # 오류 발생 시 캐시 초기화
    else:
        app.logger.info(f"캐시 파일 '{CACHE_FILE}'을 찾을 수 없습니다. 새로운 캐시를 생성합니다.")
        NEWS_CACHE = {}

def _save_cache():
    """NEWS_CACHE의 데이터를 파일에 저장합니다."""
    # datetime 객체를 ISO 형식 문자열로 변환하여 저장
    data_to_save = {}
    for key, (data, timestamp) in NEWS_CACHE.items():
        data_to_save[key] = (data, timestamp.isoformat())
    
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data_to_save, f, ensure_ascii=False, indent=4)
        app.logger.info(f"캐시 데이터 {len(NEWS_CACHE)}개의 항목을 파일 '{CACHE_FILE}'에 저장 성공.")
    except IOError as e:
        app.logger.error(f"캐시 파일 저장 오류: {e}")


# --- 헬퍼 함수: 날짜 형식 통일 ---
def standardize_date(date_str):
    if not date_str:
        return "날짜 미상"
    if "전" in date_str or "방금" in date_str:
        # 현재 시간을 기준으로 "n시간 전" 등을 실제 날짜로 변환
        now = datetime.now()
        if "시간 전" in date_str:
            hours_ago = int(re.search(r'(\d+)시간 전', date_str).group(1))
            return (now - timedelta(hours=hours_ago)).strftime("%Y-%m-%d")
        elif "분 전" in date_str:
            minutes_ago = int(re.search(r'(\d+)분 전', date_str).group(1))
            return (now - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%d")
        elif "방금" in date_str:
            return now.strftime("%Y-%m-%d")
        return now.strftime("%Y-%m-%d") # 기타 "전" 표현도 오늘 날짜로
        
    match = re.match(r'(\d{4})\.(\d{2})\.(\d{2})\.?', date_str)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return date_str

# --- 뉴스 검색 API 엔드포인트 ---
@app.route('/api/news', methods=['GET'])
def get_latest_news_api():
    keyword = request.args.get('keyword', '주식 경제')
    num_items = int(request.args.get('count', 5))

    if num_items <= 0 or num_items > 20:
        return jsonify({"error": "count는 1에서 20 사이의 정수여야 합니다."}), 400

    cache_key = f"{keyword}_{num_items}"
    now = datetime.now()

    # 1. 인메모리 캐시 확인 (서버 시작 시 파일에서 로드된 내용 포함)
    # 유효한 캐시가 있다면 즉시 반환
    if cache_key in NEWS_CACHE:
        cached_data, timestamp = NEWS_CACHE[cache_key]
        if now < timestamp + timedelta(seconds=CACHE_TTL_SECONDS):
            app.logger.info(f"뉴스 API: 유효한 인메모리 캐시 반환 (key: {cache_key})")
            return jsonify(cached_data)

    # 2. 캐시가 없거나 만료된 경우, 크롤링 시도
    app.logger.info(f"뉴스 API: 캐시 만료 또는 없음. 크롤링 시도 (key: {cache_key})")
    scraped_news_items = None
    try:
        scraped_news_items = fetch_naver_news_for_api(keyword, num_items)
    except Exception as e:
        app.logger.error(f"뉴스 API: 크롤링 중 예외 발생: {e}", exc_info=True)
        # 예외 발생 시 scraped_news_items를 None으로 유지하여 크롤링 실패로 처리

    if scraped_news_items is not None: # 크롤링 성공 (빈 리스트일 수도 있음)
        app.logger.info(f"뉴스 API: 크롤링 성공 (key: {cache_key})")
        processed_news = []
        for item in scraped_news_items:
            item['post_date'] = standardize_date(item.get('post_date'))
            item.pop('ai_summary', None)
            item.pop('ai_keywords', None)
            processed_news.append(item)

        # 3. 크롤링 결과 캐시에 저장 (성공한 경우에만) 및 파일에 저장
        NEWS_CACHE[cache_key] = (processed_news, now)
        _save_cache() # 파일에 캐시 저장
        app.logger.info(f"뉴스 API: 캐시 업데이트 및 저장 (key: {cache_key})")
        return jsonify(processed_news)
    else: # 크롤링 실패
        app.logger.warning(f"뉴스 API: 크롤링 실패 (key: {cache_key}). 대체 캐시 확인.")
        # 4. 크롤링 실패 시, (만료되었더라도) 파일에서 로드된 기존 캐시가 있다면 반환
        if cache_key in NEWS_CACHE:
            cached_data, timestamp = NEWS_CACHE[cache_key]
            # 폴백 캐시의 TTL도 고려하여 너무 오래된 것은 반환하지 않음 (선택 사항)
            if now < timestamp + timedelta(seconds=FALLBACK_CACHE_TTL_SECONDS):
                app.logger.info(f"뉴스 API: 크롤링 실패, 만료되었지만 유효한 대체 캐시 반환 (key: {cache_key})")
                return jsonify(cached_data)
            else:
                app.logger.warning(f"뉴스 API: 크롤링 실패 및 대체 캐시마저 너무 오래됨 (key: {cache_key}).")
                return jsonify({"error": "뉴스 데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요. (대체 캐시 만료)"}), 500
        else:
            app.logger.error(f"뉴스 API: 크롤링 실패 및 대체 캐시 없음 (key: {cache_key})")
            return jsonify({"error": "뉴스 데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요."}), 500


@app.route('/api/admin/login', methods=['POST', 'OPTIONS'])
def admin_login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "요청 데이터가 없습니다."}), 400

        password_from_user = data.get('password')
        admin_password = os.environ.get('ADMIN_PASSWORD')

        if not admin_password:
            app.logger.error("ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다.")
            return jsonify({"success": False, "message": "서버 설정 오류."}), 500

        if password_from_user == admin_password:
            app.logger.info("관리자 로그인 성공")
            return jsonify({"success": True, "message": "로그인 성공"})
        else:
            app.logger.warning("관리자 로그인 실패: 비밀번호 불일치")
            return jsonify({"success": False, "message": "비밀번호가 올바르지 않습니다."}), 401

    except Exception as e:
        app.logger.error(f"관리자 로그인 중 오류 발생: {e}", exc_info=True)
        return jsonify({"success": False, "message": f"서버 오류 발생: {str(e)}"}), 500
@app.route('/api/blog/posts-list', methods=['GET']) # 엔드포인트 이름을 명확하게 `/api/blog/posts-list`로 제안
def get_blog_posts_list():
    try:
        # 여기에 블로그 글의 ID(또는 고유 식별자) 목록을 데이터베이스나 파일에서 가져오는 로직 구현
        # 예시:
        # 실제 데이터베이스에서 블로그 글 ID를 가져오는 함수를 호출한다고 가정
        # from your_database_module import fetch_all_blog_post_ids
        # post_ids = fetch_all_blog_post_ids()

        # 임시 데이터 (실제 데이터베이스 연결 후 제거)
        # 만약 글 ID가 Q4LTFFbHwK8JdutA5UMF, VN5VGi5ZOOXghi9aEwPg 처럼 임의의 문자열이라면,
        # 해당 ID들을 반환하는 로직이 필요합니다.
        # 이 예시에서는 ID가 '_id' 필드에 있다고 가정합니다.
        
        # 임시 블로그 데이터 (실제 데이터베이스에서 가져와야 함)
        # 실제 데이터베이스에서 가져온 블로그 글 목록이라고 가정
        # [{ "_id": "Q4LTFFbHwK8JdutA5UMF", "title": "첫 번째 블로그 글", ... },
        #  { "_id": "VN5VGi5ZOOXghi9aEwPg", "title": "두 번째 블로그 글", ... }]
        
        # **가장 중요한 부분:** 백엔드에서 실제로 블로그 글 목록을 어떻게 가져오는지에 따라 이 부분을 구현해야 합니다.
        # 예시: 가상의 함수 `get_all_blog_posts_from_db()`가 모든 블로그 글의 리스트를 반환한다고 가정
        # from models import BlogPost # 예를 들어 BlogPost 모델 정의
        # all_posts = BlogPost.query.all() # SQLAlchemy 같은 ORM 사용 시
        # posts_data = [{"_id": str(post.id), "lastmod": post.updated_at.isoformat()} for post in all_posts] # ID와 업데이트 시간 가져오기
        
        # 현재 코드만으로는 블로그 데이터의 출처를 알 수 없으므로,
        # **임시로 몇 개의 더미 ID를 반환하는 예시를 작성합니다.**
        # **반드시 실제 블로그 데이터 출처에 맞춰 구현해야 합니다.**
        dummy_posts = [
            {"_id": "Q4LTFFbHwK8JdutA5UMF"},
            {"_id": "VN5VGi5ZOOXghi9aEwPg"},
            {"_id": "CB7tboP6wdfkulB6z9U9"},
            {"_id": "Omc7R67gEgcm658PHllD"},
        ]
        
        return jsonify(dummy_posts), 200 # ID 목록을 JSON 배열로 반환

    except Exception as e:
        app.logger.error(f"블로그 글 목록 조회 중 오류 발생: {e}", exc_info=True)
        return jsonify({"error": "블로그 글 목록을 불러오는 데 실패했습니다."}), 500

# --- 앱 실행 ---
if __name__ == '__main__':
    # 앱 시작 시 캐시 파일 로드
    _load_cache()
    app.run(host='0.0.0.0', port=5000)

# END OF FILE backend/api.py
