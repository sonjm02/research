# Thin Film Research Notebook

박막 성장 조건과 XRD/AFM 분석 결과를 브라우저에서 기록하는 정적 웹 앱입니다. GitHub Pages에서 실행되며, 실험 기록과 장비 설정은 브라우저 `localStorage`에 저장됩니다.

## 주요 파일

```text
research/
├─ index.html
├─ app.html
├─ src/
│  ├─ schema.js
│  ├─ storage.js
│  ├─ app.js
│  ├─ spot-settings.js
│  ├─ spot-settings-guard.js
│  ├─ spot-settings.css
│  ├─ substrate-peak-settings.js   # 기판별 기준 peak 설정
│  ├─ substrate-peak-correction.js # 2θ offset 및 보정 분석
│  ├─ substrate-peak-storage.js    # 보정 결과 저장과 CSV 내보내기
│  └─ styles.css
└─ data/
   └─ experiments.example.json
```

## PLD growth 조건

- 실험 날짜와 Sample ID
- 박막 이름
- Growth chamber
- 증착 기판
- 온도와 산소 압력
- 렌즈 위치
- 레이저 에너지, 반복률, 샷 수
- Spot area
- 자동 계산된 laser fluence

### Laser fluence

Spot 면적은 `mm²`, 레이저 에너지는 `mJ`, fluence는 `J/cm²` 단위를 사용합니다.

```text
F[J/cm²] = E[mJ] × 0.1 / A[mm²]
```

상단 `Spot 설정`에서 `chamber + 렌즈 위치 + spot area`를 저장하면 일치하는 성장 조건에서 면적을 자동으로 불러옵니다. 자동값을 직접 수정하면 수동 입력으로 전환됩니다.

## 기판 기준 peak 설정

상단의 `기판 Peak 설정` 버튼에서 다음 값을 저장합니다.

- 기판: 예시 `STO(001)`
- 기준 peak 이름: 예시 `STO(002)`
- 검증된 기준 `2θ`: 예시 `46.4721°`

같은 기판에 여러 기준 peak를 저장할 수 있으며, 설정마다 수정과 삭제가 가능합니다. 임의의 기준값은 앱에 기본으로 넣지 않으므로 사용하는 장비, 파장, peak index에 맞는 검증된 값을 직접 등록해야 합니다.

설정 목록은 다음 localStorage 키에 저장됩니다.

```text
thin-film-substrate-peak-settings-v1
```

## 기판 peak를 이용한 2θ 보정

분석 영역의 `기판 peak 기준 2θ 보정`에서 저장된 기준 peak를 선택하고 같은 scan에서 측정한 기판 peak를 입력합니다.

앱은 다음 부호 규칙을 사용합니다.

```text
δ = 2θsubstrate,measured - 2θsubstrate,reference
applied shift = -δ = reference - measured
2θcorrected = 2θraw + applied shift
             = 2θraw - δ
```

예를 들어:

```text
기준 기판 peak   = 46.4721°
측정 기판 peak   = 46.4723°
측정값 - 기준값 = +0.0002°
적용 shift       = -0.0002°
```

이 경우 입력한 박막 Bragg peak와 관측된 두 fringe에 모두 `-0.0002°`가 적용됩니다.

```text
raw Bragg       = 45.8633°
corrected Bragg = 45.8631°
```

원본 peak 입력값은 그대로 보존하고, 별도 보정 필드와 분석 결과를 생성합니다.

## 보정 후 자동 분석

기판 보정이 활성화되면 다음 결과를 함께 계산합니다.

### Bragg 분석

Cu Kα 파장 `λ = 1.5406 Å`, Bragg 차수 `n = 1`, 선택한 대칭 `(00l)` 반사를 사용합니다.

```text
θBragg = (2θBragg) / 2
d00l = λ / (2 sin θBragg)
c = l × d00l
```

분석 결과에는 다음 값이 표시됩니다.

- raw Bragg `2θ`
- corrected Bragg `2θ`
- raw d-spacing과 corrected d-spacing
- raw out-of-plane lattice parameter `c`
- corrected out-of-plane lattice parameter `c`
- `Δc = ccorrected - craw`

기록 카드에서 표시하는 d-spacing과 lattice parameter는 보정이 활성화된 경우 corrected 값을 사용합니다. raw 값은 별도 저장 필드와 XRD 분석 결과에 남습니다.

### Laue oscillation 두께

두 fringe가 모두 보이면 raw peak와 corrected peak를 각각 다음 식에 대입합니다.

```text
t ≈ λ / [Δ(2θ) cos θBragg]
```

같은 shift를 두 fringe에 적용하므로 두 fringe 사이의 `Δ(2θ)` 자체는 변하지 않습니다. 다만 보정된 Bragg 각도에 따른 `cos θBragg`가 달라져 corrected thickness가 미세하게 달라질 수 있습니다.

분석 결과에는 다음 값이 표시됩니다.

- raw fringe 1·2와 corrected fringe 1·2
- raw thickness
- corrected thickness
- `Δt = tcorrected - traw`

한쪽 또는 양쪽 fringe가 `none`이면 Bragg 격자상수 보정은 계속 수행하지만 Laue 두께는 계산하지 않습니다.

## XRD 분석 결과 자동 블록

기판 보정 결과는 `XRD 분석 결과`에 다음 블록으로 자동 기록됩니다.

```text
[Substrate peak 2theta correction]
기판 설정: ...
기준 기판 peak = ...
측정 기판 peak = ...
측정값 - 기준값 = ...
적용 shift = ...
2θ_Bragg: raw ... → corrected ...
1st fringe 2θ: raw ... → corrected ...
2nd fringe 2θ: raw ... → corrected ...

[보정 전 Bragg 분석]
...
[보정 후 Bragg 분석]
...

[보정 전 Laue 분석]
...
[보정 후 Laue 분석]
...
[/Substrate peak 2theta correction]
```

입력값을 변경하면 기존 자동 블록을 갱신하며, 사용자가 직접 작성한 XRD 메모는 유지합니다. 기판 보정을 사용하지 않으면 기존의 raw Bragg 및 Laue 자동 계산 방식이 그대로 동작합니다.

## 저장되는 기판 보정 필드

실험 기록 JSON과 CSV에 다음 값이 포함됩니다.

```text
substratePeakCalibrationId
substratePeakCalibrationLabel
substratePeakReference2Theta
substratePeakMeasured2Theta
substratePeakOffset2Theta
xrdAppliedShift2Theta
xrdCorrectedBragg2Theta
xrdCorrectedFringe1_2Theta
xrdCorrectedFringe2_2Theta
xrdRawDSpacingAngstrom
xrdRawLatticeParameterAngstrom
xrdRawThicknessNm
xrdCorrectedDSpacingAngstrom
xrdCorrectedLatticeParameterAngstrom
xrdCorrectedThicknessNm
```

기존 spot calibration 관련 필드도 CSV에 함께 유지됩니다.

```text
spotAreaMm2
laserFluenceJcm2
spotAreaSource
spotCalibrationId
spotCalibrationLabel
```

## 사용 순서

1. 상단 `기판 Peak 설정`에서 기판별 기준 peak와 검증된 기준 `2θ`를 저장합니다.
2. 새 실험에서 `증착 기판`을 입력합니다.
3. 분석 영역에서 같은 기판의 기준 peak 설정을 선택합니다.
4. 같은 scan에서 측정한 기판 peak `2θ`를 입력합니다.
5. 박막 `2θ Bragg`와 실제 `(00l)` 반사를 선택합니다.
6. fringe가 보이면 값을 입력하고, 보이지 않으면 각각 `none`을 선택합니다.
7. offset, 적용 shift, corrected peak, raw·corrected 격자상수와 두께를 확인합니다.
8. 기록을 저장하고 JSON 또는 CSV로 백업합니다.

## 데이터 보관 주의

이 앱은 서버 없이 동작합니다. 실험 기록, spot calibration, 기판 peak 설정은 브라우저 `localStorage`에 저장되므로 브라우저 데이터 삭제, 기기 변경, 다른 브라우저 사용 시 사라질 수 있습니다.

- 실험 기록은 주기적으로 JSON으로 내보내세요.
- Spot calibration은 Spot 설정 화면의 전용 JSON 백업을 사용하세요.
- 기판 peak 기준값은 현재 별도의 JSON 내보내기 기능이 없으므로 중요한 값은 연구 노트에도 함께 보관하세요.
- 앱의 파일 선택은 XRD/AFM 원본 파일 자체가 아니라 파일명, 크기, 타입, 수정일 같은 메타데이터만 기록합니다.
