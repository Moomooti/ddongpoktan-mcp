# 똥폭탄 MCP 서버 설계 문서

카카오 MCP 공모전(제출 2026-07-14) 제출용 "똥폭탄" 실시간 난투형 챗봇 게임의 **백엔드(MCP 서버) 설계**입니다. 웹뷰/카루셀 등 UI는 별도 담당이므로 이 문서는 MCP 툴/리소스 명세, 데이터 모델, 상태머신에 집중합니다.

- 런타임: Node.js + TypeScript, `@modelcontextprotocol/sdk`
- 저장소: **SQLite (better-sqlite3, WAL 모드)** 권장
  - 공모전 제출 규모(단일 인스턴스, 방당 소수 인원)에는 운영 부담이 없는 SQLite면 충분합니다.
  - 다만 DB 접근을 Repository 패턴으로 한 겹 감싸서, 이후 배포 환경이 멀티 인스턴스(서버리스 등)로 바뀌면 Postgres(Supabase)로 무중단에 가깝게 교체할 수 있게 설계합니다.

---

## 0-A. PlayMCP 플랫폼 실제 스펙 (확인된 사실)

`playmcp.kakao.com` 캡처 확인 결과, 공모전 이름은 **Agentic Player 10** (예선 2026-06-15~07-14)이며 절차는 다음과 같습니다.

1. **로컬에서 MCP 서버 개발** — 표준 MCP 프로토콜 그대로. 실제 등록 화면에 뜬 JSON이 `{ tools: [{ name, description, inputSchema: { type:'object', properties, required } }] }` 형태로, 이 문서의 §3 툴 명세와 형식이 일치합니다. 카카오 전용 프로토콜이 별도로 있는 게 아닙니다.
2. **PlayMCP in KC(카카오클라우드)에 배포 필수** — 개인 서버/클라우드 불가. Git 소스 또는 컨테이너 이미지로 배포 → Endpoint URL 발급.
3. **PlayMCP 개발자 콘솔에 등록** — MCP 설명, 대화 예시 3개, 인증 방식(옵션 중 "인증 사용하지 않음" 확인됨 — 즉 무인증 배포도 허용), Endpoint URL 입력 → "정보 불러오기"로 동작 확인 → **임시 등록**(바로 "등록 및 심사요청" 누르지 말 것).
4. **PlayMCP 제공 "AI 채팅"으로 테스트** — 개발 중 검증용 인터페이스로 보입니다.
5. 심사 요청 → 통상 영업일 1~2일(최대 7일) → 승인 시 공개 상태를 "전체 공개"로 전환.

### [정정] 실제 카카오톡 단톡방 통합 — 강한 정황 증거 확인됨

기존에는 "PlayMCP AI채팅 = 웹사이트 안의 1:1 테스트 화면일 뿐, 실제 카카오톡 단톡방과는 무관"이라고 판단했는데, **정정합니다.** 실제 카카오톡 단톡방 스크린샷("버튼제국" 봇 사례)을 확인한 결과:

- 메시지 입력창 하단 툴바의 **"챗봇" 버튼으로 봇을 실제 단톡방에 초대**할 수 있고(`OO님이 버튼제국을 추가했습니다`), 초대 후 `@버튼제국 튜토리얼`처럼 멘션하면 **방 전체에 보이는 카드/버튼 응답**(`/강화`, `/산업보상`, `/출석` 등 슬래시커맨드 메뉴)이 옵니다.
- 이는 기획서 4.1절 "카카오톡 챗봇 화면(인앱 텍스트 & 카루셀 템플릿)"과 `@똥폭탄 도감` 형태의 명령어 표기가 **원안 그대로 실현 가능하다는 강한 정황**입니다.
- 다만 "버튼제국"이 이번 PlayMCP/MCP 스택 기반인지, 예전부터 있던 카카오 i 오픈빌더 기반 챗봇인지는 스크린샷만으로 확정할 수 없습니다(겉보기 UX는 비슷할 수 있음). **개발가이드 원문 또는 실제 초대 테스트로 확인 필요.**

### 이로 인해 바뀌는 설계 포인트 (갱신)

- **기본 가정을 원복**: `room_id`/`user_id`는 우리가 직접 만드는 게 아니라 **카카오톡 플랫폼이 봇 호출 컨텍스트로 제공**한다고 가정합니다. §3의 `join_room(room_code, nickname)` 툴은 **최악의 경우(플랫폼이 식별자를 안 주는 경우)를 위한 폴백**으로 격하합니다 — 삭제하지 않고 남겨두되 "기본"이 아닌 "대체 경로"로 표시.
- **명령 방식도 원복**: `@똥폭탄 명령어` / `/명령어` 슬래시커맨드 + 버튼·카루셀 응답이 실제에 더 가까운 것으로 보입니다. "PlayMCP AI가 자유 자연어만 해석한다"는 이전 가정은 과잉 수정이었을 수 있어 낮춥니다. 다만 MCP 표준상 툴 호출 자체는 여전히 host(카카오 봇 엔진 or AI)가 수행하고, 우리는 툴 스키마/description만 정의하는 구조 자체는 변하지 않습니다.
- **황금 이벤트 메시지 감시(TBD #8)는 여전히 불확실**합니다. 실제 단톡방이어도, 봇이 `@멘션`/`/명령어` 없는 일반 채팅까지 수신하는지는 별개 문제입니다("버튼제국" 예시도 명령은 항상 `@버튼제국` 또는 슬래시로 시작). → 원래의 "아무 툴 호출 시 패널티" 폴백 로직은 유지하되, 만약 일반 메시지 수신이 가능한 것으로 확인되면 원안(전체 메시지 감시)으로 되돌릴 수 있게 설계해둡니다.
- **유저 식별 방식(TBD #9)은 여전히 최우선 확인 대상**입니다 — 다만 이제는 "플랫폼이 준다"가 기본값이고, `join_room` 폴백은 보험용입니다.

---

## 0-B. PlayMCP 개발가이드 확정 스펙 (원문 확인, 2026-07-10)

사용자가 공유한 PlayMCP 개발가이드(Notion) 원문에서 확인된 **강제/권장 규칙**입니다. 이제부터는 추정이 아니라 확정 스펙으로 취급합니다.

### 서버 요구사항
- MCP 프로토콜 버전: 최소 `2025-03-26` ~ 최대 `2025-11-25`
- **전송 방식은 Streamable HTTP만 지원** (stdio, SSE 단독 불가)
- **Remote MCP 서버만 지원** — 공개 URL로 접근 가능해야 함 (PlayMCP in KC 배포 필수, §0-A와 일치)
- **Stateless 서버 권장(no session)** — ⚠️ **아키텍처에 직접 영향.** 커넥션 단위 세션에 상태를 두면 안 되고, 모든 게임 상태는 매 요청마다 명시적 식별자로 DB에서 조회/저장해야 합니다. 이미 §1의 `(room_id, user_id)` 복합키 설계가 이 요구사항과 맞습니다.
- **사용자 인증**: OAuth/커스텀 헤더 옵션이 있지만, **✅ 결정 완료(2026-07-10): 무인증으로 진행**. 이유: 남은 개발 기간(~4일)에 OAuth 동의 플로우 및 PlayMCP 연동까지 구현하는 건 리스크가 크고, 컨테스트 데모 스케일에서는 닉네임 기반 식별의 동명이인 충돌 정도는 감수 가능. → 모든 툴이 `room_code`/`nickname`을 명시 파라미터로 받고, 최초 등장 시 암묵적 등록(§3)하는 방식이 **최종안**입니다.
- MCP Inspector로 스펙 준수 여부 사전 점검 필수
- 활발히 유지보수되는 SDK 사용 (`@modelcontextprotocol/sdk`는 공식 SDK라 문제 없음)
- **MCP 서버명/툴 이름에 "kakao"를 prefix/suffix/중간 어디에도 포함 불가**(대소문자 무관) — "똥폭탄" 관련 명칭에는 해당 없음, 확인만 해두면 됨

### 툴 구성 규칙
- 툴 이름: 1~128자, `[A-Za-z0-9_-]`만 허용, 중복 불가, 대소문자 구분
- **툴 개수: 최대 20개, 권장 3~10개** — ⚠️ **현재 §3 설계가 11개(`join_room` 포함)라 권장 상한 초과.** 아래에서 통합안 반영.
- 모든 툴에 `name`, `description`, `inputSchema`, **`annotations`**(title, readOnlyHint, destructiveHint, openWorldHint, idempotentHint **전부** 명시) 필수
- `description`: 영문 권장, 서비스명을 국영문 병기로 포함(예시: `Retrieves a list of the current most popular or trending songs from Melon(멜론)`), 1024자 이내
- Kakao Tools에 반영될 때 PlayMCP가 tool name에 prefix를 자동으로 붙여주므로, **툴 이름 자체에 MCP명을 넣을 필요 없음**(description에는 필요)

### 툴 개수 통합안 (11개 → 7개)

| 기존 | 통합 방향 |
|---|---|
| `join_room` | 별도 툴로 유지하지 않고, **모든 툴 핸들러 진입부에서 처음 보는 (room_code, nickname/user_id)면 자동 등록**(암묵적 join)으로 흡수. 사용자가 "가입"을 의식할 필요 없이 첫 `throw_poop` 호출이 곧 등록. 인증 켜는 경우 이 로직 자체가 거의 불필요해짐 |
| `revenge_throw` | `throw_poop`에 흡수. `target`을 생략하면 `last_attacker_id`로 자동 resolve |
| `check_toilet` + `check_coin` | `check_status` 하나로 통합 (변기 스택/강화레벨/운세/코인 잔액을 한 번에 반환) |
| `check_dex` | 그대로 유지 (28종 데이터라 분리 유지가 합리적) |

**최종 7개 툴**: `throw_poop`, `flush_toilet`, `enhance_toilet`, `use_bidet`, `use_perfume`, `check_status`, `check_dex` (+ 방 멤버 조회가 플랫폼에서 안 되면 `list_room_players` 추가해 8개까지는 여유 있음)

---

## 0. 먼저 확인이 필요한 불일치/미정 사항

기획서 본문과 하단 초안 메모 사이에 몇 가지 충돌이 있어, **본문(정식 절 번호가 붙은 표)을 기준으로 확정**하고 진행했습니다. 최종 제출 전 팀 확인 필요합니다.

| # | 항목 | 충돌 내용 | 이 문서의 처리 |
|---|---|---|---|
| 1 | 등급별 확률 | 2.1절 표(75/12/8/4/1=100%) vs 하단 메모(70/10/4/5/1=90%, 합계 불일치) | 2.1절 표 채택 |
| 2 | 황금똥 효과 | 2.2절 "황금 변기 독점 알현" vs 하단 메모 "1원 보내주기" | 2.2절(최신, 상세) 채택 |
| 3 | 변기 강화 확률 | 2.6절 레벨별 표(55→35%) vs 하단 메모 "40:60 고정" | 2.6절 표 채택 |
| 4 | 폭탄똥 "게임오버" 범위 | 방이 영구 종료되는지, 스택만 리셋되고 코인/강화/도감은 유지되는 "라운드 리셋"인지 불명 | **라운드 리셋**으로 가정(전원 스택만 0으로, 코인·강화레벨·도감은 유지) — 확인 필요 |
| 5 | 좋은 운세(무지개) 지속시간 | 미기재 | 임시로 "다음 5회 던지기 또는 30분 중 먼저 도래"로 가정 — 확인 필요 |
| 6 | 물내리기 실패 페널티 | "2배 혹은 무작위 1~3개 추가" 둘 다 명시, 선택 기준 없음 | 기본값을 `stack + random(1~3)`로 구현하고 상수로 분리, 추후 "2배" 모드로 토글 가능하게 설계 |
| 7 | 푸프 퍼퓸 비용/범위 | 코인 비용, 본인만/방 전체 정화인지 미기재 | 본인 스택 즉시 초기화(물내리기의 "확정 성공" 버전)로 가정, 비용은 TBD 상수 |
| 8 | 황금 이벤트 중 전체 메시지 감시 | 실제 단톡방이어도 봇이 `@멘션`/`/명령어` 없는 일반 채팅까지 수신하는지 불확실(§0-A 정정 참고) | 기본값은 "60초 동안 holder가 아닌 유저가 아무 MCP 툴/명령을 호출하면 stack+1 패널티"로 좁혀서 구현. 일반 메시지 수신이 가능한 것으로 확인되면 원안(전체 메시지 감시)으로 전환 |
| 9 | 유저 식별 방식 | ✅ **해결(2026-07-10).** 무인증으로 진행 결정(§0-B) | 모든 툴이 `(room_code, nickname)`을 명시 파라미터로 받고, 최초 등장 시 암묵적 등록. 동명이인 충돌은 컨테스트 데모 스케일에서 감수 |
| 10 | `@똥폭탄 ...` 고정 커맨드 문구 | 최초엔 "PlayMCP AI가 자연어만 해석" 가정으로 예시 문구로 격하했었으나, "버튼제국" 실사용 사례를 보면 `@봉이름 명령어`/`/명령어` 형태가 실제 동작 방식에 더 가까움(§0-A 정정) | 슬래시커맨드/멘션 형태를 1차 트리거로 다시 채택. 툴 `description`도 자연어 백업 트리거를 겸하도록 작성(플랫폼이 자연어 해석까지 지원할 가능성 배제 안 함) |

---

## 1. 데이터 모델

### 1.1 방-유저 독립성 (기획서 4.3)

모든 게임 상태는 `(room_id, user_id)` 복합키로 저장하여 방 간 상태가 섞이지 않게 합니다.

> **식별자 확정(TBD #9, 무인증 결정)**: 아래 스키마의 `room_id`/`user_id`는 실제 카카오 계정 ID가 아니라, 사용자가 말로 지정한 `room_code`/`nickname`을 그대로 매핑한 논리적 식별자입니다(`room_id = room_code`, `user_id = nickname`). §3의 각 툴이 최초 호출 시 암묵적으로 등록합니다.

### 1.2 테이블 스키마 (SQLite)

```sql
-- 정적 참조 데이터: 28종 수집 요소
CREATE TABLE poop_species (
  species_id   INTEGER PRIMARY KEY,   -- 1~24 기본, 25 무지개, 26 폭탄, 27 황금, 28 다이아
  tier         TEXT NOT NULL,         -- 'basic' | 'rainbow' | 'bomb' | 'golden' | 'diamond'
  name         TEXT NOT NULL,         -- '꽃향기가 가득한 똥' 등
  probability  REAL NOT NULL          -- tier 내 확률 or tier 전체 확률(단일종은 tier 확률과 동일)
);

-- 방 단위 상태 (라운드/황금이벤트 등 방 전체에 걸친 상태)
CREATE TABLE room_state (
  room_id            TEXT PRIMARY KEY,
  round_no           INTEGER NOT NULL DEFAULT 1,
  bomb_triggered_at  TEXT,             -- NULL이면 진행중
  bomb_winner_user_id TEXT,
  golden_holder_id   TEXT,             -- 황금 이벤트 진행 중인 유저(주인공), NULL이면 비활성
  golden_expires_at  TEXT
);

-- 유저 x 방 상태
CREATE TABLE user_room_state (
  room_id             TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  stack               INTEGER NOT NULL DEFAULT 0,   -- 0~10
  coin                INTEGER NOT NULL DEFAULT 0,
  enhance_level       INTEGER NOT NULL DEFAULT 0,   -- 0~5
  enhance_fail_streak INTEGER NOT NULL DEFAULT 0,   -- Lv3~5 연속 실패 카운트
  fortune_state       TEXT NOT NULL DEFAULT 'none', -- 'none' | 'good' | 'bad'
  fortune_expires_at  TEXT,
  last_attacker_id    TEXT,            -- '복수하기' 대상 resolve용
  last_daily_bonus_date TEXT,          -- 출석 보너스 중복 방지 (KST 기준 날짜)
  welcome_bonus_given INTEGER NOT NULL DEFAULT 0,
  diamond_lifetime_count INTEGER NOT NULL DEFAULT 0,
  golden_event_count  INTEGER NOT NULL DEFAULT 0,
  rainbow_hit_count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id)
);

-- 유저별 수집 도감 (몇 번 맞았는지까지 기록)
CREATE TABLE user_dex (
  room_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  species_id INTEGER NOT NULL REFERENCES poop_species(species_id),
  hit_count  INTEGER NOT NULL DEFAULT 0,
  first_hit_at TEXT,
  PRIMARY KEY (room_id, user_id, species_id)
);

-- 코인 원장 (4.2 강화 현황 탭, 코인함 내역용)
CREATE TABLE coin_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,   -- 'welcome' | 'base_throw' | 'rainbow_hit' | 'golden_trigger'
                               -- | 'diamond_trigger' | 'daily_first_throw' | 'enhance_spend'
                               -- | 'bidet_use' | 'perfume_use'
  created_at TEXT NOT NULL
);

-- 강화 성공/실패 이력 (4.2 강화 현황 탭)
CREATE TABLE enhance_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  from_level INTEGER NOT NULL,
  success    INTEGER NOT NULL,  -- 0/1
  reset_triggered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 스킨 해금 현황
CREATE TABLE user_skin (
  room_id  TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  skin_id  TEXT NOT NULL,  -- 예: 'lv1_white', 'rainbow', 'golden', 'diamond', 'allstar'
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id, skin_id)
);
```

### 1.3 상수 테이블 (코드 상수로 관리)

```ts
const TIER_PROBABILITY = { basic: 0.75, rainbow: 0.12, bomb: 0.08, golden: 0.04, diamond: 0.01 };

const ENHANCE_TABLE = [
  // level -> { cost, successRate, flushRateAfter, resetRisk }
  { level: 1, cost: 850,  successRate: 0.55, flushRate: 0.65, resetRisk: false },
  { level: 2, cost: 1600, successRate: 0.50, flushRate: 0.70, resetRisk: false },
  { level: 3, cost: 2500, successRate: 0.45, flushRate: 0.75, resetRisk: true  },
  { level: 4, cost: 3700, successRate: 0.40, flushRate: 0.80, resetRisk: true  },
  { level: 5, cost: 5400, successRate: 0.35, flushRate: 0.85, resetRisk: true  },
];
const BASE_FLUSH_RATE = 0.60; // Lv.0

const COIN_REWARD = {
  welcome: 500, baseThrow: 30, rainbowHit: 150,
  goldenTrigger: 450, diamondTrigger: 750, dailyFirstThrow: 300,
};
const BIDET_COST = 15;
const MAX_STACK = 10;
const GOLDEN_EVENT_DURATION_SEC = 60;
```

---

## 2. 상태머신

### 2.1 변기 스택 (유저별)

```
EMPTY(0) --[피격 +1]--> ACCUMULATING(1~9) --[피격, stack==10]--> FULL(10)
ACCUMULATING/FULL --[물내리기 성공]--> EMPTY(0)
ACCUMULATING/FULL --[물내리기 실패]--> stack = min(10, stack + random(1~3))
FULL(10) 진입 즉시 --> fortune_state = 'bad' 강제 발동 (사이드이펙트)
```

### 2.2 운세 상태 (유저별)

```
NONE --[무지개똥 피격]--> GOOD (만료: N회 던지기 또는 30분, TBD #5)
GOOD --[만료]--> NONE
NONE --[stack == MAX_STACK]--> BAD
BAD --[/비데 사용 성공]--> NONE
BAD 상태에서는 강화 코인 획득 전부 0 (coin_ledger 기록 자체를 막음)
```
GOOD/BAD는 상호 배타(둘 다 활성인 상태 없음). 동시 트리거 시 BAD 우선.

### 2.3 변기 강화 (유저별)

```
Lv.0 --[시도 성공]--> Lv.1 --[성공]--> Lv.2 --[성공]--> Lv.3 --[성공]--> Lv.4 --[성공]--> Lv.5(만렙, 더 이상 시도 불가)

Lv.0~2에서 실패: 코인만 소멸, 레벨 유지, fail_streak 변화 없음(초기화 리스크 제외 구간)
Lv.3~5에서 실패: 코인 소멸 + fail_streak += 1
  fail_streak == 1: 레벨 유지
  fail_streak == 2: 레벨 -> Lv.0 완전 초기화, fail_streak = 0
임의 레벨에서 성공: fail_streak = 0 (즉시 리셋)
```

### 2.4 황금 이벤트 (방 단위, room_state.golden_holder_id)

```
IDLE --[누군가 황금똥 피격]--> ACTIVE(holder=피격자, expires=now+60s)
ACTIVE 동안:
  - holder가 채팅 -> 자유 허용 (자랑/드립)
  - holder 외 유저가 채팅 -> stack += 1 (패널티), 챗봇이 즉시 반응
  - 60초 경과 -> IDLE, 종료 안내 메시지 발송
```
방당 한 번에 하나의 golden 이벤트만 활성 가능(동시에 다른 유저가 또 황금똥을 맞으면 큐잉 또는 무시 — 정책 TBD).

### 2.5 라운드/게임오버 (방 단위)

```
PLAYING --[누군가 폭탄똥 피격]--> ROUND_END(winner = 마지막으로 폭탄을 던진 유저)
ROUND_END --[자동 or 다음 /던지기 요청 시]--> PLAYING(round_no += 1)
  라운드 리셋 시: 모든 유저 stack=0, fortune_state='none' 초기화
  유지되는 값: coin, enhance_level, dex, skins (TBD #4 확인 필요)
```

---

## 3. MCP 툴 명세

**§0-B 확정 스펙 반영**: 툴은 3~10개 권장이라 11개→7개로 통합했습니다(`join_room`은 암묵적 등록으로 흡수, `revenge_throw`는 `throw_poop`에 흡수, `check_toilet`+`check_coin`은 `check_status`로 통합). 툴 이름에 "kakao" 불가, `description`은 영문 권장 + 서비스명 국영문 병기(`Ddongpoktan(똥폭탄)`), 1024자 이내. `annotations`는 모든 툴에 필수라 아래 표에 별도 열로 명시합니다.

카카오톡 봇 엔진/PlayMCP AI가 `@똥폭탄 명령어` 멘션 또는 자연어를 해석해서 적절한 인자로 툴을 호출하고, 결과를 카드/텍스트로 사용자에게 보여줍니다. 우리는 툴 스키마/description/annotations만 정의합니다.

**입력 파라미터 (✅ 무인증으로 확정, §0-B/TBD #9):** 모든 툴이 `room_code`/`nickname`을 명시 파라미터로 받습니다. **최초 호출 시 해당 (room_code, nickname) 조합을 자동으로 신규 등록**(암묵적 join, 별도 `join_room` 툴 없음 — 신규면 웰컴 코인 +500 지급 후 진행).

| 툴 이름 | 명령/트리거 예시 | 입력 | 출력 | annotations | 비고 |
|---|---|---|---|---|---|
| `throw_poop` | `@똥폭탄 발사` / "영희한테 똥 던져줘" | `room_code, nickname, target_nickname?` | `{species_id, tier, flavor_text, target_new_stack, coin_earned, event?}` | readOnly:false, destructive:false, idempotent:false, openWorld:false | 확률 롤 + 스택/코인/이벤트 부수효과. `target_nickname` 생략 시 `last_attacker_id`로 자동 resolve(구 `revenge_throw`). 하루 첫 던지기면 출석 보너스 포함. 호출 자체가 §2.4 golden 감시 대상. (room_code, nickname) 최초 등장 시 암묵적 등록 |
| `flush_toilet` | `@똥폭탄 물내리기` | `room_code, nickname` | `{success, new_stack}` | readOnly:false, destructive:false, idempotent:false, openWorld:false | 성공률은 `enhance_level`에 따라 결정 |
| `enhance_toilet` | `@똥폭탄 변기 강화` | `room_code, nickname` | `{success, new_level, reset_triggered, coin_spent}` | readOnly:false, destructive:true(Lv3~5 초기화 리스크 있어 destructive로 표시), idempotent:false, openWorld:false | 코인 부족 시 에러 반환 |
| `use_bidet` | `@똥폭탄 비데 사용` | `room_code, nickname` | `{fortune_state}` | readOnly:false, destructive:false, idempotent:true(이미 none이면 no-op), openWorld:false | `fortune_state != 'bad'`면 no-op |
| `use_perfume` | `@똥폭탄 방향제` | `room_code, nickname` | `{new_stack}` | readOnly:false, destructive:false, idempotent:false, openWorld:false | 비용/범위 TBD #7 |
| `check_status` | `@똥폭탄 변기 열기` / `@똥폭탄 코인함` | `room_code, nickname` | `{stack, max:10, enhance_level, fortune_state, skin, coin_balance, coin_recent: LedgerEntry[]}` | readOnly:true, destructive:false, idempotent:true, openWorld:false | 구 `check_toilet`+`check_coin` 통합. 읽기 전용 |
| `check_dex` | `@똥폭탄 도감` | `room_code, nickname` | `{collected: Species[], total:28, fortune_cards: []}` | readOnly:true, destructive:false, idempotent:true, openWorld:false | 읽기 전용, 28종 데이터라 별도 유지 |

> 방 멤버(멘션 대상) 목록 조회가 카카오톡 플랫폼 자체 기능으로 안 되는 것으로 확인되면 `list_room_players`(readOnly:true)를 8번째 툴로 추가합니다 — 권장 상한(10개) 안에서 여유 있음.

### 황금 이벤트 패널티 재설계 (TBD #8 반영)

방 전체 채팅을 감시할 수 없으므로, **golden 활성 중에는 모든 툴 핸들러 앞단에 공통 미들웨어**를 둡니다.

```ts
function beforeAnyToolCall(roomCode: string, callerNickname: string) {
  const room = getRoomState(roomCode);
  if (room.goldenHolder && room.goldenHolder !== callerNickname && now() < room.goldenExpiresAt) {
    addStack(roomCode, callerNickname, 1); // 패널티
    return { blocked: true, message: '황금 변기의 신이 강림했습니다. 지금은 침묵하십시오!' };
  }
  return { blocked: false };
}
```
holder 본인의 호출은 자유 허용, 그 외 닉네임의 툴 호출은 어떤 툴이든 +1 패널티 후 원래 요청은 차단(또는 허용하되 패널티만 부과 — 정책 확정 필요).

---

## 4. MCP 리소스 명세 (선택)

읽기 전용 데이터는 Tool 대신 Resource로도 노출 가능합니다. 웹뷰(4.2)가 MCP 리소스를 직접 구독할 수 있는 구조라면 아래로 대체 권장, 아니면 위 `check_*` 툴로 충분합니다.

- `poop-species://all` — 28종 정적 목록(이름/티어/확률), 방 무관 전역 리소스
- `room/{room_id}/user/{user_id}/toilet` — 변기 상태
- `room/{room_id}/user/{user_id}/dex` — 수집 도감
- `room/{room_id}/user/{user_id}/coin-history` — 코인 내역
- `room/{room_id}/user/{user_id}/skins` — 스킨 해금 현황

---

## 5. 확률 롤 로직 (의사코드)

```ts
function rollTier(): Tier {
  const r = Math.random();
  if (r < 0.75) return 'basic';
  if (r < 0.87) return 'rainbow';   // 0.75+0.12
  if (r < 0.95) return 'bomb';      // +0.08
  if (r < 0.99) return 'golden';    // +0.04
  return 'diamond';                 // +0.01
}

function throwPoop(roomId: string, thrower: string, target: string) {
  const tier = rollTier();
  const species = tier === 'basic'
    ? pickRandomBasicSpecies() // 24종 중 균등 랜덤
    : SINGLE_SPECIES[tier];

  recordDexHit(roomId, target, species.id);
  const coinEarned = COIN_REWARD.baseThrow; // 던지기 1회 보상 (기본값, tier 무관 가정 — 확인 필요)
  creditCoin(roomId, thrower, coinEarned, 'base_throw');
  applyDailyFirstThrowBonusIfNeeded(roomId, thrower);

  switch (tier) {
    case 'basic':
      addStack(roomId, target, 1);
      break;
    case 'rainbow':
      addStack(roomId, target, 1);
      setFortune(roomId, target, 'good');
      setFortune(roomId, thrower, 'good'); // "맞은 상대와 던진 사람 모두" (2.4절)
      creditCoin(roomId, target, COIN_REWARD.rainbowHit, 'rainbow_hit');
      incrementRainbowHitCount(roomId, target); // 스킨 조건용
      break;
    case 'bomb':
      endRound(roomId, winner = thrower);
      break;
    case 'golden':
      startGoldenEvent(roomId, holder = target);
      creditCoin(roomId, target, COIN_REWARD.goldenTrigger, 'golden_trigger');
      incrementGoldenEventCount(roomId, target); // 스킨 조건용
      break;
    case 'diamond':
      creditCoin(roomId, target, COIN_REWARD.diamondTrigger, 'diamond_trigger');
      incrementDiamondLifetimeCount(roomId, target); // 스킨 조건용
      applyRealWorldPenaltyNotice(roomId, target); // 엽떡 사주기 안내 메시지만 발송, 실제 결제 연동 X
      break;
  }
  setLastAttacker(roomId, target, thrower); // 복수하기용
}
```

---

## 6. 스킨 해금 조건 매핑 (참고용, 실제 지급은 UI/웹뷰 담당과 협의)

| 스킨 | 조건 | 판정 위치 |
|---|---|---|
| 새하얀/스테인리스/대리석/나노테크/옥좌 | `enhance_level` 1~5 도달 시 자동 | `enhance_toilet` 성공 시 체크 |
| 무지개 변기 | `rainbow_hit_count >= 50` | `throwPoop` rainbow 분기 |
| 황금 변기 | `golden_event_count >= 10` | `throwPoop` golden 분기 |
| 다이아 변기 | `diamond_lifetime_count >= 1` | `throwPoop` diamond 분기 |
| 올스타 변기 | `user_dex`에 species_id 1~24 전부 존재 | `recordDexHit` 후 매번 체크(또는 배치) |

---

## 7. 다음 단계 제안

1. **TBD #1~8 확정** — 특히 #4(라운드 리셋 범위), #8(전체 메시지 훅 가능 여부)은 설계 방향이 갈리는 항목이라 우선순위 높음.
2. 카카오 MCP 공모전의 실제 SDK/연동 문서가 있으면 공유해 주세요 — 이 문서는 표준 MCP(툴/리소스) 스펙 기준으로 작성했는데, 카카오 쪽에서 별도로 요구하는 host-server 프로토콜(인증 방식, 메시지 포워딩 범위, 카루셀 템플릿 규격 등)이 있다면 그에 맞춰 툴 시그니처를 조정해야 합니다.
3. 확정되면 위 스키마/툴 명세 그대로 Node.js + TypeScript 프로젝트 스캐폴딩(SQLite 초기화, MCP 서버 엔트리포인트, 각 툴 핸들러 스텁)을 진행할 수 있습니다 — 필요하시면 말씀해주세요.
