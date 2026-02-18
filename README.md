# Reflow – ChatGPT Navigator

ChatGPT에서 원하는 기능을 찾아 실행할 수 있도록 단계별 클릭 가이드를 제공하는 Chrome 확장프로그램입니다.

조커딩 x Primer AI Hackathon 참가 프로젝트 (2025.02.20)

## 데모 영상

https://www.youtube.com/watch?v=VklAdO7NaEU

## 소개

처음 보거나 익숙하지 않은 기능을 사용하려 할 때, 어디를 눌러야 할지 몰라 헤매는 경험이 있으셨나요?

Reflow는 현재 화면을 실시간으로 분석하고, 다음에 클릭해야 할 곳을 하나씩 하이라이트로 안내합니다.

## 사용 방법

1. ChatGPT 페이지에서 Reflow 패널에 원하는 목표를 입력합니다. (예: "새 GPT 만드는 법")
2. AI가 현재 화면 구조를 분석하여 단계별 안내를 생성합니다.
3. 화면에 표시된 하이라이트를 따라 클릭하면 다음 단계로 자동으로 이어집니다.

## 설치 방법 (개발자 모드)

Chrome Web Store 심사 대기 중입니다. 아래 방법으로 직접 설치할 수 있습니다.

1. 이 레포를 ZIP으로 다운로드하거나 `git clone`
2. `chrome://extensions` 접속
3. 우측 상단 **개발자 모드** 활성화
4. **압축해제된 확장 프로그램을 로드합니다** 클릭
5. `reflow` 폴더 선택

## 기술 스택

- Chrome Extension Manifest V3
- Supabase Edge Functions (OpenAI API 프록시)
- OpenAI GPT-5 mini

## 현재 버전

데모 버전으로, 현재 ChatGPT(chatgpt.com)에서만 동작합니다.
다양한 웹사이트를 지원하는 정식 버전을 준비 중입니다.
