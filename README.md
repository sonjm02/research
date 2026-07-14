# Thin Film Research Notebook

박막 성장 실험 자료를 정리하기 위한 정적 웹 앱입니다. GitHub Pages에서 바로 열 수 있도록 `index.html`은 최소 진입점으로 두고, 실제 코드는 `src/` 아래로 나누었습니다.

## 파일 구조

```text
research/
├─ index.html                  # 기본 진입 페이지
├─ app.html                    # index.html 접근이 애매할 때 쓰는 예비 진입 페이지
├─ src/
│  ├─ schema.js                # 실험 기록 데이터 구조, 프리셋, 검증, XRD 계산 유틸
│  ├─ storage.js               # localStorage 저장, JSON/CSV import/export, 병합
│  ├─ app.js                   # 화면 렌더링과 앱 동작
│  └─ styles.css               # 반응형 UI 스타일
└─ data/
   └─ experiments.example.json # 가져오기 테스트용 예시 데이터
```

## 현재 입력 가능한 항목

### 기본 정보

- 실험 날짜
- Sample ID: `001`, `002`, `003`처럼 숫자형 순번 사용
- 박막 이름: 예시 SRO, LMO 등

### PLD growth 조건

- Growth chamber
- 증착 기판
- 온도
- 산소 압력
- 렌즈 위치
- 레이저 에너지
- 레이저 반복률 Hz
- 레이저 샷 수

기존의 수동 두께 입력란은 제거했습니다. 두께는 XRD Laue oscillation 계산 결과로 기록합니다.

### 분석 자료 데이터

- XRD 2θ Bragg
- 대칭 반사의 `(00l)` 지수: `(001)`, `(002)`, `(003)`, `(004)`
- Bragg 법칙으로 계산한 d-spacing
- Bragg 법칙으로 계산한 out-of-plane lattice parameter `c`
- XRD 1st fringe 2θ
- XRD 2nd fringe 2θ
- Laue oscillation 계산 두께
- XRD 분석 결과
- XRD 파일명/크기 메타데이터
- AFM 요약
- AFM 파일명/크기 메타데이터
- 태그
- 추가 메모

## Bragg 법칙 격자상수 계산

`2θ Bragg`를 입력하면 Cu Kα 파장 `λ = 1.5406 Å`, Bragg 차수 `n = 1`을 기준으로 계산합니다.

```text
nλ = 2d sinθ
θBragg = (2θBragg) / 2
d00l = λ / (2 sinθBragg)
c = l × d00l
```

이 계산은 대칭적인 `(00l)` 반사에서 측정한 out-of-plane 격자상수 `c`를 구하는 방식입니다. 따라서 실제 peak의 Miller index에 맞게 `(001)`, `(002)`, `(003)`, `(004)` 중 하나를 선택해야 합니다.

보통 perovskite 박막의 `2θ ≈ 45°` 부근 peak는 `(002)`로 해석하는 경우가 많아 앱의 기본값은 `(002)`입니다.

예시:

```text
2θBragg = 45.8631°
반사 = (002)
θBragg = 22.93155°
d002 ≈ 1.97700 Å
c = 2 × d002 ≈ 3.95400 Å
```

계산 결과는 `XRD 분석 결과`에 다음 블록으로 자동 추가되며, 값을 바꾸면 기존 블록만 갱신됩니다.

```text
[Bragg 법칙 격자상수 계산]
...
[/Bragg 법칙 격자상수 계산]
```

## XRD Laue oscillation 두께 계산

`2θ Bragg`와 두 fringe 값을 모두 입력하면 Cu Kα 파장 `λ = 1.5406 Å`를 기준으로 두께를 계산합니다.

```text
t ≈ λ / [Δ(2θ) cos θBragg]
```

계산 과정은 다음과 같습니다.

1. `Δ(2θ) = |2nd fringe 2θ - 1st fringe 2θ|`
2. degree 단위의 `Δ(2θ)`를 radian으로 변환
3. `θBragg = (입력한 2θBragg) / 2`
4. 계산 결과는 Å와 nm로 표시
5. 계산 블록은 `XRD 분석 결과`에 자동으로 추가되며 다시 계산하면 기존 계산 블록만 갱신

두 fringe 값은 서로 인접한 fringe의 2θ 값을 사용하는 것을 전제로 합니다.

예시 입력:

```text
2θBragg = 45.8631°
1st fringe 2θ = 44.9704°
2nd fringe 2θ = 45.3340°
```

예시 결과:

```text
Δ(2θ) = 0.3636° = 0.00634602 rad
θBragg = 22.9316°
t ≈ 263.60 Å = 26.36 nm
```

## Sample ID 규칙

Sample ID는 단순한 숫자형 순번을 사용합니다.

```text
001
002
003
...
```

새 기록을 누르거나 Sample ID 옆의 `자동` 버튼을 누르면, 현재 저장된 기록 중 숫자형 Sample ID의 최댓값보다 1 큰 번호가 자동으로 입력됩니다.

예를 들어 기존 기록에 `001`, `002`, `003`이 있으면 새 기록의 Sample ID는 `004`가 됩니다. 과거에 사용했던 `SRO-20260710-1432` 같은 비숫자형 ID는 기존 기록으로는 유지되지만, 다음 번호 계산에서는 제외됩니다.

## 검색과 정렬

실험 기록 패널에서 검색창, 박막 필터, Sample ID 정렬을 함께 사용할 수 있습니다.

- 검색창: Sample ID, 박막 이름, growth chamber, 기판, XRD 각도, d-spacing, 격자상수, 계산 두께, XRD/AFM 요약, 태그, 비고를 검색합니다.
- 박막 필터: 저장된 기록에 있는 박막 이름 기준으로 목록을 좁힙니다.
- Sample ID 정렬: 숫자형 Sample ID를 큰 번호 먼저 또는 작은 번호 먼저로 정렬합니다.
- `SRO-20260710-1432` 같은 비숫자형 Sample ID는 정렬 시 숫자형 Sample ID 뒤쪽에 표시됩니다.

## 프리셋

자주 쓰는 박막 이름과 PLD 조건은 입력칸 아래 버튼으로 바로 입력할 수 있습니다.

| 항목 | 프리셋 |
| --- | --- |
| 박막 이름 | SRO, LMO |
| Growth chamber | L chamber, K chamber |
| 증착 기판 | STO(001), DSO(110)o |
| 온도 | 650°C, 700°C, 750°C, 800°C |
| 산소 압력 | 100 mTorr |
| 렌즈 위치 | 140 mm |
| 레이저 에너지 | 80 mJ, 90 mJ, 100 mJ, 110 mJ, 120 mJ |
| 레이저 반복률 | 5 Hz, 10 Hz |
| 레이저 샷 수 | 1500 shots, 3000 shots, 6000 shots |

프리셋을 수정하려면 `src/schema.js`의 `FIELD_PRESETS`만 수정하면 됩니다.

## 기록 신뢰성

이 앱은 서버 없이 동작하는 정적 웹 앱입니다. 기록은 브라우저 `localStorage`에 저장되므로 브라우저 데이터 삭제, 기기 변경, 다른 브라우저 사용 시 기록이 사라질 수 있습니다. 중요한 실험 기록은 반드시 주기적으로 JSON 백업을 남기세요.

### 시간 기록

- `date` 기본값은 브라우저의 로컬 날짜 기준입니다.
- `updatedAt`은 앱을 열거나 기록을 불러오는 것만으로 바뀌지 않습니다.
- `updatedAt`은 사용자가 실제로 저장/수정했을 때 갱신됩니다.

### 백업

- JSON/CSV 내보내기 파일명에는 날짜와 시간이 포함됩니다.
- 예시: `thin-film-records-20260710-1432.json`
- XRD 입력값, d-spacing, 격자상수, 계산된 두께도 JSON/CSV에 포함됩니다.
- 앱 화면에서 다음 Sample ID, 마지막 기록 수정 시간, 마지막 JSON 백업 시간, 마지막 CSV 백업 시간을 확인할 수 있습니다.

### JSON 가져오기

- JSON 가져오기는 기존 기록과 병합됩니다.
- 같은 `id`를 가진 기록이 있으면 `updatedAt`이 더 최신인 기록을 유지합니다.
- 가져오기 결과로 추가/업데이트/건너뜀/무효 기록 수가 표시됩니다.
- 잘못된 JSON을 가져오면 기존 기록은 유지됩니다.

### 삭제 안전성

- 개별 기록 삭제는 확인창을 거칩니다.
- 전체 삭제는 `DELETE` 또는 `전체삭제`를 직접 입력해야 실행됩니다.
- 전체 삭제 전에는 JSON 백업을 먼저 남기는 것을 권장합니다.

## 사용 방법

1. GitHub Pages를 켠 뒤 `index.html` 또는 `app.html`을 엽니다.
2. 왼쪽 폼에 성장 조건과 분석 메모를 입력합니다.
3. Sample ID는 자동 입력된 `001`, `002`, `003` 형식의 값을 사용합니다.
4. `2θ Bragg`와 실제 `(00l)` 반사를 입력해 out-of-plane 격자상수를 확인합니다.
5. 두 fringe 2θ 값까지 입력하면 Laue oscillation 두께도 계산됩니다.
6. 계산 결과가 XRD 분석 결과에 추가됐는지 확인합니다.
7. `기록 저장`을 누르면 브라우저 `localStorage`에 저장됩니다.
8. 오른쪽 기록 패널에서 검색창, 박막 필터, Sample ID 정렬을 사용해 기록을 찾습니다.
9. `JSON 내보내기`를 눌러 백업 파일을 저장합니다.
10. 다른 브라우저나 PC에서는 `JSON 가져오기`로 기록을 복원합니다.

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
