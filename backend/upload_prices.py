from __future__ import annotations

import sys
import time
from typing import Dict, List, Tuple

import pandas as pd
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore

# --- 설정 부분 ---

# 1. Firebase Admin SDK 초기화
# 다운로드한 서비스 계정 키 파일 경로
SERVICE_ACCOUNT_KEY_PATH = 'serviceAccountKey.json'
try:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase에 성공적으로 연결되었습니다.")
except Exception as e:
    print(f"🔥 Firebase 연결 오류: {e}")
    print("serviceAccountKey.json 파일이 올바른 경로에 있는지, 내용이 유효한지 확인하세요.")
    sys.exit() # 프로그램 종료

# 2. 종목 리스트 엑셀 파일 경로
STOCK_LIST_FILE = 'stock_list.xlsx'

# 3. 스크래핑할 페이지 수 (1페이지당 10일치 데이터)
PAGES_TO_SCRAPE = 40 # 최근 400일치 데이터를 가져오려면 40으로 설정

# --- 스크립트 본문 ---

def scrape_daily_prices(ticker):
    """
    주어진 종목 코드(ticker)에 대해 네이버 금융에서 일별 시세 데이터를 스크래핑합니다.
    """
    prices = []
    
    # User-Agent 설정 (봇 차단 방지)
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'}

    for page in range(1, PAGES_TO_SCRAPE + 1):
        url = f"https://finance.naver.com/item/sise_day.naver?code={ticker}&page={page}"
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status() # HTTP 오류 발생 시 예외 발생
        except requests.exceptions.RequestException as e:
            print(f"    - [{ticker}] {page}페이지 요청 중 오류 발생: {e}")
            break # 오류 발생 시 해당 종목 중단

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 데이터가 있는 tr 태그 찾기
        data_rows = soup.select('table.type2 > tr[onmouseover]')
        
        # 데이터가 더 이상 없으면 중단
        if not data_rows:
            break

        for row in data_rows:
            cols = row.find_all('td')
            
            # 비어있는 행은 건너뛰기
            if len(cols) < 7:
                continue

            # 데이터 파싱
            date_str = cols[0].get_text(strip=True)
            if not date_str: # 날짜가 없는 행은 건너뛰기
                continue
                
            close_price = int(cols[1].get_text(strip=True).replace(',', ''))
            open_price = int(cols[3].get_text(strip=True).replace(',', ''))
            high_price = int(cols[4].get_text(strip=True).replace(',', ''))
            low_price = int(cols[5].get_text(strip=True).replace(',', ''))
            volume = int(cols[6].get_text(strip=True).replace(',', ''))
            
            # 날짜 형식 변환 (YYYY.MM.DD -> YYYY-MM-DD)
            formatted_date = date_str.replace('.', '-')

            prices.append({
                'date': formatted_date,
                'open': open_price,
                'high': high_price,
                'low': low_price,
                'close': close_price,
                'volume': volume
            })
        
        # 서버에 부담을 주지 않기 위해 약간의 딜레이 추가
        time.sleep(0.3)

    return prices


def merge_prices(
    existing_prices: List[Dict[str, int | str]],
    new_prices: List[Dict[str, int | str]],
) -> Tuple[List[Dict[str, int | str]], int]:
    """
    기존 데이터와 신규 데이터를 날짜 기준으로 병합합니다.

    같은 날짜가 존재하면 최신 스크래핑 데이터로 갱신하고,
    변경 건수를 함께 반환합니다.
    """

    merged: Dict[str, Dict[str, int | str]] = {}
    for record in existing_prices:
        date_key = str(record.get('date', '')).strip()
        if date_key:
            merged[date_key] = record

    change_count = 0
    for record in new_prices:
        date_key = str(record.get('date', '')).strip()
        if not date_key:
            continue

        if date_key not in merged or merged[date_key] != record:
            merged[date_key] = record
            change_count += 1

    if change_count == 0:
        # 기존 데이터와 완전히 동일하면 정렬만 수행하지 않고 기존 순서를 유지합니다.
        return existing_prices, 0

    # 날짜 기준 내림차순 정렬 (최근 데이터가 앞으로 오도록)
    merged_list = sorted(
        merged.values(),
        key=lambda item: str(item.get('date', '')),
        reverse=True,
    )
    return merged_list, change_count


def upload_to_firestore(ticker, name, prices):
    """스크래핑한 데이터를 Firestore에 누적 저장합니다."""

    if not prices:
        print(f"    - [{ticker}] {name}: 업로드할 데이터가 없습니다. 건너뜁니다.")
        return

    doc_ref = db.collection('stock_prices').document(ticker)

    try:
        snapshot = doc_ref.get()
        existing_data = snapshot.to_dict() if snapshot.exists else {}
    except Exception as e:
        existing_data = {}
        print(f"    - [{ticker}] {name}: 기존 데이터 조회 중 오류 발생: {e}")

    existing_prices = list(existing_data.get('prices', [])) if existing_data else []
    merged_prices, change_count = merge_prices(existing_prices, prices)

    if change_count == 0:
        print(f"    - [{ticker}] {name}: 새로운 데이터가 없어 건너뜁니다.")
        return

    data = {
        'ticker': ticker,
        'name': name,
        'prices': merged_prices,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    }

    try:
        doc_ref.set(data, merge=True)
        print(
            f"    - [{ticker}] {name}: {change_count}건 갱신, 총 {len(merged_prices)}일치 데이터 누적 저장 완료."
        )
    except Exception as e:
        print(f"    - [{ticker}] {name}: Firestore 업로드 중 오류 발생: {e}")


def main():
    """
    메인 실행 함수
    """
    try:
        # 엑셀 파일 읽기 (실제 열 이름으로 수정)
        df = pd.read_excel(STOCK_LIST_FILE, dtype={'단축코드': str})
        # 단축코드가 6자리가 되도록 앞에 0을 채워줌
        df['단축코드'] = df['단축코드'].str.zfill(6) 
        print(f"✅ 총 {len(df)}개의 종목을 엑셀 파일에서 읽었습니다.")
    except FileNotFoundError:
        print(f"🔥 오류: '{STOCK_LIST_FILE}' 파일을 찾을 수 없습니다. 파일명과 경로를 확인하세요.")
        return
    except Exception as e:
        print(f"🔥 엑셀 파일 읽기 오류: {e}")
        return

    # 모든 종목에 대해 작업 수행
    for index, row in df.iterrows():
        # 실제 열 이름으로 수정
        ticker = row['단축코드']
        name = row['한글 종목약명']
        
        print(f"\n({index + 1}/{len(df)}) '{name}' ({ticker}) 데이터 수집 시작...")
        
        # 1. 데이터 스크래핑
        daily_prices = scrape_daily_prices(ticker)
        
        # 2. Firestore에 업로드
        upload_to_firestore(ticker, name, daily_prices)

    print("\n🎉 모든 종목에 대한 작업이 완료되었습니다.")


if __name__ == "__main__":
    main()