# Thin Film Research Notebook

박막 성장 실험 자료를 정리하기 위한 정적 웹 앱입니다. GitHub Pages에서 바로 열 수 있도록 `index.html`은 최소 진입점으로 두고, 실제 코드는 `src/` 아래로 나누었습니다.

## 파일 구조

```text
research/
├─ index.html                  # 기본 진입 페이지
├─ app.html                    # 예비 진입 페이지
├─ src/
│  ├─ schema.js                # 데이터 구조, 검증, XRD 계산 유틸
│  ├─ storage.js               # localStorage, JSON/CSV import/export
│  ├─ app.js                   # 화면과 앱 동작
│  └─ styles.css               # 반응형 UI 스타일
└─ data/
   └─ experiments.example.json # 가져오기 테스트용 예시 데이터
```

## 입력 항목

### 기본 정보

- 실험 날짜
- Sample ID: `001`, `002`, `003`처럼 숫자형 순번
- 박막 이름

### PLD growth 조건

- Growth chamber
- 증착 기판
- 온도
- 산소 압력
- 렌즈 위치
- 레이저 에너지
- 레이저 반복률
- 레이저 샷 수

기존의 수동 두께 입력란은 제거했습니다. 두께는 XRD Laue oscillation 계산 결과로 기록합니다.

### 분석 자료

- XRD `2θ Bragg`
- 대칭 반사의 `(00l)` 지수
- Bragg 법칙으로 계산한 d-spacing
- Bragg 법칙으로 계산한 out-of-plane lattice parameter `c`
- 1st fringe 상태와 `2θ`
- 2nd fringe 상태와 `2θ`
- Laue oscillation 계산 두께
- XRD 분석 결과
- XRD/AFM 파일 메타데이터와 메모
- 태그와 비고

## Bragg 법칙 격자상수 계산

`2θ Bragg`를 입력하면 Cu Kα 파장 `λ = 1.5406 Å`, Bragg 차수 `n = 1`을 기준으로 계산합니다.

```text
nλ = 2d sinθ
θBragg = (2θBragg) / 2
d00l = λ / (2 sinθBragg)
c = l × d00l
```

이 계산은 대칭적인 `(00l)` 반사에서 측정한 out-of-plane 격자상수 `c`를 구하는 방식입니다. 실제 peak의 Miller index에 맞게 `(001)`, `(002)`, `(003)`, `(004)` 중 하나를 선택해야 합니다.

보통 perovskite 박막의 `2θ ≈ 45°` 부근 peak는 `(002)`로 해석하는 경우가 많아 기본값은 `(002)`입니다.

예시:

```text
2θBragg = 45.8631°
반사 = (002)
θBragg = 22.93155°
d002 ≈ 1.97700 Å
c = 2 × d002 ≈ 3.95400 Å
```

계산 결과는 `XRD 분석 결과`에 자동 추가되며 값을 바꾸면 기존 계산 블록만 갱신됩니다.

## XRD Laue oscillation 두께 계산

`2θ Bragg`와 두 fringe 값을 모두 입력하면 다음 식으로 두께를 계산합니다.

```text
t ≈ λ / [Δ(2θ) cos θBragg]
```

계산 과정:

1. `Δ(2θ) = |2nd fringe 2θ - 1st fringe 2θ|`
2. degree 단위의 `Δ(2θ)`를 radian으로 변환
3. `θBragg = (입력한 2θBragg) / 2`
4. 계산 결과를 Å와 nm로 표시
5. 계산 블록을 `XRD 분석 결과`에 자동 추가

두 fringe 값은 서로 인접한 fringe의 `2θ` 값을 사용하는 것을 전제로 합니다.

예시:

```text
2θBragg = 45.8631°
1st fringe 2θ = 44.9704°
2nd fringe 2θ = 45.3340°
Δ(2θ) = 0.3636° = 0.00634602 rad
θBragg = 22.9316°
t ≈ 263.60 Å = 26.36 nm
```

## Fringe가 보이지 않을 때

1st fringe와 2nd fringe는 각각 다음 상태를 선택할 수 있습니다.

- `2θ 값 입력`
- `none`

`none`을 선택하면 해당 각도 입력칸이 비활성화되고 Laue oscillation 두께 계산은 실행하지 않습니다. 대신 XRD 분석 결과에 다음처럼 관측되지 않았다는 기록이 자동으로 남습니다.

```text
[Laue oscillation 두께 계산]
1st fringe 2θ = none (관측되지 않음)
2nd fringe 2θ = none (관측되지 않음)
두께 계산 불가: 하나 이상의 Laue fringe가 관측되지 않음.
[/Laue oscillation 두께 계산]
```

한쪽 fringe만 보이지 않을 때도 각각 독립적으로 `none`을 선택할 수 있습니다. `none` 상태는 localStorage, JSON, CSV에 함께 저장됩니다.

## Sample ID 규칙

Sample ID는 단순한 숫자형 순번을 사용합니다.

```text
001
002
003
...
```

새 기록을 누르거나 Sample ID 옆의 `자동` 버튼을 누르면 현재 저장된 숫자형 Sample ID의 최댓값보다 1 큰 번호가 자동으로 입력됩니다.

## 검색과 정렬

실험 기록 패널에서 검색창, 박막 필터, Sample ID 정렬을 함께 사용할 수 있습니다.

- 검색 대상: Sample ID, 박막, chamber, 기판, XRD 각도, d-spacing, 격자상수, fringe 상태, 계산 두께, XRD/AFM 요약, 태그, 비고
- Sample ID 정렬: 큰 번호 먼저 또는 작은 번호 먼저
- 과거 비숫자형 Sample ID는 숫자형 ID 뒤쪽에 표시

## 프리셋

| 항목 | 프리셋 |
| --- | --- |
| 박막 이름 | SRO, LMO |
| Growth chamber | L chamber, K chamber |
| 증착 기판 | STO(001), DSO(110)o |
| 온도 | 650°C, 700°C, 750°C, 800°C |
| 산소 압력 | 100 mTorr |
| 렌즈 위치 | 140 mm |
| 레이저 에너지 | 80, 90, 100, 110, 120 mJ |
| 레이저 반복률 | 5, 10 Hz |
| 레이저 샷 수 | 1500, 3000, 6000 shots |

## 기록과 백업

이 앱은 서버 없이 동작하며 기록은 브라우저 `localStorage`에 저장됩니다. 브라우저 데이터 삭제, 기기 변경, 다른 브라우저 사용 시 기록이 사라질 수 있으므로 중요한 기록은 JSON으로 주기적으로 백업하세요.

- `updatedAt`은 실제 저장이나 수정 시에만 갱신됩니다.
- JSON/CSV 내보내기 파일명에는 날짜와 시간이 포함됩니다.
- XRD 입력값, fringe 상태, d-spacing, 격자상수, 계산된 두께가 JSON/CSV에 포함됩니다.
- JSON 가져오기는 기존 기록과 병합되며 같은 `id`에서는 더 최신인 기록을 유지합니다.
- 전체 삭제는 `DELETE` 또는 `전체삭제`를 직접 입력해야 실행됩니다.

## 사용 방법

1. `index.html` 또는 `app.html`을 엽니다.
2. 성장 조건과 분석 정보를 입력합니다.
3. `2θ Bragg`와 실제 `(00l)` 반사를 선택해 격자상수를 확인합니다.
4. 각 fringe가 보이면 `2θ 값 입력`, 보이지 않으면 `none`을 선택합니다.
5. 두 fringe 값이 모두 있으면 Laue oscillation 두께가 계산됩니다.
6. 자동 계산 결과가 XRD 분석 결과에 추가됐는지 확인합니다.
7. 기록을 저장하고 JSON 백업을 남깁니다.

## 중요한 제한

현재 파일 선택은 원본 XRD/AFM 파일을 GitHub에 업로드하지 않고 파일명, 크기, 타입, 수정일 같은 메타데이터만 기록합니다. 실제 원본 데이터는 별도 폴더나 저장소에서 관리하세요.
