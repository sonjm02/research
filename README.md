# Thin Film Research Notebook

박막 성장 실험 자료를 정리하기 위한 정적 웹 앱입니다. GitHub Pages에서 바로 열 수 있도록 `index.html`은 최소 진입점으로 두고, 실제 코드는 `src/` 아래로 나누었습니다.

## 파일 구조

```text
research/
├─ index.html                  # 기본 진입 페이지
├─ app.html                    # index.html 접근이 애매할 때 쓰는 예비 진입 페이지
├─ src/
│  ├─ schema.js                # 실험 기록 데이터 구조와 기본 필드
│  ├─ storage.js               # localStorage 저장, JSON/CSV import/export
│  ├─ app.js                   # 화면 렌더링과 앱 동작
│  └─ styles.css               # 반응형 UI 스타일
└─ data/
   └─ experiments.example.json # 가져오기 테스트용 예시 데이터
```

## 현재 입력 가능한 항목

### 기본 정보

- 실험 날짜
- Sample ID
- 박막 이름: 예시 SRO, LMO 등

### PLD growth 조건

- 증착 기판
- 온도
- 산소 압력
- 렌즈 위치
- 레이저 에너지
- 레이저 반복률 Hz
- 레이저 샷 수
- 두께

### 분석 자료 데이터

- XRD 요약
- XRD 파일명/크기 메타데이터
- AFM 요약
- AFM 파일명/크기 메타데이터
- 태그
- 추가 메모

## 사용 방법

1. GitHub Pages를 켠 뒤 `index.html` 또는 `app.html`을 엽니다.
2. 왼쪽 폼에 성장 조건과 분석 메모를 입력합니다.
3. `기록 저장`을 누르면 브라우저 `localStorage`에 저장됩니다.
4. `JSON 내보내기`를 눌러 백업 파일을 저장합니다.
5. 다른 브라우저나 PC에서는 `JSON 가져오기`로 기록을 복원합니다.

## 중요한 제한

현재 앱은 서버 없이 동작하는 정적 앱입니다. 따라서 실제 XRD/AFM 원본 파일을 GitHub 저장소에 자동 업로드하지는 않습니다. 앱 안의 파일 선택은 원본 파일 내용이 아니라 파일명, 크기, 타입, 수정일 같은 메타데이터만 기록합니다.

실제 원본 데이터는 다음 중 하나로 관리하는 것을 추천합니다.

```text
data/raw/xrd/
data/raw/afm/
data/exports/
```

그리고 앱에서 내보낸 JSON 파일은 `data/exports/`에 커밋하면 실험 기록 백업으로 사용할 수 있습니다.

## 다음에 추가하면 좋은 기능

- XRD/AFM 원본 파일을 저장소 경로와 연결하는 필드
- Raman, RSM, transport 등 분석 항목 추가
- 성장 recipe별 비교 테이블
- GitHub API를 이용한 자동 커밋 저장
- Sample ID naming rule 고정
