import time
import re
import urllib.parse
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import random
import os

from constants import DEFAULT_HEADERS
# from blog_parser import get_blog_post_content, _clean_and_filter_text_from_elements # GUI용이므로 주석 처리
# from news_parser import extract_general_news_text, get_health_chosun_article_content # GUI용이므로 주석 처리

# 💡 추가: requests.Session 객체 생성 (모든 요청에 재사용)
session = requests.Session()
session.headers.update(DEFAULT_HEADERS) # 기본 헤더를 세션에 적용

# 뉴스 아이템 파싱 로직을 헬퍼 함수로 분리
def _parse_single_naver_news_item(item_soup, search_url):
    """
    하나의 네이버 뉴스 검색 결과 아이템에서 제목, 링크, 출처, 날짜, 요약을 파싱합니다.
    새로운 SDS UI 구조를 우선 시도하고, 기존 레거시 UI를 폴백으로 사용합니다.
    """
    post_data = {
        'platform': 'news',
        'title': "제목 없음",
        'link': "링크 없음",
        'source_name': "출처 없음",
        'post_date': "날짜 없음",
        'content': "요약 없음" # API용으로는 요약 텍스트만 필요
    }

    # --- 새로운 SDS (Search Design System) UI 구조 우선 시도 ---
    # 뉴스 아이템의 핵심 정보를 담고 있는 컨테이너를 먼저 찾습니다.
    # 제공된 HTML에서 이 컨테이너는 보통 `sds-comps-vertical-layout sds-comps-full-layout` 클래스를 가집니다.
    # 그리고 그 안에 제목, 요약, 언론사 정보가 포함됩니다.

    # 제목: <span class="sds-comps-text-type-headline1">
    title_el_sds = item_soup.select_one('span.sds-comps-text-type-headline1')
    # 요약: <span class="sds-comps-text-type-body1">
    summary_el_sds = item_soup.select_one('span.sds-comps-text-type-body1')

    # 언론사: <div class="sds-comps-profile-info-title"> 안의 <span> 또는 <a> 안의 <span>
    press_el_sds = item_soup.select_one('div.sds-comps-profile-info-title span.sds-comps-text-type-body2')

    # 날짜: <div class="sds-comps-profile-info"> 안의 <span class="sds-comps-profile-info-subtext"> 안의 <span>
    date_info_subtexts_sds = item_soup.select('div.sds-comps-profile-info span.sds-comps-profile-info-subtext')

    # 원본 기사 링크 (제목을 감싸는 <a> 태그 또는 '네이버뉴스' 링크)
    # 제목 태그를 감싸는 <a> 태그에서 직접 링크를 가져오는 것이 가장 확실합니다.
    title_link_parent_sds = None
    if title_el_sds:
        title_link_parent_sds = title_el_sds.find_parent('a')

    # '네이버뉴스' 링크 (link[href*="n.news.naver.com"]가 더 정확)
    naver_news_link_el_sds = item_soup.select_one('a[href*="n.news.naver.com"]')

    if title_el_sds:
        post_data['title'] = title_el_sds.get_text(strip=True)

        # 링크 우선순위: 네이버뉴스 링크 > 제목 태그의 부모 링크
        if naver_news_link_el_sds and naver_news_link_el_sds.get('href'):
            post_data['link'] = naver_news_link_el_sds['href']
        elif title_link_parent_sds and title_link_parent_sds.get('href'):
            post_data['link'] = title_link_parent_sds['href']

        if press_el_sds: post_data['source_name'] = press_el_sds.get_text(strip=True)

        date_text_sds = None
        if date_info_subtexts_sds:
            for subtext_span_sds in date_info_subtexts_sds:
                actual_text_span_sds = subtext_span_sds.select_one('span.sds-comps-text-type-body2')
                if actual_text_span_sds:
                    date_text_candidate_sds = actual_text_span_sds.get_text(strip=True)
                    # '네이버뉴스'나 숫자만 있는 'n면'은 날짜가 아님
                    if re.search(r'(\d{1,2}(시간|분) 전|\d{4}\.\d{2}\.\d{2}\.?)$', date_text_candidate_sds) and "네이버뉴스" not in date_text_candidate_sds and not re.search(r'\d+면', date_text_candidate_sds):
                        date_text_sds = date_text_candidate_sds
                        break
        if date_text_sds: post_data['post_date'] = date_text_sds

        if summary_el_sds: post_data['content'] = summary_el_sds.get_text(strip=True) # 요약 저장 (API용)
        # content 필드는 fetch_content 값에 따라 다르게 설정되므로 여기서는 summary만 채워넣음

    else: # 기존 또는 다른 구조의 아이템 (레거시 UI 호환성 유지)
        # 이 부분은 현재 제공된 HTML에는 해당하지 않지만, 만약을 위해 유지합니다.
        title_el_legacy = item_soup.select_one('a.news_tit, a.sa_text_title, div.news_area > div.tit, div.news_wrap > div.news_tit')
        if not title_el_legacy:
            title_el_legacy = item_soup.select_one('a[class*="news_tit"]')

        if title_el_legacy: post_data['title'] = title_el_legacy.get_text(strip=True)

        naver_news_link_el_legacy = item_soup.select_one('div.info_group a.info[href*="n.news.naver.com"], a.info._sp_each_url[href*="n.news.naver.com"], a.news_tit[href*="n.news.naver.com"]')
        if not naver_news_link_el_legacy:
            link_candidates_legacy = item_soup.select('a[href*="n.news.naver.com"]')
            if link_candidates_legacy:
                for lc_legacy in link_candidates_legacy:
                    if lc_legacy.get_text(strip=True) == "네이버뉴스":
                        naver_news_link_el_legacy = lc_legacy
                        break
                if not naver_news_link_el_legacy:
                     if len(link_candidates_legacy) > 0: # 여러 n.news.naver.com 링크 중 첫번째
                         naver_news_link_el_legacy = link_candidates_legacy[0]

        if naver_news_link_el_legacy and naver_news_link_el_legacy.get('href'):
            post_data['link'] = naver_news_link_el_legacy['href']
        elif title_el_legacy and title_el_legacy.get('href') and post_data['link'] == "링크 없음":
            post_data['link'] = title_el_legacy['href']

        press_el_legacy = item_soup.select_one('a.info.press, span.press, a.sa_text_press, div.press_logo img[alt]')
        if press_el_legacy:
            if press_el_legacy.name == 'img' and press_el_legacy.has_attr('alt'):
                post_data['source_name'] = press_el_legacy['alt'].strip()
            else:
                post_data['source_name'] = press_el_legacy.get_text(strip=True)

        date_el_candidates_legacy = item_soup.select('span.info, span.num, span.time, div.info_group > span:not([class])')
        for date_cand_el_legacy in date_el_candidates_legacy:
            date_text_legacy = date_cand_el_legacy.get_text(strip=True)
            if re.search(r'(\d{1,2}(시간|분) 전|\d{4}\.\d{2}\.\d{2}\.?)$', date_text_legacy) and "네이버뉴스" not in date_text_legacy and not re.search(r'\d+면', date_text_legacy):
                post_data['post_date'] = date_text_legacy
                break

        summary_el_legacy = item_soup.select_one('div.news_dsc div.dsc_wrap a, a.api_txt_lines.dsc_txt, div.dsc_txt, a.sa_text_lede, div.news_wrap div.news_dsc a')
        if summary_el_legacy: post_data['content'] = summary_el_legacy.get_text(strip=True) # 요약 저장 (API용)

    # 공통 링크 후처리: 상대 경로 링크를 절대 경로로 변환
    if post_data['link'] != "링크 없음" and not post_data['link'].startswith('http'):
        if post_data['link'].startswith("/"): # 상대 경로인 경우
            post_data['link'] = urllib.parse.urljoin("https://search.naver.com/", post_data['link'])

    return post_data

# --- GUI 앱을 위한 크롤링 함수 (현재 API와는 무관하지만 기존 기능 유지를 위해 그대로 둠) ---
# scrape_content_for_gui 함수는 변경하지 않습니다.
def scrape_content_for_gui(keyword, num_posts, fetch_content, status_callback, item_processed_callback, search_type="blog"):
    """
    기존 Tkinter GUI 앱을 위한 크롤링 함수.
    이 함수는 웹 API에 직접적으로 사용되지 않으므로, GUI 앱의 요구사항에 따라 동작합니다.
    """
    sort_order_text = "최신순"
    if search_type == "blog": sort_order_text = "관련도순"
    elif search_type == "news": sort_order_text = "최신순"
    elif search_type == "health_chosun_food": sort_order_text = "목록순"

    status_callback(f"'{keyword if search_type != 'health_chosun_food' else '헬스조선 푸드'}' {search_type.replace('_', ' ').title()} {sort_order_text} 검색 시작 (최대 {num_posts}개)...")

    headers = DEFAULT_HEADERS.copy()

    search_soup = None
    search_url = ""

    if search_type == "health_chosun_food":
        search_url = "https://health.chosun.com/list.html?menu=01010102&more_menu=0101010220&nowcode=0101010220"
    elif search_type == "blog":
        encoded_keyword = urllib.parse.quote_plus(keyword)
        search_url = f"https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query={encoded_keyword}&nso=so:r,p:all"
    elif search_type == "news":
        encoded_keyword = urllib.parse.quote_plus(keyword)
        # GUI에서는 최신순으로 고정
        search_url = f"https://search.naver.com/search.naver?where=news&query={encoded_keyword}&sm=tab_opt&sort=1"
    else:
        status_callback("지원하지 않는 검색 타입입니다.")
        item_processed_callback(None, is_done=True, error_occurred=True); return

    try:
        # GUI 용에서는 verify=False를 유지 (로컬 환경 등의 SSL 문제 가능성)
        search_response = requests.get(search_url, headers=headers, verify=False, timeout=10)
        search_response.raise_for_status()

        if search_type == "health_chosun_food":
            if 'euc-kr' in search_response.headers.get('content-type', '').lower() or \
               (search_response.encoding and search_response.encoding.lower() == 'iso-8859-1'):
                try: search_html_content = search_response.content.decode('euc-kr')
                except UnicodeDecodeError: search_html_content = search_response.text
            else:
                search_response.encoding = search_response.apparent_encoding if search_response.apparent_encoding else 'utf-8'
                search_html_content = search_response.text
        else:
            search_response.encoding = 'utf-8'
            search_html_content = search_response.text
        search_soup = BeautifulSoup(search_html_content, 'html.parser')

    except requests.exceptions.RequestException as e:
        status_callback(f"'{search_type}' 목록 페이지 요청 오류: {e}")
        item_processed_callback(None, is_done=True, error_occurred=True); return
    except Exception as e_parse:
        status_callback(f"'{search_type}' 목록 페이지 파싱 오류: {e_parse}")
        item_processed_callback(None, is_done=True, error_occurred=True); return

    items_found_soups = []
    if search_type == "blog":
        candidate_items = search_soup.select('div.view_wrap')
        if not candidate_items:
            candidate_items = search_soup.select('ul.lst_view > li.bx, div.lst_view > div.bx, ul.lst_total > li.bx, div.bx._svp_item')

        for item_candidate_soup in candidate_items:
            title_link_tag = item_candidate_soup.select_one('div.title_area a.title_link, div.title_area a.name_link')
            if not title_link_tag :
                 title_link_tag = item_candidate_soup.select_one('a.api_txt_lines.total_tit, a.link_tit')

            if title_link_tag and title_link_tag.get('href'):
                href_val = title_link_tag['href']
                if "blog.naver.com" in href_val:
                    items_found_soups.append(item_candidate_soup)
                    if len(items_found_soups) >= num_posts: break

    elif search_type == "news":
        # 💡 GUI용 뉴스 크롤러도 새로운 구조에 맞춰 수정
        # 메인 뉴스 리스트 컨테이너
        fender_root_div = search_soup.select_one('div[data-fender-root="true"]')
        if fender_root_div:
            # 개별 뉴스 아이템 컨테이너 (클래스 명 변경에 유의)
            # `lc9J36iJ61J2vQuSLfFc`는 매번 바뀔 수 있지만, `desktop_mode api_subject_bx`와 함께 있는 가장 바깥의 컨테이너 안에서 찾습니다.
            main_news_list_area = fender_root_div.select_one('div.lc9J36iJ61J2vQuSLfFc.desktop_mode.api_subject_bx')
            if main_news_list_area:
                # 개별 뉴스 아이템은 `sds-comps-vertical-layout sds-comps-full-layout` 클래스를 가진 div입니다.
                items_found_soups = main_news_list_area.select('div.sds-comps-vertical-layout.sds-comps-full-layout')
                # 그리고 이 아이템들 중 `data-sds-comp="Profile"`을 포함하는 것들만 필터링합니다. (뉴스 아닌 것 제외)
                items_found_soups = [item for item in items_found_soups if item.select_one('[data-sds-comp="Profile"]')]

        # 새 UI에서 아이템을 못 찾았을 경우, 기존 레거시 셀렉터로 폴백
        if not items_found_soups:
            legacy_news_containers = search_soup.select('ul.list_news li.bx, div.news_area')
            for container_item in legacy_news_containers:
                if container_item.select_one('a.news_tit, a.sa_text_title, div.news_area > div.tit'):
                    items_found_soups.append(container_item)

        if not items_found_soups:
            very_legacy_items = search_soup.select('div.news_list_api li, ul.list_news > li')
            if very_legacy_items:
                 items_found_soups.extend(very_legacy_items)

        items_found_soups = items_found_soups[:num_posts]

        if not items_found_soups:
             status_callback("뉴스 검색 결과 목록 컨테이너 또는 아이템을 찾을 수 없습니다.")


    elif search_type == "health_chosun_food":
        article_list_ul = search_soup.select_one('ul#section-bottom-article-list')
        if article_list_ul: items_found_soups = article_list_ul.find_all('li', class_='rellist', limit=num_posts)
        else: status_callback("헬스조선 푸드 목록 컨테이너(ul#section-bottom-article-list)를 찾을 수 없습니다.")

    if not items_found_soups:
        status_callback(f"'{search_type}' 검색 결과에서 아이템을 찾을 수 없습니다. (0개)")
        if search_type == "blog" and keyword:
             safe_keyword = re.sub(r'[\\/*?:"<>|]', "", keyword).replace(' ','_')
             debug_filename = f"debug_blog_no_items_{safe_keyword}_{datetime.now().strftime('%H%M%S')}.html"
             try:
                 with open(debug_filename, "w", encoding="utf-8") as f:
                     f.write(search_soup.prettify())
                 print(f"DEBUG: 블로그 아이템 0개, HTML 저장됨: {debug_filename}")
             except Exception as e_file:
                 print(f"DEBUG: HTML 파일 저장 중 오류: {e_file}")

        item_processed_callback(None, is_done=True, error_occurred=True); return

    total_items_to_process = len(items_found_soups)
    status_callback(f"수집 대상 '{search_type}' {total_items_to_process}개 발견. 처리 시작...")
    processed_item_count = 0
    scraped_data = []

    for i, item_soup in enumerate(items_found_soups):
        if processed_item_count >= num_posts: break
        current_progress = f"'{search_type}' 처리 중: {i+1}/{total_items_to_process}"
        post_data = {'platform': search_type, 'title': "제목 없음", 'link': "링크 없음", 'source_name': "출처 없음", 'post_date': "날짜 없음", 'content': "수집 안 함"}

        try:
            if search_type == "blog":
                title_el = item_soup.select_one('div.title_area a.title_link, div.title_area a.name_link, a.link_tit')
                if not title_el : title_el = item_soup.select_one('a.api_txt_lines.total_tit, a.dsc_link')

                if title_el:
                    post_data['title'] = title_el.get_text(strip=True)
                    post_data['link'] = title_el.get('href', "링크 없음")

                user_info_area = item_soup.select_one('div.user_box_inner, div.user_info')
                if user_info_area:
                    name_el = user_info_area.select_one('a.name, a.user_name, a.name.elss, a.nickname')
                    if name_el: post_data['source_name'] = name_el.get_text(strip=True)

                    date_el = user_info_area.select_one('span.sub, span.date, span.time')
                    if date_el: post_data['post_date'] = date_el.get_text(strip=True)
                else:
                    user_info_view_tab = item_soup.select_one('div.info_group, div.etc_info')
                    if user_info_view_tab:
                        name_el_view = user_info_view_tab.select_one('a.name, a.writer')
                        if name_el_view: post_data['source_name'] = name_el_view.get_text(strip=True)
                        date_el_view = user_info_view_tab.select_one('span.date, span.time')
                        if date_el_view: post_data['post_date'] = date_el_view.get_text(strip=True)

            elif search_type == "news":
                # 공통 파싱 헬퍼 함수 사용
                parsed_news_item = _parse_single_naver_news_item(item_soup, search_url)
                post_data.update(parsed_news_item)
                # GUI의 content는 API의 content와 동일하게 요약을 저장
                post_data['content'] = parsed_news_item['content']

            elif search_type == "health_chosun_food":
                title_tag = item_soup.select_one('div.inn > h4 > a')
                if title_tag:
                    post_data['title'] = title_tag.get_text(strip=True)
                    link_suffix = title_tag.get('href', "")
                    if link_suffix.startswith('/'): post_data['link'] = "https://health.chosun.com" + link_suffix
                    elif link_suffix.startswith('http'): post_data['link'] = link_suffix
                    else: post_data['link'] = urllib.parse.urljoin("https://health.chosun.com/", link_suffix)
                summary_tag = item_soup.select_one('div.inn > div.text > a')
                if summary_tag: post_data['content'] = summary_tag.get_text(strip=True) # GUI에서는 content에 요약
                author_tag = item_soup.select_one('div.em_area > span.name > a, div.em_area > span.name')
                if author_tag: post_data['source_name'] = author_tag.get_text(strip=True)
                else: post_data['source_name'] = "헬스조선"
                date_tag = item_soup.select_one('div.em_area > span.date')
                if date_tag: post_data['post_date'] = date_tag.get_text(strip=True)

            # 본문 크롤링 (fetch_content가 True일 경우에만)
            if fetch_content and post_data.get('link') and post_data['link'] != "링크 없음" and post_data['link'].startswith('http'):
                time.sleep(1.2) # 과도한 요청 방지
                # 필요한 경우 blog_parser, news_parser 함수를 여기서 import
                # 💡 수정: 함수 내부에서 import
                from blog_parser import get_blog_post_content
                from news_parser import extract_general_news_text, get_health_chosun_article_content

                content_or_error = ""
                if search_type == "blog": content_or_error = get_blog_post_content(post_data['link'])
                elif search_type == "news":
                    content_or_error = extract_general_news_text(post_data['link'], summary_from_list=post_data.get('content')) # 'content'로 변경
                elif search_type == "health_chosun_food": content_or_error = get_health_chosun_article_content(post_data['link'])

                error_keywords_check = ["요청 시간 초과", "요청 오류", "파싱 오류", "본문 추출 실패", "컨테이너 없음", "뉴스 본문 영역을 찾을 수 없습니다", "블로그 본문 컨테이너 없음", "블로그 본문 내용 부족", "헬스조선 본문 추출 실패", "헬스조선 본문 컨테이너 없음", "SSL 오류"]
                is_error_in_content = False
                if content_or_error:
                    for err_key in error_keywords_check:
                        if err_key in content_or_error:
                            is_error_in_content = True
                            break

                if content_or_error and not is_error_in_content:
                    post_data['content'] = content_or_error
                else:
                    post_data['content'] = content_or_error if content_or_error else "본문 없음 (오류 또는 내용 없음)"
                    if content_or_error :
                        status_callback(f"{current_progress} - '{post_data['title'][:20]}...' 본문 수집 실패: {content_or_error[:50]}...")
                    else:
                        status_callback(f"{current_progress} - '{post_data['title'][:20]}...' 본문 내용 없음.")

            elif not (post_data.get('link') and post_data['link'] != "링크 없음" and post_data['link'].startswith('http')):
                 post_data['content'] = "유효한 링크 없어 수집 불가"

            scraped_data.append(post_data)
            processed_item_count +=1
            time.sleep(0.1) # 각 아이템 처리 후 짧은 딜레이
        except Exception as e_item:
            status_callback(f"{current_progress} - '{search_type}' 아이템 '{post_data.get('title', '알 수 없음')}' 처리 중 예외: {e_item}")
            error_post_data = post_data.copy()
            error_post_data['content'] = f"아이템 처리 중 오류: {e_item}"
            item_processed_callback(error_post_data)
            continue

    status_callback("모든 아이템 처리 완료!")
    item_processed_callback(None, is_done=True)


# --- API 호출을 위한 뉴스 크롤링 함수 (목록용) ---
def fetch_naver_news_for_api(keyword, num_items):
    """네이버 검색 API를 사용하여 최신 뉴스를 반환합니다."""
    time.sleep(random.uniform(1.0, 3.0))

    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        print("NAVER API 자격 증명이 설정되지 않았습니다.")
        return []

    api_url = "https://openapi.naver.com/v1/search/news.json"
    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }

    results = []
    start = 1
    display = 100

    while len(results) < num_items and start <= 1000:
        params = {
            "query": keyword,
            "display": min(display, num_items - len(results)),
            "start": start,
            "sort": "date",
        }

        try:
            resp = requests.get(api_url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
            items = resp.json().get("items", [])
        except requests.RequestException as e:
            print(f"네이버 API 요청 실패: {e}")
            break

        if not items:
            break

        for item in items:
            url = item.get("originallink") or item.get("link")
            if not url:
                continue

            try:
                pub = datetime.strptime(item.get("pubDate", ""), "%a, %d %b %Y %H:%M:%S %z")
                pub_date = pub.strftime("%Y-%m-%d")
            except Exception:
                pub_date = datetime.now().strftime("%Y-%m-%d")

            title = re.sub("<[^<]+?>", "", item.get("title", ""))
            summary = re.sub("<[^<]+?>", "", item.get("description", ""))
            source = urllib.parse.urlparse(url).netloc

            results.append({
                "platform": "news",
                "title": title,
                "link": url,
                "source_name": source,
                "post_date": pub_date,
                "content": summary,
            })

            if len(results) >= num_items:
                break

        start += display
        time.sleep(0.5)

    return results
