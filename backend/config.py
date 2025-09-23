# START OF FILE config.py

import os
import certifi
import google.generativeai as genai

# --- SSL 인증서 경로 설정 ---
# 이 설정은 requests.get(verify=True) 일 때 유효합니다.
# 코드에서 verify=False를 제거했으므로, 이제 이 설정이 중요해집니다.
if os.path.exists(certifi.where()):
    os.environ['GRPC_DEFAULT_SSL_ROOTS_FILE_PATH'] = certifi.where()
    os.environ['GOOGLE_API_USE_CLIENT_CERTIFICATE'] = 'false'
    os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
    print(f"DEBUG: SSL 루트 인증서 경로를 certifi 경로로 설정: {certifi.where()}")
else:
    print("DEBUG: certifi CA 번들 파일을 찾을 수 없습니다. SSL 오류가 발생할 수 있습니다.")

# --- Gemini API 키 설정 ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY") 

# --- Gemini API 초기화 ---
GEMINI_API_CONFIGURED = False
gemini_model = None

if GEMINI_API_KEY and GEMINI_API_KEY != "YOUR_GEMINI_API_KEY":
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel("models/gemini-1.5-flash")
        GEMINI_API_CONFIGURED = True
        print("Gemini API가 성공적으로 설정되었습니다.")
    except Exception as e:
        print(f"Gemini API 설정 오류: {e}. API 키를 확인하거나, google-generativeai 라이브러리가 설치되었는지 확인하세요.")
else:
    print("Gemini API 키가 제공되지 않았습니다. AI 요약/키워드 추출 기능은 작동하지 않습니다.")

# END OF FILE gemini_utils.py
