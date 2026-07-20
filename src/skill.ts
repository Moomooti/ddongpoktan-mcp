import type { Request, Response } from 'express';
import { getOrCreateAlias, setAlias } from './repository.js';
import { throwPoop } from './logic/throwPoop.js';
import { flushToilet } from './logic/flushToilet.js';
import { enhanceToilet } from './logic/enhanceToilet.js';
import { useBidet } from './logic/useBidet.js';
import { usePerfume } from './logic/usePerfume.js';
import { buildDex, buildStatus } from './logic/status.js';
import { selectSkin } from './logic/selectSkin.js';
import {
  formatBidetResult,
  formatDex,
  formatEnhanceResult,
  formatFlushResult,
  formatPerfumeResult,
  formatSelectSkinResult,
  formatStatus,
  formatThrowResult,
} from './formatters.js';

// Kakao i OpenBuilder's Skill payload has no room/chat identifier - only a
// per-bot-per-user id - so this integration path can't distinguish between
// group chats the channel is added to. Everyone through /skill shares one
// game space; a real multi-room OpenBuilder deployment would need Kakao's
// paid business messaging APIs to get a room id, which is out of scope here.
const ROOM_CODE = 'kakao_channel';

function kakaoText(text: string) {
  return { version: '2.0', template: { outputs: [{ simpleText: { text } }] } };
}

const HELP_TEXT =
  '💩 똥폭탄, 던질 준비 되셨나요?\n\n' +
  '명령어:\n' +
  '· 발사 @대상 - 똥폭탄 던지기\n' +
  '· 변기 열기 - 내 상태 확인\n' +
  '· 물 내리기 - 변기 비우기\n' +
  '· 변기 강화 - 변기 업그레이드\n' +
  '· 비데 사용 - 나쁜 운세 해제\n' +
  '· 퍼퓸 사용 - 변기 즉시 비우기\n' +
  '· 도감 - 수집 현황 보기\n' +
  '· 변기 선택 [번호] - 스킨 교체\n' +
  '· 닉네임 [이름] - 닉네임 바꾸기';

/** Handles Kakao i OpenBuilder Skill requests. Always responds 200 with a
 *  valid Kakao skill-response JSON body, even on internal errors, since the
 *  OpenBuilder relay expects that shape regardless of outcome. */
export function handleSkillRequest(req: Request, res: Response): void {
  try {
    const utterance: string = req.body?.userRequest?.utterance ?? '';
    const platformUserId: string = req.body?.userRequest?.user?.id ?? 'unknown';
    const nickname = getOrCreateAlias(platformUserId);

    const nicknameCmd = utterance.match(/^닉네임\s*(?:설정)?\s*(\S+)/);
    if (nicknameCmd) {
      const result = setAlias(platformUserId, nicknameCmd[1]);
      res.json(kakaoText(result.success ? `✅ 닉네임을 [${nicknameCmd[1]}]로 설정했습니다!` : `❌ ${result.message}`));
      return;
    }

    if (/발사|던져/.test(utterance)) {
      const mention = utterance.match(/@(\S+)/);
      const result = throwPoop(ROOM_CODE, nickname, mention?.[1]);
      res.json(kakaoText(formatThrowResult(result)));
      return;
    }
    if (/물\s*내리기/.test(utterance)) {
      res.json(kakaoText(formatFlushResult(flushToilet(ROOM_CODE, nickname))));
      return;
    }
    if (/변기\s*강화/.test(utterance)) {
      res.json(kakaoText(formatEnhanceResult(enhanceToilet(ROOM_CODE, nickname))));
      return;
    }
    if (/비데/.test(utterance)) {
      res.json(kakaoText(formatBidetResult(useBidet(ROOM_CODE, nickname))));
      return;
    }
    if (/퍼퓸|향수/.test(utterance)) {
      res.json(kakaoText(formatPerfumeResult(usePerfume(ROOM_CODE, nickname))));
      return;
    }
    if (/도감/.test(utterance)) {
      res.json(kakaoText(formatDex(buildDex(ROOM_CODE, nickname))));
      return;
    }
    if (/변기\s*선택/.test(utterance)) {
      const skinArg = utterance.match(/변기\s*선택\s*(\S+)/);
      res.json(kakaoText(formatSelectSkinResult(selectSkin(ROOM_CODE, nickname, skinArg?.[1]))));
      return;
    }
    if (/변기\s*(열기|확인)/.test(utterance)) {
      res.json(kakaoText(formatStatus(buildStatus(ROOM_CODE, nickname))));
      return;
    }

    res.json(kakaoText(`${HELP_TEXT}\n\n(현재 닉네임: ${nickname})`));
  } catch (err) {
    console.error('Error handling /skill request:', err);
    res.json(kakaoText('오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
  }
}
