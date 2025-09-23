# START OF FILE gemini_utils.py

import re
from config import GEMINI_API_CONFIGURED, gemini_model

def summarize_and_extract_keywords_gemini(article_content):
    """
    주어진 기사 내용을 Gemini API를 사용하여 요약하고 핵심 키워드를 추출합니다.
    """
    if not GEMINI_API_CONFIGURED or not gemini_model:
        return "Gemini API가 설정되지 않았습니다.", "키워드 추출 불가 (API 미설정)"

    if not article_content or len(article_content.strip()) < 80:
        return "요약할 내용이 충분하지 않습니다.", "키워드 추출 불가 (내용 부족)"

    try:
        prompt = f"""다음 뉴스 기사 내용을 분석하여 다음 두 가지 작업을 수행해주세요:

1. **핵심 요약**: 기사의 주요 내용을 한국어로 3~5문장으로 명확하고 간결하게 요약해주세요. 각 문장은 완결된 형태여야 합니다.

2. **주요 키워드**: 이 기사를 대표하는 핵심 키워드를 한국어로 5개 추출해주세요. 각 키워드는 명사형으로 작성하고 쉼표(,)로 구분해주세요. (예: 건강, 비타민, 운동, 식단, 예방)

---
**기사 내용:**
{article_content[:4000]} 
---
**요청 형식:**
요약:
[여기에 요약 내용을 작성해주세요]
키워드:
[여기에 키워드를 작성해주세요]
"""

        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip()

        summary_part = "요약 정보 없음"
        keywords_part = "키워드 정보 없음"

        # 응답 파싱 로직
        if "요약:" in response_text and "키워드:" in response_text:
            summary_match = re.search(r"요약:\s*(.*?)\s*키워드:", response_text, re.DOTALL | re.IGNORECASE)
            keywords_match = re.search(r"키워드:\s*(.*)", response_text, re.DOTALL | re.IGNORECASE)
            if summary_match:
                summary_part = summary_match.group(1).strip()
            if keywords_match:
                keywords_part = keywords_match.group(1).strip().splitlines()[0]
                keywords_part = re.sub(r'\[.*?\]', '', keywords_part).strip() # [ ] 괄호 제거

        elif "요약:" in response_text: # 키워드 파트가 없을 경우 요약만 파싱
            summary_match = re.search(r"요약:\s*(.*)", response_text, re.DOTALL | re.IGNORECASE)
            if summary_match:
                summary_part = summary_match.group(1).strip()

        elif "키워드:" in response_text: # 요약 파트가 없을 경우 키워드만 파싱
            keywords_match = re.search(r"키워드:\s*(.*)", response_text, re.DOTALL | re.IGNORECASE)
            if keywords_match:
                keywords_part = keywords_match.group(1).strip().splitlines()[0]

        else: # 특정 형식 없이 응답이 온 경우, 전체를 요약으로 간주
            if len(response_text) > 20:
                summary_part = response_text

        # 최종 검증 및 기본값 설정
        if not summary_part or len(summary_part) < 10:
            summary_part = "AI 요약 생성 실패 (내용 부족 또는 형식 오류)"
        if not keywords_part or len(keywords_part.split(',')) < 2: # 키워드가 2개 미만이거나 없으면 실패로 간주
            keywords_part = "AI 키워드 추출 실패 (내용 부족 또는 형식 오류)"

        return summary_part, keywords_part

    except Exception as e:
        error_message = f"Gemini API 호출 중 오류 발생: {str(e)}"
        print(error_message) # 서버 로그에 에러 출력
        if "API key not valid" in str(e):
            return "API 키가 유효하지 않습니다. 확인해주세요.", "키워드 추출 불가 (API 키 오류)"
        elif "billing" in str(e).lower():
            return "Gemini API 사용량 또는 결제 관련 문제가 발생했습니다.", "키워드 추출 불가 (API 결제 오류)"
        return error_message, "키워드 추출 실패 (API 내부 오류)"

# END OF FILE gemini_utils.py