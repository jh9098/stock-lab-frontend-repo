# START OF FILE backend/blog_parser.py (상대 경로 임포트 해결)

import re
import time
import urllib.parse
import requests
from bs4 import BeautifulSoup
# 💡 수정: constants.py에서 DEFAULT_HEADERS 임포트 (상대 경로 제거)
from constants import DEFAULT_HEADERS 

# 공통 마커: 뉴스/블로그에서 본문 끝 판단용
NEWS_END_MARKERS = [
    "무단전재", "무단 전재", "재배포 금지", "ⓒ", "저작권자", "Copyright", "All rights reserved",
    "광고문의", "광고 문의", "AD링크", "타불라", "관련기사", "기자 E-mail", "기자 이메일",
    "기자소개", "기자 소개", "기자의 다른기사", "편집패널", "본문하단", "nBYLINE",
    "좋아요 버튼", "속보는", "t.me/", "텔레그램", "영상취재", "영상편집", "사진부", "사진기자", "그래픽=", "사진=",
    "기사제보", "보도자료", "팟캐스트", "많이 본 기사", "공유하기", "공유버튼", "nCopyright",
    "기사 전체보기", "입력 :", "지면 :", "AI학습 이용 금지", "AI 학습용 데이터", "AI 데이터 활용",
    "기사 공유", "댓글", "좋아요", "광고", "ADVERTISEMENT", "배너", "후원하기", "더팩트 주요뉴스",
    "관련 뉴스", "추천 뉴스", "실시간 주요뉴스", "주요뉴스",
    "뉴스제공", "기사제공", "기사 하단 광고",
    "기사 영역 하단 광고", "기자 정보", "전체기사 보기",
    "장기영 기자", "◎", "공감언론", "구독신청", "지면PDF", "네이버 홈에서", "카카오톡에서", "만나보세요",
    "핫뉴스", "▶", "●", "■", "▲", "▼", "◆", "◇", "☞", "※",
    "이 기사는", "본 기사는", "자료출처=", "자료 제공="
]

def is_news_reporter_line(text: str) -> bool:
    """
    주어진 텍스트가 뉴스 기자의 서명/정보 라인인지 판단합니다.
    """
    return bool(re.search(r"[가-힣]{2,5}\s*(기자|특파원|위원|논설위원|연구원|객원기자|통신원|데일리|인턴기자|편집장|대표|교수|변호사|의사|약사|박사)", text))

def _clean_and_filter_text_from_elements(elements, url_for_debug: str, is_news: bool = False) -> str:
    """
    BeautifulSoup에서 추출한 텍스트 요소들을 공통 규칙에 따라 클리닝하고 필터링합니다.
    공통된 텍스트 처리 로직을 위한 헬퍼 함수.
    """
    cleaned_lines = []
    for el in elements:
        # 태그 내의 텍스트를 개행 문자로 구분하여 가져오고 양쪽 공백 제거
        raw_text = el.get_text(separator="\n", strip=True)
        
        if not raw_text or len(raw_text) < 5: # 최소 길이 필터
            continue
        
        # 기사 종료 마커 처리: 마커가 발견되면 그 이전 내용만 유효한 본문으로 간주
        for marker in NEWS_END_MARKERS:
            if marker.lower() in raw_text.lower():
                pos = raw_text.lower().find(marker.lower())
                # 마커가 시작 부분에 너무 가깝지 않으면 (즉, 본문 일부일 경우) 그 이전 내용만 사용
                raw_text = raw_text[:pos].strip() if pos > 10 else ""
                break
        
        if raw_text: # 마커 처리 후 내용이 남아있다면
            # 뉴스 기자의 서명 라인 필터링 (뉴스일 경우에만 적용)
            if is_news and is_news_reporter_line(raw_text) and len(raw_text) < 60:
                continue
            # 블로그 특유의 불필요한 라인 필터링 (뉴스가 아닐 경우, 즉 블로그일 경우 적용)
            if not is_news and (raw_text.startswith(("댓글", "공감", "트랙백")) or re.match(r"^\d+개의 댓글$", raw_text)):
                 continue
            
            cleaned_lines.append(raw_text)
            
    # 필터링된 라인들을 개행 문자로 조인하고 최종적으로 양쪽 공백 제거
    return "\n".join(cleaned_lines).strip()


def get_content_from_html(soup: BeautifulSoup, post_url_for_debug: str = "") -> str | None:
    """
    주어진 BeautifulSoup 객체에서 블로그 본문 내용을 추출합니다.
    최신 네이버 블로그 구조와 구형 구조 모두에 대응합니다.
    """
    # 최신 Naver 블로그 구조 우선 처리 (se-viewer div.se-main-container)
    se_main_container = soup.select_one('div.se-viewer div.se-main-container')
    if se_main_container:
        # p.se-text-paragraph span 내부 텍스트 추출
        content_parts = _clean_and_filter_text_from_elements(
            se_main_container.select('p.se-text-paragraph span'),
            post_url_for_debug, is_news=False # 블로그이므로 is_news=False
        )
        if content_parts: # 내용이 성공적으로 추출되면 반환
            return content_parts

        # 만약 p.se-text-paragraph span에서 추출되지 않았다면, 다른 텍스트 요소 시도
        other_text_elements_selectors = [
            'div.se-module-text', 'span[class*="se-fs-"]', 'span[class*="se-ff-"]',
            'div[class*="se-component-content"] div[class*="se-text"]', 'p[class*="se-text"]'
        ]
        other_content_parts = _clean_and_filter_text_from_elements(
            se_main_container.select(','.join(other_text_elements_selectors)),
            post_url_for_debug, is_news=False
        )
        if other_content_parts:
            return other_content_parts


    # 구형 블로그 구조 대응 (레거시 셀렉터들)
    legacy_content_selectors = [
        'div#postViewArea', 'div.post-view', 'div.se_component_wrap',
        'div.blog_content', 'article.contents_style', 'div.tt_article_useless_p_margin',
        'div.entry-content', 'div.td-post-content', 'div.article_view',
        'div.view', 'div.post_ct', 'td.bcc',
    ]
    for selector in legacy_content_selectors:
        container = soup.select_one(selector)
        if container:
            # 불필요한 태그 제거 (스크립트, 스타일, 광고, 내비게이션 등)
            for s_tag in container.select('script, style, iframe, form, button, nav, header, footer, aside, .adsbygoogle, .revenue_unit_wrap, ins.kakao_ad_area, div[data-ke-type="revenue"]'):
                s_tag.decompose()
            
            # 컨테이너 내의 모든 텍스트 노드를 대상으로 클리닝 및 필터링
            meaningful_content = _clean_and_filter_text_from_elements(
                container.find_all(string=True, recursive=True), # 모든 텍스트 노드를 대상으로
                post_url_for_debug, is_news=False
            )
            if meaningful_content and len(meaningful_content) > 50: # 최소 길이 확인
                return meaningful_content
            elif container.get_text(strip=True) and len(container.get_text(strip=True)) > 50:
                # 만약 _clean_and_filter_text_from_elements가 제대로 작동하지 않았지만,
                # 원시 텍스트가 충분히 긴 경우 fallback으로 사용
                return container.get_text(strip=True)

    return None # 어떤 내용도 찾지 못한 경우 None 반환


def get_blog_post_content(post_url: str) -> str:
    """
    블로그 게시물 URL에서 본문 내용을 가져옵니다.
    네이버 블로그의 경우 iframe 내부의 콘텐츠를 추가로 처리합니다.
    """
    headers = DEFAULT_HEADERS.copy()

    try:
        response = requests.get(post_url, headers=headers, timeout=15)
        response.raise_for_status() # HTTP 오류가 발생하면 예외 발생
        response.encoding = response.apparent_encoding # 인코딩 자동 감지
        main_soup = BeautifulSoup(response.text, 'html.parser')

        iframe_tag = main_soup.select_one('iframe#mainFrame, iframe[name="mainFrame"]')
        content_soup = main_soup # 기본적으로는 메인 페이지의 soup 사용
        actual_content_url = post_url

        # iframe이 존재하는 경우, iframe 내부의 src를 파싱하여 실제 콘텐츠를 가져옴
        if iframe_tag and iframe_tag.get('src'):
            iframe_src = iframe_tag['src']
            if iframe_src.startswith('/'): # 상대 경로 처리
                parsed_url = urllib.parse.urlparse(post_url)
                iframe_src = f"{parsed_url.scheme}://{parsed_url.netloc}{iframe_src}"
            
            time.sleep(0.5) # iframe 요청 전 딜레이 (과도한 요청 방지)
            iframe_headers = headers.copy()
            iframe_headers['Referer'] = post_url # Referer 헤더 추가 (일부 사이트에서 필요)
            iframe_response = requests.get(iframe_src, headers=iframe_headers, timeout=15)
            iframe_response.raise_for_status()
            iframe_response.encoding = iframe_response.apparent_encoding
            content_soup = BeautifulSoup(iframe_response.text, 'html.parser')
            actual_content_url = iframe_src

        content = get_content_from_html(content_soup, actual_content_url)
        if content is None or len(content.strip()) < 30: # 본문 최소 길이 검사
            return f"블로그 본문 내용 부족 또는 컨테이너 없음: {actual_content_url}"
        return content

    except requests.exceptions.Timeout:
        return f"요청 시간 초과 (블로그): {post_url}"
    except requests.exceptions.SSLError as e:
        return f"SSL 오류 (블로그: {post_url}): {e}"
    except requests.exceptions.RequestException as e:
        return f"요청 오류 (블로그: {post_url}): {e}"
    except Exception as e:
        return f"파싱 오류 (블로그: {post_url}): {e}"

# END OF FILE blog_parser.py
