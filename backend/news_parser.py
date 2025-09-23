# START OF FILE backend/news_parser.py (상대 경로 임포트 해결)

import re
import urllib.parse
import requests
from bs4 import BeautifulSoup
# 💡 수정: blog_parser 임포트도 절대 경로 임포트로
from blog_parser import is_news_reporter_line, NEWS_END_MARKERS, _clean_and_filter_text_from_elements
# 💡 수정: constants.py에서 DEFAULT_HEADERS 임포트 (상대 경로 제거)
from constants import DEFAULT_HEADERS 

def extract_general_news_text(url: str, summary_from_list: str = None) -> str:
    """
    일반 뉴스 기사 URL에서 본문 텍스트를 추출합니다.
    다양한 언론사 구조와 네이버 뉴스 특유의 구조에 대응합니다.
    이 함수는 GUI 앱의 본문 수집에 사용될 수 있습니다.
    """
    try:
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=10)
        response.raise_for_status()

        html_content = response.text 

        soup = BeautifulSoup(html_content, "html.parser")
        domain = urllib.parse.urlparse(url).netloc
        article_text_element = None
        extracted_text = ""

        # Naver 뉴스 전용 선택자
        if "naver.com" in domain:
            naver_selectors = [
                "article#dic_area", "div#articleBodyContents", "div.go_trans._article_content",
                "div.newsct_article._article_body", "div#newsct_article", "div#articeBody"
            ]
            for sel in naver_selectors:
                article_text_element = soup.select_one(sel)
                if article_text_element:
                    break

            if article_text_element:
                # 불필요한 태그 제거
                for tag in article_text_element.select("script, style, .media_end_head_autosummary, .promotion_area"):
                    tag.decompose()
                
                # 텍스트 추출 및 클리닝 (헬퍼 함수 사용)
                extracted_text = _clean_and_filter_text_from_elements(
                    article_text_element.find_all(string=True, recursive=True), url, is_news=True
                )

        else:
            # 일반 언론사별 CSS 셀렉터 매핑
            selector_map = {
                "health.chosun.com": "div.par, div.article_body",
                "joongang.co.kr": "div.article_body",
                "hani.co.kr": "div.article-text",
                "kbs.co.kr": "div.view_con_text",
                "sbs.co.kr": "div.text_area",
                "ytn.co.kr": "div.content_area",
                "edaily.co.kr": "div.newsContents",
                "moneytoday.co.kr": "div.view_text",
                "kormedi.com": "div.news_view_content",
                "news1.kr": "div.detail",
                "segye.com": "div#article_txt",
                "yna.co.kr": "div.article",
            }

            matched = False
            for key, sel_str in selector_map.items():
                if key in domain:
                    selectors = [s.strip() for s in sel_str.split(',')]
                    for sel in selectors:
                        article_text_element = soup.select_one(sel)
                        if article_text_element:
                            matched = True
                            break
                if matched:
                    break

            if article_text_element:
                # 불필요한 태그 제거
                for tag in article_text_element.select("script, style, form, iframe, .ad, .adsbygoogle"):
                    tag.decompose()
                
                # 텍스트 추출 및 클리닝 (헬퍼 함수 사용)
                extracted_text = _clean_and_filter_text_from_elements(
                    article_text_element.find_all(['p', 'div']), url, is_news=True
                )

        # 대안 로직: <p> 태그만으로 본문 추출 시도
        if not extracted_text or len(extracted_text) < 50: # 내용이 부족한 경우에만 대안 로직 실행
            p_tags = soup.find_all("p")
            content_from_p = _clean_and_filter_text_from_elements(p_tags, url, is_news=True)
            if content_from_p and len(content_from_p) > 100: # 대안으로 추출한 본문이 충분히 긴 경우
                extracted_text = content_from_p

        return extracted_text if extracted_text and len(extracted_text) > 50 else f"뉴스 본문 추출 실패 (내용 부족 또는 모든 방법 실패): {url}"

    except requests.exceptions.Timeout:
        return f"요청 시간 초과 (뉴스): {url}"
    except requests.exceptions.SSLError as e:
        return f"SSL 오류 (뉴스: {url}): {e}"
    except requests.exceptions.RequestException as e:
        return f"요청 오류 (뉴스: {url}): {e}"
    except Exception as e:
        return f"파싱 중 알 수 없는 오류 (뉴스: {url}): {e}"


def get_health_chosun_article_content(article_url: str) -> str:
    """
    'health.chosun.com' 웹사이트의 기사 본문 내용을 추출합니다.
    이 함수는 GUI 앱의 본문 수집에 사용될 수 있습니다.
    """
    try:
        response = requests.get(article_url, headers=DEFAULT_HEADERS, timeout=10)
        response.raise_for_status()

        try:
            html = response.content.decode("euc-kr")
        except UnicodeDecodeError:
            response.encoding = response.apparent_encoding or 'utf-8'
            html = response.text

        soup = BeautifulSoup(html, "html.parser")
        container = soup.select_one("div.par, div.article_body")

        if not container:
            return f"헬스조선 본문 컨테이너(div.par 또는 div.article_body) 없음: {article_url}"

        # 불필요한 태그 제거
        for tag in container.select("script, style, form, iframe, .ad, .social_widget"):
            tag.decompose()

        extracted_content = _clean_and_filter_text_from_elements(
            container.find_all(['p', 'div']), article_url, is_news=True
        )

        return extracted_content if extracted_content else f"헬스조선 본문 추출 실패 (내용 없음): {article_url}"

    except requests.exceptions.Timeout:
        return f"요청 시간 초과 (헬스조선): {article_url}"
    except requests.exceptions.SSLError as e:
        return f"SSL 오류 (헬스조선: {article_url}): {e}"
    except requests.exceptions.RequestException as e:
        return f"요청 오류 (헬스조선: {article_url}): {e}"
    except Exception as e:
        return f"파싱 오류 (헬스조선: {article_url}): {e}"

# END OF FILE news_parser.py
