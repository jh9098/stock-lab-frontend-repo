# START OF FILE backend/constants.py

# User-Agent 및 기본 헤더는 여러 크롤링 함수에서 공유됩니다.
# 최신 브라우저의 User-Agent를 주기적으로 업데이트하는 것이 좋습니다.
DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
DEFAULT_HEADERS = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
}

# END OF FILE backend/constants.py
